-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN "ref_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_ref_key_key" ON "notificacoes"("ref_key");
