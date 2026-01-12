#!/usr/bin/env tsx
/**
 * Update Schedule and Payments from lista.md
 *
 * Reads the member list from lista.md and:
 * 1. Updates member schedules based on HR (time) and DIAS DA SEMANA (days)
 * 2. Creates payment records for January 2026 based on PAGO column
 *
 * Usage:
 *   npx tsx utility/update-from-lista.ts [--dry-run] [--clear-appointments]
 *
 * Flags:
 *   --dry-run             Don't make any changes, just show what would happen
 *   --clear-appointments  Clear existing January 2026 appointments before creating new ones
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../src/lib/prisma'
import { DiaSemana } from '@prisma/client'
import { getDiaSemanaFromDay, MAX_CAPACITY_PER_SLOT } from '../src/lib/schedule'

// ==================== TYPES ====================

interface ParsedMember {
  rowNumber: number
  rawName: string
  name: string
  hours: number[]
  days: DiaSemana[]
  paymentValue: number | null
  paymentNote: string | null
}

interface UpdateReport {
  timestamp: string
  mode: 'DRY_RUN' | 'LIVE'
  clearAppointments: boolean

  totalParsed: number
  successfulMatches: number
  failedMatches: number

  appointmentsCleared: number
  appointmentsCreated: number
  appointmentsSkipped: number

  paymentsCreated: number
  paymentsSkipped: number

  members: Array<{
    name: string
    matched: boolean
    matchedTo?: string
    hours: number[]
    days: string[]
    paymentValue: number | null
    appointmentsCreated: number
    paymentCreated: boolean
    errors: string[]
  }>

  errors: string[]
  warnings: string[]
}

// ==================== CONSTANTS ====================

const TARGET_MONTH = 1 // January
const TARGET_YEAR = 2026

const DRY_RUN = process.argv.includes('--dry-run')
const CLEAR_APPOINTMENTS = process.argv.includes('--clear-appointments')

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

// ==================== PARSING FUNCTIONS ====================

function parseListaMd(content: string): ParsedMember[] {
  const lines = content.split(/\r?\n/)
  const members: ParsedMember[] = []

  let currentRow: string[] = []
  let rowNumber = 0

  for (const line of lines) {
    // Skip separator lines and empty lines
    if (line.match(/^\+[-=+]+\+$/) || !line.trim()) {
      continue
    }

    // Skip header rows
    if (line.includes('ALUNOS STUDIO') || line.includes('MÊS:') || line.includes('HR') && line.includes('DIAS')) {
      continue
    }

    // Check if this is a data row
    if (line.startsWith('|')) {
      // Extract cells
      const cells = line.split('|').slice(1, -1).map(c => c.trim())

      // Check if this is a new row (has a number at the start of name)
      const firstName = cells[0] || ''
      if (firstName.match(/^\d+\.\s+/)) {
        // Process previous row if exists
        if (currentRow.length > 0) {
          const member = parseRow(currentRow, rowNumber)
          if (member) members.push(member)
        }
        currentRow = cells
        rowNumber++
      } else if (currentRow.length > 0) {
        // Continuation of previous row - merge cells
        for (let i = 0; i < cells.length; i++) {
          if (cells[i]) {
            currentRow[i] = (currentRow[i] || '') + ' ' + cells[i]
          }
        }
      }
    }
  }

  // Process last row
  if (currentRow.length > 0) {
    const member = parseRow(currentRow, rowNumber)
    if (member) members.push(member)
  }

  return members
}

function parseRow(cells: string[], rowNumber: number): ParsedMember | null {
  // Columns: ALUNOS STUDIO | HR | DIAS DA SEMANA | CADST/ANAMNESE | PAGO | HR (last)
  // We only care about: name (0), HR (1), DIAS DA SEMANA (2), PAGO (4)

  const rawName = cells[0]?.trim() || ''
  const hrField = cells[1]?.trim() || ''
  const diasField = cells[2]?.trim() || ''
  const pagoField = cells[4]?.trim() || ''

  if (!rawName) return null

  const name = extractMemberName(rawName)
  const hours = parseTimeSlots(hrField)
  const days = parseDaysOfWeek(diasField)
  const { value: paymentValue, note: paymentNote } = parsePaymentValue(pagoField)

  return {
    rowNumber,
    rawName,
    name,
    hours,
    days,
    paymentValue,
    paymentNote,
  }
}

function extractMemberName(raw: string): string {
  let name = raw

  // Remove row number prefix (e.g., "1.", "23.")
  name = name.replace(/^\d+\.\s*/, '')

  // Remove parenthetical suffixes but keep them for reference
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
    .map(word => {
      if (word.length <= 2) return word.toLowerCase() // prepositions
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
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

  // Handle simple hour or formatted time (e.g., "19", "13:00", "5:00")
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

  // Handle "2 DE 8" or "3X" patterns (just use first number as days per week indicator - skip these)
  if (cleaned.match(/^\d+\s*(DE|X)\s*/i)) {
    return [] // Can't determine specific days
  }

  // Handle ranges (e.g., "SEG À SEX", "SEG A SEX", "SEG A QUI")
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

  // Handle slash-separated or "E" separator (e.g., "TER/QUI", "SEG E SEX", "SEG/QUA/SEX")
  const parts = cleaned.split(/[\/]/).map(p => p.trim()).filter(p => p.length > 0)

  for (const part of parts) {
    // Handle "SEG E SEX" within a part
    const subParts = part.split(/\s+E\s+/i)
    for (const subPart of subParts) {
      const day = DAY_MAP[subPart.trim()]
      if (day && !days.includes(day)) {
        days.push(day)
      }
    }
  }

  return days
}

function parsePaymentValue(pagoField: string): { value: number | null; note: string | null } {
  if (!pagoField || pagoField.trim() === '') {
    return { value: null, note: null }
  }

  const cleaned = pagoField.trim()

  // Check for non-numeric indicators
  if (cleaned.toLowerCase() === 'pago') {
    return { value: null, note: 'Já pago' }
  }

  if (cleaned.match(/^(pg|pago)\s+até/i)) {
    return { value: null, note: cleaned }
  }

  if (cleaned.match(/até\s+\w+$/i)) {
    // Value with "até" suffix (e.g., "750 até dez")
    const numMatch = cleaned.match(/^([\d.,]+)/)
    if (numMatch) {
      const value = parseFloat(numMatch[1].replace(/\./g, '').replace(',', '.'))
      if (!isNaN(value)) {
        return { value, note: cleaned }
      }
    }
    return { value: null, note: cleaned }
  }

  // Try to parse numeric value (e.g., "225,00", "350.00", "1.000,00")
  let numericStr = cleaned.replace(/[^\d.,]/g, '')

  // Handle Brazilian format (1.000,00 -> 1000.00)
  if (numericStr.includes(',')) {
    // Remove thousand separators (dots) and convert comma to decimal point
    numericStr = numericStr.replace(/\./g, '').replace(',', '.')
  }

  const value = parseFloat(numericStr)
  if (!isNaN(value) && value > 0) {
    return { value, note: null }
  }

  return { value: null, note: cleaned || null }
}

// ==================== DATABASE FUNCTIONS ====================

async function findMemberByName(name: string): Promise<{ id: string; nome: string } | null> {
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
    return { id: exactMatch.id, nome: exactMatch.usuario.nome }
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

    if (fuzzyMatch && fuzzyMatch.usuario.nome.toUpperCase().includes(lastName.toUpperCase())) {
      return { id: fuzzyMatch.id, nome: fuzzyMatch.usuario.nome }
    }
  }

  // Try just first name match
  if (nameParts.length >= 1) {
    const firstName = nameParts[0]

    const firstNameMatch = await prisma.membro.findFirst({
      where: {
        usuario: {
          nome: {
            startsWith: firstName,
            mode: 'insensitive',
          },
        },
      },
      include: { usuario: true },
    })

    if (firstNameMatch) {
      return { id: firstNameMatch.id, nome: firstNameMatch.usuario.nome }
    }
  }

  return null
}

async function getOrCreateHorario(diaSemana: DiaSemana, hour: number): Promise<string> {
  const horaInicio = `${hour.toString().padStart(2, '0')}:00`
  const horaFim = `${((hour + 1) % 24).toString().padStart(2, '0')}:00`

  let horario = await prisma.horarioDisponivel.findFirst({
    where: {
      diaSemana,
      horaInicio,
      ativo: true,
    },
  })

  if (!horario && !DRY_RUN) {
    horario = await prisma.horarioDisponivel.create({
      data: {
        diaSemana,
        horaInicio,
        horaFim,
        vagasTotal: MAX_CAPACITY_PER_SLOT,
      },
    })
  }

  return horario?.id || 'dry-run-horario-id'
}

function generateAppointmentDates(daysOfWeek: DiaSemana[]): Date[] {
  const dates: Date[] = []
  const daysInMonth = new Date(TARGET_YEAR, TARGET_MONTH, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(TARGET_YEAR, TARGET_MONTH - 1, day, 12, 0, 0)
    const dayOfWeek = getDiaSemanaFromDay(date.getDay())

    if (daysOfWeek.includes(dayOfWeek)) {
      dates.push(date)
    }
  }

  return dates
}

async function clearMemberAppointmentsForMonth(membroId: string): Promise<number> {
  if (DRY_RUN) return 0

  const startDate = new Date(TARGET_YEAR, TARGET_MONTH - 1, 1, 0, 0, 0)
  const endDate = new Date(TARGET_YEAR, TARGET_MONTH, 0, 23, 59, 59)

  const result = await prisma.agendamento.deleteMany({
    where: {
      membroId,
      data: {
        gte: startDate,
        lte: endDate,
      },
    },
  })

  return result.count
}

async function createAppointmentsForMember(
  membroId: string,
  hours: number[],
  days: DiaSemana[]
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const results = { created: 0, skipped: 0, errors: [] as string[] }

  const allDates = generateAppointmentDates(days)

  for (const hour of hours) {
    for (const day of days) {
      const horarioId = await getOrCreateHorario(day, hour)

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

          if (!DRY_RUN) {
            await prisma.agendamento.create({
              data: {
                membroId,
                horarioId,
                data: date,
              },
            })
          }
          results.created++
        } catch (error) {
          results.errors.push(`Failed to create appointment: ${error}`)
        }
      }
    }
  }

  return results
}

async function getDefaultPlano(): Promise<string | null> {
  // Try to find a default plan for payments
  const plan = await prisma.plano.findFirst({
    where: { ativo: true },
    orderBy: { valor: 'desc' }, // Get the most common/expensive one
  })
  return plan?.id || null
}

async function createPaymentForMember(
  membroId: string,
  valor: number,
  observacao: string | null
): Promise<boolean> {
  if (DRY_RUN) return true

  const planoId = await getDefaultPlano()
  if (!planoId) {
    console.error('No active plan found to associate payment')
    return false
  }

  // Check if payment already exists for this month
  const startDate = new Date(TARGET_YEAR, TARGET_MONTH - 1, 1)
  const endDate = new Date(TARGET_YEAR, TARGET_MONTH, 0)

  const existingPayment = await prisma.pagamento.findFirst({
    where: {
      membroId,
      dataVencimento: {
        gte: startDate,
        lte: endDate,
      },
    },
  })

  if (existingPayment) {
    return false // Already has payment for this month
  }

  await prisma.pagamento.create({
    data: {
      membroId,
      planoId,
      valor,
      dataVencimento: new Date(TARGET_YEAR, TARGET_MONTH - 1, 10, 12, 0, 0), // 10th of the month
      status: 'PENDENTE',
      observacao: observacao || `Mensalidade Janeiro ${TARGET_YEAR}`,
    },
  })

  return true
}

// ==================== MAIN EXECUTION ====================

async function main() {
  console.log('========================================')
  console.log('  Update Schedule from lista.md')
  console.log('========================================')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`)
  console.log(`Clear appointments: ${CLEAR_APPOINTMENTS ? 'YES' : 'NO'}`)
  console.log(`Target: January ${TARGET_YEAR}`)
  console.log('========================================\n')

  const report: UpdateReport = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'DRY_RUN' : 'LIVE',
    clearAppointments: CLEAR_APPOINTMENTS,
    totalParsed: 0,
    successfulMatches: 0,
    failedMatches: 0,
    appointmentsCleared: 0,
    appointmentsCreated: 0,
    appointmentsSkipped: 0,
    paymentsCreated: 0,
    paymentsSkipped: 0,
    members: [],
    errors: [],
    warnings: [],
  }

  // Read lista.md
  const filePath = join(process.cwd(), 'lista.md')
  console.log(`Reading: ${filePath}`)
  const content = readFileSync(filePath, 'utf-8')

  // Parse the file
  console.log('Parsing lista.md...')
  const parsedMembers = parseListaMd(content)
  report.totalParsed = parsedMembers.length
  console.log(`Found ${parsedMembers.length} members\n`)

  // Process each member
  for (let i = 0; i < parsedMembers.length; i++) {
    const member = parsedMembers[i]
    const progress = Math.round(((i + 1) / parsedMembers.length) * 100)
    process.stdout.write(`\r[${progress}%] Processing: ${member.name.padEnd(30).slice(0, 30)}`)

    const memberReport = {
      name: member.name,
      matched: false,
      matchedTo: undefined as string | undefined,
      hours: member.hours,
      days: member.days.map(d => d.toString()),
      paymentValue: member.paymentValue,
      appointmentsCreated: 0,
      paymentCreated: false,
      errors: [] as string[],
    }

    try {
      // Find member in database
      const dbMember = await findMemberByName(member.name)

      if (!dbMember) {
        report.failedMatches++
        report.warnings.push(`Member not found: ${member.name}`)
        memberReport.errors.push('Member not found in database')
        report.members.push(memberReport)
        continue
      }

      memberReport.matched = true
      memberReport.matchedTo = dbMember.nome
      report.successfulMatches++

      // Handle schedule
      if (member.hours.length > 0 && member.days.length > 0) {
        // Clear existing appointments if requested
        if (CLEAR_APPOINTMENTS) {
          const cleared = await clearMemberAppointmentsForMonth(dbMember.id)
          report.appointmentsCleared += cleared
        }

        // Create new appointments
        const appointmentResults = await createAppointmentsForMember(
          dbMember.id,
          member.hours,
          member.days
        )

        memberReport.appointmentsCreated = appointmentResults.created
        report.appointmentsCreated += appointmentResults.created
        report.appointmentsSkipped += appointmentResults.skipped

        if (appointmentResults.errors.length > 0) {
          memberReport.errors.push(...appointmentResults.errors)
        }
      } else {
        report.warnings.push(`${member.name}: No valid schedule (hours: ${member.hours.length}, days: ${member.days.length})`)
      }

      // Handle payment
      if (member.paymentValue && member.paymentValue > 0) {
        const paymentCreated = await createPaymentForMember(
          dbMember.id,
          member.paymentValue,
          member.paymentNote
        )

        memberReport.paymentCreated = paymentCreated
        if (paymentCreated) {
          report.paymentsCreated++
        } else {
          report.paymentsSkipped++
        }
      }

    } catch (error) {
      memberReport.errors.push(`Error: ${error}`)
      report.errors.push(`${member.name}: ${error}`)
    }

    report.members.push(memberReport)
  }

  // Print summary
  console.log('\n\n========================================')
  console.log('  Update Complete!')
  console.log('========================================')
  console.log(`Total members parsed: ${report.totalParsed}`)
  console.log(`Matched: ${report.successfulMatches}`)
  console.log(`Not found: ${report.failedMatches}`)
  console.log('')
  console.log(`Appointments cleared: ${report.appointmentsCleared}`)
  console.log(`Appointments created: ${report.appointmentsCreated}`)
  console.log(`Appointments skipped: ${report.appointmentsSkipped}`)
  console.log('')
  console.log(`Payments created: ${report.paymentsCreated}`)
  console.log(`Payments skipped: ${report.paymentsSkipped}`)
  console.log('')
  console.log(`Warnings: ${report.warnings.length}`)
  console.log(`Errors: ${report.errors.length}`)
  console.log('========================================\n')

  // Save report
  const logsDir = join(process.cwd(), 'utility', 'logs')
  mkdirSync(logsDir, { recursive: true })

  const timestamp = Date.now()
  const reportPath = join(logsDir, `update-lista-report-${timestamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`Report saved to: ${reportPath}`)

  // Show warnings and errors
  if (report.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    report.warnings.slice(0, 15).forEach(w => console.log(`  - ${w}`))
    if (report.warnings.length > 15) {
      console.log(`  ... and ${report.warnings.length - 15} more warnings (see report file)`)
    }
  }

  if (report.errors.length > 0) {
    console.log('\n❌ Errors:')
    report.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`))
    if (report.errors.length > 10) {
      console.log(`  ... and ${report.errors.length - 10} more errors (see report file)`)
    }
  }

  // Show unmatched members
  const unmatchedMembers = report.members.filter(m => !m.matched)
  if (unmatchedMembers.length > 0) {
    console.log('\n📋 Unmatched members (need to be added to database):')
    unmatchedMembers.forEach(m => {
      console.log(`  - ${m.name}`)
    })
  }

  console.log('')
}

// Run
main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
