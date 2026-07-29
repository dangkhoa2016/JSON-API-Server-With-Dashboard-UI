#!/bin/sh
set -e

# Export all .env vars to shell so child processes inherit them
set -a
if [ -f .env ]; then
  . ./.env
fi
# Set defaults for any missing required values
DATABASE_URL="${DATABASE_URL:-file:./data/local.db}"
APP_SECRET="${APP_SECRET:?ERROR: APP_SECRET must be set}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ERROR: ADMIN_PASSWORD must be set}"
set +a

mkdir -p /app/data

if [ "${SKIP_SEED:-false}" != "true" ] && [ ! -f /app/data/.seeded ]; then
  echo "Running database preparation..."
  yarn db:prepare
  touch /app/data/.seeded
  echo "Database preparation complete."
fi

exec "$@"
