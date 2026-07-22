# Todos (REST)
# BASE_URL=http://localhost:3000

# List (first 3)
curl -s "$BASE_URL/api/todos?_limit=3"

# Filter by userId
curl -s "$BASE_URL/api/todos?userId=1"

# Filter by completed status
curl -s "$BASE_URL/api/todos?completed=1"

# Get by ID
curl -s "$BASE_URL/api/todos/1"

# Create
curl -s -X POST "$BASE_URL/api/todos" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"title":"My Todo","completed":false}'

# Update (PUT)
curl -s -X PUT "$BASE_URL/api/todos/1" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"title":"Updated Todo","completed":true}'

# Partial Update (PATCH)
curl -s -X PATCH "$BASE_URL/api/todos/1" \
  -H "Content-Type: application/json" \
  -d '{"title":"Patched Todo"}'

# Delete
curl -s -o /dev/null -w "HTTP %{http_code}" -X DELETE "$BASE_URL/api/todos/1"
