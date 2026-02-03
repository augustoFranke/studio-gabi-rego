#!/bin/bash
# ==================== Studio Gabi Rego - Supabase Backup Script ====================
# This script pulls production data from Supabase and imports it into local Docker PostgreSQL
# Usage: ./docker/scripts/supabase-backup.sh [--export-only] [--import-only]

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/supabase_production_$TIMESTAMP.sql"
LOCAL_CONTAINER="gabi_studio_db"
LOCAL_USER="${POSTGRES_USER:-gabi_admin}"
LOCAL_DB="${POSTGRES_DB:-gabi_studio}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
EXPORT_ONLY=false
IMPORT_ONLY=false
BACKUP_TO_IMPORT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --export-only)
            EXPORT_ONLY=true
            shift
            ;;
        --import-only)
            IMPORT_ONLY=true
            BACKUP_TO_IMPORT="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Supabase -> Local Docker Backup Tool${NC}"
echo -e "${BLUE}  Studio Gabi Rego${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ==================== EXPORT FROM SUPABASE ====================
if [ "$IMPORT_ONLY" = false ]; then
    echo -e "${YELLOW}Step 1: Export from Supabase${NC}"
    echo "=================================="
    
    # Check for DIRECT_URL (required for Supabase export)
    if [ -z "$DIRECT_URL" ]; then
        # Try to load from .env files
        if [ -f ".env" ]; then
            export $(grep -v '^#' .env | grep DIRECT_URL | xargs)
        fi
        if [ -f ".env.production" ]; then
            export $(grep -v '^#' .env.production | grep DIRECT_URL | xargs)
        fi
    fi
    
    if [ -z "$DIRECT_URL" ]; then
        echo -e "${RED}Error: DIRECT_URL environment variable not set${NC}"
        echo ""
        echo "Please set your Supabase direct connection URL:"
        echo "  export DIRECT_URL=\"postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres\""
        echo ""
        echo "You can find this in Supabase Dashboard -> Settings -> Database -> Connection String -> URI (Direct)"
        echo "Make sure to use port 5432 (direct), not 6543 (pooled)"
        exit 1
    fi
    
    echo -e "${YELLOW}Connecting to Supabase...${NC}"
    echo ""
    
    # Export using pg_dump
    # --no-owner: Don't set ownership (we'll use local user)
    # --no-acl: Skip access control (permissions)
    # --clean: Drop objects before creating
    # --if-exists: Use IF EXISTS when dropping
    echo -e "${YELLOW}Exporting database (this may take a moment)...${NC}"
    
    # Use PostgreSQL 17 pg_dump if available (required for Supabase PostgreSQL 17)
    PG_DUMP="pg_dump"
    if [ -x "/opt/homebrew/opt/postgresql@17/bin/pg_dump" ]; then
        PG_DUMP="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
    fi
    
    if $PG_DUMP "$DIRECT_URL" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        --exclude-schema=_analytics \
        --exclude-schema=_realtime \
        --exclude-schema=_supavisor \
        --exclude-schema=auth \
        --exclude-schema=extensions \
        --exclude-schema=graphql \
        --exclude-schema=graphql_public \
        --exclude-schema=pgsodium \
        --exclude-schema=pgsodium_masks \
        --exclude-schema=realtime \
        --exclude-schema=storage \
        --exclude-schema=supabase_functions \
        --exclude-schema=supabase_migrations \
        --exclude-schema=vault \
        > "$BACKUP_FILE" 2>/dev/null; then
        
        echo -e "${GREEN}Export successful!${NC}"
    else
        echo -e "${RED}Export failed. Check your DIRECT_URL connection string.${NC}"
        exit 1
    fi
    
    # Compress the backup
    echo -e "${YELLOW}Compressing backup...${NC}"
    gzip "$BACKUP_FILE"
    BACKUP_FILE="$BACKUP_FILE.gz"
    
    # Show file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo ""
    echo -e "${GREEN}Backup created: $BACKUP_FILE ($SIZE)${NC}"
    
    if [ "$EXPORT_ONLY" = true ]; then
        echo ""
        echo -e "${GREEN}Export complete! (--export-only mode)${NC}"
        echo ""
        echo "To import later, run:"
        echo "  ./docker/scripts/supabase-backup.sh --import-only $BACKUP_FILE"
        exit 0
    fi
else
    # Import-only mode: use specified backup file
    if [ -z "$BACKUP_TO_IMPORT" ] || [ ! -f "$BACKUP_TO_IMPORT" ]; then
        echo -e "${RED}Error: Please specify a valid backup file${NC}"
        echo "Usage: ./docker/scripts/supabase-backup.sh --import-only <backup-file.sql.gz>"
        exit 1
    fi
    BACKUP_FILE="$BACKUP_TO_IMPORT"
    echo -e "${YELLOW}Using backup file: $BACKUP_FILE${NC}"
fi

# ==================== IMPORT INTO LOCAL DOCKER ====================
echo ""
echo -e "${YELLOW}Step 2: Import into local Docker PostgreSQL${NC}"
echo "=============================================="

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${LOCAL_CONTAINER}$"; then
    echo -e "${YELLOW}PostgreSQL container not running. Starting...${NC}"
    docker compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
    for i in {1..30}; do
        if docker exec "$LOCAL_CONTAINER" pg_isready -U "$LOCAL_USER" -d "$LOCAL_DB" > /dev/null 2>&1; then
            echo -e "${GREEN}PostgreSQL is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}Timeout waiting for PostgreSQL${NC}"
            exit 1
        fi
        sleep 1
    done
fi

# Ask for confirmation before wiping local DB
echo ""
echo -e "${RED}WARNING: This will REPLACE all data in local database!${NC}"
echo -e "Local container: ${BLUE}$LOCAL_CONTAINER${NC}"
echo -e "Local database: ${BLUE}$LOCAL_DB${NC}"
echo ""
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

# Import the backup
echo ""
echo -e "${YELLOW}Importing backup into local database...${NC}"

if gunzip -c "$BACKUP_FILE" | docker exec -i "$LOCAL_CONTAINER" psql -U "$LOCAL_USER" -d "$LOCAL_DB" > /dev/null 2>&1; then
    echo -e "${GREEN}Import successful!${NC}"
else
    echo -e "${YELLOW}Import completed with some warnings (this is usually fine)${NC}"
fi

# Verify import
echo ""
echo -e "${YELLOW}Verifying import...${NC}"
echo ""

# Count records in key tables
echo "Record counts:"
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_USER" -d "$LOCAL_DB" -c "
SELECT 
    (SELECT COUNT(*) FROM usuarios) as usuarios,
    (SELECT COUNT(*) FROM membros) as membros,
    (SELECT COUNT(*) FROM planos) as planos,
    (SELECT COUNT(*) FROM pagamentos) as pagamentos,
    (SELECT COUNT(*) FROM agendamentos) as agendamentos;
" 2>/dev/null || echo "(Could not verify - tables may not exist yet. Run migrations first.)"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Backup and import complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Backup saved at: $BACKUP_FILE"
echo ""
echo "Next steps:"
echo "  1. Run migrations if needed: docker compose exec app npx prisma migrate deploy"
echo "  2. Verify data: docker compose exec app npx prisma studio"
echo ""
