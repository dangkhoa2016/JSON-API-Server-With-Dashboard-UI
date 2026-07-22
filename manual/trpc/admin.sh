#!/usr/bin/env bash
# Admin (tRPC)
# BASE_URL=http://localhost:3000
# NOTE: tRPC query procedures use GET; mutations use POST.
# Inputs are serialized with superjson: ?input={"json":{...}} for GET, {"json":{...}} body for POST.

# Login (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/admin.auth.login" \
  -H "Content-Type: application/json" \
  -d '{"json":{"username":"admin","password":"admin123"}}'

# your token will be returned in the response body
export TOKEN="..."

# Settings list (query — GET, public, no auth needed)
curl -s "$BASE_URL/api/trpc/admin.settings.list"

# Settings list (query — GET, admin, all settings, replace TOKEN)
curl -s "$BASE_URL/api/trpc/admin.settings.list" \
  -H "Authorization: Bearer $TOKEN"

# Get setting by key (query — GET, replace TOKEN)
curl -s "$BASE_URL/api/trpc/admin.settings.getByKey?input=%7B%22json%22%3A%7B%22key%22%3A%22DEBUG_SQL%22%7D%7D" \
  -H "Authorization: Bearer $TOKEN"

# Update setting (mutation — POST, replace TOKEN)
curl -s -X POST "$BASE_URL/api/trpc/admin.settings.update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"json":{"key":"DEBUG_SQL","value":"true"}}'

# Reset setting (mutation — POST, replace TOKEN)
curl -s -X POST "$BASE_URL/api/trpc/admin.settings.reset" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"json":{"key":"DEBUG_SQL"}}'

# Seed data (mutation — POST, replace TOKEN)
curl -s -X POST "$BASE_URL/api/trpc/admin.data.seed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"json":{}}'

# Reset database (mutation — POST, replace TOKEN)
curl -s -X POST "$BASE_URL/api/trpc/admin.data.resetDatabase" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"json":{}}'
