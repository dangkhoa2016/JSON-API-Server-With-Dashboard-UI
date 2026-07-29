#!/bin/sh
set -e

esbuild db/prepare.ts --platform=node --bundle --format=esm --outfile=dist/db/prepare.js --external:drizzle-orm --external:@libsql/client --external:@node-rs/argon2 --external:dotenv --external:./seed.js --external:./seed-settings.js --external:./seed-admin.js
esbuild db/seed.js --platform=node --bundle --format=esm --outfile=dist/db/seed.js --external:drizzle-orm --external:@libsql/client
esbuild db/seed-settings.js --platform=node --bundle --format=esm --outfile=dist/db/seed-settings.js --external:drizzle-orm --external:@libsql/client --external:dotenv
esbuild db/seed-admin.js --platform=node --bundle --format=esm --outfile=dist/db/seed-admin.js --external:drizzle-orm --external:@libsql/client --external:@node-rs/argon2 --external:dotenv
