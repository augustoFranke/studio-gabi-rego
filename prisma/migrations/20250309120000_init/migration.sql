-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBRO');

-- CreateEnum
CREATE TYPE "StatusMembro" AS ENUM ('ATIVO', 'INATIVO', 'PENDENTE');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('LEMBRETE_AULA', 'COBRANCA', 'ANIVERSARIO', 'AVISO_GERAL');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MASCULINO', 'FEMININO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "nome" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBRO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "email_verificado" TIMESTAMP(3),
    "token_verificacao" TEXT,
    "token_verificacao_expira" TIMESTAMP(3),
    "token_reset" TEXT,
    "token_reset_expira" TIMESTAMP(3),
    "etapa_onboarding" INTEGER NOT NULL DEFAULT 1,
    "onboarding_completo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "cpf" TEXT,
    "rg" TEXT,
    "telefone" TEXT,
    "data_nascimento" TIMESTAMP(3),
    "observacoes" TEXT,
    "status" "StatusMembro" NOT NULL DEFAULT 'PENDENTE',
    "foto_url" TEXT,
    "sexo" "Sexo",
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "anamnese_token" TEXT,
    "anamnese_token_expira" TIMESTAMP(3),
    "plano_id" TEXT,
    "preco_customizado" DECIMAL(10,2),

    CONSTRAINT "membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "duracao_dias" INTEGER NOT NULL,
    "aulas_semanais" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_disponiveis" (
    "id" TEXT NOT NULL,
    "dia_semana" "DiaSemana" NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fim" TEXT NOT NULL,
    "vagas_total" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horarios_disponiveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "membro_id" TEXT NOT NULL,
    "horario_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "presente" BOOLEAN,
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "membro_id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data_vencimento" DATE NOT NULL,
    "data_pagamento" TIMESTAMP(3),
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "forma_pagamento" TEXT,
    "comprovante" TEXT,
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichas_treino" (
    "id" TEXT NOT NULL,
    "membro_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data" TEXT,
    "objetivo" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fichas_treino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercicios" (
    "id" TEXT NOT NULL,
    "ficha_id" TEXT NOT NULL,
    "sessao" TEXT NOT NULL DEFAULT 'A',
    "nome" TEXT NOT NULL,
    "grupo_muscular" TEXT,
    "series" TEXT NOT NULL,
    "repeticoes" TEXT NOT NULL,
    "descanso" TEXT,
    "observacoes" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinos_template" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "objetivo" TEXT,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinos_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinos_template_exercicios" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "sessao" TEXT NOT NULL DEFAULT 'A',
    "nome" TEXT NOT NULL,
    "grupo_muscular" TEXT,
    "series" TEXT NOT NULL,
    "repeticoes" TEXT NOT NULL,
    "descanso" TEXT,
    "observacoes" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinos_template_exercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "membro_id" TEXT,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "enviada" BOOLEAN NOT NULL DEFAULT false,
    "enviada_em" TIMESTAMP(3),
    "agendada_para" TIMESTAMP(3),
    "canal_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "canal_email" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamneses" (
    "id" TEXT NOT NULL,
    "membro_id" TEXT NOT NULL,
    "altura" TEXT,
    "peso_atual" TEXT,
    "objetivo" TEXT,
    "pratica_atividade" TEXT,
    "pratica_atividade_qual" TEXT,
    "tempo_sedentario" TEXT,
    "condicao_medica" TEXT,
    "condicao_medica_qual" TEXT,
    "lesao" TEXT,
    "lesao_qual" TEXT,
    "restricao_movimento" TEXT,
    "restricao_movimento_qual" TEXT,
    "desconforto_movimento" TEXT,
    "desconforto_movimento_qual" TEXT,
    "problemas_ortopedicos" TEXT,
    "problemas_ortopedicos_qual" TEXT,
    "medicamento_controlado" TEXT,
    "medicamento_controlado_qual" TEXT,
    "obeso_sobrepeso" TEXT,
    "colesterol_elevado" TEXT,
    "taquicardia" TEXT,
    "doencas_cardiacas" TEXT,
    "diabetes" TEXT,
    "dificuldade_exercicio" TEXT,
    "ciclo_menstrual" TEXT,
    "experiencia_musculacao" TEXT,
    "onde_conheceu" TEXT,
    "expectativas" TEXT,
    "parq1" TEXT,
    "parq2" TEXT,
    "parq3" TEXT,
    "parq4" TEXT,
    "parq5" TEXT,
    "parq6" TEXT,
    "parq7" TEXT,
    "nextfit_avaliacao_id" TEXT,
    "sincronizado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamneses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descricao" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_token_verificacao_key" ON "usuarios"("token_verificacao");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_token_reset_key" ON "usuarios"("token_reset");

-- CreateIndex
CREATE UNIQUE INDEX "membros_usuario_id_key" ON "membros"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "membros_cpf_key" ON "membros"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "membros_anamnese_token_key" ON "membros"("anamnese_token");

-- CreateIndex
CREATE UNIQUE INDEX "agendamentos_membro_id_horario_id_data_key" ON "agendamentos"("membro_id", "horario_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "anamneses_membro_id_key" ON "anamneses"("membro_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_chave_key" ON "configuracoes"("chave");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "horarios_disponiveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_treino" ADD CONSTRAINT "fichas_treino_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercicios" ADD CONSTRAINT "exercicios_ficha_id_fkey" FOREIGN KEY ("ficha_id") REFERENCES "fichas_treino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinos_template_exercicios" ADD CONSTRAINT "treinos_template_exercicios_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "treinos_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

