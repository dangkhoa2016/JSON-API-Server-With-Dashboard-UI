# Todos (tRPC)
# BASE_URL=http://localhost:3000
# NOTE: tRPC query procedures use GET; mutations use POST.
# Inputs are serialized with superjson: ?input={"json":{...}} for GET, {"json":{...}} body for POST.

# List (query — GET)
curl -s "$BASE_URL/api/trpc/json.todos.list?input=%7B%22json%22%3A%7B%7D%7D"

# Filter by userId (query — GET)
curl -s "$BASE_URL/api/trpc/json.todos.list?input=%7B%22json%22%3A%7B%22filters%22%3A%7B%22userId%22%3A%221%22%7D%7D%7D"

# Filter by completed (query — GET)
curl -s "$BASE_URL/api/trpc/json.todos.list?input=%7B%22json%22%3A%7B%22filters%22%3A%7B%22completed%22%3A%221%22%7D%7D%7D"

# Get by ID (query — GET)
curl -s "$BASE_URL/api/trpc/json.todos.getById?input=%7B%22json%22%3A%7B%22id%22%3A1%7D%7D"

# Create (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.todos.create" \
  -H "Content-Type: application/json" \
  -d '{"json":{"userId":1,"title":"My Todo","completed":false}}'

# Update (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.todos.update" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1,"data":{"title":"Updated Todo","completed":true}}}'

# Delete (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.todos.delete" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1}}'
