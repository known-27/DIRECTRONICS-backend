import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { generalRateLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/error';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import serviceRoutes from './modules/services/services.routes';
import formulaRoutes from './modules/formulas/formulas.routes';
import projectRoutes from './modules/projects/projects.routes';
import paymentRoutes from './modules/payments/payments.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import uploadRoutes from './modules/uploads/uploads.routes';
import exportRoutes from './modules/export/export.routes';
import notificationRoutes from './modules/notifications/notifications.routes';

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'"],
      imgSrc:     ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = env.FRONTEND_ORIGIN.split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin) and listed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(generalRateLimiter);
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Trust proxy for correct IP extraction behind load balancers
app.set('trust proxy', 1);

// Ensure uploads directory exists
import fs from 'fs';
const uploadsDir = path.join(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'DIRECTRONICS ERP API' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/users',     userRoutes);
app.use('/api/v1/services',  serviceRoutes);
app.use('/api/v1/formulas',  formulaRoutes);
app.use('/api/v1/projects',  projectRoutes);
app.use('/api/v1/payments',  paymentRoutes);
app.use('/api/v1/dashboard',      dashboardRoutes);
app.use('/api/v1/uploads',        uploadRoutes);
app.use('/api/v1/export',         exportRoutes);
app.use('/api/v1/notifications',  notificationRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorHandler);

export default app;
