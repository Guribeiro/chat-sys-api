#!/bin/sh
set -e

echo "Applying database migrations..."
pnpm prisma migrate deploy

# Regenerate the client in case the schema changed (prisma/ is mounted as a volume)
pnpm prisma generate

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  pnpm prisma db seed
fi

echo "Starting API in watch mode..."
exec pnpm tsx watch src/server.ts
