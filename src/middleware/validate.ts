import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Validates request data against a Zod schema.
 * Throws ZodError which is handled by global error handler.
 */
export const validateRequest =
  (schema: ZodSchema, part: RequestPart = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    schema.parse(req[part]);
    next();
  };
