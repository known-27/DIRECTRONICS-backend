import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import { z } from 'zod';
import {
  uploadProfilePicture,
  uploadIdentityDoc,
  uploadProjectImage,
} from './uploads.controller';
import {
  profilePictureUpload,
  identityDocUpload,
  projectImageUpload,
} from './upload.config';

const router = Router();
router.use(authenticateJWT);

// ─── Param validation schemas ─────────────────────────────────────────────────

const userIdParam    = z.object({ userId:    z.string().cuid('Invalid user ID') });
const projectIdParam = z.object({ projectId: z.string().cuid('Invalid project ID') });

// ─── Self-upload: authenticated user uploads their own profile picture ────────
router.post(
  '/profile-picture',
  profilePictureUpload.single('file'),
  uploadProfilePicture
);

// ─── Admin upload: admin uploads profile picture FOR a specific employee ──────
router.post(
  '/profile-picture/:userId',
  validateRequest(userIdParam, 'params'),
  profilePictureUpload.single('file'),
  uploadProfilePicture          // same handler — resolves target from param
);

// ─── Self-upload: authenticated user uploads their own identity doc ───────────
router.post(
  '/identity-doc',
  identityDocUpload.single('file'),
  uploadIdentityDoc
);

// ─── Admin upload: admin uploads identity doc FOR a specific employee ─────────
router.post(
  '/identity-doc/:userId',
  validateRequest(userIdParam, 'params'),
  identityDocUpload.single('file'),
  uploadIdentityDoc             // same handler — resolves target from param
);

// ─── Project image (employee or admin) ───────────────────────────────────────
router.post(
  '/project-image/:projectId',
  validateRequest(projectIdParam, 'params'),
  projectImageUpload.single('file'),
  uploadProjectImage
);

export default router;
