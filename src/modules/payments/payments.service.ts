import prisma from '../../config/db';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../utils/errors';
import { auditLog } from '../audit/auditLog';
import { CONSTANTS } from '../../config/constants';
import { buildPaginationArgs, buildPaginatedResponse } from '../../utils/filters';
import type { PaymentFilterInput, CreateTransactionInput } from './payments.schema';
import { Prisma } from '@prisma/client';

// ─── Shared payment include ───────────────────────────────────────────────────

const PAYMENT_INCLUDE = {
  employee:        { select: { id: true, name: true, fullName: true, email: true } },
  processedByUser: { select: { id: true, name: true } },
  project: {
    select: {
      id: true, invoiceNumber: true, projectName: true,
      service: { select: { id: true, name: true } },
    },
  },
  transactions: {
    orderBy: { paidAt: 'asc' as const },
    include: { paidBy: { select: { id: true, name: true, fullName: true } } },
  },
  _count: { select: { transactions: true } },
} satisfies Prisma.PaymentInclude;

// ─── List Payments ────────────────────────────────────────────────────────────

export const listPaymentsService = async (filters: PaymentFilterInput) => {
  const where: Prisma.PaymentWhereInput = {};

  if (filters.status)     where.status     = filters.status;
  if (filters.employeeId) where.employeeId = filters.employeeId;

  const { skip, take } = buildPaginationArgs(filters.page, filters.limit);

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: PAYMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
  ]);

  return buildPaginatedResponse(payments, total, filters.page, filters.limit);
};

// ─── Get Transactions for a Payment ──────────────────────────────────────────

export const getTransactionsService = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where:   { id: paymentId },
    include: { transactions: { orderBy: { paidAt: 'asc' }, include: { paidBy: { select: { id: true, name: true, fullName: true } } } } },
  });

  if (!payment) throw new NotFoundError('Payment');
  return payment.transactions;
};

// ─── Add Transaction (Partial Payment) ───────────────────────────────────────

export const addTransactionService = async (
  paymentId: string,
  input:     CreateTransactionInput,
  adminId:   string,
  ipAddress: string
) => {
  // ── Step 1: Load the payment ────────────────────────────────────────────────
  const payment = await prisma.payment.findUnique({
    where:   { id: paymentId },
    include: { project: true },
  });

  if (!payment) throw new NotFoundError('Payment');

  // ── Step 2: Validate payment is actionable ──────────────────────────────────
  if (payment.status === 'PAID') {
    throw new BadRequestError('This payment is already fully paid (ALREADY_PAID)');
  }
  if (payment.status === 'CANCELLED') {
    throw new ForbiddenError('Cannot add a transaction to a cancelled payment');
  }

  // ── Step 3: Validate amount does not exceed pending balance ─────────────────
  if (input.amount > payment.pendingAmount) {
    throw new BadRequestError(
      `Amount ₹${input.amount.toLocaleString('en-IN')} exceeds the pending balance of ₹${payment.pendingAmount.toLocaleString('en-IN')} (EXCEEDS_PENDING)`
    );
  }

  // ── Step 4–6: Atomic transaction ─────────────────────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    // Create transaction record
    const transaction = await tx.paymentTransaction.create({
      data: {
        paymentId,
        projectId:  payment.projectId,
        employeeId: payment.employeeId,
        paidById:   adminId,
        amount:     input.amount,
        note:       input.note ?? null,
      },
    });

    // Recalculate totals
    const newTotalPaid    = payment.totalPaid + input.amount;
    const newPendingAmount = payment.calculatedAmount - newTotalPaid;
    const isFullyPaid     = newPendingAmount <= 0;

    const newPaymentStatus: 'PARTIAL' | 'PAID' = isFullyPaid ? 'PAID' : 'PARTIAL';

    // Update payment record
    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        totalPaid:     newTotalPaid,
        pendingAmount: Math.max(0, newPendingAmount),
        status:        newPaymentStatus,
        paidAt:        isFullyPaid ? new Date() : null,
      },
      include: PAYMENT_INCLUDE,
    });

    // Update project status to PAID if fully paid
    if (isFullyPaid) {
      await tx.project.update({
        where: { id: payment.projectId },
        data:  { status: 'PAID' },
      });
    }

    return { transaction, updatedPayment };
  });

  await auditLog({
    userId:   adminId,
    action:   CONSTANTS.AUDIT_ACTIONS.CREATE,
    entity:   'PaymentTransaction',
    entityId: result.transaction.id,
    newValue: {
      paymentId,
      amount:        input.amount,
      note:          input.note ?? null,
      newStatus:     result.updatedPayment.status,
      newTotalPaid:  result.updatedPayment.totalPaid,
      pendingAmount: result.updatedPayment.pendingAmount,
    },
    ipAddress,
  });

  return result.updatedPayment;
};

// ─── Reverse Transaction ──────────────────────────────────────────────────────

export const reverseTransactionService = async (
  paymentId:     string,
  transactionId: string,
  adminId:       string,
  ipAddress:     string
) => {
  // Load transaction and its parent payment
  const transaction = await prisma.paymentTransaction.findUnique({
    where:   { id: transactionId },
    include: { payment: { include: { project: true } } },
  });

  if (!transaction) throw new NotFoundError('Transaction');
  if (transaction.paymentId !== paymentId) {
    throw new BadRequestError('Transaction does not belong to this payment');
  }

  const oldAmount    = transaction.amount;
  const payment      = transaction.payment;
  const oldStatus    = payment.status;

  const result = await prisma.$transaction(async (tx) => {
    // Delete the transaction
    await tx.paymentTransaction.delete({ where: { id: transactionId } });

    // Recalculate totals from remaining transactions
    const remaining = await tx.paymentTransaction.aggregate({
      where: { paymentId },
      _sum:  { amount: true },
    });

    const newTotalPaid     = remaining._sum.amount ?? 0;
    const newPendingAmount = payment.calculatedAmount - newTotalPaid;

    // Determine new payment status
    let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
    if (newTotalPaid <= 0) {
      newPaymentStatus = 'PENDING';
    } else if (newPendingAmount <= 0) {
      newPaymentStatus = 'PAID';
    } else {
      newPaymentStatus = 'PARTIAL';
    }

    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        totalPaid:     newTotalPaid,
        pendingAmount: Math.max(0, newPendingAmount),
        status:        newPaymentStatus,
        paidAt:        newPaymentStatus === 'PAID' ? payment.paidAt : null,
      },
      include: PAYMENT_INCLUDE,
    });

    // If project was PAID but we just reverted, set it back to APPROVED
    if (payment.project.status === 'PAID' && newPaymentStatus !== 'PAID') {
      await tx.project.update({
        where: { id: payment.projectId },
        data:  { status: 'APPROVED' },
      });
    }

    return updatedPayment;
  });

  await auditLog({
    userId:   adminId,
    action:   CONSTANTS.AUDIT_ACTIONS.DELETE,
    entity:   'PaymentTransaction',
    entityId: transactionId,
    oldValue: {
      amount:    oldAmount,
      oldStatus,
    },
    newValue: {
      newStatus:     result.status,
      newTotalPaid:  result.totalPaid,
      pendingAmount: result.pendingAmount,
    },
    ipAddress,
  });

  return result;
};
