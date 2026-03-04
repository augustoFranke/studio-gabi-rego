import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'

const CLEAR_MATCH_THRESHOLD = 0.78
const AMBIGUOUS_THRESHOLD = 0.68
const SCORE_GAP_THRESHOLD = 0.08

const DECISION = {
  MATCHED: 'MATCHED',
  AMBIGUOUS: 'AMBIGUOUS',
  UNMATCHED: 'UNMATCHED',
  SKIPPED_NON_NUMERIC: 'SKIPPED_NON_NUMERIC',
  SKIPPED_IDEMPOTENT: 'SKIPPED_IDEMPOTENT',
  ERROR: 'ERROR',
} as const

const RUN_STATUS = {
  DRY_RUN: 'DRY_RUN',
  APPLIED: 'APPLIED',
  ROLLED_BACK: 'ROLLED_BACK',
  FAILED: 'FAILED',
} as const

type ImportDecision = (typeof DECISION)[keyof typeof DECISION]

export type ParsedDocxRow = {
  rowIndex: number
  rawName: string
  rawPago: string
}

export type MatchCandidate = {
  membroId: string
  nome: string
  normalizedNome: string
  planoId: string | null
}

export type MatchResult = {
  decision: 'matched' | 'ambiguous' | 'unmatched'
  best?: MatchCandidate
  score?: number
  alternatives: Array<{ nome: string; score: number }>
}

export type RowDecision = {
  rowIndex: number
  rawName: string
  rawPago: string
  parsedAmount: number | null
  decision: ImportDecision
  matchScore: number | null
  matchedMembroId: string | null
  importKey: string | null
  detalhe: string | null
}

export type ImportSummary = {
  batchId: string
  source: string
  sourceBasename: string
  month: string
  totalRowsSeen: number
  rowsWithNumericPago: number
  inserted: number
  skipped: number
  matched: number
  ambiguous: number
  unmatched: number
  decisions: RowDecision[]
  topAmbiguousOrUnmatched: Array<{
    rawName: string
    decision: ImportDecision
    score: number | null
    detail: string | null
  }>
}

export type ExecuteImportOptions = {
  prisma: PrismaClient
  sourcePath: string
  month: string
  apply: boolean
  batchId: string
  topN?: number
}

export type ExecuteImportFromRowsOptions = ExecuteImportOptions & {
  parsedRows: ParsedDocxRow[]
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function extractCellText(cellXml: string): string {
  const chunks = [...cellXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
  const text = chunks.map((m) => decodeXmlEntities(m[1])).join('')
  return text.replace(/\s+/g, ' ').trim()
}

function extractRowsFromDocumentXml(xml: string): string[][] {
  const rows = [...xml.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)]
  return rows.map((rowMatch) => {
    const rowXml = rowMatch[0]
    const cells = [...rowXml.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)]
    return cells.map((cellMatch) => extractCellText(cellMatch[0]))
  })
}

export function normalizeForMatching(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function tokenize(value: string): string[] {
  return normalizeForMatching(value)
    .split(' ')
    .filter((token) => token.length > 1)
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0

  const toBigrams = (input: string) => {
    const bigrams: string[] = []
    for (let i = 0; i < input.length - 1; i += 1) {
      bigrams.push(input.slice(i, i + 2))
    }
    return bigrams
  }

  const aBigrams = toBigrams(a)
  const bBigrams = toBigrams(b)
  const bCounts = new Map<string, number>()

  for (const bg of bBigrams) {
    bCounts.set(bg, (bCounts.get(bg) ?? 0) + 1)
  }

  let overlap = 0
  for (const bg of aBigrams) {
    const count = bCounts.get(bg) ?? 0
    if (count > 0) {
      overlap += 1
      bCounts.set(bg, count - 1)
    }
  }

  return (2 * overlap) / (aBigrams.length + bBigrams.length)
}

function computeScore(inputName: string, candidateName: string): number {
  const inputTokens = tokenize(inputName)
  const candidateTokens = tokenize(candidateName)

  if (inputTokens.length === 0 || candidateTokens.length === 0) {
    return 0
  }

  const inputSet = new Set(inputTokens)
  const candidateSet = new Set(candidateTokens)

  let overlap = 0
  for (const token of inputSet) {
    if (candidateSet.has(token)) overlap += 1
  }

  const union = new Set([...inputSet, ...candidateSet]).size || 1
  const jaccard = overlap / union
  const coverage = overlap / inputSet.size

  const normalizedInput = normalizeForMatching(inputName)
  const normalizedCandidate = normalizeForMatching(candidateName)
  const dice = diceCoefficient(normalizedInput, normalizedCandidate)

  const prefixBonus =
    normalizedCandidate.startsWith(normalizedInput) || normalizedInput.startsWith(normalizedCandidate)
      ? 0.08
      : 0

  const score = 0.55 * coverage + 0.25 * jaccard + 0.2 * dice + prefixBonus
  return Math.min(1, score)
}

export function parseBrazilianAmount(raw: string): number | null {
  const value = raw.trim()
  if (!value) return null

  const match = value.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?/)
  if (!match) return null

  const normalized = match[0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Number(parsed.toFixed(2))
}

export function isNumericPago(raw: string): boolean {
  return parseBrazilianAmount(raw) !== null
}

export function buildImportKey(month: string, normalizedName: string, amount: number, sourceBasename: string): string {
  const amountCents = Math.round(amount * 100)
  const payload = `${month}|${normalizedName}|${amountCents}|${sourceBasename}`
  return createHash('sha256').update(payload).digest('hex')
}

export function findBestMatch(rawName: string, candidates: MatchCandidate[]): MatchResult {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: computeScore(rawName, candidate.nome),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  const second = scored[1]

  if (!best) {
    return { decision: 'unmatched', alternatives: [] }
  }

  const alternatives = scored.slice(0, 3).map((entry) => ({
    nome: entry.candidate.nome,
    score: Number(entry.score.toFixed(4)),
  }))

  const bestScore = best.score
  const secondScore = second?.score ?? 0

  if (
    bestScore >= CLEAR_MATCH_THRESHOLD &&
    (bestScore - secondScore >= SCORE_GAP_THRESHOLD || secondScore < AMBIGUOUS_THRESHOLD)
  ) {
    return {
      decision: 'matched',
      best: best.candidate,
      score: Number(bestScore.toFixed(4)),
      alternatives,
    }
  }

  if (bestScore >= AMBIGUOUS_THRESHOLD) {
    return {
      decision: 'ambiguous',
      best: best.candidate,
      score: Number(bestScore.toFixed(4)),
      alternatives,
    }
  }

  return {
    decision: 'unmatched',
    best: best.candidate,
    score: Number(bestScore.toFixed(4)),
    alternatives,
  }
}

export function parseDocxPayments(sourcePath: string): ParsedDocxRow[] {
  const documentXml = execFileSync('unzip', ['-p', sourcePath, 'word/document.xml'], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  })

  const tableRows = extractRowsFromDocumentXml(documentXml)

  const headerIndex = tableRows.findIndex((cells) => {
    const joined = cells.join(' ').toUpperCase()
    return joined.includes('ALUNOS') && joined.includes('PAGO')
  })

  if (headerIndex === -1) {
    throw new Error('Nao foi possivel localizar o cabecalho esperado no DOCX')
  }

  const headerCells = tableRows[headerIndex]
  const nameIndex = headerCells.findIndex((cell) => normalizeForMatching(cell).includes('ALUNOS'))
  const pagoIndex = headerCells.findIndex((cell) => normalizeForMatching(cell) === 'PAGO')

  if (nameIndex === -1 || pagoIndex === -1) {
    throw new Error('Nao foi possivel localizar as colunas ALUNOS/PAGO no DOCX')
  }

  const rows: ParsedDocxRow[] = []
  for (let i = headerIndex + 1; i < tableRows.length; i += 1) {
    const cells = tableRows[i]
    const rawName = (cells[nameIndex] ?? '').trim()
    const rawPago = (cells[pagoIndex] ?? '').trim()

    if (!rawName) {
      continue
    }

    rows.push({
      rowIndex: i + 1,
      rawName,
      rawPago,
    })
  }

  return rows
}

function parseMonthToDate(month: string): Date {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Mes invalido. Use formato YYYY-MM.')
  }
  const [yearRaw, monthRaw] = month.split('-')
  const year = Number(yearRaw)
  const monthNumber = Number(monthRaw)
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error('Mes invalido. Use formato YYYY-MM.')
  }
  return new Date(Date.UTC(year, monthNumber - 1, 1, 12, 0, 0, 0))
}

async function loadCandidates(prisma: PrismaClient | Prisma.TransactionClient): Promise<MatchCandidate[]> {
  const membros = await prisma.membro.findMany({
    select: {
      id: true,
      planoId: true,
      usuario: {
        select: {
          nome: true,
        },
      },
    },
  })

  return membros
    .filter((membro) => (membro.usuario.nome ?? '').trim().length > 0)
    .map((membro) => ({
      membroId: membro.id,
      nome: (membro.usuario.nome ?? '').trim(),
      normalizedNome: normalizeForMatching(membro.usuario.nome ?? ''),
      planoId: membro.planoId,
    }))
}

async function findDefaultPlanId(prisma: PrismaClient | Prisma.TransactionClient): Promise<string> {
  const plano = await prisma.plano.findFirst({
    where: { ativo: true },
    orderBy: { valor: 'desc' },
    select: { id: true },
  })

  if (!plano) {
    throw new Error('Nenhum plano ativo encontrado para importacao')
  }

  return plano.id
}

function buildDetailText(match: MatchResult): string | null {
  if (match.alternatives.length === 0) return null
  return match.alternatives.map((alt) => `${alt.nome} (${alt.score.toFixed(3)})`).join(' | ')
}

function buildTopList(summary: ImportSummary, topN: number) {
  return summary.decisions
    .filter((decision) =>
      decision.decision === DECISION.AMBIGUOUS ||
      decision.decision === DECISION.UNMATCHED
    )
    .slice(0, topN)
    .map((decision) => ({
      rawName: decision.rawName,
      decision: decision.decision,
      score: decision.matchScore,
      detail: decision.detalhe,
    }))
}

async function executeDryRun(
  options: ExecuteImportOptions,
  parsedRows: ParsedDocxRow[],
  candidates: MatchCandidate[],
  defaultPlanId: string
): Promise<ImportSummary> {
  const sourceBasename = basename(options.sourcePath)
  const decisions: RowDecision[] = []

  let rowsWithNumericPago = 0
  let inserted = 0
  let skipped = 0
  let matched = 0
  let ambiguous = 0
  let unmatched = 0

  for (const row of parsedRows) {
    const normalizedName = normalizeForMatching(row.rawName)
    const parsedAmount = parseBrazilianAmount(row.rawPago)

    if (parsedAmount === null) {
      skipped += 1
      decisions.push({
        rowIndex: row.rowIndex,
        rawName: row.rawName,
        rawPago: row.rawPago,
        parsedAmount: null,
        decision: DECISION.SKIPPED_NON_NUMERIC,
        matchScore: null,
        matchedMembroId: null,
        importKey: null,
        detalhe: 'PAGO nao numerico',
      })
      continue
    }

    rowsWithNumericPago += 1
    inserted += 1

    const match = findBestMatch(row.rawName, candidates)
    const importKey = buildImportKey(options.month, normalizedName, parsedAmount, sourceBasename)

    let decision: ImportDecision = DECISION.UNMATCHED
    let matchedMembroId: string | null = null

    if (match.decision === 'matched' && match.best) {
      matched += 1
      decision = DECISION.MATCHED
      matchedMembroId = match.best.membroId
    } else if (match.decision === 'ambiguous') {
      ambiguous += 1
      decision = DECISION.AMBIGUOUS
    } else {
      unmatched += 1
      decision = DECISION.UNMATCHED
    }

    void defaultPlanId

    decisions.push({
      rowIndex: row.rowIndex,
      rawName: row.rawName,
      rawPago: row.rawPago,
      parsedAmount,
      decision,
      matchScore: match.score ?? null,
      matchedMembroId,
      importKey,
      detalhe: buildDetailText(match),
    })
  }

  const summary: ImportSummary = {
    batchId: options.batchId,
    source: options.sourcePath,
    sourceBasename,
    month: options.month,
    totalRowsSeen: parsedRows.length,
    rowsWithNumericPago,
    inserted,
    skipped,
    matched,
    ambiguous,
    unmatched,
    decisions,
    topAmbiguousOrUnmatched: [],
  }

  summary.topAmbiguousOrUnmatched = buildTopList(summary, options.topN ?? 15)
  return summary
}

async function executeApply(
  options: ExecuteImportOptions,
  parsedRows: ParsedDocxRow[],
  candidates: MatchCandidate[],
  defaultPlanId: string
): Promise<ImportSummary> {
  const sourceBasename = basename(options.sourcePath)
  const competenciaMes = parseMonthToDate(options.month)

  return options.prisma.$transaction(async (tx) => {
    const run = await tx.pagamentoImportRun.create({
      data: {
        batchId: options.batchId,
        sourceFilename: options.sourcePath,
        sourceBasename,
        competenciaMes,
        status: RUN_STATUS.APPLIED,
        dryRun: false,
      },
      select: { id: true },
    })

    const decisions: RowDecision[] = []

    let rowsWithNumericPago = 0
    let inserted = 0
    let skipped = 0
    let matched = 0
    let ambiguous = 0
    let unmatched = 0

    for (const row of parsedRows) {
      const normalizedName = normalizeForMatching(row.rawName)
      const parsedAmount = parseBrazilianAmount(row.rawPago)

      if (parsedAmount === null) {
        skipped += 1
        const decision = DECISION.SKIPPED_NON_NUMERIC
        decisions.push({
          rowIndex: row.rowIndex,
          rawName: row.rawName,
          rawPago: row.rawPago,
          parsedAmount: null,
          decision,
          matchScore: null,
          matchedMembroId: null,
          importKey: null,
          detalhe: 'PAGO nao numerico',
        })

        await tx.pagamentoImportLog.create({
          data: {
            importRunId: run.id,
            rowIndex: row.rowIndex,
            rawName: row.rawName,
            rawPago: row.rawPago,
            decision,
            detalhe: 'PAGO nao numerico',
          },
        })

        continue
      }

      rowsWithNumericPago += 1
      const match = findBestMatch(row.rawName, candidates)
      const importKey = buildImportKey(options.month, normalizedName, parsedAmount, sourceBasename)
      const existing = await tx.pagamento.findUnique({
        where: { importKey },
        select: { id: true },
      })

      if (existing) {
        skipped += 1
        const decision = DECISION.SKIPPED_IDEMPOTENT
        decisions.push({
          rowIndex: row.rowIndex,
          rawName: row.rawName,
          rawPago: row.rawPago,
          parsedAmount,
          decision,
          matchScore: match.score ?? null,
          matchedMembroId: null,
          importKey,
          detalhe: 'Pagamento ja existente para import_key',
        })

        await tx.pagamentoImportLog.create({
          data: {
            importRunId: run.id,
            rowIndex: row.rowIndex,
            rawName: row.rawName,
            rawPago: row.rawPago,
            parsedAmount: new Prisma.Decimal(parsedAmount),
            decision,
            matchScore: match.score != null ? new Prisma.Decimal(match.score) : null,
            importKey,
            detalhe: 'Pagamento ja existente para import_key',
          },
        })

        continue
      }

      let resolvedMembroId: string | null = null
      let resolvedPlanoId = defaultPlanId
      let decision: ImportDecision = DECISION.UNMATCHED

      if (match.decision === 'matched' && match.best) {
        resolvedMembroId = match.best.membroId
        if (match.best.planoId) {
          resolvedPlanoId = match.best.planoId
        }
        matched += 1
        decision = DECISION.MATCHED
      } else if (match.decision === 'ambiguous') {
        ambiguous += 1
        decision = DECISION.AMBIGUOUS
      } else {
        unmatched += 1
        decision = DECISION.UNMATCHED
      }

      const pagamento = await tx.pagamento.create({
        data: {
          membroId: resolvedMembroId,
          planoId: resolvedPlanoId,
          payerNome: row.rawName,
          valor: new Prisma.Decimal(parsedAmount),
          dataVencimento: competenciaMes,
          dataPagamento: new Date(),
          status: 'PAGO',
          formaPagamento: null,
          observacao: `Importacao DOCX ${options.month} (${options.batchId})`,
          importRunId: run.id,
          importKey,
        },
        select: { id: true },
      })

      inserted += 1

      const detail = buildDetailText(match)
      decisions.push({
        rowIndex: row.rowIndex,
        rawName: row.rawName,
        rawPago: row.rawPago,
        parsedAmount,
        decision,
        matchScore: match.score ?? null,
        matchedMembroId: resolvedMembroId,
        importKey,
        detalhe: detail,
      })

      await tx.pagamentoImportLog.create({
        data: {
          importRunId: run.id,
          rowIndex: row.rowIndex,
          rawName: row.rawName,
          rawPago: row.rawPago,
          parsedAmount: new Prisma.Decimal(parsedAmount),
          decision,
          matchScore: match.score != null ? new Prisma.Decimal(match.score) : null,
          matchedMembroId: resolvedMembroId,
          importKey,
          pagamentoId: pagamento.id,
          detalhe: detail,
        },
      })
    }

    await tx.pagamentoImportRun.update({
      where: { id: run.id },
      data: {
        totalRowsSeen: parsedRows.length,
        rowsWithNumericPago,
        inserted,
        skipped,
        matched,
        ambiguous,
        unmatched,
      },
    })

    const summary: ImportSummary = {
      batchId: options.batchId,
      source: options.sourcePath,
      sourceBasename,
      month: options.month,
      totalRowsSeen: parsedRows.length,
      rowsWithNumericPago,
      inserted,
      skipped,
      matched,
      ambiguous,
      unmatched,
      decisions,
      topAmbiguousOrUnmatched: [],
    }

    summary.topAmbiguousOrUnmatched = buildTopList(summary, options.topN ?? 15)
    return summary
  }, {
    maxWait: 30000,
    timeout: 180000,
  })
}

export async function executePaymentImport(options: ExecuteImportOptions): Promise<ImportSummary> {
  const parsedRows = parseDocxPayments(options.sourcePath)
  return executePaymentImportFromRows({ ...options, parsedRows })
}

export async function executePaymentImportFromRows(
  options: ExecuteImportFromRowsOptions
): Promise<ImportSummary> {
  const [candidates, defaultPlanId] = await Promise.all([
    loadCandidates(options.prisma),
    findDefaultPlanId(options.prisma),
  ])

  if (!options.apply) {
    return executeDryRun(options, options.parsedRows, candidates, defaultPlanId)
  }

  return executeApply(options, options.parsedRows, candidates, defaultPlanId)
}

export async function rollbackPaymentImportByBatchId(prisma: PrismaClient, batchId: string) {
  const run = await prisma.pagamentoImportRun.findUnique({
    where: { batchId },
    select: {
      id: true,
      batchId: true,
      status: true,
      totalRowsSeen: true,
      rowsWithNumericPago: true,
      inserted: true,
      skipped: true,
      matched: true,
      ambiguous: true,
      unmatched: true,
      sourceFilename: true,
      sourceBasename: true,
      competenciaMes: true,
    },
  })

  if (!run) {
    throw new Error(`Import run nao encontrado para batch_id=${batchId}`)
  }

  const rollbackBatchId = `${batchId}-rollback-${Date.now()}`

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.pagamento.deleteMany({ where: { importRunId: run.id } })

    await tx.pagamentoImportRun.update({
      where: { id: run.id },
      data: { status: RUN_STATUS.ROLLED_BACK },
    })

    await tx.pagamentoImportRun.create({
      data: {
        batchId: rollbackBatchId,
        sourceFilename: run.sourceFilename,
        sourceBasename: run.sourceBasename,
        competenciaMes: run.competenciaMes,
        status: RUN_STATUS.ROLLED_BACK,
        dryRun: false,
        rollbackOfRunId: run.id,
        totalRowsSeen: run.totalRowsSeen,
        rowsWithNumericPago: run.rowsWithNumericPago,
        inserted: 0,
        skipped: run.skipped,
        matched: run.matched,
        ambiguous: run.ambiguous,
        unmatched: run.unmatched,
      },
    })

    return {
      originalBatchId: run.batchId,
      rollbackBatchId,
      deletedPayments: deleted.count,
    }
  })
}
