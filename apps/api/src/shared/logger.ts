import pino from 'pino'

// ─── Logger instance ──────────────────────────────────────────────────────────
// In development: pretty-prints with colors via pino-pretty.
// In production: outputs newline-delimited JSON (NDJSON) for log aggregators.
//
// Usage anywhere in the codebase:
//   import { logger } from '../shared/logger.js'
//   logger.info({ userId, orgId }, 'Person created')
//   logger.error({ err, personId }, 'Failed to soft-delete person')

const isDev = process.env['NODE_ENV'] !== 'production'

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (isDev ? 'debug' : 'info'),
  // Rename pino's 'msg' field to 'message' for compatibility with most log platforms
  messageKey: 'message',
  // Standard timestamp field name
  timestamp: pino.stdTimeFunctions.isoTime,
  // In production serialize Error objects correctly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
})

// ─── Child logger factory ─────────────────────────────────────────────────────
// Creates a logger pre-bound with a module name so log lines show their origin.
//
// Usage:
//   const log = createModuleLogger('persons.service')
//   log.info({ personId }, 'Soft-deleting person')
//   → {"module":"persons.service","personId":"...","message":"Soft-deleting person"}

export function createModuleLogger(module: string) {
  return logger.child({ module })
}
