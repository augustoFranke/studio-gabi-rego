-- CreateEnum
CREATE TYPE "PagamentoImportDecision" AS ENUM ('MATCHED', 'AMBIGUOUS', 'UNMATCHED', 'SKIPPED_NON_NUMERIC', 'SKIPPED_IDEMPOTENT', 'ERROR');

-- CreateEnum
CREATE TYPE "PagamentoImportRunStatus" AS ENUM ('DRY_RUN', 'APPLIED', 'ROLLED_BACK', 'FAILED');

-- AlterTable
ALTER TABLE "pagamentos"
ADD COLUMN "payer_nome" TEXT,
ADD COLUMN "import_run_id" TEXT,
ADD COLUMN "import_key" TEXT;

-- Drop existing member FK to recreate with SET NULL
ALTER TABLE "pagamentos" DROP CONSTRAINT "pagamentos_membro_id_fkey";

-- Allow unmatched payments without fake user
ALTER TABLE "pagamentos"
ALTER COLUMN "membro_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "pagamento_import_runs" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_filename" TEXT NOT NULL,
  "source_basename" TEXT NOT NULL,
  "competencia_mes" DATE NOT NULL,
  "status" "PagamentoImportRunStatus" NOT NULL,
  "total_rows_seen" INTEGER NOT NULL DEFAULT 0,
  "rows_with_numeric_pago" INTEGER NOT NULL DEFAULT 0,
  "inserted" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "matched" INTEGER NOT NULL DEFAULT 0,
  "ambiguous" INTEGER NOT NULL DEFAULT 0,
  "unmatched" INTEGER NOT NULL DEFAULT 0,
  "dry_run" BOOLEAN NOT NULL DEFAULT true,
  "rollback_of_run_id" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pagamento_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento_import_logs" (
  "id" TEXT NOT NULL,
  "import_run_id" TEXT NOT NULL,
  "row_index" INTEGER NOT NULL,
  "raw_name" TEXT,
  "normalized_name" TEXT,
  "raw_pago" TEXT,
  "parsed_amount" DECIMAL(10,2),
  "decision" "PagamentoImportDecision" NOT NULL,
  "match_score" DECIMAL(5,4),
  "matched_membro_id" TEXT,
  "matched_membro_nome" TEXT,
  "import_key" TEXT,
  "pagamento_id" TEXT,
  "detalhe" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pagamento_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_import_key_key" ON "pagamentos"("import_key");

-- CreateIndex
CREATE INDEX "pagamentos_import_run_id_idx" ON "pagamentos"("import_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_import_runs_batch_id_key" ON "pagamento_import_runs"("batch_id");

-- CreateIndex
CREATE INDEX "pagamento_import_runs_competencia_mes_idx" ON "pagamento_import_runs"("competencia_mes");

-- CreateIndex
CREATE INDEX "pagamento_import_logs_import_run_id_row_index_idx" ON "pagamento_import_logs"("import_run_id", "row_index");

-- CreateIndex
CREATE INDEX "pagamento_import_logs_decision_idx" ON "pagamento_import_logs"("decision");

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_membro_id_fkey"
FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_import_run_id_fkey"
FOREIGN KEY ("import_run_id") REFERENCES "pagamento_import_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_import_logs" ADD CONSTRAINT "pagamento_import_logs_import_run_id_fkey"
FOREIGN KEY ("import_run_id") REFERENCES "pagamento_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
