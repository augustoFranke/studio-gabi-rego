import type { DiaSemana } from '@prisma/client'

export type { DiaSemana }

export type ScheduleView = 'daily' | 'weekly' | 'monthly'

export interface HorarioDisponivel {
  id: string
  diaSemana: DiaSemana
  horaInicio: string
  horaFim: string
  vagasTotal: number
  ativo: boolean
}

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

export interface AgendamentoWithDetails extends Agendamento {
  membro: Membro & {
    usuario: {
      nome: string
    }
  }
}

export interface SlotData {
  hour: number
  agendamentos: Agendamento[]
  capacity: number
  available: number
  isFull: boolean
}

export interface DayData {
  date: Date
  dateKey: string
  diaSemana: DiaSemana
  isToday: boolean
  isCurrentMonth: boolean
  slots: SlotData[]
  totalAgendamentos: number
}

export interface WeekData {
  startDate: Date
  endDate: Date
  days: DayData[]
}

export interface MonthData {
  month: number
  year: number
  days: DayData[]
}

export interface CreateAgendamentoInput {
  membroId: string
  horarioId: string
  data: string
}

export interface UpdateAgendamentoInput {
  id: string
  presente?: boolean
  observacao?: string
  horarioId?: string
  data?: string
}

export interface MoveAgendamentoInput {
  id: string
  newHorarioId: string
  newData: string
}

export interface ScheduleFilters {
  dataInicio: string
  dataFim: string
  membroId?: string
}

export interface ScheduleStats {
  totalAgendamentos: number
  totalMembrosAgendados: number
  taxaOcupacao: number
  horariosLotados: number
}
