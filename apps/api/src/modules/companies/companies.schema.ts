import { z } from 'zod'

const uuidSchema = z.string().uuid()

const urlSchema = z.string().url('Must be a valid URL').max(500).optional()

export const createCompanySchema = z.object({
  name:                 z.string().min(2).max(200).trim(),
  short_name:           z.string().max(60).trim().optional(),
  logo_url:             z.string().url().max(500).optional(),
  login_url:            urlSchema,
  emision_url:          urlSchema,
  siniestros_url:       urlSchema,
  consulta_poliza_url:  urlSchema,
  multicotizador:       z.boolean().optional().default(false),
  ranking:              z.number().int().min(1).max(5).optional(),
  notes:                z.string().max(3000).optional(),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

export const updateCompanySchema = z.object({
  name:                 z.string().min(2).max(200).trim().optional(),
  short_name:           z.string().max(60).trim().nullable().optional(),
  logo_url:             z.string().url().max(500).nullable().optional(),
  login_url:            z.string().url().max(500).nullable().optional(),
  emision_url:          z.string().url().max(500).nullable().optional(),
  siniestros_url:       z.string().url().max(500).nullable().optional(),
  consulta_poliza_url:  z.string().url().max(500).nullable().optional(),
  multicotizador:       z.boolean().optional(),
  ranking:              z.number().int().min(1).max(5).nullable().optional(),
  notes:                z.string().max(3000).nullable().optional(),
  is_active:            z.boolean().optional(),
})

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>

export const listCompaniesSchema = z.object({
  page:          z.coerce.number().int().min(1).default(1),
  limit:         z.coerce.number().int().min(1).max(100).default(50),
  search:        z.string().max(200).optional(),
  is_active:     z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  multicotizador: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
})

export type ListCompaniesInput = z.infer<typeof listCompaniesSchema>

export const companyIdParamSchema = z.object({ id: uuidSchema })
