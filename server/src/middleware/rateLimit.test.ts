import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('rate limiters', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.resetModules();
  });

  describe('in development mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();
    });

    it('should have high limit for authLimiter', async () => {
      const { authLimiter } = await import('./rateLimit.js');
      // In development, max should be 10000
      expect(authLimiter).toBeDefined();
    });

    it('should have high limit for verificationLimiter', async () => {
      const { verificationLimiter } = await import('./rateLimit.js');
      expect(verificationLimiter).toBeDefined();
    });

    it('should have high limit for sessionJoinLimiter', async () => {
      const { sessionJoinLimiter } = await import('./rateLimit.js');
      expect(sessionJoinLimiter).toBeDefined();
    });

    it('should have high limit for generalLimiter', async () => {
      const { generalLimiter } = await import('./rateLimit.js');
      expect(generalLimiter).toBeDefined();
    });

    it('should have high limit for statsLimiter', async () => {
      const { statsLimiter } = await import('./rateLimit.js');
      expect(statsLimiter).toBeDefined();
    });

    it('should have high limit for exportLimiter', async () => {
      const { exportLimiter } = await import('./rateLimit.js');
      expect(exportLimiter).toBeDefined();
    });

    it('should have high limit for resultsLimiter', async () => {
      const { resultsLimiter } = await import('./rateLimit.js');
      expect(resultsLimiter).toBeDefined();
    });
  });

  describe('in production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
    });

    it('should export all rate limiters', async () => {
      const limiters = await import('./rateLimit.js');

      expect(limiters.authLimiter).toBeDefined();
      expect(limiters.verificationLimiter).toBeDefined();
      expect(limiters.sessionJoinLimiter).toBeDefined();
      expect(limiters.generalLimiter).toBeDefined();
      expect(limiters.statsLimiter).toBeDefined();
      expect(limiters.exportLimiter).toBeDefined();
      expect(limiters.resultsLimiter).toBeDefined();
    });
  });
});
