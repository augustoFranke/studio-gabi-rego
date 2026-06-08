import fs from 'fs'
import path from 'path'
import { hash } from 'bcryptjs'
import {
  DiaSemana,
  PagamentoImportDecision,
  PagamentoImportRunStatus,
  Prisma,
  PrismaClient,
  Role,
  Sexo,
  StatusEntregaNotificacao,
  StatusMembro,
  StatusPagamento,
  TipoNotificacao,
} from '@prisma/client'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue

    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}

loadEnvLocal()

const prisma = new PrismaClient()
const TEST_PASSWORD = 'Admin123'
const TEST_ADMIN_EMAIL = 'admin@example.com'

const date = (iso: string) => new Date(`${iso}T12:00:00.000Z`)
const money = (value: string) => new Prisma.Decimal(value)

async function upsertPlano(data: {
  nome: string
  descricao: string
  valor: string
  duracaoDias: number
  aulasSemanais: number
  ativo?: boolean
}) {
  const existing = await prisma.plano.findFirst({ where: { nome: data.nome } })
  const payload = {
    descricao: data.descricao,
    valor: money(data.valor),
    duracaoDias: data.duracaoDias,
    aulasSemanais: data.aulasSemanais,
    ativo: data.ativo ?? true,
  }

  return existing
    ? prisma.plano.update({ where: { id: existing.id }, data: payload })
    : prisma.plano.create({ data: { nome: data.nome, ...payload } })
}

async function upsertHorario(data: {
  diaSemana: DiaSemana
  horaInicio: string
  horaFim: string
  vagasTotal: number
  ativo?: boolean
}) {
  return prisma.horarioDisponivel.upsert({
    where: {
      diaSemana_horaInicio_ativo: {
        diaSemana: data.diaSemana,
        horaInicio: data.horaInicio,
        ativo: data.ativo ?? true,
      },
    },
    update: {
      horaFim: data.horaFim,
      vagasTotal: data.vagasTotal,
    },
    create: {
      diaSemana: data.diaSemana,
      horaInicio: data.horaInicio,
      horaFim: data.horaFim,
      vagasTotal: data.vagasTotal,
      ativo: data.ativo ?? true,
    },
  })
}

async function upsertMember(data: {
  email: string
  nome: string
  status: StatusMembro
  sexo: Sexo
  telefone: string
  cpf: string
  planoId: string
  precoCustomizado?: string
  observacoes?: string
}) {
  const passwordHash = await hash(TEST_PASSWORD, 10)

  const usuario = await prisma.usuario.upsert({
    where: { email: data.email },
    update: {
      nome: data.nome,
      role: Role.MEMBRO,
      senha: passwordHash,
      senhaDefinida: true,
      emailVerificado: new Date(),
      onboardingCompleto: true,
      etapaOnboarding: 3,
    },
    create: {
      email: data.email,
      nome: data.nome,
      senha: passwordHash,
      senhaDefinida: true,
      role: Role.MEMBRO,
      emailVerificado: new Date(),
      onboardingCompleto: true,
      etapaOnboarding: 3,
    },
  })

  return prisma.membro.upsert({
    where: { usuarioId: usuario.id },
    update: {
      cpf: data.cpf,
      telefone: data.telefone,
      status: data.status,
      sexo: data.sexo,
      planoId: data.planoId,
      precoCustomizado: data.precoCustomizado ? money(data.precoCustomizado) : null,
      observacoes: data.observacoes,
      dataNascimento: data.sexo === Sexo.FEMININO ? date('1992-05-18') : date('1989-11-04'),
    },
    create: {
      usuarioId: usuario.id,
      cpf: data.cpf,
      telefone: data.telefone,
      status: data.status,
      sexo: data.sexo,
      planoId: data.planoId,
      precoCustomizado: data.precoCustomizado ? money(data.precoCustomizado) : undefined,
      observacoes: data.observacoes,
      dataNascimento: data.sexo === Sexo.FEMININO ? date('1992-05-18') : date('1989-11-04'),
    },
  })
}

async function replacePayments(
  membroId: string,
  planoId: string,
  payerNome: string,
  items: Array<{
    status: StatusPagamento
    valor: string
    vencimento: string
    pagamento?: string
    forma?: string
    observacao?: string
    importKey: string
  }>
) {
  for (const item of items) {
    await prisma.pagamento.upsert({
      where: { importKey: item.importKey },
      update: {
        membroId,
        planoId,
        payerNome,
        valor: money(item.valor),
        dataVencimento: date(item.vencimento),
        dataPagamento: item.pagamento ? date(item.pagamento) : null,
        status: item.status,
        formaPagamento: item.forma,
        observacao: item.observacao,
      },
      create: {
        membroId,
        planoId,
        payerNome,
        valor: money(item.valor),
        dataVencimento: date(item.vencimento),
        dataPagamento: item.pagamento ? date(item.pagamento) : undefined,
        status: item.status,
        formaPagamento: item.forma,
        observacao: item.observacao,
        importKey: item.importKey,
      },
    })
  }
}

async function replaceTraining(membroId: string, name: string) {
  await prisma.fichaTreino.deleteMany({ where: { membroId, nome: name } })

  return prisma.fichaTreino.create({
    data: {
      membroId,
      nome: name,
      data: '06/2026',
      objetivo: 'Hipertrofia e condicionamento',
      observacoes: 'Mock dev: ajustar cargas conforme evolução semanal.',
      ativo: true,
      exercicios: {
        create: [
          {
            sessao: 'A - Superiores',
            nome: 'Supino reto',
            grupoMuscular: 'Peito',
            series: '4',
            repeticoes: '8-10',
            descanso: '90s',
            observacoes: 'Manter escápulas retraídas.',
            ordem: 0,
          },
          {
            sessao: 'A - Superiores',
            nome: 'Remada baixa',
            grupoMuscular: 'Costas',
            series: '3',
            repeticoes: '10-12',
            descanso: '75s',
            observacoes: 'Evitar balançar o tronco.',
            ordem: 1,
          },
          {
            sessao: 'B - Inferiores',
            nome: 'Agachamento livre',
            grupoMuscular: 'Pernas',
            series: '4',
            repeticoes: '8',
            descanso: '120s',
            observacoes: 'Descer apenas até amplitude confortável.',
            ordem: 0,
          },
        ],
      },
    },
  })
}

async function main() {
  const passwordHash = await hash(TEST_PASSWORD, 10)

  await prisma.usuario.upsert({
    where: { email: TEST_ADMIN_EMAIL },
    update: {
      nome: 'Admin Dev',
      senha: passwordHash,
      senhaDefinida: true,
      role: Role.ADMIN,
      emailVerificado: new Date(),
      onboardingCompleto: true,
      etapaOnboarding: 3,
    },
    create: {
      email: TEST_ADMIN_EMAIL,
      nome: 'Admin Dev',
      senha: passwordHash,
      senhaDefinida: true,
      role: Role.ADMIN,
      emailVerificado: new Date(),
      onboardingCompleto: true,
      etapaOnboarding: 3,
    },
  })

  const [mensal, trimestral, avulso] = await Promise.all([
    upsertPlano({
      nome: 'Mensal 2x semana',
      descricao: 'Plano recorrente com duas aulas semanais.',
      valor: '280.00',
      duracaoDias: 30,
      aulasSemanais: 2,
    }),
    upsertPlano({
      nome: 'Trimestral 3x semana',
      descricao: 'Plano trimestral para alunos em rotina intensa.',
      valor: '720.00',
      duracaoDias: 90,
      aulasSemanais: 3,
    }),
    upsertPlano({
      nome: 'Aula avulsa',
      descricao: 'Aula única para reposições ou experimentação.',
      valor: '95.00',
      duracaoDias: 1,
      aulasSemanais: 1,
      ativo: false,
    }),
  ])

  const horarios = await Promise.all([
    upsertHorario({ diaSemana: DiaSemana.SEGUNDA, horaInicio: '07:00', horaFim: '08:00', vagasTotal: 4 }),
    upsertHorario({ diaSemana: DiaSemana.TERCA, horaInicio: '18:00', horaFim: '19:00', vagasTotal: 3 }),
    upsertHorario({ diaSemana: DiaSemana.QUARTA, horaInicio: '07:00', horaFim: '08:00', vagasTotal: 4 }),
    upsertHorario({ diaSemana: DiaSemana.QUINTA, horaInicio: '19:00', horaFim: '20:00', vagasTotal: 2 }),
    upsertHorario({ diaSemana: DiaSemana.SABADO, horaInicio: '09:00', horaFim: '10:00', vagasTotal: 5 }),
  ])

  const [ana, bruno, carla, diego] = await Promise.all([
    upsertMember({
      email: 'ana.dev@example.com',
      nome: 'Ana Ferreira',
      status: StatusMembro.ATIVO,
      sexo: Sexo.FEMININO,
      telefone: '(67) 99911-1001',
      cpf: '11122233344',
      planoId: mensal.id,
      observacoes: 'Aluna mock ativa, foco em fortalecimento.',
    }),
    upsertMember({
      email: 'bruno.dev@example.com',
      nome: 'Bruno Matos',
      status: StatusMembro.ATIVO,
      sexo: Sexo.MASCULINO,
      telefone: '(67) 99922-2002',
      cpf: '22233344455',
      planoId: trimestral.id,
      precoCustomizado: '680.00',
      observacoes: 'Tem preço customizado para testar financeiro.',
    }),
    upsertMember({
      email: 'carla.dev@example.com',
      nome: 'Carla Souza',
      status: StatusMembro.PENDENTE,
      sexo: Sexo.FEMININO,
      telefone: '(67) 99933-3003',
      cpf: '33344455566',
      planoId: mensal.id,
      observacoes: 'Cadastro pendente para testar filtros.',
    }),
    upsertMember({
      email: 'diego.dev@example.com',
      nome: 'Diego Lima',
      status: StatusMembro.INATIVO,
      sexo: Sexo.MASCULINO,
      telefone: '(67) 99944-4004',
      cpf: '44455566677',
      planoId: avulso.id,
      observacoes: 'Aluno inativo para testar listagens.',
    }),
  ])

  await replacePayments(ana.id, mensal.id, 'Ana Ferreira', [
    { status: StatusPagamento.PAGO, valor: '280.00', vencimento: '2026-06-05', pagamento: '2026-06-03', forma: 'PIX', observacao: 'Pago antecipado', importKey: 'dev-ana-pago-jun26' },
    { status: StatusPagamento.PENDENTE, valor: '280.00', vencimento: '2026-07-05', forma: 'PIX', observacao: 'Aguardando vencimento', importKey: 'dev-ana-pendente-jul26' },
  ])
  await replacePayments(bruno.id, trimestral.id, 'Bruno Matos', [
    { status: StatusPagamento.ATRASADO, valor: '680.00', vencimento: '2026-05-10', forma: 'Cartão', observacao: 'Cobrança enviada via WhatsApp', importKey: 'dev-bruno-atrasado-mai26' },
    { status: StatusPagamento.PAGO, valor: '680.00', vencimento: '2026-06-10', pagamento: '2026-06-10', forma: 'Cartão', observacao: 'Preço customizado aplicado', importKey: 'dev-bruno-pago-jun26' },
  ])
  await replacePayments(carla.id, mensal.id, 'Carla Souza', [
    { status: StatusPagamento.CANCELADO, valor: '280.00', vencimento: '2026-06-15', forma: 'Dinheiro', observacao: 'Cancelado antes do início', importKey: 'dev-carla-cancelado-jun26' },
  ])
  await replacePayments(diego.id, avulso.id, 'Diego Lima', [
    { status: StatusPagamento.ATRASADO, valor: '95.00', vencimento: '2026-04-20', forma: 'PIX', observacao: 'Aluno inativo com pendência', importKey: 'dev-diego-atrasado-abr26' },
  ])

  await Promise.all([
    prisma.agendamento.upsert({
      where: { membroId_horarioId_data: { membroId: ana.id, horarioId: horarios[0].id, data: date('2026-06-08') } },
      update: { presente: true, observacao: 'Chegou 5 min antes.' },
      create: { membroId: ana.id, horarioId: horarios[0].id, data: date('2026-06-08'), presente: true, observacao: 'Chegou 5 min antes.' },
    }),
    prisma.agendamento.upsert({
      where: { membroId_horarioId_data: { membroId: bruno.id, horarioId: horarios[1].id, data: date('2026-06-09') } },
      update: { presente: false, observacao: 'Falta justificada.' },
      create: { membroId: bruno.id, horarioId: horarios[1].id, data: date('2026-06-09'), presente: false, observacao: 'Falta justificada.' },
    }),
    prisma.agendamento.upsert({
      where: { membroId_horarioId_data: { membroId: carla.id, horarioId: horarios[4].id, data: date('2026-06-13') } },
      update: { presente: null, observacao: 'Aula experimental pendente.' },
      create: { membroId: carla.id, horarioId: horarios[4].id, data: date('2026-06-13'), observacao: 'Aula experimental pendente.' },
    }),
  ])

  await Promise.all([
    prisma.horarioFixo.upsert({
      where: { membroId_diaSemana_hora: { membroId: ana.id, diaSemana: DiaSemana.SEGUNDA, hora: '07:00' } },
      update: {},
      create: { membroId: ana.id, diaSemana: DiaSemana.SEGUNDA, hora: '07:00' },
    }),
    prisma.horarioFixo.upsert({
      where: { membroId_diaSemana_hora: { membroId: bruno.id, diaSemana: DiaSemana.TERCA, hora: '18:00' } },
      update: {},
      create: { membroId: bruno.id, diaSemana: DiaSemana.TERCA, hora: '18:00' },
    }),
  ])

  await Promise.all([
    replaceTraining(ana.id, 'Treino Dev Ana'),
    replaceTraining(bruno.id, 'Treino Dev Bruno'),
  ])

  await prisma.treinoTemplate.deleteMany({ where: { nome: 'Template Dev Full Body' } })
  await prisma.treinoTemplate.create({
    data: {
      nome: 'Template Dev Full Body',
      objetivo: 'Base para testes de criação de treino',
      observacoes: 'Template mock com observações por exercício.',
      exercicios: {
        create: [
          { sessao: 'A', nome: 'Desenvolvimento', grupoMuscular: 'Ombros', series: '3', repeticoes: '10', observacoes: 'Não travar cotovelos.', ordem: 0 },
          { sessao: 'A', nome: 'Levantamento terra romeno', grupoMuscular: 'Posterior', series: '3', repeticoes: '8-10', observacoes: 'Priorizar dobradiça de quadril.', ordem: 1 },
        ],
      },
    },
  })

  await prisma.anamnese.upsert({
    where: { membroId: ana.id },
    update: {
      altura: '1,66',
      pesoAtual: '62kg',
      objetivo: 'Ganho de força',
      praticaAtividade: 'Sim',
      experienciaMusculacao: 'Intermediária',
      expectativas: 'Melhorar postura e consistência.',
    },
    create: {
      membroId: ana.id,
      altura: '1,66',
      pesoAtual: '62kg',
      objetivo: 'Ganho de força',
      praticaAtividade: 'Sim',
      experienciaMusculacao: 'Intermediária',
      expectativas: 'Melhorar postura e consistência.',
    },
  })

  await Promise.all([
    prisma.notificacao.create({
      data: {
        membroId: ana.id,
        tipo: TipoNotificacao.LEMBRETE_AULA,
        titulo: 'Aula hoje',
        mensagem: 'Sua aula está marcada para 07:00.',
        statusEntrega: StatusEntregaNotificacao.ENVIADA,
        enviada: true,
        enviadaEm: new Date(),
        canalEmail: false,
      },
    }),
    prisma.notificacao.create({
      data: {
        membroId: bruno.id,
        tipo: TipoNotificacao.COBRANCA,
        titulo: 'Pagamento em atraso',
        mensagem: 'Existe um pagamento pendente no financeiro.',
        statusEntrega: StatusEntregaNotificacao.PENDENTE,
        agendadaPara: date('2026-06-09'),
        canalEmail: true,
      },
    }),
  ])

  const importRun = await prisma.pagamentoImportRun.upsert({
    where: { batchId: 'dev-import-jun26' },
    update: {
      status: PagamentoImportRunStatus.APPLIED,
      totalRowsSeen: 4,
      rowsWithNumericPago: 3,
      inserted: 2,
      skipped: 1,
      matched: 2,
      ambiguous: 1,
      unmatched: 1,
      dryRun: false,
    },
    create: {
      batchId: 'dev-import-jun26',
      sourceFilename: 'mock-pagamentos-junho.xlsx',
      sourceBasename: 'mock-pagamentos-junho',
      competenciaMes: date('2026-06-01'),
      status: PagamentoImportRunStatus.APPLIED,
      totalRowsSeen: 4,
      rowsWithNumericPago: 3,
      inserted: 2,
      skipped: 1,
      matched: 2,
      ambiguous: 1,
      unmatched: 1,
      dryRun: false,
    },
  })

  await prisma.pagamentoImportLog.deleteMany({ where: { importRunId: importRun.id } })
  await prisma.pagamentoImportLog.createMany({
    data: [
      { importRunId: importRun.id, rowIndex: 1, rawName: 'Ana Ferreira', rawPago: '280', parsedAmount: money('280.00'), decision: PagamentoImportDecision.MATCHED, matchScore: money('0.9900'), matchedMembroId: ana.id, detalhe: 'Match direto por nome.' },
      { importRunId: importRun.id, rowIndex: 2, rawName: 'Bruno M.', rawPago: '680', parsedAmount: money('680.00'), decision: PagamentoImportDecision.AMBIGUOUS, matchScore: money('0.7200'), matchedMembroId: bruno.id, detalhe: 'Nome abreviado para testar revisão.' },
      { importRunId: importRun.id, rowIndex: 3, rawName: 'Pessoa Não Cadastrada', rawPago: '100', parsedAmount: money('100.00'), decision: PagamentoImportDecision.UNMATCHED, detalhe: 'Sem candidato confiável.' },
    ],
  })

  console.log(JSON.stringify({
    adminEmail: TEST_ADMIN_EMAIL,
    adminPassword: TEST_PASSWORD,
    members: 4,
    plans: 3,
    payments: 6,
    schedules: horarios.length,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
