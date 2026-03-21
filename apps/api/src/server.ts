import 'dotenv/config'
import { app } from './app.js'
import { pool } from './infrastructure/db/client.js'
import { logger } from './shared/logger.js'

// ─── Required environment variables ──────────────────────────────────────────
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    logger.fatal(
      { missing },
      'Missing required environment variables. Copy .env.example to .env and fill in the values.'
    )
    process.exit(1)
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  validateEnv()

  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    logger.info('Database connection verified')
  } catch (err) {
    logger.fatal({ err }, 'Could not connect to database')
    process.exit(1)
  }

  const port = parseInt(process.env['PORT'] ?? '3001', 10)

  const server = app.listen(port, () => {
    logger.info(
      { port, env: process.env['NODE_ENV'] ?? 'development' },
      'ADDING Seguros API started'
    )
  })

  // ─── Message scheduler ────────────────────────────────────────────────────
  // Controlled by AUTOMATIONS_SCHEDULER_ENABLED (default: true).
  //
  // Set to false on:
  //   - Replica / read-only nodes in multi-instance deployments
  //   - Environments with a dedicated external scheduler process
  //   - Any context where zero background work is required in the web process
  //
  // V1 safety: the optimistic lock (locked_until column + status check) prevents
  // double-sends when two instances briefly overlap during a rolling deploy,
  // but it is NOT a substitute for disabling the scheduler on all but one node.
  let stopScheduler: (() => void) | null = null

  const schedulerEnabled = process.env['AUTOMATIONS_SCHEDULER_ENABLED'] !== 'false'

  if (schedulerEnabled) {
    // Dynamic import: keeps the scheduler out of the module graph when disabled,
    // avoiding any side-effects or startup cost when it is not needed.
    const { startMessageScheduler } = await import('./scheduler/message.scheduler.js')
    stopScheduler = startMessageScheduler()
  } else {
    logger.info(
      { AUTOMATIONS_SCHEDULER_ENABLED: 'false' },
      'Message scheduler disabled — set AUTOMATIONS_SCHEDULER_ENABLED=true to enable'
    )
  }

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  function shutdown(signal: string): void {
    logger.info({ signal }, 'Shutdown signal received. Closing gracefully...')

    // Stop scheduler before closing HTTP — prevents new locks being acquired
    // while in-flight messages are still being processed.
    if (stopScheduler) {
      stopScheduler()
      logger.info('Message scheduler stopped')
    }

    server.close(async () => {
      logger.info('HTTP server closed')
      await pool.end()
      logger.info('DB pool closed. Goodbye.')
      process.exit(0)
    })

    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection')
  })
}

start()
