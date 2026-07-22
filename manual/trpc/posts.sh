# Posts (tRPC)
# BASE_URL=http://localhost:3000
# NOTE: tRPC query procedures use GET; mutations use POST.
# Inputs are serialized with superjson: ?input={"json":{...}} for GET, {"json":{...}} body for POST.

# List (query — GET)
curl -s "$BASE_URL/api/trpc/json.posts.list?input=%7B%22json%22%3A%7B%7D%7D"

# List with pagination (query — GET)
curl -s "$BASE_URL/api/trpc/json.posts.list?input=%7B%22json%22%3A%7B%22limit%22%3A3%2C%22sort%22%3A%22title%22%2C%22order%22%3A%22asc%22%7D%7D"

# Full-text search (query — GET)
curl -s "$BASE_URL/api/trpc/json.posts.list?input=%7B%22json%22%3A%7B%22q%22%3A%22rerum%22%7D%7D"

# Filter by userId (query — GET)
curl -s "$BASE_URL/api/trpc/json.posts.list?input=%7B%22json%22%3A%7B%22filters%22%3A%7B%22userId%22%3A%221%22%7D%7D%7D"

# Get by ID (query — GET)
curl -s "$BASE_URL/api/trpc/json.posts.getById?input=%7B%22json%22%3A%7B%22id%22%3A1%7D%7D"

# Create (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.posts.create" \
  -H "Content-Type: application/json" \
  -d '{"json":{"userId":1,"title":"My New Post","body":"This is the body."}}'

# Update (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.posts.update" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1,"data":{"title":"Updated Title","body":"Updated body."}}}'

# Delete (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.posts.delete" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1}}'
