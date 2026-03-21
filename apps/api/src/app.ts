import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import pinoHttp from 'pino-http'

import { logger } from './shared/logger.js'
import { requestIdMiddleware } from './middleware/request-id.middleware.js'
import { authMiddleware } from './middleware/auth.middleware.js'
import { tenantMiddleware } from './middleware/tenant.middleware.js'
import { auditMiddleware } from './middleware/audit.middleware.js'
import { errorMiddleware } from './middleware/error.middleware.js'

import { personsRouter }   from './modules/persons/persons.router.js'
import { producersRouter } from './modules/producers/producers.router.js'
import { companiesRouter } from './modules/companies/companies.router.js'
import { risksRouter }     from './modules/risks/risks.router.js'
import { policiesRouter }      from './modules/policies/policies.router.js'
import { conversationsRouter } from './modules/conversations/conversations.router.js'
import { usersRouter }         from './modules/users/users.router.js'
import { casesRouter }         from './modules/cases/cases.router.js'
import { quotesRouter }        from './modules/quotes/quotes.router.js'
import { automationsRouter }   from './modules/automations/automations.router.js'
import { dashboardRouter }     from './modules/dashboard/dashboard.router.js'
import { documentsRouter }     from './modules/documents/documents.router.js'
import { handleWasenderWebhook } from './webhooks/wasender.webhook.js'

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express()

// ─── Security + parsing ───────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Request ID ───────────────────────────────────────────────────────────────
// Must run before the HTTP logger so every log line includes the request_id.
app.use(requestIdMiddleware)

// ─── Structured HTTP logging (pino-http) ─────────────────────────────────────
// Replaces morgan. Every request logs method, url, status, duration, request_id.
if (process.env['NODE_ENV'] !== 'test') {
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/version',
      },
      customLogLevel: (_req, res) => {
        if (res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
      },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    })
  )
}

// ─── Public endpoints (no auth required) ─────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] ?? 'unknown',
  })
})

app.get('/version', (_req, res) => {
  res.json({
    version: process.env['npm_package_version'] ?? '0.0.1',
    api: 'adding-seguros-api',
    timestamp: new Date().toISOString(),
  })
})

// ─── Webhook endpoints (no auth — validated by secret) ───────────────────────
app.post('/webhooks/wasender', (req, res) => handleWasenderWebhook(req, res))

// ─── Authenticated + tenant-scoped routes ─────────────────────────────────────
app.use('/api', authMiddleware, tenantMiddleware, auditMiddleware)

app.use('/api/persons',   personsRouter)
app.use('/api/producers',  producersRouter)
app.use('/api/companies',  companiesRouter)
app.use('/api/risks',      risksRouter)
app.use('/api/policies',       policiesRouter)
app.use('/api/conversations',   conversationsRouter)
app.use('/api/users',           usersRouter)
app.use('/api/cases',           casesRouter)
app.use('/api/quotes',          quotesRouter)
app.use('/api/automations',     automationsRouter)
app.use('/api/dashboard',       dashboardRouter)
app.use('/api/documents',       documentsRouter)
// Future modules:
// app.use('/api/cases',         casesRouter)
// app.use('/api/quotes',        quotesRouter)
// app.use('/api/conversations', conversationsRouter)
// app.use('/api/templates',     templatesRouter)
// app.use('/api/automations',   automationsRouter)
// app.use('/api/dashboard',     dashboardRouter)

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req: express.Request, res: express.Response) => {
  logger.warn({ requestId: req.requestId, path: req.path }, 'Route not found')
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  })
})

// ─── Central error handler (must be last) ────────────────────────────────────
app.use(errorMiddleware)

export { app }
