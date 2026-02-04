#!/bin/bash
# scan-auth-gaps.sh - Find unprotected API routes and auth bypasses
# Usage: ./scripts/scan-auth-gaps.sh [path]

set -euo pipefail

TARGET_PATH="${1:-src/app/api}"
FOUND_ISSUES=0

echo "==================================================="
echo "  AUTH GAP SCANNER - Red Team Security Check"
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
echo "=== 1. Finding All API Route Handlers ==="
echo ""

# Get all API route files
API_ROUTES=$(find "$TARGET_PATH" -name "route.ts" -type f 2>/dev/null || true)
TOTAL_ROUTES=$(echo "$API_ROUTES" | grep -c "route.ts" || echo "0")

print_info "Found $TOTAL_ROUTES API route files"

echo ""
echo "=== 2. Checking for Unprotected Routes ==="
echo ""

UNPROTECTED=0

for route in $API_ROUTES; do
    # Check if route has authentication
    if ! rg -q "withApiAuth|await auth\(\)|getServerSession" "$route" 2>/dev/null; then
        # Check if it's an intentionally public route
        if echo "$route" | grep -qE "(health|webhook|anamnese-token|verificar-email|cadastro|enviar-reset|redefinir-senha|validar-token|reenviar-verificacao|\[\.\.\.nextauth\])"; then
            print_info "Public route (expected): $route"
        else
            print_critical "UNPROTECTED ROUTE: $route"
            UNPROTECTED=$((UNPROTECTED + 1))
            
            # Show the handlers in this file
            echo "  Handlers found:"
            rg "export async function (GET|POST|PUT|PATCH|DELETE)" "$route" --no-line-number | head -5 | sed 's/^/    /'
            echo ""
        fi
    fi
done

if [ $UNPROTECTED -eq 0 ]; then
    print_ok "All sensitive routes are protected"
fi

echo ""
echo "=== 3. Checking Admin Routes Have Role Enforcement ==="
echo ""

# Routes that likely need ADMIN role
ADMIN_KEYWORDS="membros|planos|pagamentos|notificacoes|financeiro|horarios|configuracoes"

for route in $API_ROUTES; do
    if echo "$route" | grep -qE "$ADMIN_KEYWORDS"; then
        if rg -q "withApiAuth" "$route" 2>/dev/null; then
            if ! rg -q "requiredRole.*ADMIN" "$route" 2>/dev/null; then
                # Check if it's a route that members should access their own data
                if echo "$route" | grep -qE "minha-anamnese|perfil"; then
                    continue
                fi
                print_warning "Admin route without explicit role check: $route"
            fi
        fi
    fi
done

echo ""
echo "=== 4. Checking for IDOR Vulnerabilities ==="
echo ""

# Routes with [id] parameter should have ownership checks
ID_ROUTES=$(find "$TARGET_PATH" -path "*\[id\]*" -name "route.ts" 2>/dev/null || true)

for route in $ID_ROUTES; do
    if ! rg -q "ensureOwnerOrAdmin|membroId.*session\.user|session\.user.*membroId|requiredRole.*ADMIN" "$route" 2>/dev/null; then
        # Exclude routes that are admin-only anyway
        if ! rg -q "requiredRole.*ADMIN" "$route" 2>/dev/null; then
            print_high "Potential IDOR - no ownership check: $route"
        fi
    fi
done

echo ""
echo "=== 5. Checking Middleware Coverage ==="
echo ""

if [ -f "src/middleware.ts" ]; then
    print_info "Middleware found at src/middleware.ts"
    
    # Check matcher pattern
    echo "  Matcher pattern:"
    rg "matcher\s*:" src/middleware.ts -A 3 | head -5 | sed 's/^/    /'
    
    # Check for common bypasses
    MATCHER=$(rg "matcher" src/middleware.ts -A 5 2>/dev/null || true)
    
    if echo "$MATCHER" | grep -q "api"; then
        if ! echo "$MATCHER" | grep -q "api/auth"; then
            print_warning "API routes may not be covered by middleware"
        fi
    fi
    
    # Check for static file extension bypass
    if echo "$MATCHER" | grep -qE "\.\(png|svg|jpg|jpeg|gif|ico|webp\)"; then
        print_ok "Static file extensions excluded from auth"
    fi
else
    print_critical "No middleware.ts found!"
fi

echo ""
echo "=== 6. Checking Token Validation ==="
echo ""

# Check for proper token expiry validation
TOKEN_ROUTES=$(rg -l "token.*Expira|tokenExpira|tokenResetExpira" "$TARGET_PATH" 2>/dev/null || true)

for route in $TOKEN_ROUTES; do
    if rg -q "gt:\s*new Date\(\)|new Date\(\).*<" "$route" 2>/dev/null; then
        print_ok "Token expiry checked: $route"
    else
        print_warning "Token route may not validate expiry: $route"
    fi
done

echo ""
echo "=== 7. Checking Session Token Handling ==="
echo ""

# Middleware should handle both v4 and v5 cookie names
if [ -f "src/middleware.ts" ]; then
    if rg -q "authjs.session-token|next-auth.session-token" src/middleware.ts 2>/dev/null; then
        print_ok "Multiple session cookie names handled"
    else
        if rg -q "getToken" src/middleware.ts 2>/dev/null; then
            print_ok "Using getToken (handles cookie names automatically)"
        else
            print_warning "Session cookie name handling unclear"
        fi
    fi
fi

echo ""
echo "=== 8. Checking for Auth Bypass Patterns ==="
echo ""

# Check for early returns before auth
if rg -B5 "withApiAuth|await auth\(\)" "$TARGET_PATH" 2>/dev/null | rg -q "return.*Response|return.*NextResponse" 2>/dev/null; then
    print_warning "Found early returns before auth checks - verify intentional"
fi

# Check for optional auth that might be misused
if rg -q "requireAuth:\s*false" "$TARGET_PATH" 2>/dev/null; then
    print_info "Routes with optional auth found:"
    rg -l "requireAuth:\s*false" "$TARGET_PATH" | sed 's/^/  /'
fi

echo ""
echo "=== 9. Rate Limiting Check ==="
echo ""

AUTH_ENDPOINTS="cadastro|login|enviar-reset|redefinir-senha|verificar"

for route in $API_ROUTES; do
    if echo "$route" | grep -qiE "$AUTH_ENDPOINTS"; then
        if rg -q "ratelimit|Ratelimit|rate.?limit" "$route" 2>/dev/null; then
            print_ok "Rate limiting on: $route"
        else
            print_high "NO RATE LIMITING: $route"
        fi
    fi
done

echo ""
echo "=== 10. Summary ==="
echo ""

# Count protected vs total
PROTECTED=$(rg -l "withApiAuth|await auth\(\)" "$TARGET_PATH" 2>/dev/null | wc -l || echo "0")
PROTECTED=$(echo "$PROTECTED" | tr -d ' ')

echo "Total API routes: $TOTAL_ROUTES"
echo "Protected routes: $PROTECTED"
echo "Unprotected routes: $UNPROTECTED"

echo ""
echo "==================================================="
echo "  SCAN COMPLETE"
echo "==================================================="
echo ""

if [ $FOUND_ISSUES -gt 0 ]; then
    echo -e "${RED}Found $FOUND_ISSUES authentication issues!${NC}"
    exit 1
else
    echo -e "${GREEN}No critical auth gaps detected.${NC}"
    exit 0
fi
