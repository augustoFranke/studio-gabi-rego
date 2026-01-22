#!/bin/bash
# ==================== Gabi Rêgo Studio - Database Backup Script ====================
# Este script cria um backup do banco de dados PostgreSQL

set -e

# Configurações
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/gabi_studio_$TIMESTAMP.sql"
CONTAINER_NAME="gabi_studio_db"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "💾 Backup do Banco de Dados - Gabi Rêgo Studio"
echo "=================================="

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Verificar se o container está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}❌ Container PostgreSQL não está rodando${NC}"
    echo "   Execute 'docker compose up -d' primeiro"
    exit 1
fi

# Criar backup
echo -e "${YELLOW}⏳ Criando backup...${NC}"
docker exec -t "$CONTAINER_NAME" pg_dump -U gabi_admin -d gabi_studio > "$BACKUP_FILE"

# Comprimir backup
echo -e "${YELLOW}📦 Comprimindo backup...${NC}"
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

# Calcular tamanho
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo -e "${GREEN}✅ Backup criado com sucesso!${NC}"
echo ""
echo "📁 Arquivo: $BACKUP_FILE"
echo "📊 Tamanho: $SIZE"
echo ""
echo "📋 Para restaurar:"
echo "   gunzip -c $BACKUP_FILE | docker exec -i $CONTAINER_NAME psql -U gabi_admin -d gabi_studio"
echo "=================================="

# Limpar backups antigos (manter últimos 7 dias)
echo ""
echo -e "${YELLOW}🧹 Limpando backups antigos (>7 dias)...${NC}"
find "$BACKUP_DIR" -name "gabi_studio_*.sql.gz" -mtime +7 -delete
echo -e "${GREEN}✅ Limpeza concluída${NC}"

