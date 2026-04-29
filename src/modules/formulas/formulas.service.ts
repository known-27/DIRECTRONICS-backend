import prisma from '../../config/db';
import { NotFoundError } from '../../utils/errors';
import { auditLog } from '../audit/auditLog';
import { CONSTANTS } from '../../config/constants';
import { evaluateFormula } from './formula.evaluator';
import type { CreateFormulaInput, UpdateFormulaInput, TestFormulaInput } from './formulas.schema';
import { Prisma } from '@prisma/client';

export const listFormulasService = async (serviceId?: string) => {
  return prisma.formula.findMany({
    where: serviceId ? { serviceId } : {},
    include: {
      service: { select: { id: true, name: true } },
      _count: { select: { snapshots: true } },
    },
    orderBy: [{ serviceId: 'asc' }, { version: 'desc' }],
  });
};

export const createFormulaService = async (
  input: CreateFormulaInput,
  actorId: string,
  ipAddress: string
) => {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service) throw new NotFoundError('Service');

  // Validate expression compiles with dummy values
  const dummyValues: Record<string, number> = {};
  for (const v of input.variables) {
    dummyValues[v.key] = 1;
  }
  await evaluateFormula(input.expression, input.variables as Array<{ key: string; label: string; type: 'number' | 'string'; sourceField?: string }>, dummyValues, actorId);

  const formula = await prisma.formula.create({
    data: {
      name: input.name,
      serviceId: input.serviceId,
      expression: input.expression,
      variables: input.variables as Prisma.InputJsonValue,
      version: 1,
    },
    include: { service: { select: { id: true, name: true } } },
  });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.CREATE,
    entity: 'Formula',
    entityId: formula.id,
    newValue: { name: formula.name, expression: formula.expression, version: formula.version },
    ipAddress,
  });

  return formula;
};

export const getFormulaByIdService = async (id: string) => {
  const formula = await prisma.formula.findUnique({
    where: { id },
    include: {
      service: { select: { id: true, name: true } },
      snapshots: {
        orderBy: { snapshotAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!formula) throw new NotFoundError('Formula');
  return formula;
};

export const updateFormulaService = async (
  id: string,
  input: UpdateFormulaInput,
  actorId: string,
  ipAddress: string
) => {
  const existing = await prisma.formula.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Formula');

  const newExpression = input.expression ?? existing.expression;
  const newVariables = (input.variables ?? existing.variables) as Array<{ key: string; label: string; type: 'number' | 'string'; sourceField?: string }>;

  // Validate new expression
  if (input.expression || input.variables) {
    const dummyValues: Record<string, number> = {};
    for (const v of newVariables) dummyValues[v.key] = 1;
    await evaluateFormula(newExpression, newVariables, dummyValues, actorId);
  }

  // Create new version of formula, deactivate old one
  const newVersion = await prisma.$transaction(async (tx) => {
    // Deactivate old if expression changed
    if (input.expression || input.variables) {
      await tx.formula.update({ where: { id }, data: { isActive: false } });

      return tx.formula.create({
        data: {
          name: input.name ?? existing.name,
          serviceId: existing.serviceId,
          expression: newExpression,
          variables: newVariables as Prisma.InputJsonValue,
          version: existing.version + 1,
          isActive: true,
        },
      });
    }

    // Just update metadata (name, isActive)
    return tx.formula.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        isActive: input.isActive ?? existing.isActive,
      },
    });
  });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.UPDATE,
    entity: 'Formula',
    entityId: id,
    oldValue: { expression: existing.expression, version: existing.version },
    newValue: { expression: newVersion.expression, version: newVersion.version },
    ipAddress,
  });

  return newVersion;
};

export const testFormulaService = async (
  id: string,
  input: TestFormulaInput,
  actorId: string
) => {
  const formula = await prisma.formula.findUnique({ where: { id } });
  if (!formula) throw new NotFoundError('Formula');

  const variables = formula.variables as Array<{ key: string; label: string; type: 'number' | 'string'; sourceField?: string }>;

  return evaluateFormula(formula.expression, variables, input.values, actorId);
};
