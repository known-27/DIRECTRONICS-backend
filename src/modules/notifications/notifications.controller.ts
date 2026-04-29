import { Request, Response } from 'express';
import { tryCatch } from '../../utils/tryCatch';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/db';

/**
 * GET /notifications/counts  (ADMIN only)
 *
 * Returns live counts for admin notification badges.
 * Intentionally minimal — only counts, never project data.
 * No caching — always fresh from DB.
 */
export const getNotificationCounts = tryCatch(async (_req: Request, res: Response): Promise<void> => {
  const pendingReviewCount = await prisma.project.count({
    where: { status: 'SUBMITTED' },
  });

  sendSuccess(res, { pendingReviewCount }, 'Notification counts retrieved');
});
