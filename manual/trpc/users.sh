#!/usr/bin/env bash
# Users (tRPC)
# BASE_URL=http://localhost:3000
# NOTE: tRPC query procedures use GET; mutations use POST.
# Inputs are serialized with superjson: ?input={"json":{...}} for GET, {"json":{...}} body for POST.

# List (query — GET)
curl -s "$BASE_URL/api/trpc/json.users.list?input=%7B%22json%22%3A%7B%7D%7D"

# List with pagination & sort (query — GET)
curl -s "$BASE_URL/api/trpc/json.users.list?input=%7B%22json%22%3A%7B%22limit%22%3A3%2C%22page%22%3A1%2C%22sort%22%3A%22name%22%2C%22order%22%3A%22desc%22%7D%7D"

# Full-text search (query — GET)
curl -s "$BASE_URL/api/trpc/json.users.list?input=%7B%22json%22%3A%7B%22q%22%3A%22Leanne%22%7D%7D"

# Filter by name (query — GET)
curl -s "$BASE_URL/api/trpc/json.users.list?input=%7B%22json%22%3A%7B%22filters%22%3A%7B%22name%22%3A%22*Leanne*%22%7D%7D%7D"

# Get by ID (query — GET)
curl -s "$BASE_URL/api/trpc/json.users.getById?input=%7B%22json%22%3A%7B%22id%22%3A1%7D%7D"

# Create (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.users.create" \
  -H "Content-Type: application/json" \
  -d '{"json":{"name":"John Doe","username":"johndoe","email":"john@example.com"}}'

# Update (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.users.update" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":11,"data":{"name":"John Updated","email":"john.new@example.com"}}}'

# Delete (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.users.delete" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":11}}'
