import { Router } from 'express';
import {
  createProject, listProjects, getProjectById,
  updateProject, updateProjectFinish, submitProject,
  approveProject, updateProjectStatus, deleteProject,
  checkInvoice,
} from './projects.controller';
import { authenticateJWT } from '../../middleware/auth';
import { authorizeRole } from '../../middleware/role';
import { validateRequest } from '../../middleware/validate';
import {
  createProjectSchema, updateProjectSchema, updateProjectFinishSchema,
  approveProjectSchema, updateProjectStatusSchema, projectIdParamSchema,
  checkInvoiceSchema,
} from './projects.schema';

const router = Router();
router.use(authenticateJWT);

// ── Check invoice availability (MUST be before /:id to avoid route conflict) ──
router.get('/check-invoice', validateRequest(checkInvoiceSchema, 'query'), checkInvoice);

// Employee routes
router.post('/', authorizeRole('EMPLOYEE'), validateRequest(createProjectSchema), createProject);
router.patch('/:id', authorizeRole('EMPLOYEE'), validateRequest(projectIdParamSchema, 'params'), validateRequest(updateProjectSchema), updateProject);
router.patch('/:id/update', authorizeRole('EMPLOYEE'), validateRequest(projectIdParamSchema, 'params'), validateRequest(updateProjectFinishSchema), updateProjectFinish);
router.post('/:id/submit', authorizeRole('EMPLOYEE'), validateRequest(projectIdParamSchema, 'params'), submitProject);
router.delete('/:id', authorizeRole('EMPLOYEE'), validateRequest(projectIdParamSchema, 'params'), deleteProject);

// Admin routes
router.patch('/:id/approve', authorizeRole('ADMIN'), validateRequest(projectIdParamSchema, 'params'), validateRequest(approveProjectSchema), approveProject);
router.patch('/:id/status', authorizeRole('ADMIN'), validateRequest(projectIdParamSchema, 'params'), validateRequest(updateProjectStatusSchema), updateProjectStatus);

// Shared routes (role enforced in service)
router.get('/', listProjects);
router.get('/:id', validateRequest(projectIdParamSchema, 'params'), getProjectById);

export default router;
