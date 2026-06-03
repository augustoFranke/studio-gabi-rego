'use client'

import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
} from 'lucide-react'
import {
  formatDateBR,
  formatMonthYear,
  navigateDay,
  navigateWeek,
  navigateMonth,
  getWeekDays,
  formatDayMonth,
} from '@/lib/schedule'
import type { ScheduleView } from '@/types/schedule'

interface ScheduleHeaderProps {
  currentDate: Date
  view: ScheduleView
  onDateChange: (date: Date) => void
  onViewChange: (view: ScheduleView) => void
  onTodayClick: () => void
}

export function ScheduleHeader({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onTodayClick,
}: ScheduleHeaderProps) {
  const handleNavigate = (direction: 'prev' | 'next') => {
    switch (view) {
      case 'daily':
        onDateChange(navigateDay(currentDate, direction))
        break
      case 'weekly':
        onDateChange(navigateWeek(currentDate, direction))
        break
      case 'monthly':
        onDateChange(navigateMonth(currentDate, direction))
        break
    }
  }

  const getDateLabel = () => {
    switch (view) {
      case 'daily':
        return formatDateBR(currentDate)
      case 'weekly': {
        const weekDays = getWeekDays(currentDate)
        return `${formatDayMonth(weekDays[0])} - ${formatDayMonth(weekDays[5])}`
      }
      case 'monthly':
        return formatMonthYear(currentDate)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleNavigate('prev')}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleNavigate('next')}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" onClick={onTodayClick}>
          Hoje
        </Button>
        <h2 className="text-lg font-semibold capitalize ml-2">{getDateLabel()}</h2>
      </div>

      <Tabs value={view} onValueChange={(v) => onViewChange(v as ScheduleView)}>
        <TabsList>
          <TabsTrigger value="daily" className="gap-1.5">
            <CalendarIcon className="size-4" />
            <span className="hidden sm:inline">Dia</span>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1.5">
            <CalendarDays className="size-4" />
            <span className="hidden sm:inline">Semana</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <CalendarRange className="size-4" />
            <span className="hidden sm:inline">Mês</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
