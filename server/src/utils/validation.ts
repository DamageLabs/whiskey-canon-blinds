/**
 * Input length limits to prevent oversized payloads
 */
export const INPUT_LIMITS = {
  EMAIL: 254, // RFC 5321 max email length
  PASSWORD: 128, // Reasonable max to prevent bcrypt DoS
  DISPLAY_NAME: 100,
  BIO: 500,
  VERIFICATION_CODE: 8,
  SESSION_NAME: 100,
  SESSION_THEME: 50,
  WHISKEY_NAME: 200,
  WHISKEY_DISTILLERY: 200,
  NOTES: 2000,
  INVITE_CODE: 20,
} as const;

/**
 * Validates string length is within limits
 */
export function validateLength(
  value: string | undefined | null,
  maxLength: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: true }; // Let other validation handle required fields
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} must be ${maxLength} characters or less` };
  }
  return { valid: true };
}

/**
 * Validates an email address format and structure
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Check minimum length
  if (trimmedEmail.length < 5) {
    return { valid: false, error: 'Email is too short' };
  }

  // Check maximum length (RFC 5321)
  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Split email into local and domain parts
  const [localPart, domain] = trimmedEmail.split('@');

  // Validate local part
  if (!localPart || localPart.length > 64) {
    return { valid: false, error: 'Invalid email local part' };
  }

  // Check for consecutive dots in local part
  if (localPart.includes('..')) {
    return { valid: false, error: 'Email cannot contain consecutive dots' };
  }

  // Check local part doesn't start or end with a dot
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, error: 'Email local part cannot start or end with a dot' };
  }

  // Validate domain
  if (!domain || domain.length < 3) {
    return { valid: false, error: 'Invalid email domain' };
  }

  // Check domain has at least one dot (TLD)
  if (!domain.includes('.')) {
    return { valid: false, error: 'Email domain must include a valid TLD' };
  }

  // Extract TLD and validate
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return { valid: false, error: 'Invalid top-level domain' };
  }

  // Check for numeric-only TLD (not valid)
  if (/^\d+$/.test(tld)) {
    return { valid: false, error: 'Invalid top-level domain' };
  }

  // Common disposable email domains (optional - can be expanded)
  const disposableDomains = [
    'tempmail.com',
    'throwaway.email',
    'guerrillamail.com',
    'mailinator.com',
    '10minutemail.com',
    'fakeinbox.com',
    'trashmail.com',
    'yopmail.com',
  ];

  if (disposableDomains.includes(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }

  return { valid: true };
}

/**
 * Normalizes an email address (lowercase, trimmed)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Password validation result
 */
export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validates password strength requirements:
 * - At least 12 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Image magic byte signatures for content validation
 */
const IMAGE_SIGNATURES: { type: string; signature: number[] }[] = [
  { type: 'image/jpeg', signature: [0xFF, 0xD8, 0xFF] },
  { type: 'image/png', signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { type: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { type: 'image/webp', signature: [0x52, 0x49, 0x46, 0x46] }, // RIFF (WebP starts with RIFF)
];

/**
 * Validates image file content by checking magic bytes
 * Returns the detected image type or null if not a valid image
 */
export function validateImageMagicBytes(buffer: Buffer): string | null {
  for (const { type, signature } of IMAGE_SIGNATURES) {
    if (buffer.length < signature.length) continue;

    const matches = signature.every((byte, index) => buffer[index] === byte);
    if (matches) {
      // Additional check for WebP: verify WEBP marker at offset 8
      if (type === 'image/webp') {
        if (buffer.length >= 12) {
          const webpMarker = buffer.slice(8, 12).toString('ascii');
          if (webpMarker === 'WEBP') {
            return type;
          }
        }
        continue; // Not a valid WebP, check other formats
      }
      return type;
    }
  }
  return null;
}
