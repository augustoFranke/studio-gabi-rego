# Security Finding Template

Use this format for each vulnerability discovered.

---

## [SEVERITY] Finding Title

> Brief one-line description of the issue

### Severity: CRITICAL | HIGH | MEDIUM | LOW | INFO

### Category
- [ ] A01: Broken Access Control
- [ ] A02: Cryptographic Failures
- [ ] A03: Injection
- [ ] A04: Insecure Design
- [ ] A05: Security Misconfiguration
- [ ] A06: Vulnerable Components
- [ ] A07: Authentication Failures
- [ ] A08: Data Integrity Failures
- [ ] A09: Logging Failures
- [ ] A10: SSRF

---

### Location

**File:** `src/path/to/file.ts`  
**Line(s):** 42-48  
**Function/Handler:** `POST /api/example`

---

### Evidence

```typescript
// Paste the vulnerable code here
// Include enough context to understand the issue
```

---

### Risk Assessment

**Attack Vector:**  
How an attacker would exploit this vulnerability.

**Impact:**  
What damage could result (data breach, privilege escalation, etc.)

**Exploitability:**  
Easy / Moderate / Difficult - and why.

**Affected Data:**  
What sensitive data or functionality is at risk.

---

### Proof of Concept

```bash
# Example attack command or steps
curl -X POST https://example.com/api/vulnerable \
  -H "Content-Type: application/json" \
  -d '{"malicious": "payload"}'
```

---

### Recommended Fix

```typescript
// Secure implementation
// Show the corrected code
```

**Explanation:**  
Why this fix addresses the vulnerability.

---

### Verification Steps

1. Apply the fix
2. Run test case: `npm test -- --grep "security"`
3. Verify with: `curl -X POST ... (same as PoC, should fail)`
4. Check logs for proper error handling

---

### References

- [OWASP: Relevant Article](https://owasp.org/...)
- [CWE-XXX: Weakness Name](https://cwe.mitre.org/...)
- [Related CVE if applicable]

---

### Additional Notes

Any context, related findings, or temporary mitigations.

---

## Example Finding

---

## [HIGH] Missing Rate Limiting on Password Reset

> The password reset endpoint allows unlimited requests, enabling email bombing and token brute-force attacks.

### Severity: HIGH

### Category
- [x] A04: Insecure Design
- [x] A07: Authentication Failures

---

### Location

**File:** `src/app/api/auth/enviar-reset-senha/route.ts`  
**Line(s):** 8-45  
**Function/Handler:** `POST /api/auth/enviar-reset-senha`

---

### Evidence

```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body
    
    // No rate limiting check here!
    
    const usuario = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
    // ... sends email
  }
}
```

---

### Risk Assessment

**Attack Vector:**  
Attacker sends thousands of requests with victim's email, flooding their inbox or attempting to brute-force the reset token.

**Impact:**  
- Email bombing (DoS against user's inbox)
- Token enumeration (if tokens are short/predictable)
- Resource exhaustion (email service costs)

**Exploitability:** Easy  
No authentication required, simple HTTP POST.

**Affected Data:**  
User email addresses, reset tokens.

---

### Proof of Concept

```bash
# Email bomb attack
for i in {1..1000}; do
  curl -X POST https://example.com/api/auth/enviar-reset-senha \
    -H "Content-Type: application/json" \
    -d '{"email": "victim@example.com"}' &
done
```

---

### Recommended Fix

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),  // 3 requests per hour
  prefix: 'ratelimit:password-reset',
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous'
  const { success } = await ratelimit.limit(ip)
  
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429 }
    )
  }
  
  // ... rest of handler
}
```

---

### Verification Steps

1. Apply rate limiting code
2. Send 4 password reset requests in quick succession
3. Verify 4th request returns 429 status
4. Check Upstash dashboard for rate limit metrics

---

### References

- [OWASP: Blocking Brute Force Attacks](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)
- [CWE-307: Improper Restriction of Excessive Authentication Attempts](https://cwe.mitre.org/data/definitions/307.html)
