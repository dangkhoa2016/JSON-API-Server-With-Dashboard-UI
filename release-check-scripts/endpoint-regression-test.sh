#!/usr/bin/env bash
# =============================================================================
# Endpoint Regression Test Script
# Purpose: pre-deploy automated regression checks against a running server.
# Requires: curl, jq
# Usage: bash scripts/endpoint-regression-test.sh [--admin-data]
# Env: BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD
# =============================================================================

set -u

# --- Config ----------------------------------------------------------------
BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

# Load admin credentials from the project .env file if present, falling back to env vars.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_ADMIN_USERNAME=""
ENV_ADMIN_PASSWORD=""
if [ -f "${PROJECT_DIR}/.env" ]; then
    ENV_ADMIN_USERNAME="$(grep -E '^ADMIN_USERNAME=' "${PROJECT_DIR}/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*#.*$//' | sed 's/[[:space:]]*$//')"
    ENV_ADMIN_PASSWORD="$(grep -E '^ADMIN_PASSWORD=' "${PROJECT_DIR}/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/[[:space:]]*#.*$//' | sed 's/[[:space:]]*$//')"
fi
ADMIN_USERNAME="${ADMIN_USERNAME:-${ENV_ADMIN_USERNAME:-admin}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${ENV_ADMIN_PASSWORD:-}}"
RUN_ADMIN_DATA=false

for arg in "$@"; do
  case "$arg" in
    --admin-data) RUN_ADMIN_DATA=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# --- Colors ----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Counters & globals ----------------------------------------------------
PASS=0
FAIL=0
SKIP=0
HTTP_STATUS=""
HTTP_BODY=""
AUTH_TOKEN=""
RATE_LIMIT_OFF=false
RATE_LIMIT_ORIG_VALUE=""

# --- Output helpers --------------------------------------------------------
section() { echo -e "\n${CYAN}==${NC} ${CYAN}$1${NC}"; }
pass() { echo -e "  ${GREEN}PASS${NC}  $1"; ((PASS++)); }
fail() { echo -e "  ${RED}FAIL${NC}  $1"; ((FAIL++)); }
skip() { echo -e "  ${YELLOW}SKIP${NC}  $1"; ((SKIP++)); }

# --- HTTP helper -----------------------------------------------------------
# Performs a request; stores status in $HTTP_STATUS and body in $HTTP_BODY.
# headers arg is a pipe-separated list, e.g. "Content-Type: application/json|Authorization: Bearer xyz"
req() {
  local method="$1" endpoint="$2" data="${3:-}" headers="${4:-}"
  local tmp
  tmp=$(mktemp)
  local -a args=(-s -o "$tmp" -w "%{http_code}" -X "$method")
  if [[ -n "$headers" ]]; then
    local -a hdr
    IFS='|' read -r -a hdr <<< "$headers"
    for h in "${hdr[@]}"; do args+=(-H "$h"); done
  fi
  if [[ -n "$data" ]]; then
    args+=(-d "$data")
  fi
  args+=("$BASE_URL$endpoint")
  HTTP_STATUS=$(curl "${args[@]}" 2>/dev/null)
  HTTP_STATUS="${HTTP_STATUS:-000}"
  HTTP_BODY=$(cat "$tmp" 2>/dev/null)
  rm -f "$tmp"
}

# --- Assertions ------------------------------------------------------------
assert_status() {
  local name="$1" expected="$2" method="$3" endpoint="$4" data="${5:-}" headers="${6:-}"
  req "$method" "$endpoint" "$data" "$headers"
  if [[ "$HTTP_STATUS" == "$expected" ]]; then
    pass "$name [HTTP $HTTP_STATUS]"
    return 0
  fi
  fail "$name (expected $expected, got $HTTP_STATUS)"
  [[ -n "$HTTP_BODY" ]] && echo -e "      ${RED}${HTTP_BODY:0:200}${NC}"
  return 1
}

# GET an endpoint and assert a jq predicate is truthy.
check() {
  local name="$1" endpoint="$2" jq_expr="$3" headers="${4:-}"
  req GET "$endpoint" "" "$headers"
  if jq -e "$jq_expr" <<< "$HTTP_BODY" >/dev/null 2>&1; then
    pass "$name"
    return 0
  fi
  fail "$name (jq '$jq_expr' on $endpoint)"
  [[ -n "$HTTP_BODY" ]] && echo -e "      ${RED}${HTTP_BODY:0:200}${NC}"
  return 1
}

# --- CRUD lifecycle (self-cleaning) ----------------------------------------
run_crud() {
  local res="$1" suffix="$2"
  local create_data update_data patch_data
  case "$res" in
    users)
      create_data="{\"name\":\"Reg Test User $suffix\",\"username\":\"regtest$suffix\",\"email\":\"regtest$suffix@example.com\"}"
      update_data="{\"name\":\"Reg Updated User $suffix\",\"username\":\"regtest$suffix\",\"email\":\"regtest$suffix@example.com\"}"
      patch_data="{\"phone\":\"000-000-0000\"}"
      ;;
    posts)
      create_data="{\"userId\":1,\"title\":\"Reg Test Post $suffix\",\"body\":\"body $suffix\"}"
      update_data="{\"userId\":1,\"title\":\"Reg Updated Post $suffix\",\"body\":\"body-updated $suffix\"}"
      patch_data="{\"body\":\"patched $suffix\"}"
      ;;
    comments)
      create_data="{\"postId\":1,\"name\":\"Reg Test $suffix\",\"email\":\"regtest$suffix@example.com\",\"body\":\"body $suffix\"}"
      update_data="{\"postId\":1,\"name\":\"Reg Updated $suffix\",\"email\":\"regtest$suffix@example.com\",\"body\":\"body $suffix\"}"
      patch_data="{\"name\":\"Reg Patched $suffix\"}"
      ;;
    albums)
      create_data="{\"userId\":1,\"title\":\"Reg Test Album $suffix\"}"
      update_data="{\"userId\":1,\"title\":\"Reg Updated Album $suffix\"}"
      patch_data="{\"title\":\"Reg Patched Album $suffix\"}"
      ;;
    photos)
      create_data="{\"albumId\":1,\"title\":\"Reg Test Photo $suffix\",\"url\":\"https://example.com/$suffix.png\",\"thumbnailUrl\":\"https://example.com/thumb-$suffix.png\"}"
      update_data="{\"albumId\":1,\"title\":\"Reg Updated Photo $suffix\",\"url\":\"https://example.com/$suffix.png\",\"thumbnailUrl\":\"https://example.com/thumb-$suffix.png\"}"
      patch_data="{\"title\":\"Reg Patched Photo $suffix\"}"
      ;;
    todos)
      create_data="{\"userId\":1,\"title\":\"Reg Test Todo $suffix\",\"completed\":false}"
      update_data="{\"userId\":1,\"title\":\"Reg Updated Todo $suffix\",\"completed\":true}"
      patch_data="{\"completed\":false}"
      ;;
  esac

  local headers="Content-Type: application/json"
  local created_id=""

  req POST "/api/$res" "$create_data" "$headers"
  if [[ "$HTTP_STATUS" == "201" ]]; then
    pass "POST /api/$res creates resource [HTTP 201]"
    created_id=$(jq -r '.id // empty' <<< "$HTTP_BODY")
  else
    fail "POST /api/$res (expected 201, got $HTTP_STATUS)"
    [[ -n "$HTTP_BODY" ]] && echo -e "      ${RED}${HTTP_BODY:0:200}${NC}"
    return 1
  fi

  if [[ -z "$created_id" ]]; then
    fail "POST /api/$res returned no id"
    return 1
  fi

  req GET "/api/$res/$created_id"
  if [[ "$HTTP_STATUS" == "200" ]] && jq -e --argjson id "$created_id" '.id == $id' <<< "$HTTP_BODY" >/dev/null 2>&1; then
    pass "GET /api/$res/$created_id retrieves created resource"
  else
    fail "GET /api/$res/$created_id (expected 200 + matching id, got $HTTP_STATUS)"
  fi

  req PUT "/api/$res/$created_id" "$update_data" "$headers"
  if [[ "$HTTP_STATUS" == "200" ]]; then
    pass "PUT /api/$res/$created_id updates resource [HTTP 200]"
  else
    fail "PUT /api/$res/$created_id (expected 200, got $HTTP_STATUS)"
  fi

  req PATCH "/api/$res/$created_id" "$patch_data" "$headers"
  if [[ "$HTTP_STATUS" == "200" ]]; then
    pass "PATCH /api/$res/$created_id partially updates resource [HTTP 200]"
  else
    fail "PATCH /api/$res/$created_id (expected 200, got $HTTP_STATUS)"
  fi

  req DELETE "/api/$res/$created_id"
  if [[ "$HTTP_STATUS" == "204" ]]; then
    pass "DELETE /api/$res/$created_id removes resource [HTTP 204]"
  else
    fail "DELETE /api/$res/$created_id (expected 204, got $HTTP_STATUS)"
  fi

  req GET "/api/$res/$created_id"
  if [[ "$HTTP_STATUS" == "404" ]]; then
    pass "GET /api/$res/$created_id returns 404 after delete"
  else
    fail "GET /api/$res/$created_id after delete (expected 404, got $HTTP_STATUS)"
  fi
}

# --- Connectivity ----------------------------------------------------------
echo -e "${CYAN}Endpoint Regression Test${NC}  target=$BASE_URL  admin=$([ -n "$ADMIN_PASSWORD" ] && echo enabled || echo skipped)"
req GET /api/health
if [[ "$HTTP_STATUS" == "000" ]]; then
  echo -e "${RED}[ERROR] Unable to connect to $BASE_URL. Is the server running?${NC}" >&2
  exit 1
fi

# ===========================================================================
# PRE-FLIGHT: Disable rate limiting for this test run
# Rate limiting is configured in the DB (RATE_LIMIT_ENABLED). Set it to "false"
# via the admin API so the regression suite does not hit HTTP 429 responses.
# The original value is restored on exit.
# ===========================================================================
restore_rate_limit() {
  if [[ "$RATE_LIMIT_OFF" == "true" ]]; then
    echo -e "${CYAN}Restoring RATE_LIMIT_ENABLED to '$RATE_LIMIT_ORIG_VALUE'${NC}"
    req PUT /api/admin/settings/RATE_LIMIT_ENABLED "{\"value\":\"$RATE_LIMIT_ORIG_VALUE\"}" "Content-Type: application/json|Authorization: Bearer $AUTH_TOKEN"
  fi
}
trap restore_rate_limit EXIT

if [[ -n "$ADMIN_PASSWORD" ]]; then
  # Acquire an admin token up-front. Repeated runs can be blocked by the rate
  # limiter in two different ways, so wait out either one:
  #   1. General limiter  -> HTTP 429 with a `retryAfter` field.
  #   2. Login limiter    -> HTTP 200 with ok=false + "Too many login attempts"
  #                          (the seconds are embedded in the message).
  # Successful logins reset the login limiter, so back-to-back runs stay green.
  LOGIN_STATUS=""
  LOGIN_BODY=""
  for attempt in 1 2 3 4 5; do
    req POST /api/admin/auth/login "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" "Content-Type: application/json"
    LOGIN_STATUS="$HTTP_STATUS"
    LOGIN_BODY="$HTTP_BODY"
    if [[ "$LOGIN_STATUS" == "429" ]]; then
      RETRY_AFTER=$(jq -r '.retryAfter // empty' <<< "$LOGIN_BODY" 2>/dev/null)
      RETRY_AFTER="${RETRY_AFTER:-300}"
      echo -e "${YELLOW}Login rate-limited (HTTP 429). Waiting ${RETRY_AFTER}s for the block to expire... (attempt ${attempt}/5)${NC}"
      sleep "$RETRY_AFTER"
    elif [[ "$LOGIN_STATUS" == "200" ]]; then
      if jq -e '.ok == true' <<< "$LOGIN_BODY" >/dev/null 2>&1; then
        break
      fi
      if grep -q "Too many login attempts" <<< "$LOGIN_BODY"; then
        RETRY_AFTER=$(jq -r '.message // empty' <<< "$LOGIN_BODY" 2>/dev/null | sed -n 's/.*in \([0-9][0-9]*\)s\..*/\1/p')
        RETRY_AFTER="${RETRY_AFTER:-900}"
        echo -e "${YELLOW}Login blocked by brute-force limiter. Waiting ${RETRY_AFTER}s... (attempt ${attempt}/5)${NC}"
        sleep "$RETRY_AFTER"
      else
        break
      fi
    else
      echo -e "${YELLOW}Admin login returned HTTP $LOGIN_STATUS; retrying... (attempt ${attempt}/5)${NC}"
      sleep 2
    fi
  done

  if [[ "$LOGIN_STATUS" == "200" ]] && jq -e '.ok == true' <<< "$LOGIN_BODY" >/dev/null 2>&1; then
    AUTH_TOKEN=$(jq -r '.token // empty' <<< "$LOGIN_BODY")
    if [[ -n "$AUTH_TOKEN" ]]; then
      req GET /api/admin/settings/RATE_LIMIT_ENABLED "" "Authorization: Bearer $AUTH_TOKEN"
      if [[ "$HTTP_STATUS" == "200" ]]; then
        RATE_LIMIT_ORIG_VALUE=$(jq -r '.value // empty' <<< "$HTTP_BODY")
        RATE_LIMIT_ORIG_VALUE="${RATE_LIMIT_ORIG_VALUE:-true}"
        req PUT /api/admin/settings/RATE_LIMIT_ENABLED '{"value":"false"}' "Content-Type: application/json|Authorization: Bearer $AUTH_TOKEN"
        if [[ "$HTTP_STATUS" == "200" ]]; then
          RATE_LIMIT_OFF=true
          echo -e "${CYAN}Rate limiting disabled (RATE_LIMIT_ENABLED=false) for this run${NC}"
          echo -e "${CYAN}Waiting for rate-limit config cache to refresh...${NC}"
          sleep 11
        else
          echo -e "${YELLOW}Failed to disable rate limiting (HTTP $HTTP_STATUS)${NC}"
        fi
      else
        echo -e "${YELLOW}Failed to read RATE_LIMIT_ENABLED (HTTP $HTTP_STATUS)${NC}"
      fi
    fi
  else
    echo -e "${YELLOW}Admin login failed (HTTP $LOGIN_STATUS). Rate limiting may stay enabled.${NC}"
  fi
else
  echo -e "${YELLOW}ADMIN_PASSWORD not set. Rate limiting may stay enabled.${NC}"
fi

# ===========================================================================
section "1. Health"
assert_status "GET /api/health returns 200" 200 GET /api/health
check "health status is healthy" /api/health '.status == "healthy"'
check "health db is connected" /api/health '.db == "connected"'

section "2. tRPC"
assert_status "GET /api/trpc/ping returns 200" 200 GET /api/trpc/ping
check "ping returns ok=true" /api/trpc/ping '.result.data.json.ok == true'
check "ping returns numeric ts" /api/trpc/ping '(.result.data.json.ts | type) == "number"'

section "3. Counts"
assert_status "GET /api/counts returns 200" 200 GET /api/counts
for r in users posts comments albums photos todos; do
  check "counts has $r" /api/counts ".$r | type == \"number\" and . >= 0"
done

section "4. Feature cards"
assert_status "GET /api/feature-cards returns 200" 200 GET /api/feature-cards
check "feature-cards is non-empty array" /api/feature-cards 'type == "array" and length > 0'

section "5. Resource list shape"
for r in users posts comments albums photos todos; do
  check "GET /api/$r returns {data,total}" "/api/$r" 'has("data") and has("total") and (.data|type)=="array" and (.total|type)=="number" and .total >= 0'
  check "GET /api/$r total matches data length" "/api/$r" '.total == (.data|length)'
done

section "6. Get by id"
for r in users posts comments albums photos todos; do
  check "GET /api/$r/1 returns object with id=1" "/api/$r/1" '.id == 1'
done

section "7. List query features"
check "pagination _limit=2 returns 2 items" "/api/users?_limit=2" '(.data|length) == 2'
check "sort asc by name" "/api/users?_sort=name&_order=asc" '(.data | map(.name) | . == sort)'
check "sort desc by name" "/api/users?_sort=name&_order=desc" '(.data | map(.name) | . == (sort | reverse))'
assert_status "GET /api/users?q=Leanne returns 200" 200 GET "/api/users?q=Leanne"
assert_status "GET /api/users?q=%25 returns 200" 200 GET "/api/users?q=%25"
check "q=%25 escapes percent wildcard" "/api/users?q=%25" '.total == 0'
assert_status "GET /api/users?q=_ returns 200" 200 GET "/api/users?q=__"

section "8. Error handling"
assert_status "GET /api/invalid returns 404" 404 GET /api/invalid
assert_status "GET /api/users/999999 returns 404" 404 GET /api/users/999999
assert_status "GET /api/users/abc returns 404" 404 GET /api/users/abc
assert_status "GET /api/users?_limit=abc returns 400" 400 GET "/api/users?_limit=abc"
assert_status "POST /api/users malformed JSON returns 400" 400 POST /api/users "{ bad json" "Content-Type: application/json"
assert_status "POST /api/invalid returns 404" 404 POST /api/invalid '{"name":"x"}' "Content-Type: application/json"
assert_status "PATCH /api/unknown returns 404" 404 PATCH /api/unknown '{}' "Content-Type: application/json"

section "9. CRUD lifecycle"
SUFFIX="$(date +%s)"
for r in users posts comments albums photos todos; do
  run_crud "$r" "$SUFFIX"
done

section "10. Admin"
assert_status "GET /api/admin/settings without auth returns 200" 200 GET /api/admin/settings
check "public settings are all public and hide APP_SECRET" /api/admin/settings 'type == "array" and all(.[]; .isPublic == true) and (map(.key) | index("APP_SECRET") == null)'
assert_status "GET /api/admin/settings/APP_SECRET without auth returns 404" 404 GET /api/admin/settings/APP_SECRET
assert_status "GET /api/admin/settings/NONEXISTENT returns 404" 404 GET /api/admin/settings/NONEXISTENT
assert_status "POST /api/admin/auth/login empty body returns 400" 400 POST /api/admin/auth/login "{}" "Content-Type: application/json"
assert_status "POST /api/admin/data/seed without auth returns 401" 401 POST /api/admin/data/seed
assert_status "PUT /api/admin/settings/SITE_NAME without auth returns 401" 401 PUT /api/admin/settings/SITE_NAME '{"value":"x"}' "Content-Type: application/json"
assert_status "POST /api/admin/settings/reset/SITE_NAME without auth returns 401" 401 POST /api/admin/settings/reset/SITE_NAME

if [[ -n "$ADMIN_PASSWORD" ]]; then
  req POST /api/admin/auth/login "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"wrong-password\"}" "Content-Type: application/json"
  if [[ "$HTTP_STATUS" == "200" ]] && jq -e '.ok == false' <<< "$HTTP_BODY" >/dev/null 2>&1; then
    pass "login with wrong password returns ok=false"
  else
    fail "login with wrong password (expected 200 + ok=false, got $HTTP_STATUS)"
  fi

  # Reuse the token acquired during pre-flight so a single run performs only one
  # successful login (the wrong-password attempt above still exercises the
  # failure path). Fall back to a fresh login if the pre-flight token is absent.
  if [[ -n "$AUTH_TOKEN" ]]; then
    pass "login with valid credentials returns token (pre-flight token reused)"
  else
    req POST /api/admin/auth/login "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" "Content-Type: application/json"
    if [[ "$HTTP_STATUS" == "200" ]] && jq -e '.ok == true' <<< "$HTTP_BODY" >/dev/null 2>&1; then
      AUTH_TOKEN=$(jq -r '.token // empty' <<< "$HTTP_BODY")
      pass "login with valid credentials returns token"
    else
      fail "login with valid credentials (expected 200 + ok=true, got $HTTP_STATUS)"
    fi
  fi

  if [[ -n "$AUTH_TOKEN" ]]; then
    AUTH="Authorization: Bearer $AUTH_TOKEN"

    assert_status "GET /api/admin/settings with auth returns 200" 200 GET /api/admin/settings "" "$AUTH"
    check "settings list contains APP_SECRET" /api/admin/settings 'type == "array" and (map(.key) | index("APP_SECRET") != null)' "$AUTH"
    check "APP_SECRET value is masked" /api/admin/settings/APP_SECRET '(.key == "APP_SECRET") and (.value == "********")' "$AUTH"

    req GET /api/admin/settings/REDIS_ENABLED "" "$AUTH"
    if [[ "$HTTP_STATUS" == "200" ]]; then
      ORIG_VALUE=$(jq -r '.value // empty' <<< "$HTTP_BODY")
      if [[ -n "$ORIG_VALUE" ]]; then
        req PUT /api/admin/settings/REDIS_ENABLED '{"value":"true"}' "Content-Type: application/json|$AUTH"
        if [[ "$HTTP_STATUS" == "200" && "$(jq -r '.ok // false' <<< "$HTTP_BODY")" == "true" ]]; then
          pass "settings update succeeds"
        else
          fail "settings update (expected 200 + ok=true, got $HTTP_STATUS)"
        fi
        req PUT /api/admin/settings/REDIS_ENABLED '{"value":"***"}' "Content-Type: application/json|$AUTH"
        if [[ "$(jq -r '.ok // false' <<< "$HTTP_BODY")" == "false" ]]; then
          pass "settings rejects all-asterisk value without force"
        else
          fail "settings all-asterisk value was not rejected"
        fi
        req PUT /api/admin/settings/REDIS_ENABLED '{"value":"***","force":true}' "Content-Type: application/json|$AUTH"
        if [[ "$HTTP_STATUS" == "200" && "$(jq -r '.ok // false' <<< "$HTTP_BODY")" == "true" ]]; then
          pass "settings allows all-asterisk value with force"
        else
          fail "settings all-asterisk value with force (expected ok=true, got $HTTP_STATUS)"
        fi
        req PUT /api/admin/settings/REDIS_ENABLED "{\"value\":\"$ORIG_VALUE\"}" "Content-Type: application/json|$AUTH"
        if [[ "$HTTP_STATUS" == "200" ]]; then
          pass "settings restored to original value"
        else
          fail "settings restore (expected 200, got $HTTP_STATUS)"
        fi
      else
        skip "settings update round-trip (REDIS_ENABLED has no value)"
      fi
    else
      skip "settings update round-trip (REDIS_ENABLED not present)"
    fi
  else
    skip "authenticated admin settings tests (no token)"
  fi
else
  skip "admin login/settings tests (ADMIN_PASSWORD not set)"
fi

if [[ "$RUN_ADMIN_DATA" == "true" ]]; then
  section "11. Admin data (destructive, --admin-data)"
  if [[ -n "$AUTH_TOKEN" ]]; then
    AUTH="Authorization: Bearer $AUTH_TOKEN"
    assert_status "POST /api/admin/data/seed with auth" 200 POST /api/admin/data/seed "" "$AUTH"
    assert_status "POST /api/admin/data/reset with auth" 200 POST /api/admin/data/reset "" "$AUTH"
  else
    skip "admin data seed/reset (no token)"
  fi
fi

# ===========================================================================
section "Summary"
echo -e "  Target : $BASE_URL"
echo -e "  Passed : $PASS"
echo -e "  Failed : $FAIL"
echo -e "  Skipped: $SKIP"
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "\n${GREEN}All endpoint regression checks passed.${NC}"
  exit 0
else
  echo -e "\n${RED}$FAIL check(s) failed. Regression detected.${NC}"
  exit 1
fi
