-- CreateTable
CREATE TABLE "horarios_fixos" (
    "id" TEXT NOT NULL,
    "membro_id" TEXT NOT NULL,
    "dia_semana" "DiaSemana" NOT NULL,
    "hora" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horarios_fixos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "horarios_fixos_membro_id_dia_semana_hora_key" ON "horarios_fixos"("membro_id", "dia_semana", "hora");

-- AddForeignKey
ALTER TABLE "horarios_fixos" ADD CONSTRAINT "horarios_fixos_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
