import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export type PaymentArchiveSummary = {
  count: number
  csvPath: string | null
}

const archivedPaymentInclude = {
  membro: { include: { usuario: { select: { nome: true } } } },
  plano: { select: { nome: true } },
} satisfies Prisma.PagamentoInclude

type ArchivedPayment = Prisma.PagamentoGetPayload<{
  include: typeof archivedPaymentInclude
}>

type CsvValue = string | number | boolean | Date | Prisma.Decimal | null | undefined

function formatCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const str = value instanceof Date ? value.toISOString() : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function paymentsToCsv(payments: ArchivedPayment[]): string {
  const headers = ['id', 'membro_nome', 'payer_nome', 'plano', 'valor', 'data_vencimento', 'data_pagamento', 'status', 'forma_pagamento', 'observacao', 'criado_em']
  const rows = payments.map(p => [
    formatCsvValue(p.id),
    formatCsvValue(p.membro?.usuario?.nome),
    formatCsvValue(p.payerNome),
    formatCsvValue(p.plano?.nome),
    formatCsvValue(p.valor),
    formatCsvValue(p.dataVencimento.toISOString().split('T')[0]),
    formatCsvValue(p.dataPagamento?.toISOString().split('T')[0]),
    formatCsvValue(p.status),
    formatCsvValue(p.formaPagamento),
    formatCsvValue(p.observacao),
    formatCsvValue(p.criadoEm.toISOString()),
  ].join(','))

  return [headers.join(','), ...rows].join('\n')
}

/**
 * Archives old payments (PAGO or CANCELADO, older than cutoffDays)
 * to a CSV file, then deletes them from the database.
 */
export async function archiveOldPayments(cutoffDays = 30): Promise<PaymentArchiveSummary> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - cutoffDays)

  const payments = await prisma.pagamento.findMany({
    where: {
      status: { in: ['PAGO', 'CANCELADO'] },
      dataVencimento: { lt: cutoff },
    },
    include: archivedPaymentInclude,
    orderBy: { dataVencimento: 'asc' },
  })

  if (payments.length === 0) {
    return { count: 0, csvPath: null }
  }

  const csv = paymentsToCsv(payments)
  const dateStr = new Date().toISOString().split('T')[0]

  // Write to /tmp for Vercel compatibility, or backups/ for local
  const isVercel = process.env.VERCEL === '1'
  const baseDir = isVercel ? '/tmp' : join(process.cwd(), 'backups')

  if (!isVercel) {
    await mkdir(baseDir, { recursive: true })
  }

  const csvPath = join(baseDir, `pagamentos-archive-${dateStr}.csv`)
  await writeFile(csvPath, csv, 'utf-8')

  // Delete archived payments
  await prisma.pagamento.deleteMany({
    where: {
      id: { in: payments.map(p => p.id) },
    },
  })

  console.log(`Archived ${payments.length} payments to ${csvPath}`)

  return { count: payments.length, csvPath }
}
