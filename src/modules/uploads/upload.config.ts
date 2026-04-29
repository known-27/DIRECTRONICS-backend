import multer, { FileFilterCallback } from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { Request } from 'express';
import { env } from '../../config/env';

// ─── Cloudinary Config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

// ─── Upload categories ────────────────────────────────────────────────────────

export type UploadCategory = 'identity-docs' | 'profile-pictures' | 'project-images';

// ─── Allowed MIME types per category ─────────────────────────────────────────

export const ALLOWED_MIMES: Record<UploadCategory, string[]> = {
  'identity-docs':    ['image/jpeg', 'image/png', 'application/pdf'],
  'profile-pictures': ['image/jpeg', 'image/png', 'image/webp'],
  'project-images':  ['image/jpeg', 'image/png', 'image/webp'],
};

// ─── File size limits (bytes) ─────────────────────────────────────────────────

export const FILE_SIZE_LIMITS: Record<UploadCategory, number> = {
  'identity-docs':    5  * 1024 * 1024,   // 5 MB
  'profile-pictures': 2  * 1024 * 1024,   // 2 MB
  'project-images':  10 * 1024 * 1024,   // 10 MB
};

// ─── Storage factory (Cloudinary) ─────────────────────────────────────────────

function createStorage(category: UploadCategory) {
  return new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => {
      // Cloudinary format/folder logic
      const ext = file.mimetype.split('/')[1];
      const isRaw = file.mimetype === 'application/pdf';
      
      return {
        folder: `service-erp/${category}`,
        resource_type: isRaw ? 'raw' : 'image', // PDF needs 'raw' or 'image' if you want it converted, usually 'image' allows PDF upload in cloudinary if configured but 'auto' is best.
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'pdf'],
        format: isRaw ? undefined : (ext === 'jpeg' ? 'jpg' : ext), // Auto-format images
      } as any;
    },
  });
}

// ─── File filter factory ──────────────────────────────────────────────────────

function createFilter(category: UploadCategory) {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ): void => {
    if (ALLOWED_MIMES[category].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: ${ALLOWED_MIMES[category].join(', ')}`));
    }
  };
}

// ─── Pre-built multer instances ───────────────────────────────────────────────

export const profilePictureUpload = multer({
  storage: createStorage('profile-pictures'),
  limits:  { fileSize: FILE_SIZE_LIMITS['profile-pictures'] },
  fileFilter: createFilter('profile-pictures'),
});

export const identityDocUpload = multer({
  storage: createStorage('identity-docs'),
  limits:  { fileSize: FILE_SIZE_LIMITS['identity-docs'] },
  fileFilter: createFilter('identity-docs'),
});

export const projectImageUpload = multer({
  storage: createStorage('project-images'),
  limits:  { fileSize: FILE_SIZE_LIMITS['project-images'] },
  fileFilter: createFilter('project-images'),
});
