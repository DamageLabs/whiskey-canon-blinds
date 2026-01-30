import { doubleCsrf, DoubleCsrfConfigOptions } from 'csrf-csrf';
import { Request } from 'express';

const csrfOptions: DoubleCsrfConfigOptions = {
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET!,
  getSessionIdentifier: (req: Request) => {
    // Use a combination of cookies/tokens as session identifier
    // This helps ensure the CSRF token is bound to the user's session
    return req.cookies?.refreshToken || req.cookies?.accessToken || req.ip || 'anonymous';
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

export { doubleCsrfProtection, generateCsrfToken };
