# Next.js App Router Security Checklist

## Middleware Security

### Coverage Gaps
- [ ] **Matcher pattern excludes sensitive paths**
  - Check: Does the regex in `config.matcher` accidentally expose protected routes?
  - Risk: Auth bypass via unprotected paths
  - Look for: Static file extensions that could be spoofed, path traversal in matcher

```typescript
// DANGEROUS: Overly permissive matcher
matcher: ["/((?!api|_next|public).*)"]  // api routes unprotected!

// SECURE: Explicit protection
matcher: [
  "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|login|cadastro).*)",
]
```

### Token Validation
- [ ] **Multiple cookie name fallbacks handled**
  - NextAuth v5 uses `authjs.session-token` vs v4's `next-auth.session-token`
  - Production uses `__Secure-` prefix
  - Check both are handled in middleware

### Redirect Security
- [ ] **Open redirect prevention**
  - Validate redirect URLs are relative or on allowlist
  - Never trust user-supplied `callbackUrl` or `redirect` params

```typescript
// DANGEROUS
const redirectTo = request.nextUrl.searchParams.get("redirect")
return NextResponse.redirect(redirectTo)  // Open redirect!

// SECURE
const redirectTo = request.nextUrl.searchParams.get("redirect")
const url = new URL(redirectTo, request.url)
if (url.origin !== request.nextUrl.origin) {
  return NextResponse.redirect(new URL("/", request.url))
}
```

---

## API Routes (Route Handlers)

### Authentication Wrapper
- [ ] **Every route uses `withApiAuth()` or explicit `auth()` check**
  - Grep: `export async function (GET|POST|PUT|PATCH|DELETE)` without `withApiAuth`
  - Exception: Public routes (health, webhooks with signature verification)

### Role Enforcement
- [ ] **Admin-only routes specify `{ requiredRole: 'ADMIN' }`**
  - Check: Member management, financial data, system config
  - Risk: Privilege escalation if role check missing

### IDOR Prevention
- [ ] **Resource ownership verified before access**
  - Pattern: `if (session.user.role === 'MEMBRO' && resource.membroId !== session.user.membroId)`
  - Use: `ensureOwnerOrAdmin()` helper consistently

```typescript
// DANGEROUS: No ownership check
const membro = await prisma.membro.findUnique({ where: { id } })
return NextResponse.json(membro)  // Any authenticated user can access!

// SECURE: Ownership verified
const membro = await prisma.membro.findUnique({ where: { id } })
const ownerCheck = ensureOwnerOrAdmin(session, membro?.id)
if (ownerCheck) return ownerCheck
```

### Input Validation
- [ ] **All endpoints validate with Zod before processing**
  - Use: `validateRequest(request, schema)`
  - Never: Access `request.json()` directly without validation

### Response Filtering
- [ ] **Sensitive fields excluded from responses**
  - Never expose: `senha`, `tokenReset`, `tokenVerificacao`, `anamneseToken`
  - Use Prisma `select` to whitelist fields

```typescript
// DANGEROUS: Exposes password hash
const user = await prisma.usuario.findUnique({ where: { id } })
return NextResponse.json(user)

// SECURE: Explicit field selection
const user = await prisma.usuario.findUnique({
  where: { id },
  select: { id: true, email: true, nome: true, role: true }
})
```

---

## Server Components & RSC

### Data Fetching
- [ ] **Server Components don't leak sensitive data to client**
  - Check: Props passed to Client Components
  - Risk: Sensitive data serialized to HTML/RSC payload

### Server Actions
- [ ] **Server Actions validate authentication**
  - Every `"use server"` function should check `auth()`
  - Treat as API endpoints, not internal functions

```typescript
// DANGEROUS: No auth check in Server Action
"use server"
export async function deleteUser(id: string) {
  await prisma.usuario.delete({ where: { id } })  // Anyone can call!
}

// SECURE: Auth verified
"use server"
export async function deleteUser(id: string) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized")
  await prisma.usuario.delete({ where: { id } })
}
```

---

## Client-Side Security

### XSS Prevention
- [ ] **No `dangerouslySetInnerHTML` without sanitization**
  - Require: `DOMPurify.sanitize()` or `isomorphic-dompurify`
  - Check: User-generated content (observacoes, mensagem, etc.)

```typescript
// DANGEROUS
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// SECURE
import DOMPurify from "isomorphic-dompurify"
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

### Sensitive Data in State
- [ ] **Tokens not stored in localStorage**
  - Session tokens should only be in httpOnly cookies
  - Anamnese tokens OK in URL (one-time use, short expiry)

### Error Boundaries
- [ ] **Production errors don't leak stack traces**
  - Custom error pages should show generic messages
  - Stack traces only in development

---

## Headers & CORS

### Security Headers
- [ ] **next.config.ts includes security headers**

```typescript
// next.config.ts
headers: async () => [
  {
    source: "/:path*",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ],
  },
]
```

### CORS Configuration
- [ ] **API routes don't have overly permissive CORS**
  - Check for: `Access-Control-Allow-Origin: *`
  - Should be: Specific allowed origins or same-origin only

---

## File Uploads

### Validation
- [ ] **File type validated by content, not extension**
- [ ] **File size limits enforced server-side**
- [ ] **Uploaded files stored outside webroot or in blob storage**
- [ ] **Filenames sanitized (no path traversal)**

```typescript
// DANGEROUS: Trust user filename
const filename = file.name
await fs.writeFile(`/uploads/${filename}`, buffer)  // Path traversal!

// SECURE: Generate safe filename
const ext = path.extname(file.name).slice(0, 5)
const filename = `${crypto.randomUUID()}${ext}`
await fs.writeFile(`/uploads/${filename}`, buffer)
```

---

## Environment & Build

### Environment Variables
- [ ] **Client-exposed vars use `NEXT_PUBLIC_` prefix intentionally**
  - Audit: What's exposed to browser?
  - Risk: Secrets in `NEXT_PUBLIC_` are visible to everyone

### Source Maps
- [ ] **Production builds don't include source maps**
  - Check: `next.config.ts` doesn't have `productionBrowserSourceMaps: true`

### Build Output
- [ ] **`.next/` directory is gitignored**
- [ ] **No sensitive data in build logs**
