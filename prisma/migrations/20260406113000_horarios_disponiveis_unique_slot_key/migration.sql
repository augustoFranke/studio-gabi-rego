WITH ranked_slots AS (
  SELECT
    id,
    dia_semana,
    hora_inicio,
    ativo,
    FIRST_VALUE(id) OVER (
      PARTITION BY dia_semana, hora_inicio, ativo
      ORDER BY criado_em ASC, id ASC
    ) AS keep_id
  FROM "horarios_disponiveis"
),
slot_mapping AS (
  SELECT id AS old_id, keep_id
  FROM ranked_slots
  WHERE id <> keep_id
),
duplicate_agendamentos AS (
  SELECT
    a.id,
    ROW_NUMBER() OVER (
      PARTITION BY a.membro_id, COALESCE(sm.keep_id, a.horario_id), a.data
      ORDER BY a.criado_em ASC, a.id ASC
    ) AS rn
  FROM "agendamentos" a
  LEFT JOIN slot_mapping sm ON sm.old_id = a.horario_id
)
DELETE FROM "agendamentos" a
USING duplicate_agendamentos d
WHERE a.id = d.id
  AND d.rn > 1;

WITH ranked_slots AS (
  SELECT
    id,
    dia_semana,
    hora_inicio,
    ativo,
    FIRST_VALUE(id) OVER (
      PARTITION BY dia_semana, hora_inicio, ativo
      ORDER BY criado_em ASC, id ASC
    ) AS keep_id
  FROM "horarios_disponiveis"
),
slot_mapping AS (
  SELECT id AS old_id, keep_id
  FROM ranked_slots
  WHERE id <> keep_id
)
UPDATE "agendamentos" a
SET "horario_id" = sm.keep_id
FROM slot_mapping sm
WHERE a."horario_id" = sm.old_id;

WITH ranked_slots AS (
  SELECT
    id,
    dia_semana,
    hora_inicio,
    ativo,
    FIRST_VALUE(id) OVER (
      PARTITION BY dia_semana, hora_inicio, ativo
      ORDER BY criado_em ASC, id ASC
    ) AS keep_id
  FROM "horarios_disponiveis"
)
DELETE FROM "horarios_disponiveis" h
USING ranked_slots r
WHERE h.id = r.id
  AND r.id <> r.keep_id;

CREATE UNIQUE INDEX "horarios_disponiveis_dia_semana_hora_inicio_ativo_key"
ON "horarios_disponiveis"("dia_semana", "hora_inicio", "ativo");
