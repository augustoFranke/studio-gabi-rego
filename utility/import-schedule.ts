#!/usr/bin/env tsx
/**
 * Schedule Import Script
 *
 * Imports member schedules from output.md (ASCII table format)
 * and creates recurring appointments for January 2026
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../src/lib/prisma'
import { DiaSemana } from '@prisma/client'
import { getDiaSemanaFromDay, MAX_CAPACITY_PER_SLOT } from '../src/lib/schedule'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'

// ==================== TYPES ====================

interface ImportReport {
  totalRows: number
  processedRows: number
  skippedRows: number

  membersFound: number
  membersCreated: number
  membersFailed: number

  horariosCreated: number
  horariosReused: number

  appointmentsCreated: number
  appointmentsSkipped: number
  appointmentsFailed: number

  errors: Array<{
    row: number
    memberName: string
    type: string
    message: string
  }>

  warnings: Array<{
    row: number
    memberName: string
    message: string
  }>
}

interface MemberResult {
  id: string
  nome: string
  created: boolean
}

interface TableRow {
  raw: string
  name: string
  hr: string
  dias: string
}

interface AppointmentResults {
  created: number
  skipped: number
  errors: string[]
}

// ==================== CONSTANTS ====================

const DAY_MAP: Record<string, DiaSemana> = {
  'SEG': 'SEGUNDA',
  'TER': 'TERCA',
  'TERCA': 'TERCA',
  'QUA': 'QUARTA',
  'QUI': 'QUINTA',
  'QUIN': 'QUINTA',
  'QUIT': 'QUINTA',
  'SEX': 'SEXTA',
  'SÁB': 'SABADO',
  'SAB': 'SABADO',
  'DOM': 'DOMINGO',
}

const TARGET_MONTH = 1 // January
const TARGET_YEAR = 2026

const DRY_RUN = process.argv.includes('--dry-run')

// ==================== UTILITY FUNCTIONS ====================

function generatePassword(): string {
  return randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
}

function generatePlaceholderCPF(): string {
  // Generate CPF starting with 999 (clearly placeholder)
  const base = '999' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0')

  // Calculate first verification digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(base[i]) * (10 - i)
  }
  let digit1 = (sum * 10) % 11
  if (digit1 === 10) digit1 = 0

  // Calculate second verification digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt((base + digit1)[i]) * (11 - i)
  }
  let digit2 = (sum * 10) % 11
  if (digit2 === 10) digit2 = 0

  return base + digit1 + digit2
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function logProgress(current: number, total: number, memberName: string) {
  const percentage = Math.round((current / total) * 100)
  const filled = Math.floor(percentage / 2)
  const bar = '█'.repeat(filled) + '░'.repeat(50 - filled)

  process.stdout.write(`\r[${bar}] ${percentage}% - Processing: ${memberName.padEnd(30).slice(0, 30)}`)
}

// ==================== PARSING FUNCTIONS ====================

function extractMemberName(raw: string): string {
  let name = raw

  // Remove row number prefix (e.g., "1.", "23.")
  name = name.replace(/^\d+\.\s*/, '')

  // Remove parenthetical suffixes
  name = name.replace(/\s*\([^)]*\)\s*/g, ' ')

  // Remove asterisks and backslashes
  name = name.replace(/[\*\\]/g, '')

  // Remove trailing numbers preceded by space
  name = name.replace(/\s+\d+\s*$/, '')

  // Clean up multiple spaces
  name = name.replace(/\s+/g, ' ').trim()

  // Convert to title case
  name = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return name
}

function parseTimeSlots(hrField: string): number[] {
  if (!hrField || hrField.trim() === '') return []

  const hours: number[] = []
  const cleaned = hrField.toUpperCase().trim()

  // Handle ranges with "à" or "A" (e.g., "18 à 20")
  const rangeMatch = cleaned.match(/^(\d+):?\d*\s*[AÀ]\s*(\d+):?\d*$/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1])
    const end = parseInt(rangeMatch[2])
    for (let h = start; h <= end; h++) {
      hours.push(h)
    }
    return hours
  }

  // Handle "E" separator (e.g., "18 E 19")
  const eSeparator = cleaned.match(/^(\d+)\s*E\s*(\d+)$/)
  if (eSeparator) {
    hours.push(parseInt(eSeparator[1]))
    hours.push(parseInt(eSeparator[2]))
    return hours
  }

  // Handle slash-separated (e.g., "15/16", "5:15/8", "17/5/5")
  const slashParts = cleaned.split('/')
  for (const part of slashParts) {
    const hourMatch = part.match(/^(\d+)/)
    if (hourMatch) {
      const hour = parseInt(hourMatch[1])
      if (hour >= 0 && hour <= 23 && !hours.includes(hour)) {
        hours.push(hour)
      }
    }
  }

  if (hours.length > 0) return hours

  // Handle simple hour or formatted time (e.g., "19", "13:00")
  const simpleMatch = cleaned.match(/^(\d+)/)
  if (simpleMatch) {
    const hour = parseInt(simpleMatch[1])
    if (hour >= 0 && hour <= 23) {
      hours.push(hour)
    }
  }

  return hours
}

function parseDaysOfWeek(diasField: string): DiaSemana[] {
  if (!diasField || diasField.trim() === '') return []

  const days: DiaSemana[] = []
  const cleaned = diasField.toUpperCase().trim()

  // Handle ranges (e.g., "SEG À SEX", "SEG A SEX")
  const rangeMatch = cleaned.match(/^(\w+)\s*[AÀ]\s*(\w+)$/)
  if (rangeMatch) {
    const start = DAY_MAP[rangeMatch[1]]
    const end = DAY_MAP[rangeMatch[2]]

    if (start && end) {
      const dayOrder: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']
      const startIdx = dayOrder.indexOf(start)
      const endIdx = dayOrder.indexOf(end)

      if (startIdx >= 0 && endIdx >= 0 && startIdx <= endIdx) {
        return dayOrder.slice(startIdx, endIdx + 1)
      }
    }
  }

  // Handle slash-separated or "E" separator (e.g., "TER/QUI", "SEG E SEX")
  const parts = cleaned.split(/[\/\sE\s]/).map(p => p.trim()).filter(p => p.length > 0)

  for (const part of parts) {
    const day = DAY_MAP[part]
    if (day && !days.includes(day)) {
      days.push(day)
    }
  }

  return days
}

function parseTable(content: string): TableRow[] {
  const lines = content.split(/\r?\n/)
  const rows: TableRow[] = []
  let currentRow: string | null = null

  for (let i = 5; i < lines.length; i++) { // Skip header rows (1-5)
    const line = lines[i]

    // Skip empty lines
    if (!line.trim()) continue

    // Check if this is a continuation row (starts with spaces before |)
    if (line.match(/^\s+\|/)) {
      // Merge with previous row
      if (currentRow) {
        currentRow += ' ' + line
      }
      continue
    }

    // Process previous row if exists
    if (currentRow) {
      const parsed = parseTableRow(currentRow)
      if (parsed) rows.push(parsed)
    }

    // Start new row
    currentRow = line
  }

  // Process last row
  if (currentRow) {
    const parsed = parseTableRow(currentRow)
    if (parsed) rows.push(parsed)
  }

  return rows
}

function parseTableRow(line: string): TableRow | null {
  // Extract cells using regex
  const cells: string[] = []
  const regex = /\|\s*([^|]*?)\s*(?=\|)/g
  let match

  while ((match = regex.exec(line)) !== null) {
    cells.push(match[1].trim())
  }

  if (cells.length < 3) return null

  return {
    raw: line,
    name: cells[0] || '',
    hr: cells[1] || '',
    dias: cells[2] || '',
  }
}

// ==================== DATABASE FUNCTIONS ====================

async function findOrCreateMember(name: string): Promise<MemberResult> {
  // Try exact match (case-insensitive)
  const exactMatch = await prisma.membro.findFirst({
    where: {
      usuario: {
        nome: {
          equals: name,
          mode: 'insensitive',
        },
      },
    },
    include: { usuario: true },
  })

  if (exactMatch) {
    return { id: exactMatch.id, nome: exactMatch.usuario.nome || name, created: false }
  }

  // Try fuzzy match on first + last name
  const nameParts = name.split(' ').filter(p => p.length > 2)
  if (nameParts.length >= 2) {
    const firstName = nameParts[0]
    const lastName = nameParts[nameParts.length - 1]

    const fuzzyMatch = await prisma.membro.findFirst({
      where: {
        usuario: {
          nome: {
            contains: firstName,
            mode: 'insensitive',
          },
        },
      },
      include: { usuario: true },
    })

    if (fuzzyMatch && (fuzzyMatch.usuario.nome || '').toUpperCase().includes(lastName.toUpperCase())) {
      return { id: fuzzyMatch.id, nome: fuzzyMatch.usuario.nome || name, created: false }
    }
  }

  // Not found - create placeholder member
  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would create member: ${name}`)
    return { id: 'dry-run-id', nome: name, created: true }
  }

  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@placeholder.local`
  const cpf = generatePlaceholderCPF()
  const telefone = '00000000000'
  const senha = generatePassword()

  const newMember = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        nome: name,
        email,
        senha: await hash(senha, 12),
        role: 'MEMBRO',
      },
    })

    return tx.membro.create({
      data: {
        usuarioId: usuario.id,
        cpf,
        telefone,
        dataNascimento: new Date('1990-01-01'),
        status: 'PENDENTE',
      },
      include: { usuario: true },
    })
  })

  return { id: newMember.id, nome: newMember.usuario.nome || name, created: true }
}

async function getOrCreateHorario(diaSemana: DiaSemana, hour: number): Promise<string> {
  const horaInicio = `${hour.toString().padStart(2, '0')}:00`
  const horaFim = `${((hour + 1) % 24).toString().padStart(2, '0')}:00`

  // Try to find existing
  let horario = await prisma.horarioDisponivel.findFirst({
    where: {
      diaSemana,
      horaInicio,
      ativo: true,
    },
  })

  // Create if not found
  if (!horario) {
    if (DRY_RUN) {
      console.log(`\n[DRY RUN] Would create horario: ${diaSemana} ${horaInicio}-${horaFim}`)
      return 'dry-run-horario-id'
    }

    horario = await prisma.horarioDisponivel.create({
      data: {
        diaSemana,
        horaInicio,
        horaFim,
        vagasTotal: MAX_CAPACITY_PER_SLOT,
      },
    })
  }

  return horario.id
}

function generateAppointmentDates(daysOfWeek: DiaSemana[]): Date[] {
  const dates: Date[] = []
  const daysInMonth = new Date(TARGET_YEAR, TARGET_MONTH, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(TARGET_YEAR, TARGET_MONTH - 1, day, 12, 0, 0) // Noon to avoid timezone issues
    const dayOfWeek = getDiaSemanaFromDay(date.getDay())

    if (daysOfWeek.includes(dayOfWeek)) {
      dates.push(date)
    }
  }

  return dates
}

async function checkSlotCapacity(horarioId: string, data: Date): Promise<{ available: boolean; current: number; max: number }> {
  const horario = await prisma.horarioDisponivel.findUnique({
    where: { id: horarioId },
  })

  const existingCount = await prisma.agendamento.count({
    where: {
      horarioId,
      data,
    },
  })

  return {
    available: existingCount < (horario?.vagasTotal || MAX_CAPACITY_PER_SLOT),
    current: existingCount,
    max: horario?.vagasTotal || MAX_CAPACITY_PER_SLOT,
  }
}

async function createAppointmentsForMember(
  membroId: string,
  timeSlots: number[],
  daysOfWeek: DiaSemana[]
): Promise<AppointmentResults> {
  const results: AppointmentResults = {
    created: 0,
    skipped: 0,
    errors: [],
  }

  const allDates = generateAppointmentDates(daysOfWeek)

  for (const hour of timeSlots) {
    for (const day of daysOfWeek) {
      const horarioId = await getOrCreateHorario(day, hour)

      // Get dates that match this day of week
      const matchingDates = allDates.filter(date =>
        getDiaSemanaFromDay(date.getDay()) === day
      )

      for (const date of matchingDates) {
        try {
          // Check if already exists
          const existing = await prisma.agendamento.findFirst({
            where: {
              membroId,
              horarioId,
              data: date,
            },
          })

          if (existing) {
            results.skipped++
            continue
          }

          // Check capacity
          if (!DRY_RUN) {
            const capacity = await checkSlotCapacity(horarioId, date)
            if (!capacity.available) {
              results.errors.push(
                `Slot full: ${formatDateISO(date)} at ${hour}:00 (${capacity.current}/${capacity.max})`
              )
              results.skipped++
              continue
            }
          }

          // Create appointment
          if (DRY_RUN) {
            results.created++
          } else {
            await prisma.agendamento.create({
              data: {
                membroId,
                horarioId,
                data: date,
              },
            })
            results.created++
          }
        } catch (error) {
          results.errors.push(`Failed to create appointment: ${error}`)
        }
      }
    }
  }

  return results
}

// ==================== MAIN EXECUTION ====================

async function main() {
  console.log('========================================')
  console.log('  Schedule Import Script')
  console.log('========================================')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log(`Target: ${TARGET_MONTH}/${TARGET_YEAR} (January 2026)`)
  console.log('========================================\n')

  // Read output.md file
  const filePath = join(process.cwd(), 'output.md')
  console.log(`Reading file: ${filePath}`)
  const fileContent = readFileSync(filePath, 'utf-8')

  // Parse ASCII table
  console.log('Parsing ASCII table...')
  const rows = parseTable(fileContent)
  console.log(`Found ${rows.length} rows to process\n`)

  // Initialize report
  const report: ImportReport = {
    totalRows: rows.length,
    processedRows: 0,
    skippedRows: 0,
    membersFound: 0,
    membersCreated: 0,
    membersFailed: 0,
    horariosCreated: 0,
    horariosReused: 0,
    appointmentsCreated: 0,
    appointmentsSkipped: 0,
    appointmentsFailed: 0,
    errors: [],
    warnings: [],
  }

  // Process each row
  for (const [index, row] of rows.entries()) {
    try {
      // Extract data
      const name = extractMemberName(row.name)
      const timeSlots = parseTimeSlots(row.hr)
      const daysOfWeek = parseDaysOfWeek(row.dias)

      // Validate
      if (!name || name.length < 3) {
        report.skippedRows++
        report.warnings.push({
          row: index + 6, // +6 for header rows
          memberName: row.name || 'Unknown',
          message: 'Invalid or missing name',
        })
        continue
      }

      if (timeSlots.length === 0 || daysOfWeek.length === 0) {
        report.skippedRows++
        report.warnings.push({
          row: index + 6,
          memberName: name,
          message: `Missing data - Time slots: ${timeSlots.length}, Days: ${daysOfWeek.length}`,
        })
        continue
      }

      logProgress(index + 1, rows.length, name)

      // Find or create member
      const member = await findOrCreateMember(name)
      if (member.created) {
        report.membersCreated++
      } else {
        report.membersFound++
      }

      // Create appointments
      const results = await createAppointmentsForMember(
        member.id,
        timeSlots,
        daysOfWeek
      )

      report.appointmentsCreated += results.created
      report.appointmentsSkipped += results.skipped

      if (results.errors.length > 0) {
        report.errors.push(...results.errors.map(e => ({
          row: index + 6,
          memberName: name,
          type: 'appointment',
          message: e,
        })))
      }

      report.processedRows++

    } catch (error) {
      report.membersFailed++
      report.errors.push({
        row: index + 6,
        memberName: row.name || 'Unknown',
        type: 'fatal',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log('\n\n========================================')
  console.log('  Import Complete!')
  console.log('========================================')
  console.log(`Total rows processed: ${report.processedRows}/${report.totalRows}`)
  console.log(`Rows skipped: ${report.skippedRows}`)
  console.log('')
  console.log(`Members found: ${report.membersFound}`)
  console.log(`Members created: ${report.membersCreated}`)
  console.log(`Members failed: ${report.membersFailed}`)
  console.log('')
  console.log(`Appointments created: ${report.appointmentsCreated}`)
  console.log(`Appointments skipped: ${report.appointmentsSkipped}`)
  console.log(`Appointment errors: ${report.errors.filter(e => e.type === 'appointment').length}`)
  console.log('')
  console.log(`Warnings: ${report.warnings.length}`)
  console.log(`Errors: ${report.errors.length}`)
  console.log('========================================\n')

  // Save report
  const logsDir = join(process.cwd(), 'utility', 'logs')
  mkdirSync(logsDir, { recursive: true })

  const timestamp = Date.now()
  const reportPath = join(logsDir, `import-report-${timestamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`Report saved to: ${reportPath}`)

  // Show warnings and errors if any
  if (report.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    report.warnings.slice(0, 10).forEach(w => {
      console.log(`  Row ${w.row}: ${w.memberName} - ${w.message}`)
    })
    if (report.warnings.length > 10) {
      console.log(`  ... and ${report.warnings.length - 10} more warnings (see report file)`)
    }
  }

  if (report.errors.length > 0) {
    console.log('\n❌ Errors:')
    report.errors.slice(0, 10).forEach(e => {
      console.log(`  Row ${e.row}: ${e.memberName} - ${e.message}`)
    })
    if (report.errors.length > 10) {
      console.log(`  ... and ${report.errors.length - 10} more errors (see report file)`)
    }
  }

  console.log('')
}

// Run the script
main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
