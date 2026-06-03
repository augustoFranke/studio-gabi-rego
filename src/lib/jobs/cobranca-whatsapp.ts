import { prisma } from '@/lib/prisma'
import { addDaysYmd, formatBrFromYmd, getAppTimezone, getYmdInTimeZone } from '@/lib/dates'
import {
  createOrRefreshNotification,
  findExistingNotification,
  isNotificationDelivered,
  markNotificationDelivered,
  markNotificationFailed,
} from '@/lib/notification-delivery'
import { formatarMoeda } from '@/lib/validators'
import {
  formatWhatsappNumber,
  isEvolutionConfigured,
  sendWhatsappText,
} from '@/lib/whatsapp/evolution'
import { getWhatsappCountryCodeConfig } from '@/lib/runtime-config'
import { Prisma, TipoNotificacao } from '@prisma/client'

function getCountryCode() {
  return getWhatsappCountryCodeConfig()
}

export type NotificationJobSummary = {
  targetDate: string
  candidates: number
  sent: number
  skipped: number
  failed: number
}

type PagamentoWithMembro = Prisma.PagamentoGetPayload<{
  include: {
    membro: {
      select: {
        id: true
        status: true
        telefone: true
        usuario: {
          select: {
            nome: true
          }
        }
      }
    }
  }
}>

function buildMensagem(
  nome: string,
  pagamentos: PagamentoWithMembro[],
  vencimento: string
) {
  if (pagamentos.length === 1) {
    const valor = formatarMoeda(Number(pagamentos[0].valor))
    return `Olá, ${nome}! Lembrete: seu pagamento de ${valor} vence amanhã (${vencimento}). Se já realizou o pagamento, desconsidere.`
  }

  const total = pagamentos.reduce((sum, pagamento) => sum + Number(pagamento.valor), 0)
  const valorTotal = formatarMoeda(total)
  return `Olá, ${nome}! Você tem ${pagamentos.length} pagamentos com vencimento amanhã (${vencimento}). Total: ${valorTotal}. Se já realizou o pagamento, desconsidere.`
}

export async function runCobrancaWhatsappT1(): Promise<NotificationJobSummary> {
  const todayYmd = getYmdInTimeZone(new Date(), getAppTimezone())
  const targetYmd = addDaysYmd(todayYmd, 1)
  const targetDate = new Date(`${targetYmd}T12:00:00.000Z`)
  const legacyCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const whatsappEnabled = isEvolutionConfigured()

  const pagamentos = await prisma.pagamento.findMany({
    where: {
      status: 'PENDENTE',
      dataVencimento: targetDate,
      membro: {
        is: {
          status: 'ATIVO',
          telefone: { not: null },
        },
      },
    },
    include: {
      membro: {
        select: {
          id: true,
          status: true,
          telefone: true,
          usuario: {
            select: { nome: true },
          },
        },
      },
    },
  })

  const grouped = new Map<string, PagamentoWithMembro[]>()
  for (const pagamento of pagamentos) {
    if (!pagamento.membro) {
      continue
    }
    const key = pagamento.membro.id
    const current = grouped.get(key) ?? []
    current.push(pagamento)
    grouped.set(key, current)
  }

  const summary: NotificationJobSummary = {
    targetDate: targetYmd,
    candidates: grouped.size,
    sent: 0,
    skipped: 0,
    failed: 0,
  }

  if (!whatsappEnabled) {
    summary.skipped = grouped.size
    return summary
  }

  const vencimento = formatBrFromYmd(targetYmd)

  const results = await Promise.all(Array.from(grouped.entries()).map(async ([membroId, items]) => {
    const membro = items[0]?.membro
    if (!membro) {
      return { sent: 0, skipped: 1, failed: 0 }
    }
    const nome = membro.usuario?.nome || 'Aluno(a)'
    const telefone = membro.telefone || ''
    const numero = formatWhatsappNumber(telefone, getCountryCode())

    if (!numero) {
      return { sent: 0, skipped: 1, failed: 0 }
    }

    const mensagem = buildMensagem(nome, items, vencimento)
    const titulo = 'Lembrete de Pagamento'
    const dedupeKey = `cobranca:${membroId}:${targetYmd}:whatsapp`
    const existingNotificacao = await findExistingNotification({
      dedupeKey,
      legacyWhere: {
        membroId,
        tipo: TipoNotificacao.COBRANCA,
        canalEmail: false,
        OR: [
          { agendadaPara: targetDate },
          {
            criadoEm: {
              gte: legacyCutoff,
            },
          },
        ],
      },
    })

    if (isNotificationDelivered(existingNotificacao)) {
      return { sent: 0, skipped: 1, failed: 0 }
    }

    const notificacao = await createOrRefreshNotification({
      existing: existingNotificacao,
      dedupeKey,
      data: {
        membroId,
        tipo: TipoNotificacao.COBRANCA,
        titulo,
        mensagem,
        canalEmail: false,
        agendadaPara: targetDate,
      },
    })

    try {
      await sendWhatsappText({ to: numero, text: mensagem })
      await markNotificationDelivered(notificacao)
      return { sent: 1, skipped: 0, failed: 0 }
    } catch (error) {
      await markNotificationFailed(notificacao, error)
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
