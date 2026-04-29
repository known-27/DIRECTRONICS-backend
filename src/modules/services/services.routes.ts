import { Router } from 'express';
import {
  listServices, createService, getServiceById, updateService, deleteService,
  createMapping, deleteMapping,
} from './services.controller';
import { authenticateJWT } from '../../middleware/auth';
import { authorizeRole } from '../../middleware/role';
import { validateRequest } from '../../middleware/validate';
import {
  createServiceSchema, updateServiceSchema, serviceIdParamSchema, createMappingSchema,
} from './services.schema';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Service CRUD
router.get('/', listServices);
router.post('/', authorizeRole('ADMIN'), validateRequest(createServiceSchema), createService);
router.get('/:id', validateRequest(serviceIdParamSchema, 'params'), getServiceById);
router.patch('/:id', authorizeRole('ADMIN'), validateRequest(serviceIdParamSchema, 'params'), validateRequest(updateServiceSchema), updateService);
router.delete('/:id', authorizeRole('ADMIN'), validateRequest(serviceIdParamSchema, 'params'), deleteService);

// Mapping routes
router.post('/mappings', authorizeRole('ADMIN'), validateRequest(createMappingSchema), createMapping);
router.delete('/mappings/:id', authorizeRole('ADMIN'), deleteMapping);

export default router;
