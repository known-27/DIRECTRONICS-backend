import { Request, Response } from 'express';
import prisma from '../../config/db';
import { tryCatch } from '../../utils/tryCatch';
import { sendSuccess } from '../../utils/response';
import { AuthError, ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors';

// ─── Helper: get authenticated user ──────────────────────────────────────────

function requireUser(req: Request): { id: string; role: 'ADMIN' | 'EMPLOYEE' } {
  if (!req.user) throw new AuthError('Not authenticated');
  return { id: req.user.sub, role: req.user.role };
}

/**
 * Resolve the target user ID for an upload.
 */
function resolveTargetUserId(req: Request): { targetUserId: string; role: 'ADMIN' | 'EMPLOYEE' } {
  const { id: callerId, role } = requireUser(req);
  const paramUserId = (req.params as Record<string, string>).userId;

  if (paramUserId) {
    if (role !== 'ADMIN') {
      throw new ForbiddenError('Only admins can upload files for other users');
    }
    return { targetUserId: paramUserId, role };
  }

  return { targetUserId: callerId, role };
}

// ─── POST /uploads/profile-picture          (self-upload)
// ─── POST /uploads/profile-picture/:userId  (admin uploads for employee)
// ─────────────────────────────────────────────────────────────────────────────

export const uploadProfilePicture = tryCatch(async (req: Request, res: Response) => {
  const { targetUserId } = resolveTargetUserId(req);

  if (!req.file) throw new BadRequestError('No file uploaded');

  // Ensure the target user exists
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new NotFoundError('User');

  // Cloudinary sets the absolute URL in req.file.path
  const cloudinaryUrl = req.file.path;

  await prisma.user.update({
    where: { id: targetUserId },
    data: { profilePictureUrl: cloudinaryUrl },
  });

  sendSuccess(res, { profilePictureUrl: cloudinaryUrl }, 'Profile picture updated');
});

// ─── POST /uploads/identity-doc          (self-upload)
// ─── POST /uploads/identity-doc/:userId  (admin uploads for employee)
// ─────────────────────────────────────────────────────────────────────────────

export const uploadIdentityDoc = tryCatch(async (req: Request, res: Response) => {
  const { targetUserId } = resolveTargetUserId(req);

  if (!req.file) throw new BadRequestError('No file uploaded');

  // Ensure the target user exists
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new NotFoundError('User');

  const cloudinaryUrl = req.file.path;

  await prisma.user.update({
    where: { id: targetUserId },
    data: { identityDocUrl: cloudinaryUrl },
  });

  sendSuccess(res, { identityDocUrl: cloudinaryUrl }, 'Identity document uploaded');
});

// ─── POST /uploads/project-image/:projectId ──────────────────────────────────

export const uploadProjectImage = tryCatch(async (req: Request, res: Response) => {
  const { id: userId, role } = requireUser(req);
  const { projectId } = req.params as { projectId: string };

  if (!req.file) throw new BadRequestError('No file uploaded');

  // Verify the project exists and belongs to this employee (or admin)
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project');

  if (role === 'EMPLOYEE' && project.employeeId !== userId) {
    throw new ForbiddenError('You do not have access to this project');
  }

  const cloudinaryUrl = req.file.path;

  await prisma.project.update({
    where: { id: projectId },
    data: { completionImageUrl: cloudinaryUrl },
  });

  sendSuccess(res, { completionImageUrl: cloudinaryUrl }, 'Project image uploaded');
});
