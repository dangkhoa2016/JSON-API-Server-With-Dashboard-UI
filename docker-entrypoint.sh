#!/bin/sh
set -e

# Export all .env vars to shell so child processes inherit them
set -a
if [ -f .env ]; then
  . ./.env
elif [ -f .env.example ]; then
  . ./.env.example
fi
# Set defaults for any missing required values
DATABASE_URL="${DATABASE_URL:-file:./data/local.db}"
APP_SECRET="${APP_SECRET:-changeme}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ERROR: ADMIN_PASSWORD must be set}"
set +a

mkdir -p /app/data

echo "Pushing database schema..."
yarn db:push

if [ "${SKIP_SEED:-false}" = "true" ]; then
  echo "SKIP_SEED=true, skipping database seeding."
elif [ ! -f /app/data/.seeded ]; then
  echo "Seeding database..."
  yarn db:seed
  yarn db:seed:settings
  yarn db:seed:admin
  touch /app/data/.seeded
  echo "Seeding complete."
else
  echo "Database already seeded, skipping."
fi

exec "$@"
