-- Ensure anamnese token columns exist for members
ALTER TABLE "membros" ADD COLUMN IF NOT EXISTS "anamnese_token" TEXT;
ALTER TABLE "membros" ADD COLUMN IF NOT EXISTS "anamnese_token_expira" TIMESTAMP(3);

-- Preserve uniqueness constraint expected by Prisma
CREATE UNIQUE INDEX IF NOT EXISTS "membros_anamnese_token_key" ON "membros"("anamnese_token");
