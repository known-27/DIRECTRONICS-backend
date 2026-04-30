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

app.get('/ping', (_req, res) => {
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);
  const uptimeSeconds = Math.floor(uptime % 60);
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Backend Live Status</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #111827; color: #f9fafb; }
        .card { background: #1f2937; padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); text-align: center; max-width: 450px; width: 100%; border: 1px solid #374151; }
        .status-container { display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
        .pulse { display: block; width: 12px; height: 12px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); animation: pulse 2s infinite; margin-right: 10px; }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        .status-text { color: #10b981; font-weight: 600; font-size: 1rem; letter-spacing: 0.05em; text-transform: uppercase; }
        h1 { margin: 0 0 1.5rem 0; font-size: 1.75rem; font-weight: 700; color: #f9fafb; }
        .details { text-align: left; background: #374151; padding: 1.5rem; border-radius: 12px; font-size: 0.95rem; }
        .details p { margin: 0.75rem 0; display: flex; justify-content: space-between; border-bottom: 1px solid #4b5563; padding-bottom: 0.5rem; }
        .details p:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
        .label { font-weight: 500; color: #9ca3af; }
        .value { font-weight: 600; color: #e5e7eb; }
      </style>
      <script>
        // Auto-refresh the page every 30 seconds
        setTimeout(() => window.location.reload(), 30000);
      </script>
    </head>
    <body>
      <div class="card">
        <div class="status-container">
          <span class="pulse"></span>
          <span class="status-text">Systems Operational</span>
        </div>
        <h1>API Live Status</h1>
        <div class="details">
          <p><span class="label">Service</span> <span class="value">DIRECTRONICS ERP</span></p>
          <p><span class="label">Status</span> <span class="value" style="color: #10b981;">Online</span></p>
          <p><span class="label">Uptime</span> <span class="value">${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s</span></p>
          <p><span class="label">Server Time</span> <span class="value">${new Date().toISOString().split('T')[1].split('.')[0]} UTC</span></p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  if (_req.accepts('html')) {
    res.send(html);
  } else {
    res.json({
      status: 'success',
      message: 'pong',
      uptime: uptime,
      uptimeFormatted: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`,
      timestamp: new Date().toISOString(),
    });
  }
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
