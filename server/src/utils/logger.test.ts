import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('in development mode', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();
    });

    it('should log debug messages', async () => {
      const { logger } = await import('./logger.js');
      logger.debug('test debug message');
      expect(consoleSpy.log).toHaveBeenCalledWith('[DEBUG]', 'test debug message');
    });

    it('should log info messages', async () => {
      const { logger } = await import('./logger.js');
      logger.info('test info message');
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO]', 'test info message');
    });

    it('should log warning messages', async () => {
      const { logger } = await import('./logger.js');
      logger.warn('test warning');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN]', 'test warning');
    });

    it('should log error messages', async () => {
      const { logger } = await import('./logger.js');
      logger.error('test error');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR]', 'test error');
    });

    it('should log dev messages', async () => {
      const { logger } = await import('./logger.js');
      logger.dev('test dev message');
      expect(consoleSpy.log).toHaveBeenCalledWith('test dev message');
    });

    it('should handle multiple arguments', async () => {
      const { logger } = await import('./logger.js');
      logger.debug('message', { key: 'value' }, 123);
      expect(consoleSpy.log).toHaveBeenCalledWith('[DEBUG]', 'message', { key: 'value' }, 123);
    });
  });

  describe('in production mode', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
    });

    it('should NOT log debug messages', async () => {
      const { logger } = await import('./logger.js');
      logger.debug('test debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should NOT log info messages', async () => {
      const { logger } = await import('./logger.js');
      logger.info('test info message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should still log warning messages', async () => {
      const { logger } = await import('./logger.js');
      logger.warn('test warning');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN]', 'test warning');
    });

    it('should still log error messages', async () => {
      const { logger } = await import('./logger.js');
      logger.error('test error');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR]', 'test error');
    });

    it('should NOT log dev messages', async () => {
      const { logger } = await import('./logger.js');
      logger.dev('test dev message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });
});
