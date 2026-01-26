#!/bin/bash

# Load environment variables from .env if present
if [ -f .env ]; then
  # Safely export variables, ignoring comments and empty lines
  set -a
  source .env
  set +a
fi

# Local DB defaults (matching docker-compose)
LOCAL_USER=${POSTGRES_USER:-gabi_admin}
LOCAL_DB=${POSTGRES_DB:-gabi_studio}
LOCAL_PORT=5432
LOCAL_HOST=localhost

echo "=== Studio Gabi Rego Database Migration Tool ==="
echo "Local DB: $LOCAL_DB (User: $LOCAL_USER)"

# Check for password
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "⚠️  POSTGRES_PASSWORD not found in environment."
    read -s -p "Enter local database password: " POSTGRES_PASSWORD
    echo
fi

# Get Remote URL
if [ -z "$1" ]; then
    echo ""
    echo "Please enter your Supabase Connection String."
    echo "Tip: Use the 'Transaction Pooler' connection string (port 6543) for best results during import,"
    echo "or the 'Session' connection string (port 5432)."
    echo "Format: postgres://postgres.project:password@aws-0-region.pooler.supabase.com:6543/postgres"
    echo ""
    read -p "Connection String: " REMOTE_URL
else
    REMOTE_URL=$1
fi

if [ -z "$REMOTE_URL" ]; then
    echo "❌ Error: Supabase connection string is required."
    exit 1
fi

echo ""
echo "⏳ Step 1: Dumping local database..."

# Use docker exec to ensure pg_dump version matches the database version
# and to avoid requiring local postgres installation/configuration
CONTAINER_NAME="gabi_studio_db"

if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Error: Container '$CONTAINER_NAME' is not running."
    echo "Please run 'docker compose up -d' first."
    exit 1
fi

echo "Using pg_dump from inside container '$CONTAINER_NAME'..."

# We execute pg_dump inside the container and stream output to host file
# We don't need PGPASSWORD here because we can run as the postgres user or trust local socket
docker exec $CONTAINER_NAME pg_dump -U $LOCAL_USER -d $LOCAL_DB \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --quote-all-identifiers \
  > dump.sql

if [ $? -ne 0 ]; then
    echo "❌ Error dumping database."
    echo "Make sure:"
    echo "1. The Docker container is running (docker compose up -d)"
    echo "2. Port 5432 is exposed and not blocked"
    echo "3. The password is correct"
    if [ -f dump.sql ]; then rm dump.sql; fi
    exit 1
fi

echo "✅ Local dump successful (saved to dump.sql)"

echo ""
echo "⏳ Step 2: Restoring to Supabase..."
echo "This might take a while depending on the database size."

psql "$REMOTE_URL" < dump.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo "Cleaning up..."
    rm dump.sql
else
    echo ""
    echo "❌ Error restoring to Supabase."
    echo "The dump file 'dump.sql' has been preserved for inspection."
fi
