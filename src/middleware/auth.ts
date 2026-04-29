import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthError } from '../utils/errors';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateJWT = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token =
    req.cookies?.access_token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new AuthError('No access token provided'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AuthError('Access token expired'));
    }
    return next(new AuthError('Invalid access token'));
  }
};

export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token =
    req.cookies?.access_token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
  } catch {
    // Token invalid — proceed without user
  }
  next();
};
