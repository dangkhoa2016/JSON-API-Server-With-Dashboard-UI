# Design: Project Improvements

## Overview

Comprehensive improvement plan for JSON API Server with Dashboard UI based on code review findings. Three groups of work: Security Hardening, Architecture Refactoring, and Git History Cleanup.

## Current State

- 34 commits with conventional commit format
- Merge conflict markers in `api/lib/ratelimit.ts` (lines 91-117)
- Several security and architecture issues identified in code review

---

## Group A: Security Fixes

**Branch:** `fix/security-hardening`
**Commit:** `fix(security): harden auth, CORS, and remove hardcoded secrets`

### A1. Resolve merge conflict in `ratelimit.ts`

- Remove conflict markers (lines 91-117)
- `MAX_MEM_ENTRIES` already declared at line 10 → remove duplicate at line 115
- `RATE_LIMIT_LUA_SCRIPT` (lines 93-113) contains JS code in Lua string → remove or fix format

### A2. HMAC secret hardening (`api/lib/adminAuth.ts:10`)

**Before:**
```ts
const SECRET = process.env.ADMIN_SECRET || randomBytes(32).toString("hex");
```

**After:**
```ts
const SECRET = process.env.ADMIN_SECRET;
if (!SECRET) throw new Error("ADMIN_SECRET environment variable is required");
```

**Rationale:** Random secret on every restart invalidates all sessions. Must be persisted via env var.

### A3. Unified auth architecture

- `db/seed-admin.ts` stores admin credentials in `settings` table with argon2 hash
- `adminAuth.ts` needs login endpoint that verifies password against DB
- Login flow: input password → verify argon2 hash from DB → create HMAC session token
- Ensure `adminAuth.ts` reads from `settings` table for verification

### A4. CORS restriction (`api/boot.ts:64`)

**Before:**
```ts
app.use(cors());
```

**After:**
```ts
app.use(cors({
  origin: env.corsOrigins || '*',
  credentials: true,
}));
```

- Add `corsOrigins` to `api/lib/env.ts` as optional config
- Default to `*` for development, restrict in production

### A5. Remove hardcoded password (`docker-entrypoint.sh:15`)

**Before:**
```sh
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
```

**After:**
```sh
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ERROR: ADMIN_PASSWORD must be set}"
```

**Rationale:** Hardcoded fallback is a security risk if docker-compose is bypassed.

---

## Group B: Architecture Improvements

**Branch:** `refactor/architecture-improvements`
**Commit:** `refactor(api): split ratelimit monolith and improve architecture`

### B1. Split `ratelimit.ts` (412 lines) into modules

| New File | Responsibility |
|----------|---------------|
| `api/lib/ratelimit/cidr.ts` | CIDR matching, IPv6 expansion |
| `api/lib/ratelimit/circuitBreaker.ts` | Circuit breaker state and logic |
| `api/lib/ratelimit/memStore.ts` | In-memory store with LRU eviction |
| `api/lib/ratelimit/ipUtils.ts` | IP normalization, getClientIp |
| `api/lib/ratelimit/index.ts` | Middleware creation, main exports |

### B2. Redis KEYS → SCAN (`api/lib/redis.ts:63`)

**Before:**
```ts
const keys = await redis.keys(pattern);
```

**After:**
```ts
const keys: string[] = [];
let cursor = '0';
do {
  const [newCursor, found] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
  cursor = newCursor;
  keys.push(...found);
} while (cursor !== '0');
```

**Rationale:** `KEYS` is O(n) and blocks server. `SCAN` is production-safe.

### B3. Route guards for admin pages (`web/main.ts`)

```ts
{ path: '/admin/settings', name: 'admin-settings', component: () => import('./pages/Settings.vue'), meta: { requiresAuth: true } },

// Add navigation guard
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !useAuth().isAuthenticated.value) {
    return { name: 'home' };
  }
});
```

### B4. Fix `useAuth.ts` singleton state

- Move `verified` inside composable function
- Use guard pattern that re-verifies if `user` changes
- Prevent state leak between test cases

### B5. Fix body size validation (`api/boot.ts:88-97`)

- Remove `chunks.push(value)` — only count bytes, don't accumulate
- Reconstruct body from original stream, not from chunks array
- This preserves streaming benefit

### B6. Enforce commitlint body/footer rules (`commitlint.config.ts`)

**Before:**
```ts
'body-max-line-length': [1, 'always', 100],
'footer-max-line-length': [1, 'always', 100],
```

**After:**
```ts
'body-max-line-length': [2, 'always', 100],
'footer-max-line-length': [2, 'always', 100],
```

### B7. Improve commit size check script (`scripts/check-commit-size.sh`)

- Replace `grep -oP` with `awk` for POSIX portability
- Handle edge cases (deletions-only commits)

---

## Group C: Git History Cleanup

**Branch:** `chore/git-history-cleanup`
**Commit:** `chore: clean up git history`

### C1. Split large commits

| Commit | Current | Split Into |
|--------|---------|------------|
| `481f80c` (ResourcePage) | 1146 lines | Implementation (347 lines) + Tests (799 lines) |
| `1414d83` (Settings) | 1219 lines | Implementation (361 lines) + Tests (858 lines) |

### C2. Squash test-only commit

- `bf61702` (test rate limiter, 723 lines) → squash into `81d0fb6` (implement rate limiter)

### C3. Rewrite git history

- Use `git rebase -i` to rewrite from first commit
- Force push after review
- Requires team coordination

---

## Implementation Order

1. Create branch `fix/security-hardening` from `main`
2. Apply Group A changes → commit
3. Create branch `refactor/architecture-improvements` from Group A
4. Apply Group B changes → commit
5. Create branch `chore/git-history-cleanup` from Group B
6. Apply Group C changes → commit
7. Review all changes
8. Merge to main (or force push if rewriting history)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Merge conflict resolution breaks rate limiting | High | Test rate limiter after resolve |
| Auth architecture change breaks login | High | Test login flow end-to-end |
| Git history rewrite loses work | Medium | Backup branch before rewrite |
| CORS restriction breaks frontend | Low | Test with frontend dev server |

## Success Criteria

- [ ] No merge conflict markers in codebase
- [ ] All security issues resolved
- [ ] `ratelimit.ts` split into focused modules
- [ ] All tests passing
- [ ] Git history clean and readable
- [ ] Commit messages follow conventional commit format
