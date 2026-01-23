-- Add senha_definida flag and backfill for existing users
ALTER TABLE "usuarios" ADD COLUMN "senha_definida" BOOLEAN NOT NULL DEFAULT false;

UPDATE "usuarios"
SET "senha_definida" = true
WHERE "role" = 'ADMIN'
   OR "email_verificado" IS NOT NULL;
