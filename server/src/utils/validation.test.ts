import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  validateEmail,
  validateLength,
  normalizeEmail,
  validateImageMagicBytes,
  INPUT_LIMITS,
} from './validation.js';

describe('validatePassword', () => {
  it('should accept a valid password', () => {
    const result = validatePassword('SecurePass123');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject password shorter than 12 characters', () => {
    const result = validatePassword('Short1Aa');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 12 characters');
  });

  it('should reject password without lowercase letter', () => {
    const result = validatePassword('ALLUPPERCASE123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain a lowercase letter');
  });

  it('should reject password without uppercase letter', () => {
    const result = validatePassword('alllowercase123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain an uppercase letter');
  });

  it('should reject password without number', () => {
    const result = validatePassword('NoNumbersHere');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain a number');
  });

  it('should return multiple errors for weak password', () => {
    const result = validatePassword('weak');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('should accept password with special characters', () => {
    const result = validatePassword('Secure@Pass#123!');
    expect(result.valid).toBe(true);
  });

  it('should accept exactly 12 character password', () => {
    const result = validatePassword('Abcdefgh1234');
    expect(result.valid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('should accept a valid email', () => {
    const result = validateEmail('user@example.com');
    expect(result.valid).toBe(true);
  });

  it('should accept email with subdomain', () => {
    const result = validateEmail('user@mail.example.com');
    expect(result.valid).toBe(true);
  });

  it('should accept email with plus addressing', () => {
    const result = validateEmail('user+tag@example.com');
    expect(result.valid).toBe(true);
  });

  it('should reject empty email', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email is required');
  });

  it('should reject email without @', () => {
    const result = validateEmail('userexample.com');
    expect(result.valid).toBe(false);
  });

  it('should reject email without domain', () => {
    const result = validateEmail('user@');
    expect(result.valid).toBe(false);
  });

  it('should reject email without TLD', () => {
    const result = validateEmail('user@localhost');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email domain must include a valid TLD');
  });

  it('should reject email with consecutive dots', () => {
    const result = validateEmail('user..name@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email cannot contain consecutive dots');
  });

  it('should reject email starting with dot', () => {
    const result = validateEmail('.user@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email local part cannot start or end with a dot');
  });

  it('should reject email ending with dot in local part', () => {
    const result = validateEmail('user.@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email local part cannot start or end with a dot');
  });

  it('should reject email too short', () => {
    const result = validateEmail('a@b');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email is too short');
  });

  it('should reject email too long', () => {
    const longLocal = 'a'.repeat(65);
    const result = validateEmail(`${longLocal}@example.com`);
    expect(result.valid).toBe(false);
  });

  it('should reject numeric-only TLD', () => {
    const result = validateEmail('user@example.123');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid top-level domain');
  });

  it('should reject disposable email domains', () => {
    const result = validateEmail('user@mailinator.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Disposable email addresses are not allowed');
  });

  it('should handle case insensitivity', () => {
    const result = validateEmail('USER@EXAMPLE.COM');
    expect(result.valid).toBe(true);
  });

  it('should trim whitespace', () => {
    const result = validateEmail('  user@example.com  ');
    expect(result.valid).toBe(true);
  });
});

describe('validateLength', () => {
  it('should accept string within limit', () => {
    const result = validateLength('hello', 10, 'Field');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept string at exact limit', () => {
    const result = validateLength('hello', 5, 'Field');
    expect(result.valid).toBe(true);
  });

  it('should reject string over limit', () => {
    const result = validateLength('hello world', 5, 'Field');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Field must be 5 characters or less');
  });

  it('should accept null value', () => {
    const result = validateLength(null, 10, 'Field');
    expect(result.valid).toBe(true);
  });

  it('should accept undefined value', () => {
    const result = validateLength(undefined, 10, 'Field');
    expect(result.valid).toBe(true);
  });

  it('should accept empty string', () => {
    const result = validateLength('', 10, 'Field');
    expect(result.valid).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('should lowercase email', () => {
    expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
  });

  it('should trim whitespace', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('should handle mixed case', () => {
    expect(normalizeEmail('UsEr@ExAmPlE.cOm')).toBe('user@example.com');
  });
});

describe('validateImageMagicBytes', () => {
  it('should detect JPEG image', () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    expect(validateImageMagicBytes(jpegBuffer)).toBe('image/jpeg');
  });

  it('should detect PNG image', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
    expect(validateImageMagicBytes(pngBuffer)).toBe('image/png');
  });

  it('should detect GIF image', () => {
    const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(validateImageMagicBytes(gifBuffer)).toBe('image/gif');
  });

  it('should detect WebP image', () => {
    // RIFF....WEBP
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size placeholder
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(validateImageMagicBytes(webpBuffer)).toBe('image/webp');
  });

  it('should return null for invalid image', () => {
    const textBuffer = Buffer.from('Hello, World!');
    expect(validateImageMagicBytes(textBuffer)).toBeNull();
  });

  it('should return null for empty buffer', () => {
    const emptyBuffer = Buffer.from([]);
    expect(validateImageMagicBytes(emptyBuffer)).toBeNull();
  });

  it('should return null for RIFF without WEBP marker', () => {
    const riffBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x41, 0x56, 0x49, 0x20, // AVI (not WEBP)
    ]);
    expect(validateImageMagicBytes(riffBuffer)).toBeNull();
  });
});

describe('INPUT_LIMITS', () => {
  it('should have correct email limit (RFC 5321)', () => {
    expect(INPUT_LIMITS.EMAIL).toBe(254);
  });

  it('should have password limit to prevent bcrypt DoS', () => {
    expect(INPUT_LIMITS.PASSWORD).toBe(128);
  });

  it('should have reasonable limits for user fields', () => {
    expect(INPUT_LIMITS.DISPLAY_NAME).toBe(100);
    expect(INPUT_LIMITS.BIO).toBe(500);
  });

  it('should have limits for session fields', () => {
    expect(INPUT_LIMITS.SESSION_NAME).toBe(100);
    expect(INPUT_LIMITS.SESSION_THEME).toBe(50);
    expect(INPUT_LIMITS.INVITE_CODE).toBe(20);
  });

  it('should have limits for whiskey fields', () => {
    expect(INPUT_LIMITS.WHISKEY_NAME).toBe(200);
    expect(INPUT_LIMITS.WHISKEY_DISTILLERY).toBe(200);
    expect(INPUT_LIMITS.NOTES).toBe(2000);
  });
});
