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
import { enviarEmail, emailTemplates, isResendConfigured } from '@/lib/resend'
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

  // Batch skip-check: single query instead of N findFirst calls
  const skipFilters = items.map(shouldSkipWhere)
  const existing = await prisma.notificacao.findMany({
    where: { OR: skipFilters },
    select: { membroId: true, tipo: true },
  })
  const alreadySent = new Set(
    existing.map((n) => `${n.membroId}-${n.tipo}`)
  )

  const toProcess = items.filter((item) => {
    const { membroId, tipo } = shouldSkipWhere(item)
    return !alreadySent.has(`${membroId}-${tipo}`)
  })

  // Process in parallel batches of 5 to avoid overwhelming external APIs
  const BATCH_SIZE = 5
  let processed = 0
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const notificacao = await prisma.notificacao.create({
          data: buildNotification(item),
        })

        if (sendEmail) await sendEmail(item)
        if (sendWhatsapp) await sendWhatsapp(item)

        await prisma.notificacao.update({
          where: { id: notificacao.id },
          data: { enviada: true, enviadaEm: new Date() },
        })
      })
    )
    processed += results.filter((r) => r.status === 'fulfilled').length
  }

  return processed
}

/**
 * Processa lembretes de aula para as próximas horas
 */
export async function processarLembretesAula() {
  const horasAntecedencia = 2 // Configurável

  const agora = new Date()
  const limite = new Date(agora.getTime() + horasAntecedencia * 60 * 60 * 1000)
  const resendEnabled = isResendConfigured()
  const whatsappEnabled = isEvolutionConfigured()
  const since = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

  // Buscar agendamentos das próximas horas que ainda não receberam lembrete
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      data: {
        gte: agora,
        lte: limite,
      },
    },
    include: {
      membro: {
        select: {
          id: true,
          telefone: true,
          usuario: { select: { nome: true, email: true } },
        },
      },
      horario: { select: { horaInicio: true, horaFim: true } },
    },
  })

  const getContext = (agendamento: typeof agendamentos[number]) => {
    const { membro, horario } = agendamento
    return {
      membro,
      horario,
      nome: membro.usuario.nome || 'Aluno(a)',
      dataFormatada: formatarData(agendamento.data),
    }
  }

  return processNotifications({
    items: agendamentos,
    shouldSkipWhere: (agendamento) => ({
      membroId: agendamento.membro.id,
      tipo: TipoNotificacao.LEMBRETE_AULA,
      criadoEm: {
        gte: since, // Últimas 24h
      },
    }),
    buildNotification: (agendamento) => {
      const { membro, horario, dataFormatada } = getContext(agendamento)
      return {
        membroId: membro.id,
        tipo: TipoNotificacao.LEMBRETE_AULA,
        titulo: 'Lembrete de Aula',
        mensagem: `Sua aula está agendada para ${horario.horaInicio} em ${dataFormatada}`,
        canalWhatsapp: whatsappEnabled,
        canalEmail: resendEnabled,
      }
    },
    sendEmail: resendEnabled
      ? async (agendamento) => {
          const { membro, horario, nome, dataFormatada } = getContext(agendamento)
          const html = emailTemplates.lembreteAula(nome, horario.horaInicio, dataFormatada)
          await enviarEmail({
            para: membro.usuario.email,
            assunto: '📅 Lembrete: Sua aula está chegando!',
            html,
          })
        }
      : undefined,
    sendWhatsapp: whatsappEnabled
      ? async (agendamento) => {
          const { membro, horario, nome, dataFormatada } = getContext(agendamento)
          const to = formatWhatsappNumber(membro.telefone || '')
          if (!to) {
            return
          }

          await sendWhatsappText({
            to,
            text: `Oi ${nome}! Lembrete: sua aula esta agendada para ${horario.horaInicio} em ${dataFormatada}.`,
          })
        }
      : undefined,
  })
}

/**
 * Processa cobranças próximas do vencimento
 */
export async function processarCobrancas() {
  const diasAntecedencia = 3 // Configurável

  const agora = new Date()
  const limite = new Date(agora.getTime() + diasAntecedencia * 24 * 60 * 60 * 1000)
  const resendEnabled = isResendConfigured()
  const since = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

  // Buscar pagamentos pendentes próximos do vencimento
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
        gte: since, // Últimas 24h
      },
    }),
    buildNotification: (pagamento) => {
      const { membro, valor, vencimento } = getContext(pagamento)
      return {
        membroId: membro.id,
        tipo: TipoNotificacao.COBRANCA,
        titulo: 'Lembrete de Pagamento',
        mensagem: `Seu pagamento de ${valor} vence em ${vencimento}`,
        canalWhatsapp: false,
        canalEmail: resendEnabled,
      }
    },
    sendEmail: resendEnabled
      ? async (pagamento) => {
          const { membro, nome, valor, vencimento } = getContext(pagamento)
          const html = emailTemplates.cobranca(nome, valor, vencimento)
          await enviarEmail({
            para: membro.usuario.email,
            assunto: '💰 Lembrete: Pagamento próximo do vencimento',
            html,
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
  const resendEnabled = isResendConfigured()
  const whatsappEnabled = isEvolutionConfigured()
  const startOfToday = new Date(hoje)
  startOfToday.setHours(0, 0, 0, 0)

  // Filter birthdays at the database level instead of loading all members
  const birthdayIds = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT m.id FROM "Membro" m
    WHERE m.status = 'ATIVO'
      AND m."dataNascimento" IS NOT NULL
      AND EXTRACT(MONTH FROM m."dataNascimento") = ${mes}
      AND EXTRACT(DAY FROM m."dataNascimento") = ${dia}
  `

  const aniversariantes = birthdayIds.length
    ? await prisma.membro.findMany({
        where: { id: { in: birthdayIds.map((b) => b.id) } },
        include: { usuario: true },
      })
    : []

  const getContext = (membro: typeof aniversariantes[number]) => ({
    membro,
    nome: membro.usuario.nome || 'Aluno(a)',
  })

  return processNotifications({
    items: aniversariantes,
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
        canalEmail: resendEnabled,
      }
    },
    sendEmail: resendEnabled
      ? async (membro) => {
          const { nome } = getContext(membro)
          const html = emailTemplates.aniversario(nome)
          await enviarEmail({
            para: membro.usuario.email,
            assunto: '🎂 Feliz Aniversário!',
            html,
          })
        }
      : undefined,
    sendWhatsapp: whatsappEnabled
      ? async (membro) => {
          const { nome } = getContext(membro)
          const to = formatWhatsappNumber(membro.telefone || '')
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

  const [lembretesAula, cobrancas, aniversarios] = await Promise.all([
    processarLembretesAula(),
    processarCobrancas(),
    processarAniversarios(),
  ])

  return { pagamentosAtualizados, lembretesAula, cobrancas, aniversarios }
}
