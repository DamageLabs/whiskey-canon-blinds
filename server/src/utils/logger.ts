/**
 * Simple logger utility that respects NODE_ENV
 * - In development: all logs are shown
 * - In production: only errors and warnings are logged (no debug/info)
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  /**
   * Debug logging - only shown in development
   */
  debug: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logging - only shown in development
   */
  info: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Warning logging - always shown
   */
  warn: (...args: unknown[]): void => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Error logging - always shown
   */
  error: (...args: unknown[]): void => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Log only in development (alias for debug)
   */
  dev: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
};
