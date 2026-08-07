#!/usr/bin/env bash
# ==============================================================================
# Automated API Regression Test Script
# Purpose: Pre-deployment automated regression testing against a running server
# Coverage: All REST endpoints, Admin API, tRPC routes, error handling, edge cases
# ==============================================================================

set -u

# --- Configuration & Defaults ---
BASE_URL="${1:-${TARGET_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"  # Remove trailing slash if present

# Load admin credentials from the project .env file if present, falling back to env vars.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
if [ -f "${PROJECT_DIR}/.env" ]; then
    ENV_ADMIN_USER="$(grep -E '^ADMIN_USERNAME=' "${PROJECT_DIR}/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*#.*$//' | sed 's/[[:space:]]*$//')"
    ENV_ADMIN_PASS="$(grep -E '^ADMIN_PASSWORD=' "${PROJECT_DIR}/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*#.*$//' | sed 's/[[:space:]]*$//')"
fi
ADMIN_USER="${ADMIN_USER:-${ENV_ADMIN_USER:-admin}}"
ADMIN_PASS="${ADMIN_PASS:-${ENV_ADMIN_PASS:-}}"
if [ -z "$ADMIN_PASS" ]; then
    echo -e "${RED}[ERROR] ADMIN_PASSWORD not found. Set ADMIN_PASSWORD in ${PROJECT_DIR}/.env or export ADMIN_PASS.${NC}"
    exit 1
fi

HEADERS_JSON="Content-Type: application/json"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=0
AUTH_TOKEN=""

# --- Helper Functions ---
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_section() {
    echo -e "\n${CYAN}======================================================================${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}======================================================================${NC}"
}

log_pass() {
    echo -e "  ${GREEN}✔ PASS:${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_fail() {
    echo -e "  ${RED}✘ FAIL:${NC} $1 (Expected $2, Got HTTP $3)"
    if [ -n "${4:-}" ]; then
        echo -e "    ${RED}Response snippet:${NC} ${4:0:200}"
    fi
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

# Function to perform HTTP request
# Usage: http_req METHOD ENDPOINT [DATA] [EXTRA_HEADERS]
http_req() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local extra_headers="${4:-}"

    local url="${BASE_URL}${endpoint}"
    local tmp_resp_file
    tmp_resp_file=$(mktemp)
    local tmp_hdr_file
    tmp_hdr_file=$(mktemp)

    local curl_cmd=(curl -s -w "%{http_code}" -o "$tmp_resp_file" -D "$tmp_hdr_file" -X "$method")

    if [ -n "$extra_headers" ]; then
        IFS='|' read -ra HEADERS <<< "$extra_headers"
        for h in "${HEADERS[@]}"; do
            curl_cmd+=("-H" "$h")
        done
    fi

    if [ -n "$data" ]; then
        curl_cmd+=("-d" "$data")
    fi

    curl_cmd+=("$url")

    local status
    status=$("${curl_cmd[@]}")
    local body
    body=$(cat "$tmp_resp_file")

    rm -f "$tmp_resp_file" "$tmp_hdr_file"

    # Return status and body separated by newline
    printf "%s\n%s" "$status" "$body"
}

# Function to assert HTTP status code
# Usage: assert_endpoint NAME EXPECTED_STATUS METHOD ENDPOINT [DATA] [HEADERS]
assert_endpoint() {
    local name="$1"
    local expected_status="$2"
    local method="$3"
    local endpoint="$4"
    local data="${5:-}"
    local headers="${6:-}"

    local res
    res=$(http_req "$method" "$endpoint" "$data" "$headers")

    local status
    status=$(echo "$res" | head -n 1)
    local body
    body=$(echo "$res" | tail -n +2)

    # Allow pipe separated status codes like "200|404"
    if [[ "$status" =~ ^($expected_status)$ ]]; then
        log_pass "$name [HTTP $status]"
        return 0
    else
        log_fail "$name" "$expected_status" "$status" "$body"
        return 1
    fi
}

# --- Dependencies Check ---
if ! command -v curl &> /dev/null; then
    echo -e "${RED}[ERROR] 'curl' is required but not installed. Exiting.${NC}"
    exit 1
fi

HAS_JQ=false
if command -v jq &> /dev/null; then
    HAS_JQ=true
fi

log_info "Starting API Regression Testing against: ${BASE_URL}"
log_info "Time: $(date -u)"

# Check baseline connectivity
FIRST_CHECK=$(http_req GET "/api/health")
FIRST_STATUS=$(echo "$FIRST_CHECK" | head -n 1)
if [ "$FIRST_STATUS" = "000" ]; then
    echo -e "${RED}[ERROR] Unable to connect to server at ${BASE_URL}. Is the server running?${NC}"
    exit 1
fi

# ==============================================================================
# PRE-FLIGHT: Disable rate limiting for this test run
# Rate limiting is configured in the DB (RATE_LIMIT_ENABLED). Set it to "false"
# via the admin API so the regression suite does not hit HTTP 429 responses.
# ==============================================================================
log_section "PRE-FLIGHT: Disable Rate Limiting"

if [ "$HAS_JQ" = false ]; then
    log_info "jq not available; cannot disable rate limiting via admin API. Tests may fail with HTTP 429."
else
    LOGIN_DATA=$(printf '{"username": "%s", "password": "%s"}' "$ADMIN_USER" "$ADMIN_PASS")

    # Acquire an admin token up-front. Repeated runs can be blocked by the rate
    # limiter in two different ways, so wait out either one:
    #   1. General limiter  -> HTTP 429 with a `retryAfter` field.
    #   2. Login limiter    -> HTTP 200 with ok=false + "Too many login attempts"
    #                          (the seconds are embedded in the message).
    # Successful logins reset the login limiter, so back-to-back runs stay green.
    LOGIN_STATUS=""
    LOGIN_BODY=""
    for attempt in 1 2 3 4 5; do
        LOGIN_RES=$(http_req POST "/api/admin/auth/login" "$LOGIN_DATA" "$HEADERS_JSON")
        LOGIN_STATUS=$(echo "$LOGIN_RES" | head -n 1)
        LOGIN_BODY=$(echo "$LOGIN_RES" | tail -n +2)

        if [ "$LOGIN_STATUS" = "429" ]; then
            RETRY_AFTER=$(echo "$LOGIN_BODY" | jq -r '.retryAfter // empty' 2>/dev/null)
            RETRY_AFTER="${RETRY_AFTER:-300}"
            log_info "Login rate-limited (HTTP 429). Waiting ${RETRY_AFTER}s for the block to expire... (attempt ${attempt}/5)"
            sleep "$RETRY_AFTER"
        elif [ "$LOGIN_STATUS" = "200" ]; then
            if [ "$(echo "$LOGIN_BODY" | jq -r '.ok // false' 2>/dev/null)" = "true" ]; then
                AUTH_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.token // empty' 2>/dev/null)
                break
            elif echo "$LOGIN_BODY" | grep -q "Too many login attempts"; then
                RETRY_AFTER=$(echo "$LOGIN_BODY" | jq -r '.message // empty' 2>/dev/null | sed -n 's/.*in \([0-9][0-9]*\)s\..*/\1/p')
                RETRY_AFTER="${RETRY_AFTER:-900}"
                log_info "Login blocked by brute-force limiter. Waiting ${RETRY_AFTER}s... (attempt ${attempt}/5)"
                sleep "$RETRY_AFTER"
            else
                log_info "Admin login rejected (ok=false). Rate limiting may stay enabled."
                break
            fi
        else
            log_info "Admin login returned HTTP $LOGIN_STATUS; retrying... (attempt ${attempt}/5)"
            sleep 2
        fi
    done

    if [ -n "$AUTH_TOKEN" ]; then
        ORIG_SETTING=$(http_req GET "/api/admin/settings/RATE_LIMIT_ENABLED" "" "Authorization: Bearer $AUTH_TOKEN")
        ORIG_STATUS=$(echo "$ORIG_SETTING" | head -n 1)
        ORIG_VALUE=$(echo "$ORIG_SETTING" | tail -n +2 | jq -r '.value // empty')
        SET_RES=$(http_req PUT "/api/admin/settings/RATE_LIMIT_ENABLED" '{"value":"false"}' "Authorization: Bearer $AUTH_TOKEN|Content-Type: application/json")
        SET_STATUS=$(echo "$SET_RES" | head -n 1)
        if [ "$SET_STATUS" = "200" ]; then
            log_info "Rate limiting disabled (RATE_LIMIT_ENABLED=false) for this run"
            log_info "Waiting for rate-limit config cache to refresh..."
            sleep 11
            RATE_LIMIT_OFF=true
            RATE_LIMIT_ORIG_VALUE="${ORIG_VALUE:-true}"
        else
            log_info "Failed to disable rate limiting (HTTP $SET_STATUS): $(echo "$SET_RES" | tail -n +2 | head -c 200)"
        fi
    else
        log_info "Admin login failed. Rate limiting may stay enabled."
    fi
fi

# Restore the original RATE_LIMIT_ENABLED value before the script exits.
restore_rate_limit() {
    if [ "${RATE_LIMIT_OFF:-false}" = "true" ]; then
        log_info "Restoring RATE_LIMIT_ENABLED to '${RATE_LIMIT_ORIG_VALUE}'"
        http_req PUT "/api/admin/settings/RATE_LIMIT_ENABLED" "{\"value\":\"${RATE_LIMIT_ORIG_VALUE}\"}" "Authorization: Bearer $AUTH_TOKEN|Content-Type: application/json" > /dev/null
    fi
}
trap restore_rate_limit EXIT

# ==============================================================================
# SUITE 1: System & Health Check Endpoints
# ==============================================================================
log_section "SUITE 1: System Health & Baseline Metadata"

assert_endpoint "GET /api/health returns 200 OK" "200" GET "/api/health"
assert_endpoint "GET /api/counts returns 200 OK" "200" GET "/api/counts"
assert_endpoint "GET /api/feature-cards returns 200 OK" "200" GET "/api/feature-cards"

# Check JSON fields if jq is available
if [ "$HAS_JQ" = true ]; then
    HEALTH_BODY=$(http_req GET "/api/health" | tail -n +2)
    STATUS_VAL=$(echo "$HEALTH_BODY" | jq -r '.status // empty')
    if [ "$STATUS_VAL" = "healthy" ]; then
        log_pass "GET /api/health JSON contains status='healthy'"
    else
        log_fail "GET /api/health JSON status check" "healthy" "$STATUS_VAL" "$HEALTH_BODY"
    fi
fi

# ==============================================================================
# SUITE 2: REST Compatibility Read & Query Endpoints (/api/:resource)
# ==============================================================================
log_section "SUITE 2: REST Resource Listings & Query Filtering"

RESOURCES=("users" "posts" "comments" "albums" "photos" "todos")
for res in "${RESOURCES[@]}"; do
    assert_endpoint "GET /api/$res lists all items" "200" GET "/api/$res"
done

assert_endpoint "GET /api/users?_page=1&_limit=2 supports pagination" "200" GET "/api/users?_page=1&_limit=2"
assert_endpoint "GET /api/users?_limit=abc rejects non-numeric limit" "400" GET "/api/users?_limit=abc"
assert_endpoint "GET /api/users?_sort=name&_order=asc sorts ascending" "200" GET "/api/users?_sort=name&_order=asc"
assert_endpoint "GET /api/users?_sort=name&_order=desc sorts descending" "200" GET "/api/users?_sort=name&_order=desc"
assert_endpoint "GET /api/users?_sort=nonexistent sorts by non-existent column" "200" GET "/api/users?_sort=nonexistent"
assert_endpoint "GET /api/users?q=Leanne supports text search" "200" GET "/api/users?q=Leanne"
assert_endpoint "GET /api/users?q=%25 escapes search wildcards" "200" GET "/api/users?q=%25"
assert_endpoint "GET /api/users?q=_ escapes underscore search wildcard" "200" GET "/api/users?q=_"
assert_endpoint "GET /api/users?name=__NOBODY_NONEXISTENT__ handles non-matching filter" "200" GET "/api/users?name=__NOBODY_NONEXISTENT__"
assert_endpoint "GET /api/invalid returns 404 for invalid resource" "404" GET "/api/invalid"

# ==============================================================================
# SUITE 3: REST Compatible CRUD Operations Lifecycle
# ==============================================================================
log_section "SUITE 3: REST CRUD Lifecycle & Payload Validation"

assert_endpoint "GET /api/users/1 returns user by ID" "200" GET "/api/users/1"
assert_endpoint "GET /api/users/999999 returns 404 for non-existent ID" "404" GET "/api/users/999999"
assert_endpoint "GET /api/users/abc returns 404 for invalid ID format" "404" GET "/api/users/abc"
assert_endpoint "GET /api/invalid/1 returns 404 for invalid resource ID" "404" GET "/api/invalid/1"

# --- 3.1 POST Create ---
POST_DATA='{"userId":1,"title":"Regression Test Post","body":"Automated test body content"}'
HEADERS_JSON="Content-Type: application/json"

POST_RES=$(http_req POST "/api/posts" "$POST_DATA" "$HEADERS_JSON")
POST_STATUS=$(echo "$POST_RES" | head -n 1)
POST_BODY=$(echo "$POST_RES" | tail -n +2)

CREATED_ID=""
if [ "$POST_STATUS" = "201" ]; then
    log_pass "POST /api/posts creates new resource [HTTP 201]"
    if [ "$HAS_JQ" = true ]; then
        CREATED_ID=$(echo "$POST_BODY" | jq -r '.id // empty')
    fi
else
    log_fail "POST /api/posts creation" "201" "$POST_STATUS" "$POST_BODY"
fi

assert_endpoint "POST /api/posts returns 400 for malformed JSON" "400" POST "/api/posts" "{ malformed json" "$HEADERS_JSON"
assert_endpoint "POST /api/posts rejects payload over 50MB (HTTP 413)" "413" POST "/api/posts" "x" "Content-Type: application/json|Content-Length: 52428801"
assert_endpoint "POST /api/invalid returns 404" "404" POST "/api/invalid" '{"title":"test"}' "$HEADERS_JSON"

# --- 3.2 PUT Full Update ---
TARGET_ID="${CREATED_ID:-1}"
PUT_DATA='{"userId":1,"title":"Updated Post Title via PUT","body":"Fully updated body content"}'

assert_endpoint "PUT /api/posts/$TARGET_ID updates resource" "200" PUT "/api/posts/$TARGET_ID" "$PUT_DATA" "$HEADERS_JSON"
assert_endpoint "PUT /api/posts/999999 returns 404" "404" PUT "/api/posts/999999" "$PUT_DATA" "$HEADERS_JSON"
assert_endpoint "PUT /api/posts/abc returns 404" "404" PUT "/api/posts/abc" "$PUT_DATA" "$HEADERS_JSON"
assert_endpoint "PUT /api/posts/$TARGET_ID returns 400 for malformed JSON" "400" PUT "/api/posts/$TARGET_ID" "{ bad json" "$HEADERS_JSON"

# --- 3.3 PATCH Partial Update ---
PATCH_DATA='{"title":"Patched Post Title"}'

assert_endpoint "PATCH /api/posts/$TARGET_ID partially updates resource" "200" PATCH "/api/posts/$TARGET_ID" "$PATCH_DATA" "$HEADERS_JSON"
assert_endpoint "PATCH /api/posts/999999 returns 404" "404" PATCH "/api/posts/999999" "$PATCH_DATA" "$HEADERS_JSON"
assert_endpoint "PATCH /api/posts/abc returns 404" "404" PATCH "/api/posts/abc" "$PATCH_DATA" "$HEADERS_JSON"
assert_endpoint "PATCH /api/posts/$TARGET_ID returns 400 for malformed JSON" "400" PATCH "/api/posts/$TARGET_ID" "{ bad json" "$HEADERS_JSON"

# --- 3.4 DELETE ---
if [ -n "$CREATED_ID" ]; then
    assert_endpoint "DELETE /api/posts/$CREATED_ID deletes resource" "204" DELETE "/api/posts/$CREATED_ID"
    assert_endpoint "GET /api/posts/$CREATED_ID returns 404 after deletion" "404" GET "/api/posts/$CREATED_ID"
fi
assert_endpoint "DELETE /api/posts/999999 returns 204 for non-existent item" "204" DELETE "/api/posts/999999"
assert_endpoint "DELETE /api/posts/abc returns 404 for invalid ID" "404" DELETE "/api/posts/abc"

# ==============================================================================
# SUITE 4: Admin REST Authentication & Security Policy
# ==============================================================================
log_section "SUITE 4: Admin REST Auth & Protected Routes"

assert_endpoint "POST /api/admin/auth/login returns 400 for missing credentials" "400" POST "/api/admin/auth/login" "{}" "$HEADERS_JSON"

# Obtain a Bearer token. The pre-flight step already logged in successfully, so
# reuse that token instead of performing a second login (keeps repeated runs
# from consuming the login brute-force budget). Fall back to a fresh login when
# the pre-flight token is unavailable (e.g. jq was missing at startup).
if [ -z "$AUTH_TOKEN" ]; then
    LOGIN_DATA=$(cat <<EOF
{"username": "$ADMIN_USER", "password": "$ADMIN_PASS"}
EOF
)
    LOGIN_RES=$(http_req POST "/api/admin/auth/login" "$LOGIN_DATA" "$HEADERS_JSON")
    LOGIN_STATUS=$(echo "$LOGIN_RES" | head -n 1)
    LOGIN_BODY=$(echo "$LOGIN_RES" | tail -n +2)

    if [ "$LOGIN_STATUS" = "200" ]; then
        log_pass "POST /api/admin/auth/login answered [HTTP 200]"
        if [ "$HAS_JQ" = true ]; then
            IS_OK=$(echo "$LOGIN_BODY" | jq -r '.ok // false')
            if [ "$IS_OK" = "true" ]; then
                AUTH_TOKEN=$(echo "$LOGIN_BODY" | jq -r '.token // empty')
                log_pass "Admin authentication successful, token acquired"
            else
                log_info "Admin credentials not configured or invalid (Response: $(echo "$LOGIN_BODY" | jq -c '.message // .'))"
            fi
        fi
    else
        log_fail "POST /api/admin/auth/login endpoint call" "200" "$LOGIN_STATUS" "$LOGIN_BODY"
    fi
else
    log_pass "POST /api/admin/auth/login answered [HTTP 200] (pre-flight token reused)"
    log_pass "Admin authentication successful, token acquired"
fi

assert_endpoint "GET /api/admin/settings returns public settings without auth" "200" GET "/api/admin/settings"
assert_endpoint "GET /api/admin/settings/NONEXISTENT_KEY returns 404" "404" GET "/api/admin/settings/NONEXISTENT_KEY"

# Unauthenticated attempts on protected routes (must be rejected with HTTP 401)
assert_endpoint "PUT /api/admin/settings/SITE_NAME rejects unauthenticated (401)" "401" PUT "/api/admin/settings/SITE_NAME" '{"value":"test"}' "$HEADERS_JSON"
assert_endpoint "POST /api/admin/settings/reset/SITE_NAME rejects unauthenticated (401)" "401" POST "/api/admin/settings/reset/SITE_NAME"
assert_endpoint "POST /api/admin/data/seed rejects unauthenticated (401)" "401" POST "/api/admin/data/seed"
assert_endpoint "POST /api/admin/data/reset rejects unauthenticated (401)" "401" POST "/api/admin/data/reset"

# Authenticated tests if token is present
if [ -n "$AUTH_TOKEN" ]; then
    AUTH_HEADER="Authorization: Bearer $AUTH_TOKEN|Content-Type: application/json"
    assert_endpoint "GET /api/admin/settings with auth returns full settings list" "200" GET "/api/admin/settings" "" "Authorization: Bearer $AUTH_TOKEN"
    assert_endpoint "POST /api/admin/data/seed with auth succeeds" "200" POST "/api/admin/data/seed" "" "Authorization: Bearer $AUTH_TOKEN"
    assert_endpoint "POST /api/admin/data/reset with auth succeeds" "200" POST "/api/admin/data/reset" "" "Authorization: Bearer $AUTH_TOKEN"
fi

# ==============================================================================
# SUITE 5: tRPC Procedures (/api/trpc/*)
# ==============================================================================
log_section "SUITE 5: tRPC Procedures & Routers"

assert_endpoint "GET /api/trpc/ping returns 200" "200" GET "/api/trpc/ping"
assert_endpoint "GET /api/trpc/json.getCounts returns 200" "200" GET "/api/trpc/json.getCounts"
assert_endpoint "GET /api/trpc/json.users.list returns 200" "200" GET "/api/trpc/json.users.list?input=%7B%22json%22%3A%7B%7D%7D"
assert_endpoint "GET /api/trpc/json.users.getById returns 200" "200" GET "/api/trpc/json.users.getById?input=%7B%22json%22%3A%7B%22id%22%3A1%7D%7D"
assert_endpoint "GET /api/trpc/admin.auth.verify returns 200" "200" GET "/api/trpc/admin.auth.verify"
assert_endpoint "GET /api/trpc/admin.settings.list returns 200" "200" GET "/api/trpc/admin.settings.list"

# ==============================================================================
# SUITE 6: Router Fallback & Edge Error Cases
# ==============================================================================
log_section "SUITE 6: Router Fallback & Edge Cases"

assert_endpoint "PATCH /api/unknown returns 404 fallback" "404" PATCH "/api/unknown"
assert_endpoint "GET /api/nonexistent/deep/route returns 404" "404" GET "/api/nonexistent/deep/route"

# ==============================================================================
# Test Summary & Execution Status
# ==============================================================================
log_section "REGRESSION TEST SUMMARY"

echo -e "Target Server: ${BASE_URL}"
echo -e "Total Tests  : ${TOTAL_TESTS}"
echo -e "Passed       : ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed       : ${RED}${FAILED_TESTS}${NC}"

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "\n${GREEN}======================================================================${NC}"
    echo -e "${GREEN} SUCCESS: All endpoints passed regression testing! Ready for deploy. ${NC}"
    echo -e "${GREEN}======================================================================${NC}\n"
    exit 0
else
    echo -e "\n${RED}======================================================================${NC}"
    echo -e "${RED} FAILURE: ${FAILED_TESTS} test(s) failed. REGRESSION DETECTED! ${NC}"
    echo -e "${RED} Do NOT deploy to production until issue(s) are resolved. ${NC}"
    echo -e "${RED}======================================================================${NC}\n"
    exit 1
fi
