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
