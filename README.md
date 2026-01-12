# Gabi Studio - Sistema de Gestão

Sistema de gestão para estúdio de Pilates desenvolvido com Next.js 16, TypeScript, Tailwind CSS, Prisma e PostgreSQL.

## 🚀 Tecnologias

- **Next.js 16** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS v4** - Estilização
- **shadcn/ui** - Componentes de UI
- **Prisma** - ORM para banco de dados
- **PostgreSQL** - Banco de dados
- **NextAuth.js** - Autenticação
- **Docker** - Containerização do banco de dados

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── (admin)/           # Rotas do painel administrativo
│   │   ├── dashboard/     # Visão geral
│   │   ├── membros/       # Gestão de membros
│   │   ├── agenda/        # Agenda semanal
│   │   ├── financeiro/    # Planos e pagamentos
│   │   └── treinos/       # Fichas de treino
│   ├── (auth)/            # Rotas de autenticação
│   │   └── login/         # Página de login
│   ├── (membro)/          # Rotas do painel do membro
│   │   ├── meus-dados/    # Dados pessoais
│   │   ├── minha-agenda/  # Agendamentos
│   │   └── meu-treino/    # Ficha de treino
│   └── api/               # API Routes
│       ├── auth/          # NextAuth
│       ├── membros/       # CRUD membros
│       ├── agendamentos/  # CRUD agendamentos
│       ├── planos/        # CRUD planos
│       ├── pagamentos/    # CRUD pagamentos
│       ├── treinos/       # CRUD fichas de treino
│       └── notificacoes/  # CRUD notificações
├── components/
│   ├── ui/                # Componentes shadcn/ui
│   ├── forms/             # Formulários
│   ├── agenda/            # Componentes da agenda
│   └── treino/            # Componentes de treino
└── lib/
    ├── prisma.ts          # Cliente Prisma
    ├── auth.ts            # Configuração NextAuth
    ├── evolution.ts       # Cliente Evolution API (WhatsApp)
    ├── resend.ts          # Cliente Resend (Email)
    ├── pdf.ts             # Gerador de PDF
    ├── scheduler.ts       # Agendador de tarefas
    └── validators.ts      # Validadores (CPF, etc)
```

## 🛠️ Configuração

### 1. Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- npm

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

### 4. Iniciar o banco de dados (Local)

```bash
docker-compose up -d
```

### 5. Executar migrações e seed

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 6. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 👤 Usuário Padrão

- **Email:** admin@gabistudio.com.br
- **Senha:** admin123

## 🌐 Deployment

### Vercel + Supabase

Este projeto está configurado para deploy em:
- **Vercel** - Hospedagem da aplicação Next.js
- **Supabase** - Banco de dados PostgreSQL

Para deploy em produção, configure as variáveis de ambiente no Vercel Dashboard.

## 📝 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Compila para produção |
| `npm run vercel-build` | Build para Vercel (com migrations) |
| `npm run db:generate` | Gera cliente Prisma |
| `npm run db:push` | Aplica schema ao banco |
| `npm run db:migrate` | Cria e aplica migrações |
| `npm run db:seed` | Popula banco com dados iniciais |
| `npm run db:studio` | Abre Prisma Studio |

## 📄 Licença

Este projeto é privado e de uso exclusivo do Gabi Studio.
