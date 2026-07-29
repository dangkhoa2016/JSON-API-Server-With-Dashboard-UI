#!/bin/sh
set -e

IMAGE_TAG="${1:?Usage: $0 <image-tag>}"
CONTAINER_NAME="smoke-$$"

cleanup() {
  echo "Cleaning up..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  if [ "${RM_IMAGE:-0}" = "1" ]; then
    docker rmi "$IMAGE_TAG" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Building image $IMAGE_TAG..."
docker build -t "$IMAGE_TAG" .

echo "Checking runtime artifacts..."
docker run --rm --entrypoint sh "$IMAGE_TAG" -c \
  'test -f dist/boot.js && test -f dist/db/prepare.js'
echo "Runtime artifacts OK."

echo "Running container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 0:3000 \
  -e APP_SECRET=test-secret \
  -e ADMIN_PASSWORD=test-password \
  -e CORS_ORIGINS=http://127.0.0.1 \
  "$IMAGE_TAG"

echo "Reading assigned host port..."
HOST_PORT=$(docker port "$CONTAINER_NAME" 3000 | cut -d: -f2)
if [ -z "$HOST_PORT" ]; then
  echo "FAILED: could not determine host port"
  exit 1
fi

echo "Waiting for health endpoint on port $HOST_PORT..."
for i in $(seq 1 60); do
  if curl -sf "http://localhost:$HOST_PORT/api/health" > /dev/null 2>&1; then
    echo "Container is healthy after ${i}s"
    exit 0
  fi
  sleep 1
done

echo "FAILED: Container did not become healthy within 60 seconds"
echo "=== Container logs ==="
docker logs "$CONTAINER_NAME"
exit 1
