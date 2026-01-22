# 🐳 Gabi Rêgo Studio - Docker Deployment

Este guia explica como executar o Gabi Rêgo Studio usando Docker para hospedagem local.

## 📋 Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) (versão 20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (versão 2.0+)

## 🚀 Início Rápido

### 1. Configurar variáveis de ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Gerar chave secreta para NextAuth
openssl rand -base64 32
# Cole o resultado em NEXTAUTH_SECRET no arquivo .env
```

### 2. Iniciar os serviços

```bash
# Usando o script de inicialização (recomendado)
npm run docker:start

# Ou manualmente
docker compose up -d
```

### 3. Executar migrations do banco de dados

```bash
# Na primeira execução
docker compose exec app npx prisma migrate deploy

# Ou para desenvolvimento
docker compose exec app npx prisma db push
```

### 4. (Opcional) Popular banco com dados de teste

```bash
docker compose exec app npx prisma db seed
```

## 📍 Serviços e Portas

| Serviço | URL | Descrição |
|---------|-----|-----------|
| App (Next.js) | http://localhost:3000 | Aplicação principal |
| Nginx | http://localhost:80 | Proxy reverso |
| Evolution API | http://localhost:8080 | API do WhatsApp |
| PostgreSQL | localhost:5432 | Banco de dados |

## 🔧 Comandos Úteis

```bash
# Ver logs de todos os serviços
npm run docker:logs

# Ver logs de um serviço específico
docker compose logs -f app

# Parar todos os serviços
npm run docker:stop

# Reconstruir após alterações no código
npm run docker:build

# Reiniciar serviços
docker compose restart

# Acessar shell do container
docker compose exec app sh

# Executar comando Prisma
docker compose exec app npx prisma studio
```

## 💾 Backup do Banco de Dados

```bash
# Criar backup
npm run docker:backup

# Os backups são salvos em ./backups/

# Restaurar backup
gunzip -c backups/gabi_studio_XXXXXXXX_XXXXXX.sql.gz | \
  docker exec -i gabi_studio_db psql -U gabi_admin -d gabi_studio
```

## 🔐 Configuração do Evolution API (WhatsApp)

1. Acesse http://localhost:8080
2. Use a API key configurada em `EVOLUTION_API_KEY`
3. Crie uma instância chamada `gabi-studio`
4. Escaneie o QR Code com o WhatsApp

### Endpoints úteis:

```bash
# Criar instância
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: sua_api_key" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "gabi-studio"}'

# Obter QR Code
curl http://localhost:8080/instance/qrcode/gabi-studio \
  -H "apikey: sua_api_key"
```

## 🌐 Configuração para Produção

### 1. Configurar domínio e SSL

Edite `docker/nginx/nginx.conf`:
- Descomente o bloco de redirecionamento HTTP → HTTPS
- Descomente o bloco do servidor HTTPS
- Configure seus certificados SSL em `docker/nginx/ssl/`

### 2. Gerar certificados SSL (Let's Encrypt)

```bash
# Usando certbot
sudo certbot certonly --standalone -d seu-dominio.com.br

# Copiar certificados
cp /etc/letsencrypt/live/seu-dominio.com.br/fullchain.pem docker/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/seu-dominio.com.br/privkey.pem docker/nginx/ssl/key.pem
```

### 3. Atualizar variáveis de ambiente

```env
NODE_ENV=production
NEXTAUTH_URL=https://seu-dominio.com.br
EVOLUTION_SERVER_URL=https://seu-dominio.com.br:8080
```

### 4. Configurar firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp  # Bloquear acesso direto ao Next.js
sudo ufw deny 8080/tcp  # Bloquear acesso direto ao Evolution (opcional)
```

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker compose logs app

# Verificar status
docker compose ps

# Reiniciar container específico
docker compose restart app
```

### Erro de conexão com banco de dados

```bash
# Verificar se PostgreSQL está rodando
docker compose ps postgres

# Verificar logs do PostgreSQL
docker compose logs postgres

# Testar conexão
docker compose exec postgres psql -U gabi_admin -d gabi_studio -c "SELECT 1"
```

### Erro de permissão

```bash
# Corrigir permissões dos scripts
chmod +x docker/scripts/*.sh
```

### Limpar tudo e recomeçar

```bash
# ATENÇÃO: Isso apaga todos os dados!
docker compose down -v
docker compose up -d --build
```

## 📁 Estrutura de Arquivos

```
docker/
├── nginx/
│   ├── nginx.conf      # Configuração do Nginx
│   └── ssl/            # Certificados SSL (produção)
├── postgres/
│   └── init/           # Scripts de inicialização do banco
├── scripts/
│   ├── start.sh        # Script de inicialização
│   ├── stop.sh         # Script de parada
│   └── backup.sh       # Script de backup
└── README.md           # Este arquivo
```

## 🔄 Atualizações

Para atualizar a aplicação:

```bash
# Baixar alterações
git pull

# Reconstruir containers
docker compose build

# Reiniciar com nova versão
docker compose up -d

# Executar migrations (se houver)
docker compose exec app npx prisma migrate deploy
```

