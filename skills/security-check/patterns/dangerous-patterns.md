# Dangerous Patterns - Grep Reference

Use these patterns to scan for common vulnerabilities. Execute with `rg` (ripgrep) for best performance.

---

## SQL Injection Patterns

```bash
# Raw queries with string interpolation (HIGH risk)
rg '\$queryRawUnsafe' src/

# Template literals that might not be parameterized
rg '\$queryRaw\s*\(' src/  # Parentheses instead of template literal

# String concatenation in queries
rg "prisma\.\w+\.(findMany|findUnique|create|update|delete)\s*\(\s*\{[^}]*where:[^}]*\+" src/
```

---

## XSS Patterns

```bash
# dangerouslySetInnerHTML without sanitization
rg 'dangerouslySetInnerHTML' src/ -A 2 -B 2

# innerHTML assignment
rg '\.innerHTML\s*=' src/

# document.write
rg 'document\.write' src/

# eval and Function constructor
rg 'eval\s*\(|new\s+Function\s*\(' src/
```

---

## Authentication Gaps

```bash
# API routes - find all handlers
rg "export async function (GET|POST|PUT|PATCH|DELETE)" src/app/api --files-with-matches

# Routes without withApiAuth
rg "export async function (GET|POST|PUT|PATCH|DELETE)" src/app/api -l | \
  xargs -I {} sh -c 'rg -q "withApiAuth|auth\(\)" {} || echo "UNPROTECTED: {}"'

# Routes without role check (may need admin)
rg "withApiAuth\s*\(\s*async" src/app/api -A 1 | rg -v "requiredRole"
```

---

## Hardcoded Secrets

```bash
# API keys and tokens
rg -i "(api[_-]?key|apikey|secret|token|password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{8,}['\"]" \
  --glob '!*.md' --glob '!*.example' --glob '!node_modules'

# AWS credentials
rg "(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}" src/

# Private keys
rg "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----" src/

# JWT secrets
rg "eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\." src/

# Database connection strings with passwords
rg "postgresql://[^:]+:[^@]+@" src/ --glob '!*.example' --glob '!*.md'
```

---

## Insecure Randomness

```bash
# Math.random for security purposes
rg "Math\.random\s*\(\s*\)" src/ -B 3 -A 3 | rg -i "token|secret|key|password|id"

# Weak token generation
rg "Date\.now\(\)\.toString\(" src/

# UUID v1 (time-based, predictable)
rg "uuid\.v1\s*\(|uuidv1\s*\(" src/
```

---

## Sensitive Data Exposure

```bash
# Console logging sensitive data
rg "console\.(log|info|debug|warn)\s*\([^)]*\b(password|senha|token|secret|key)\b" src/

# Returning full user objects (may include password hash)
rg "NextResponse\.json\s*\(\s*user\s*\)" src/
rg "NextResponse\.json\s*\(\s*usuario\s*\)" src/

# No select clause (returns all fields)
rg "prisma\.\w+\.find(Unique|First|Many)\s*\(\s*\{[^}]*where:" src/ | rg -v "select:"
```

---

## Command Injection

```bash
# exec with string concatenation
rg "exec\s*\(" src/ -B 2 -A 2

# spawn/execFile with shell: true
rg "(spawn|execFile)\s*\([^)]*shell:\s*true" src/

# child_process usage
rg "require\s*\(\s*['\"]child_process['\"]" src/
rg "from\s+['\"]child_process['\"]" src/
```

---

## Path Traversal

```bash
# File operations with user input
rg "(readFile|writeFile|unlink|rmdir|mkdir)\s*\(" src/ -B 3

# Path join without sanitization
rg "path\.(join|resolve)\s*\([^)]*req" src/

# Direct file path from request
rg "(params|query|body)\.(file|path|name)" src/
```

---

## CORS/Headers Issues

```bash
# Wildcard CORS
rg "Access-Control-Allow-Origin.*\*" src/

# Missing security headers check
rg "X-Frame-Options|X-Content-Type-Options|Content-Security-Policy" next.config

# Exposed error details
rg "stack:|stackTrace:|error\.message" src/app/api
```

---

## Rate Limiting Gaps

```bash
# Auth endpoints without rate limiting
rg "api/(auth|login|register|reset|forgot)" src/ -l | \
  xargs -I {} sh -c 'rg -q "ratelimit|Ratelimit" {} || echo "NO RATE LIMIT: {}"'
```

---

## Mass Assignment

```bash
# Spreading request body into Prisma
rg "prisma\.\w+\.(create|update)\s*\(\s*\{[^}]*data:\s*\.\.\." src/
rg "prisma\.\w+\.(create|update)\s*\(\s*\{[^}]*data:\s*body" src/
rg "prisma\.\w+\.(create|update)\s*\(\s*\{[^}]*data:\s*data" src/ -B 5 | rg "request\.json"
```

---

## Token Handling

```bash
# Tokens in URLs (should use POST body or headers)
rg "searchParams\.get\s*\(['\"]token['\"]" src/

# Token logging
rg "console\.\w+\([^)]*token" src/

# Token in localStorage
rg "localStorage\.(setItem|getItem)\s*\([^)]*token" src/
```

---

## Session Security

```bash
# Session data exposure
rg "session\.(user|data)" src/ -A 3 | rg "return|json\("

# Cookie without secure flag
rg "Set-Cookie" src/ | rg -v "(Secure|HttpOnly|SameSite)"
```

---

## Quick Full Scan Command

```bash
#!/bin/bash
# Save as scan-all-patterns.sh

echo "=== SQL Injection ==="
rg '\$queryRawUnsafe' src/ || echo "None found"

echo -e "\n=== XSS Vectors ==="
rg 'dangerouslySetInnerHTML' src/ --files-with-matches || echo "None found"

echo -e "\n=== Hardcoded Secrets ==="
rg -i "(api[_-]?key|secret|password)\s*[:=]\s*['\"][^'\"]+['\"]" src/ \
  --glob '!*.md' --glob '!*.example' || echo "None found"

echo -e "\n=== Insecure Random ==="
rg "Math\.random" src/ --files-with-matches || echo "None found"

echo -e "\n=== eval() Usage ==="
rg 'eval\s*\(' src/ || echo "None found"

echo -e "\n=== Unprotected Routes ==="
for f in $(rg -l "export async function (GET|POST|PUT|PATCH|DELETE)" src/app/api/); do
  rg -q "withApiAuth|auth\(\)" "$f" || echo "UNPROTECTED: $f"
done
```
