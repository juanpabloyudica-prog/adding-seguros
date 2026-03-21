import pg from 'pg'
import { createModuleLogger } from '../../shared/logger.js'

const { Pool } = pg
const log = createModuleLogger('db.client')

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required')
}

export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  log.error({ err }, 'Unexpected pool error')
})

// ─── Typed query helper ───────────────────────────────────────────────────────

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now()
  try {
    const result = await pool.query<T>(text, params)
    const duration = Date.now() - start
    if (process.env['NODE_ENV'] === 'development' && duration > 200) {
      log.warn({ duration, query: text.slice(0, 100) }, 'Slow query')
    }
    return result
  } catch (err) {
    log.error({ err, query: text.slice(0, 100) }, 'Query error')
    throw err
  }
}

// Returns the first row or null
export async function queryOne<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params)
  return result.rows[0] ?? null
}

// Returns all rows
export async function queryMany<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, params)
  return result.rows
}

// Runs multiple queries in a transaction
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
