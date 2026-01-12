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
import { enviarMensagemWhatsApp, templates, isEvolutionConfigured } from '@/lib/evolution'
import { enviarEmail, emailTemplates, isResendConfigured } from '@/lib/resend'
import { formatarData, formatarMoeda } from '@/lib/validators'
import { TipoNotificacao } from '@prisma/client'

/**
 * Processa lembretes de aula para as próximas horas
 */
export async function processarLembretesAula() {
  const horasAntecedencia = 2 // Configurável

  const agora = new Date()
  const limite = new Date(agora.getTime() + horasAntecedencia * 60 * 60 * 1000)

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
        include: {
          usuario: true,
        },
      },
      horario: true,
    },
  })

  for (const agendamento of agendamentos) {
    const { membro, horario } = agendamento
    const nome = membro.usuario.nome
    const dataFormatada = formatarData(agendamento.data)

    // Verificar se já enviou notificação
    const jaEnviou = await prisma.notificacao.findFirst({
      where: {
        membroId: membro.id,
        tipo: TipoNotificacao.LEMBRETE_AULA,
        criadoEm: {
          gte: new Date(agora.getTime() - 24 * 60 * 60 * 1000), // Últimas 24h
        },
      },
    })

    if (jaEnviou) continue

    // Criar notificação
    const notificacao = await prisma.notificacao.create({
      data: {
        membroId: membro.id,
        tipo: TipoNotificacao.LEMBRETE_AULA,
        titulo: 'Lembrete de Aula',
        mensagem: `Sua aula está agendada para ${horario.horaInicio} em ${dataFormatada}`,
        canalWhatsapp: isEvolutionConfigured(),
        canalEmail: isResendConfigured(),
      },
    })

    // Enviar WhatsApp
    if (isEvolutionConfigured() && membro.telefone) {
      const mensagem = templates.lembreteAula(nome, horario.horaInicio, dataFormatada)
      await enviarMensagemWhatsApp({ telefone: membro.telefone, mensagem })
    }

    // Enviar Email
    if (isResendConfigured()) {
      const html = emailTemplates.lembreteAula(nome, horario.horaInicio, dataFormatada)
      await enviarEmail({
        para: membro.usuario.email,
        assunto: '📅 Lembrete: Sua aula está chegando!',
        html,
      })
    }

    // Marcar como enviada
    await prisma.notificacao.update({
      where: { id: notificacao.id },
      data: {
        enviada: true,
        enviadaEm: new Date(),
      },
    })
  }

  return agendamentos.length
}

/**
 * Processa cobranças próximas do vencimento
 */
export async function processarCobrancas() {
  const diasAntecedencia = 3 // Configurável

  const agora = new Date()
  const limite = new Date(agora.getTime() + diasAntecedencia * 24 * 60 * 60 * 1000)

  // Buscar pagamentos pendentes próximos do vencimento
  const pagamentos = await prisma.pagamento.findMany({
    where: {
      status: 'PENDENTE',
      dataVencimento: {
        gte: agora,
        lte: limite,
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

  for (const pagamento of pagamentos) {
    const { membro } = pagamento
    const nome = membro.usuario.nome
    const valor = formatarMoeda(Number(pagamento.valor))
    const vencimento = formatarData(pagamento.dataVencimento)

    // Verificar se já enviou notificação
    const jaEnviou = await prisma.notificacao.findFirst({
      where: {
        membroId: membro.id,
        tipo: TipoNotificacao.COBRANCA,
        criadoEm: {
          gte: new Date(agora.getTime() - 24 * 60 * 60 * 1000), // Últimas 24h
        },
      },
    })

    if (jaEnviou) continue

    // Criar notificação
    const notificacao = await prisma.notificacao.create({
      data: {
        membroId: membro.id,
        tipo: TipoNotificacao.COBRANCA,
        titulo: 'Lembrete de Pagamento',
        mensagem: `Seu pagamento de ${valor} vence em ${vencimento}`,
        canalWhatsapp: isEvolutionConfigured(),
        canalEmail: isResendConfigured(),
      },
    })

    // Enviar WhatsApp
    if (isEvolutionConfigured() && membro.telefone) {
      const mensagem = templates.cobranca(nome, valor, vencimento)
      await enviarMensagemWhatsApp({ telefone: membro.telefone, mensagem })
    }

    // Enviar Email
    if (isResendConfigured()) {
      const html = emailTemplates.cobranca(nome, valor, vencimento)
      await enviarEmail({
        para: membro.usuario.email,
        assunto: '💰 Lembrete: Pagamento próximo do vencimento',
        html,
      })
    }

    // Marcar como enviada
    await prisma.notificacao.update({
      where: { id: notificacao.id },
      data: {
        enviada: true,
        enviadaEm: new Date(),
      },
    })
  }

  return pagamentos.length
}

/**
 * Processa aniversariantes do dia
 */
export async function processarAniversarios() {
  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const dia = hoje.getDate()

  // Buscar membros que fazem aniversário hoje
  const membros = await prisma.membro.findMany({
    where: {
      status: 'ATIVO',
    },
    include: {
      usuario: true,
    },
  })

  const aniversariantes = membros.filter((membro) => {
    const dataNasc = new Date(membro.dataNascimento)
    return dataNasc.getMonth() + 1 === mes && dataNasc.getDate() === dia
  })

  for (const membro of aniversariantes) {
    const nome = membro.usuario.nome

    // Verificar se já enviou notificação
    const jaEnviou = await prisma.notificacao.findFirst({
      where: {
        membroId: membro.id,
        tipo: TipoNotificacao.ANIVERSARIO,
        criadoEm: {
          gte: new Date(hoje.setHours(0, 0, 0, 0)),
        },
      },
    })

    if (jaEnviou) continue

    // Criar notificação
    const notificacao = await prisma.notificacao.create({
      data: {
        membroId: membro.id,
        tipo: TipoNotificacao.ANIVERSARIO,
        titulo: 'Feliz Aniversário!',
        mensagem: `Parabéns pelo seu aniversário, ${nome}!`,
        canalWhatsapp: isEvolutionConfigured(),
        canalEmail: false, // Só WhatsApp para aniversário
      },
    })

    // Enviar WhatsApp
    if (isEvolutionConfigured() && membro.telefone) {
      const mensagem = templates.aniversario(nome)
      await enviarMensagemWhatsApp({ telefone: membro.telefone, mensagem })
    }

    // Marcar como enviada
    await prisma.notificacao.update({
      where: { id: notificacao.id },
      data: {
        enviada: true,
        enviadaEm: new Date(),
      },
    })
  }

  return aniversariantes.length
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
  const resultados = {
    pagamentosAtualizados: await atualizarPagamentosAtrasados(),
    lembretesAula: await processarLembretesAula(),
    cobrancas: await processarCobrancas(),
    aniversarios: await processarAniversarios(),
  }

  return resultados
}

