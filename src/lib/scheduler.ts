import { prisma } from '@/lib/prisma'
import { getAppTimezone, getYmdInTimeZone } from '@/lib/dates'
import { syncAgendamentosRecorrentes } from '@/services/agendamento.service'
import {
  claimNotificationForDelivery,
  createOrRefreshNotification,
  findExistingNotification,
  isNotificationDelivered,
  markNotificationDelivered,
  markNotificationFailed,
} from '@/lib/notification-delivery'
import { Prisma, TipoNotificacao } from '@prisma/client'
import {
  formatWhatsappNumber,
  isEvolutionConfigured,
  sendWhatsappText,
} from '@/lib/whatsapp/evolution'
import { runCobrancaWhatsappT1, type NotificationJobSummary } from '@/lib/jobs/cobranca-whatsapp'
import { addDays, subDays } from 'date-fns'

type NotificationProcessOptions<T> = {
  targetDate: string
  items: T[]
  dedupeKey: (item: T) => string
  legacyWhere: (item: T) => Prisma.NotificacaoWhereInput
  buildNotification: (item: T) => Prisma.NotificacaoUncheckedCreateInput
  sendEmail?: (item: T) => Promise<void>
  sendWhatsapp?: (item: T) => Promise<void>
}

async function processNotifications<T>({
  targetDate,
  items,
  dedupeKey,
  legacyWhere,
  buildNotification,
  sendEmail,
  sendWhatsapp,
}: NotificationProcessOptions<T>) {
  const summary: NotificationJobSummary = {
    targetDate,
    candidates: items.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  }

  if (!items.length) {
    return summary
  }

  const results = await Promise.all(items.map(async (item) => {
    const existingNotificacao = await findExistingNotification({
      dedupeKey: dedupeKey(item),
      legacyWhere: legacyWhere(item),
    })

    if (isNotificationDelivered(existingNotificacao)) {
      return { sent: 0, skipped: 1, failed: 0 }
    }

    const notificacao = await createOrRefreshNotification({
      existing: existingNotificacao,
      dedupeKey: dedupeKey(item),
      data: buildNotification(item),
    })
    const claimedNotificacao = await claimNotificationForDelivery(notificacao)

    if (!claimedNotificacao) {
      return { sent: 0, skipped: 1, failed: 0 }
    }

    try {
      if (sendEmail) await sendEmail(item)
      if (sendWhatsapp) await sendWhatsapp(item)
      await markNotificationDelivered(claimedNotificacao)
      return { sent: 1, skipped: 0, failed: 0 }
    } catch (error) {
      await markNotificationFailed(claimedNotificacao, error)
      return { sent: 0, skipped: 0, failed: 1 }
    }
  }))

  for (const result of results) {
    summary.sent += result.sent
    summary.skipped += result.skipped
    summary.failed += result.failed
  }

  return summary
}

export async function processarAniversarios() {
  const timezone = getAppTimezone()
  const hoje = new Date()
  const hojeYmd = getYmdInTimeZone(hoje, timezone)
  const [, mes, dia] = hojeYmd.split('-').map(Number)
  const whatsappEnabled = isEvolutionConfigured()
  const legacyCutoff = new Date(hoje.getTime() - 24 * 60 * 60 * 1000)

  type AniversarianteRow = {
    id: string
    telefone: string | null
    usuarioNome: string | null
    usuarioEmail: string | null
  }

  const aniversariantesRows = await prisma.$queryRaw<AniversarianteRow[]>(
    Prisma.sql`
      SELECT
        m.id,
        m.telefone,
        u.nome AS "usuarioNome",
        u.email AS "usuarioEmail"
      FROM membros m
      INNER JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.status = CAST(${'ATIVO'} AS "StatusMembro")
        AND m.data_nascimento IS NOT NULL
        AND EXTRACT(MONTH FROM m.data_nascimento) = ${mes}
        AND EXTRACT(DAY FROM m.data_nascimento) = ${dia}
    `
  )

  const getContext = (membro: AniversarianteRow) => ({
    membro,
    nome: membro.usuarioNome || 'Aluno(a)',
    email: membro.usuarioEmail,
    telefone: membro.telefone,
  })

  return processNotifications({
    targetDate: hojeYmd,
    items: aniversariantesRows,
    dedupeKey: (membro) => `aniversario:${membro.id}:${hojeYmd}`,
    legacyWhere: (membro) => ({
      membroId: membro.id,
      tipo: TipoNotificacao.ANIVERSARIO,
      criadoEm: {
        gte: legacyCutoff,
      },
    }),
    buildNotification: (membro) => {
      const { nome } = getContext(membro)
      return {
        membroId: membro.id,
        tipo: TipoNotificacao.ANIVERSARIO,
        titulo: 'Feliz Aniversário!',
        mensagem: `Parabéns pelo seu aniversário, ${nome}!`,
        canalEmail: false,
      }
    },
    sendWhatsapp: whatsappEnabled
      ? async (membro) => {
          const { nome, telefone } = getContext(membro)
          const to = formatWhatsappNumber(telefone || '')
          if (!to) {
            return
          }

          await sendWhatsappText({
            to,
            text: `Feliz aniversario, ${nome}! Que seu dia seja incrivel. Parabens!`,
          })
        }
      : undefined,
  })
}

export async function atualizarPagamentosAtrasados() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const pagamentosAtrasados = await prisma.pagamento.updateMany({
    where: {
      status: 'PENDENTE',
      dataVencimento: {
        lt: hoje,
      },
    },
    data: {
      status: 'ATRASADO',
    },
  })

  return pagamentosAtrasados.count
}

export async function sincronizarAgendamentosRecorrentes() {
  const today = new Date()
  const startDate = subDays(today, 30)
  const endDate = addDays(today, 90)
  const { created } = await syncAgendamentosRecorrentes({
    startDate,
    endDate,
  })

  return { created, startDate, endDate }
}

export async function executarTodasTarefas() {
  const [pagamentosAtualizados, cobrancas, aniversarios, recorrencias] = await Promise.all([
    atualizarPagamentosAtrasados(),
    runCobrancaWhatsappT1(),
    processarAniversarios(),
    sincronizarAgendamentosRecorrentes(),
  ])

  return { pagamentosAtualizados, cobrancas, aniversarios, recorrencias }
}
