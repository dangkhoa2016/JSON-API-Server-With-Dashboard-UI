#!/usr/bin/env bash
# Posts (REST)
# BASE_URL=http://localhost:3000

# List (first 3)
curl -s "$BASE_URL/api/posts?_limit=3"

# List with pagination
curl -s "$BASE_URL/api/posts?_page=1&_limit=5"

# Filter by userId
curl -s "$BASE_URL/api/posts?userId=1"

# Full-text search
curl -s "$BASE_URL/api/posts?q=rerum"

# Sort by title ASC
curl -s "$BASE_URL/api/posts?_sort=title&_order=asc&_limit=5"

# Get by ID
curl -s "$BASE_URL/api/posts/1"

# Create
curl -s -X POST "$BASE_URL/api/posts" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"title":"My New Post","body":"This is the body."}'

# Update (PUT)
curl -s -X PUT "$BASE_URL/api/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"title":"Updated Title","body":"Updated body."}'

# Partial Update (PATCH)
curl -s -X PATCH "$BASE_URL/api/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"title":"Patched Title Only"}'

# Delete
curl -s -o /dev/null -w "HTTP %{http_code}" -X DELETE "$BASE_URL/api/posts/1"
