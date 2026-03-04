-- Drop unused ref_key column and its unique index from notificacoes
DROP INDEX IF EXISTS "notificacoes_ref_key_key";
ALTER TABLE "notificacoes" DROP COLUMN IF EXISTS "ref_key";

-- Drop denormalized columns from pagamento_import_logs
-- normalized_name is derivable from raw_name via normalizeForMatching()
-- matched_membro_nome is joinable from membros via matched_membro_id
ALTER TABLE "pagamento_import_logs" DROP COLUMN IF EXISTS "normalized_name";
ALTER TABLE "pagamento_import_logs" DROP COLUMN IF EXISTS "matched_membro_nome";
