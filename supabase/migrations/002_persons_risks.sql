-- ─────────────────────────────────────────────────────────────────────────────
-- 002_persons_risks.sql
-- Persons, companies, risks
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── companies ────────────────────────────────────────────────────────────────
CREATE TABLE companies (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id),
  name                 text NOT NULL,
  short_name           text,
  logo_url             text,
  login_url            text,
  emision_url          text,
  siniestros_url       text,
  consulta_poliza_url  text,
  multicotizador       boolean NOT NULL DEFAULT false,
  ranking              smallint CHECK (ranking BETWEEN 1 AND 5),
  notes                text,
  is_active            boolean NOT NULL DEFAULT true,
  created_by           uuid NOT NULL REFERENCES users(id),
  updated_by           uuid NOT NULL REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_org_id ON companies(org_id);

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_org_isolation ON companies
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── persons ──────────────────────────────────────────────────────────────────
CREATE TABLE persons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  producer_id         uuid REFERENCES producers(id),
  assigned_to_user_id uuid REFERENCES users(id),
  full_name           text NOT NULL,
  doc_type            text CHECK (doc_type IN ('DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'otro')),
  doc_number          text,
  phone               text,
  email               text,
  birthdate           date,
  gender              text,
  address             jsonb,
  is_company          boolean NOT NULL DEFAULT false,
  tags                text[] NOT NULL DEFAULT '{}',
  notes               text,
  created_by          uuid NOT NULL REFERENCES users(id),
  updated_by          uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, doc_type, doc_number)
);

CREATE INDEX idx_persons_org_id ON persons(org_id);
CREATE INDEX idx_persons_producer_id ON persons(producer_id);
CREATE INDEX idx_persons_assigned ON persons(assigned_to_user_id);
CREATE INDEX idx_persons_phone ON persons(org_id, phone);
-- Full-text search on name
CREATE INDEX idx_persons_fullname_trgm ON persons USING GIN (full_name gin_trgm_ops);

CREATE TRIGGER persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY persons_org_isolation ON persons
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── risks ────────────────────────────────────────────────────────────────────
CREATE TABLE risks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  person_id    uuid NOT NULL REFERENCES persons(id),
  type         text NOT NULL CHECK (type IN (
                 'auto', 'moto', 'hogar', 'vida', 'accidentes',
                 'comercial', 'transporte', 'responsabilidad', 'otros'
               )),
  data         jsonb NOT NULL DEFAULT '{}',
  description  text,
  created_by   uuid NOT NULL REFERENCES users(id),
  updated_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_risks_person_id ON risks(person_id);
CREATE INDEX idx_risks_org_id ON risks(org_id);
CREATE INDEX idx_risks_type ON risks(org_id, type);

CREATE TRIGGER risks_updated_at
  BEFORE UPDATE ON risks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY risks_org_isolation ON risks
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());
