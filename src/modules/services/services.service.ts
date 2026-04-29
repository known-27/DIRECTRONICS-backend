import prisma from '../../config/db';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { auditLog } from '../audit/auditLog';
import { CONSTANTS } from '../../config/constants';
import type { CreateServiceInput, UpdateServiceInput, CreateMappingInput } from './services.schema';
import { Prisma } from '@prisma/client';

// ─── Services ─────────────────────────────────────────────────────────────────

export const listServicesService = async (includeInactive = false) => {
  return prisma.service.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      _count: { select: { employeeServiceMapping: true, projects: true } },
      formulas: {
        where: { isActive: true },
        select: { id: true, name: true, version: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const createServiceService = async (
  input: CreateServiceInput,
  actorId: string,
  ipAddress: string
) => {
  const existing = await prisma.service.findUnique({ where: { name: input.name } });
  if (existing) throw new ConflictError('A service with this name already exists');

  const service = await prisma.service.create({
    data: {
      name:          input.name,
      description:   input.description,
      invoicePrefix: input.invoicePrefix ?? null,
      fields:        input.fields as Prisma.InputJsonValue,
    },
  });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.CREATE,
    entity: 'Service',
    entityId: service.id,
    newValue: { name: service.name },
    ipAddress,
  });

  return service;
};

export const getServiceByIdService = async (id: string) => {
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      formulas: { where: { isActive: true } },
      employeeServiceMapping: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          formula: { select: { id: true, name: true } },
        },
      },
      _count: { select: { projects: true } },
    },
  });

  if (!service) throw new NotFoundError('Service');
  return service;
};

export const updateServiceService = async (
  id: string,
  input: UpdateServiceInput,
  actorId: string,
  ipAddress: string
) => {
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Service');

  const updateData: Prisma.ServiceUpdateInput = {};
  if (input.name)                              updateData.name          = input.name;
  if (input.description !== undefined)         updateData.description   = input.description;
  if (input.fields)                            updateData.fields        = input.fields as Prisma.InputJsonValue;
  if (typeof input.isActive === 'boolean')     updateData.isActive      = input.isActive;
  if ('invoicePrefix' in input)                updateData.invoicePrefix = input.invoicePrefix ?? null;

  const updated = await prisma.service.update({ where: { id }, data: updateData });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.UPDATE,
    entity: 'Service',
    entityId: id,
    oldValue: { name: existing.name, isActive: existing.isActive },
    newValue: { name: updated.name, isActive: updated.isActive },
    ipAddress,
  });

  return updated;
};

export const deleteServiceService = async (
  id: string,
  actorId: string,
  ipAddress: string
) => {
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Service');

  await prisma.service.update({ where: { id }, data: { isActive: false } });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.DELETE,
    entity: 'Service',
    entityId: id,
    oldValue: { isActive: true },
    newValue: { isActive: false },
    ipAddress,
  });
};

// ─── Mappings ─────────────────────────────────────────────────────────────────

export const createMappingService = async (
  input: CreateMappingInput,
  actorId: string,
  ipAddress: string
) => {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new NotFoundError('User');

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service) throw new NotFoundError('Service');

  const existing = await prisma.employeeServiceMapping.findUnique({
    where: { userId_serviceId: { userId: input.userId, serviceId: input.serviceId } },
  });
  if (existing) throw new ConflictError('This employee is already assigned to this service');

  const mapping = await prisma.employeeServiceMapping.create({
    data: {
      userId: input.userId,
      serviceId: input.serviceId,
      formulaId: input.formulaId,
    },
    include: {
      user: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
      formula: { select: { id: true, name: true } },
    },
  });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.CREATE,
    entity: 'EmployeeServiceMapping',
    entityId: mapping.id,
    newValue: { userId: input.userId, serviceId: input.serviceId },
    ipAddress,
  });

  return mapping;
};

export const deleteMappingService = async (
  id: string,
  actorId: string,
  ipAddress: string
) => {
  const mapping = await prisma.employeeServiceMapping.findUnique({ where: { id } });
  if (!mapping) throw new NotFoundError('Mapping');

  await prisma.employeeServiceMapping.delete({ where: { id } });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.DELETE,
    entity: 'EmployeeServiceMapping',
    entityId: id,
    oldValue: { userId: mapping.userId, serviceId: mapping.serviceId },
    ipAddress,
  });
};
