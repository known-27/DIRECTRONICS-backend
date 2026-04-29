import bcrypt from 'bcrypt';
// Decimal import removed — staticSalary is now Int
import prisma from '../../config/db';
import { env } from '../../config/env';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { auditLog } from '../audit/auditLog';
import { CONSTANTS } from '../../config/constants';
import type { CreateUserInput, UpdateUserInput, AdminEditProfileInput } from './users.schema';
import { Prisma } from '@prisma/client';

// ─── List Users ───────────────────────────────────────────────────────────────

export const listUsersService = async () => {
  return prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      mobileNumber1: true,
      profilePictureUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { projects: true, payments: true } },
      employeeServiceMapping: {
        include: { service: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

// ─── Create User ──────────────────────────────────────────────────────────────

export const createUserService = async (
  input: CreateUserInput,
  actorId: string,
  ipAddress: string
) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('A user with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name:          input.name,
      fullName:      input.fullName,
      email:         input.email,
      passwordHash,
      role:          input.role,
      mobileNumber1: input.mobileNumber1,
      mobileNumber2: input.mobileNumber2 ?? null,
      address:       input.address ?? null,
      identityDocType: input.identityDocType ?? null,
      staticSalary:  input.staticSalary != null ? Math.round(Number(input.staticSalary)) : null,
    },
    select: {
      id: true, name: true, fullName: true, email: true, role: true,
      isActive: true, mobileNumber1: true, createdAt: true, updatedAt: true,
    },
  });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.CREATE,
    entity: 'User',
    entityId: user.id,
    newValue: { name: user.name, email: user.email, role: user.role },
    ipAddress,
  });

  return user;
};

// ─── Get User By ID ───────────────────────────────────────────────────────────

export const getUserByIdService = async (id: string) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      mobileNumber1: true,
      mobileNumber2: true,
      address: true,
      identityDocType: true,
      identityDocUrl: true,
      staticSalary: true,
      profilePictureUrl: true,
      createdAt: true,
      updatedAt: true,
      employeeServiceMapping: {
        include: {
          service: { select: { id: true, name: true, description: true } },
          formula: { select: { id: true, name: true, expression: true } },
        },
      },
      payments: {
        where: { status: 'PAID' },
        select: { totalPaid: true, paidAt: true, paymentMode: true },
        orderBy: { paidAt: 'desc' },
        take: 10,
      },
      _count: { select: { projects: true } },
    },
  });

  if (!user) throw new NotFoundError('User');

  const totalEarnedAgg = await prisma.payment.aggregate({
    where: { employeeId: id },
    _sum: { totalPaid: true },
  });

  return { ...user, totalEarned: totalEarnedAgg._sum.totalPaid ?? 0 };
};

// ─── Get Full Employee Profile (Admin only) ───────────────────────────────────

export const getUserProfileService = async (id: string) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      deletedAt: true,
      mobileNumber1: true,
      mobileNumber2: true,
      address: true,
      identityDocType: true,
      identityDocUrl: true,
      staticSalary: true,
      profilePictureUrl: true,
      createdAt: true,
      updatedAt: true,
      employeeServiceMapping: {
        include: {
          service: { select: { id: true, name: true, description: true } },
          formula: { select: { id: true, name: true, expression: true } },
        },
      },
      projects: {
        select: {
          id: true, invoiceNumber: true, projectName: true, status: true,
          calculatedAmount: true, paymentMode: true, startDate: true,
          service: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      payments: {
        where: { status: 'PAID' },
        select: {
          id: true, totalPaid: true, paidAt: true, paymentMode: true,
          project: {
            select: {
              id: true, invoiceNumber: true, projectName: true,
              service: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
      },
      _count: { select: { projects: true } },
    },
  });

  if (!user) throw new NotFoundError('User');

  const paymentAgg = await prisma.payment.aggregate({
    where: { employeeId: id },
    _sum: {
      totalPaid:        true,
      pendingAmount:    true,
    },
  });

  return {
    ...user,
    totalEarned:   paymentAgg._sum.totalPaid     ?? 0,
    pendingAmount: paymentAgg._sum.pendingAmount  ?? 0,
  };
};

// ─── Update User (internal / legacy) ─────────────────────────────────────────

export const updateUserService = async (
  id: string,
  input: UpdateUserInput,
  actorId: string,
  ipAddress: string
) => {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('User');

  if (input.email && input.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) throw new ConflictError('Email already in use');
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (input.name)                         updateData.name             = input.name;
  if (input.fullName)                     updateData.fullName         = input.fullName;
  if (input.email)                        updateData.email            = input.email;
  if (input.role)                         updateData.role             = input.role;
  if (typeof input.isActive === 'boolean') updateData.isActive        = input.isActive;
  if (input.mobileNumber1)               updateData.mobileNumber1    = input.mobileNumber1;
  if ('mobileNumber2' in input)          updateData.mobileNumber2    = input.mobileNumber2 ?? null;
  if ('address' in input)                updateData.address           = input.address ?? null;
  if ('identityDocType' in input)        updateData.identityDocType   = input.identityDocType ?? null;
  if ('identityDocUrl' in input)         updateData.identityDocUrl    = input.identityDocUrl ?? null;
  if ('staticSalary' in input)           updateData.staticSalary      = input.staticSalary != null ? Math.round(Number(input.staticSalary)) : null;
  if ('profilePictureUrl' in input)      updateData.profilePictureUrl = input.profilePictureUrl ?? null;
  if (input.password) {
    updateData.passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, fullName: true, email: true, role: true,
      isActive: true, mobileNumber1: true, mobileNumber2: true, address: true,
      identityDocType: true, identityDocUrl: true, staticSalary: true,
      profilePictureUrl: true, createdAt: true, updatedAt: true,
    },
  });

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.UPDATE,
    entity: 'User',
    entityId: id,
    oldValue: { name: existing.name, email: existing.email, role: existing.role, isActive: existing.isActive },
    newValue: { name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive },
    ipAddress,
  });

  return updated;
};

// ─── Admin Edit Employee Profile ──────────────────────────────────────────────
// Restricted to the 8 editable fields. Password/role/id/timestamps are never touched.

export const adminEditProfileService = async (
  id: string,
  input: AdminEditProfileInput,
  actorId: string,
  ipAddress: string
) => {
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('User');

  // Email uniqueness check (skip if unchanged)
  if (input.email !== existing.email) {
    const emailTaken = await prisma.user.findFirst({
      where: { email: input.email, id: { not: id } },
    });
    if (emailTaken) throw new ConflictError('Email already in use');
  }

  const updateData: Prisma.UserUpdateInput = {
    fullName:      input.fullName,
    email:         input.email,
    mobileNumber1: input.mobileNumber1,
    mobileNumber2: input.mobileNumber2 ?? null,
    address:       input.address ?? null,
    identityDocType: input.identityDocType ?? null,
    staticSalary:  'staticSalary' in input && input.staticSalary != null
      ? Math.round(Number(input.staticSalary))
      : input.staticSalary === null ? null : existing.staticSalary,
  };

  if (typeof input.isActive === 'boolean') {
    updateData.isActive = input.isActive;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, fullName: true, email: true, role: true,
      isActive: true, mobileNumber1: true, mobileNumber2: true, address: true,
      identityDocType: true, identityDocUrl: true, staticSalary: true,
      profilePictureUrl: true, createdAt: true, updatedAt: true,
    },
  });

  // Detailed audit log — capture all 8 editable fields before & after
  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.UPDATE,
    entity: 'User',
    entityId: id,
    oldValue: {
      fullName:       existing.fullName,
      email:          existing.email,
      mobileNumber1:  existing.mobileNumber1,
      mobileNumber2:  existing.mobileNumber2,
      address:        existing.address,
      identityDocType: existing.identityDocType,
      staticSalary:   existing.staticSalary?.toString() ?? null,
      isActive:       existing.isActive,
    },
    newValue: {
      fullName:       updated.fullName,
      email:          updated.email,
      mobileNumber1:  updated.mobileNumber1,
      mobileNumber2:  updated.mobileNumber2,
      address:        updated.address,
      identityDocType: updated.identityDocType,
      staticSalary:   updated.staticSalary?.toString() ?? null,
      isActive:       updated.isActive,
    },
    ipAddress,
  });

  return updated;
};

// ─── Delete User (Soft Delete with guards) ────────────────────────────────────

export const deleteUserService = async (
  id: string,
  actorId: string,
  ipAddress: string
): Promise<{ message: string }> => {
  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError('User');

  // Guard 1: cannot delete yourself
  if (actorId === id) {
    throw new ForbiddenError('You cannot delete your own account.');
  }

  // Guard 2: cannot delete the last active admin
  if (existing.role === 'ADMIN') {
    const activeAdminCount = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true, deletedAt: null },
    });
    if (activeAdminCount <= 1) {
      throw new ForbiddenError('Cannot delete the last admin account.');
    }
  }

  const anonymizedEmail = `${existing.email}__deleted_${Math.floor(Date.now() / 1000)}`;
  const now = new Date();

  // Transaction: soft-delete user + invalidate all refresh tokens
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        isActive:  false,
        deletedAt: now,
        email:     anonymizedEmail,
      },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: id } }),
  ]);

  await auditLog({
    userId: actorId,
    action: CONSTANTS.AUDIT_ACTIONS.DELETE,
    entity: 'User',
    entityId: id,
    oldValue: {
      name:  existing.name,
      email: existing.email,
      role:  existing.role,
      isActive: existing.isActive,
    },
    newValue: {
      isActive:  false,
      deletedAt: now.toISOString(),
      email:     anonymizedEmail,
      reason:    'soft-delete',
    },
    ipAddress,
  });

  return { message: 'Employee profile deleted.' };
};
