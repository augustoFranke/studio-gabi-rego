#!/usr/bin/env tsx
/**
 * Lista Schedule Import Script
 *
 * Imports member schedules from lista.md (markdown table format)
 * and creates recurring appointments for January 2026
 * 
 * Format expected:
 * - Day sections: SEGUNDA MANHÃ/TARDE, TERÇA MANHÃ/TARDE, etc.
 * - Time slots: 5H, 6H, 7H... 19H
 * - Members listed as "1\. NAME", "2\. NAME", etc.
 * - Two instructor columns: GABI and ESTAGIÁRIO
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../src/lib/prisma'
import { DiaSemana } from '@prisma/client'
import { getDiaSemanaFromDay, MAX_CAPACITY_PER_SLOT } from '../src/lib/schedule'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'

// ==================== TYPES ====================

interface ScheduleEntry {
  day: DiaSemana
  hour: number
  memberName: string
  instructor: 'GABI' | 'ESTAGIÁRIO'
}

interface ImportReport {
  totalEntries: number
  processedEntries: number
  skippedEntries: number
  
  membersFound: number
  membersCreated: number
  membersFailed: number
  
  horariosCreated: number
  
  appointmentsCreated: number
  appointmentsSkipped: number
  appointmentsFailed: number
  
  byDay: Record<string, number>
  byInstructor: Record<string, number>
  
  errors: Array<{
    memberName: string
    type: string
    message: string
  }>
  
  warnings: Array<{
    memberName: string
    message: string
  }>
  
  createdMembers: Array<{
    name: string
    email: string
  }>
}

// ==================== CONSTANTS ====================

const DAY_NAME_MAP: Record<string, DiaSemana> = {
  'SEGUNDA': 'SEGUNDA',
  'TERÇA': 'TERCA',
  'TERCA': 'TERCA',
  'QUARTA': 'QUARTA',
  'QUINTA': 'QUINTA',
  'SEXTA': 'SEXTA',
  'SÁBADO': 'SABADO',
  'SABADO': 'SABADO',
  'SABÁDO': 'SABADO',
}

const TARGET_MONTH = 1 // January
const TARGET_YEAR = 2026

const DRY_RUN = process.argv.includes('--dry-run')
const CLEAR_EXISTING = process.argv.includes('--clear')

// ==================== UTILITY FUNCTIONS ====================

function generatePassword(): string {
  return randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
}

function generatePlaceholderCPF(): string {
  const base = '999' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
  
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(base[i]) * (10 - i)
  }
  let digit1 = (sum * 10) % 11
  if (digit1 === 10) digit1 = 0
  
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

function cleanMemberName(raw: string): string {
  let name = raw.trim()
  
  // Remove backslashes and markdown escapes
  name = name.replace(/\\/g, '')
  
  // Remove position prefix (1., 2., etc.)
  name = name.replace(/^\d+\.\s*/, '')
  
  // Remove time suffixes like "(13:30)" or "(18:40)"
  name = name.replace(/\s*\(\d+:\d+\)\s*/g, '')
  
  // Remove markdown marks like {.mark}
  name = name.replace(/\{[^}]+\}/g, '')
  
  // Remove brackets
  name = name.replace(/[\[\]]/g, '')
  
  // Remove any trailing numbers
  name = name.replace(/\s*\d+\s*$/, '')
  
  // Remove leading/trailing dashes
  name = name.replace(/^[-\s]+|[-\s]+$/g, '')
  
  // Check if it's mostly dashes or empty (placeholder entries)
  if (name.match(/^[-\s]*$/) || name.length < 2) {
    return ''
  }
  
  // Skip entries that are just dashes mixed with dots (e.g., "------------ 1.")
  if (name.replace(/[-.\s\d]/g, '').length < 2) {
    return ''
  }
  
  // Clean up multiple spaces
  name = name.replace(/\s+/g, ' ').trim()
  
  // Convert to title case
  name = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  
  return name
}

function parseHour(hourStr: string): number | null {
  // Extract hour from formats like "5H", "10H", "12H ALMOÇO"
  const match = hourStr.match(/^(\d+)H/)
  if (match) {
    return parseInt(match[1])
  }
  return null
}

// ==================== PARSING FUNCTIONS ====================

function parseListaMd(content: string): ScheduleEntry[] {
  const entries: ScheduleEntry[] = []
  const lines = content.split('\n')
  
  let currentDay: DiaSemana | null = null
  let currentHour: number | null = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip empty lines and separator lines
    if (!trimmed || trimmed.match(/^-+$/)) continue
    
    // Detect day section header
    // Format: "SEGUNDA MANHÃ" or "TERÇA TARDE" etc.
    const dayMatch = trimmed.match(/^(SEGUNDA|TERÇA|TERCA|QUARTA|QUINTA|SEXTA|SÁBADO|SABADO|SABÁDO)\s*(MANHÃ|TARDE)?/i)
    if (dayMatch) {
      const dayName = dayMatch[1].toUpperCase()
      currentDay = DAY_NAME_MAP[dayName] || null
      continue
    }
    
    // Detect hour line
    // Format: "5H                 1\. LUANA N       1\. ROSANGELA"
    const hourMatch = trimmed.match(/^(\d+H(?:\s+ALMOÇO)?)\s+/)
    if (hourMatch) {
      currentHour = parseHour(hourMatch[1])
      
      if (currentDay && currentHour !== null) {
        // Parse the rest of the line for member names
        const restOfLine = trimmed.slice(hourMatch[0].length)
        const parsed = parseScheduleLine(restOfLine, currentDay, currentHour)
        entries.push(...parsed)
      }
      continue
    }
    
    // Check if this is a continuation line with member entries
    // These lines start with spaces and contain "1\." or "2\." etc patterns
    if (currentDay && currentHour !== null && trimmed.match(/^\d+\\?\.\s/)) {
      const parsed = parseScheduleLine(trimmed, currentDay, currentHour)
      entries.push(...parsed)
    }
  }
  
  return entries
}

function parseScheduleLine(line: string, day: DiaSemana, hour: number): ScheduleEntry[] {
  const entries: ScheduleEntry[] = []
  
  // Split by multiple spaces to separate GABI and ESTAGIÁRIO columns
  // The format is typically: "GABI_ENTRIES         ESTAGIÁRIO_ENTRIES"
  const parts = line.split(/\s{3,}/)
  
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex].trim()
    if (!part) continue
    
    // Determine instructor based on column position
    // First column (or any GABI column) = GABI, second column = ESTAGIÁRIO
    const instructor: 'GABI' | 'ESTAGIÁRIO' = partIndex === 0 ? 'GABI' : 'ESTAGIÁRIO'
    
    // Extract all numbered entries from this part
    // Format: "1\. NAME" or "2.NAME" etc
    const entryPattern = /\d+\\?\.\s*([^0-9]+?)(?=\s*\d+\\?\.|$)/g
    let match
    
    while ((match = entryPattern.exec(part)) !== null) {
      const name = cleanMemberName(match[1])
      if (name && name.length >= 2) {
        entries.push({
          day,
          hour,
          memberName: name,
          instructor
        })
      }
    }
    
    // Also try simple pattern for single entries
    if (entries.length === 0) {
      const simpleMatch = part.match(/\d+\\?\.\s*(.+)/)
      if (simpleMatch) {
        const name = cleanMemberName(simpleMatch[1])
        if (name && name.length >= 2) {
          entries.push({
            day,
            hour,
            memberName: name,
            instructor
          })
        }
      }
    }
  }
  
  return entries
}

// ==================== DATABASE FUNCTIONS ====================

async function findOrCreateMember(name: string, report: ImportReport): Promise<string | null> {
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
    report.membersFound++
    return exactMatch.id
  }
  
  // Try fuzzy match on first + last name
  const nameParts = name.split(' ').filter(p => p.length > 2)
  if (nameParts.length >= 1) {
    const firstName = nameParts[0]
    
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
    
    if (fuzzyMatch) {
      // Check if it's a reasonable match
      const matchName = fuzzyMatch.usuario.nome.toUpperCase()
      const searchName = name.toUpperCase()
      
      // If last name exists, verify it
      if (nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1]
        if (matchName.includes(lastName.toUpperCase())) {
          report.membersFound++
          return fuzzyMatch.id
        }
      } else {
        // Single name match
        report.membersFound++
        return fuzzyMatch.id
      }
    }
  }
  
  // Not found - create placeholder member
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create member: ${name}`)
    report.membersCreated++
    return 'dry-run-id-' + name.replace(/\s/g, '-')
  }
  
  try {
    const email = `${name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}@placeholder.local`
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
    
    report.membersCreated++
    report.createdMembers.push({ name, email })
    return newMember.id
    
  } catch (error) {
    report.membersFailed++
    report.errors.push({
      memberName: name,
      type: 'member_creation',
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
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
  
  if (!horario) {
    if (DRY_RUN) {
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

function generateAppointmentDates(day: DiaSemana): Date[] {
  const dates: Date[] = []
  const daysInMonth = new Date(TARGET_YEAR, TARGET_MONTH, 0).getDate()
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(TARGET_YEAR, TARGET_MONTH - 1, d, 12, 0, 0)
    const dayOfWeek = getDiaSemanaFromDay(date.getDay())
    
    if (dayOfWeek === day) {
      dates.push(date)
    }
  }
  
  return dates
}

async function createAppointmentsForEntry(
  entry: ScheduleEntry,
  membroId: string,
  report: ImportReport
): Promise<void> {
  const dates = generateAppointmentDates(entry.day)
  
  for (const date of dates) {
    try {
      const horarioId = await getOrCreateHorario(entry.day, entry.hour)
      
      // Check if already exists
      const existing = await prisma.agendamento.findFirst({
        where: {
          membroId,
          horarioId,
          data: date,
        },
      })
      
      if (existing) {
        report.appointmentsSkipped++
        continue
      }
      
      if (DRY_RUN) {
        report.appointmentsCreated++
      } else {
        await prisma.agendamento.create({
          data: {
            membroId,
            horarioId,
            data: date,
            observacao: `Instrutor: ${entry.instructor}`,
          },
        })
        report.appointmentsCreated++
      }
    } catch (error) {
      report.appointmentsFailed++
      report.errors.push({
        memberName: entry.memberName,
        type: 'appointment',
        message: `${entry.day} ${entry.hour}H: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
}

// ==================== MAIN EXECUTION ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║           Lista.md Schedule Import Script                      ║')
  console.log('╠════════════════════════════════════════════════════════════════╣')
  console.log(`║ Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`.padEnd(67) + '║')
  console.log(`║ Clear existing: ${CLEAR_EXISTING ? 'YES' : 'NO'}`.padEnd(67) + '║')
  console.log(`║ Target: January ${TARGET_YEAR}`.padEnd(67) + '║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log()
  
  // Read lista.md file
  const filePath = join(process.cwd(), 'lista.md')
  console.log(`📄 Reading file: ${filePath}`)
  const fileContent = readFileSync(filePath, 'utf-8')
  
  // Parse the markdown table
  console.log('🔍 Parsing schedule...')
  const entries = parseListaMd(fileContent)
  console.log(`   Found ${entries.length} schedule entries\n`)
  
  // Initialize report
  const report: ImportReport = {
    totalEntries: entries.length,
    processedEntries: 0,
    skippedEntries: 0,
    membersFound: 0,
    membersCreated: 0,
    membersFailed: 0,
    horariosCreated: 0,
    appointmentsCreated: 0,
    appointmentsSkipped: 0,
    appointmentsFailed: 0,
    byDay: {},
    byInstructor: { GABI: 0, 'ESTAGIÁRIO': 0 },
    errors: [],
    warnings: [],
    createdMembers: [],
  }
  
  // Clear existing January 2026 appointments if requested
  if (CLEAR_EXISTING && !DRY_RUN) {
    console.log('🗑️  Clearing existing January 2026 appointments...')
    const startDate = new Date(TARGET_YEAR, TARGET_MONTH - 1, 1)
    const endDate = new Date(TARGET_YEAR, TARGET_MONTH, 0)
    
    const deleted = await prisma.agendamento.deleteMany({
      where: {
        data: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
    console.log(`   Deleted ${deleted.count} existing appointments\n`)
  }
  
  // Group entries by member to avoid duplicate processing
  const memberEntries = new Map<string, ScheduleEntry[]>()
  for (const entry of entries) {
    const key = entry.memberName.toLowerCase()
    if (!memberEntries.has(key)) {
      memberEntries.set(key, [])
    }
    memberEntries.get(key)!.push(entry)
  }
  
  console.log(`👥 Processing ${memberEntries.size} unique members...\n`)
  
  let processed = 0
  for (const [, memberEntriesArr] of memberEntries) {
    const firstEntry = memberEntriesArr[0]
    const name = firstEntry.memberName
    
    processed++
    const progress = Math.round((processed / memberEntries.size) * 100)
    process.stdout.write(`\r  [${'█'.repeat(Math.floor(progress / 2))}${'░'.repeat(50 - Math.floor(progress / 2))}] ${progress}% - ${name.padEnd(25).slice(0, 25)}`)
    
    // Find or create member
    const membroId = await findOrCreateMember(name, report)
    if (!membroId) {
      report.skippedEntries += memberEntriesArr.length
      continue
    }
    
    // Create appointments for all entries of this member
    for (const entry of memberEntriesArr) {
      await createAppointmentsForEntry(entry, membroId, report)
      
      // Update stats
      report.byDay[entry.day] = (report.byDay[entry.day] || 0) + 1
      report.byInstructor[entry.instructor]++
      report.processedEntries++
    }
  }
  
  console.log('\n\n')
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                     Import Complete!                           ║')
  console.log('╠════════════════════════════════════════════════════════════════╣')
  console.log(`║ Schedule entries processed: ${report.processedEntries}/${report.totalEntries}`.padEnd(67) + '║')
  console.log(`║ Entries skipped: ${report.skippedEntries}`.padEnd(67) + '║')
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log(`║ Members found in DB: ${report.membersFound}`.padEnd(67) + '║')
  console.log(`║ Members created: ${report.membersCreated}`.padEnd(67) + '║')
  console.log(`║ Members failed: ${report.membersFailed}`.padEnd(67) + '║')
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log(`║ Appointments created: ${report.appointmentsCreated}`.padEnd(67) + '║')
  console.log(`║ Appointments skipped (existing): ${report.appointmentsSkipped}`.padEnd(67) + '║')
  console.log(`║ Appointments failed: ${report.appointmentsFailed}`.padEnd(67) + '║')
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log('║ By Day:'.padEnd(67) + '║')
  for (const [day, count] of Object.entries(report.byDay)) {
    console.log(`║   ${day}: ${count}`.padEnd(67) + '║')
  }
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log('║ By Instructor:'.padEnd(67) + '║')
  console.log(`║   GABI: ${report.byInstructor.GABI}`.padEnd(67) + '║')
  console.log(`║   ESTAGIÁRIO: ${report.byInstructor['ESTAGIÁRIO']}`.padEnd(67) + '║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  
  // Save report
  const logsDir = join(process.cwd(), 'utility', 'logs')
  mkdirSync(logsDir, { recursive: true })
  
  const timestamp = Date.now()
  const reportPath = join(logsDir, `lista-import-report-${timestamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📝 Report saved to: ${reportPath}`)
  
  // Show created members
  if (report.createdMembers.length > 0) {
    console.log('\n🆕 Created Members:')
    report.createdMembers.forEach(m => {
      console.log(`   • ${m.name} (${m.email})`)
    })
  }
  
  // Show warnings
  if (report.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    report.warnings.slice(0, 10).forEach(w => {
      console.log(`   ${w.memberName}: ${w.message}`)
    })
    if (report.warnings.length > 10) {
      console.log(`   ... and ${report.warnings.length - 10} more (see report)`)
    }
  }
  
  // Show errors
  if (report.errors.length > 0) {
    console.log('\n❌ Errors:')
    report.errors.slice(0, 10).forEach(e => {
      console.log(`   ${e.memberName} [${e.type}]: ${e.message}`)
    })
    if (report.errors.length > 10) {
      console.log(`   ... and ${report.errors.length - 10} more (see report)`)
    }
  }
  
  console.log()
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
