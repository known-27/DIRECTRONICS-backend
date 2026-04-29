import { Prisma } from '@prisma/client';

// ─── Full Project Include ─────────────────────────────────────────────────────

export const PROJECT_INCLUDE = {
  employee:    { select: { id: true, name: true, fullName: true, email: true, profilePictureUrl: true } },
  approvedBy:  { select: { id: true, name: true, fullName: true } },
  service:     { select: { id: true, name: true, fields: true } },
  formulaSnapshot: true,
  details: true,
  payments: {
    include: {
      transactions: {
        orderBy: { paidAt: 'asc' as const },
        include: {
          paidBy: { select: { id: true, name: true, fullName: true } },
        },
      },
    },
  },
} satisfies Prisma.ProjectInclude;

// Type of a project retrieved with PROJECT_INCLUDE
type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

// ─── Submission Readiness ─────────────────────────────────────────────────────

/**
 * Single source of truth for whether a project can be submitted for review.
 * Returns true ONLY when:
 *   - finishDate is not null
 *   - completionImageUrl is not null and not an empty string
 *
 * This function must NEVER be replicated on the frontend — the backend always
 * computes and exposes `isReadyForSubmission` in the project DTO.
 */
export const isProjectReadyForSubmission = (
  project: Pick<ProjectWithRelations, 'finishDate' | 'completionImageUrl'>
): boolean => {
  return (
    project.finishDate !== null &&
    project.completionImageUrl !== null &&
    project.completionImageUrl !== ''
  );
};

// ─── Payment summary builders ─────────────────────────────────────────────────

type PaymentWithTransactions = ProjectWithRelations['payments'][number];

/** Admin-visible transaction: includes note and paidBy name */
type AdminTransaction = {
  id:        string;
  amount:    number;
  note:      string | null;
  paidAt:    Date;
  paidById:  string;
  paidByName: string;
};

/** Employee-visible transaction: amount + paidAt only — no notes or admin identity */
type EmployeeTransaction = {
  id:     string;
  amount: number;
  paidAt: Date;
};

export type AdminPaymentSummary = {
  id:              string;
  calculatedAmount: number;
  totalPaid:       number;
  pendingAmount:   number;
  status:          string;
  paymentMode:     string | null;
  paidAt:          Date | null;
  transactions:    AdminTransaction[];
};

export type EmployeePaymentSummary = {
  id:              string;
  calculatedAmount: number;
  totalPaid:       number;
  pendingAmount:   number;
  status:          string;
  paymentMode:     string | null;
  paidAt:          Date | null;
  transactions:    EmployeeTransaction[];
};

export const toAdminPaymentSummary = (p: PaymentWithTransactions): AdminPaymentSummary => ({
  id:               p.id,
  calculatedAmount: p.calculatedAmount,
  totalPaid:        p.totalPaid,
  pendingAmount:    p.pendingAmount,
  status:           p.status,
  paymentMode:      p.paymentMode ?? null,
  paidAt:           p.paidAt,
  transactions:     p.transactions.map(t => ({
    id:         t.id,
    amount:     t.amount,
    note:       t.note,
    paidAt:     t.paidAt,
    paidById:   t.paidById,
    paidByName: t.paidBy.fullName || t.paidBy.name,
  })),
});

export const toEmployeePaymentSummary = (p: PaymentWithTransactions): EmployeePaymentSummary => ({
  id:               p.id,
  calculatedAmount: p.calculatedAmount,
  totalPaid:        p.totalPaid,
  pendingAmount:    p.pendingAmount,
  status:           p.status,
  paymentMode:      p.paymentMode ?? null,
  paidAt:           p.paidAt,
  transactions:     p.transactions.map(t => ({
    id:     t.id,
    amount: t.amount,
    paidAt: t.paidAt,
  })),
});

// ─── Admin DTO — full fields ──────────────────────────────────────────────────

export type AdminProjectDto = Omit<ProjectWithRelations, 'payments'> & {
  isReadyForSubmission: boolean;
  payments: AdminPaymentSummary[];
};

export const toAdminProjectDto = (project: ProjectWithRelations): AdminProjectDto => ({
  ...project,
  isReadyForSubmission: isProjectReadyForSubmission(project),
  payments: project.payments.map(toAdminPaymentSummary),
});

// ─── Employee DTO — restricted fields ────────────────────────────────────────

export type EmployeeProjectDto = Omit<
  ProjectWithRelations,
  'totalProjectPrice' | 'makingCost' | 'manualPayAmount' | 'payments'
> & {
  isReadyForSubmission: boolean;
  payments: EmployeePaymentSummary[];
};

export const toEmployeeProjectDto = (project: ProjectWithRelations): EmployeeProjectDto => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { totalProjectPrice, makingCost, manualPayAmount, payments, ...rest } = project;
  return {
    ...rest,
    isReadyForSubmission: isProjectReadyForSubmission(project),
    payments: payments.map(toEmployeePaymentSummary),
  };
};

// ─── Apply DTO based on role ──────────────────────────────────────────────────

export const applyProjectDto = (
  project: ProjectWithRelations,
  role: 'ADMIN' | 'EMPLOYEE'
): AdminProjectDto | EmployeeProjectDto => {
  return role === 'ADMIN' ? toAdminProjectDto(project) : toEmployeeProjectDto(project);
};

export const applyProjectDtoList = (
  projects: ProjectWithRelations[],
  role: 'ADMIN' | 'EMPLOYEE'
): (AdminProjectDto | EmployeeProjectDto)[] => {
  return projects.map((p) => applyProjectDto(p, role));
};
