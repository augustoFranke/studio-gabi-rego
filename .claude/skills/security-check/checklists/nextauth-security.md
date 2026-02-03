# NextAuth v5 (Auth.js) Security Checklist

## Configuration Security

### Secret Management
- [ ] **Strong secret configured**
  ```typescript
  // Verify in auth.ts
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  ```
  - Minimum: 32 characters
  - Generated with: `openssl rand -base64 32`
  - Risk: Weak secret = JWT forgery possible

- [ ] **Secret not hardcoded**
  - Grep: No literal secret strings in source code

### Trust Configuration
- [ ] **`trustHost: true` only when appropriate**
  ```typescript
  // Only enable when behind trusted reverse proxy (Vercel, nginx)
  trustHost: true
  ```
  - Risk: Host header injection if misconfigured

---

## Credentials Provider

### Password Validation
- [ ] **Password requirements enforced**
  ```typescript
  const isStrongPassword = (value: string) =>
    value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value)
  ```
  - Minimum 8 characters
  - At least one uppercase
  - At least one number
  - Consider: Special character requirement

### Timing Attacks
- [ ] **Consistent response time for valid/invalid users**
  ```typescript
  // DANGEROUS: Different paths leak user existence
  if (!usuario) {
    return null  // Fast path - user doesn't exist
  }
  const valid = await compare(password, usuario.senha)  // Slow path
  
  // BETTER: Always do password comparison
  const dummyHash = await hash("dummy", 12)
  const hashToCheck = usuario?.senha || dummyHash
  const valid = await compare(password, hashToCheck)
  ```

### Error Messages
- [ ] **Generic error messages prevent enumeration**
  ```typescript
  // DANGEROUS: Reveals user existence
  throw new Error("USER_NOT_FOUND")
  throw new Error("WRONG_PASSWORD")
  
  // SECURE: Generic message
  throw new Error("INVALID_CREDENTIALS")
  ```
  - Note: Current implementation uses specific errors - acceptable if rate limited

### First Login Flow
- [ ] **Password setting on first login is secure**
  ```typescript
  // Current pattern: User sets password on first login
  if (!usuario.senhaDefinida) {
    // Validate password strength
    // Hash and save
  }
  ```
  - Verify: Can't set password for another user
  - Verify: Password strength enforced

---

## JWT Security

### Token Contents
- [ ] **Minimal data in JWT**
  ```typescript
  // Current JWT payload
  token.id = user.id
  token.role = user.role
  token.membroId = user.membroId
  ```
  - Good: Only IDs, not sensitive data
  - Never include: passwords, email, PII

### Token Expiry
- [ ] **Reasonable session duration**
  - Default: Check NextAuth default (usually 30 days)
  - Consider: Shorter for admin sessions
  - Implement: Sliding sessions or refresh tokens

### Token Refresh
- [ ] **Role changes reflected in new tokens**
  - If user role changes, old JWT still has old role until expiry
  - Consider: Short-lived tokens + refresh mechanism

---

## Session Security

### Cookie Configuration
- [ ] **Secure cookie attributes**
  ```typescript
  // NextAuth v5 defaults (verify):
  // - httpOnly: true (not accessible via JS)
  // - secure: true in production (HTTPS only)
  // - sameSite: "lax" (CSRF protection)
  ```

### Cookie Names
- [ ] **Production uses secure prefix**
  - Development: `authjs.session-token`
  - Production: `__Secure-authjs.session-token`
  - Middleware handles both (check middleware.ts)

---

## Callbacks Security

### JWT Callback
- [ ] **User data properly validated before adding to token**
  ```typescript
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id
      token.role = user.role  // From DB, not user input
    }
    return token
  }
  ```

### Session Callback
- [ ] **Only safe data exposed to client**
  ```typescript
  async session({ session, token }) {
    session.user.id = token.id as string
    session.user.role = token.role as string
    // Never: session.user.password = ...
    return session
  }
  ```

---

## Password Reset Flow

### Token Generation
- [ ] **Cryptographically secure tokens**
  ```typescript
  const token = randomBytes(32).toString("hex")  // 256 bits entropy
  ```

### Token Storage
- [ ] **Token hashed before storage (optional but recommended)**
  ```typescript
  // Current: Stored as plaintext
  tokenReset: token
  
  // Better: Store hash
  tokenReset: await hash(token, 10)
  ```

### Token Expiry
- [ ] **Short expiry enforced**
  ```typescript
  tokenResetExpira: new Date(Date.now() + 60 * 60 * 1000)  // 1 hour
  ```
  - Verify: Expiry checked before use
  - Verify: Token invalidated after use

### Single Use
- [ ] **Token invalidated after password change**
  ```typescript
  await prisma.usuario.update({
    where: { id },
    data: {
      senha: newHashedPassword,
      tokenReset: null,           // Invalidate
      tokenResetExpira: null
    }
  })
  ```

---

## Email Verification

### Token Security
- [ ] **Verification token is single-use**
- [ ] **Token expires (24 hours typical)**
- [ ] **Token cleared after verification**

### Link Security
- [ ] **Verification link uses HTTPS**
  ```typescript
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ...
  // Ensure baseUrl is https:// in production
  ```

---

## Rate Limiting

### Login Attempts
- [ ] **Brute force protection on login**
  - Upstash ratelimit configured in `.env`
  - Applied to: `/api/auth/callback/credentials`
  - Current: Not implemented (HIGH priority finding)

### Password Reset
- [ ] **Rate limit password reset requests**
  - Prevent email bombing
  - Prevent token enumeration

### Registration
- [ ] **Rate limit registration**
  - Prevent spam accounts
  - Prevent enumeration via "email already exists"

---

## Account Security

### Account Lockout
- [ ] **Lockout after failed attempts (optional)**
  - Track failed attempts per user
  - Temporary lockout after N failures
  - Current: Not implemented

### Session Revocation
- [ ] **Ability to revoke all sessions**
  - For: Password change, suspected compromise
  - Implementation: Rotate NEXTAUTH_SECRET or use database sessions

---

## Third-Party Providers (if added)

### OAuth State
- [ ] **CSRF protection via state parameter**
  - NextAuth handles automatically

### Callback Validation
- [ ] **Redirect URIs strictly validated**
  - Only allow registered callback URLs

### Token Storage
- [ ] **Access tokens encrypted if stored**
  - For providers requiring offline access
