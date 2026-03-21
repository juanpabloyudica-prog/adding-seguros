-- ─────────────────────────────────────────────────────────────────────────────
-- seed/01_dev_data.sql
--
-- Minimal seed for local development and testing.
-- Inserts: 1 org, 1 admin, 1 productor, 1 operativo, 2 persons, 1 company.
--
-- IMPORTANT: This seed creates users in the `public.users` table only.
-- To log in via Supabase Auth you must ALSO create the auth.users entries.
-- Use `seed/02_auth_users.sql` for local Supabase, or create users via the
-- Supabase dashboard / CLI for a remote project.
--
-- All passwords for dev: Adding2024!
-- ─────────────────────────────────────────────────────────────────────────────

-- Use fixed UUIDs so the seed is idempotent and cross-referenced correctly
DO $$
DECLARE
  v_org_id       uuid := 'a0000000-0000-0000-0000-000000000001';
  v_admin_id     uuid := 'b0000000-0000-0000-0000-000000000001';
  v_producer_id  uuid := 'b0000000-0000-0000-0000-000000000002';
  v_operativo_id uuid := 'b0000000-0000-0000-0000-000000000003';
  v_producer_rec uuid := 'c0000000-0000-0000-0000-000000000001';
  v_company_id   uuid := 'd0000000-0000-0000-0000-000000000001';
  v_person1_id   uuid := 'e0000000-0000-0000-0000-000000000001';
  v_person2_id   uuid := 'e0000000-0000-0000-0000-000000000002';
BEGIN

-- ─── Organization ─────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, plan)
VALUES (
  v_org_id,
  'ADDING Seguros',
  'adding-seguros',
  'pro'
)
ON CONFLICT (id) DO NOTHING;

-- ─── Users ────────────────────────────────────────────────────────────────
-- Admin
INSERT INTO users (id, org_id, full_name, email, phone, role)
VALUES (
  v_admin_id,
  v_org_id,
  'Juan Pablo Yudica',
  'jp@adding.com.ar',
  '5491155550001',
  'admin'
)
ON CONFLICT (id) DO NOTHING;

-- Productor
INSERT INTO users (id, org_id, full_name, email, phone, role)
VALUES (
  v_producer_id,
  v_org_id,
  'Carlos Méndez',
  'carlos@adding.com.ar',
  '5491155550002',
  'productor'
)
ON CONFLICT (id) DO NOTHING;

-- Operativo
INSERT INTO users (id, org_id, full_name, email, phone, role)
VALUES (
  v_operativo_id,
  v_org_id,
  'Laura Gómez',
  'laura@adding.com.ar',
  '5491155550003',
  'operativo'
)
ON CONFLICT (id) DO NOTHING;

-- ─── Producer profile ─────────────────────────────────────────────────────
INSERT INTO producers (
  id, user_id, org_id, license_number, specialties,
  signature_text, created_by, updated_by
)
VALUES (
  v_producer_rec,
  v_producer_id,
  v_org_id,
  'MAT-0042',
  ARRAY['autos', 'hogar', 'vida'],
  'Hola, soy Carlos Méndez, productor asociado de ADDING Seguros. ¿En qué te puedo ayudar?',
  v_admin_id,
  v_admin_id
)
ON CONFLICT (id) DO NOTHING;

-- ─── Company ──────────────────────────────────────────────────────────────
INSERT INTO companies (
  id, org_id, name, short_name,
  login_url, emision_url, siniestros_url, consulta_poliza_url,
  multicotizador, ranking, notes,
  created_by, updated_by
)
VALUES (
  v_company_id,
  v_org_id,
  'Federación Patronal Seguros',
  'Fed. Patronal',
  'https://www.federacionpatronal.com.ar/login',
  'https://www.federacionpatronal.com.ar/emision',
  'https://www.federacionpatronal.com.ar/siniestros',
  'https://www.federacionpatronal.com.ar/consulta',
  true,
  4,
  'Buena cobertura en autos y hogar. Respuesta rápida en siniestros.',
  v_admin_id,
  v_admin_id
)
ON CONFLICT (id) DO NOTHING;

-- ─── Persons ──────────────────────────────────────────────────────────────
INSERT INTO persons (
  id, org_id, producer_id, assigned_to_user_id,
  full_name, doc_type, doc_number, phone, email,
  birthdate, is_company, tags,
  created_by, updated_by
)
VALUES (
  v_person1_id,
  v_org_id,
  v_producer_rec,
  v_operativo_id,
  'María Fernanda Ríos',
  'DNI',
  '32456789',
  '5491144440001',
  'mfrios@gmail.com',
  '1988-03-15',
  false,
  ARRAY['cliente', 'auto', 'hogar'],
  v_operativo_id,
  v_operativo_id
),
(
  v_person2_id,
  v_org_id,
  v_producer_rec,
  v_operativo_id,
  'Distribuidora Centronorte S.R.L.',
  'CUIT',
  '30-71234567-9',
  '5491133330001',
  'admin@centronorte.com.ar',
  NULL,
  true,
  ARRAY['empresa', 'comercial', 'flota'],
  v_operativo_id,
  v_operativo_id
)
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE 'Seed data inserted successfully.';
RAISE NOTICE 'org_id:       %', v_org_id;
RAISE NOTICE 'admin_id:     %', v_admin_id;
RAISE NOTICE 'producer_id:  %', v_producer_id;
RAISE NOTICE 'operativo_id: %', v_operativo_id;
RAISE NOTICE 'company_id:   %', v_company_id;
RAISE NOTICE 'person1_id:   %', v_person1_id;
RAISE NOTICE 'person2_id:   %', v_person2_id;

END $$;
