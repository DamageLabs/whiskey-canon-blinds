import rateLimit from 'express-rate-limit';

const isDevelopment = process.env.NODE_ENV !== 'production';

// In development, use very high limits (effectively no limit)
const devMax = 10000;

// Auth endpoints (login, register, forgot-password): 5 requests/15 min per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? devMax : 5,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verification endpoints (verify-email, reset-password): 10 requests/15 min per IP
export const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? devMax : 10,
  message: { error: 'Too many verification attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Session join: 10 requests/min per IP
export const sessionJoinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? devMax : 10,
  message: { error: 'Too many join attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API: 100 requests/min per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? devMax : 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Expensive endpoints - stricter limits to prevent abuse

// Stats/analytics endpoints: 2 requests/min per IP (CPU-intensive aggregations)
export const statsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? devMax : 2,
  message: { error: 'Too many stats requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Data export endpoints: 1 request/min per IP (generates large responses)
export const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? devMax : 1,
  message: { error: 'Too many export requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Session results endpoints: 5 requests/min per IP (complex scoring queries)
export const resultsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? devMax : 5,
  message: { error: 'Too many results requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
