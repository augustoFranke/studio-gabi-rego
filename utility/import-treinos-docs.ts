#!/usr/bin/env tsx
/**
 * Training Plans Import Script (from .doc files)
 *
 * Reads Word .doc files from a directory, parses training plans,
 * matches members by name, creates FichaTreino records in the DB,
 * and generates PDFs using the existing PDF pipeline.
 *
 * Usage:
 *   npx tsx utility/import-treinos-docs.ts <directory> [options]
 *
 * Options:
 *   --dry-run       Parse and report without writing to DB
 *   --pdf-only      Generate PDFs without saving to DB (output to ./utility/pdf-output/)
 *   --skip-existing Skip members that already have an active training plan
 *   --force         Overwrite (deactivate) existing active plans
 *
 * Examples:
 *   npx tsx utility/import-treinos-docs.ts ~/Downloads/TREINOS\ FEVEREIRO\ 26 --dry-run
 *   npx tsx utility/import-treinos-docs.ts ~/Downloads/TREINOS\ FEVEREIRO\ 26 --pdf-only
 *   npx tsx utility/import-treinos-docs.ts ~/Downloads/TREINOS\ FEVEREIRO\ 26 --force
 */

import { execSync } from 'child_process'
import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { prisma } from '../src/lib/prisma'
import { generateTrainingPDF } from '../src/lib/pdf'
import type { TrainingPDFData, TrainingPDFSession } from '../src/domain/treino'

// ==================== CLI FLAGS ====================

const args = process.argv.slice(2)
const inputDir = args.find((a) => !a.startsWith('--'))

const DRY_RUN = args.includes('--dry-run')
const PDF_ONLY = args.includes('--pdf-only')
const SKIP_EXISTING = args.includes('--skip-existing')
const FORCE = args.includes('--force')

if (!inputDir) {
  console.error('Usage: npx tsx utility/import-treinos-docs.ts <directory> [--dry-run] [--pdf-only] [--skip-existing] [--force]')
  process.exit(1)
}

if (!existsSync(inputDir)) {
  console.error(`Directory not found: ${inputDir}`)
  process.exit(1)
}

// ==================== TYPES ====================

interface ParsedExercise {
  nome: string
  series: string
  repeticoes: string
  observacoes?: string
}

interface ParsedSession {
  name: string        // "A", "B", "C", etc.
  description: string // Full session title, e.g. "A C/B INFERIORES"
  exercises: ParsedExercise[]
}

interface ParsedTrainingPlan {
  fileName: string
  aluno: string
  data: string         // "MM/YYYY" format for DB, raw for PDF
  dataRaw: string      // Original date string, e.g. "FEVEREIRO/26"
  sessions: ParsedSession[]
  observacoes?: string
}

interface ImportReport {
  totalFiles: number
  parsedFiles: number
  skippedFiles: number
  membersMatched: number
  membersNotFound: string[]
  plansCreated: number
  plansSkipped: number
  pdfsGenerated: number
  errors: Array<{ file: string; error: string }>
  warnings: Array<{ file: string; message: string }>
}

// ==================== MONTH MAPPING ====================

const MONTH_MAP: Record<string, string> = {
  'JANEIRO': '01',
  'FEVEREIRO': '02',
  'FAVEREIRO': '02', // Typo found in docs
  'MARÇO': '03',
  'MARCO': '03',
  'ABRIL': '04',
  'MAIO': '05',
  'JUNHO': '06',
  'JULHO': '07',
  'AGOSTO': '08',
  'SETEMBRO': '09',
  'OUTUBRO': '10',
  'NOVEMBRO': '11',
  'DEZEMBRO': '12',
}

// ==================== PARSING ====================

function readDocFile(filePath: string): string {
  try {
    return execSync(`textutil -convert txt -stdout "${filePath}"`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch {
    throw new Error(`Failed to read .doc file: ${filePath}`)
  }
}

function parseDate(raw: string): { formatted: string; raw: string } {
  // Input: "FEVEREIRO/26" or "FEVEREIRO/2026"
  const trimmed = raw.trim()
  const parts = trimmed.split('/')
  if (parts.length !== 2) {
    return { formatted: '', raw: trimmed }
  }

  const monthStr = parts[0].trim().toUpperCase()
  let yearStr = parts[1].trim()

  const month = MONTH_MAP[monthStr]
  if (!month) {
    return { formatted: '', raw: trimmed }
  }

  // Handle 2-digit year
  if (yearStr.length === 2) {
    yearStr = '20' + yearStr
  }

  return { formatted: `${month}/${yearStr}`, raw: trimmed }
}

function parseTrainingDoc(content: string, fileName: string): ParsedTrainingPlan | null {
  // Use ALL lines (including empty ones) so we can detect empty observation cells
  const rawLines = content.split('\n')
  // Non-empty lines for header/metadata extraction
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0)

  // 1. Extract ALUNO/ALUNA and DATA
  let aluno = ''
  let dataRaw = ''
  let dataFormatted = ''

  for (const line of lines) {
    // Match "ALUNO: NAME    DATA: DATE" or "ALUNA: NAME    DATA: DATE"
    const alunoDataMatch = line.match(/^ALUN[OA]:\s*(.+?)\s{2,}DATA:\s*(.+)$/i)
    if (alunoDataMatch) {
      aluno = alunoDataMatch[1].trim()
      const parsed = parseDate(alunoDataMatch[2])
      dataRaw = parsed.raw
      dataFormatted = parsed.formatted
      break
    }

    // Some docs have ALUNO on the same line but format varies
    const alunoOnlyMatch = line.match(/^ALUN[OA]:\s*(.+?)(?:\s{2,}|\s*$)/i)
    if (alunoOnlyMatch && !aluno) {
      aluno = alunoOnlyMatch[1].trim()
      const dataInLine = line.match(/DATA:\s*(.+)/i)
      if (dataInLine) {
        const parsed = parseDate(dataInLine[1])
        dataRaw = parsed.raw
        dataFormatted = parsed.formatted
      }
    }

    // DATA might be at the end of the doc (e.g., DRA ADRIANA)
    if (!dataRaw) {
      const dataMatch = line.match(/DATA:\s*(.+)/i)
      if (dataMatch) {
        const parsed = parseDate(dataMatch[1])
        dataRaw = parsed.raw
        dataFormatted = parsed.formatted
      }
    }

    if (!aluno) {
      const lateAlunoMatch = line.match(/^ALUN[OA]:\s*(.+?)(?:\s{2,}DATA|\s*$)/i)
      if (lateAlunoMatch) {
        aluno = lateAlunoMatch[1].trim()
      }
    }
  }

  if (!aluno) {
    return null
  }

  aluno = aluno.replace(/\s+/g, ' ').trim()

  // 2. Parse sessions and exercises
  const sessions: ParsedSession[] = []
  let currentSession: ParsedSession | null = null
  let collectingExercises = false
  let hasObsColumn = false // Track if current session table has OBSERVAÇÕES column
  let globalObs = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upper = line.toUpperCase()

    // Check for TREINO session header
    const treinoMatch = line.match(/^TREINO\s+(.+)/i)
    if (treinoMatch) {
      if (currentSession && currentSession.exercises.length > 0) {
        sessions.push(currentSession)
      }

      const fullTitle = treinoMatch[1].trim()
      const sessionLetter = fullTitle.match(/^([A-Z])\b/i)?.[1]?.toUpperCase() || fullTitle.charAt(0).toUpperCase()

      // Skip HIIT sessions
      if (upper.includes('HIIT')) {
        currentSession = null
        collectingExercises = false
        continue
      }

      currentSession = {
        name: sessionLetter,
        description: fullTitle,
        exercises: [],
      }
      collectingExercises = false
      hasObsColumn = false
      continue
    }

    // Detect OBSERVAÇÕES in the header area (before exercises start collecting)
    if (currentSession && !collectingExercises) {
      if (upper.startsWith('OBSERVA') || upper === 'OBSERVAÇÕES:' || upper === 'OBSERVACOES:') {
        hasObsColumn = true
        continue
      }
    }

    // Check for table header row (EXERCICIOS / SERIES / REPETICOES)
    if (currentSession && !collectingExercises) {
      if (upper.startsWith('EXERC')) {
        collectingExercises = true
        continue
      }
      if (upper === 'SÉRIES' || upper === 'REPETIÇÕES' || upper === 'REPETICOES') {
        continue
      }
    }

    // Check for OBS at the end of the document
    const obsMatch = line.match(/^OBS:\s*(.+)/i)
    if (obsMatch) {
      globalObs = obsMatch[1].trim()
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j]
        if (nextLine.match(/^(TREINO|ALUN[OA]:|DATA:)/i) || nextLine.trim() === '') {
          break
        }
        globalObs += ' ' + nextLine.trim()
      }
      continue
    }

    // Collect exercise data when in a session
    if (currentSession && collectingExercises) {
      // Skip header sub-lines
      if (upper === 'SÉRIES' || upper === 'REPETIÇÕES' || upper === 'REPETICOES') {
        continue
      }
      if (upper === 'OBSERVAÇÕES:' || upper === 'OBSERVACOES:' ||
          upper === 'OBSERVAÇÕES' || upper === 'OBSERVACOES') {
        hasObsColumn = true
        continue
      }

      // Skip ALUNO/DATA lines that appear mid-document
      if (upper.match(/^ALUN[OA]:/)) continue

      // Look ahead: exercise name followed by series number then reps
      const nextLines = lines.slice(i + 1)
      const isExerciseName = !line.match(/^\d+$/) &&
                             line.length > 1 &&
                             !line.match(/^(TREINO|EXERC|S[EÉ]RIES|REPET|OBSERV|OBS:|ALUN|DATA:)/i) &&
                             nextLines.length >= 2

      if (isExerciseName) {
        const potentialSeries = nextLines[0]?.trim()
        const potentialReps = nextLines[1]?.trim()
        const isSeries = potentialSeries && /^\d{1,2}$/.test(potentialSeries)

        if (isSeries && potentialReps) {
          let exerciseObs: string | undefined
          let skip = 2 // series + reps

          if (hasObsColumn) {
            // When OBSERVAÇÕES column exists, textutil outputs 4 values per exercise:
            // name, series, reps, obs. Empty obs cells become empty lines (filtered out).
            //
            // After consuming name/series/reps, the next non-empty line (potentialObs)
            // could be:
            //   a) A real observation (e.g. "2020") — followed by the next exercise NAME
            //   b) The next exercise name — followed by its SERIES number
            //
            // Key distinction: if lineAfterObs is a series number (1-2 digits), then
            // potentialObs is actually the next exercise name, NOT an observation.
            // If lineAfterObs is NOT a series number, potentialObs is a real observation.
            const potentialObs = nextLines[2]?.trim()
            const lineAfterObs = nextLines[3]?.trim()

            if (potentialObs &&
                !potentialObs.match(/^\d{1,2}$/) &&
                potentialObs.length > 0 &&
                !potentialObs.match(/^(TREINO|EXERC|ALUN|DATA:|OBS:)/i)) {
              if (lineAfterObs && /^\d{1,2}$/.test(lineAfterObs)) {
                // lineAfterObs is a series number → potentialObs is the NEXT exercise
                // name, not an observation. The real obs was an empty cell (filtered out).
                // Don't consume it; leave skip = 2.
              } else {
                // lineAfterObs is NOT a series number. This could be:
                //   a) A real observation (e.g. "2020") followed by a multi-word exercise name
                //   b) A multi-line exercise name where potentialObs is the first line and
                //      lineAfterObs is the description continuation (e.g. "CADEIRA FLEXORA"
                //      followed by "8 LENTAS + AUMENTA..."), with the series number 2 lines away.
                //
                // Heuristic: short numeric-like values (e.g. "2020", "3010", "12") are almost
                // certainly real observations. Only longer text values could be exercise name
                // fragments in a multi-line wrap.
                const looksLikeObs = /^\d+$/.test(potentialObs) || potentialObs.length <= 10

                if (looksLikeObs) {
                  // Short/numeric value → real observation.
                  exerciseObs = potentialObs
                  skip = 3
                } else {
                  // Longer text → check if it's a multi-line exercise name.
                  // If nextLines[4] is a series number, it's a 2-line exercise; don't consume.
                  const twoAfterObs = nextLines[4]?.trim()
                  if (twoAfterObs && /^\d{1,2}$/.test(twoAfterObs)) {
                    // Multi-line exercise name detected. Don't consume as obs.
                  } else {
                    // Real observation value.
                    exerciseObs = potentialObs
                    skip = 3
                  }
                }
              }
            }
          }

          currentSession.exercises.push({
            nome: line.trim(),
            series: potentialSeries,
            repeticoes: potentialReps,
            observacoes: exerciseObs,
          })

          i += skip
          continue
        }
      }
    }
  }

  // Push last session
  if (currentSession && currentSession.exercises.length > 0) {
    sessions.push(currentSession)
  }

  if (sessions.length === 0) {
    return null
  }

  return {
    fileName,
    aluno,
    data: dataFormatted,
    dataRaw,
    sessions,
    observacoes: globalObs || undefined,
  }
}

// ==================== MEMBER MATCHING ====================

function normalizeForSearch(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function findMemberByName(
  name: string,
  allMembers: Array<{ id: string; usuario: { nome: string | null } }>
): Promise<{ id: string; nome: string } | null> {
  const searchNorm = normalizeForSearch(name)
  const searchParts = searchNorm.split(' ')

  // 1. Exact match (case-insensitive, accent-insensitive)
  for (const m of allMembers) {
    const memberNorm = normalizeForSearch(m.usuario.nome || '')
    if (memberNorm === searchNorm) {
      return { id: m.id, nome: m.usuario.nome || '' }
    }
  }

  // 2. Check if doc name is contained in DB name or vice versa
  for (const m of allMembers) {
    const memberNorm = normalizeForSearch(m.usuario.nome || '')
    if (memberNorm.includes(searchNorm) || searchNorm.includes(memberNorm)) {
      return { id: m.id, nome: m.usuario.nome || '' }
    }
  }

  // 3. Match on first name + any other part
  if (searchParts.length >= 1) {
    const firstName = searchParts[0]
    const candidates = allMembers.filter((m) => {
      const memberNorm = normalizeForSearch(m.usuario.nome || '')
      return memberNorm.startsWith(firstName + ' ') || memberNorm === firstName
    })

    if (candidates.length === 1) {
      return { id: candidates[0].id, nome: candidates[0].usuario.nome || '' }
    }

    // If multiple candidates with same first name, try matching more parts
    if (candidates.length > 1 && searchParts.length >= 2) {
      for (const c of candidates) {
        const memberNorm = normalizeForSearch(c.usuario.nome || '')
        const memberParts = memberNorm.split(' ')
        // Check if last name part matches
        const lastSearch = searchParts[searchParts.length - 1]
        if (memberParts.some((p) => p === lastSearch || p.startsWith(lastSearch))) {
          return { id: c.id, nome: c.usuario.nome || '' }
        }
      }
    }
  }

  // 4. Try matching with parenthetical nickname removed
  // e.g., "ALEXANDRE  (XANDY)" -> try both "ALEXANDRE" and "XANDY"
  const nicknameMatch = name.match(/^(.+?)\s*\((.+?)\)\s*$/)
  if (nicknameMatch) {
    const mainName = nicknameMatch[1].trim()
    const nickname = nicknameMatch[2].trim()

    const mainResult = await findMemberByName(mainName, allMembers)
    if (mainResult) return mainResult

    const nickResult = await findMemberByName(nickname, allMembers)
    if (nickResult) return nickResult
  }

  return null
}

// ==================== PDF GENERATION ====================

function buildPDFData(plan: ParsedTrainingPlan): TrainingPDFData {
  const sessions: TrainingPDFSession[] = plan.sessions.map((s) => ({
    name: s.name,
    exercises: s.exercises.map((ex) => ({
      name: ex.nome,
      sets: ex.series,
      reps: ex.repeticoes,
      observacoes: ex.observacoes,
    })),
  }))

  return {
    aluno: plan.aluno,
    date: plan.dataRaw || plan.data,
    observacoes: plan.observacoes,
    sessions,
  }
}

// ==================== MAIN ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║           Training Plans Import (.doc files)                  ║')
  console.log('╠════════════════════════════════════════════════════════════════╣')
  console.log(`║ Source: ${basename(inputDir!)}`.padEnd(65) + '║')
  console.log(`║ Mode: ${DRY_RUN ? 'DRY RUN' : PDF_ONLY ? 'PDF ONLY' : 'LIVE IMPORT'}`.padEnd(65) + '║')
  console.log(`║ Skip existing: ${SKIP_EXISTING ? 'YES' : 'NO'}`.padEnd(65) + '║')
  console.log(`║ Force overwrite: ${FORCE ? 'YES' : 'NO'}`.padEnd(65) + '║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log()

  const report: ImportReport = {
    totalFiles: 0,
    parsedFiles: 0,
    skippedFiles: 0,
    membersMatched: 0,
    membersNotFound: [],
    plansCreated: 0,
    plansSkipped: 0,
    pdfsGenerated: 0,
    errors: [],
    warnings: [],
  }

  // 1. List .doc files (skip temp files starting with ~$)
  const docFiles = readdirSync(inputDir!)
    .filter((f) => f.endsWith('.doc') && !f.startsWith('~$') && !f.startsWith('~W'))
    .sort()

  report.totalFiles = docFiles.length
  console.log(`Found ${docFiles.length} .doc files\n`)

  // 2. Parse all files
  console.log('--- Parsing documents ---\n')
  const plans: ParsedTrainingPlan[] = []

  for (const file of docFiles) {
    const filePath = join(inputDir!, file)
    try {
      const content = readDocFile(filePath)
      const plan = parseTrainingDoc(content, file)

      if (!plan) {
        report.skippedFiles++
        report.warnings.push({ file, message: 'Could not parse training plan (no sessions or no student name found)' })
        console.log(`  [SKIP] ${file} - could not parse`)
        continue
      }

      const sessionSummary = plan.sessions.map((s) => `${s.name}(${s.exercises.length})`).join(', ')
      console.log(`  [OK]   ${file}`)
      console.log(`         -> ${plan.aluno} | ${plan.dataRaw} | Sessions: ${sessionSummary}`)
      if (plan.observacoes) {
        console.log(`         -> OBS: ${plan.observacoes.substring(0, 80)}${plan.observacoes.length > 80 ? '...' : ''}`)
      }

      plans.push(plan)
      report.parsedFiles++
    } catch (err) {
      report.errors.push({ file, error: err instanceof Error ? err.message : String(err) })
      console.log(`  [ERR]  ${file} - ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nParsed ${plans.length}/${docFiles.length} files successfully\n`)

  // 3. If --dry-run, just show the parsed data and exit
  if (DRY_RUN) {
    console.log('--- DRY RUN: Parsed Plans Summary ---\n')
    for (const plan of plans) {
      console.log(`  ${plan.aluno} (${plan.dataRaw})`)
      for (const session of plan.sessions) {
        console.log(`    TREINO ${session.name} - ${session.exercises.length} exercises`)
        for (const ex of session.exercises) {
          const obsStr = ex.observacoes ? ` [${ex.observacoes}]` : ''
          console.log(`      ${ex.nome} | ${ex.series}x${ex.repeticoes}${obsStr}`)
        }
      }
      if (plan.observacoes) {
        console.log(`    OBS: ${plan.observacoes}`)
      }
      console.log()
    }
    printReport(report)
    return
  }

  // 4. PDF-only mode: generate PDFs without DB access and exit
  if (PDF_ONLY) {
    const pdfOutputDir = join(process.cwd(), 'utility', 'pdf-output')
    mkdirSync(pdfOutputDir, { recursive: true })

    console.log('--- Generating PDFs (no DB) ---\n')

    for (const plan of plans) {
      const label = `${plan.aluno} (${plan.dataRaw})`
      process.stdout.write(`  Generating: ${label}...`)

      try {
        const pdfData = buildPDFData(plan)
        const pdfBuffer = await generateTrainingPDF(pdfData)
        const safeName = plan.aluno.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')
        const pdfPath = join(pdfOutputDir, `Treino-${safeName}-${plan.data.replace('/', '-')}.pdf`)
        writeFileSync(pdfPath, pdfBuffer)
        report.pdfsGenerated++
        console.log(` [PDF saved: ${basename(pdfPath)}]`)
      } catch (err) {
        report.errors.push({ file: plan.fileName, error: `PDF generation failed: ${err instanceof Error ? err.message : err}` })
        console.log(` [PDF ERROR: ${err instanceof Error ? err.message : err}]`)
      }
    }

    console.log()
    printReport(report)
    return
  }

  // 5. Load all members from DB for matching
  const allMembers = await prisma.membro.findMany({
    select: {
      id: true,
      usuario: { select: { nome: true } },
    },
  })
  console.log(`Loaded ${allMembers.length} members from database\n`)

  // 6. Process each plan
  console.log('--- Processing plans ---\n')

  for (const plan of plans) {
    const label = `${plan.aluno} (${plan.dataRaw})`
    process.stdout.write(`  Processing: ${label}...`)

    // Match member
    const member = await findMemberByName(plan.aluno, allMembers)

    if (!member) {
      report.membersNotFound.push(plan.aluno)
      console.log(' [NOT FOUND - skipped]')
      report.warnings.push({ file: plan.fileName, message: `Member not found: "${plan.aluno}"` })
      continue
    }

    report.membersMatched++
    if (member.nome !== plan.aluno) {
      console.log(` [matched: ${member.nome}]`)
    }

    // Generate PDF
    try {
      const pdfData = buildPDFData(plan)
      const pdfBuffer = await generateTrainingPDF(pdfData)
      report.pdfsGenerated++
    } catch (err) {
      report.errors.push({ file: plan.fileName, error: `PDF generation failed: ${err instanceof Error ? err.message : err}` })
      console.log(` [PDF ERROR]`)
      // Continue to DB import even if PDF fails
    }

    // Save to DB
    if (!PDF_ONLY && member) {
      try {
        // Check for existing active plans
        const existing = await prisma.fichaTreino.findFirst({
          where: { membroId: member.id, ativo: true },
        })

        if (existing && SKIP_EXISTING) {
          report.plansSkipped++
          console.log(' [SKIPPED - has active plan]')
          continue
        }

        if (existing && FORCE) {
          await prisma.fichaTreino.updateMany({
            where: { membroId: member.id, ativo: true },
            data: { ativo: false },
          })
        }

        // Build exercise data
        const exercicios = plan.sessions.flatMap((session, _si) =>
          session.exercises.map((ex, ei) => ({
            sessao: session.name,
            nome: ex.nome,
            series: ex.series,
            repeticoes: ex.repeticoes,
            observacoes: ex.observacoes,
            ordem: ei,
          }))
        )

        const monthNames: Record<string, string> = {
          '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março',
          '04': 'Abril', '05': 'Maio', '06': 'Junho',
          '07': 'Julho', '08': 'Agosto', '09': 'Setembro',
          '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
        }
        const [month, year] = plan.data.split('/')
        const nomeFicha = `Treino ${monthNames[month] || month} ${year}`

        await prisma.fichaTreino.create({
          data: {
            membroId: member.id,
            nome: nomeFicha,
            data: plan.data,
            observacoes: plan.observacoes,
            ativo: true,
            exercicios: {
              create: exercicios,
            },
          },
        })

        report.plansCreated++
        console.log(' [CREATED]')
      } catch (err) {
        report.errors.push({
          file: plan.fileName,
          error: `DB save failed: ${err instanceof Error ? err.message : err}`,
        })
        console.log(` [DB ERROR: ${err instanceof Error ? err.message : err}]`)
      }
    }
  }

  console.log()
  printReport(report)

  // Save report
  const logsDir = join(process.cwd(), 'utility', 'logs')
  mkdirSync(logsDir, { recursive: true })
  const reportPath = join(logsDir, `import-treinos-report-${Date.now()}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nReport saved to: ${reportPath}`)
}

function printReport(report: ImportReport) {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                     Import Report                             ║')
  console.log('╠════════════════════════════════════════════════════════════════╣')
  console.log(`║ Files found: ${report.totalFiles}`.padEnd(65) + '║')
  console.log(`║ Files parsed: ${report.parsedFiles}`.padEnd(65) + '║')
  console.log(`║ Files skipped: ${report.skippedFiles}`.padEnd(65) + '║')
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log(`║ Members matched: ${report.membersMatched}`.padEnd(65) + '║')
  console.log(`║ Members not found: ${report.membersNotFound.length}`.padEnd(65) + '║')
  if (report.membersNotFound.length > 0) {
    for (const name of report.membersNotFound) {
      console.log(`║   - ${name}`.padEnd(65) + '║')
    }
  }
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log(`║ Plans created: ${report.plansCreated}`.padEnd(65) + '║')
  console.log(`║ Plans skipped: ${report.plansSkipped}`.padEnd(65) + '║')
  console.log(`║ PDFs generated: ${report.pdfsGenerated}`.padEnd(65) + '║')
  console.log('╠────────────────────────────────────────────────────────────────╣')
  console.log(`║ Errors: ${report.errors.length}`.padEnd(65) + '║')
  if (report.errors.length > 0) {
    for (const e of report.errors.slice(0, 10)) {
      console.log(`║   ${e.file}: ${e.error.substring(0, 50)}`.padEnd(65) + '║')
    }
    if (report.errors.length > 10) {
      console.log(`║   ... and ${report.errors.length - 10} more`.padEnd(65) + '║')
    }
  }
  if (report.warnings.length > 0) {
    console.log('╠────────────────────────────────────────────────────────────────╣')
    console.log(`║ Warnings: ${report.warnings.length}`.padEnd(65) + '║')
    for (const w of report.warnings.slice(0, 10)) {
      console.log(`║   ${w.file}: ${w.message.substring(0, 45)}`.padEnd(65) + '║')
    }
    if (report.warnings.length > 10) {
      console.log(`║   ... and ${report.warnings.length - 10} more`.padEnd(65) + '║')
    }
  }
  console.log('╚════════════════════════════════════════════════════════════════╝')
}

// ==================== RUN ====================

main()
  .catch((error) => {
    console.error('\nFatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    if (!DRY_RUN && !PDF_ONLY) {
      await prisma.$disconnect()
    }
  })
