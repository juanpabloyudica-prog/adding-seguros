import { z } from 'zod'

const uuidSchema = z.string().uuid('Must be a valid UUID')

// ─── Create ───────────────────────────────────────────────────────────────────
// Creating a producer always references an existing user (role = 'productor').
export const createProducerSchema = z.object({
  user_id:        uuidSchema,
  license_number: z.string().max(100).trim().optional(),
  specialties:    z.array(z.string().max(80)).max(20).optional().default([]),
  signature_text: z.string().max(500).trim().optional(),
  bio:            z.string().max(2000).trim().optional(),
})

export type CreateProducerInput = z.infer<typeof createProducerSchema>

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateProducerSchema = z.object({
  license_number: z.string().max(100).trim().optional(),
  specialties:    z.array(z.string().max(80)).max(20).optional(),
  signature_text: z.string().max(500).trim().nullable().optional(),
  bio:            z.string().max(2000).trim().nullable().optional(),
  is_active:      z.boolean().optional(),
})

export type UpdateProducerInput = z.infer<typeof updateProducerSchema>

// ─── List ─────────────────────────────────────────────────────────────────────
export const listProducersSchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  search:     z.string().max(200).optional(),
  is_active:  z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  specialty:  z.string().max(80).optional(),
})

export type ListProducersInput = z.infer<typeof listProducersSchema>

export const producerIdParamSchema = z.object({
  id: uuidSchema,
})
