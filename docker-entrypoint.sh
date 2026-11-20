#!/bin/sh
set -e

# Regenerate the client in case the schema changed (prisma/ is mounted as a volume)
pnpm prisma generate

# Only one service (the API) owns the schema: the realtime service skips migrations and seed
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  pnpm prisma migrate deploy

  if [ "$RUN_SEED" = "true" ]; then
    echo "Seeding database..."
    pnpm prisma db seed
  fi
fi

# Same image, different process: src/server.ts (API) or src/realtime-server.ts (Socket.io)
APP_ENTRY="${APP_ENTRY:-src/server.ts}"
echo "Starting $APP_ENTRY in watch mode..."
exec pnpm tsx watch "$APP_ENTRY"
