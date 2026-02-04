# OWASP Top 10 (2021) - Next.js Stack Mapping

## A01:2021 - Broken Access Control

### Description
Restrictions on authenticated users are not properly enforced.

### Next.js Attack Vectors

#### Missing Auth Middleware
```typescript
// VULNERABLE: API route without auth check
export async function GET(request: NextRequest) {
  const users = await prisma.usuario.findMany()
  return NextResponse.json(users)  // Anyone can list all users!
}
```

#### IDOR (Insecure Direct Object Reference)
```typescript
// VULNERABLE: No ownership check
export async function GET(request: NextRequest, { params }) {
  const { id } = await params
  const membro = await prisma.membro.findUnique({ where: { id } })
  return NextResponse.json(membro)  // Any user can access any member!
}
```

#### Path Traversal in Middleware
```typescript
// VULNERABLE: Regex bypass
matcher: ["/((?!api|_next|public).*)"]
// Attacker: /api/../admin/users (may bypass depending on server)
```

### Verification Steps
1. Map all API routes: `glob src/app/api/**/route.ts`
2. Verify each has `withApiAuth()` or explicit `auth()` check
3. Verify resource ownership checks with `ensureOwnerOrAdmin()`
4. Test: Access member data with different user sessions

---

## A02:2021 - Cryptographic Failures

### Description
Failures related to cryptography leading to sensitive data exposure.

### Next.js Attack Vectors

#### Weak Password Hashing
```typescript
// VULNERABLE: Low cost factor
const hash = await bcrypt.hash(password, 4)

// SECURE: Cost factor 12+
const hash = await bcrypt.hash(password, 12)
```

#### Predictable Tokens
```typescript
// VULNERABLE: Predictable
const token = Math.random().toString(36)
const token = Date.now().toString()

// SECURE: Cryptographically random
import { randomBytes } from "crypto"
const token = randomBytes(32).toString("hex")
```

#### Sensitive Data in Transit
```typescript
// VULNERABLE: No SSL
DATABASE_URL="postgresql://user:pass@host:5432/db"

// SECURE: SSL required
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### Verification Steps
1. Check bcrypt cost factor in `auth.ts`
2. Grep for `Math.random` in token generation
3. Verify all connection strings use SSL
4. Check NEXTAUTH_SECRET length (>= 32 chars)

---

## A03:2021 - Injection

### Description
User-supplied data is not validated, filtered, or sanitized.

### Next.js Attack Vectors

#### SQL Injection (Prisma)
```typescript
// VULNERABLE: String interpolation
const users = await prisma.$queryRawUnsafe(
  `SELECT * FROM usuarios WHERE email = '${email}'`
)

// SECURE: Parameterized
const users = await prisma.$queryRaw`
  SELECT * FROM usuarios WHERE email = ${email}
`
```

#### XSS (Cross-Site Scripting)
```typescript
// VULNERABLE: Unsanitized HTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// SECURE: Sanitized
import DOMPurify from "isomorphic-dompurify"
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

#### Command Injection
```typescript
// VULNERABLE: Shell command with user input
import { exec } from "child_process"
exec(`convert ${filename} output.png`)

// SECURE: Parameterized or avoid shell
import { execFile } from "child_process"
execFile("convert", [filename, "output.png"])
```

### Verification Steps
1. Grep: `\$queryRawUnsafe` - should be zero or heavily audited
2. Grep: `dangerouslySetInnerHTML` - verify DOMPurify used
3. Grep: `exec\(|spawn\(` - verify no user input in commands
4. Verify all inputs validated with Zod schemas

---

## A04:2021 - Insecure Design

### Description
Missing or ineffective security controls in design.

### Next.js Attack Vectors

#### No Rate Limiting
```typescript
// VULNERABLE: Unlimited login attempts
export async function POST(request: Request) {
  const { email, password } = await request.json()
  // No rate limit - brute force possible!
}
```

#### Account Enumeration
```typescript
// VULNERABLE: Different messages reveal existence
if (!user) return { error: "User not found" }
if (!validPassword) return { error: "Wrong password" }

// SECURE: Consistent message
return { error: "Invalid credentials" }
```

#### Missing CSRF Protection
- NextAuth v5 handles CSRF for auth routes
- Custom forms need verification

### Verification Steps
1. Check rate limiting on auth endpoints
2. Verify consistent error messages
3. Check for CSRF tokens on state-changing forms
4. Review business logic for abuse scenarios

---

## A05:2021 - Security Misconfiguration

### Description
Insecure default configurations, open cloud storage, verbose errors.

### Next.js Attack Vectors

#### Debug Mode in Production
```typescript
// next.config.ts
// VULNERABLE: Exposes internals
reactStrictMode: false,
productionBrowserSourceMaps: true,

// SECURE
reactStrictMode: true,
productionBrowserSourceMaps: false,
```

#### Missing Security Headers
```typescript
// next.config.ts - SHOULD HAVE:
headers: async () => [{
  source: "/:path*",
  headers: [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-XSS-Protection", value: "1; mode=block" },
  ],
}]
```

#### Exposed Environment Variables
```typescript
// VULNERABLE: Secret exposed to client
NEXT_PUBLIC_DATABASE_URL="..."  // Anyone can see this!

// SECURE: Only safe values with NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL="https://example.com"
```

### Verification Steps
1. Check `next.config.ts` for security headers
2. Verify `.env.production` is gitignored
3. Audit `NEXT_PUBLIC_*` variables
4. Check for verbose error messages in production

---

## A06:2021 - Vulnerable and Outdated Components

### Description
Using components with known vulnerabilities.

### Next.js Attack Vectors

#### Outdated Dependencies
```bash
# Check for vulnerabilities
npm audit
```

#### Unmaintained Packages
- Check last publish date
- Check open security issues

### Verification Steps
1. Run `npm audit`
2. Check for outdated packages: `npm outdated`
3. Review security advisories for major deps (next, prisma, next-auth)

---

## A07:2021 - Identification and Authentication Failures

### Description
Weaknesses in authentication mechanisms.

### Next.js Attack Vectors

#### Weak Passwords Allowed
```typescript
// VULNERABLE: No strength check
if (password.length >= 1) { ... }

// SECURE: Strong requirements
if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password))
```

#### Session Fixation
- NextAuth regenerates session on login (safe by default)

#### Missing Session Timeout
```typescript
// next-auth config
session: {
  maxAge: 30 * 24 * 60 * 60,  // 30 days - consider shorter for sensitive apps
}
```

### Verification Steps
1. Verify password requirements in registration and reset
2. Check session duration configuration
3. Verify session invalidated on password change
4. Check for session token in URL (should never happen)

---

## A08:2021 - Software and Data Integrity Failures

### Description
Code and infrastructure that does not protect against integrity violations.

### Next.js Attack Vectors

#### Insecure Deserialization
- React Server Components serialize data
- Verify no sensitive data in RSC payloads

#### CI/CD Pipeline Security
```yaml
# VULNERABLE: No dependency verification
- run: npm install
- run: npm run build

# SECURE: Lock file integrity
- run: npm ci  # Uses package-lock.json exactly
```

### Verification Steps
1. Verify `npm ci` used in CI/CD (not `npm install`)
2. Check for integrity hashes in package-lock.json
3. Review Server Component serialization

---

## A09:2021 - Security Logging and Monitoring Failures

### Description
Insufficient logging to detect attacks.

### Next.js Attack Vectors

#### No Auth Logging
```typescript
// SHOULD LOG:
// - Failed login attempts
// - Password reset requests
// - Role changes
// - Access denied events
```

#### Sensitive Data in Logs
```typescript
// VULNERABLE: Password in logs
console.log("Login attempt:", { email, password })

// SECURE: Redact sensitive fields
console.log("Login attempt:", { email, password: "[REDACTED]" })
```

### Verification Steps
1. Verify failed login attempts are logged
2. Check logs don't contain passwords, tokens, PII
3. Verify log retention and monitoring exists

---

## A10:2021 - Server-Side Request Forgery (SSRF)

### Description
Server fetches URLs provided by user without validation.

### Next.js Attack Vectors

#### Unvalidated URL Fetch
```typescript
// VULNERABLE: SSRF
const url = request.nextUrl.searchParams.get("url")
const response = await fetch(url)  // Can access internal services!

// SECURE: Allowlist
const ALLOWED_HOSTS = ["api.example.com"]
const url = new URL(request.nextUrl.searchParams.get("url"))
if (!ALLOWED_HOSTS.includes(url.hostname)) {
  return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
}
```

#### Image Proxy SSRF
```typescript
// next.config.ts
images: {
  remotePatterns: [
    { hostname: "specific-domain.com" }  // Allowlist only
  ]
}
```

### Verification Steps
1. Grep for `fetch\(` with dynamic URLs
2. Check Next.js image configuration
3. Verify no user-controlled URLs in server-side fetches
