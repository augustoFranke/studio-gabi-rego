# Payment Import Runbook (February 2026 DOCX)

## 1) Backup / snapshot
- Confirm a fresh Supabase/Postgres backup exists before any write.
- Example (local): `./docker/scripts/backup.sh` (or your managed DB snapshot procedure).

## 2) Dry-run (no writes)
- Command:
```bash
npx tsx utility/import-payments-feb-2026-docx.ts \
  --dry-run \
  --month 2026-02 \
  --source "/Users/augustodoregofranke/Downloads/LISTA DE ALUNOS FEVEREIRO 26 ATUALIZADA.docx"
```
- Review summary + `utility/logs/payments-feb-2026-<batch_id>.json`.
- Validate `ambiguous`/`unmatched` list and numeric parsing.

## 3) Apply (writes)
- Only after dry-run validation and explicit human approval (`RUN IN PROD`).
- Command:
```bash
npx tsx utility/import-payments-feb-2026-docx.ts \
  --apply \
  --month 2026-02 \
  --source "/Users/augustodoregofranke/Downloads/LISTA DE ALUNOS FEVEREIRO 26 ATUALIZADA.docx" \
  --batch-id "payments-feb-2026-YYYYMMDDHHmm"
```

## 4) Verify counts
- Compare CLI summary with DB:
```sql
SELECT batch_id, total_rows_seen, rows_with_numeric_pago, inserted, skipped, matched, ambiguous, unmatched
FROM pagamento_import_runs
ORDER BY criado_em DESC
LIMIT 5;
```
```sql
SELECT COUNT(*) AS pagamentos_do_lote
FROM pagamentos p
JOIN pagamento_import_runs r ON r.id = p.import_run_id
WHERE r.batch_id = '<BATCH_ID>';
```

## 5) Rollback
- Command:
```bash
npx tsx utility/import-payments-feb-2026-docx.ts --rollback --batch-id "<BATCH_ID>"
```
- This deletes payments linked to the batch and marks run status as `ROLLED_BACK`.
