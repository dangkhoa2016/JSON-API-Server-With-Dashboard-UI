#!/usr/bin/env bash
# Albums (REST)
# BASE_URL=http://localhost:3000

# List (first 3)
curl -s "$BASE_URL/api/albums?_limit=3"

# Filter by userId
curl -s "$BASE_URL/api/albums?userId=1"

# Get by ID
curl -s "$BASE_URL/api/albums/1"

# Create
curl -s -X POST "$BASE_URL/api/albums" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"title":"My Album"}'

# Update (PUT)
curl -s -X PUT "$BASE_URL/api/albums/1" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"title":"Updated Album"}'

# Partial Update (PATCH)
curl -s -X PATCH "$BASE_URL/api/albums/1" \
  -H "Content-Type: application/json" \
  -d '{"title":"Patched Album"}'

# Delete
curl -s -o /dev/null -w "HTTP %{http_code}" -X DELETE "$BASE_URL/api/albums/1"
