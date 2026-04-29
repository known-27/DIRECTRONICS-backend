import { Request, Response } from 'express';
import { tryCatch } from '../../utils/tryCatch';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  listUsersService,
  createUserService,
  getUserByIdService,
  getUserProfileService,
  updateUserService,
  adminEditProfileService,
  deleteUserService,
} from './users.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';

export const listUsers = tryCatch(async (_req: Request, res: Response): Promise<void> => {
  const users = await listUsersService();
  sendSuccess(res, users, 'Users retrieved');
});

export const createUser = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const user = await createUserService(req.body, req.user!.sub, getIp(req));
  sendCreated(res, user, 'User created successfully');
});

export const getUserById = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const user = await getUserByIdService(req.params.id);
  sendSuccess(res, user, 'User retrieved');
});

export const getUserProfile = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const profile = await getUserProfileService(req.params.id);
  sendSuccess(res, profile, 'Employee profile retrieved');
});

export const updateUser = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const user = await updateUserService(req.params.id, req.body, req.user!.sub, getIp(req));
  sendSuccess(res, user, 'User updated');
});

export const adminEditProfile = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const user = await adminEditProfileService(req.params.id, req.body, req.user!.sub, getIp(req));
  sendSuccess(res, user, 'Employee profile updated successfully');
});

export const deleteUser = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const result = await deleteUserService(req.params.id, req.user!.sub, getIp(req));
  sendSuccess(res, {}, result.message);
});
