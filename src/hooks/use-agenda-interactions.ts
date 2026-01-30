import { useCallback, useState } from 'react'
import { parseDateFromAPI } from '@/lib/schedule'
import type { Agendamento, ScheduleView } from '@/types/schedule'

type AgendaInteractionsOptions = {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  setView: (view: ScheduleView) => void
  setDraggingId: (id: string | null) => void
  createAgendamento: (
    membroId: string,
    date: Date,
    hour: number,
    scope?: 'single' | 'weekly'
  ) => Promise<boolean>
  updateAgendamento: (id: string, data: { observacao?: string }) => Promise<boolean>
  deleteAgendamento: (id: string, scope?: 'single' | 'future') => Promise<boolean>
  moveAgendamento: (
    id: string,
    newDate: Date,
    newHour: number,
    scope?: 'single' | 'future'
  ) => Promise<boolean>
}

type PendingMove = {
  agendamentoId: string
  date: Date
  hour: number
}

export function useAgendaInteractions({
  currentDate,
  setCurrentDate,
  setView,
  setDraggingId,
  createAgendamento,
  updateAgendamento,
  deleteAgendamento,
  moveAgendamento,
}: AgendaInteractionsOptions) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view')
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedHour, setSelectedHour] = useState<number | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)

  const handleSlotClick = useCallback((date: Date, hour: number) => {
    setSelectedDate(date)
    setSelectedHour(hour)
    setSelectedAgendamento(null)
    setModalMode('create')
    setModalOpen(true)
  }, [])

  const handleMemberClick = useCallback((agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento)
    setSelectedDate(parseDateFromAPI(agendamento.data))
    setSelectedHour(parseInt(agendamento.horario.horaInicio.split(':')[0], 10))
    setModalMode('edit')
    setModalOpen(true)
  }, [])

  const handleDayClick = useCallback((date: Date) => {
    setCurrentDate(date)
    setView('daily')
  }, [setCurrentDate, setView])

  const handleDragStart = useCallback((agendamento: Agendamento) => {
    setDraggingId(agendamento.id)
  }, [setDraggingId])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
  }, [setDraggingId])

  const handleDrop = useCallback((date: Date, hour: number, agendamentoId: string) => {
    setDraggingId(null)
    setPendingMove({ agendamentoId, date, hour })
    setConfirmMoveOpen(true)
  }, [setDraggingId])

  const handleDailyDrop = useCallback((hour: number, agendamentoId: string) => {
    setDraggingId(null)
    setPendingMove({ agendamentoId, date: currentDate, hour })
    setConfirmMoveOpen(true)
  }, [setDraggingId, currentDate])

  const handleModalSave = useCallback(async (data: {
    membroId?: string
    data?: string
    hour?: number
    observacao?: string
    scope?: 'single' | 'weekly'
  }) => {
    setIsSaving(true)
    try {
      const hour = data.hour ?? selectedHour
      if (modalMode === 'create' && data.membroId && selectedDate && hour !== undefined) {
        const success = await createAgendamento(
          data.membroId,
          selectedDate,
          hour,
          data.scope
        )
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

  const handleModalDelete = useCallback(() => {
    if (!selectedAgendamento) return
    setPendingDeleteId(selectedAgendamento.id)
    setConfirmDeleteOpen(true)
  }, [selectedAgendamento])

  const handleConfirmDelete = useCallback(async (scope: 'single' | 'future') => {
    if (!pendingDeleteId) return
    setIsSaving(true)
    try {
      const success = await deleteAgendamento(pendingDeleteId, scope)
      if (success) {
        setConfirmDeleteOpen(false)
        setModalOpen(false)
      }
    } finally {
      setIsSaving(false)
      setPendingDeleteId(null)
    }
  }, [pendingDeleteId, deleteAgendamento])

  const handleConfirmMove = useCallback(async (scope: 'single' | 'future') => {
    if (!pendingMove) return
    setIsSaving(true)
    try {
      const success = await moveAgendamento(
        pendingMove.agendamentoId,
        pendingMove.date,
        pendingMove.hour,
        scope
      )
      if (success) {
        setConfirmMoveOpen(false)
      }
    } finally {
      setIsSaving(false)
      setPendingMove(null)
    }
  }, [pendingMove, moveAgendamento])

  const handleTodayClick = useCallback(() => {
    setCurrentDate(new Date())
  }, [setCurrentDate])

  const handleDailySlotClick = useCallback((hour: number) => {
    handleSlotClick(currentDate, hour)
  }, [handleSlotClick, currentDate])

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setConfirmDeleteOpen(open)
    if (!open) setPendingDeleteId(null)
  }, [])

  const handleMoveDialogOpenChange = useCallback((open: boolean) => {
    setConfirmMoveOpen(open)
    if (!open) setPendingMove(null)
  }, [])

  const closeConfirmDelete = useCallback(() => {
    handleDeleteDialogOpenChange(false)
  }, [handleDeleteDialogOpenChange])

  const closeConfirmMove = useCallback(() => {
    handleMoveDialogOpenChange(false)
  }, [handleMoveDialogOpenChange])

  return {
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
    handleDailyDrop,
    handleModalSave,
    handleModalDelete,
    handleConfirmDelete,
    handleConfirmMove,
    handleTodayClick,
    handleDailySlotClick,
    handleDeleteDialogOpenChange,
    handleMoveDialogOpenChange,
    closeConfirmDelete,
    closeConfirmMove,
  }
}
