'use client'

import { useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TimeSlot } from './time-slot'
import {
  formatDateBR,
  formatWeekdayFull,
  HOURS,
  isToday,
} from '@/lib/schedule'
import type { Agendamento } from '@/types/schedule'
import { cn } from '@/lib/utils'
import { useScheduleData } from './use-schedule-data'

interface DailyViewProps {
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

const DailyViewBase = function DailyView({
  date,
  agendamentos,
  isEditable = false,
  onSlotClick,
  onMemberClick,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
}: DailyViewProps) {
  const isTodayDate = isToday(date)
  const { agendamentosByHour } = useScheduleData(agendamentos)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle
          className={cn(
            'flex items-center gap-2',
            isTodayDate && 'text-primary'
          )}
        >
          <span className="capitalize">{formatWeekdayFull(date)}</span>
          <span className="text-muted-foreground font-normal">
            {formatDateBR(date)}
          </span>
          {isTodayDate && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              Hoje
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t">
          {HOURS.map((hour) => {
            const hourAgendamentos = agendamentosByHour.get(hour) || []

            return (
              <TimeSlot
                key={hour}
                date={date}
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
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export const DailyView = memo(DailyViewBase)
