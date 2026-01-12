#!/bin/bash
# ==================== Gabi Studio - Docker Stop Script ====================
# Este script para todos os serviços do Gabi Studio

set -e

echo "🛑 Parando Gabi Studio..."
echo "=================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parar containers
echo -e "${YELLOW}🐳 Parando containers Docker...${NC}"
docker compose down

echo ""
echo -e "${GREEN}✅ Gabi Studio foi parado com sucesso!${NC}"
echo ""
echo "📋 Para remover volumes (APAGA DADOS):"
echo "   docker compose down -v"
echo "=================================="

