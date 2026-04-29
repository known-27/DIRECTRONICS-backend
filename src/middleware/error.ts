import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { env } from '../config/env';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log all errors server-side with full context
  logger.error({
    message: err.message,
    stack: err.stack,
    route: `${req.method} ${req.path}`,
    userId: (req as Request & { user?: { id: string } }).user?.id,
    timestamp: new Date().toISOString(),
  });

  // Zod validation error
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const key = e.path.join('.');
      if (!errors[key]) errors[key] = [];
      errors[key].push(e.message);
    });
    res.status(400).json({ success: false, message: 'Validation failed', errors });
    return;
  }

  // Prisma unique constraint violation
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A record with this value already exists' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Record not found' });
      return;
    }
    res.status(400).json({ success: false, message: 'Database operation failed' });
    return;
  }

  // Custom ValidationError (with field-level errors)
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // Custom AppError (operational errors)
  if (err instanceof AppError && err.isOperational) {
    const body: Record<string, unknown> = { success: false, message: err.message };
    if ('errorCode' in err && typeof (err as AppError & { errorCode: string }).errorCode === 'string') {
      body.error = (err as AppError & { errorCode: string }).errorCode;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Unknown/programming errors — never expose internals
  const message = env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred';
  res.status(500).json({ success: false, message });
};
