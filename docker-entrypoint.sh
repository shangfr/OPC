#!/bin/bash
set -e

echo "=== OPCBot Docker Entrypoint ==="

# Run database migration if POSTGRES_URL is set
if [ -n "$POSTGRES_URL" ] || [ -n "$POSTGRES_URL_NON_POOLING" ]; then
  echo "Running database migrations..."
  pnpm exec tsx lib/db/migrate.ts || echo "Migration failed, continuing startup..."
else
  echo "POSTGRES_URL not set, skipping migrations."
fi

echo "Starting application..."
exec "$@"
