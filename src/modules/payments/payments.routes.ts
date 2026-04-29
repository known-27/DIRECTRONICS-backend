import { Router } from 'express';
import {
  listPayments,
  listTransactions,
  addTransaction,
  reverseTransaction,
} from './payments.controller';
import { authenticateJWT } from '../../middleware/auth';
import { authorizeRole } from '../../middleware/role';

const router = Router();
router.use(authenticateJWT, authorizeRole('ADMIN'));

// List all payments (with pagination + filters)
router.get('/', listPayments);

// Transaction sub-resource
router.get('/:paymentId/transactions',                    listTransactions);
router.post('/:paymentId/transactions',                   addTransaction);
router.delete('/:paymentId/transactions/:transactionId',  reverseTransaction);

export default router;
