import { z } from 'zod';

const mobileRegex = /^[6-9]\d{9}$/; // Indian mobile number format

export const createUserSchema = z.object({
  name:             z.string().min(2, 'Name must be at least 2 characters').max(100),
  fullName:         z.string().min(2, 'Full name must be at least 2 characters').max(150),
  email:            z.string().email('Invalid email address'),
  password:         z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role:             z.enum(['ADMIN', 'EMPLOYEE']).default('EMPLOYEE'),
  mobileNumber1:    z.string().regex(mobileRegex, 'Invalid mobile number (10 digits, starts with 6-9)'),
  mobileNumber2:    z.string().regex(mobileRegex, 'Invalid mobile number').optional(),
  address:          z.string().max(500).optional(),
  identityDocType:  z.enum(['AADHAR', 'PAN']).optional(),
  staticSalary:     z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid salary amount').optional(),
});

export const updateUserSchema = z.object({
  name:             z.string().min(2).max(100).optional(),
  fullName:         z.string().min(2).max(150).optional(),
  email:            z.string().email().optional(),
  password:         z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .optional(),
  isActive:         z.boolean().optional(),
  role:             z.enum(['ADMIN', 'EMPLOYEE']).optional(),
  mobileNumber1:    z.string().regex(mobileRegex, 'Invalid mobile number').optional(),
  mobileNumber2:    z.string().regex(mobileRegex, 'Invalid mobile number').optional().nullable(),
  address:          z.string().max(500).optional().nullable(),
  identityDocType:  z.enum(['AADHAR', 'PAN']).optional().nullable(),
  identityDocUrl:   z.string().optional().nullable(),
  staticSalary:     z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid salary amount').optional().nullable(),
  profilePictureUrl: z.string().optional().nullable(),
});

/**
 * Admin-only schema for PATCH /users/:id.
 * Only the 8 permitted editable fields — password/role/id/timestamps are excluded entirely.
 * Zod will strip any extra fields not listed here.
 */
export const adminEditProfileSchema = z.object({
  fullName:         z.string().min(2, 'Full name must be at least 2 characters').max(150),
  email:            z.string().email('Invalid email address'),
  mobileNumber1:    z.string().regex(mobileRegex, 'Invalid mobile number (10 digits, starts with 6-9)'),
  mobileNumber2:    z.string().regex(mobileRegex, 'Invalid mobile number').optional().nullable(),
  address:          z.string().max(500).optional().nullable(),
  identityDocType:  z.enum(['AADHAR', 'PAN']).optional().nullable(),
  staticSalary:     z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid salary amount').optional().nullable(),
  isActive:         z.boolean().optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().cuid('Invalid user ID'),
});

export type CreateUserInput      = z.infer<typeof createUserSchema>;
export type UpdateUserInput      = z.infer<typeof updateUserSchema>;
export type AdminEditProfileInput = z.infer<typeof adminEditProfileSchema>;
