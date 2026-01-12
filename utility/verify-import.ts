import { prisma } from '../src/lib/prisma'

async function main() {
  const placeholderMembers = await prisma.membro.count({
    where: { cpf: { startsWith: '999' } }
  })

  const totalAppointments = await prisma.agendamento.count({
    where: {
      data: {
        gte: new Date('2026-01-01'),
        lte: new Date('2026-01-31')
      }
    }
  })

  const totalHorarios = await prisma.horarioDisponivel.count({
    where: { ativo: true }
  })

  const uniqueMembers = await prisma.agendamento.findMany({
    where: {
      data: {
        gte: new Date('2026-01-01'),
        lte: new Date('2026-01-31')
      }
    },
    distinct: ['membroId'],
    select: { membroId: true }
  })

  const sampleAppointments = await prisma.agendamento.findMany({
    where: {
      data: {
        gte: new Date('2026-01-01'),
        lte: new Date('2026-01-31')
      }
    },
    include: {
      membro: {
        include: { usuario: true }
      },
      horario: true
    },
    take: 5,
    orderBy: { data: 'asc' }
  })

  console.log('========================================')
  console.log('  Import Verification')
  console.log('========================================')
  console.log(`Members created (placeholder): ${placeholderMembers}`)
  console.log(`Total appointments (Jan 2026): ${totalAppointments}`)
  console.log(`Unique members with appointments: ${uniqueMembers.length}`)
  console.log(`Active time slots: ${totalHorarios}`)
  console.log(`Average appointments per member: ${Math.round(totalAppointments / uniqueMembers.length)}`)
  console.log('')
  console.log('Sample appointments (January 2026):')
  sampleAppointments.forEach((apt, idx) => {
    const dateStr = apt.data.toISOString().split('T')[0]
    console.log(`  ${idx + 1}. ${apt.membro.usuario.nome} - ${dateStr} ${apt.horario.horaInicio} (${apt.horario.diaSemana})`)
  })
  console.log('========================================')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
