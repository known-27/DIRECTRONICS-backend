import { Request, Response } from 'express';
import { tryCatch } from '../../utils/tryCatch';
import { sendSuccess } from '../../utils/response';
import {
  loginService,
  refreshTokenService,
  logoutService,
  getMeService,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from './auth.service';
import { CONSTANTS } from '../../config/constants';
import { AuthError } from '../../utils/errors';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';

export const login = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  const { accessToken, refreshToken, user } = await loginService(email, password, getIp(req));

  res
    .cookie(CONSTANTS.ACCESS_TOKEN_COOKIE, accessToken, getAccessTokenCookieOptions())
    .cookie(CONSTANTS.REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());

  sendSuccess(res, { user }, 'Login successful');
});

export const refresh = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const rawToken = req.cookies?.[CONSTANTS.REFRESH_TOKEN_COOKIE];

  if (!rawToken) {
    throw new AuthError('No refresh token provided');
  }

  const { accessToken, refreshToken } = await refreshTokenService(rawToken, getIp(req));

  res
    .cookie(CONSTANTS.ACCESS_TOKEN_COOKIE, accessToken, getAccessTokenCookieOptions())
    .cookie(CONSTANTS.REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());

  sendSuccess(res, {}, 'Token refreshed');
});

export const logout = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const rawToken = req.cookies?.[CONSTANTS.REFRESH_TOKEN_COOKIE];
  const userId = req.user?.sub;

  if (rawToken && userId) {
    await logoutService(rawToken, userId, getIp(req));
  }

  res
    .clearCookie(CONSTANTS.ACCESS_TOKEN_COOKIE, { path: '/' })
    .clearCookie(CONSTANTS.REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });

  sendSuccess(res, {}, 'Logged out successfully');
});

export const getMe = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.sub;
  if (!userId) throw new Error('Unauthenticated');
  const user = await getMeService(userId);
  sendSuccess(res, { user }, 'Current user retrieved');
});
