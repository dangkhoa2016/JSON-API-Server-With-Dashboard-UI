#!/usr/bin/env bash
# Admin (REST)
# BASE_URL=http://localhost:3000

# Login (get token)
curl -s -X POST "$BASE_URL/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# your token will be returned in the response body
export TOKEN="..."

# Settings list (public - no auth)
curl -s "$BASE_URL/api/admin/settings"

# Settings list (admin - all, replace TOKEN)
curl -s "$BASE_URL/api/admin/settings" \
  -H "Authorization: Bearer $TOKEN"

# Get setting by key

# Update setting (replace TOKEN)
curl -s -X PUT "$BASE_URL/api/admin/settings/DEBUG_SQL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"value":"true"}'

# Reset setting (replace TOKEN)
curl -s -X POST "$BASE_URL/api/admin/settings/reset/DEBUG_SQL" \
  -H "Authorization: Bearer $TOKEN"

# Seed data (replace TOKEN)
curl -s -X POST "$BASE_URL/api/admin/data/seed" \
  -H "Authorization: Bearer $TOKEN"

# Reset database (replace TOKEN)
curl -s -X POST "$BASE_URL/api/admin/data/reset" \
  -H "Authorization: Bearer $TOKEN"
