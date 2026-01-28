'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Users, Clock, TrendingUp } from 'lucide-react'
import {
  ScheduleHeader,
  DailyView,
  WeeklyView,
  MonthlyView,
  AgendamentoModal,
} from '@/components/schedule'
import { useSchedule } from '@/hooks/use-schedule'
import { parseDateFromAPI } from '@/lib/schedule'
import type { Agendamento } from '@/types/schedule'

export default function AgendaPage() {
  const {
    currentDate,
    view,
    agendamentos,
    membros,
    isLoading,
    draggingId,
    setCurrentDate,
    setView,
    setDraggingId,
    createAgendamento,
    updateAgendamento,
    deleteAgendamento,
    moveAgendamento,
  } = useSchedule()

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view')
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedHour, setSelectedHour] = useState<number | undefined>()
  const [isSaving, setIsSaving] = useState(false)

  // Handle slot click (create new agendamento)
  const handleSlotClick = useCallback((date: Date, hour: number) => {
    setSelectedDate(date)
    setSelectedHour(hour)
    setSelectedAgendamento(null)
    setModalMode('create')
    setModalOpen(true)
  }, [])

  // Handle member click (view/edit agendamento)
  const handleMemberClick = useCallback((agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento)
    setSelectedDate(parseDateFromAPI(agendamento.data))
    setSelectedHour(parseInt(agendamento.horario.horaInicio.split(':')[0], 10))
    setModalMode('edit')
    setModalOpen(true)
  }, [])

  // Handle day click in monthly view
  const handleDayClick = useCallback((date: Date) => {
    setCurrentDate(date)
    setView('daily')
  }, [setCurrentDate, setView])

  // Handle drag start
  const handleDragStart = useCallback((agendamento: Agendamento) => {
    setDraggingId(agendamento.id)
  }, [setDraggingId])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
  }, [setDraggingId])

  // Handle drop
  const handleDrop = useCallback(async (date: Date, hour: number, agendamentoId: string) => {
    setDraggingId(null)
    await moveAgendamento(agendamentoId, date, hour)
  }, [setDraggingId, moveAgendamento])

  // Handle drop for daily view (same date, different hour)
  const handleDailyDrop = useCallback(async (hour: number, agendamentoId: string) => {
    setDraggingId(null)
    await moveAgendamento(agendamentoId, currentDate, hour)
  }, [setDraggingId, moveAgendamento, currentDate])

  // Handle modal save
  const handleModalSave = useCallback(async (data: {
    membroId?: string
    data?: string
    hour?: number
    observacao?: string
  }) => {
    setIsSaving(true)
    try {
      const hour = data.hour ?? selectedHour
      if (modalMode === 'create' && data.membroId && selectedDate && hour !== undefined) {
        const success = await createAgendamento(data.membroId, selectedDate, hour)
        if (success) setModalOpen(false)
      } else if (modalMode === 'edit' && selectedAgendamento) {
        const success = await updateAgendamento(selectedAgendamento.id, {
          observacao: data.observacao,
        })
        if (success) setModalOpen(false)
      }
    } finally {
      setIsSaving(false)
    }
  }, [modalMode, selectedDate, selectedHour, selectedAgendamento, createAgendamento, updateAgendamento])

  // Handle modal delete
  const handleModalDelete = useCallback(async () => {
    if (!selectedAgendamento) return
    setIsSaving(true)
    try {
      const success = await deleteAgendamento(selectedAgendamento.id)
      if (success) setModalOpen(false)
    } finally {
      setIsSaving(false)
    }
  }, [selectedAgendamento, deleteAgendamento])

  // Handle today click
  const handleTodayClick = useCallback(() => {
    setCurrentDate(new Date())
  }, [setCurrentDate])

  // Memoized slot click handler for daily view
  const handleDailySlotClick = useCallback((hour: number) => {
    handleSlotClick(currentDate, hour)
  }, [handleSlotClick, currentDate])

  // Calculate stats with memoization
  const stats = useMemo(() => {
    const totalAgendamentos = agendamentos.length
    const uniqueMembros = new Set(agendamentos.map((a) => a.membroId)).size
    const totalHours = new Set(agendamentos.map((a) => a.horario.horaInicio)).size
    const avgPerDay = view === 'daily'
      ? totalAgendamentos
      : view === 'weekly'
        ? Math.round(totalAgendamentos / 7)
        : Math.round(totalAgendamentos / 30)

    return { totalAgendamentos, uniqueMembros, totalHours, avgPerDay }
  }, [agendamentos, view])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie os agendamentos do studio
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Aulas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalAgendamentos}
            </div>
            <p className="text-xs text-muted-foreground">
              no periodo selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.uniqueMembros}
            </div>
            <p className="text-xs text-muted-foreground">
              com aulas agendadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horarios</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalHours}
            </div>
            <p className="text-xs text-muted-foreground">
              diferentes utilizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Media por Dia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.avgPerDay}
            </div>
            <p className="text-xs text-muted-foreground">
              aulas por dia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule header with navigation and view switcher */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Calendario de Aulas</CardTitle>
              <CardDescription>
                Arraste membros para reorganizar ou clique para editar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScheduleHeader
            currentDate={currentDate}
            view={view}
            onDateChange={setCurrentDate}
            onViewChange={setView}
            onTodayClick={handleTodayClick}
          />

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-[400px] w-full" />
            </div>
          )}

          {/* Daily view */}
          {!isLoading && view === 'daily' && (
            <DailyView
              date={currentDate}
              agendamentos={agendamentos}
              isEditable
              onSlotClick={handleDailySlotClick}
              onMemberClick={handleMemberClick}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDailyDrop}
            />
          )}

          {/* Weekly view */}
          {!isLoading && view === 'weekly' && (
            <WeeklyView
              date={currentDate}
              agendamentos={agendamentos}
              isEditable
              onSlotClick={handleSlotClick}
              onMemberClick={handleMemberClick}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            />
          )}

          {/* Monthly view */}
          {!isLoading && view === 'monthly' && (
            <MonthlyView
              date={currentDate}
              agendamentos={agendamentos}
              onDayClick={handleDayClick}
              onMemberClick={handleMemberClick}
            />
          )}
        </CardContent>
      </Card>

      {/* Agendamento modal */}
      <AgendamentoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        agendamento={selectedAgendamento}
        membros={membros}
        selectedDate={selectedDate}
        selectedHour={selectedHour}
        mode={modalMode}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
        isLoading={isSaving}
      />
    </div>
  )
}
