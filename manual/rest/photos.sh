# Photos (REST)
# BASE_URL=http://localhost:3000

# List (first 3)
curl -s "$BASE_URL/api/photos?_limit=3"

# Filter by albumId
curl -s "$BASE_URL/api/photos?albumId=1"

# Get by ID
curl -s "$BASE_URL/api/photos/1"

# Create
curl -s -X POST "$BASE_URL/api/photos" \
  -H "Content-Type: application/json" \
  -d '{"albumId":1,"title":"My Photo","url":"https://example.com/photo.jpg","thumbnailUrl":"https://example.com/thumb.jpg"}'

# Update (PUT)
curl -s -X PUT "$BASE_URL/api/photos/1" \
  -H "Content-Type: application/json" \
  -d '{"albumId":1,"title":"Updated","url":"https://ex.com/p.jpg","thumbnailUrl":"https://ex.com/t.jpg"}'

# Partial Update (PATCH)
curl -s -X PATCH "$BASE_URL/api/photos/1" \
  -H "Content-Type: application/json" \
  -d '{"title":"Patched Title"}'

# Delete
curl -s -o /dev/null -w "HTTP %{http_code}" -X DELETE "$BASE_URL/api/photos/1"
