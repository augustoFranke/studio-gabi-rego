-- Additive indexes for production read paths found in scheduling, finance,
-- training, and notification services.

CREATE INDEX "membros_plano_id_idx" ON "membros"("plano_id");

CREATE INDEX "agendamentos_horario_id_data_idx" ON "agendamentos"("horario_id", "data");
CREATE INDEX "agendamentos_membro_id_data_idx" ON "agendamentos"("membro_id", "data");

CREATE INDEX "horarios_fixos_dia_semana_hora_idx" ON "horarios_fixos"("dia_semana", "hora");

CREATE INDEX "pagamentos_membro_id_data_vencimento_idx" ON "pagamentos"("membro_id", "data_vencimento");
CREATE INDEX "pagamentos_status_data_pagamento_idx" ON "pagamentos"("status", "data_pagamento");

CREATE INDEX "fichas_treino_membro_id_ativo_idx" ON "fichas_treino"("membro_id", "ativo");
CREATE INDEX "exercicios_ficha_id_sessao_ordem_idx" ON "exercicios"("ficha_id", "sessao", "ordem");
CREATE INDEX "treinos_template_exercicios_template_id_sessao_ordem_idx"
  ON "treinos_template_exercicios"("template_id", "sessao", "ordem");

CREATE INDEX "notificacoes_membro_id_tipo_criado_em_idx" ON "notificacoes"("membro_id", "tipo", "criado_em");
CREATE INDEX "notificacoes_status_entrega_agendada_para_idx" ON "notificacoes"("status_entrega", "agendada_para");
