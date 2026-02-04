'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TimeSlot } from './time-slot'
import {
  getWeekDays,
  formatDayMonth,
  formatWeekdayShort,
  HOURS,
  formatDateISO,
  isToday,
} from '@/lib/schedule'
import type { Agendamento } from '@/types/schedule'
import { cn } from '@/lib/utils'
import { DayDetailModal } from './day-detail-modal'
import { useScheduleData } from './use-schedule-data'

interface WeeklyViewProps {
  date: Date
  agendamentos: Agendamento[]
  isEditable?: boolean
  onSlotClick?: (date: Date, hour: number) => void
  onMemberClick?: (agendamento: Agendamento) => void
  draggingId?: string | null
  onDragStart?: (agendamento: Agendamento) => void
  onDragEnd?: () => void
  onDrop?: (date: Date, hour: number, agendamentoId: string) => void
}

const WeeklyViewBase = function WeeklyView({
  date,
  agendamentos,
  isEditable = false,
  onSlotClick,
  onMemberClick,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
}: WeeklyViewProps) {
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const weekDays = useMemo(() => getWeekDays(date), [date])

  const { agendamentosByDate, agendamentosByDateAndHour } = useScheduleData(agendamentos)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDayHeaderClick = useCallback((day: Date) => {
    setSelectedDay(day)
    setDetailModalOpen(true)
  }, [])

  const handleModalMemberClick = useCallback((agendamento: Agendamento) => {
    setDetailModalOpen(false)
    onMemberClick?.(agendamento)
  }, [onMemberClick])

  // Get agendamentos for selected day
  const selectedDayAgendamentos = selectedDay
    ? agendamentosByDate.get(formatDateISO(selectedDay)) || []
    : []

  return (
    <>
      <Card>
        <CardContent className="p-0 overflow-x-auto max-h-[650px] overflow-y-auto">
          <div className="min-w-[800px]">
            {/* Header with days */}
            <div className="grid grid-cols-[64px_repeat(6,1fr)] border-b sticky top-0 bg-background z-10">
              <div className="p-2 border-r bg-muted/30" />
              {weekDays.map((day) => {
                const isTodayDate = isToday(day)
                const dateKey = formatDateISO(day)
                const dayCount = agendamentosByDate.get(dateKey)?.length || 0
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDayHeaderClick(day)}
                    className={cn(
                      'p-2 text-center border-r last:border-r-0 transition-colors hover:bg-accent',
                      isTodayDate && 'bg-primary/5'
                    )}
                  >
                    <div
                      className={cn(
                        'text-xs text-muted-foreground uppercase',
                        isTodayDate && 'text-primary font-medium'
                      )}
                    >
                      {formatWeekdayShort(day)}
                    </div>
                    <div
                      className={cn(
                        'text-sm font-medium',
                        isTodayDate &&
                        'bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto'
                      )}
                    >
                      {formatDayMonth(day).split('/')[0]}
                    </div>
                    {dayCount > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {dayCount} {dayCount === 1 ? 'aula' : 'aulas'}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Time slots grid */}
            <div>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[64px_repeat(6,1fr)] border-b last:border-b-0"
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '44px 800px' }}
                >
                  {/* Hour label */}
                  <div className="p-2 text-sm text-muted-foreground font-medium border-r bg-muted/30 flex items-start">
                    {hour.toString().padStart(2, '0')}:00
                  </div>

                  {/* Day cells */}
                  {weekDays.map((day) => {
                    const dateKey = formatDateISO(day)
                    const hourAgendamentos = agendamentosByDateAndHour.get(`${dateKey}-${hour}`) || []

                    return (
                      <TimeSlot
                        key={`${dateKey}-${hour}`}
                        date={day}
                        hour={hour}
                        agendamentos={hourAgendamentos}
                        isEditable={isEditable}
                        onSlotClick={onSlotClick}
                        onMemberClick={onMemberClick}
                        draggingId={draggingId}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={onDrop}
                        compact
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day detail modal */}
      {selectedDay && (
        <DayDetailModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          date={selectedDay}
          agendamentos={selectedDayAgendamentos}
          onMemberClick={handleModalMemberClick}
        />
      )}
    </>
  )
}

export const WeeklyView = memo(WeeklyViewBase)
