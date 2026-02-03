# Docker Deployment - Studio Gabi Rego

This guide explains how to run Studio Gabi Rego using Docker for local development.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (version 20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0+)

## Quick Start

### 1. Configure environment variables

```bash
# Copy example file
cp .env.example .env

# Generate NextAuth secret
openssl rand -base64 32
# Paste the result in NEXTAUTH_SECRET in the .env file
```

### 2. Start services

```bash
# Using the start script (recommended)
npm run docker:start

# Or manually
docker compose up -d
```

### 3. Run database migrations

```bash
# First time setup
docker compose exec app npx prisma migrate deploy

# Or for development
docker compose exec app npx prisma db push
```

### 4. (Optional) Seed database with test data

```bash
docker compose exec app npx prisma db seed
```

## Services and Ports

| Service | URL | Description |
|---------|-----|-------------|
| App (Next.js) | http://localhost:3000 | Main application |
| PostgreSQL | localhost:5432 | Database |

## Useful Commands

```bash
# View logs from all services
npm run docker:logs

# View logs from a specific service
docker compose logs -f app

# Stop all services
npm run docker:stop

# Rebuild after code changes
npm run docker:build

# Restart services
docker compose restart

# Access container shell
docker compose exec app sh

# Run Prisma commands
docker compose exec app npx prisma studio
```

## Database Backup

### Local Docker Backup

```bash
# Create backup
npm run docker:backup

# Backups are saved in ./backups/

# Restore backup
gunzip -c backups/gabi_studio_XXXXXXXX_XXXXXX.sql.gz | \
  docker exec -i gabi_studio_db psql -U gabi_admin -d gabi_studio
```

### Supabase Production Backup

Pull production data from Supabase into your local Docker PostgreSQL:

```bash
# Set your Supabase direct connection URL
export DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Run the backup script
./docker/scripts/supabase-backup.sh

# Or export only (without importing)
./docker/scripts/supabase-backup.sh --export-only

# Or import a specific backup file
./docker/scripts/supabase-backup.sh --import-only backups/supabase_production_XXXXXXXX.sql.gz
```

## Troubleshooting

### Container won't start

```bash
# View detailed logs
docker compose logs app

# Check status
docker compose ps

# Restart specific container
docker compose restart app
```

### Database connection error

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# View PostgreSQL logs
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U gabi_admin -d gabi_studio -c "SELECT 1"
```

### Permission error

```bash
# Fix script permissions
chmod +x docker/scripts/*.sh
```

### Clean up and start fresh

```bash
# WARNING: This will delete all data!
docker compose down -v
docker compose up -d --build
```

## Directory Structure

```
docker/
├── postgres/
│   └── init/           # Database initialization scripts
├── scripts/
│   ├── start.sh        # Start script
│   ├── stop.sh         # Stop script
│   ├── backup.sh       # Local backup script
│   └── supabase-backup.sh  # Supabase backup script
└── README.md           # This file
```

## Updates

To update the application:

```bash
# Pull changes
git pull

# Rebuild containers
docker compose build

# Restart with new version
docker compose up -d

# Run migrations (if any)
docker compose exec app npx prisma migrate deploy
```
