import { z } from 'zod';

// ─── Create Project ───────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  serviceId:     z.string().cuid('Invalid service ID'),
  projectName:   z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  invoiceNumber: z
    .string()
    .min(1, 'Invoice number is required')
    .max(50, 'Invoice number too long')
    .transform((v) => v.trim()),
  startDate:   z
    .string()
    .min(1, 'Start date is required')
    .refine((d) => {
      const date = new Date(d);
      if (isNaN(date.getTime())) return false;
      // Cannot be more than 1 day in the future
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return date <= tomorrow;
    }, 'Start date cannot be more than 1 day in the future'),
  fieldValues: z.record(z.string(), z.union([z.string(), z.number()])),
});

// ─── Update Project (Employee edit of DRAFT) ─────────────────────────────────

export const updateProjectSchema = z.object({
  fieldValues: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  notes:       z.string().max(1000).optional(),
});

// ─── Update Project Finish (Employee sets finishDate + image) ─────────────────

export const updateProjectFinishSchema = z.object({
  finishDate: z
    .string()
    .min(1, 'Finish date is required')
    .refine((d) => !isNaN(new Date(d).getTime()), 'Invalid finish date'),
});

// ─── Approve Project (Admin) ──────────────────────────────────────────────────

export const approveProjectSchema = z.object({
  totalProjectPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .refine((v) => parseFloat(v) > 0, 'Total project price must be greater than 0'),
  makingCost: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .refine((v) => parseFloat(v) >= 0, 'Making cost cannot be negative'),
  paymentMode:    z.enum(['GST', 'CASH']),
  manualPayAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .refine((v) => parseFloat(v) > 0, 'Manual pay amount must be greater than 0')
    .optional(),
  approvalNotes: z.string().max(2000).optional(),
}).refine(
  (data) => {
    // If makingCost is 0, manualPayAmount is required
    if (parseFloat(data.makingCost) === 0 && !data.manualPayAmount) return false;
    return true;
  },
  {
    message: 'Manual pay amount is required when making cost is 0',
    path: ['manualPayAmount'],
  }
);

// ─── Update Status (Admin — REJECTED only via this endpoint) ─────────────────
// APPROVED is never valid here: approval must go through PATCH /:id/approve
// which enforces financial data, formula evaluation and payment record creation.

export const updateProjectStatusSchema = z.object({
  status: z.enum(['REJECTED']),
  notes:  z.string().max(1000).optional(),
});

// ─── Param schemas ────────────────────────────────────────────────────────────

export const projectIdParamSchema = z.object({
  id: z.string().cuid('Invalid project ID'),
});

export const checkInvoiceSchema = z.object({
  number: z.string().min(1, 'Invoice number is required'),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateProjectInput       = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput       = z.infer<typeof updateProjectSchema>;
export type UpdateProjectFinishInput = z.infer<typeof updateProjectFinishSchema>;
export type ApproveProjectInput      = z.infer<typeof approveProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export type CheckInvoiceInput        = z.infer<typeof checkInvoiceSchema>;
