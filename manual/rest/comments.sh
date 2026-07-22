#!/usr/bin/env bash
# Comments (REST)
# BASE_URL=http://localhost:3000

# List (first 3)
curl -s "$BASE_URL/api/comments?_limit=3"

# Filter by postId
curl -s "$BASE_URL/api/comments?postId=1"

# Full-text search
curl -s "$BASE_URL/api/comments?q=laudantium"

# Get by ID
curl -s "$BASE_URL/api/comments/1"

# Create
curl -s -X POST "$BASE_URL/api/comments" \
  -H "Content-Type: application/json" \
  -d '{"postId":1,"name":"Test Comment","email":"test@test.com","body":"Comment body."}'

# Update (PUT)
curl -s -X PUT "$BASE_URL/api/comments/1" \
  -H "Content-Type: application/json" \
  -d '{"postId":1,"name":"Updated","email":"u@t.com","body":"Updated body."}'

# Partial Update (PATCH)
curl -s -X PATCH "$BASE_URL/api/comments/1" \
  -H "Content-Type: application/json" \
  -d '{"name":"Patched Name"}'

# Delete
curl -s -o /dev/null -w "HTTP %{http_code}" -X DELETE "$BASE_URL/api/comments/1"
