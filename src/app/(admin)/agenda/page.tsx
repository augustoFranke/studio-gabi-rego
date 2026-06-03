'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar, Users, Clock, TrendingUp } from 'lucide-react'
import { ScheduleHeader } from '@/components/schedule/schedule-header'
import { useSchedule } from '@/hooks/use-schedule'
import { useAgendaInteractions } from '@/hooks/use-agenda-interactions'

const viewLoadingFallback = <Skeleton className="h-[400px] w-full" />

const DailyView = dynamic(
  () => import('@/components/schedule/daily-view').then((mod) => mod.DailyView),
  { loading: () => viewLoadingFallback, ssr: false }
)
const WeeklyView = dynamic(
  () => import('@/components/schedule/weekly-view').then((mod) => mod.WeeklyView),
  { loading: () => viewLoadingFallback, ssr: false }
)
const MonthlyView = dynamic(
  () => import('@/components/schedule/monthly-view').then((mod) => mod.MonthlyView),
  { loading: () => viewLoadingFallback, ssr: false }
)
const AgendamentoModal = dynamic(
  () => import('@/components/schedule/agendamento-modal').then((mod) => mod.AgendamentoModal),
  { ssr: false }
)

interface AgendaStatsProps {
  stats: {
    totalAgendamentos: number
    uniqueMembros: number
    totalHours: number
    avgPerDay: number
  }
  isLoading: boolean
}

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

  const {
    modalOpen,
    setModalOpen,
    modalMode,
    selectedAgendamento,
    selectedDate,
    selectedHour,
    isSaving,
    confirmDeleteOpen,
    confirmMoveOpen,
    handleSlotClick,
    handleMemberClick,
    handleDayClick,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleModalSave,
    handleModalDelete,
    handleConfirmDelete,
    handleConfirmMove,
    handleTodayClick,
    handleDeleteDialogOpenChange,
    handleMoveDialogOpenChange,
    closeConfirmDelete,
    closeConfirmMove,
  } = useAgendaInteractions({
    currentDate,
    setCurrentDate,
    setView,
    setDraggingId,
    createAgendamento,
    updateAgendamento,
    deleteAgendamento,
    moveAgendamento,
  })

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

      <AgendaStats stats={stats} isLoading={isLoading} />

      {/* Schedule header with navigation and view switcher */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="size-5 text-primary" />
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
              onSlotClick={handleSlotClick}
              onMemberClick={handleMemberClick}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
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

      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover agendamento</DialogTitle>
            <DialogDescription>
              Deseja remover apenas este agendamento ou todas as ocorrências futuras?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={closeConfirmDelete}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleConfirmDelete('single')}
              disabled={isSaving}
            >
              Remover apenas este
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleConfirmDelete('future')}
              disabled={isSaving}
            >
              Remover futuros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmMoveOpen}
        onOpenChange={handleMoveDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover agendamento</DialogTitle>
            <DialogDescription>
              Deseja mover apenas este agendamento ou também as próximas ocorrências?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={closeConfirmMove}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleConfirmMove('single')}
              disabled={isSaving}
            >
              Mover apenas este
            </Button>
            <Button
              onClick={() => handleConfirmMove('future')}
              disabled={isSaving}
            >
              Mover futuros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AgendaStats({ stats, isLoading }: AgendaStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <AgendaStatCard title="Total de Aulas" value={stats.totalAgendamentos} description="no periodo selecionado" isLoading={isLoading} icon={<Calendar className="size-4 text-muted-foreground" />} />
      <AgendaStatCard title="Membros Ativos" value={stats.uniqueMembros} description="com aulas agendadas" isLoading={isLoading} icon={<Users className="size-4 text-muted-foreground" />} />
      <AgendaStatCard title="Horarios" value={stats.totalHours} description="diferentes utilizados" isLoading={isLoading} icon={<Clock className="size-4 text-muted-foreground" />} />
      <AgendaStatCard title="Media por Dia" value={stats.avgPerDay} description="aulas por dia" isLoading={isLoading} icon={<TrendingUp className="size-4 text-muted-foreground" />} />
    </div>
  )
}

function AgendaStatCard({
  title,
  value,
  description,
  isLoading,
  icon,
}: {
  title: string
  value: number
  description: string
  isLoading: boolean
  icon: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? <Skeleton className="h-8 w-16" /> : value}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
