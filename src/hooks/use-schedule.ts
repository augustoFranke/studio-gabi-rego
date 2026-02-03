'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { formatDateISO, getDiaSemanaFromDay } from '@/lib/schedule'
import { fetcher } from '@/lib/fetcher'
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
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Calculate date range based on view
  const dateRange = useMemo(() => {
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

  // SWR for agendamentos with automatic revalidation
  const agendamentosKey = `/api/agendamentos?dataInicio=${dateRange.dataInicio}&dataFim=${dateRange.dataFim}`
  const {
    data: agendamentos = [],
    isLoading: isLoadingAgendamentos,
    mutate: mutateAgendamentos,
  } = useSWR<Agendamento[]>(agendamentosKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  })

  // SWR for membros with longer cache (rarely changes)
  const {
    data: membros = [],
  } = useSWR<Membro[]>('/api/membros?status=ATIVO&fields=compact', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 minute deduping - membros rarely change
  })

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
        await mutateAgendamentos()
        return true
      } catch (error) {
        console.error('Erro ao criar agendamento:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao criar agendamento'
        )
        return false
      }
    },
    [mutateAgendamentos]
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
        await mutateAgendamentos()
        return true
      } catch (error) {
        console.error('Erro ao atualizar agendamento:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao atualizar agendamento'
        )
        return false
      }
    },
    [mutateAgendamentos]
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
        await mutateAgendamentos()
        return true
      } catch (error) {
        console.error('Erro ao remover agendamento:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao remover agendamento'
        )
        return false
      }
    },
    [mutateAgendamentos]
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
        await mutateAgendamentos()
        return true
      } catch (error) {
        console.error('Erro ao mover agendamento:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao mover agendamento'
        )
        return false
      }
    },
    [mutateAgendamentos]
  )

  return {
    currentDate,
    view,
    agendamentos,
    membros,
    isLoading: isLoadingAgendamentos,
    draggingId,
    setCurrentDate,
    setView,
    setDraggingId,
    createAgendamento,
    updateAgendamento,
    deleteAgendamento,
    moveAgendamento,
  }
}
