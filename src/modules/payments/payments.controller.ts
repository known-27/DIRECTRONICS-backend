import type { Request, Response, NextFunction } from 'express';
import {
  listPaymentsService,
  getTransactionsService,
  addTransactionService,
  reverseTransactionService,
} from './payments.service';
import {
  paymentFilterSchema,
  paymentIdParamSchema,
  transactionIdParamSchema,
  createTransactionSchema,
} from './payments.schema';

// ─── List Payments ────────────────────────────────────────────────────────────

export const listPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = paymentFilterSchema.parse(req.query);
    const result  = await listPaymentsService(filters);
    res.json({ success: true, message: 'Payments retrieved', data: result });
  } catch (err) {
    next(err);
  }
};

// ─── List Transactions for a Payment ─────────────────────────────────────────

export const listTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { paymentId } = paymentIdParamSchema.parse(req.params);
    const transactions  = await getTransactionsService(paymentId);
    res.json({ success: true, message: 'Transactions retrieved', data: transactions });
  } catch (err) {
    next(err);
  }
};

// ─── Add Transaction (partial payment) ───────────────────────────────────────

export const addTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { paymentId } = paymentIdParamSchema.parse(req.params);
    const input         = createTransactionSchema.parse(req.body);
    const adminId       = req.user!.sub;
    const ipAddress     = req.ip ?? 'unknown';

    const result = await addTransactionService(paymentId, input, adminId, ipAddress);
    res.status(201).json({ success: true, message: 'Payment transaction recorded', data: result });
  } catch (err) {
    next(err);
  }
};

// ─── Reverse Transaction ──────────────────────────────────────────────────────

export const reverseTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { paymentId, transactionId } = transactionIdParamSchema.parse(req.params);
    const adminId   = req.user!.sub;
    const ipAddress = req.ip ?? 'unknown';

    const result = await reverseTransactionService(paymentId, transactionId, adminId, ipAddress);
    res.json({ success: true, message: 'Transaction reversed successfully', data: result });
  } catch (err) {
    next(err);
  }
};
