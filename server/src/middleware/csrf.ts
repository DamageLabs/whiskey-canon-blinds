import { doubleCsrf, DoubleCsrfConfigOptions } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';

const csrfOptions: DoubleCsrfConfigOptions = {
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET!,
  getSessionIdentifier: (req: Request) => {
    // CSRF tokens must be bound to an authenticated session
    // Require refresh token (set on login) as the session identifier
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      // For unauthenticated requests, use a placeholder that will
      // cause token validation to fail if they try to use CSRF-protected endpoints
      return '__unauthenticated__';
    }
    return refreshToken;
  },
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  getCsrfTokenFromRequest: (req: Request) => req.headers['x-csrf-token'] as string,
};

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf(csrfOptions);

// Middleware that requires authentication before generating CSRF token
function requireAuthForCsrf(req: Request, res: Response, next: NextFunction) {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Authentication required for CSRF token' });
  }
  next();
}

export { doubleCsrfProtection, generateCsrfToken, requireAuthForCsrf };
