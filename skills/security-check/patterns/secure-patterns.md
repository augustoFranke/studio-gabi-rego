# Secure Patterns - Validation Reference

These patterns should be present in a secure codebase. Use to verify security controls are in place.

---

## Authentication Patterns

### API Route Protection
Every API route should have one of these patterns:

```typescript
// Pattern 1: withApiAuth wrapper (preferred)
export async function GET(request: NextRequest) {
  return withApiAuth(async (session) => {
    // Handler logic
  })
}

// Pattern 2: withApiAuth with role requirement
export async function POST(request: NextRequest) {
  return withApiAuth(async (session) => {
    // Handler logic
  }, { requiredRole: 'ADMIN' })
}

// Pattern 3: Explicit auth check (for complex flows)
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  // Handler logic
}
```

**Verification:**
```bash
# Count protected routes
rg "withApiAuth|await auth\(\)" src/app/api --files-with-matches | wc -l

# Count total routes
rg "export async function (GET|POST|PUT|PATCH|DELETE)" src/app/api --files-with-matches | wc -l

# These numbers should match (minus intentionally public routes)
```

---

## Input Validation Patterns

### Zod Schema Validation
```typescript
// Pattern: validateRequest with Zod schema
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const validation = await validateRequest(request, mySchema)
    if ('error' in validation) {
      return validation.error
    }
    const { field1, field2 } = validation.data
    // Use validated data only
  })
}
```

**Verification:**
```bash
# Routes using validateRequest
rg "validateRequest\s*\(" src/app/api --files-with-matches | wc -l

# Routes parsing JSON directly (potential issue)
rg "request\.json\(\)" src/app/api -l | \
  xargs -I {} sh -c 'rg -q "validateRequest" {} || echo "RAW JSON: {}"'
```

---

## IDOR Prevention Patterns

### Ownership Verification
```typescript
// Pattern: ensureOwnerOrAdmin helper
const ownerCheck = ensureOwnerOrAdmin(session, resource?.membroId)
if (ownerCheck) return ownerCheck

// Pattern: Inline check
if (session.user.role === 'MEMBRO' && resource.membroId !== session.user.membroId) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
}

// Pattern: Query scoping for members
if (session.user.role === 'MEMBRO' && session.user.membroId) {
  where.membroId = session.user.membroId
}
```

**Verification:**
```bash
# Routes with ownership checks
rg "ensureOwnerOrAdmin|membroId.*session|session.*membroId" src/app/api --files-with-matches
```

---

## Password Security Patterns

### Hashing
```typescript
// Pattern: bcrypt with cost >= 12
import { hash, compare } from 'bcryptjs'

const hashedPassword = await hash(password, 12)
const isValid = await compare(inputPassword, storedHash)
```

**Verification:**
```bash
# Check hash cost factor
rg "hash\s*\([^,]+,\s*(\d+)" src/ -o
# Should show 12 or higher
```

### Strength Validation
```typescript
// Pattern: Password requirements
const isStrongPassword = (value: string) =>
  value.length >= 8 && 
  /[A-Z]/.test(value) && 
  /[0-9]/.test(value)
```

**Verification:**
```bash
rg "length\s*>=\s*8|\.length\s*<\s*8" src/
rg "/\[A-Z\]/" src/
```

---

## Token Security Patterns

### Cryptographic Generation
```typescript
// Pattern: crypto.randomBytes for tokens
import { randomBytes } from 'crypto'

const token = randomBytes(32).toString('hex')  // 256 bits
const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
```

**Verification:**
```bash
# Token generation uses randomBytes
rg "randomBytes\s*\(\s*32\s*\)" src/

# No Math.random for tokens
rg "Math\.random" src/ | rg -i "token" && echo "WARNING: Math.random used for tokens"
```

### Expiry Enforcement
```typescript
// Pattern: Token expiry check
const isExpired = token.expiresAt < new Date()
if (isExpired) {
  return NextResponse.json({ error: 'Token expirado' }, { status: 401 })
}

// Or in Prisma query
const user = await prisma.usuario.findFirst({
  where: {
    tokenReset: token,
    tokenResetExpira: { gt: new Date() }  // Not expired
  }
})
```

**Verification:**
```bash
rg "tokenExpira|tokenResetExpira|Expira.*gt.*new Date|new Date.*Expira" src/
```

---

## Database Security Patterns

### Parameterized Queries
```typescript
// Pattern: Prisma template literals (auto-parameterized)
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`

// Pattern: Prisma ORM methods (always safe)
const user = await prisma.usuario.findUnique({
  where: { email }
})
```

**Verification:**
```bash
# No $queryRawUnsafe
rg '\$queryRawUnsafe' src/ && echo "DANGER: Raw unsafe query found"

# Template literals used correctly
rg '\$queryRaw`' src/
```

### Field Selection
```typescript
// Pattern: Explicit select to exclude sensitive fields
const user = await prisma.usuario.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    nome: true,
    role: true,
    // senha excluded
    // tokenReset excluded
  }
})
```

**Verification:**
```bash
# Check for select usage in user queries
rg "prisma\.usuario\.find" src/ -A 5 | rg "select:"
```

---

## XSS Prevention Patterns

### HTML Sanitization
```typescript
// Pattern: DOMPurify for user content
import DOMPurify from 'isomorphic-dompurify'

<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(userContent) 
}} />
```

**Verification:**
```bash
# dangerouslySetInnerHTML with DOMPurify
rg "dangerouslySetInnerHTML" src/ -B 2 -A 2 | rg "DOMPurify|sanitize"
```

---

## Session Security Patterns

### Middleware Protection
```typescript
// Pattern: Comprehensive middleware matcher
export const config = {
  matcher: [
    '/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|login|cadastro|verificar-email).*)',
  ],
}
```

### Secure Cookie Handling
```typescript
// Pattern: NextAuth handles this, but verify config
// Production cookies should have:
// - __Secure- prefix
// - HttpOnly
// - Secure
// - SameSite=Lax or Strict
```

**Verification:**
```bash
# Check middleware matcher
rg "matcher\s*:" src/middleware.ts -A 5
```

---

## Error Handling Patterns

### Safe Error Responses
```typescript
// Pattern: Generic error messages
return NextResponse.json(
  { error: 'Erro interno do servidor' },
  { status: 500 }
)

// Pattern: Error logging without exposure
console.error('API Error:', error)
return NextResponse.json(
  { error: 'Operação falhou' },  // Generic to user
  { status: 500 }
)
```

**Verification:**
```bash
# No stack traces in responses
rg "NextResponse\.json.*stack|NextResponse\.json.*error\.message" src/app/api
```

---

## Environment Security Patterns

### Gitignore Coverage
```
# .gitignore should include:
.env
.env.local
.env.production
.env.*.local
```

### Safe Public Variables
```bash
# Only safe values exposed to client
NEXT_PUBLIC_APP_URL=https://example.com
# Never secrets with NEXT_PUBLIC_ prefix
```

**Verification:**
```bash
# Check what's exposed
rg "NEXT_PUBLIC_" .env* --glob '!*.example'

# These should be safe (URLs, feature flags)
# Never: keys, secrets, database URLs
```

---

## Summary Verification Script

```bash
#!/bin/bash
echo "=== Security Pattern Verification ==="

echo -e "\n[1] Auth Protection"
protected=$(rg "withApiAuth|await auth\(\)" src/app/api --files-with-matches | wc -l)
total=$(rg "export async function (GET|POST|PUT|PATCH|DELETE)" src/app/api --files-with-matches | wc -l)
echo "Protected routes: $protected / $total"

echo -e "\n[2] Input Validation"
validated=$(rg "validateRequest" src/app/api --files-with-matches | wc -l)
echo "Routes using validateRequest: $validated"

echo -e "\n[3] Password Hashing"
rg "hash\s*\([^,]+,\s*\d+" src/lib/auth.ts -o || echo "Pattern not found"

echo -e "\n[4] Token Generation"
rg "randomBytes\s*\(\s*32" src/ --files-with-matches | wc -l
echo "files using randomBytes(32)"

echo -e "\n[5] Sensitive Fields"
rg "select:" src/app/api --files-with-matches | wc -l
echo "routes with explicit field selection"

echo -e "\n[6] No Raw SQL"
rg '\$queryRawUnsafe' src/ && echo "FAIL: Raw unsafe queries found" || echo "PASS: No unsafe queries"
```
