import { Router } from 'express';
import { getAdminDashboard, getEmployeeDashboard } from './dashboard.controller';
import { authenticateJWT } from '../../middleware/auth';
import { authorizeRole } from '../../middleware/role';

const router = Router();
router.use(authenticateJWT);

router.get('/admin', authorizeRole('ADMIN'), getAdminDashboard);
router.get('/employee', authorizeRole('EMPLOYEE'), getEmployeeDashboard);

export default router;
