# ADDING Seguros — Bootstrap del proyecto

Instrucciones para levantar el entorno desde cero en desarrollo local.

---

## Prerequisitos

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm` |
| Supabase CLI | 1.x | https://supabase.com/docs/guides/cli |
| Docker Desktop | 4.x | https://www.docker.com/products/docker-desktop |
| Git | cualquiera | preinstalado en macOS/Linux |

---

## 1. Clonar y configurar variables de entorno

```bash
git clone https://github.com/tu-org/adding-seguros.git
cd adding-seguros
cp .env.example .env
```

Editar `.env` con los valores reales. Los valores del proyecto Supabase local se obtienen en el paso 3.

---

## 2. Instalar dependencias

```bash
pnpm install
```

Instala dependencias de todos los workspaces (`apps/web`, `apps/api`, `packages/*`) en un solo comando.

---

## 3. Levantar Supabase local

```bash
supabase start
```

Al terminar, copiar las URLs y keys al `.env`:

```
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Supabase Studio: `http://localhost:54323`

---

## 4. Correr migraciones

```bash
# Aplica las 12 migraciones en orden (001 → 012)
supabase db push

# Verificar las 21 tablas
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

Resultado esperado (21 tablas):

```
automation_rules
case_timeline_entries
case_workflow_steps
case_workflows
cases
companies
conversations
documents
events
idempotency_keys
message_templates
messages
organizations
persons
policies
producers
quote_options
quotes
risks
scheduled_messages
users
```

---

## 5. Cargar seed de desarrollo

```bash
# Datos: 1 org, 3 usuarios, 1 productor, 2 personas, 1 compañía
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/seed/01_dev_data.sql

# Auth users — SOLO para Supabase local, NO usar en remoto
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/seed/02_auth_users.sql
```

**Usuarios de desarrollo:**

| Email | Password | Rol |
|---|---|---|
| jp@adding.com.ar | Adding2024! | admin |
| carlos@adding.com.ar | Adding2024! | productor |
| laura@adding.com.ar | Adding2024! | operativo |

---

## 6. Levantar el API

```bash
cd apps/api && pnpm dev
# http://localhost:3001
```

Verificar:
```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

---

## 7. Levantar el frontend

```bash
cd apps/web && pnpm dev
# http://localhost:3000
```

---

## 8. Levantar todo junto (recomendado)

```bash
pnpm dev   # desde la raíz del monorepo
```

- Frontend: `http://localhost:3000`
- API:      `http://localhost:3001`
- Studio:   `http://localhost:54323`

---

## Verificación RLS

```sql
-- Todas las tablas deben tener rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Verificación de idempotencia

```bash
TOKEN="<bearer-token>"

# Primer request — crea
curl -X POST http://localhost:3001/api/persons \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: idem-test-001" \
  -d '{"full_name":"Test","doc_type":"DNI","doc_number":"99999999"}'

# Segundo request misma key → Idempotency-Replayed: true en headers
curl -X POST http://localhost:3001/api/persons \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: idem-test-001" \
  -d '{"full_name":"Test","doc_type":"DNI","doc_number":"99999999"}'
```

---


---

## Storage (Supabase Storage)

### Bucket: `documents`

Private bucket — files require signed URLs or service-role access. Never publicly accessible.

**Path convention:** `{org_id}/{entity_type}/{entity_id}/{timestamp}-{sanitized_filename}`

Example: `abc-123/quote/def-456/1700000000000-propuesta_garcia.html`

**Allowed MIME types** (enforced at bucket level):
- `application/pdf` — PDF files
- `text/html` — Printable HTML proposals (V1 proposal format, see below)
- `image/jpeg`, `image/png`, `image/webp`
- `application/msword`, `.docx`, `.xlsx`
- `text/plain`, `text/csv`

**Size limit:** 50 MB per file

### RLS (Row Level Security)

Storage RLS is enforced via `CREATE POLICY ON storage.objects`. The key function is:

```sql
CREATE OR REPLACE FUNCTION storage.user_owns_object_path(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND org_id = SPLIT_PART(object_name, '/', 1)::uuid
      AND is_active = true
  )
$$;
```

**Policies:**

| Policy | Operation | Condition |
|---|---|---|
| `documents: authenticated upload` | INSERT | `bucket_id='documents' AND user_owns_object_path(name)` |
| `documents: authenticated read` | SELECT | `bucket_id='documents' AND user_owns_object_path(name)` |
| `documents: authenticated delete` | DELETE | `bucket_id='documents' AND user_owns_object_path(name)` |

**Path injection prevention:** A malicious user cannot upload to another org's path. Even if they manually craft `other-org-id/...` as the path, `user_owns_object_path()` does a DB lookup of `auth.uid() → org_id` and compares it to the first path segment. The check runs server-side on Supabase's Postgres, with `SECURITY DEFINER` so it always reads the real org from the users table.

**UPDATE is not granted** — files are immutable. Replacing a file requires a new upload + delete.

**Service-role bypass:** The service-role key bypasses RLS entirely (Supabase default behavior). Used only server-side in `POST /api/documents/:id/signed-url`.

### Upload flow

1. Browser calls `uploadDocument()` in `lib/storage/documents.ts`
2. File is uploaded directly to Supabase Storage with the user's JWT
3. Supabase evaluates the RLS policy before writing
4. On success, `POST /api/documents` registers metadata (path, name, size, type)
5. A signed URL (1h TTL) is returned to the browser

### URL strategy

Files are **never** publicly accessible. To open/download a file:
- Browser calls `POST /api/documents/:id/signed-url` (authenticated)
- Backend (service-role) generates a signed URL with `createSignedUrl(path, 3600)`
- Browser opens the URL in a new tab
- URLs expire after 1 hour. For download links, generate a fresh URL each time.

### ⚠ Propuesta comercial — V1 format

**What it is:** A styled HTML file stored in Supabase Storage.

**What it is NOT:** A binary PDF generated by the system.

The "Generar propuesta" button in `/cotizaciones/:id/propuesta` produces a print-ready HTML file with all quote data, client info, and coverages. It is uploaded to Storage and registered in the `documents` table with `type='cotizacion'`.

To get a PDF, the user opens the signed URL in their browser and uses **File > Print > Save as PDF**.

**Why this approach for V1:**
- No server-side dependencies (no Puppeteer, no wkhtmltopdf, no AWS Lambda)
- Renders identically in all modern browsers
- Print CSS is already included in the template
- The HTML file is the source of truth and can be restyled without regenerating

**V2 plan (not implemented):** Server-side PDF generation using Puppeteer on a dedicated worker or Vercel Edge Function. Would produce a true `.pdf` binary, enabling: PDF/A compliance, digital signatures, embedded fonts, guaranteed rendering. Estimated effort: 2–3 days. Trigger: when clients require a true PDF attachment for email delivery.

## Reset completo del entorno local

```bash
supabase stop --no-backup
supabase start
supabase db push
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/seed/01_dev_data.sql \
  -f supabase/seed/02_auth_users.sql
```

---

## Estructura de migraciones (001 → 012)

| Archivo | Contenido |
|---|---|
| 001_init_core.sql | organizations, users, producers + funciones RLS (`auth_org_id`, `is_service_role`) |
| 002_persons_risks.sql | companies, persons (con soft delete), risks |
| 003_quotes_policies.sql | quotes, quote_options, policies |
| 004_cases_workflows.sql | case_workflows, case_workflow_steps, cases, case_timeline_entries |
| 005_conversations.sql | conversations, messages |
| 006_messaging.sql | message_templates, automation_rules, scheduled_messages (idempotency + locking) |
| 007_documents_events.sql | documents, events (audit log append-only) |
| 008_persons_soft_delete_indexes.sql | `deleted_at`/`deleted_by` en persons, índices parciales de performance |
| 009_idempotency_keys.sql | idempotency_keys (TTL 24h, estados: processing/completed/failed) |
| 010_policies_fields_indexes.sql | status enum simplificado, `sum_insured`, `renewal_status`, `renewed_from_id`, payment_frequency en inglés, índices |
| 011_policies_coverage_external.sql | `coverage_summary` (jsonb), `external_policy_number`, `external_company_id` |
| 012_storage_bucket.sql | Bucket `documents` (privado, 50MB, mime types), función `user_owns_object_path()` (SECURITY DEFINER), políticas RLS en `storage.objects` para INSERT/SELECT/DELETE |

Regla: nunca modificar una migración ya ejecutada en producción. Crear siempre una nueva.

---


## Páginas del frontend (21 páginas)

| Ruta | Descripción |
|---|---|
| `/dashboard` | Dashboard con KPIs de cartera y tabla de vencimientos |
| `/mi-dia` | Vista operativa diaria — 6 secciones, auto-refresh 2min |
| `/personas` | Listado con búsqueda y filtros |
| `/personas/[id]` | Detalle: metadata, pólizas, conversaciones y documentos reales |
| `/polizas` | Listado con filtros por estado, búsqueda, paginación |
| `/polizas/[id]` | Detalle operativo: acciones renovar/cambiar estado, riesgo, documentos |
| `/polizas/vencimientos` | Vista operativa con urgencia codificada y TriggerRuleModal |
| `/gestiones` | Listado con filtros rápidos, badges de conversación (3 estados: sin/activa/no leída) y documentos |
| `/gestiones/[id]` | Detalle: timeline con automatizaciones visibles, stepper, acciones, panel lateral, conversaciones vinculadas |
| `/gestiones/nueva` | Wrapper de NewCaseModal con soporte de query params |
| `/cotizaciones` | Listado con filtros por estado |
| `/cotizaciones/[id]` | Detalle operativo: opciones, recomendación, selección |
| `/cotizaciones/[id]/propuesta` | Propuesta comercial + upload real de documentos a Storage |
| `/cotizaciones/nueva` | Formulario 3-paso: persona → riesgo → datos (con productor) |
| `/conversaciones` | Inbox con filtros rápidos, polling 15s |
| `/conversaciones/[id]` | Hilo completo, envío optimista, TriggerRuleModal, banner de gestión vinculada (linked_case) |
| `/automatizaciones` | Hub con 4 tabs: Reglas, Templates, Programados, Historial |
| `/documentos` | Listado global de documentos — filtros por entidad/tipo/nombre, abrir con signed URL |
| `/companias` | Listado de compañías con búsqueda, toggle inactivas |
| `/companias/[id]` | Detalle: links operativos inline-editables, ranking, metadata de pólizas/cotizaciones |
| `/configuracion` | Perfil editable + gestión de usuarios de la org (admin) |

## Endpoints disponibles

### Públicos
```
GET  /health
GET  /version
POST /webhooks/wasender   ← inbound WA messages (validado por WASENDER_WEBHOOK_SECRET)
```

### Autenticados (requieren `Authorization: Bearer <token>`)

```
# Me / Users
GET    /api/users/me
GET    /api/users                         ?role, is_active, search
PATCH  /api/users/:id                     (admin) is_active, role, full_name, phone — guard: cannot self-deactivate

# Persons
GET    /api/persons                       ?search, page, limit, producer_id, is_company, tags
POST   /api/persons                       [Idempotency-Key opcional]
GET    /api/persons/:id                   → con producer, assigned_to, metadata counts
PATCH  /api/persons/:id
DELETE /api/persons/:id                   soft delete (admin only)

# Producers
GET    /api/producers                     ?search, is_active, specialty, limit
POST   /api/producers                     [Idempotency-Key opcional]
GET    /api/producers/:id                 → con user y metadata counts
PATCH  /api/producers/:id

# Companies
GET    /api/companies                     ?search, is_active, multicotizador, page, limit
POST   /api/companies                     [Idempotency-Key opcional]
GET    /api/companies/:id                 → con metadata: active_policy_count, quote_option_count
PATCH  /api/companies/:id                 name, short_name, logo_url, login_url, emision_url,
                                         siniestros_url, consulta_poliza_url, ranking, is_active, notes

# Risks
GET    /api/risks                         ?person_id, type
POST   /api/risks                         [Idempotency-Key opcional]
GET    /api/risks/:id
PATCH  /api/risks/:id                     merge de datos (no reemplaza)
GET    /api/risks/by-person/:personId

# Policies
GET    /api/policies                      ?person_id, company_id, producer_id, status, ramo
GET    /api/policies/dashboard-summary    ?producer_id
GET    /api/policies/expiring             ?days (default 30), producer_id
POST   /api/policies                      [Idempotency-Key opcional]
GET    /api/policies/:id                  → con computed_status, days_until_expiry
PATCH  /api/policies/:id
PATCH  /api/policies/:id/status           transición con lifecycle validation
POST   /api/policies/:id/renew            [Idempotency-Key opcional] — crea nueva, marca anterior expired
PATCH  /api/policies/:id/renewal-status

# Conversations
GET    /api/conversations                 ?status, assigned_to_user_id, person_id, search, unread_only
GET    /api/conversations/:id             → con person, assigned_to, escalated_to, locked_by, linked_case (id/title/status/priority)
GET    /api/conversations/:id/messages    ?limit, before_sent_at
PATCH  /api/conversations/:id
POST   /api/conversations/:id/messages   → send message or internal note
POST   /api/conversations/:id/escalate
DELETE /api/conversations/:id/escalate
POST   /api/conversations/:id/takeover   ?force
DELETE /api/conversations/:id/takeover

# Cases
GET    /api/cases                         ?person_id, policy_id, producer_id, status, priority, open_only, overdue_only, search
                                         → incluye conversation_count, unread_conversation_count
POST   /api/cases                         [Idempotency-Key opcional]
GET    /api/cases/:id                     → con workflow+steps, timeline, person, policy, producer
PATCH  /api/cases/:id
PATCH  /api/cases/:id/status              lifecycle validation + auto-fires automation rules
PATCH  /api/cases/:id/step               workflow step transition + validation
POST   /api/cases/:id/close
POST   /api/cases/:id/timeline/notes
POST   /api/cases/:id/link-conversation
GET    /api/cases/:id/conversations
GET    /api/cases/:id/documents

# Quotes
GET    /api/quotes                        ?person_id, status, producer_id, search
POST   /api/quotes                        [Idempotency-Key opcional]
GET    /api/quotes/:id                    → con options+company, person, risk, producer
PATCH  /api/quotes/:id
POST   /api/quotes/:id/options
PATCH  /api/quotes/:id/options/:optionId
DELETE /api/quotes/:id/options/:optionId
POST   /api/quotes/:id/mark-sent
POST   /api/quotes/:id/select-option

# Automations
GET    /api/automations/templates
POST   /api/automations/templates
GET    /api/automations/templates/:id
PATCH  /api/automations/templates/:id
POST   /api/automations/templates/:id/preview
GET    /api/automations/rules
POST   /api/automations/rules
GET    /api/automations/rules/:id
PATCH  /api/automations/rules/:id
GET    /api/automations/scheduled         ?status, rule_id, policy_id, case_id, upcoming_only
DELETE /api/automations/scheduled/:id     cancela mensaje pendiente (body: {reason})
POST   /api/automations/trigger           disparo manual de regla
GET    /api/automations/history           ?page, limit, rule_id, action

# Documents
GET    /api/documents                         ?entity_type, entity_id, type
GET    /api/documents/:id
POST   /api/documents
GET    /api/documents/quote/:quoteId/pdf-data

# Dashboard
GET    /api/dashboard/my-day              ?assigned_to_me=true
```

### Idempotencia
Todos los `POST` de creación soportan header opcional:
```
Idempotency-Key: <uuid-o-string-único>
```
Comportamiento: key nueva → ejecuta | key completada → replay con `Idempotency-Replayed: true` | key en vuelo → 409 | payload diferente → 422 con `details.key`

---

## Variables de entorno

| Variable | Descripción | Apps |
|---|---|---|
| `DATABASE_URL` | Conexión directa a PostgreSQL | API |
| `SUPABASE_URL` | URL del proyecto Supabase | API, Web |
| `SUPABASE_ANON_KEY` | Clave anon (pública) | API, Web |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (secreta — nunca al browser) | API |
| `WASENDER_API_KEY` | Clave de la API de Wasender | API |
| `WASENDER_API_URL` | URL base de Wasender | API |
| `WASENDER_WEBHOOK_SECRET` | Secret para validar webhooks entrantes | API |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase expuesta al browser | Web |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key expuesta al browser | Web |
| `NEXT_PUBLIC_API_URL` | URL del API para el browser | Web |
| `PORT` | Puerto del API (default: 3001) | API |
| `NODE_ENV` | Entorno: development / production | API |
| `LOG_LEVEL` | Nivel pino: debug (dev) / info (prod) | API |
| `CORS_ORIGIN` | Origen CORS permitido (default: localhost:3000) | API |
| `AUTOMATIONS_SCHEDULER_ENABLED` | `true` (default) / `false` — ver sección scheduler | API |
| `AUTOMATIONS_SCHEDULER_INTERVAL_MS` | Intervalo entre ticks en ms (default: `300000` = 5 min) | API |
| `INSTANCE_ID` | Identificador de instancia para logs (default: `pid-<PID>`) | API |

---

## Scheduler de automatizaciones

El API incluye un scheduler in-process que procesa mensajes automáticos y dispara alertas de vencimiento de pólizas.

### Variables de control

**`AUTOMATIONS_SCHEDULER_ENABLED`** (default: `true`)

Controla si el scheduler arranca en este proceso.

```bash
AUTOMATIONS_SCHEDULER_ENABLED=true    # scheduler activo (default en dev y prod single-instance)
AUTOMATIONS_SCHEDULER_ENABLED=false   # scheduler deshabilitado
```

Cuándo poner `false`:
- Nodos réplica / read-only en despliegues multi-instancia
- Cuando un proceso worker externo (Sidekiq, BullMQ, cron) maneja el scheduling
- En tests de integración donde no se quieren efectos secundarios

**`AUTOMATIONS_SCHEDULER_INTERVAL_MS`** (default: `300000` = 5 minutos)

Cuánto tiempo espera el scheduler entre ticks. Reducir en desarrollo para probar más rápido:

```bash
AUTOMATIONS_SCHEDULER_INTERVAL_MS=30000   # 30 segundos — útil en dev
AUTOMATIONS_SCHEDULER_INTERVAL_MS=60000   # 1 minuto
AUTOMATIONS_SCHEDULER_INTERVAL_MS=300000  # 5 minutos (default)
```

**`INSTANCE_ID`** (default: `pid-<número de proceso>`)

Identificador único para esta instancia del servidor. Aparece en todos los logs del scheduler para facilitar la correlación en multi-instancia:

```bash
INSTANCE_ID=web-01    # primer nodo
INSTANCE_ID=web-02    # segundo nodo (con scheduler deshabilitado)
INSTANCE_ID=worker-01 # proceso worker dedicado
```

### Safety multi-instancia (V1)

El scheduler usa **locking optimista** (`locked_until` + `status=processing`) para prevenir doble-procesamiento si dos instancias se solapan brevemente (e.g. rolling deploy). Sin embargo, **no es un sistema de coordinación distribuida**. La recomendación es:

```
# Instancia principal (scheduler habilitado)
AUTOMATIONS_SCHEDULER_ENABLED=true
INSTANCE_ID=web-01

# Réplicas (scheduler deshabilitado)
AUTOMATIONS_SCHEDULER_ENABLED=false
INSTANCE_ID=web-02
```

### Qué hace cada tick

1. Busca `scheduled_messages` con `status=pending` y `scheduled_for <= now()`
2. Adquiere lock optimista en cada mensaje antes de enviarlo
3. Envía vía Wasender API, actualiza status a `sent` o `failed`
4. Escribe en `events` para trazabilidad
5. Si hay `case_id` vinculado, escribe en `case_timeline_entries`
6. Procesa alertas de vencimiento de pólizas (ver abajo)

### Alertas de vencimiento

En cada tick también ejecuta `processExpiringPolicies()` que:

- Busca pólizas `active` con `end_date` dentro de ventanas de **0–7d**, **8–15d**, **16–30d**
- Para cada ventana, dispara el trigger correspondiente (`policy_expiring_7d`, `15d`, `30d`)
- La ventana de días (no exacto) garantiza que no se pierden disparos aunque el scheduler haya estado caído
- La idempotencia se garantiza vía `idempotency_key = rule_id:policy_id:window_label` — mismo mensaje nunca se programa dos veces en la misma ventana
- Si la persona no tiene conversación activa, se crea una nueva automáticamente

### Logs esperados al iniciar

```
INFO  Message scheduler started  { intervalMs: 300000, instanceId: "pid-1234" }
INFO  Processing expiring policies  { trigger: "policy_expiring_7d", count: 3 }
INFO  Scheduler tick complete  { messagesProcessed: 5, policiesEvaluated: 47, rulesTriggered: 3, messagesScheduled: 3 }
```

---


### Trazabilidad de automatizaciones

Las entradas `system_event` en `case_timeline_entries` incluyen texto legible en español:
- `Mensaje automático enviado · regla "nombre" — enviado a +54...`
- `Error al enviar mensaje automático · regla "nombre"`
- `Mensaje automático programado · regla "nombre" — disparado por policy_expiring_7d`
- `Regla disparada manualmente (manual)`

**`ACTION_LABELS`** en `automations.tracing.ts` mapea cada acción a texto legible.
**`buildTimelineNotes()`** construye el texto usando `ruleName` y `templateName` (no UUIDs).

## Conexión directa a la DB local

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres"
# O desde el navegador:
open http://localhost:54323
```
