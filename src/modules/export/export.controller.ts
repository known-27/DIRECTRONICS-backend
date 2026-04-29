import { Request, Response } from 'express';
import { tryCatch } from '../../utils/tryCatch';
import { AuthError, ForbiddenError } from '../../utils/errors';
import { listProjectsService } from '../projects/projects.service';
import { listPaymentsService } from '../payments/payments.service';
import { generateProjectsPdf, generatePaymentsPdf } from './export.service';

const getFilterLabel = (query: Record<string, string | undefined>): string => {
  if (query.dateRange === 'today')        return 'Today';
  if (query.dateRange === 'this_week')    return 'This Week';
  if (query.dateRange === 'this_month')   return 'This Month';
  if (query.dateRange === 'this_quarter') return 'This Quarter';
  if (query.dateRange === 'this_year')    return 'This Year';
  if (query.dateRange === 'custom') {
    return `${query.startDate ?? '?'} to ${query.endDate ?? '?'}`;
  }
  return 'All Time';
};

// ─── GET /export/projects/pdf ─────────────────────────────────────────────────

export const exportProjectsPdf = tryCatch(async (req: Request, res: Response) => {
  if (!req.user) throw new AuthError('Not authenticated');

  const role = req.user.role as 'ADMIN' | 'EMPLOYEE';
  const query = req.query as Record<string, string | undefined>;

  const result = await listProjectsService(role, req.user.sub, {
    ...query,
    limit: '10000', // Export all matching records
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (result.data as any[]).map((p: any) => ({
    invoiceNumber:     p.invoiceNumber ?? null,
    projectName:       p.projectName ?? '',
    serviceName:       p.service?.name ?? '—',
    employeeName:      p.employee?.name ?? '—',
    startDate:         new Date(p.startDate),
    status:            p.status,
    paymentMode:       p.paymentMode ?? null,
    totalProjectPrice: role === 'ADMIN' ? p.totalProjectPrice : undefined,
    makingCost:        role === 'ADMIN' ? p.makingCost        : undefined,
    calculatedAmount:  p.calculatedAmount ?? null,
    createdAt:         new Date(p.createdAt),
  }));

  const exportedBy   = req.user.sub;
  const filterLabel  = getFilterLabel(query);

  generateProjectsPdf(res, rows, role === 'ADMIN', exportedBy, filterLabel);
});

// ─── GET /export/payments/pdf (Admin only) ────────────────────────────────────

export const exportPaymentsPdf = tryCatch(async (req: Request, res: Response) => {
  if (!req.user) throw new AuthError('Not authenticated');
  if (req.user.role !== 'ADMIN') throw new ForbiddenError('Only admins can export payment reports');

  const query = req.query as Record<string, string | undefined>;

  const result = await listPaymentsService({ page: 1, limit: 10000 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (result.data as any[]).map((p: any) => ({
    employeeName:     p.employee?.name ?? '—',
    invoiceNumber:    p.project?.invoiceNumber ?? null,
    projectName:      p.project?.projectName ?? '—',
    calculatedAmount: p.calculatedAmount ?? 0,
    totalPaid:        p.totalPaid ?? 0,
    pendingAmount:    p.pendingAmount ?? 0,
    paymentMode:      p.paymentMode ?? null,
    status:           p.status,
    paidAt:           p.paidAt ? new Date(p.paidAt) : null,
  }));

  generatePaymentsPdf(res, rows, req.user.sub, getFilterLabel(query));
});
