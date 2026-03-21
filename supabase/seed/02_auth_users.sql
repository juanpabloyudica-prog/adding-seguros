-- ─────────────────────────────────────────────────────────────────────────────
-- seed/02_auth_users.sql
--
-- Creates auth.users entries for local Supabase development ONLY.
-- DO NOT run this on a remote/production Supabase project.
-- On remote: create users via Supabase Dashboard → Authentication → Users.
--
-- These UUIDs must match those in 01_dev_data.sql.
-- Password for all dev users: Adding2024!
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  aud,
  role
)
VALUES
(
  'b0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'jp@adding.com.ar',
  crypt('Adding2024!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Juan Pablo Yudica"}',
  now(), now(), 'authenticated', 'authenticated'
),
(
  'b0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'carlos@adding.com.ar',
  crypt('Adding2024!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Carlos Méndez"}',
  now(), now(), 'authenticated', 'authenticated'
),
(
  'b0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'laura@adding.com.ar',
  crypt('Adding2024!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Laura Gómez"}',
  now(), now(), 'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;
