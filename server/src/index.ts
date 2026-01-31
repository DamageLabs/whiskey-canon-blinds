import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import path from 'path';
import dotenv from 'dotenv';

import { initializeDatabase } from './db/index.js';
import { initializeSocket } from './socket/index.js';
import { validateJwtSecret } from './middleware/auth.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { doubleCsrfProtection, generateCsrfToken, requireAuthForCsrf } from './middleware/csrf.js';
import authRoutes from './routes/auth.js';
import sessionsRoutes from './routes/sessions.js';
import scoresRoutes from './routes/scores.js';
import participantsRoutes from './routes/participants.js';
import adminRoutes from './routes/admin.js';
import socialRoutes from './routes/social.js';
import templatesRoutes from './routes/templates.js';
import commentsRoutes from './routes/comments.js';
import analyticsRoutes from './routes/analytics.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Validate required environment variables at startup
validateJwtSecret();

const app = express();
const httpServer = createServer(app);

// Initialize socket.io
initializeSocket(httpServer);

// Middleware - Security headers with explicit configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Apply general rate limiting to all API routes
app.use('/api', generalLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'dist', 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CSRF token endpoint - requires authentication, must be before CSRF protection middleware
app.get('/api/csrf-token', requireAuthForCsrf, (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
});

// Apply CSRF protection to state-changing requests
// Exempt certain routes that don't need CSRF (login/register don't have tokens yet)
app.use('/api', (req, res, next) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for auth routes that don't require authentication
  const exemptPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/verify-email',
    '/api/auth/resend-verification',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/refresh',
    '/api/sessions/join',
  ];

  if (exemptPaths.some(path => req.path === path.replace('/api', ''))) {
    return next();
  }

  // Apply CSRF protection
  return doubleCsrfProtection(req, res, next);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/participants', participantsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
const PORT = process.env.PORT || 3001;

initializeDatabase();

httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`WebSocket server ready`);
});

export default app;
