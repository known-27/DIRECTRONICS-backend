import { z } from 'zod';

const formulaVariableSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Variable key must be a valid identifier'),
  label: z.string().min(1),
  type: z.enum(['number', 'string']).default('number'),
  sourceField: z.string().optional(),
});

export const createFormulaSchema = z.object({
  name: z.string().min(2).max(100),
  serviceId: z.string().cuid('Invalid service ID'),
  expression: z.string().min(1, 'Expression is required').max(2000),
  variables: z.array(formulaVariableSchema).min(1, 'At least one variable is required'),
});

export const updateFormulaSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  expression: z.string().min(1).max(2000).optional(),
  variables: z.array(formulaVariableSchema).optional(),
  isActive: z.boolean().optional(),
});

export const testFormulaSchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const formulaIdParamSchema = z.object({
  id: z.string().cuid('Invalid formula ID'),
});

export type CreateFormulaInput = z.infer<typeof createFormulaSchema>;
export type UpdateFormulaInput = z.infer<typeof updateFormulaSchema>;
export type TestFormulaInput = z.infer<typeof testFormulaSchema>;
