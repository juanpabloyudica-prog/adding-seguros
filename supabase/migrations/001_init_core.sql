-- ─────────────────────────────────────────────────────────────────────────────
-- 001_init_core.sql
-- Organizations, users, producers. RLS base. updated_at trigger.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for full-text search on names

-- ─── updated_at trigger function (shared by all tables) ──────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── organizations ────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  settings   jsonb NOT NULL DEFAULT '{}',
  plan       text NOT NULL DEFAULT 'starter',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── users ────────────────────────────────────────────────────────────────────
-- id mirrors auth.users(id) from Supabase Auth
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  org_id        uuid NOT NULL REFERENCES organizations(id),
  full_name     text NOT NULL,
  email         text NOT NULL,
  phone         text,
  role          text NOT NULL CHECK (role IN (
                  'admin', 'operativo', 'productor', 'supervisor', 'readonly'
                )),
  avatar_url    text,
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, email)
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_role ON users(org_id, role);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── producers ────────────────────────────────────────────────────────────────
CREATE TABLE producers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL UNIQUE REFERENCES users(id),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  license_number   text,
  specialties      text[] NOT NULL DEFAULT '{}',
  signature_text   text,
  bio              text,
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid NOT NULL REFERENCES users(id),
  updated_by       uuid NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_producers_org_id ON producers(org_id);
CREATE INDEX idx_producers_user_id ON producers(user_id);

CREATE TRIGGER producers_updated_at
  BEFORE UPDATE ON producers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Auth helper function ─────────────────────────────────────────────────────
-- Returns the org_id for the currently authenticated user.
-- SECURITY DEFINER + STABLE so PostgreSQL can cache the result per query,
-- avoiding a subquery-per-row. This is the standard pattern for Supabase RLS.
-- The function reads org_id from the users table once per request, breaking
-- the circular dependency that would occur if the users policy queried itself.
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- Service-role bypass helper: returns true when called with the service role key.
-- Used by the API backend which already enforces org isolation at the application layer.
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('role') = 'service_role';
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE producers ENABLE ROW LEVEL SECURITY;

-- organizations: user can only see their own org
-- Uses direct auth.uid() lookup to avoid calling auth_org_id() which reads users
CREATE POLICY org_isolation ON organizations
  FOR ALL USING (
    is_service_role()
    OR id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- users: see all users in the same org
-- auth_org_id() is safe here because it only recurses if auth.uid() row itself
-- is in a different org — which cannot happen. PostgreSQL evaluates the function
-- once per query due to STABLE, not once per row.
CREATE POLICY users_org_isolation ON users
  FOR ALL USING (
    is_service_role()
    OR org_id = auth_org_id()
  );

-- producers: see all producers in the same org
CREATE POLICY producers_org_isolation ON producers
  FOR ALL USING (
    is_service_role()
    OR org_id = auth_org_id()
  );
