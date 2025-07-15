#!/bin/sh
set -e

mkdir -p /app/data

echo "Pushing database schema..."
yarn db:push

if [ ! -f /app/data/.seeded ]; then
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
