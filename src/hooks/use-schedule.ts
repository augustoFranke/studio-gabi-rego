'use client'

import { useState, useCallback, useEffect } from 'react'
import { formatDateISO, getDiaSemanaFromDay } from '@/lib/schedule'
import type { Agendamento, Membro, ScheduleView } from '@/types/schedule'
import { toast } from 'sonner'

interface UseScheduleProps {
  initialDate?: Date
  initialView?: ScheduleView
}

interface UseScheduleReturn {
  currentDate: Date
  view: ScheduleView
  agendamentos: Agendamento[]
  membros: Membro[]
  isLoading: boolean
  draggingId: string | null
  setCurrentDate: (date: Date) => void
  setView: (view: ScheduleView) => void
  setDraggingId: (id: string | null) => void
  fetchAgendamentos: () => Promise<void>
  fetchMembros: () => Promise<void>
  createAgendamento: (membroId: string, date: Date, hour: number) => Promise<boolean>
  updateAgendamento: (
    id: string,
    data: { observacao?: string }
  ) => Promise<boolean>
  deleteAgendamento: (id: string) => Promise<boolean>
  moveAgendamento: (
    id: string,
    newDate: Date,
    newHour: number
  ) => Promise<boolean>
}

export function useSchedule({
  initialDate = new Date(),
  initialView = 'weekly',
}: UseScheduleProps = {}): UseScheduleReturn {
  const [currentDate, setCurrentDate] = useState<Date>(initialDate)
  const [view, setView] = useState<ScheduleView>(initialView)
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Calculate date range based on view
  const getDateRange = useCallback(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    switch (view) {
      case 'daily':
        // Just the current day
        break
      case 'weekly':
        // Monday to Sunday
        const day = start.getDay()
        const diff = start.getDate() - day + (day === 0 ? -6 : 1)
        start.setDate(diff)
        end.setDate(start.getDate() + 6)
        break
      case 'monthly':
        // First to last day of month
        start.setDate(1)
        end.setMonth(end.getMonth() + 1)
        end.setDate(0)
        break
    }

    return {
      dataInicio: formatDateISO(start),
      dataFim: formatDateISO(end),
    }
  }, [currentDate, view])

  // Fetch agendamentos
  const fetchAgendamentos = useCallback(async () => {
    setIsLoading(true)
    try {
      const { dataInicio, dataFim } = getDateRange()
      const response = await fetch(
        `/api/agendamentos?dataInicio=${dataInicio}&dataFim=${dataFim}`
      )
      if (!response.ok) throw new Error('Erro ao buscar agendamentos')
      const data = await response.json()
      setAgendamentos(data)
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error)
      toast.error('Erro ao carregar agendamentos')
    } finally {
      setIsLoading(false)
    }
  }, [getDateRange])

  // Fetch membros
  const fetchMembros = useCallback(async () => {
    try {
      const response = await fetch('/api/membros?status=ATIVO')
      if (!response.ok) throw new Error('Erro ao buscar membros')
      const data = await response.json()
      setMembros(data)
    } catch (error) {
      console.error('Erro ao buscar membros:', error)
    }
  }, [])

  // Create agendamento
  const createAgendamento = useCallback(
    async (membroId: string, date: Date, hour: number): Promise<boolean> => {
      try {
        const diaSemana = getDiaSemanaFromDay(date.getDay())
        const horaInicio = `${hour.toString().padStart(2, '0')}:00`

        // First get or create the horario
        const horarioResponse = await fetch('/api/horarios/get-or-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diaSemana, horaInicio }),
        })

        if (!horarioResponse.ok) {
          const error = await horarioResponse.json()
          throw new Error(error.error || 'Erro ao obter horario')
        }

        const horario = await horarioResponse.json()

        // Then create the agendamento
        const response = await fetch('/api/agendamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            membroId,
            horarioId: horario.id,
            data: formatDateISO(date),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erro ao criar agendamento')
        }

        toast.success('Agendamento criado com sucesso')
        await fetchAgendamentos()
        return true
      } catch (error) {
        console.error('Erro ao criar agendamento:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao criar agendamento'
        )
        return false
      }
    },
    [fetchAgendamentos]
  )

  // Update agendamento
  const updateAgendamento = useCallback(
    async (
      id: string,
      data: { observacao?: string }
    ): Promise<boolean> => {
      try {
        const response = await fetch(`/api/agendamentos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erro ao atualizar agendamento')
        }

        toast.success('Agendamento atualizado com sucesso')
        await fetchAgendamentos()
        return true
      } catch (error) {
        console.error('Erro ao atualizar agendamento:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao atualizar agendamento'
        )
        return false
      }
    },
    [fetchAgendamentos]
  )

  // Delete agendamento
  const deleteAgendamento = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/agendamentos/${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erro ao remover agendamento')
        }

        toast.success('Agendamento removido com sucesso')
        await fetchAgendamentos()
        return true
      } catch (error) {
        console.error('Erro ao remover agendamento:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao remover agendamento'
        )
        return false
      }
    },
    [fetchAgendamentos]
  )

  // Move agendamento (drag & drop)
  const moveAgendamento = useCallback(
    async (id: string, newDate: Date, newHour: number): Promise<boolean> => {
      try {
        const diaSemana = getDiaSemanaFromDay(newDate.getDay())
        const horaInicio = `${newHour.toString().padStart(2, '0')}:00`

        // First get or create the horario
        const horarioResponse = await fetch('/api/horarios/get-or-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diaSemana, horaInicio }),
        })

        if (!horarioResponse.ok) {
          const error = await horarioResponse.json()
          throw new Error(error.error || 'Erro ao obter horario')
        }

        const horario = await horarioResponse.json()

        // Then update the agendamento
        const response = await fetch(`/api/agendamentos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            horarioId: horario.id,
            data: formatDateISO(newDate),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erro ao mover agendamento')
        }

        toast.success('Agendamento movido com sucesso')
        await fetchAgendamentos()
        return true
      } catch (error) {
        console.error('Erro ao mover agendamento:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao mover agendamento'
        )
        return false
      }
    },
    [fetchAgendamentos]
  )

  // Fetch data on mount and when date/view changes
  useEffect(() => {
    fetchAgendamentos()
  }, [fetchAgendamentos])

  useEffect(() => {
    fetchMembros()
  }, [fetchMembros])

  return {
    currentDate,
    view,
    agendamentos,
    membros,
    isLoading,
    draggingId,
    setCurrentDate,
    setView,
    setDraggingId,
    fetchAgendamentos,
    fetchMembros,
    createAgendamento,
    updateAgendamento,
    deleteAgendamento,
    moveAgendamento,
  }
}
