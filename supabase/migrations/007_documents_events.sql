-- ─────────────────────────────────────────────────────────────────────────────
-- 007_documents_events.sql
-- Documents (storage references) and events (immutable audit log)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── documents ───────────────────────────────────────────────────────────────
-- entity_type covers all entities. 'siniestro' is not a separate type
-- because a siniestro is a case with type='siniestro'. Use entity_type='case'.
CREATE TABLE documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  entity_type  text NOT NULL CHECK (entity_type IN (
                 'policy', 'case', 'quote', 'person'
               )),
  entity_id    uuid NOT NULL,
  type         text NOT NULL,   -- 'poliza_pdf', 'cedula', 'dni', 'cotizacion', 'informe', etc.
  file_url     text NOT NULL,
  file_name    text NOT NULL,
  file_size    integer,
  mime_type    text,
  is_public    boolean NOT NULL DEFAULT false,
  uploaded_by  uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- documents is append-only: no updated_at, no update trigger

CREATE INDEX idx_documents_org_id ON documents(org_id);
CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_documents_org_entity ON documents(org_id, entity_type, entity_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_org_isolation ON documents
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── events (audit log) ──────────────────────────────────────────────────────
-- Append-only. No updates ever. No updated_at column.
-- Covers all auditable actions across the system.
CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  user_id         uuid REFERENCES users(id),
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  action          text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  -- Optional shortcut references for common audit queries
  conversation_id uuid REFERENCES conversations(id),
  case_id         uuid REFERENCES cases(id),
  -- Request metadata
  ip_address      text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- events is append-only: no triggers, no updates
CREATE INDEX idx_events_org_id ON events(org_id, created_at DESC);
CREATE INDEX idx_events_entity ON events(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_events_user ON events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_events_conversation ON events(conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_events_case ON events(case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- events: all authenticated users in the org can read; only service role can write
-- (the API always writes events via the service role key)
CREATE POLICY events_read_org_isolation ON events
  FOR SELECT USING (is_service_role() OR org_id = auth_org_id());

CREATE POLICY events_insert_service_only ON events
  FOR INSERT WITH CHECK (is_service_role());

-- ─── Final summary view: all tables with RLS status ──────────────────────────
-- Run this query to verify: SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;
