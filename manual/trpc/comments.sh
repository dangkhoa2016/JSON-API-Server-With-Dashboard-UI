# Comments (tRPC)
# BASE_URL=http://localhost:3000
# NOTE: tRPC query procedures use GET; mutations use POST.
# Inputs are serialized with superjson: ?input={"json":{...}} for GET, {"json":{...}} body for POST.

# List (query — GET)
curl -s "$BASE_URL/api/trpc/json.comments.list?input=%7B%22json%22%3A%7B%7D%7D"

# Filter by postId (query — GET)
curl -s "$BASE_URL/api/trpc/json.comments.list?input=%7B%22json%22%3A%7B%22filters%22%3A%7B%22postId%22%3A%221%22%7D%7D%7D"

# Full-text search (query — GET)
curl -s "$BASE_URL/api/trpc/json.comments.list?input=%7B%22json%22%3A%7B%22q%22%3A%22laudantium%22%7D%7D"

# Get by ID (query — GET)
curl -s "$BASE_URL/api/trpc/json.comments.getById?input=%7B%22json%22%3A%7B%22id%22%3A1%7D%7D"

# Create (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.comments.create" \
  -H "Content-Type: application/json" \
  -d '{"json":{"postId":1,"name":"Test Comment","email":"test@test.com","body":"Comment body."}}'

# Update (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.comments.update" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1,"data":{"name":"Updated Name"}}}'

# Delete (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.comments.delete" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1}}'
