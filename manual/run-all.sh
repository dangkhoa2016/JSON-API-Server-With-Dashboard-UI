# Run all manual tests
# BASE_URL=http://localhost:3000

echo "=== REST endpoints ==="
for f in rest/*.sh; do
  echo "--- $f ---"
  BASE_URL=$BASE_URL sh "$f"
done

echo ""
echo "=== tRPC endpoints ==="
for f in trpc/*.sh; do
  echo "--- $f ---"
  BASE_URL=$BASE_URL sh "$f"
done
