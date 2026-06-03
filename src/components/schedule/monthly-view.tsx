'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  getCalendarDaysMonSat,
  formatDateISO,
  isToday,
  DiaSemanaAbrev,
} from '@/lib/schedule'
import type { Agendamento, DiaSemana } from '@/types/schedule'
import { cn } from '@/lib/utils'
import { getMonth } from 'date-fns'
import { DayDetailModal } from './day-detail-modal'
import { useScheduleData } from './use-schedule-data'

interface MonthlyViewProps {
  date: Date
  agendamentos: Agendamento[]
  onDayClick?: (date: Date) => void
  onMemberClick?: (agendamento: Agendamento) => void
}

export const MonthlyView = memo(function MonthlyView({
  date,
  agendamentos,
  onMemberClick,
}: MonthlyViewProps) {
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const calendarDays = useMemo(() => getCalendarDaysMonSat(date), [date])
  const currentMonth = getMonth(date)
  const { agendamentosByDate, countsByDate } = useScheduleData(agendamentos)

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDay(day)
    setDetailModalOpen(true)
  }, [])

  const handleMemberClick = useCallback((agendamento: Agendamento) => {
    setDetailModalOpen(false)
    onMemberClick?.(agendamento)
  }, [onMemberClick])

  const weekDays: DiaSemana[] = [
    'SEGUNDA',
    'TERCA',
    'QUARTA',
    'QUINTA',
    'SEXTA',
    'SABADO',
  ]

  const selectedDayAgendamentos = selectedDay
    ? agendamentosByDate.get(formatDateISO(selectedDay)) || []
    : []

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-6 border-b">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0 bg-muted/30"
              >
                {DiaSemanaAbrev[day]}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-6">
            {calendarDays.map((day, index) => {
              const dateKey = formatDateISO(day)
              const count = countsByDate.get(dateKey) || 0
              const isTodayDate = isToday(day)
              const isCurrentMonth = getMonth(day) === currentMonth

              return (
                <button
                  type="button"
                  key={dateKey}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'min-h-[100px] p-2 border-r border-b text-left transition-colors hover:bg-accent',
                    'last:border-r-0',
                    index >= calendarDays.length - 6 && 'border-b-0',
                    !isCurrentMonth && 'bg-muted/20 text-muted-foreground'
                  )}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '100px' }}
                >
                  <div className="flex flex-col h-full">
                    <div
                      className={cn(
                        'text-sm font-medium mb-1',
                        isTodayDate &&
                        'bg-primary text-primary-foreground rounded-full size-7 flex items-center justify-center'
                      )}
                    >
                      {day.getDate()}
                    </div>

                    {count > 0 && (
                      <div className="mt-auto">
                        <div
                          className={cn(
                            'text-xs px-2 py-1 rounded-full inline-flex items-center gap-1',
                            count >= 30
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : count >= 20
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-primary/10 text-primary'
                          )}
                        >
                          <span className="font-medium">{count}</span>
                          <span className="hidden sm:inline">
                            {count === 1 ? 'aula' : 'aulas'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <DayDetailModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          date={selectedDay}
          agendamentos={selectedDayAgendamentos}
          onMemberClick={handleMemberClick}
        />
      )}
    </>
  )
})
