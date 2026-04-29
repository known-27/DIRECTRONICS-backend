import { Router } from 'express';
import { getNotificationCounts } from './notifications.controller';
import { authenticateJWT } from '../../middleware/auth';
import { authorizeRole } from '../../middleware/role';

const router = Router();
router.use(authenticateJWT);

// ADMIN only — lightweight polling endpoint for badge counts
router.get('/counts', authorizeRole('ADMIN'), getNotificationCounts);

export default router;
