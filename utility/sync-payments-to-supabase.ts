import { PrismaClient, Pagamento } from '@prisma/client'

type Args = {
  dryRun: boolean
  batchSize: number
}

function parseArgs(argv: string[]): Args {
  const dryRun = argv.includes('--dry-run')
  const batchSizeValue = getArgValue(argv, '--batch-size')
  const batchSize = batchSizeValue ? Number.parseInt(batchSizeValue, 10) : 500

  if (Number.isNaN(batchSize) || batchSize <= 0) {
    throw new Error('Invalid --batch-size value. Use a positive integer.')
  }

  return { dryRun, batchSize }
}

function getArgValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag)
  if (index === -1) return null
  return argv[index + 1] ?? null
}

function printUsage(): void {
  console.log('Payments Sync (Local -> Supabase)')
  console.log('')
  console.log('Usage:')
  console.log('  npx tsx utility/sync-payments-to-supabase.ts [--dry-run] [--batch-size 500]')
  console.log('')
  console.log('Required environment variables:')
  console.log('  DATABASE_URL (or LOCAL_DATABASE_URL)')
  console.log('  SUPABASE_DATABASE_URL (recommended: direct connection on port 5432)')
  console.log('')
  console.log('Options:')
  console.log('  --dry-run        Show what would be inserted without writing to Supabase')
  console.log('  --batch-size N   Number of payments to process per batch (default: 500)')
}

function resolveRemoteUrl(): string | undefined {
  if (process.env.SUPABASE_DATABASE_URL) return process.env.SUPABASE_DATABASE_URL
  if (process.env.SUPABASE_DIRECT_URL) return process.env.SUPABASE_DIRECT_URL
  if (process.env.REMOTE_DATABASE_URL) return process.env.REMOTE_DATABASE_URL
  if (process.env.DIRECT_URL && process.env.DIRECT_URL !== process.env.DATABASE_URL) {
    return process.env.DIRECT_URL
  }
  return undefined
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage()
    return
  }

  const { dryRun, batchSize } = parseArgs(argv)

  const localUrl = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL
  const remoteUrl = resolveRemoteUrl()

  if (!localUrl) {
    throw new Error('Missing DATABASE_URL (or LOCAL_DATABASE_URL) for local database.')
  }
  if (!remoteUrl) {
    throw new Error('Missing SUPABASE_DATABASE_URL (or SUPABASE_DIRECT_URL).')
  }
  if (localUrl === remoteUrl) {
    throw new Error('Local and remote database URLs are identical. Aborting.')
  }

  const localPrisma = new PrismaClient({
    datasources: { db: { url: localUrl } },
  })
  const remotePrisma = new PrismaClient({
    datasources: { db: { url: remoteUrl } },
  })

  try {
    const totalLocal = await localPrisma.pagamento.count()
    const totalRemote = await remotePrisma.pagamento.count()

    console.log('Payments Sync (Local -> Supabase)')
    console.log(`Local payments: ${totalLocal}`)
    console.log(`Remote payments: ${totalRemote}`)
    console.log(`Mode: ${dryRun ? 'dry-run' : 'live'}`)
    console.log(`Batch size: ${batchSize}`)
    console.log('')

    let processed = 0
    let inserted = 0
    let skippedExisting = 0
    let skippedMissingRelations = 0
    let lastId: string | null = null

    while (true) {
      const batch: Pagamento[] = lastId
        ? await localPrisma.pagamento.findMany({
            take: batchSize,
            skip: 1,
            cursor: { id: lastId },
            orderBy: { id: 'asc' },
          })
        : await localPrisma.pagamento.findMany({
            take: batchSize,
            orderBy: { id: 'asc' },
          })

      if (batch.length === 0) break

      lastId = batch[batch.length - 1].id
      processed += batch.length

      const batchIds = batch.map((payment) => payment.id)
      const existing = await remotePrisma.pagamento.findMany({
        where: { id: { in: batchIds } },
        select: { id: true },
      })
      const existingIds = new Set(existing.map((row) => row.id))
      skippedExisting += existingIds.size

      const missingInRemote = batch.filter((payment) => !existingIds.has(payment.id))
      if (missingInRemote.length === 0) {
        console.log(`Processed ${processed}/${totalLocal}. New: 0`)
        continue
      }

      const memberIds = Array.from(
        new Set(
          missingInRemote
            .map((payment) => payment.membroId)
            .filter((id): id is string => Boolean(id))
        )
      )
      const planIds = Array.from(new Set(missingInRemote.map((payment) => payment.planoId)))

      const [remoteMembers, remotePlans] = await Promise.all([
        remotePrisma.membro.findMany({
          where: { id: { in: memberIds } },
          select: { id: true },
        }),
        remotePrisma.plano.findMany({
          where: { id: { in: planIds } },
          select: { id: true },
        }),
      ])

      const remoteMemberIds = new Set(remoteMembers.map((row) => row.id))
      const remotePlanIds = new Set(remotePlans.map((row) => row.id))

      const validPayments = []
      const missingMemberIds = new Set<string>()
      const missingPlanIds = new Set<string>()

      for (const payment of missingInRemote) {
        const memberOk = payment.membroId !== null && remoteMemberIds.has(payment.membroId)
        const planOk = remotePlanIds.has(payment.planoId)
        if (memberOk && planOk) {
          validPayments.push(payment)
        } else {
          if (!memberOk) missingMemberIds.add(payment.membroId ?? '<null>')
          if (!planOk) missingPlanIds.add(payment.planoId)
        }
      }

      const skippedForRelations = missingInRemote.length - validPayments.length
      if (skippedForRelations > 0) {
        skippedMissingRelations += skippedForRelations
        console.log(
          `Skipped ${skippedForRelations} payments due to missing relations (members: ${missingMemberIds.size}, plans: ${missingPlanIds.size}).`
        )
      }

      if (validPayments.length === 0) {
        console.log(`Processed ${processed}/${totalLocal}. New: 0`)
        continue
      }

      if (dryRun) {
        inserted += validPayments.length
      } else {
        const result = await remotePrisma.pagamento.createMany({
          data: validPayments.map((payment) => ({
            id: payment.id,
            membroId: payment.membroId,
            planoId: payment.planoId,
            valor: payment.valor.toString(),
            dataVencimento: payment.dataVencimento,
            dataPagamento: payment.dataPagamento,
            status: payment.status,
            formaPagamento: payment.formaPagamento,
            comprovante: payment.comprovante,
            observacao: payment.observacao,
            criadoEm: payment.criadoEm,
            atualizadoEm: payment.atualizadoEm,
          })),
          skipDuplicates: true,
        })

        inserted += result.count
      }

      console.log(
        `Processed ${processed}/${totalLocal}. New: ${validPayments.length}${dryRun ? ' (dry-run)' : ''}`
      )
    }

    console.log('')
    console.log('Sync complete.')
    console.log(`Processed: ${processed}`)
    console.log(`Skipped (already in remote): ${skippedExisting}`)
    console.log(`Skipped (missing relations): ${skippedMissingRelations}`)
    console.log(`${dryRun ? 'Would insert' : 'Inserted'}: ${inserted}`)
  } finally {
    await localPrisma.$disconnect()
    await remotePrisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Payments sync failed.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
