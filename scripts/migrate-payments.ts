/**
 * Migrate payment data from dev (docker) to production (Supabase).
 *
 * Behavior:
 * - Reads dev connection from .env or .env.development
 * - Reads prod connection from .env.production (DIRECT_URL preferred)
 * - Maps members by cpf and plans by nome
 * - Merge-only: skips payments that already exist in prod
 *
 * Usage:
 *   npx tsx scripts/migrate-payments.ts --dry-run
 *   npx tsx scripts/migrate-payments.ts --apply
 *   npx tsx scripts/migrate-payments.ts --apply --strict
 *   npx tsx scripts/migrate-payments.ts --apply --limit=100
 *   npx tsx scripts/migrate-payments.ts --dev-url=... --prod-url=...
 */

import { PrismaClient, Prisma, StatusPagamento } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

type EnvMap = Record<string, string>

type MigrationArgs = {
  apply: boolean
  strict: boolean
  limit?: number
  devUrl?: string
  prodUrl?: string
}

type DevPagamento = {
  id: string
  membro: { cpf: string | null }
  plano: { nome: string }
  valor: Prisma.Decimal
  dataVencimento: Date
  dataPagamento: Date | null
  status: StatusPagamento
  formaPagamento: string | null
  comprovante: string | null
  observacao: string | null
  criadoEm: Date
  atualizadoEm: Date
}

function parseArgs(): MigrationArgs {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const strict = args.includes('--strict')
  const limitArg = args.find((arg) => arg.startsWith('--limit='))
  const devUrlArg = args.find((arg) => arg.startsWith('--dev-url='))
  const prodUrlArg = args.find((arg) => arg.startsWith('--prod-url='))

  return {
    apply,
    strict,
    limit: limitArg ? Number(limitArg.split('=')[1]) : undefined,
    devUrl: devUrlArg ? devUrlArg.split('=')[1] : undefined,
    prodUrl: prodUrlArg ? prodUrlArg.split('=')[1] : undefined,
  }
}

function parseEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const contents = fs.readFileSync(filePath, 'utf8')
  const env: EnvMap = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line
    const eqIndex = normalized.indexOf('=')
    if (eqIndex === -1) {
      continue
    }

    const key = normalized.slice(0, eqIndex).trim()
    let value = normalized.slice(eqIndex + 1).trim()

    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hashIndex = value.indexOf('#')
      if (hashIndex !== -1) {
        value = value.slice(0, hashIndex).trim()
      }
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

function loadEnvFiles(pathsToTry: string[]): EnvMap {
  return pathsToTry.reduce((acc, currentPath) => {
    const parsed = parseEnvFile(currentPath)
    return { ...acc, ...parsed }
  }, {} as EnvMap)
}

function maskDbUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const user = parsed.username ? `${parsed.username}:***@` : ''
    return `${parsed.protocol}//${user}${parsed.host}${parsed.pathname}`
  } catch {
    return '<invalid-url>'
  }
}

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function main() {
  const args = parseArgs()

  const cwd = process.cwd()
  const devEnv = loadEnvFiles([
    path.join(cwd, '.env'),
    path.join(cwd, '.env.development'),
  ])
  const prodEnv = loadEnvFiles([path.join(cwd, '.env.production')])

  const devUrl =
    args.devUrl ||
    process.env.DEV_DATABASE_URL ||
    devEnv.DATABASE_URL ||
    devEnv.DIRECT_URL

  const prodUrl =
    args.prodUrl ||
    process.env.PROD_DATABASE_URL ||
    prodEnv.DIRECT_URL ||
    prodEnv.DATABASE_URL

  if (!devUrl || !prodUrl) {
    console.error('Missing database URLs. Provide --dev-url and --prod-url or set env files.')
    process.exit(1)
  }

  console.log('Payment migration (dev docker -> prod Supabase)')
  console.log(`Mode: ${args.apply ? 'apply' : 'dry-run'}`)
  console.log(`Dev DB: ${maskDbUrl(devUrl)}`)
  console.log(`Prod DB: ${maskDbUrl(prodUrl)}`)

  const dev = new PrismaClient({ datasources: { db: { url: devUrl } } })
  const prod = new PrismaClient({ datasources: { db: { url: prodUrl } } })

  try {
    const devPagamentos = await dev.pagamento.findMany({
      include: {
        membro: { select: { cpf: true } },
        plano: { select: { nome: true } },
      },
      orderBy: { criadoEm: 'asc' },
      take: args.limit,
    })

    console.log(`Dev payments found: ${devPagamentos.length}`)

    if (devPagamentos.length === 0) {
      console.log('No payments found in dev. Nothing to migrate.')
      return
    }

    const prodPlans = await prod.plano.findMany({
      select: { id: true, nome: true },
    })

    const planByName = new Map<string, string>()
    const duplicatePlanNames = new Set<string>()

    for (const plan of prodPlans) {
      if (planByName.has(plan.nome)) {
        duplicatePlanNames.add(plan.nome)
        continue
      }
      planByName.set(plan.nome, plan.id)
    }

    if (duplicatePlanNames.size > 0) {
      console.warn(
        `Warning: duplicate plan names in prod: ${Array.from(duplicatePlanNames).join(', ')}`
      )
      if (args.strict) {
        throw new Error('Duplicate plan names found and --strict is enabled.')
      }
    }

    const prodMembers = await prod.membro.findMany({
      select: { id: true, cpf: true },
    })

    const memberByCpf = new Map<string, string>()
    const duplicateCpfs = new Set<string>()

    for (const member of prodMembers) {
      if (!member.cpf) {
        continue
      }
      if (memberByCpf.has(member.cpf)) {
        duplicateCpfs.add(member.cpf)
        continue
      }
      memberByCpf.set(member.cpf, member.id)
    }

    if (duplicateCpfs.size > 0) {
      console.warn(`Warning: duplicate cpfs in prod: ${Array.from(duplicateCpfs).join(', ')}`)
      if (args.strict) {
        throw new Error('Duplicate cpfs found and --strict is enabled.')
      }
    }

    let missingCpf = 0
    let missingMember = 0
    let missingPlan = 0

    const candidateMappings: Array<{
      dev: DevPagamento
      prodMemberId: string
      prodPlanId: string
    }> = []

    for (const pagamento of devPagamentos as DevPagamento[]) {
      const cpf = pagamento.membro?.cpf
      if (!cpf) {
        missingCpf++
        continue
      }

      const prodMemberId = memberByCpf.get(cpf)
      if (!prodMemberId) {
        missingMember++
        if (args.strict) {
          throw new Error(`Missing member for cpf ${cpf}`)
        }
        continue
      }

      const planName = pagamento.plano?.nome
      const prodPlanId = planByName.get(planName)
      if (!prodPlanId) {
        missingPlan++
        if (args.strict) {
          throw new Error(`Missing plan in prod: ${planName}`)
        }
        continue
      }

      candidateMappings.push({
        dev: pagamento,
        prodMemberId,
        prodPlanId,
      })
    }

    if (candidateMappings.length === 0) {
      console.log('No valid payments to migrate after mapping.')
      console.log(`Skipped: missing cpf ${missingCpf}, missing member ${missingMember}, missing plan ${missingPlan}`)
      return
    }

    const memberIds = Array.from(new Set(candidateMappings.map((p) => p.prodMemberId)))
    const planIds = Array.from(new Set(candidateMappings.map((p) => p.prodPlanId)))

    const existingProd = await prod.pagamento.findMany({
      where: {
        membroId: { in: memberIds },
        planoId: { in: planIds },
      },
      select: {
        membroId: true,
        planoId: true,
        dataVencimento: true,
      },
    })

    const existingKeys = new Set(
      existingProd.map(
        (p) => `${p.membroId}|${p.planoId}|${getDateKey(p.dataVencimento)}`
      )
    )

    const rowsToInsert = []
    let alreadyExists = 0

    for (const item of candidateMappings) {
      const key = `${item.prodMemberId}|${item.prodPlanId}|${getDateKey(item.dev.dataVencimento)}`
      if (existingKeys.has(key)) {
        alreadyExists++
        continue
      }

      rowsToInsert.push({
        membroId: item.prodMemberId,
        planoId: item.prodPlanId,
        valor: item.dev.valor,
        dataVencimento: item.dev.dataVencimento,
        dataPagamento: item.dev.dataPagamento,
        status: item.dev.status,
        formaPagamento: item.dev.formaPagamento,
        comprovante: item.dev.comprovante,
        observacao: item.dev.observacao,
        criadoEm: item.dev.criadoEm,
      })
    }

    console.log(`Already in prod (by member/plan/due date): ${alreadyExists}`)
    console.log(`To insert: ${rowsToInsert.length}`)
    console.log(`Skipped: missing cpf ${missingCpf}, missing member ${missingMember}, missing plan ${missingPlan}`)

    if (!args.apply) {
      console.log('Dry-run complete. Use --apply to write to prod.')
      return
    }

    if (rowsToInsert.length === 0) {
      console.log('Nothing to insert.')
      return
    }

    const batchSize = 200
    let inserted = 0

    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize)
      await prod.pagamento.createMany({ data: batch })
      inserted += batch.length
      console.log(`Inserted ${inserted}/${rowsToInsert.length}`)
    }

    console.log('Migration completed.')
  } finally {
    await dev.$disconnect()
    await prod.$disconnect()
  }
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
