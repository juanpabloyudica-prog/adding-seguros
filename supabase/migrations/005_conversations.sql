-- ─────────────────────────────────────────────────────────────────────────────
-- 005_conversations.sql
-- Conversations and messages (WhatsApp channel)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── conversations ────────────────────────────────────────────────────────────
-- No UNIQUE on (org_id, wa_phone): multiple conversations per number are valid
-- (different cases, historical threads, etc.)
CREATE TABLE conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id),
  person_id            uuid REFERENCES persons(id),
  case_id              uuid REFERENCES cases(id),
  producer_id          uuid REFERENCES producers(id),
  assigned_to_user_id  uuid REFERENCES users(id),
  escalated_to_user_id uuid REFERENCES users(id),
  locked_by_user_id    uuid REFERENCES users(id),
  locked_at            timestamptz,
  wa_phone             text NOT NULL,
  wa_contact_name      text,
  channel              text NOT NULL DEFAULT 'whatsapp',
  status               text NOT NULL DEFAULT 'open' CHECK (status IN (
                         'open', 'waiting_operativo', 'waiting_productor',
                         'escalated', 'resolved', 'closed'
                       )),
  unread_count         smallint NOT NULL DEFAULT 0,
  last_message_at      timestamptz,
  last_message_text    text,
  metadata             jsonb NOT NULL DEFAULT '{}',
  created_by           uuid NOT NULL REFERENCES users(id),
  updated_by           uuid NOT NULL REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_org_id ON conversations(org_id);
CREATE INDEX idx_conversations_wa_phone ON conversations(org_id, wa_phone);
CREATE INDEX idx_conversations_status ON conversations(org_id, status);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to_user_id);
CREATE INDEX idx_conversations_person_id ON conversations(person_id);
CREATE INDEX idx_conversations_last_message ON conversations(org_id, last_message_at DESC);
-- Index for finding active conversations by phone (inbox lookup)
CREATE INDEX idx_conversations_active_phone
  ON conversations(org_id, wa_phone)
  WHERE status NOT IN ('closed');

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_org_isolation ON conversations
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id),
  conversation_id   uuid NOT NULL REFERENCES conversations(id),
  sent_by_user_id   uuid REFERENCES users(id),
  created_by        uuid REFERENCES users(id),
  direction         text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  type              text NOT NULL CHECK (type IN (
                      'manual', 'automated', 'template', 'internal'
                    )),
  content           text,
  payload           jsonb NOT NULL DEFAULT '{}',
  media_url         text,
  media_type        text,
  wa_message_id     text,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending', 'sent', 'delivered', 'read', 'failed'
                    )),
  error_detail      text,
  signature_used    text,
  template_id       uuid,   -- FK to message_templates added in migration 006
  is_internal_note  boolean NOT NULL DEFAULT false,
  sent_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sent_at ON messages(conversation_id, sent_at DESC);
CREATE INDEX idx_messages_wa_message_id ON messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
-- Index for external-facing messages only (used when querying what to send)
CREATE INDEX idx_messages_outbound
  ON messages(conversation_id, sent_at)
  WHERE direction = 'outbound' AND is_internal_note = false;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_org_isolation ON messages
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());
