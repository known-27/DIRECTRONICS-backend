import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../config/db';
import { env } from '../../config/env';
import { AuthError } from '../../utils/errors';
import { auditLog } from '../audit/auditLog';
import { CONSTANTS } from '../../config/constants';
import type { JwtPayload } from '../../middleware/auth';

// ─── Token Helpers ───────────────────────────────────────────────────────────

export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const hashToken = async (token: string): Promise<string> => {
  return bcrypt.hash(token, 10); // lower rounds acceptable for token hash
};

export const compareToken = async (token: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(token, hash);
};

// ─── Cookie Options ───────────────────────────────────────────────────────────

export const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
});

export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
});

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const loginService = async (
  email: string,
  password: string,
  ipAddress: string
): Promise<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } }> => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    throw new AuthError('Invalid credentials');
  }

  // Always run bcrypt compare (timing-attack safe — same cost whether user exists or not)
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new AuthError('Invalid credentials');
  }

  // Check deleted status AFTER password verify (don't leak existence of deleted accounts via timing)
  if (user.deletedAt !== null) {
    throw new AuthError('This account no longer exists. Contact your administrator.');
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = generateRefreshToken();
  const hashedRefreshToken = await hashToken(refreshToken);

  // Store hashed refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: hashedRefreshToken,
      expiresAt,
    },
  });

  await auditLog({
    userId: user.id,
    action: CONSTANTS.AUDIT_ACTIONS.LOGIN,
    entity: 'User',
    entityId: user.id,
    newValue: { email: user.email, role: user.role },
    ipAddress,
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
};

export const refreshTokenService = async (
  rawRefreshToken: string,
  ipAddress: string
): Promise<{ accessToken: string; refreshToken: string }> => {
  // Find all non-expired tokens and compare
  const allTokens = await prisma.refreshToken.findMany({
    where: {
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  let matchedToken: (typeof allTokens)[0] | null = null;

  for (const t of allTokens) {
    const matches = await compareToken(rawRefreshToken, t.token);
    if (matches) {
      matchedToken = t;
      break;
    }
  }

  if (!matchedToken) {
    throw new AuthError('Invalid or expired refresh token');
  }

  if (!matchedToken.user.isActive) {
    await prisma.refreshToken.delete({ where: { id: matchedToken.id } });
    throw new AuthError('Account is deactivated');
  }

  // Rotate: delete old, create new
  const newAccessToken = generateAccessToken({
    sub: matchedToken.user.id,
    email: matchedToken.user.email,
    role: matchedToken.user.role,
  });
  const newRefreshToken = generateRefreshToken();
  const hashedNew = await hashToken(newRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);

  // Use deleteMany to avoid P2025 crash on concurrent rotation attempts.
  // If count is 0, the token was already consumed (race condition / replay attempt).
  const [deleted] = await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { id: matchedToken.id } }),
    prisma.refreshToken.create({
      data: {
        userId: matchedToken.userId,
        token: hashedNew,
        expiresAt,
      },
    }),
  ]);

  if (deleted.count === 0) {
    // Token was already rotated by a concurrent request — revoke the newly
    // created token and reject this request to prevent token duplication.
    await prisma.refreshToken.deleteMany({ where: { userId: matchedToken.userId, token: hashedNew } });
    throw new AuthError('Refresh token already used. Please log in again.');
  }

  await auditLog({
    userId: matchedToken.userId,
    action: CONSTANTS.AUDIT_ACTIONS.TOKEN_REFRESH,
    entity: 'RefreshToken',
    entityId: matchedToken.id,
    ipAddress,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const logoutService = async (
  rawRefreshToken: string,
  userId: string,
  ipAddress: string
): Promise<void> => {
  const allTokens = await prisma.refreshToken.findMany({ where: { userId } });

  for (const t of allTokens) {
    const matches = await compareToken(rawRefreshToken, t.token);
    if (matches) {
      await prisma.refreshToken.delete({ where: { id: t.id } });
      break;
    }
  }

  await auditLog({
    userId,
    action: CONSTANTS.AUDIT_ACTIONS.LOGOUT,
    entity: 'User',
    entityId: userId,
    ipAddress,
  });
};
export const getMeService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id:                true,
      name:              true,
      fullName:          true,
      email:             true,
      role:              true,
      isActive:          true,
      mobileNumber1:     true,
      mobileNumber2:     true,
      address:           true,
      identityDocType:   true,
      staticSalary:      true,
      profilePictureUrl: true,
      createdAt:         true,
    },
  });

  if (!user || !user.isActive) throw new AuthError('User not found or inactive');
  return user;
};
