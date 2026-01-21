#!/bin/bash
# ==================== Studio Gabi Rêgo - Docker Start Script ====================
# Este script inicializa todos os serviços do Studio Gabi Rêgo

set -e

echo "🚀 Iniciando Studio Gabi Rêgo..."
echo "=================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar se um serviço está pronto
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=${3:-30}
    local attempt=1

    echo -e "${YELLOW}⏳ Aguardando $service...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service está pronto!${NC}"
            return 0
        fi
        echo "   Tentativa $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ $service não respondeu após $max_attempts tentativas${NC}"
    return 1
}

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando. Por favor, inicie o Docker primeiro.${NC}"
    exit 1
fi

# Criar arquivo .env se não existir
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Criando arquivo .env a partir de .env.example...${NC}"
    cp .env.example .env
    
    # Gerar NEXTAUTH_SECRET automaticamente
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    sed -i.bak "s/sua_chave_secreta_aqui_gere_com_openssl/$NEXTAUTH_SECRET/" .env
    rm -f .env.bak
    
    echo -e "${GREEN}✅ Arquivo .env criado. Edite-o com suas configurações.${NC}"
fi

# Iniciar containers
echo -e "${YELLOW}🐳 Iniciando containers Docker...${NC}"
docker compose up -d

# Aguardar serviços
echo ""
wait_for_service "PostgreSQL" "localhost:5432" 30 || true
wait_for_service "Next.js App" "http://localhost:3000/api/health" 60
wait_for_service "Evolution API" "http://localhost:8080" 30 || true

# Executar migrations do Prisma
echo ""
echo -e "${YELLOW}🔄 Executando migrations do banco de dados...${NC}"
docker compose exec -T app npx prisma migrate deploy 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Migrations não aplicadas (pode ser a primeira execução)${NC}"
    echo -e "${YELLOW}   Execute 'npm run db:push' manualmente se necessário${NC}"
}

# Resumo
echo ""
echo "=================================="
echo -e "${GREEN}🎉 Studio Gabi Rêgo está rodando!${NC}"
echo ""
echo "📍 Endereços:"
echo "   • App:          http://localhost:3000"
echo "   • Nginx:        http://localhost:80"
echo "   • Evolution:    http://localhost:8080"
echo "   • PostgreSQL:   localhost:5432"
echo ""
echo "📋 Comandos úteis:"
echo "   • Ver logs:     docker compose logs -f"
echo "   • Parar:        docker compose down"
echo "   • Reconstruir:  docker compose up -d --build"
echo "=================================="

