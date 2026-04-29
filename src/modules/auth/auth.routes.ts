import { Router } from 'express';
import { login, refresh, logout, getMe } from './auth.controller';
import { validateRequest } from '../../middleware/validate';
import { authenticateJWT } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';
import { loginSchema } from './auth.schema';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', authRateLimiter, validateRequest(loginSchema), login);

// POST /api/v1/auth/refresh
router.post('/refresh', authRateLimiter, refresh);

// POST /api/v1/auth/logout (requires valid access token)
router.post('/logout', authenticateJWT, logout);

// GET /api/v1/auth/me (requires valid access token, any role)
router.get('/me', authenticateJWT, getMe);

export default router;
