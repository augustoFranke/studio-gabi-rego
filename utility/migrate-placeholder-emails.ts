import { PrismaClient, Role } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()
const PLACEHOLDER_EMAIL_DOMAIN = '@placeholder.local'

type Mode = 'preview' | 'execute' | 'execute-dry-run'

type PlaceholderCandidate = {
  id: string
  nome: string | null
  email: string
  role: Role
  emailVerificado: Date | null
  tokenVerificacao: string | null
  tokenReset: string | null
}

type ClassifiedCandidate = {
  candidate: PlaceholderCandidate
  safe: boolean
  reasons: string[]
}

function isPlaceholderEmail(email?: string | null) {
  if (!email) return false
  return email.trim().toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN)
}

function classifyCandidate(candidate: PlaceholderCandidate): ClassifiedCandidate {
  const reasons: string[] = []

  if (candidate.role === 'ADMIN') {
    reasons.push('admin_account')
  }
  if (candidate.emailVerificado) {
    reasons.push('email_already_verified')
  }
  if (candidate.tokenVerificacao) {
    reasons.push('has_pending_verification_token')
  }
  if (candidate.tokenReset) {
    reasons.push('has_active_reset_token')
  }

  return {
    candidate,
    safe: reasons.length === 0,
    reasons,
  }
}

function parseMode(args: string[]): { mode: Mode; execute: boolean; dryRun: boolean } {
  const hasPreview = args.includes('--preview')
  const hasExecute = args.includes('--execute')
  const dryRun = args.includes('--dry-run')

  if (hasPreview && hasExecute) {
    throw new Error('Use apenas um modo: --preview OU --execute')
  }

  if (!hasPreview && !hasExecute) {
    return { mode: 'preview', execute: false, dryRun: false }
  }

  if (hasPreview) {
    return { mode: 'preview', execute: false, dryRun: false }
  }

  if (dryRun) {
    return { mode: 'execute-dry-run', execute: true, dryRun: true }
  }

  return { mode: 'execute', execute: true, dryRun: false }
}

function createReportPath() {
  const logsDir = path.resolve(process.cwd(), 'utility', 'logs')
  fs.mkdirSync(logsDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(logsDir, `placeholder-email-migration-${timestamp}.json`)
}

async function loadPlaceholderCandidates() {
  const usuarios = await prisma.usuario.findMany({
    where: {
      email: {
        contains: PLACEHOLDER_EMAIL_DOMAIN,
      },
    },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      emailVerificado: true,
      tokenVerificacao: true,
      tokenReset: true,
    },
    orderBy: {
      id: 'asc',
    },
  })

  const candidates = usuarios
    .filter((usuario): usuario is PlaceholderCandidate => Boolean(usuario.email) && isPlaceholderEmail(usuario.email))
    .map((usuario) => ({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email as string,
      role: usuario.role,
      emailVerificado: usuario.emailVerificado,
      tokenVerificacao: usuario.tokenVerificacao,
      tokenReset: usuario.tokenReset,
    }))

  return candidates
}

function printSummary(mode: Mode, totalUsersScanned: number, classified: ClassifiedCandidate[]) {
  const safe = classified.filter((item) => item.safe)
  const blocked = classified.filter((item) => !item.safe)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(' PLACEHOLDER EMAIL MIGRATION')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log(`Mode: ${mode}`)
  console.log(`Usuarios com placeholder encontrados: ${totalUsersScanned}`)
  console.log(`Safe set: ${safe.length}`)
  console.log(`Blocked set: ${blocked.length}`)

  if (blocked.length > 0) {
    console.log('\nBlocked candidates:')
    for (const item of blocked) {
      console.log(`- ${item.candidate.id} (${item.candidate.email}): ${item.reasons.join(', ')}`)
    }
  }
}

async function executeMigration(safeSet: ClassifiedCandidate[], dryRun: boolean) {
  const migratedIds: string[] = []

  if (dryRun || safeSet.length === 0) {
    return migratedIds
  }

  await prisma.$transaction(async (tx) => {
    for (const item of safeSet) {
      await tx.usuario.update({
        where: { id: item.candidate.id },
        data: { email: null },
      })
      migratedIds.push(item.candidate.id)
    }
  })

  return migratedIds
}

async function writeReport(params: {
  mode: Mode
  dryRun: boolean
  classified: ClassifiedCandidate[]
  migratedIds: string[]
  error?: string
}) {
  const reportPath = createReportPath()
  const safeSet = params.classified.filter((item) => item.safe)
  const blockedSet = params.classified.filter((item) => !item.safe)

  const report = {
    executedAt: new Date().toISOString(),
    mode: params.mode,
    dryRun: params.dryRun,
    placeholderCandidates: params.classified.length,
    safeCandidateCount: safeSet.length,
    blockedCandidateCount: blockedSet.length,
    migratedCount: params.migratedIds.length,
    migratedUserIds: params.migratedIds,
    safeCandidates: safeSet.map((item) => ({
      id: item.candidate.id,
      email: item.candidate.email,
    })),
    blockedCandidates: blockedSet.map((item) => ({
      id: item.candidate.id,
      email: item.candidate.email,
      reasons: item.reasons,
    })),
    error: params.error ?? null,
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nReport: ${reportPath}`)
}

async function main() {
  const args = process.argv.slice(2)
  const { mode, execute, dryRun } = parseMode(args)

  let classified: ClassifiedCandidate[] = []
  let migratedIds: string[] = []

  try {
    const candidates = await loadPlaceholderCandidates()
    classified = candidates.map(classifyCandidate)

    printSummary(mode, candidates.length, classified)

    if (execute) {
      const safeSet = classified.filter((item) => item.safe)
      migratedIds = await executeMigration(safeSet, dryRun)

      if (dryRun) {
        console.log(`\nDry-run execute: ${safeSet.length} usuario(s) seriam migrados para email null.`)
      } else {
        console.log(`\nExecução concluída: ${migratedIds.length} usuario(s) migrados para email null.`)
      }
    } else {
      console.log('\nPreview only: nenhuma alteração foi aplicada.')
    }

    await writeReport({ mode, dryRun, classified, migratedIds })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error(`\nErro na migração: ${message}`)

    await writeReport({
      mode,
      dryRun,
      classified,
      migratedIds,
      error: message,
    })

    if (execute && !dryRun) {
      process.exitCode = 1
    } else {
      console.warn('\nModo não destrutivo: mantendo saída 0 para inspeção via report.')
    }
  } finally {
    await prisma.$disconnect()
  }
}

void main()
