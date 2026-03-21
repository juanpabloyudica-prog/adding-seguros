import { z } from 'zod'
import { normalizePhone } from '@adding/utils'

// ─── Reusable field schemas ───────────────────────────────────────────────────

const uuidSchema = z.string().uuid('Must be a valid UUID')

const phoneSchema = z
  .string()
  .min(8, 'Phone number too short')
  .max(20, 'Phone number too long')
  .transform((val) => normalizePhone(val))

const docTypeSchema = z.enum(['DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'otro'])

const addressSchema = z
  .object({
    street:   z.string().max(200).optional(),
    city:     z.string().max(100).optional(),
    province: z.string().max(100).optional(),
    zip:      z.string().max(20).optional(),
    country:  z.string().max(100).optional().default('Argentina'),
  })
  .optional()

// ─── Create ───────────────────────────────────────────────────────────────────
export const createPersonSchema = z.object({
  full_name:           z.string().min(2, 'Name too short').max(200).trim(),
  doc_type:            docTypeSchema.optional(),
  doc_number:          z.string().max(30).trim().optional(),
  phone:               phoneSchema.optional(),
  email:               z.string().email('Invalid email').max(254).toLowerCase().optional(),
  birthdate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  gender:              z.enum(['M', 'F', 'X', 'otro']).optional(),
  address:             addressSchema,
  is_company:          z.boolean().optional().default(false),
  tags:                z.array(z.string().max(50)).max(20).optional().default([]),
  notes:               z.string().max(5000).optional(),
  producer_id:         uuidSchema.optional(),
  assigned_to_user_id: uuidSchema.optional(),
}).refine(
  // doc_type and doc_number must both be present or both absent
  (data) => {
    const hasType   = data.doc_type   !== undefined
    const hasNumber = data.doc_number !== undefined
    return hasType === hasNumber
  },
  { message: 'doc_type and doc_number must be provided together', path: ['doc_type'] }
)

export type CreatePersonInput = z.infer<typeof createPersonSchema>

// ─── Update ───────────────────────────────────────────────────────────────────
// All fields optional; same validations apply when present
export const updatePersonSchema = z.object({
  full_name:           z.string().min(2).max(200).trim().optional(),
  doc_type:            docTypeSchema.optional(),
  doc_number:          z.string().max(30).trim().optional(),
  phone:               phoneSchema.optional(),
  email:               z.string().email().max(254).toLowerCase().optional(),
  birthdate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender:              z.enum(['M', 'F', 'X', 'otro']).optional(),
  address:             addressSchema,
  is_company:          z.boolean().optional(),
  tags:                z.array(z.string().max(50)).max(20).optional(),
  notes:               z.string().max(5000).optional(),
  producer_id:         uuidSchema.nullable().optional(),
  assigned_to_user_id: uuidSchema.nullable().optional(),
})

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>

// ─── List / search ────────────────────────────────────────────────────────────
export const listPersonsSchema = z.object({
  page:                z.coerce.number().int().min(1).default(1),
  limit:               z.coerce.number().int().min(1).max(100).default(20),
  search:              z.string().max(200).optional(),
  producer_id:         uuidSchema.optional(),
  assigned_to_user_id: uuidSchema.optional(),
  is_company:          z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  tags:                z.string().optional(), // comma-separated: "auto,hogar"
})

export type ListPersonsInput = z.infer<typeof listPersonsSchema>

// ─── Params ───────────────────────────────────────────────────────────────────
export const personIdParamSchema = z.object({
  id: uuidSchema,
})
