import { z } from 'zod'
import { RISK_TYPES } from '@adding/types'

const uuidSchema = z.string().uuid()

// ─── Risk data shapes per type ────────────────────────────────────────────────
// These are the expected fields for each risk type stored in the jsonb `data`
// column. Zod validates them here; the DB stores whatever JSON arrives.
// Using discriminated union so the frontend gets per-type type safety too.

const autoDataSchema = z.object({
  patente:        z.string().max(20).optional(),
  marca:          z.string().max(100).optional(),
  modelo:         z.string().max(100).optional(),
  anio:           z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  version:        z.string().max(100).optional(),
  uso:            z.enum(['particular','comercial','remis','taxi','otro']).optional(),
  suma_asegurada: z.number().positive().optional(),
  gnc:            z.boolean().optional(),
  vin:            z.string().max(20).optional(),
}).passthrough()  // allow extra fields for future extension

const motoDataSchema = z.object({
  patente:        z.string().max(20).optional(),
  marca:          z.string().max(100).optional(),
  modelo:         z.string().max(100).optional(),
  anio:           z.number().int().min(1900).optional(),
  cilindrada:     z.number().int().positive().optional(),
  suma_asegurada: z.number().positive().optional(),
}).passthrough()

const hogarDataSchema = z.object({
  direccion:         z.string().max(300).optional(),
  tipo:              z.enum(['casa','depto','local','otro']).optional(),
  suma_edificio:     z.number().positive().optional(),
  suma_contenido:    z.number().positive().optional(),
  metros_cuadrados:  z.number().positive().optional(),
  uso:               z.enum(['vivienda_propia','alquilado','mixto']).optional(),
}).passthrough()

const genericDataSchema = z.record(z.unknown())

function getRiskDataSchema(type: string) {
  switch (type) {
    case 'auto':  return autoDataSchema
    case 'moto':  return motoDataSchema
    case 'hogar': return hogarDataSchema
    default:      return genericDataSchema
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────
export const createRiskSchema = z.object({
  person_id:   uuidSchema,
  type:        z.enum(RISK_TYPES),
  data:        z.record(z.unknown()).default({}),
  description: z.string().max(1000).optional(),
}).superRefine((val, ctx) => {
  const dataSchema = getRiskDataSchema(val.type)
  const result = dataSchema.safeParse(val.data)
  if (!result.success) {
    result.error.errors.forEach((e) => {
      ctx.addIssue({ ...e, path: ['data', ...e.path] })
    })
  }
})

export type CreateRiskInput = z.infer<typeof createRiskSchema>

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateRiskSchema = z.object({
  data:        z.record(z.unknown()).optional(),
  description: z.string().max(1000).nullable().optional(),
})

export type UpdateRiskInput = z.infer<typeof updateRiskSchema>

// ─── List ─────────────────────────────────────────────────────────────────────
export const listRisksSchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  person_id: uuidSchema.optional(),
  type:      z.enum(RISK_TYPES).optional(),
})

export type ListRisksInput = z.infer<typeof listRisksSchema>

export const riskIdParamSchema  = z.object({ id: uuidSchema })
export const riskByPersonSchema = z.object({ personId: uuidSchema })
