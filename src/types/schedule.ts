import type { DiaSemana } from '@prisma/client'

export type { DiaSemana }

export type ScheduleView = 'daily' | 'weekly' | 'monthly'

export interface Membro {
  id: string
  usuarioId: string
  cpf: string
  telefone: string
  status: 'ATIVO' | 'INATIVO' | 'PENDENTE'
  fotoUrl: string | null
  usuario: {
    nome: string
    email: string
  }
}

export interface Agendamento {
  id: string
  membroId: string
  horarioId: string
  data: string | Date
  presente: boolean | null
  observacao: string | null
  membro: {
    id: string
    fotoUrl: string | null
    usuario: {
      nome: string
    }
  }
  horario: {
    id: string
    diaSemana: DiaSemana
    horaInicio: string
    horaFim: string
    vagasTotal: number
  }
}
