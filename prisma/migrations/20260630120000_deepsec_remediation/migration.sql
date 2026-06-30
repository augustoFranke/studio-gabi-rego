ALTER TYPE "StatusEntregaNotificacao" ADD VALUE IF NOT EXISTS 'PROCESSANDO';

WITH ranked_active_fichas AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY membro_id
      ORDER BY criado_em DESC, id DESC
    ) AS row_number
  FROM fichas_treino
  WHERE ativo = true
)
UPDATE fichas_treino
SET ativo = false
WHERE id IN (
  SELECT id
  FROM ranked_active_fichas
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "fichas_treino_one_active_per_membro_idx"
ON "fichas_treino"("membro_id")
WHERE "ativo" = true;
