import { z } from 'zod';

const serviceFieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Field key must be a valid identifier'),
  label: z.string().min(1, 'Label is required'),
  type: z.enum(['text', 'number', 'date', 'select', 'textarea']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});

export const createServiceSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  invoicePrefix: z
    .string()
    .max(10, 'Prefix max 10 characters')
    .regex(/^[A-Z0-9\-]*$/i, 'Only letters, numbers, and hyphens')
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  fields: z.array(serviceFieldSchema).min(1, 'At least one field is required'),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  invoicePrefix: z
    .string()
    .max(10, 'Prefix max 10 characters')
    .regex(/^[A-Z0-9\-]*$/i, 'Only letters, numbers, and hyphens')
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : v)),
  fields: z.array(serviceFieldSchema).optional(),
  isActive: z.boolean().optional(),
});

export const serviceIdParamSchema = z.object({
  id: z.string().cuid('Invalid service ID'),
});

export const createMappingSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  serviceId: z.string().cuid('Invalid service ID'),
  formulaId: z.string().cuid('Invalid formula ID').optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateMappingInput = z.infer<typeof createMappingSchema>;
