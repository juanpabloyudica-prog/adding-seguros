-- ─────────────────────────────────────────────────────────────────────────────
-- 009_idempotency_keys.sql
--
-- Tabla para soportar idempotencia en mutaciones del API.
-- Permite que el mismo request (identificado por Idempotency-Key) se pueda
-- reintentar sin producir efectos secundarios duplicados.
--
-- Diseño:
--   - La key es global por (org_id, key_value, endpoint).
--     Incluir el endpoint evita que la misma key colisione entre rutas distintas.
--   - Se guarda el status_code y response_body del resultado original.
--   - TTL de 24 horas. Un job de limpieza periódica puede borrar los registros
--     expirados (ver comentario al final).
--   - Estado 'processing' protege contra race conditions: si dos requests
--     idénticos llegan en paralelo, el segundo ve 'processing' y espera o falla.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE idempotency_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  -- The raw key sent in the Idempotency-Key header
  key_value     text NOT NULL,
  -- Endpoint that handled the request: 'POST /api/persons'
  -- Prevents same key being reused across different endpoints
  endpoint      text NOT NULL,
  -- Lifecycle: processing → completed | failed
  status        text NOT NULL DEFAULT 'processing' CHECK (status IN (
                  'processing', 'completed', 'failed'
                )),
  -- Stored response for completed requests
  status_code   smallint,
  response_body jsonb,
  -- Fingerprint of the request body (SHA-256 hex, first 16 chars)
  -- Used to detect key reuse with a different body (which is a client error)
  request_hash  text NOT NULL,
  -- Hard expiry: after this point the key is considered expired and
  -- a new request with the same key can proceed
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- One key per (org, key_value, endpoint) — different orgs are isolated
  UNIQUE (org_id, key_value, endpoint)
);

CREATE INDEX idx_idempotency_keys_org ON idempotency_keys(org_id, key_value, endpoint);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at);

CREATE TRIGGER idempotency_keys_updated_at
  BEFORE UPDATE ON idempotency_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY idempotency_keys_org_isolation ON idempotency_keys
  FOR ALL USING (is_service_role() OR org_id = auth_org_id());

-- ─── Cleanup function (call periodically via scheduler) ───────────────────────
-- DELETE FROM idempotency_keys WHERE expires_at < now();
-- This can be wired into the scheduler.service.ts cron job in a future iteration.
