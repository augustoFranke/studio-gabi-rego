/**
 * Agendador de tarefas
 * Responsável por agendar e executar tarefas automáticas como:
 * - Lembretes de aula
 * - Cobranças
 * - Aniversários
 * - Atualização de status de pagamentos atrasados
 * 
 * Em produção, considerar usar:
 * - Vercel Cron Jobs
 * - Upstash QStash
 * - node-cron (se self-hosted)
 */

import { prisma } from '@/lib/prisma'
import { formatarData, formatarMoeda } from '@/lib/validators'
import { Prisma, TipoNotificacao } from '@prisma/client'
import {
  formatWhatsappNumber,
  isEvolutionConfigured,
  sendWhatsappText,
} from '@/lib/whatsapp/evolution'

type NotificationSkipWhere = Prisma.NotificacaoWhereInput & {
  membroId: string
  tipo: TipoNotificacao
}

type NotificationProcessOptions<T> = {
  items: T[]
  shouldSkipWhere: (item: T) => NotificationSkipWhere
  buildNotification: (item: T) => Prisma.NotificacaoCreateInput
  sendEmail?: (item: T) => Promise<void>
  sendWhatsapp?: (item: T) => Promise<void>
}

async function processNotifications<T>({
  items,
  shouldSkipWhere,
  buildNotification,
  sendEmail,
  sendWhatsapp,
}: NotificationProcessOptions<T>) {
  if (!items.length) return 0

  let processed = 0

  for (const item of items) {
    const existingNotificacao = await prisma.notificacao.findFirst({
      where: shouldSkipWhere(item),
    })

    if (existingNotificacao) {
      processed++
      continue
    }

    const notificacao = await prisma.notificacao.create({
      data: buildNotification(item),
    })

    if (sendEmail) await sendEmail(item)
    if (sendWhatsapp) await sendWhatsapp(item)

    await prisma.notificacao.update({
      where: { id: notificacao.id },
      data: { enviada: true, enviadaEm: new Date() },
    })

    processed++
  }

  return processed
}

/**
 * Processa cobranças próximas do vencimento
 */
export async function processarCobrancas() {
  const diasAntecedencia = 1

  const agora = new Date()
  const limite = new Date(agora.getTime() + diasAntecedencia * 24 * 60 * 60 * 1000)
  const whatsappEnabled = isEvolutionConfigured()
  const since = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

  const pagamentos = await prisma.pagamento.findMany({
    where: {
      status: 'PENDENTE',
      dataVencimento: {
        gte: agora,
        lte: limite,
      },
      membro: {
        isNot: null,
      },
    },
    include: {
      membro: {
        include: {
          usuario: true,
        },
      },
    },
  })

  const pagamentosComMembro = pagamentos.filter(
    (
      pagamento
    ): pagamento is typeof pagamentos[number] & { membro: NonNullable<typeof pagamento.membro> } =>
      pagamento.membro !== null
  )

  const getContext = (pagamento: typeof pagamentosComMembro[number]) => {
    const { membro } = pagamento
    return {
      membro,
      nome: membro.usuario.nome || 'Aluno(a)',
      valor: formatarMoeda(Number(pagamento.valor)),
      vencimento: formatarData(pagamento.dataVencimento),
    }
  }

  return processNotifications({
    items: pagamentosComMembro,
    shouldSkipWhere: (pagamento) => ({
      membroId: pagamento.membro.id,
      tipo: TipoNotificacao.COBRANCA,
      criadoEm: {
        gte: since,
      },
    }),
    buildNotification: (pagamento) => {
      const { membro, valor, vencimento } = getContext(pagamento)
      return {
        membroId: membro.id,
        tipo: TipoNotificacao.COBRANCA,
        titulo: 'Lembrete de Pagamento',
        mensagem: `Seu pagamento de ${valor} vence em ${vencimento}`,
        canalWhatsapp: whatsappEnabled,
        canalEmail: false,
      }
    },
    sendWhatsapp: whatsappEnabled
      ? async (pagamento) => {
          const { membro, nome, valor, vencimento } = getContext(pagamento)
          const to = formatWhatsappNumber(membro.telefone || '')
          if (!to) {
            return
          }
          await sendWhatsappText({
            to,
            text: `Oi ${nome}! Lembrete: seu pagamento de ${valor} vence em ${vencimento}. Qualquer dúvida, fale com a gente!`,
          })
        }
      : undefined,
  })
}

/**
 * Processa aniversariantes do dia
 */
export async function processarAniversarios() {
  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const dia = hoje.getDate()
  const whatsappEnabled = isEvolutionConfigured()
  const startOfToday = new Date(hoje)
  startOfToday.setHours(0, 0, 0, 0)

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
    items: aniversariantesRows,
    shouldSkipWhere: (membro) => ({
      membroId: membro.id,
      tipo: TipoNotificacao.ANIVERSARIO,
      criadoEm: {
        gte: startOfToday,
      },
    }),
    buildNotification: (membro) => {
      const { nome } = getContext(membro)
      return {
        membroId: membro.id,
        tipo: TipoNotificacao.ANIVERSARIO,
        titulo: 'Feliz Aniversário!',
        mensagem: `Parabéns pelo seu aniversário, ${nome}!`,
        canalWhatsapp: whatsappEnabled,
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

/**
 * Atualiza pagamentos pendentes que passaram da data de vencimento para ATRASADO
 * Deve ser executado diariamente (ex: via cron job)
 */
export async function atualizarPagamentosAtrasados() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Buscar pagamentos pendentes com data de vencimento anterior a hoje
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

/**
 * Executa todas as tarefas agendadas
 * Útil para ser chamado por um cron job ou endpoint de API
 */
export async function executarTodasTarefas() {
  // Run atualizarPagamentosAtrasados first (changes PENDENTE -> ATRASADO),
  // then run the rest in parallel (they query non-overlapping date windows)
  const pagamentosAtualizados = await atualizarPagamentosAtrasados()

  const [cobrancas, aniversarios] = await Promise.all([
    processarCobrancas(),
    processarAniversarios(),
  ])

  return { pagamentosAtualizados, cobrancas, aniversarios }
}
