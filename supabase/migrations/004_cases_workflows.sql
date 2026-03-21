-- ─────────────────────────────────────────────────────────────────────────────
-- 004_cases_workflows.sql
-- Case workflows (relational steps), cases, timeline entries
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── case_workflows ───────────────────────────────────────────────────────────
CREATE TABLE case_workflows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id),
  name       text NOT NULL,
  case_type  text NOT NULL CHECK (case_type IN (
               'prospecto', 'recotizacion', 'incidencia',
               'siniestro', 'reclamo', 'consulta', 'endoso', 'otros'
             )),
  is_default boolean NOT NULL DEFAULT false,
  is_active  boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_workflows_org_id ON case_workflows(org_id);
-- Only one default workflow per case_type per org
CREATE UNIQUE INDEX idx_case_workflows_default
  ON case_workflows(org_id, case_type)
  WHERE is_default = true;

CREATE TRIGGER case_workflows_updated_at
  BEFORE UPDATE ON case_workflows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE case_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_workflows_org_isolation ON case_workflows
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── case_workflow_steps ──────────────────────────────────────────────────────
CREATE TABLE case_workflow_steps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id         uuid NOT NULL REFERENCES case_workflows(id) ON DELETE CASCADE,
  key                 text NOT NULL,
  label               text NOT NULL,
  step_order          smallint NOT NULL,
  required_fields     text[] NOT NULL DEFAULT '{}',
  allowed_transitions text[] NOT NULL DEFAULT '{}',
  auto_trigger_event  text,
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workflow_id, key),
  UNIQUE (workflow_id, step_order)
);

CREATE INDEX idx_workflow_steps_workflow_id ON case_workflow_steps(workflow_id);

ALTER TABLE case_workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_steps_org_isolation ON case_workflow_steps
  FOR ALL USING (
    is_service_role()
    OR workflow_id IN (SELECT id FROM case_workflows WHERE org_id = auth_org_id())
  );

-- ─── cases ────────────────────────────────────────────────────────────────────
CREATE TABLE cases (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id),
  person_id            uuid NOT NULL REFERENCES persons(id),
  policy_id            uuid REFERENCES policies(id),
  producer_id          uuid REFERENCES producers(id),
  assigned_to_user_id  uuid REFERENCES users(id),
  escalated_to_user_id uuid REFERENCES users(id),
  workflow_id          uuid REFERENCES case_workflows(id),
  current_step_key     text,
  type                 text NOT NULL CHECK (type IN (
                         'prospecto', 'recotizacion', 'incidencia',
                         'siniestro', 'reclamo', 'consulta', 'endoso', 'otros'
                       )),
  status               text NOT NULL DEFAULT 'open' CHECK (status IN (
                         'open', 'in_progress', 'waiting_client', 'waiting_company',
                         'escalated', 'resolved', 'closed', 'cancelled'
                       )),
  priority             text NOT NULL DEFAULT 'medium' CHECK (priority IN (
                         'low', 'medium', 'high', 'urgent'
                       )),
  title                text NOT NULL,
  description          text,
  due_date             date,
  required_documents   text[] NOT NULL DEFAULT '{}',
  result               text,
  result_type          text CHECK (result_type IN (
                         'ganado', 'perdido', 'resuelto', 'sin_resultado'
                       )),
  closed_at            timestamptz,
  created_by           uuid NOT NULL REFERENCES users(id),
  updated_by           uuid NOT NULL REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_org_id ON cases(org_id);
CREATE INDEX idx_cases_person_id ON cases(person_id);
CREATE INDEX idx_cases_producer_id ON cases(producer_id);
CREATE INDEX idx_cases_assigned ON cases(assigned_to_user_id);
CREATE INDEX idx_cases_status ON cases(org_id, status);
CREATE INDEX idx_cases_type ON cases(org_id, type);
CREATE INDEX idx_cases_due_date ON cases(org_id, due_date) WHERE status NOT IN ('closed', 'cancelled');

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY cases_org_isolation ON cases
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── case_timeline_entries ────────────────────────────────────────────────────
CREATE TABLE case_timeline_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN (
                 'status_change', 'step_change', 'assignment', 'note',
                 'document_added', 'message_sent', 'escalation', 'system_event'
               )),
  from_value   text,
  to_value     text,
  notes        text,
  performed_by uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_timeline_case_id ON case_timeline_entries(case_id);
CREATE INDEX idx_case_timeline_created_at ON case_timeline_entries(case_id, created_at DESC);

ALTER TABLE case_timeline_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_timeline_org_isolation ON case_timeline_entries
  FOR ALL USING (
    is_service_role()
    OR case_id IN (SELECT id FROM cases WHERE org_id = auth_org_id())
  );
