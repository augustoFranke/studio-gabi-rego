import { prisma } from '@/lib/prisma'
import type { PaymentArchiveSummary } from '@/lib/payment-export'

export type CleanupSummary = {
  notificacoesDeleted: number
  importLogsDeleted: number
  importDryRunsDeleted: number
  agendamentosDeleted: number
  tokensCleared: number
  pagamentosArchived: PaymentArchiveSummary
}

export async function runCleanup(): Promise<CleanupSummary> {
  const now = new Date()

  const notificacoesCutoff = new Date(now)
  notificacoesCutoff.setDate(notificacoesCutoff.getDate() - 90)

  const importLogsCutoff = new Date(now)
  importLogsCutoff.setDate(importLogsCutoff.getDate() - 180)

  const dryRunCutoff = new Date(now)
  dryRunCutoff.setDate(dryRunCutoff.getDate() - 30)

  const agendamentoCutoff = new Date(now)
  agendamentoCutoff.setFullYear(agendamentoCutoff.getFullYear() - 1)

  const [
    { count: notificacoesDeleted },
    { count: importDryRunsDeleted },
    { count: importLogsDeleted },
    { count: agendamentosDeleted },
    tokensCleared,
  ] = await Promise.all([
    prisma.notificacao.deleteMany({
      where: { enviada: true, criadoEm: { lt: notificacoesCutoff } },
    }),
    prisma.pagamentoImportRun.deleteMany({
      where: { dryRun: true, criadoEm: { lt: dryRunCutoff } },
    }),
    prisma.pagamentoImportLog.deleteMany({
      where: { criadoEm: { lt: importLogsCutoff } },
    }),
    prisma.agendamento.deleteMany({
      where: { data: { lt: agendamentoCutoff } },
    }),
    clearExpiredTokens(),
  ])

  return {
    notificacoesDeleted,
    importLogsDeleted,
    importDryRunsDeleted,
    agendamentosDeleted,
    tokensCleared,
    pagamentosArchived: { count: 0, csvPath: null },
  }
}

async function clearExpiredTokens(): Promise<number> {
  const now = new Date()

  const [v, r, a] = await Promise.all([
    prisma.usuario.updateMany({
      where: { tokenVerificacao: { not: null }, tokenVerificacaoExpira: { lt: now } },
      data: { tokenVerificacao: null, tokenVerificacaoExpira: null },
    }),
    prisma.usuario.updateMany({
      where: { tokenReset: { not: null }, tokenResetExpira: { lt: now } },
      data: { tokenReset: null, tokenResetExpira: null },
    }),
    prisma.usuario.updateMany({
      where: { tokenPerfil: { not: null }, tokenPerfilExpira: { lt: now } },
      data: { tokenPerfil: null, tokenPerfilExpira: null },
    }),
    prisma.membro.updateMany({
      where: { anamneseToken: { not: null }, anamneseTokenExpira: { lt: now } },
      data: { anamneseToken: null, anamneseTokenExpira: null },
    }),
  ])

  return v.count + r.count + a.count
}
