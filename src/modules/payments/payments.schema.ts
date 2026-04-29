import { z } from 'zod';

// ─── Params ───────────────────────────────────────────────────────────────────

export const paymentIdParamSchema = z.object({
  paymentId: z.string().cuid('Invalid payment ID'),
});
export type PaymentIdParam = z.infer<typeof paymentIdParamSchema>;

export const transactionIdParamSchema = z.object({
  paymentId:     z.string().cuid('Invalid payment ID'),
  transactionId: z.string().cuid('Invalid transaction ID'),
});
export type TransactionIdParam = z.infer<typeof transactionIdParamSchema>;

// ─── List Payments ────────────────────────────────────────────────────────────

export const paymentFilterSchema = z.object({
  status:     z.enum(['PENDING', 'PARTIAL', 'PAID', 'CANCELLED']).optional(),
  employeeId: z.string().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
});
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;

// ─── Add Transaction ──────────────────────────────────────────────────────────

export const createTransactionSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .transform(Math.round)
    .refine((v) => v > 0, { message: 'Amount must be a positive whole number' }),
  note: z.string().max(200, 'Note must be 200 characters or fewer').optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
