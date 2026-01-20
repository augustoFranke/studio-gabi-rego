/**
 * Cleanup Inactive Members Script
 *
 * Removes all members with status = 'INATIVO' from the production database.
 *
 * Modes:
 *   --preview-only  Show what will be deleted (read-only, zero risk)
 *   --dry-run       Create backup without deleting
 *   (no flag)       Full execution with confirmation prompts
 *
 * Usage:
 *   npm run cleanup:inactive:preview   # Preview only
 *   npm run cleanup:inactive:dry       # Dry run with backup
 *   npm run cleanup:inactive           # Full execution
 */

import { PrismaClient, StatusMembro } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const prisma = new PrismaClient()

// Parse command line arguments
const args = process.argv.slice(2)
const PREVIEW_ONLY = args.includes('--preview-only')
const DRY_RUN = args.includes('--dry-run')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logHeader(message: string) {
  console.log('')
  log('═'.repeat(60), 'cyan')
  log(`  ${message}`, 'bright')
  log('═'.repeat(60), 'cyan')
}

interface InactiveMemberData {
  usuario: {
    id: string
    email: string
    nome: string | null
    criadoEm: Date
    atualizadoEm: Date
  }
  membro: {
    id: string
    cpf: string | null
    telefone: string | null
    dataNascimento: Date | null
    status: StatusMembro
    criadoEm: Date
    atualizadoEm: Date
  }
  agendamentos: Array<{
    id: string
    data: Date
    presente: boolean | null
  }>
  pagamentos: Array<{
    id: string
    valor: number
    status: string
    dataVencimento: Date
  }>
  fichasTreino: Array<{
    id: string
    nome: string
    exercicios: Array<{
      id: string
      nome: string
    }>
  }>
  notificacoes: Array<{
    id: string
    tipo: string
    titulo: string
  }>
  anamnese: {
    id: string
  } | null
}

async function getInactiveMembers(): Promise<InactiveMemberData[]> {
  const membros = await prisma.membro.findMany({
    where: { status: StatusMembro.INATIVO },
    include: {
      usuario: {
        select: {
          id: true,
          email: true,
          nome: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      },
      agendamentos: {
        select: {
          id: true,
          data: true,
          presente: true,
        },
      },
      pagamentos: {
        select: {
          id: true,
          valor: true,
          status: true,
          dataVencimento: true,
        },
      },
      fichasTreino: {
        include: {
          exercicios: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      },
      notificacoes: {
        select: {
          id: true,
          tipo: true,
          titulo: true,
        },
      },
      anamnese: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      atualizadoEm: 'desc',
    },
  })

  return membros.map((m) => ({
    usuario: m.usuario,
    membro: {
      id: m.id,
      cpf: m.cpf,
      telefone: m.telefone,
      dataNascimento: m.dataNascimento,
      status: m.status,
      criadoEm: m.criadoEm,
      atualizadoEm: m.atualizadoEm,
    },
    agendamentos: m.agendamentos.map((a) => ({
      id: a.id,
      data: a.data,
      presente: a.presente,
    })),
    pagamentos: m.pagamentos.map((p) => ({
      id: p.id,
      valor: Number(p.valor),
      status: p.status,
      dataVencimento: p.dataVencimento,
    })),
    fichasTreino: m.fichasTreino.map((f) => ({
      id: f.id,
      nome: f.nome,
      exercicios: f.exercicios.map((e) => ({
        id: e.id,
        nome: e.nome,
      })),
    })),
    notificacoes: m.notificacoes,
    anamnese: m.anamnese,
  }))
}

function calculateDaysInactive(lastUpdate: Date): number {
  const now = new Date()
  const diff = now.getTime() - lastUpdate.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function displayPreviewTable(members: InactiveMemberData[]) {
  logHeader('INACTIVE MEMBERS TO BE DELETED')

  if (members.length === 0) {
    log('\n  No inactive members found.', 'green')
    return
  }

  console.log('')
  console.log(
    '  ' +
      'Nome'.padEnd(25) +
      'Email'.padEnd(30) +
      'Dias Inativo'.padEnd(14) +
      'Registros Relacionados'
  )
  console.log('  ' + '-'.repeat(90))

  for (const member of members) {
    const nome = (member.usuario.nome || 'N/A').substring(0, 23).padEnd(25)
    const email = member.usuario.email.substring(0, 28).padEnd(30)
    const daysInactive = calculateDaysInactive(member.membro.atualizadoEm)
      .toString()
      .padEnd(14)

    const totalExercicios = member.fichasTreino.reduce(
      (sum, f) => sum + f.exercicios.length,
      0
    )
    const relatedRecords = [
      `${member.agendamentos.length} agend`,
      `${member.pagamentos.length} pag`,
      `${member.fichasTreino.length} fichas`,
      `${totalExercicios} exerc`,
      `${member.notificacoes.length} notif`,
      member.anamnese ? '1 anam' : '0 anam',
    ].join(', ')

    console.log(`  ${nome}${email}${daysInactive}${relatedRecords}`)
  }

  console.log('')
}

function displaySummary(members: InactiveMemberData[]) {
  logHeader('DELETION SUMMARY')

  const totalAgendamentos = members.reduce(
    (sum, m) => sum + m.agendamentos.length,
    0
  )
  const totalPagamentos = members.reduce(
    (sum, m) => sum + m.pagamentos.length,
    0
  )
  const totalFichas = members.reduce((sum, m) => sum + m.fichasTreino.length, 0)
  const totalExercicios = members.reduce(
    (sum, m) =>
      sum + m.fichasTreino.reduce((s, f) => s + f.exercicios.length, 0),
    0
  )
  const totalNotificacoes = members.reduce(
    (sum, m) => sum + m.notificacoes.length,
    0
  )
  const totalAnamneses = members.filter((m) => m.anamnese).length

  console.log('')
  console.log(`  ${colors.bright}Records to be deleted:${colors.reset}`)
  console.log(`    - ${members.length} Usuarios (cascade delete)`)
  console.log(`    - ${members.length} Membros`)
  console.log(`    - ${totalAgendamentos} Agendamentos`)
  console.log(`    - ${totalPagamentos} Pagamentos`)
  console.log(`    - ${totalFichas} Fichas de Treino`)
  console.log(`    - ${totalExercicios} Exercicios`)
  console.log(`    - ${totalNotificacoes} Notificacoes`)
  console.log(`    - ${totalAnamneses} Anamneses`)
  console.log('')
}

async function createBackup(
  members: InactiveMemberData[]
): Promise<string | null> {
  const logsDir = path.join(__dirname, 'logs')

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(logsDir, `cleanup-backup-${timestamp}.json`)

  const backupData = {
    createdAt: new Date().toISOString(),
    mode: PREVIEW_ONLY ? 'preview' : DRY_RUN ? 'dry-run' : 'live',
    totalMembers: members.length,
    members: members,
  }

  try {
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2))
    log(`\n  Backup created: ${backupPath}`, 'green')
    return backupPath
  } catch (error) {
    log(`\n  Failed to create backup: ${error}`, 'red')
    return null
  }
}

async function saveReport(
  members: InactiveMemberData[],
  deletedCount: number,
  backupPath: string | null
): Promise<void> {
  const logsDir = path.join(__dirname, 'logs')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(logsDir, `cleanup-report-${timestamp}.json`)

  const report = {
    executedAt: new Date().toISOString(),
    mode: PREVIEW_ONLY ? 'preview' : DRY_RUN ? 'dry-run' : 'live',
    totalInactiveFound: members.length,
    totalDeleted: deletedCount,
    backupPath: backupPath,
    deletedMembers: members.map((m) => ({
      usuarioId: m.usuario.id,
      membroId: m.membro.id,
      email: m.usuario.email,
      nome: m.usuario.nome,
    })),
  }

  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    log(`  Report saved: ${reportPath}`, 'green')
  } catch (error) {
    log(`  Failed to save report: ${error}`, 'red')
  }
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toUpperCase() === 'YES')
    })
  })
}

async function deleteInactiveMembers(
  members: InactiveMemberData[]
): Promise<number> {
  let deletedCount = 0

  // Use a transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    for (const member of members) {
      // Delete Usuario - cascades to Membro and all related data
      await tx.usuario.delete({
        where: { id: member.usuario.id },
      })
      deletedCount++
      process.stdout.write(
        `\r  Deleted ${deletedCount}/${members.length} members...`
      )
    }
  })

  console.log('') // New line after progress
  return deletedCount
}

async function verifyDeletion(originalCount: number): Promise<boolean> {
  const remainingCount = await prisma.membro.count({
    where: { status: StatusMembro.INATIVO },
  })

  if (remainingCount === 0) {
    log('  Verification: All inactive members deleted successfully.', 'green')
    return true
  } else {
    log(
      `  Verification FAILED: ${remainingCount} inactive members still exist.`,
      'red'
    )
    return false
  }
}

async function main() {
  try {
    logHeader('CLEANUP INACTIVE MEMBERS')

    const modeLabel = PREVIEW_ONLY
      ? 'PREVIEW ONLY (read-only)'
      : DRY_RUN
        ? 'DRY RUN (backup only, no deletion)'
        : 'LIVE EXECUTION'

    log(`\n  Mode: ${modeLabel}`, PREVIEW_ONLY || DRY_RUN ? 'yellow' : 'red')

    // Step 1: Query inactive members
    log('\n  Querying inactive members...', 'blue')
    const inactiveMembers = await getInactiveMembers()

    if (inactiveMembers.length === 0) {
      log('\n  No inactive members found. Nothing to do.', 'green')
      await prisma.$disconnect()
      process.exit(0)
    }

    // Step 2: Display preview
    displayPreviewTable(inactiveMembers)
    displaySummary(inactiveMembers)

    // Preview only mode - stop here
    if (PREVIEW_ONLY) {
      log(
        '  Preview complete. Run with --dry-run or without flags to proceed.',
        'yellow'
      )
      await prisma.$disconnect()
      process.exit(0)
    }

    // Step 3: Create backup
    logHeader('CREATING BACKUP')
    const backupPath = await createBackup(inactiveMembers)

    if (!backupPath) {
      log('\n  Aborting: Failed to create backup.', 'red')
      await prisma.$disconnect()
      process.exit(1)
    }

    // Dry run mode - stop after backup
    if (DRY_RUN) {
      log('\n  Dry run complete. Backup created, no deletion performed.', 'yellow')
      await saveReport(inactiveMembers, 0, backupPath)
      await prisma.$disconnect()
      process.exit(0)
    }

    // Step 4: Confirmation for live execution
    logHeader('CONFIRMATION REQUIRED')
    log(
      `\n  ${colors.red}${colors.bright}WARNING: This will permanently delete ${inactiveMembers.length} inactive members and all their related data.${colors.reset}`,
      'reset'
    )
    log('  This action cannot be undone (except by restoring from backup).\n', 'yellow')

    const confirmed = await askConfirmation(
      `  Type "YES" to confirm deletion: `
    )

    if (!confirmed) {
      log('\n  Deletion cancelled by user.', 'yellow')
      await saveReport(inactiveMembers, 0, backupPath)
      await prisma.$disconnect()
      process.exit(0)
    }

    // Step 5: Execute deletion
    logHeader('EXECUTING DELETION')
    log('\n  Starting deletion...', 'blue')

    const deletedCount = await deleteInactiveMembers(inactiveMembers)

    // Step 6: Verify deletion
    logHeader('VERIFICATION')
    const verified = await verifyDeletion(inactiveMembers.length)

    // Step 7: Save report
    await saveReport(inactiveMembers, deletedCount, backupPath)

    logHeader('COMPLETE')
    log(
      `\n  Successfully deleted ${deletedCount} inactive members.`,
      'green'
    )

    await prisma.$disconnect()
    process.exit(verified ? 0 : 1)
  } catch (error) {
    log(`\n  Error: ${error}`, 'red')
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
