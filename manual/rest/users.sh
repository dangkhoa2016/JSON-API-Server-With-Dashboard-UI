# Users (REST)
# BASE_URL=http://localhost:3000

# List (first 3)
curl -s "$BASE_URL/api/users?_limit=3"

# List with pagination
curl -s "$BASE_URL/api/users?_page=1&_limit=5"

# Filter by name
curl -s "$BASE_URL/api/users?name=Leanne%20Graham"

# Wildcard search
curl -s "$BASE_URL/api/users?name=*Leanne*"

# Full-text search
curl -s "$BASE_URL/api/users?q=Leanne"

# Sort by name DESC
curl -s "$BASE_URL/api/users?_sort=name&_order=desc&_limit=5"

# Get by ID
curl -s "$BASE_URL/api/users/1"

# Create
curl -s -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","username":"johndoe","email":"john@example.com"}'

# Update (PUT)
curl -s -X PUT "$BASE_URL/api/users/11" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Updated","username":"johnupdated","email":"john.new@example.com"}'

# Partial Update (PATCH)
curl -s -X PATCH "$BASE_URL/api/users/11" \
  -H "Content-Type: application/json" \
  -d '{"phone":"999-999-9999"}'

# Delete
curl -s -o /dev/null -w "HTTP %{http_code}" -X DELETE "$BASE_URL/api/users/11"
