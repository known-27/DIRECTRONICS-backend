import prisma from '../../config/db';
import logger from '../../utils/logger';

interface AuditLogParams {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string;
}

/**
 * Creates an immutable audit log entry.
 * Never throws — audit failure should not break the main operation.
 */
export const auditLog = async (params: AuditLogParams): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        oldValue: params.oldValue ? (params.oldValue as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
        newValue: params.newValue ? (params.newValue as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Log but never throw — audit failure is non-blocking
    logger.error('Failed to write audit log', { err, params });
  }
};
