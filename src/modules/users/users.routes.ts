import { Router } from 'express';
import {
  listUsers,
  createUser,
  getUserById,
  getUserProfile,
  adminEditProfile,
  deleteUser,
} from './users.controller';
import { authenticateJWT } from '../../middleware/auth';
import { authorizeRole } from '../../middleware/role';
import { validateRequest } from '../../middleware/validate';
import { createUserSchema, adminEditProfileSchema, userIdParamSchema } from './users.schema';

const router = Router();

router.use(authenticateJWT, authorizeRole('ADMIN'));

router.get('/', listUsers);
router.post('/', validateRequest(createUserSchema), createUser);
router.get('/:id', validateRequest(userIdParamSchema, 'params'), getUserById);
router.get('/:id/profile', validateRequest(userIdParamSchema, 'params'), getUserProfile);
router.patch('/:id', validateRequest(userIdParamSchema, 'params'), validateRequest(adminEditProfileSchema), adminEditProfile);
router.delete('/:id', validateRequest(userIdParamSchema, 'params'), deleteUser);

export default router;
