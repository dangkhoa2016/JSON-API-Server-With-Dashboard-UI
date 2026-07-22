# Photos (tRPC)
# BASE_URL=http://localhost:3000
# NOTE: tRPC query procedures use GET; mutations use POST.
# Inputs are serialized with superjson: ?input={"json":{...}} for GET, {"json":{...}} body for POST.

# List (query — GET)
curl -s "$BASE_URL/api/trpc/json.photos.list?input=%7B%22json%22%3A%7B%7D%7D"

# Filter by albumId (query — GET)
curl -s "$BASE_URL/api/trpc/json.photos.list?input=%7B%22json%22%3A%7B%22filters%22%3A%7B%22albumId%22%3A%221%22%7D%7D%7D"

# Get by ID (query — GET)
curl -s "$BASE_URL/api/trpc/json.photos.getById?input=%7B%22json%22%3A%7B%22id%22%3A1%7D%7D"

# Create (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.photos.create" \
  -H "Content-Type: application/json" \
  -d '{"json":{"albumId":1,"title":"My Photo","url":"https://example.com/photo.jpg","thumbnailUrl":"https://example.com/thumb.jpg"}}'

# Update (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.photos.update" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1,"data":{"title":"Updated Title"}}}'

# Delete (mutation — POST)
curl -s -X POST "$BASE_URL/api/trpc/json.photos.delete" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":1}}'
