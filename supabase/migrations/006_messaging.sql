-- ─────────────────────────────────────────────────────────────────────────────
-- 006_messaging.sql
-- message_templates, automation_rules, scheduled_messages
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── message_templates ───────────────────────────────────────────────────────
CREATE TABLE message_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id),
  name       text NOT NULL,
  category   text,
  type       text NOT NULL CHECK (type IN (
               'onboarding', 'event', 'adhoc', 'recurring'
             )),
  body       text NOT NULL,
  variables  text[] NOT NULL DEFAULT '{}',
  channel    text NOT NULL DEFAULT 'whatsapp',
  is_active  boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_org_id ON message_templates(org_id);
CREATE INDEX idx_templates_type ON message_templates(org_id, type);
CREATE INDEX idx_templates_active ON message_templates(org_id) WHERE is_active = true;

CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_org_isolation ON message_templates
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- Now that message_templates exists, add the FK from messages.template_id
ALTER TABLE messages
  ADD CONSTRAINT fk_messages_template
  FOREIGN KEY (template_id) REFERENCES message_templates(id);

-- ─── automation_rules ────────────────────────────────────────────────────────
CREATE TABLE automation_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id),
  template_id        uuid NOT NULL REFERENCES message_templates(id),
  name               text NOT NULL,
  trigger_event      text NOT NULL,
  delay_hours        integer NOT NULL DEFAULT 0,
  recurrence_days    integer,
  -- Scope filters (all optional; NULL = applies to all)
  filter_producer_id uuid REFERENCES producers(id),
  filter_company_id  uuid REFERENCES companies(id),
  filter_ramo        text,
  filter_policy_type text,
  extra_conditions   jsonb NOT NULL DEFAULT '{}',
  -- Events that automatically cancel pending scheduled messages for this rule
  cancel_on_events   text[] NOT NULL DEFAULT '{}',
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid NOT NULL REFERENCES users(id),
  updated_by         uuid NOT NULL REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_rules_org_id ON automation_rules(org_id);
CREATE INDEX idx_automation_rules_trigger ON automation_rules(org_id, trigger_event)
  WHERE is_active = true;

CREATE TRIGGER automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY automation_rules_org_isolation ON automation_rules
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── scheduled_messages ──────────────────────────────────────────────────────
CREATE TABLE scheduled_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  conversation_id  uuid NOT NULL REFERENCES conversations(id),
  template_id      uuid NOT NULL REFERENCES message_templates(id),
  rule_id          uuid REFERENCES automation_rules(id),
  -- Context references for traceability and fine-grained cancellation
  case_id          uuid REFERENCES cases(id),
  policy_id        uuid REFERENCES policies(id),
  quote_id         uuid REFERENCES quotes(id),
  -- Deterministic key: hash(rule_id:entity_id:YYYY-MM-DD) — prevents duplicates
  idempotency_key  text UNIQUE NOT NULL,
  scheduled_for    timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending', 'processing', 'sent', 'cancelled', 'failed', 'overridden'
                   )),
  variables        jsonb NOT NULL DEFAULT '{}',
  -- Cancellation tracking
  cancel_reason    text,
  cancelled_by     uuid REFERENCES users(id),   -- NULL = automatic cancellation
  cancelled_at     timestamptz,
  -- Manual override tracking
  override_by      uuid REFERENCES users(id),
  override_notes   text,
  -- Scheduler locking (optimistic: worker sets locked_until before processing)
  locked_until     timestamptz,
  -- Retry tracking
  attempts         smallint NOT NULL DEFAULT 0,
  max_attempts     smallint NOT NULL DEFAULT 3,
  last_attempted_at timestamptz,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_messages_org_id ON scheduled_messages(org_id);
-- Primary scheduler query: pending messages due now that are not locked
CREATE INDEX idx_scheduled_messages_queue
  ON scheduled_messages(org_id, scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_scheduled_messages_conversation ON scheduled_messages(conversation_id);
CREATE INDEX idx_scheduled_messages_case ON scheduled_messages(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_scheduled_messages_policy ON scheduled_messages(policy_id) WHERE policy_id IS NOT NULL;
CREATE INDEX idx_scheduled_messages_rule ON scheduled_messages(rule_id) WHERE rule_id IS NOT NULL;

CREATE TRIGGER scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_messages_org_isolation ON scheduled_messages
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());
