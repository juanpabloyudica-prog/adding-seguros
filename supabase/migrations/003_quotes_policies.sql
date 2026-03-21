-- ─────────────────────────────────────────────────────────────────────────────
-- 003_quotes_policies.sql
-- Quotes, quote_options, policies
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── quotes ───────────────────────────────────────────────────────────────────
CREATE TABLE quotes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id),
  person_id               uuid NOT NULL REFERENCES persons(id),
  risk_id                 uuid NOT NULL REFERENCES risks(id),
  producer_id             uuid REFERENCES producers(id),
  assigned_to_user_id     uuid REFERENCES users(id),
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN (
                            'draft', 'options_loaded', 'sent_to_client',
                            'selected', 'emitted', 'lost'
                          )),
  internal_recommendation text,
  source_pdf_url          text,
  commercial_pdf_url      text,
  selected_option_id      uuid,   -- FK added after quote_options table exists
  selection_reason        text,
  sent_at                 timestamptz,
  lost_reason             text,
  notes                   text,
  created_by              uuid NOT NULL REFERENCES users(id),
  updated_by              uuid NOT NULL REFERENCES users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_org_id ON quotes(org_id);
CREATE INDEX idx_quotes_person_id ON quotes(person_id);
CREATE INDEX idx_quotes_producer_id ON quotes(producer_id);
CREATE INDEX idx_quotes_status ON quotes(org_id, status);

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotes_org_isolation ON quotes
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── quote_options ────────────────────────────────────────────────────────────
CREATE TABLE quote_options (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL REFERENCES companies(id),
  plan_name         text NOT NULL,
  coverage          jsonb NOT NULL DEFAULT '{}',
  premium           numeric(12, 2) NOT NULL,
  currency          text NOT NULL DEFAULT 'ARS',
  payment_options   jsonb,
  company_ranking   smallint,
  internal_notes    text,
  is_analyzed       boolean NOT NULL DEFAULT true,
  is_sent_to_client boolean NOT NULL DEFAULT false,
  is_selected       boolean NOT NULL DEFAULT false,
  sort_order        smallint NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_options_quote_id ON quote_options(quote_id);
CREATE INDEX idx_quote_options_company_id ON quote_options(company_id);

-- Only one option can be selected per quote
CREATE UNIQUE INDEX idx_quote_options_selected
  ON quote_options(quote_id)
  WHERE is_selected = true;

ALTER TABLE quote_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY quote_options_org_isolation ON quote_options
  FOR ALL USING (
    is_service_role()
    OR quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );

-- Now add the FK from quotes.selected_option_id → quote_options.id
ALTER TABLE quotes
  ADD CONSTRAINT fk_quotes_selected_option
  FOREIGN KEY (selected_option_id) REFERENCES quote_options(id);

-- ─── policies ─────────────────────────────────────────────────────────────────
CREATE TABLE policies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  person_id           uuid NOT NULL REFERENCES persons(id),
  company_id          uuid NOT NULL REFERENCES companies(id),
  producer_id         uuid REFERENCES producers(id),
  assigned_to_user_id uuid REFERENCES users(id),
  risk_id             uuid REFERENCES risks(id),
  quote_id            uuid REFERENCES quotes(id),
  quote_option_id     uuid REFERENCES quote_options(id),
  policy_number       text NOT NULL,
  endorsement_number  text,
  ramo                text NOT NULL,
  plan                text,
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  premium             numeric(12, 2),
  currency            text NOT NULL DEFAULT 'ARS',
  payment_frequency   text CHECK (payment_frequency IN (
                        'mensual', 'trimestral', 'semestral', 'anual'
                      )),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN (
                        'active', 'expired', 'cancelled', 'suspended', 'pending_renewal'
                      )),
  renewal_alert_days  smallint NOT NULL DEFAULT 30,
  auto_renew          boolean NOT NULL DEFAULT false,
  notes               text,
  created_by          uuid NOT NULL REFERENCES users(id),
  updated_by          uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, company_id, policy_number)
);

CREATE INDEX idx_policies_org_id ON policies(org_id);
CREATE INDEX idx_policies_person_id ON policies(person_id);
CREATE INDEX idx_policies_producer_id ON policies(producer_id);
CREATE INDEX idx_policies_status ON policies(org_id, status);
CREATE INDEX idx_policies_end_date ON policies(org_id, end_date) WHERE status = 'active';
CREATE INDEX idx_policies_company_id ON policies(company_id);

CREATE TRIGGER policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY policies_org_isolation ON policies
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());
