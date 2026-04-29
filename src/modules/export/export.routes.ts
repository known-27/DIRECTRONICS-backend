import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { exportProjectsPdf, exportPaymentsPdf } from './export.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/projects/pdf', exportProjectsPdf);
router.get('/payments/pdf', exportPaymentsPdf);

export default router;
