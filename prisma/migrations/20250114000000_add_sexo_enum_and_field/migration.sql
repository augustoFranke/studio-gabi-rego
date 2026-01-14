-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MASCULINO', 'FEMININO');

-- AlterTable
ALTER TABLE "membros" ADD COLUMN "sexo" "Sexo";

-- AlterTable: Change series from Int to String
ALTER TABLE "exercicios" ALTER COLUMN "series" TYPE TEXT USING "series"::TEXT;
