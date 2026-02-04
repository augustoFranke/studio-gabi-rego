'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import {
  formatDateBR,
  formatMonthYear,
  formatWeekdayFull,
  formatDateISO,
  parseDateFromAPI,
  getWeekDays,
  formatDayMonth,
  isToday,
  navigateWeek,
} from '@/lib/schedule'
import { fetcher } from '@/lib/fetcher'
import type { Agendamento } from '@/types/schedule'
import { cn } from '@/lib/utils'
import { startOfWeek, endOfWeek } from 'date-fns'

export default function MinhaAgendaPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  // Calculate date range for SWR key
  const dateRange = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    const end = endOfWeek(currentDate, { weekStartsOn: 1 })
    return {
      dataInicio: formatDateISO(start),
      dataFim: formatDateISO(end),
    }
  }, [currentDate])

  // Use SWR for data fetching with automatic caching
  const { data: agendamentos = [], isLoading } = useSWR<Agendamento[]>(
    `/api/agendamentos?dataInicio=${dateRange.dataInicio}&dataFim=${dateRange.dataFim}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  const weekDays = getWeekDays(currentDate)

  // Group and sort agendamentos by date - memoized to prevent recreation on every render
  const agendamentosByDate = useMemo(() => {
    const map = new Map<string, Agendamento[]>()
    for (const agendamento of agendamentos) {
      try {
        const parsedDate = parseDateFromAPI(agendamento.data)
        if (isNaN(parsedDate.getTime())) {
          console.error('Invalid date for agendamento:', agendamento)
          continue
        }
        const dateKey = formatDateISO(parsedDate)
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)!.push(agendamento)
      } catch (e) {
        console.error('Error parsing date for agendamento:', agendamento, e)
      }
    }

    // Sort agendamentos by hour within each day
    for (const [, dayAgendamentos] of map) {
      dayAgendamentos.sort((a, b) =>
        a.horario.horaInicio.localeCompare(b.horario.horaInicio)
      )
    }

    return map
  }, [agendamentos])

  const getPresenceStatus = (presente: boolean | null) => {
    if (presente === true) {
      return {
        label: 'Presente',
        icon: Check,
        variant: 'default' as const,
        className: 'bg-green-100 text-green-700 border-green-200',
      }
    }
    if (presente === false) {
      return {
        label: 'Faltou',
        icon: X,
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-700 border-red-200',
      }
    }
    return {
      label: 'Agendado',
      icon: Clock,
      variant: 'secondary' as const,
      className: 'bg-blue-100 text-blue-700 border-blue-200',
    }
  }

  // Calculate attendance stats
  const totalAulas = agendamentos.length
  const presencas = agendamentos.filter((a) => a.presente === true).length
  const faltas = agendamentos.filter((a) => a.presente === false).length
  const pendentes = agendamentos.filter((a) => a.presente === null).length

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minha Agenda</h1>
        <p className="text-muted-foreground">
          Visualize suas aulas agendadas
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aulas na Semana</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : totalAulas}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presencas</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : presencas}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faltas</CardTitle>
            <X className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : faltas}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : pendentes}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Agenda Semanal</CardTitle>
                <CardDescription>
                  {formatDayMonth(weekDays[0])} - {formatDayMonth(weekDays[weekDays.length - 1])},{' '}
                  {formatMonthYear(currentDate)}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(navigateWeek(currentDate, 'prev'))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(navigateWeek(currentDate, 'next'))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : totalAulas === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Nenhuma aula agendada</h3>
              <p className="text-muted-foreground max-w-sm">
                Você ainda não tem aulas agendadas para esta semana. Entre em contato com a equipe para agendar seus treinos!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {weekDays.map((day) => {
                const dateKey = formatDateISO(day)
                const dayAgendamentos = agendamentosByDate.get(dateKey) || []
                const isTodayDate = isToday(day)

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'border rounded-lg overflow-hidden',
                      isTodayDate && 'border-primary'
                    )}
                  >
                    {/* Day header */}
                    <div
                      className={cn(
                        'px-4 py-2 border-b bg-muted/30',
                        isTodayDate && 'bg-primary/10'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'font-medium capitalize',
                              isTodayDate && 'text-primary'
                            )}
                          >
                            {formatWeekdayFull(day)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatDateBR(day)}
                          </span>
                          {isTodayDate && (
                            <Badge variant="default" className="text-xs">
                              Hoje
                            </Badge>
                          )}
                        </div>
                        {dayAgendamentos.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {dayAgendamentos.length}{' '}
                            {dayAgendamentos.length === 1 ? 'aula' : 'aulas'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Day content */}
                    <div className="p-4">
                      {dayAgendamentos.length > 0 ? (
                        <div className="space-y-2">
                          {dayAgendamentos.map((agendamento) => {
                            const status = getPresenceStatus(agendamento.presente)
                            const StatusIcon = status.icon

                            return (
                              <div
                                key={agendamento.id}
                                className={cn(
                                  'flex items-center justify-between p-3 rounded-lg border',
                                  status.className
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-white/50 flex items-center justify-center">
                                    <Clock className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {agendamento.horario.horaInicio} -{' '}
                                      {agendamento.horario.horaFim}
                                    </p>
                                    {agendamento.observacao && (
                                      <p className="text-sm opacity-80">
                                        {agendamento.observacao}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn('gap-1', status.className)}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Nenhuma aula agendada
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
