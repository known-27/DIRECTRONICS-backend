import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, AuthError } from '../utils/errors';

type AllowedRole = 'ADMIN' | 'EMPLOYEE';

/**
 * Role-based authorization guard.
 * Must be used AFTER authenticateJWT middleware.
 */
export const authorizeRole =
  (...roles: AllowedRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthError('Not authenticated'));
    }

    if (!roles.includes(req.user.role as AllowedRole)) {
      return next(
        new ForbiddenError(
          `Role '${req.user.role}' is not authorized for this operation`
        )
      );
    }

    next();
  };
