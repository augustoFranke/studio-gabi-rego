#!/bin/bash
# scan-injection.sh - Detect SQL injection, XSS, and command injection vectors
# Usage: ./scripts/scan-injection.sh [path]

set -euo pipefail

TARGET_PATH="${1:-src/}"
FOUND_ISSUES=0

echo "==================================================="
echo "  INJECTION SCANNER - Red Team Security Check"
echo "==================================================="
echo "Target: $TARGET_PATH"
echo "Date: $(date)"
echo "---------------------------------------------------"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_critical() {
    echo -e "${RED}[CRITICAL]${NC} $1"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
}

print_high() {
    echo -e "${RED}[HIGH]${NC} $1"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

echo ""
echo "=== 1. SQL Injection Checks ==="
echo ""

# $queryRawUnsafe - direct SQL injection risk
echo "Checking for \$queryRawUnsafe..."
if rg '\$queryRawUnsafe' "$TARGET_PATH" 2>/dev/null; then
    print_critical "\$queryRawUnsafe found - HIGH SQL injection risk!"
else
    print_ok "No \$queryRawUnsafe usage"
fi

# $queryRaw with parentheses instead of template literal
echo ""
echo "Checking for improper \$queryRaw usage..."
if rg '\$queryRaw\s*\(' "$TARGET_PATH" 2>/dev/null; then
    print_high "\$queryRaw with parentheses - not parameterized!"
else
    print_ok "No improper \$queryRaw usage"
fi

# String concatenation in queries
echo ""
echo "Checking for string concatenation in queries..."
if rg 'prisma\.\w+\.(findMany|findUnique|findFirst|create|update|delete|upsert).*\+\s*[\'"`]' "$TARGET_PATH" 2>/dev/null; then
    print_warning "Possible string concatenation in Prisma query"
else
    print_ok "No obvious string concatenation in queries"
fi

# Template literal in $executeRaw
echo ""
echo "Checking for safe \$queryRaw template literals..."
SAFE_RAW=$(rg '\$queryRaw`' "$TARGET_PATH" --count 2>/dev/null | tail -1 || echo "0")
if [ "$SAFE_RAW" != "0" ]; then
    print_info "Found $SAFE_RAW \$queryRaw template literals (safe if properly parameterized)"
fi

echo ""
echo "=== 2. XSS (Cross-Site Scripting) Checks ==="
echo ""

# dangerouslySetInnerHTML
echo "Checking for dangerouslySetInnerHTML..."
DANGEROUS_HTML=$(rg 'dangerouslySetInnerHTML' "$TARGET_PATH" --files-with-matches 2>/dev/null || true)

if [ -n "$DANGEROUS_HTML" ]; then
    for file in $DANGEROUS_HTML; do
        # Check if DOMPurify is used
        if rg -q "DOMPurify|sanitize" "$file" 2>/dev/null; then
            print_ok "dangerouslySetInnerHTML with sanitization: $file"
        else
            print_critical "dangerouslySetInnerHTML WITHOUT sanitization: $file"
            rg 'dangerouslySetInnerHTML' "$file" -B 2 -A 2 | head -10 | sed 's/^/  /'
        fi
    done
else
    print_ok "No dangerouslySetInnerHTML usage"
fi

# innerHTML direct assignment
echo ""
echo "Checking for innerHTML assignment..."
if rg '\.innerHTML\s*=' "$TARGET_PATH" 2>/dev/null; then
    print_high "Direct innerHTML assignment found"
else
    print_ok "No direct innerHTML assignments"
fi

# document.write
echo ""
echo "Checking for document.write..."
if rg 'document\.write' "$TARGET_PATH" 2>/dev/null; then
    print_high "document.write found - XSS risk"
else
    print_ok "No document.write usage"
fi

echo ""
echo "=== 3. Command Injection Checks ==="
echo ""

# eval() usage
echo "Checking for eval()..."
if rg 'eval\s*\(' "$TARGET_PATH" --glob '!*.config.*' --glob '!node_modules' 2>/dev/null; then
    print_critical "eval() found - code injection risk!"
else
    print_ok "No eval() usage"
fi

# new Function()
echo ""
echo "Checking for new Function()..."
if rg 'new\s+Function\s*\(' "$TARGET_PATH" 2>/dev/null; then
    print_high "new Function() found - code injection risk"
else
    print_ok "No new Function() usage"
fi

# child_process
echo ""
echo "Checking for child_process usage..."
if rg "require\s*\(\s*['\"]child_process['\"]|from\s+['\"]child_process['\"]" "$TARGET_PATH" 2>/dev/null; then
    print_warning "child_process imported - review for command injection"
    
    # Check for exec with user input
    if rg 'exec\s*\(' "$TARGET_PATH" 2>/dev/null; then
        print_high "exec() found - verify no user input in command"
    fi
else
    print_ok "No child_process usage"
fi

# Shell in spawn/execFile
echo ""
echo "Checking for shell: true in spawn..."
if rg "(spawn|execFile)\s*\([^)]*shell:\s*true" "$TARGET_PATH" 2>/dev/null; then
    print_high "Shell mode enabled in spawn/execFile - command injection risk"
else
    print_ok "No shell mode in spawn/execFile"
fi

echo ""
echo "=== 4. Path Traversal Checks ==="
echo ""

# File operations with user input
echo "Checking file operations..."
FILE_OPS=$(rg "(readFile|writeFile|unlink|rmdir|mkdir|createReadStream|createWriteStream)" "$TARGET_PATH" --files-with-matches 2>/dev/null || true)

if [ -n "$FILE_OPS" ]; then
    print_warning "File operations found - verify path sanitization:"
    echo "$FILE_OPS" | sed 's/^/  /'
    
    # Check for path.join with user input
    if rg "path\.(join|resolve).*\b(params|query|body|req)" "$TARGET_PATH" 2>/dev/null; then
        print_high "Path operations with possible user input"
    fi
else
    print_ok "No file system operations detected"
fi

echo ""
echo "=== 5. Input Validation Checks ==="
echo ""

# API routes without Zod validation
echo "Checking for unvalidated request.json()..."
API_ROUTES=$(rg "request\.json\(\)" "$TARGET_PATH" --files-with-matches 2>/dev/null || true)

for route in $API_ROUTES; do
    if ! rg -q "validateRequest|schema\.safeParse|schema\.parse" "$route" 2>/dev/null; then
        # Check if it's a test file
        if ! echo "$route" | grep -q "\.test\." 2>/dev/null; then
            print_warning "request.json() without Zod validation: $route"
        fi
    fi
done

# Check for Zod usage
ZOD_USAGE=$(rg "z\.(object|string|number|array|enum)" "$TARGET_PATH" --count 2>/dev/null | wc -l || echo "0")
print_info "Zod schema definitions found in $ZOD_USAGE files"

echo ""
echo "=== 6. URL/SSRF Checks ==="
echo ""

# Dynamic fetch with user input
echo "Checking for SSRF vectors..."
if rg "fetch\s*\(\s*(params|query|body|request|url)" "$TARGET_PATH" 2>/dev/null; then
    print_high "fetch() with possible user-controlled URL - SSRF risk"
else
    print_ok "No obvious SSRF vectors in fetch()"
fi

# Axios with user URL
if rg "axios\.(get|post|put|delete)\s*\(\s*(params|query|body)" "$TARGET_PATH" 2>/dev/null; then
    print_high "Axios with possible user-controlled URL"
else
    print_ok "No obvious SSRF in Axios"
fi

echo ""
echo "=== 7. Regex DoS (ReDoS) Checks ==="
echo ""

# Dangerous regex patterns
echo "Checking for potentially dangerous regex..."
if rg "new RegExp\s*\(" "$TARGET_PATH" 2>/dev/null; then
    print_warning "Dynamic RegExp found - check for user input"
fi

# Nested quantifiers (ReDoS pattern)
if rg "\(\.\*\)\+|\(\.\+\)\*|\(\.\+\)\+|\(\.\*\)\*" "$TARGET_PATH" 2>/dev/null; then
    print_warning "Potentially vulnerable regex pattern (nested quantifiers)"
else
    print_ok "No obvious ReDoS patterns"
fi

echo ""
echo "=== 8. Prototype Pollution Checks ==="
echo ""

# Object merge with user input
echo "Checking for prototype pollution vectors..."
if rg "Object\.(assign|merge)|\.\.\.body|\.\.\.data|\.\.\.params" "$TARGET_PATH" 2>/dev/null | rg -v "\.test\." 2>/dev/null | head -5; then
    print_warning "Object spread/merge found - verify not with raw user input"
else
    print_ok "No obvious prototype pollution vectors"
fi

echo ""
echo "=== 9. Mass Assignment Checks ==="
echo ""

# Prisma create/update with spread body
echo "Checking for mass assignment in Prisma..."
if rg "prisma\.\w+\.(create|update|upsert)\s*\(\s*\{[^}]*data:\s*\.\.\." "$TARGET_PATH" 2>/dev/null; then
    print_high "Prisma mutation with spread operator - mass assignment risk"
else
    print_ok "No obvious mass assignment in Prisma"
fi

if rg "prisma\.\w+\.(create|update|upsert)\s*\(\s*\{[^}]*data:\s*body" "$TARGET_PATH" 2>/dev/null; then
    print_high "Prisma mutation with raw body - mass assignment risk"
else
    print_ok "No raw body in Prisma mutations"
fi

echo ""
echo "=== 10. DOMPurify Verification ==="
echo ""

# Check if DOMPurify is installed
if rg '"(isomorphic-)?dompurify"' package.json 2>/dev/null; then
    print_ok "DOMPurify is installed"
else
    print_warning "DOMPurify not found in package.json"
fi

# Check usage
PURIFY_USAGE=$(rg "DOMPurify\.sanitize|sanitize\(" "$TARGET_PATH" --count 2>/dev/null | wc -l || echo "0")
print_info "DOMPurify.sanitize() used in $PURIFY_USAGE locations"

echo ""
echo "==================================================="
echo "  SCAN COMPLETE"
echo "==================================================="
echo ""

if [ $FOUND_ISSUES -gt 0 ]; then
    echo -e "${RED}Found $FOUND_ISSUES injection vulnerabilities!${NC}"
    exit 1
else
    echo -e "${GREEN}No critical injection vectors detected.${NC}"
    exit 0
fi
