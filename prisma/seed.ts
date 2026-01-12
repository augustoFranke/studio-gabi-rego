import { PrismaClient, Role, DiaSemana } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Criar usuário admin
  const senhaAdmin = await hash('admin123', 12)
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@gabistudio.com.br' },
    update: {},
    create: {
      email: 'admin@gabistudio.com.br',
      senha: senhaAdmin,
      nome: 'Administrador',
      role: Role.ADMIN,
    },
  })
  console.log('✅ Usuário admin criado:', admin.email)

  // Criar planos
  const planos = await Promise.all([
    prisma.plano.upsert({
      where: { id: 'plano-mensal' },
      update: {},
      create: {
        id: 'plano-mensal',
        nome: 'Plano Mensal',
        descricao: 'Acesso completo por 30 dias',
        valor: 150.00,
        duracaoDias: 30,
        aulasSemanais: 3,
      },
    }),
    prisma.plano.upsert({
      where: { id: 'plano-trimestral' },
      update: {},
      create: {
        id: 'plano-trimestral',
        nome: 'Plano Trimestral',
        descricao: 'Acesso completo por 90 dias com desconto',
        valor: 400.00,
        duracaoDias: 90,
        aulasSemanais: 3,
      },
    }),
    prisma.plano.upsert({
      where: { id: 'plano-semestral' },
      update: {},
      create: {
        id: 'plano-semestral',
        nome: 'Plano Semestral',
        descricao: 'Acesso completo por 180 dias com maior desconto',
        valor: 720.00,
        duracaoDias: 180,
        aulasSemanais: 4,
      },
    }),
  ])
  console.log('✅ Planos criados:', planos.length)

  // Criar horários disponíveis
  const diasUteis = [DiaSemana.SEGUNDA, DiaSemana.TERCA, DiaSemana.QUARTA, DiaSemana.QUINTA, DiaSemana.SEXTA]
  const horarios = [
    { inicio: '06:00', fim: '07:00' },
    { inicio: '07:00', fim: '08:00' },
    { inicio: '08:00', fim: '09:00' },
    { inicio: '17:00', fim: '18:00' },
    { inicio: '18:00', fim: '19:00' },
    { inicio: '19:00', fim: '20:00' },
  ]

  let horariosCount = 0
  for (const dia of diasUteis) {
    for (const horario of horarios) {
      await prisma.horarioDisponivel.upsert({
        where: { id: `${dia}-${horario.inicio}` },
        update: {},
        create: {
          id: `${dia}-${horario.inicio}`,
          diaSemana: dia,
          horaInicio: horario.inicio,
          horaFim: horario.fim,
          vagasTotal: 8,
        },
      })
      horariosCount++
    }
  }

  // Adicionar horários de sábado (manhã apenas)
  const horariosSabado = [
    { inicio: '08:00', fim: '09:00' },
    { inicio: '09:00', fim: '10:00' },
    { inicio: '10:00', fim: '11:00' },
  ]
  for (const horario of horariosSabado) {
    await prisma.horarioDisponivel.upsert({
      where: { id: `SABADO-${horario.inicio}` },
      update: {},
      create: {
        id: `SABADO-${horario.inicio}`,
        diaSemana: DiaSemana.SABADO,
        horaInicio: horario.inicio,
        horaFim: horario.fim,
        vagasTotal: 6,
      },
    })
    horariosCount++
  }
  console.log('✅ Horários criados:', horariosCount)

  // Criar configurações iniciais
  const configs = [
    { chave: 'NOME_ESTUDIO', valor: 'Gabi Studio', descricao: 'Nome do estúdio' },
    { chave: 'TELEFONE_CONTATO', valor: '', descricao: 'Telefone para contato' },
    { chave: 'EMAIL_CONTATO', valor: 'contato@gabistudio.com.br', descricao: 'Email para contato' },
    { chave: 'DIAS_AVISO_VENCIMENTO', valor: '3', descricao: 'Dias antes do vencimento para enviar aviso' },
    { chave: 'HORARIO_LEMBRETE_AULA', valor: '2', descricao: 'Horas antes da aula para enviar lembrete' },
  ]

  for (const config of configs) {
    await prisma.configuracao.upsert({
      where: { chave: config.chave },
      update: {},
      create: config,
    })
  }
  console.log('✅ Configurações criadas:', configs.length)

  console.log('🎉 Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

