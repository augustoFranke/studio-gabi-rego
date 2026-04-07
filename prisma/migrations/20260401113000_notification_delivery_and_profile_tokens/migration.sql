CREATE TYPE "StatusEntregaNotificacao" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHA');

ALTER TABLE "usuarios"
ADD COLUMN "token_perfil" TEXT,
ADD COLUMN "token_perfil_expira" TIMESTAMP(3);

CREATE UNIQUE INDEX "usuarios_token_perfil_key" ON "usuarios"("token_perfil");

ALTER TABLE "notificacoes"
ADD COLUMN "status_entrega" "StatusEntregaNotificacao" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN "tentativas_entrega" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ultima_tentativa_em" TIMESTAMP(3),
ADD COLUMN "ultimo_erro" TEXT,
ADD COLUMN "chave_dedupe" TEXT;

UPDATE "notificacoes"
SET
  "status_entrega" = CASE
    WHEN "enviada" = true THEN 'ENVIADA'::"StatusEntregaNotificacao"
    ELSE 'PENDENTE'::"StatusEntregaNotificacao"
  END,
  "tentativas_entrega" = CASE
    WHEN "enviada" = true THEN 1
    ELSE 0
  END,
  "ultima_tentativa_em" = "enviada_em";

CREATE UNIQUE INDEX "notificacoes_chave_dedupe_key" ON "notificacoes"("chave_dedupe");
