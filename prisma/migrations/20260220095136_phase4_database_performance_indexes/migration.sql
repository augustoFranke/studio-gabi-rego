-- CreateIndex
CREATE INDEX "membros_status_idx" ON "membros"("status");

-- CreateIndex
CREATE INDEX "agendamentos_data_idx" ON "agendamentos"("data");

-- CreateIndex
CREATE INDEX "pagamentos_status_data_vencimento_idx" ON "pagamentos"("status", "data_vencimento");

