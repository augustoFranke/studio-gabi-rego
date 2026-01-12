#!/usr/bin/env tsx
/**
 * Lista Payments Import Script
 *
 * Imports payment records from lista.md (markdown table format)
 * and creates payment records for January 2026 with due date in February 2026.
 * 
 * Format expected (grid table):
 * | NAME | HR | DIAS | CADST | PAGO | HR |
 * 
 * Due date logic:
 * - Payment made in January 2026 → Due date in February 2026
 * - If member name contains a number in parentheses like "(20)" or at the end like "ALINE 20",
 *   that number is used as the day of the month (e.g., February 20, 2026)
 * - Otherwise, default due day is the 10th (e.g., February 10, 2026)
 * 
 * Usage:
 *   npx tsx utility/import-payments-lista.ts         # Live run
 *   npx tsx utility/import-payments-lista.ts --dry-run  # Preview only
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../src/lib/prisma'

// ==================== TYPES ====================

interface PaymentEntry {
  lineNumber: number
  rawName: string
  cleanName: string
  rawValue: string
  value: number | null
  observacao: string
  dueDay: number // Day of month for due date (extracted from name or default 10)
}

interface ImportReport {
  totalEntries: number
  processedEntries: number
  skippedEntries: number
  
  membersFound: number
  membersNotFound: string[]
  
  paymentsCreated: number
  paymentsSkipped: number
  paymentsFailed: number
  
  totalAmount: number
  
  errors: Array<{
    memberName: string
    type: string
    message: string
  }>
  
  successfulPayments: Array<{
    name: string
    value: number
    plano: string
  }>
}

// ==================== CONSTANTS ====================

const TARGET_MONTH = 1 // January
const TARGET_YEAR = 2026

const DRY_RUN = process.argv.includes('--dry-run')

// ==================== UTILITY FUNCTIONS ====================

/**
 * Extracts the due day from the member name.
 * Looks for patterns like "(20)", "(15)", or standalone numbers at the end like "ALINE 20"
 * Returns the extracted day or default 10
 */
function extractDueDay(raw: string): number {
  const DEFAULT_DUE_DAY = 10
  
  // Look for number in parentheses like "(20)", "(15)", etc.
  // But exclude patterns like "(CASAL)", "(FAMÍLIA)", "(ANA)" which are not numbers
  const parenMatch = raw.match(/\((\d{1,2})\)/)
  if (parenMatch) {
    const day = parseInt(parenMatch[1])
    if (day >= 1 && day <= 31) {
      return day
    }
  }
  
  // Look for standalone number at the end of the name like "ALINE AVILA 20"
  // But be careful not to match the row number prefix like "58."
  const endMatch = raw.match(/\s(\d{1,2})\s*$/)
  if (endMatch) {
    const day = parseInt(endMatch[1])
    if (day >= 1 && day <= 31) {
      return day
    }
  }
  
  return DEFAULT_DUE_DAY
}

function cleanMemberName(raw: string): string {
  let name = raw.trim()
  
  // Remove backslashes and markdown escapes
  name = name.replace(/\\/g, '')
  
  // Remove position prefix (1., 2., etc.)
  name = name.replace(/^\d+\.\s*/, '')
  
  // Remove common suffixes in parentheses like (CASAL), (FAMÍLIA), (ANA), numbers in parentheses
  // But preserve them for the observacao field
  name = name.replace(/\s*\([^)]+\)\s*/g, ' ')
  
  // Remove numbers at the end (like "15" in "JESSICA PEDÓ 12")
  name = name.replace(/\s+\d+\s*$/, '')
  
  // Remove asterisks
  name = name.replace(/\*/g, '')
  
  // Remove markdown marks
  name = name.replace(/\{[^}]+\}/g, '')
  
  // Remove leading/trailing dashes and special chars
  name = name.replace(/^[-\s]+|[-\s]+$/g, '')
  
  // Clean up multiple spaces
  name = name.replace(/\s+/g, ' ').trim()
  
  // Convert to title case
  name = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  
  return name
}

function parsePaymentValue(raw: string): { value: number | null; observacao: string } {
  const trimmed = raw.trim().toLowerCase()
  
  // Empty value
  if (!trimmed) {
    return { value: null, observacao: '' }
  }
  
  // Already paid indicators (no numeric value to register)
  if (trimmed === 'pago' || trimmed.startsWith('pg até') || trimmed.startsWith('pago até')) {
    return { value: null, observacao: raw.trim() }
  }
  
  // Extract numeric value
  // Handles formats like: "225,00", "350,00", "750 até dez", "1.000,00"
  const numMatch = raw.match(/([\d.,]+)/)
  if (numMatch) {
    let numStr = numMatch[1]
    // Convert Brazilian format (1.000,00) to JS number
    // First remove thousand separator dots, then replace decimal comma with dot
    numStr = numStr.replace(/\.(?=\d{3})/g, '').replace(',', '.')
    const value = parseFloat(numStr)
    
    if (!isNaN(value) && value > 0) {
      // Check for additional notes like "até dez"
      const noteMatch = raw.match(/\d+[,.\d]*\s+(.+)/)
      const observacao = noteMatch ? noteMatch[1].trim() : ''
      return { value, observacao }
    }
  }
  
  return { value: null, observacao: raw.trim() }
}

// ==================== PARSING FUNCTIONS ====================

function parseListaMd(content: string): PaymentEntry[] {
  const entries: PaymentEntry[] = []
  const lines = content.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1
    
    // Skip header rows and separator rows
    if (line.startsWith('+') || line.includes('ALUNOS STUDIO') || line.includes('MÊS:')) {
      continue
    }
    
    // Match table row format: | content | content | ... |
    if (!line.startsWith('|') || !line.includes('|')) {
      continue
    }
    
    // Split by | and get columns
    const cols = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
    
    // We need at least 5 columns: NAME, HR, DIAS, CADST, PAGO
    if (cols.length < 5) {
      continue
    }
    
    const rawName = cols[0]
    const rawPago = cols[4] // PAGO column is the 5th (index 4)
    
    // Skip if name looks like a header or is empty
    if (!rawName || rawName.includes('ALUNOS') || rawName.includes('MÊS')) {
      continue
    }
    
    // Skip rows that are just line continuation (no name, just CASAL etc)
    if (!rawName.match(/\d+\.\s*\S/)) {
      // This might be a continuation row - check if it has meaningful content
      // Skip for now as we're looking for primary entries
      continue
    }
    
    const cleanName = cleanMemberName(rawName)
    if (!cleanName || cleanName.length < 2) {
      continue
    }
    
    const { value, observacao } = parsePaymentValue(rawPago)
    const dueDay = extractDueDay(rawName)
    
    entries.push({
      lineNumber,
      rawName,
      cleanName,
      rawValue: rawPago,
      value,
      observacao,
      dueDay,
    })
  }
  
  return entries
}

// ==================== DATABASE FUNCTIONS ====================

async function findMemberByName(name: string): Promise<{ id: string; usuarioNome: string; planoId: string | null } | null> {
  const searchName = name.toLowerCase().trim()
  
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
    return { id: exactMatch.id, usuarioNome: exactMatch.usuario.nome, planoId: exactMatch.planoId }
  }
  
  // Try fuzzy match on first name and last name
  const nameParts = name.split(' ').filter(p => p.length > 1)
  if (nameParts.length >= 1) {
    const firstName = nameParts[0]
    
    const fuzzyMatches = await prisma.membro.findMany({
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
    
    // Try to find best match
    for (const match of fuzzyMatches) {
      const matchName = match.usuario.nome.toLowerCase()
      
      // If names have multiple parts, check if last name also matches
      if (nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1].toLowerCase()
        if (matchName.includes(lastName)) {
          return { id: match.id, usuarioNome: match.usuario.nome, planoId: match.planoId }
        }
      } else {
        // Single name - check for close match
        if (matchName.startsWith(searchName) || searchName.startsWith(matchName.split(' ')[0])) {
          return { id: match.id, usuarioNome: match.usuario.nome, planoId: match.planoId }
        }
      }
    }
    
    // Return first fuzzy match if only one result
    if (fuzzyMatches.length === 1) {
      const match = fuzzyMatches[0]
      return { id: match.id, usuarioNome: match.usuario.nome, planoId: match.planoId }
    }
  }
  
  return null
}

async function getDefaultPlano(): Promise<{ id: string; nome: string } | null> {
  // Get a default plan (preferably an active monthly plan with Gabi)
  const plano = await prisma.plano.findFirst({
    where: { ativo: true },
    orderBy: { valor: 'desc' },
  })
  
  return plano ? { id: plano.id, nome: plano.nome } : null
}

async function createPaymentForMember(
  membroId: string,
  planoId: string,
  valor: number,
  observacao: string,
  report: ImportReport,
  planoNome: string,
  memberName: string,
  dueDay: number
): Promise<boolean> {
  // Due date: NEXT month (February if payment is for January)
  // Use the extracted day from the name, or default to 10
  const dueMonth = TARGET_MONTH // Next month (February = 2, but JS months are 0-indexed, so TARGET_MONTH=1 means Feb)
  const dataVencimento = new Date(TARGET_YEAR, dueMonth, dueDay)
  
  // Check if payment already exists for this member in NEXT month (February 2026)
  const existingPayment = await prisma.pagamento.findFirst({
    where: {
      membroId,
      dataVencimento: {
        gte: new Date(TARGET_YEAR, dueMonth, 1),
        lte: new Date(TARGET_YEAR, dueMonth + 1, 0),
      },
    },
  })
  
  if (existingPayment) {
    report.paymentsSkipped++
    return false
  }
  
  if (DRY_RUN) {
    const dueDateStr = `${dueDay.toString().padStart(2, '0')}/${(dueMonth + 1).toString().padStart(2, '0')}/${TARGET_YEAR}`
    console.log(`  [DRY RUN] Would create payment: ${memberName} - R$ ${valor.toFixed(2)} (venc: ${dueDateStr})`)
    report.paymentsCreated++
    report.totalAmount += valor
    report.successfulPayments.push({ name: memberName, value: valor, plano: planoNome })
    return true
  }
  
  try {
    await prisma.pagamento.create({
      data: {
        membroId,
        planoId,
        valor,
        dataVencimento,
        status: 'PAGO', // Mark as PAGO since lista shows payments received
        dataPagamento: new Date(), // Payment date = today
        formaPagamento: null,
        observacao: observacao || 'Importado de lista.md - Janeiro 2026',
      },
    })
    
    report.paymentsCreated++
    report.totalAmount += valor
    report.successfulPayments.push({ name: memberName, value: valor, plano: planoNome })
    return true
  } catch (error) {
    report.paymentsFailed++
    report.errors.push({
      memberName,
      type: 'payment_creation',
      message: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

// ==================== MAIN EXECUTION ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║           Lista.md Payments Import Script                      ║')
  console.log('╠════════════════════════════════════════════════════════════════╣')
  console.log(`║ Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`.padEnd(67) + '║')
  console.log(`║ Target: January ${TARGET_YEAR}`.padEnd(67) + '║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log()
  
  // Read lista.md file
  const filePath = join(process.cwd(), 'lista.md')
  console.log(`📄 Reading file: ${filePath}`)
  const fileContent = readFileSync(filePath, 'utf-8')
  
  // Parse the markdown table
  console.log('🔍 Parsing payment entries...')
  const entries = parseListaMd(fileContent)
  
  // Filter to only entries with valid payment values
  const paymentEntries = entries.filter(e => e.value !== null && e.value > 0)
  
  console.log(`   Found ${entries.length} total entries`)
  console.log(`   Found ${paymentEntries.length} entries with payment values\n`)
  
  if (paymentEntries.length > 0) {
    console.log('📋 Sample payment entries (first 10):')
    paymentEntries.slice(0, 10).forEach(e => {
      const dueDateStr = `${e.dueDay.toString().padStart(2, '0')}/02/${TARGET_YEAR}`
      console.log(`   ${e.cleanName} - R$ ${e.value?.toFixed(2)} (venc: ${dueDateStr}) ${e.observacao ? `[${e.observacao}]` : ''}`)
    })
    console.log()
  }
  
  // Initialize report
  const report: ImportReport = {
    totalEntries: entries.length,
    processedEntries: 0,
    skippedEntries: 0,
    membersFound: 0,
    membersNotFound: [],
    paymentsCreated: 0,
    paymentsSkipped: 0,
    paymentsFailed: 0,
    totalAmount: 0,
    errors: [],
    successfulPayments: [],
  }
  
  // Get default plan
  const defaultPlano = await getDefaultPlano()
  if (!defaultPlano) {
    console.error('❌ No active plan found in database. Please create at least one plan first.')
    process.exit(1)
  }
  console.log(`📦 Using default plan: ${defaultPlano.nome}\n`)
  
  console.log('💰 Processing payments...\n')
  
  for (const entry of paymentEntries) {
    report.processedEntries++
    
    // Find member
    const member = await findMemberByName(entry.cleanName)
    
    if (!member) {
      report.membersNotFound.push(entry.cleanName)
      report.skippedEntries++
      console.log(`   ⚠️  Member not found: ${entry.cleanName}`)
      continue
    }
    
    report.membersFound++
    
    // Use member's assigned plan or default
    const planoId = member.planoId || defaultPlano.id
    const planoNome = member.planoId ? '(assigned plan)' : defaultPlano.nome
    
    // Create payment
    await createPaymentForMember(
      member.id,
      planoId,
      entry.value!,
      entry.observacao,
      report,
      planoNome,
      member.usuarioNome,
      entry.dueDay
    )
  }
  
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                     Import Complete!                           ║')
  console.log('╠════════════════════════════════════════════════════════════════╣')
  console.log(`║ Total entries in file: ${report.totalEntries}`.padEnd(67) + '║')
  console.log(`║ Entries with payment values: ${paymentEntries.length}`.padEnd(67) + '║')
  console.log(`║ Entries processed: ${report.processedEntries}`.padEnd(67) + '║')
  console.log(`║ Entries skipped: ${report.skippedEntries}`.padEnd(67) + '║')
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log(`║ Members found: ${report.membersFound}`.padEnd(67) + '║')
  console.log(`║ Members not found: ${report.membersNotFound.length}`.padEnd(67) + '║')
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log(`║ Payments created: ${report.paymentsCreated}`.padEnd(67) + '║')
  console.log(`║ Payments skipped (existing): ${report.paymentsSkipped}`.padEnd(67) + '║')
  console.log(`║ Payments failed: ${report.paymentsFailed}`.padEnd(67) + '║')
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log(`║ Total Amount: R$ ${report.totalAmount.toFixed(2)}`.padEnd(67) + '║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  
  // Save report
  const logsDir = join(process.cwd(), 'utility', 'logs')
  mkdirSync(logsDir, { recursive: true })
  
  const timestamp = Date.now()
  const reportPath = join(logsDir, `payments-import-report-${timestamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📝 Report saved to: ${reportPath}`)
  
  // Show successful payments
  if (report.successfulPayments.length > 0) {
    console.log('\n✅ Successful Payments:')
    report.successfulPayments.forEach(p => {
      console.log(`   • ${p.name}: R$ ${p.value.toFixed(2)}`)
    })
  }
  
  // Show members not found
  if (report.membersNotFound.length > 0) {
    console.log('\n⚠️  Members Not Found (need to be added to system):')
    report.membersNotFound.forEach(name => {
      console.log(`   • ${name}`)
    })
  }
  
  // Show errors
  if (report.errors.length > 0) {
    console.log('\n❌ Errors:')
    report.errors.forEach(e => {
      console.log(`   ${e.memberName} [${e.type}]: ${e.message}`)
    })
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
