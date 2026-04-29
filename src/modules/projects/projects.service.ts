// Decimal import removed — all monetary amounts are now plain integers
import prisma from '../../config/db';
import { NotFoundError, ForbiddenError, UnprocessableError, BadRequestError, ProjectNotReadyError, ConflictError } from '../../utils/errors';
import { auditLog } from '../audit/auditLog';
import { CONSTANTS } from '../../config/constants';
import { evaluateFormula } from '../formulas/formula.evaluator';
import { buildDateRangeFilter, buildPaginationArgs, buildPaginatedResponse } from '../../utils/filters';
import { PROJECT_INCLUDE, applyProjectDto, applyProjectDtoList, isProjectReadyForSubmission } from './projects.dto';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  UpdateProjectFinishInput,
  ApproveProjectInput,
  UpdateProjectStatusInput,
} from './projects.schema';
import { Prisma, $Enums } from '@prisma/client';

// ─── Create Project ───────────────────────────────────────────────────────────

export const createProjectService = async (
  input: CreateProjectInput,
  employeeId: string,
  ipAddress: string
) => {
  // 1. Validate employee is mapped to this service
  const mapping = await prisma.employeeServiceMapping.findUnique({
    where: { userId_serviceId: { userId: employeeId, serviceId: input.serviceId } },
    include: { formula: true, service: true },
  });

  if (!mapping) throw new ForbiddenError('You are not assigned to this service');
  if (!mapping.formula) {
    throw new UnprocessableError('No formula is assigned to this service mapping. Contact an administrator.');
  }

  // 2. Snapshot formula (immutable copy)
  const formulaSnapshot = await prisma.formulaSnapshot.create({
    data: {
      formulaId:  mapping.formula.id,
      expression: mapping.formula.expression,
      variables:  mapping.formula.variables as unknown as Prisma.InputJsonValue,
    },
  });

  const startDate = new Date(input.startDate);

  // 3. Check invoice number uniqueness (case-insensitive)
  const invoiceConflict = await prisma.project.findFirst({
    where: { invoiceNumber: { equals: input.invoiceNumber, mode: 'insensitive' } },
  });
  if (invoiceConflict) {
    throw new ConflictError('This invoice number is already in use. Please choose a different one.');
  }

  // 4. Create project + details in one transaction
  const project = await prisma.$transaction(async (tx: any) => {
    const newProject = await tx.project.create({
      data: {
        employeeId,
        serviceId:         input.serviceId,
        formulaSnapshotId: formulaSnapshot.id,
        status:            'DRAFT',
        projectName:       input.projectName,
        invoiceNumber:     input.invoiceNumber,
        startDate,
        calculatedAmount:  null, // Set by admin at approval time
      },
      include: PROJECT_INCLUDE,
    });

    // Store dynamic field values
    if (Object.keys(input.fieldValues).length > 0) {
      await tx.projectDetail.createMany({
        data: Object.entries(input.fieldValues).map(([fieldKey, fieldValue]) => ({
          projectId: newProject.id,
          fieldKey,
          fieldValue: String(fieldValue),
        })),
      });
    }

    return newProject;
  });

  await auditLog({
    userId: employeeId,
    action: CONSTANTS.AUDIT_ACTIONS.CREATE,
    entity: 'Project',
    entityId: project.id,
    newValue: {
      serviceId: input.serviceId,
      projectName: input.projectName,
      invoiceNumber: project.invoiceNumber,
      startDate: input.startDate,
    },
    ipAddress,
  });

  return applyProjectDto(project, 'EMPLOYEE');
};

// ─── List Projects ────────────────────────────────────────────────────────────

export interface ProjectFilters {
  status?:      string;
  employeeId?:  string;
  serviceId?:   string;
  paymentMode?: string;
  dateRange?:   string;
  startDate?:   string;
  endDate?:     string;
  page?:        number | string;
  limit?:       number | string;
}

export const listProjectsService = async (
  role: 'ADMIN' | 'EMPLOYEE',
  userId: string,
  filters: ProjectFilters = {}
) => {
  const where: Prisma.ProjectWhereInput = {};

  // Role-based scope
  if (role === 'EMPLOYEE') {
    where.employeeId = userId;
  } else if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  // Status filter
  if (filters.status) {
    where.status = filters.status as $Enums.ProjectStatus;
  }

  // Service filter
  if (filters.serviceId) {
    where.serviceId = filters.serviceId;
  }

  // Payment mode filter (admin only, but harmless for employees)
  if (filters.paymentMode) {
    where.paymentMode = filters.paymentMode as $Enums.PaymentMode;
  }

  // Date range filter
  const dateFilter = buildDateRangeFilter(filters.dateRange, filters.startDate, filters.endDate);
  if (dateFilter) {
    where.createdAt = dateFilter;
  }

  const { skip, take } = buildPaginationArgs(filters.page, filters.limit);

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: PROJECT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.project.count({ where }),
  ]);

  const dtos = applyProjectDtoList(projects, role);
  return buildPaginatedResponse(dtos, total, filters.page ?? 1, filters.limit ?? 20);
};

// ─── Get Project By ID ────────────────────────────────────────────────────────

export const getProjectByIdService = async (
  id: string,
  role: 'ADMIN' | 'EMPLOYEE',
  userId: string
) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: PROJECT_INCLUDE,
  });

  if (!project) throw new NotFoundError('Project');

  if (role === 'EMPLOYEE' && project.employeeId !== userId) {
    throw new ForbiddenError('Access denied');
  }

  return applyProjectDto(project, role);
};

// ─── Update Project (Employee edits DRAFT) ────────────────────────────────────

export const updateProjectService = async (
  id: string,
  input: UpdateProjectInput,
  employeeId: string,
  ipAddress: string
) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { formulaSnapshot: true },
  });

  if (!project) throw new NotFoundError('Project');
  if (project.employeeId !== employeeId) throw new ForbiddenError('Access denied');
  if (project.status !== 'DRAFT') {
    throw new UnprocessableError('Only DRAFT projects can be edited');
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    if (input.fieldValues) {
      await tx.projectDetail.deleteMany({ where: { projectId: id } });
      await tx.projectDetail.createMany({
        data: Object.entries(input.fieldValues).map(([fieldKey, fieldValue]) => ({
          projectId: id,
          fieldKey,
          fieldValue: String(fieldValue),
        })),
      });
    }

    return tx.project.update({
      where: { id },
      data: { notes: input.notes },
      include: PROJECT_INCLUDE,
    });
  });

  await auditLog({
    userId: employeeId,
    action: CONSTANTS.AUDIT_ACTIONS.UPDATE,
    entity: 'Project',
    entityId: id,
    oldValue: { notes: project.notes },
    newValue: { notes: input.notes },
    ipAddress,
  });

  return applyProjectDto(updated, 'EMPLOYEE');
};

// ─── Update Project Finish (Employee sets finishDate + completion image) ───────

export const updateProjectFinishService = async (
  id: string,
  input: UpdateProjectFinishInput,
  completionImageUrl: string | undefined,
  employeeId: string,
  ipAddress: string
) => {
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) throw new NotFoundError('Project');
  if (project.employeeId !== employeeId) throw new ForbiddenError('Access denied');
  if (project.status !== 'DRAFT') {
    throw new UnprocessableError('Only DRAFT projects can be edited. This project has already been submitted.');
  }

  const finishDate  = new Date(input.finishDate);
  const startDate   = project.startDate;

  if (finishDate < startDate) {
    throw new BadRequestError('Finish date cannot be before start date');
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      finishDate,
      ...(completionImageUrl ? { completionImageUrl } : {}),
    },
    include: PROJECT_INCLUDE,
  });

  await auditLog({
    userId: employeeId,
    action: CONSTANTS.AUDIT_ACTIONS.UPDATE,
    entity: 'Project',
    entityId: id,
    oldValue: { finishDate: project.finishDate?.toISOString() ?? null },
    newValue: { finishDate: finishDate.toISOString(), completionImageUrl: completionImageUrl ?? null },
    ipAddress,
  });

  return applyProjectDto(updated, 'EMPLOYEE');
};

// ─── Submit Project ───────────────────────────────────────────────────────────

export const submitProjectService = async (
  id: string,
  employeeId: string,
  ipAddress: string
) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundError('Project');
  if (project.employeeId !== employeeId) throw new ForbiddenError('Access denied');
  if (project.status !== 'DRAFT') {
    throw new UnprocessableError('Only DRAFT projects can be submitted');
  }

  // Submission gate — finishDate and completionImageUrl are both required
  if (!isProjectReadyForSubmission(project)) {
    throw new ProjectNotReadyError(
      'Project cannot be submitted until finish date and job card image have been provided.'
    );
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { status: 'SUBMITTED' },
    include: PROJECT_INCLUDE,
  });

  await auditLog({
    userId: employeeId,
    action: CONSTANTS.AUDIT_ACTIONS.STATUS_CHANGE,
    entity: 'Project',
    entityId: id,
    oldValue: { status: 'DRAFT' },
    newValue: { status: 'SUBMITTED', submittedAt: new Date().toISOString() },
    ipAddress,
  });

  return applyProjectDto(updated, 'EMPLOYEE');
};

// ─── Approve Project (Admin — dual-path calculation logic) ────────────────────

export const approveProjectService = async (
  id: string,
  input: ApproveProjectInput,
  adminId: string,
  ipAddress: string
) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { formulaSnapshot: true, employee: true },
  });

  if (!project) throw new NotFoundError('Project');
  if (project.status !== 'SUBMITTED') {
    throw new UnprocessableError('Only SUBMITTED projects can be approved');
  }

  const totalProjectPriceInt = Math.round(Number(input.totalProjectPrice));
  const makingCostInt        = Math.round(Number(input.makingCost));

  let calculatedAmount: number;
  let manualPayAmount: number | null = null;

  if (makingCostInt > 0) {
    // ── CASE A: makingCost > 0 → run formula engine ──────────────────────────
    const marginInt = totalProjectPriceInt - makingCostInt;

    // Build evaluation scope: formula variables + admin-provided financial vars
    const projectFieldValues: Record<string, string | number> = {};
    if (project.formulaSnapshot) {
      // Reload project details for field values
      const details = await prisma.projectDetail.findMany({ where: { projectId: id } });
      details.forEach((d: { fieldKey: string; fieldValue: string }) => { projectFieldValues[d.fieldKey] = d.fieldValue; });
    }

    // Build the base admin-provided financial values (keyed by their canonical names)
    const adminFinancials: Record<string, number> = {
      totalProjectPrice: totalProjectPriceInt,
      makingCost:        makingCostInt,
      margin:            marginInt,
    };

    if (!project.formulaSnapshot) {
      throw new UnprocessableError('Project has no formula snapshot. Cannot calculate.');
    }

    const variables = project.formulaSnapshot.variables as Array<{
      key: string; label: string; type: 'number' | 'string'; sourceField?: string;
    }>;

    console.debug('[approveProject] formula variables:', JSON.stringify(variables));
    console.debug('[approveProject] projectFieldValues keys:', Object.keys(projectFieldValues));

    // Start scope with canonical admin financial names + employee field values
    const formulaScope: Record<string, string | number> = { ...adminFinancials, ...projectFieldValues };

    const financialOrder: Array<keyof typeof adminFinancials> = ['totalProjectPrice', 'makingCost', 'margin'];
    let financialIdx = 0;

    for (const variable of variables) {
      if (formulaScope[variable.key] !== undefined) continue;
      if (variable.sourceField && adminFinancials[variable.sourceField] !== undefined) {
        formulaScope[variable.key] = adminFinancials[variable.sourceField];
        continue;
      }
      if (financialIdx < financialOrder.length) {
        formulaScope[variable.key] = adminFinancials[financialOrder[financialIdx]];
        financialIdx++;
      }
    }

    console.debug('[approveProject] formulaScope:', JSON.stringify(formulaScope));

    const evalResult = await evaluateFormula(
      project.formulaSnapshot.expression,
      variables,
      formulaScope,
      adminId
    );

    // evaluateFormula already returns Math.round() integer
    calculatedAmount = evalResult.result;
    manualPayAmount  = null;
  } else {
    // ── CASE B: makingCost = 0 → use manualPayAmount ─────────────────────────
    if (!input.manualPayAmount) {
      throw new BadRequestError('Manual pay amount is required when making cost is 0');
    }
    calculatedAmount = Math.round(Number(input.manualPayAmount));
    manualPayAmount  = calculatedAmount;
  }

  // Persist approval in one transaction
  const updated = await prisma.$transaction(async (tx: any) => {
    const approved = await tx.project.update({
      where: { id },
      data: {
        status:            'APPROVED',
        paymentMode:       input.paymentMode,
        totalProjectPrice: makingCostInt > 0 ? totalProjectPriceInt : 0,
        makingCost:        makingCostInt > 0 ? makingCostInt         : 0,
        manualPayAmount:   manualPayAmount,
        calculatedAmount:  calculatedAmount,
        approvalNotes:     input.approvalNotes ?? null,
        approvedById:      adminId,
        approvedAt:        new Date(),
      },
      include: PROJECT_INCLUDE,
    });

    // Create or update PENDING payment record with new partial-payment fields
    const existingPayment = await tx.payment.findFirst({ where: { projectId: id } });
    if (!existingPayment) {
      await tx.payment.create({
        data: {
          projectId:        id,
          employeeId:       approved.employeeId,
          calculatedAmount: calculatedAmount,
          totalPaid:        0,
          pendingAmount:    calculatedAmount,
          status:           'PENDING',
          paymentMode:      input.paymentMode,
        },
      });
    } else {
      await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          calculatedAmount: calculatedAmount,
          totalPaid:        0,
          pendingAmount:    calculatedAmount,
          paymentMode:      input.paymentMode,
          status:           'PENDING',
        },
      });
    }

    return approved;
  });

  await auditLog({
    userId: adminId,
    action: CONSTANTS.AUDIT_ACTIONS.STATUS_CHANGE,
    entity: 'Project',
    entityId: id,
    oldValue: { status: 'SUBMITTED' },
    newValue: {
      status:            'APPROVED',
      totalProjectPrice: totalProjectPriceInt,
      makingCost:        makingCostInt,
      paymentMode:       input.paymentMode,
      manualPayAmount:   manualPayAmount,
      calculatedAmount:  calculatedAmount,
    },
    ipAddress,
  });

  // Return admin DTO (with all financial fields)
  return {
    ...applyProjectDto(updated, 'ADMIN'),
    calculatedAmount,
  };
};

// ─── Update Project Status (Admin — REJECTED only) ────────────────────────────

export const updateProjectStatusService = async (
  id: string,
  input: UpdateProjectStatusInput,
  adminId: string,
  ipAddress: string
) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundError('Project');

  const validTransitions: Record<string, string[]> = {
    SUBMITTED: ['REJECTED'],
  };

  if (!validTransitions[project.status]?.includes(input.status)) {
    throw new UnprocessableError(
      `Cannot transition project from ${project.status} to ${input.status}`
    );
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { status: input.status, notes: input.notes },
    include: PROJECT_INCLUDE,
  });

  await auditLog({
    userId: adminId,
    action: CONSTANTS.AUDIT_ACTIONS.STATUS_CHANGE,
    entity: 'Project',
    entityId: id,
    oldValue: { status: project.status },
    newValue: { status: input.status, notes: input.notes },
    ipAddress,
  });

  return applyProjectDto(updated, 'ADMIN');
};

// ─── Delete Draft Project ─────────────────────────────────────────────────────

export const deleteProjectService = async (
  id: string,
  employeeId: string,
  ipAddress: string
): Promise<void> => {
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) throw new NotFoundError('Project');
  if (project.employeeId !== employeeId) throw new ForbiddenError('Access denied');
  if (project.status !== 'DRAFT') {
    throw new UnprocessableError('Only DRAFT projects can be deleted');
  }

  await prisma.$transaction([
    prisma.projectDetail.deleteMany({ where: { projectId: id } }),
    prisma.project.delete({ where: { id } }),
  ]);

  await auditLog({
    userId: employeeId,
    action: CONSTANTS.AUDIT_ACTIONS.DELETE,
    entity: 'Project',
    entityId: id,
    oldValue: { status: 'DRAFT', serviceId: project.serviceId, invoiceNumber: project.invoiceNumber },
    ipAddress,
  });
};

// ─── Check Invoice Number Availability ────────────────────────────────────────

export const checkInvoiceService = async (
  invoiceNumber: string
): Promise<{ available: boolean }> => {
  const existing = await prisma.project.findFirst({
    where: { invoiceNumber: { equals: invoiceNumber, mode: 'insensitive' } },
    select: { id: true },
  });
  return { available: !existing };
};
