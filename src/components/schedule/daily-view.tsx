'use client'

import { useMemo, useCallback, memo } from 'react'
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

interface DailyViewProps {
  date: Date
  agendamentos: Agendamento[]
  isEditable?: boolean
  onSlotClick?: (hour: number) => void
  onMemberClick?: (agendamento: Agendamento) => void
  draggingId?: string | null
  onDragStart?: (agendamento: Agendamento) => void
  onDragEnd?: () => void
  onDrop?: (hour: number, agendamentoId: string) => void
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

  // Pre-compute agendamentos by hour to avoid filtering on each render
  const agendamentosByHour = useMemo(() => {
    const byHour = new Map<number, Agendamento[]>()
    for (const a of agendamentos) {
      const hour = parseInt(a.horario.horaInicio.split(':')[0], 10)
      if (!byHour.has(hour)) {
        byHour.set(hour, [])
      }
      byHour.get(hour)!.push(a)
    }
    return byHour
  }, [agendamentos])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((hour: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const agendamentoId = e.dataTransfer.getData('agendamentoId')
    if (agendamentoId && onDrop) {
      onDrop(hour, agendamentoId)
    }
  }, [onDrop])

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
                hour={hour}
                agendamentos={hourAgendamentos}
                isEditable={isEditable}
                onSlotClick={() => onSlotClick?.(hour)}
                onMemberClick={onMemberClick}
                draggingId={draggingId}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop(hour)}
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export const DailyView = memo(DailyViewBase)

