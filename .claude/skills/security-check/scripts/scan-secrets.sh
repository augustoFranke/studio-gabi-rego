#!/bin/bash
# scan-secrets.sh - Detect hardcoded secrets and exposed credentials
# Usage: ./scripts/scan-secrets.sh [path]

set -euo pipefail

TARGET_PATH="${1:-src/}"
FOUND_ISSUES=0

echo "==================================================="
echo "  SECRET SCANNER - Red Team Security Check"
echo "==================================================="
echo "Target: $TARGET_PATH"
echo "Date: $(date)"
echo "---------------------------------------------------"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

print_finding() {
    echo -e "${RED}[CRITICAL]${NC} $1"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

echo ""
echo "=== 1. Hardcoded API Keys & Tokens ==="
echo ""

# Generic API keys
if rg -i "(api[_-]?key|apikey)\s*[:=]\s*['\"][a-zA-Z0-9_-]{16,}['\"]" "$TARGET_PATH" --glob '!*.md' --glob '!*.example' --glob '!*.test.*' 2>/dev/null; then
    print_finding "Hardcoded API keys found"
else
    print_ok "No hardcoded API keys detected"
fi

# Generic secrets
if rg -i "secret\s*[:=]\s*['\"][a-zA-Z0-9_-]{16,}['\"]" "$TARGET_PATH" --glob '!*.md' --glob '!*.example' --glob '!*.test.*' 2>/dev/null; then
    print_finding "Hardcoded secrets found"
else
    print_ok "No hardcoded secrets detected"
fi

# Password patterns
if rg -i "(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{4,}['\"]" "$TARGET_PATH" --glob '!*.md' --glob '!*.example' --glob '!*.test.*' --glob '!*.schema.*' 2>/dev/null; then
    print_finding "Hardcoded passwords found"
else
    print_ok "No hardcoded passwords detected"
fi

echo ""
echo "=== 2. AWS Credentials ==="
echo ""

# AWS Access Key ID
if rg "(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}" "$TARGET_PATH" 2>/dev/null; then
    print_finding "AWS Access Key ID found"
else
    print_ok "No AWS credentials detected"
fi

echo ""
echo "=== 3. Private Keys ==="
echo ""

# RSA/EC/DSA Private Keys
if rg "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----" "$TARGET_PATH" 2>/dev/null; then
    print_finding "Private key found in source code"
else
    print_ok "No private keys detected"
fi

echo ""
echo "=== 4. JWT Tokens ==="
echo ""

# JWT tokens (base64.base64.signature pattern)
if rg "eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+" "$TARGET_PATH" --glob '!*.md' 2>/dev/null; then
    print_finding "Hardcoded JWT token found"
else
    print_ok "No hardcoded JWT tokens detected"
fi

echo ""
echo "=== 5. Database Connection Strings ==="
echo ""

# PostgreSQL with password
if rg "postgresql://[^:]+:[^@]+@" "$TARGET_PATH" --glob '!*.example' --glob '!*.md' 2>/dev/null; then
    print_finding "Database connection string with password found"
else
    print_ok "No exposed database credentials"
fi

# MongoDB
if rg "mongodb(\+srv)?://[^:]+:[^@]+@" "$TARGET_PATH" --glob '!*.example' --glob '!*.md' 2>/dev/null; then
    print_finding "MongoDB connection string with password found"
else
    print_ok "No MongoDB credentials exposed"
fi

echo ""
echo "=== 6. Environment File Security ==="
echo ""

# Check .gitignore for env files
if [ -f ".gitignore" ]; then
    if grep -q "^\.env$" .gitignore && grep -q "\.env\.production" .gitignore; then
        print_ok ".env and .env.production are gitignored"
    else
        print_warning ".env files may not be properly gitignored"
    fi
fi

# Check for .env files that might be tracked
if git ls-files --error-unmatch .env .env.production .env.local 2>/dev/null; then
    print_finding "Environment files are tracked in git!"
else
    print_ok "No .env files tracked in git"
fi

echo ""
echo "=== 7. NEXT_PUBLIC_ Exposure Check ==="
echo ""

# Check for sensitive values in NEXT_PUBLIC_ variables
if rg "NEXT_PUBLIC_.*(?i)(secret|password|key|token|database)" .env* --glob '!*.example' 2>/dev/null; then
    print_finding "Sensitive values may be exposed via NEXT_PUBLIC_"
else
    print_ok "No obvious sensitive data in NEXT_PUBLIC_ variables"
fi

echo ""
echo "=== 8. Console Logging Sensitive Data ==="
echo ""

# Console logging with sensitive keywords
if rg "console\.(log|info|debug|warn|error)\s*\([^)]*\b(password|senha|secret|token|key)\b" "$TARGET_PATH" --glob '!*.test.*' 2>/dev/null; then
    print_warning "Sensitive data may be logged to console"
else
    print_ok "No obvious sensitive data logging"
fi

echo ""
echo "=== 9. Resend/Email API Keys ==="
echo ""

if rg "re_[a-zA-Z0-9]{20,}" "$TARGET_PATH" --glob '!*.example' --glob '!*.md' 2>/dev/null; then
    print_finding "Resend API key found in source"
else
    print_ok "No Resend API keys in source"
fi

echo ""
echo "=== 10. Upstash/Redis Credentials ==="
echo ""

if rg "upstash\.io" "$TARGET_PATH" --glob '!*.example' --glob '!*.md' | rg -v "process\.env" 2>/dev/null; then
    print_warning "Upstash URL might be hardcoded"
else
    print_ok "Upstash credentials properly use env vars"
fi

echo ""
echo "==================================================="
echo "  SCAN COMPLETE"
echo "==================================================="
echo ""

if [ $FOUND_ISSUES -gt 0 ]; then
    echo -e "${RED}Found $FOUND_ISSUES critical issues!${NC}"
    exit 1
else
    echo -e "${GREEN}No critical secrets exposed.${NC}"
    exit 0
fi
