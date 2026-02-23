#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { prisma } from '../src/lib/prisma'
import {
  executePaymentImport,
  rollbackPaymentImportByBatchId,
} from '../src/lib/payments/feb2026-import'

type CliArgs = {
  month: string
  source: string
  dryRun: boolean
  apply: boolean
  rollback: boolean
  batchId?: string
  topN: number
}

function parseArgs(argv: string[]): CliArgs {
  const monthIndex = argv.indexOf('--month')
  const sourceIndex = argv.indexOf('--source')
  const batchIndex = argv.indexOf('--batch-id')
  const topIndex = argv.indexOf('--top')

  const dryRun = argv.includes('--dry-run')
  const apply = argv.includes('--apply')
  const rollback = argv.includes('--rollback')

  const month = monthIndex >= 0 ? argv[monthIndex + 1] : '2026-02'
  const source = sourceIndex >= 0 ? argv[sourceIndex + 1] : ''
  const batchId = batchIndex >= 0 ? argv[batchIndex + 1] : undefined
  const topN = topIndex >= 0 ? Number.parseInt(argv[topIndex + 1], 10) : 15

  if (rollback) {
    if (!batchId) {
      throw new Error('Informe --batch-id para rollback')
    }
    return {
      month,
      source,
      dryRun: false,
      apply: false,
      rollback: true,
      batchId,
      topN: Number.isFinite(topN) ? topN : 15,
    }
  }

  if (!dryRun && !apply) {
    throw new Error('Use --dry-run ou --apply')
  }

  if (dryRun && apply) {
    throw new Error('Use apenas um modo: --dry-run ou --apply')
  }

  if (!source) {
    throw new Error('Informe --source /caminho/arquivo.docx')
  }

  return {
    month,
    source,
    dryRun,
    apply,
    rollback,
    batchId,
    topN: Number.isFinite(topN) ? topN : 15,
  }
}

function printUsage() {
  console.log('Usage:')
  console.log('  npx tsx utility/import-payments-feb-2026-docx.ts --dry-run --month 2026-02 --source /path/file.docx')
  console.log('  npx tsx utility/import-payments-feb-2026-docx.ts --apply --month 2026-02 --source /path/file.docx [--batch-id batch_custom]')
  console.log('  npx tsx utility/import-payments-feb-2026-docx.ts --rollback --batch-id <batch_id>')
}

function printSummary(summary: {
  totalRowsSeen: number
  rowsWithNumericPago: number
  inserted: number
  skipped: number
  matched: number
  ambiguous: number
  unmatched: number
}) {
  console.log('')
  console.log('Summary')
  console.table({
    total_rows_seen: summary.totalRowsSeen,
    rows_with_numeric_pago: summary.rowsWithNumericPago,
    inserted: summary.inserted,
    skipped: summary.skipped,
    matched: summary.matched,
    ambiguous: summary.ambiguous,
    unmatched: summary.unmatched,
  })
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2))

    if (args.rollback) {
      const rollback = await rollbackPaymentImportByBatchId(prisma, args.batchId!)
      console.log('Rollback concluido:')
      console.table(rollback)
      return
    }

    const batchId = args.batchId ?? `payments-feb-2026-${Date.now()}`
    const summary = await executePaymentImport({
      prisma,
      sourcePath: resolve(args.source),
      month: args.month,
      apply: args.apply,
      batchId,
      topN: args.topN,
    })

    console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`)
    console.log(`Batch ID: ${summary.batchId}`)
    console.log(`Month: ${summary.month}`)
    console.log(`Source: ${summary.source}`)

    printSummary(summary)

    if (summary.topAmbiguousOrUnmatched.length > 0) {
      console.log('Top ambiguous/unmatched:')
      console.table(
        summary.topAmbiguousOrUnmatched.map((item) => ({
          name: item.rawName,
          decision: item.decision,
          score: item.score,
          detail: item.detail,
        }))
      )
    }

    const logsDir = join(process.cwd(), 'utility', 'logs')
    mkdirSync(logsDir, { recursive: true })
    const reportPath = join(logsDir, `payments-feb-2026-${summary.batchId}.json`)
    writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8')
    console.log(`Report saved: ${reportPath}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  printUsage()
  process.exit(1)
})
