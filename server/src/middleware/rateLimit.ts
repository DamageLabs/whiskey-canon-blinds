import rateLimit from 'express-rate-limit';

// Auth endpoints (login, register, forgot-password): 5 requests/15 min per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verification endpoints (verify-email, reset-password): 10 requests/15 min per IP
export const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many verification attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Session join: 10 requests/min per IP
export const sessionJoinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many join attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API: 100 requests/min per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
