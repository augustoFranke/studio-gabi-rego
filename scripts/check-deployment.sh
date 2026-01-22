#!/bin/bash

# Deployment Health Check Script for Gabi-Studio
# Usage: ./scripts/check-deployment.sh [domain]

# Configuration
DOMAIN="${1:-studiogabirego.com}"
BASE_URL="https://${DOMAIN}"
TIMEOUT=10

# Cross-platform millisecond timing
get_time_ms() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS: use perl for milliseconds
        perl -MTime::HiRes=time -e 'printf "%.0f\n", time * 1000'
    else
        # Linux: use date with nanoseconds
        echo $(($(date +%s%N) / 1000000))
    fi
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Print functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is required but not installed.${NC}"
    exit 1
fi

# Check if jq is available (optional, for JSON parsing)
HAS_JQ=false
if command -v jq &> /dev/null; then
    HAS_JQ=true
fi

print_header "Gabi-Studio Deployment Health Check"
echo -e "Target: ${BLUE}${BASE_URL}${NC}"
echo -e "Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ============================================
# Phase 1: Health Endpoint Check
# ============================================
print_header "Phase 1: Health Endpoint"

print_check "Testing /api/health endpoint..."

HEALTH_START=$(get_time_ms)
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "${BASE_URL}/api/health" 2>/dev/null) || true
HEALTH_END=$(get_time_ms)
HEALTH_TIME=$((HEALTH_END - HEALTH_START))

HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HEALTH_CODE" = "200" ]; then
    print_pass "Health endpoint returned 200 OK (${HEALTH_TIME}ms)"

    if [ "$HAS_JQ" = true ]; then
        STATUS=$(echo "$HEALTH_BODY" | jq -r '.status' 2>/dev/null)
        DB_STATUS=$(echo "$HEALTH_BODY" | jq -r '.services.database' 2>/dev/null)
        APP_STATUS=$(echo "$HEALTH_BODY" | jq -r '.services.app' 2>/dev/null)

        if [ "$STATUS" = "healthy" ]; then
            print_pass "Status: healthy"
        else
            print_fail "Status: $STATUS"
        fi

        if [ "$DB_STATUS" = "connected" ]; then
            print_pass "Database: connected"
        else
            print_fail "Database: $DB_STATUS"
        fi

        if [ "$APP_STATUS" = "running" ]; then
            print_pass "App: running"
        else
            print_fail "App: $APP_STATUS"
        fi
    else
        print_info "Install jq for detailed JSON parsing"
        echo "$HEALTH_BODY"
    fi
elif [ "$HEALTH_CODE" = "503" ]; then
    print_fail "Health endpoint returned 503 Service Unavailable"
    print_fail "Database connection likely failed"
    if [ "$HAS_JQ" = true ]; then
        ERROR=$(echo "$HEALTH_BODY" | jq -r '.error' 2>/dev/null)
        print_info "Error: $ERROR"
    fi
elif [ -z "$HEALTH_CODE" ]; then
    print_fail "Health endpoint timed out or unreachable"
else
    print_fail "Health endpoint returned $HEALTH_CODE"
fi

# ============================================
# Phase 2: Critical Routes Check
# ============================================
print_header "Phase 2: Critical Routes"

check_route() {
    local path="$1"
    local name="$2"
    local expected_code="${3:-200}"

    print_check "Testing $name ($path)..."

    START=$(get_time_ms)
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "${BASE_URL}${path}" 2>/dev/null) || RESPONSE="000"
    END=$(get_time_ms)
    TIME=$((END - START))

    if [ "$RESPONSE" = "$expected_code" ]; then
        print_pass "$name returned $RESPONSE (${TIME}ms)"

        # Warn if response time is slow
        if [ "$TIME" -gt 3000 ]; then
            print_warn "Response time > 3s (possible cold start)"
        fi
    elif [ "$RESPONSE" = "000" ]; then
        print_fail "$name timed out or unreachable"
    elif [ "$RESPONSE" = "307" ] || [ "$RESPONSE" = "308" ]; then
        print_pass "$name returned redirect $RESPONSE (${TIME}ms)"
    else
        print_fail "$name returned $RESPONSE (expected $expected_code)"
    fi
}

# Public routes (no auth required)
check_route "/" "Homepage"
check_route "/login" "Login page"

# API routes (may require auth, expecting various responses)
check_route "/api/health" "Health API" "200"

# These may return 401/403 without auth, which is expected
print_info "Note: Protected API routes may return 401/403 without authentication"

# ============================================
# Phase 3: Response Time Summary
# ============================================
print_header "Phase 3: Performance Check"

print_check "Measuring average response time..."

TOTAL_TIME=0
SAMPLES=3

for i in $(seq 1 $SAMPLES); do
    START=$(get_time_ms)
    curl -s -o /dev/null --max-time $TIMEOUT "${BASE_URL}/api/health" 2>/dev/null || true
    END=$(get_time_ms)
    TIME=$((END - START))
    TOTAL_TIME=$((TOTAL_TIME + TIME))
done

AVG_TIME=$((TOTAL_TIME / SAMPLES))

if [ "$AVG_TIME" -lt 500 ]; then
    print_pass "Average response time: ${AVG_TIME}ms (excellent)"
elif [ "$AVG_TIME" -lt 1000 ]; then
    print_pass "Average response time: ${AVG_TIME}ms (good)"
elif [ "$AVG_TIME" -lt 3000 ]; then
    print_warn "Average response time: ${AVG_TIME}ms (slow)"
else
    print_fail "Average response time: ${AVG_TIME}ms (very slow)"
fi

# ============================================
# Summary
# ============================================
print_header "Summary"

echo -e "Passed:   ${GREEN}${PASSED}${NC}"
echo -e "Failed:   ${RED}${FAILED}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}Deployment has issues that need attention!${NC}"
    echo -e "See DEPLOYMENT_MONITORING.md for troubleshooting steps."
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}Deployment is working but has some warnings.${NC}"
    exit 0
else
    echo -e "${GREEN}Deployment is healthy!${NC}"
    exit 0
fi
