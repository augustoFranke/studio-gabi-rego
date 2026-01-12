'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

import { Check, X, Clock, Users } from 'lucide-react'
import {
    formatDateBR,
    formatWeekdayFull,
    HOURS,
} from '@/lib/schedule'
import type { Agendamento } from '@/types/schedule'
import { cn } from '@/lib/utils'

interface DayDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    date: Date
    agendamentos: Agendamento[]
    onMemberClick?: (agendamento: Agendamento) => void
}

export function DayDetailModal({
    open,
    onOpenChange,
    date,
    agendamentos,
    onMemberClick,
}: DayDetailModalProps) {
    // Group agendamentos by hour
    const agendamentosByHour = new Map<number, Agendamento[]>()
    for (const agendamento of agendamentos) {
        const hour = parseInt(agendamento.horario.horaInicio.split(':')[0], 10)
        if (!agendamentosByHour.has(hour)) {
            agendamentosByHour.set(hour, [])
        }
        agendamentosByHour.get(hour)!.push(agendamento)
    }

    // Get hours that have agendamentos
    const hoursWithAgendamentos = HOURS.filter((hour) =>
        agendamentosByHour.has(hour)
    )

    const getInitials = (nome: string) =>
        nome
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()

    const getPresenceStatus = (presente: boolean | null) => {
        if (presente === true) {
            return { icon: Check, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' }
        }
        if (presente === false) {
            return { icon: X, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' }
        }
        return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <span className="capitalize">{formatWeekdayFull(date)}</span>
                        <span className="text-muted-foreground font-normal">
                            {formatDateBR(date)}
                        </span>
                    </DialogTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                            {agendamentos.length} {agendamentos.length === 1 ? 'aula agendada' : 'aulas agendadas'}
                        </span>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
                    {hoursWithAgendamentos.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Nenhuma aula agendada para este dia</p>
                        </div>
                    ) : (
                        <div className="space-y-4 pb-4">
                            {hoursWithAgendamentos.map((hour) => {
                                const hourAgendamentos = agendamentosByHour.get(hour) || []
                                const hourLabel = `${hour.toString().padStart(2, '0')}:00`

                                return (
                                    <div
                                        key={hour}
                                        className="rounded-lg border bg-card overflow-hidden"
                                    >
                                        {/* Hour header */}
                                        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{hourLabel}</span>
                                            </div>
                                            <Badge variant="secondary" className="text-xs">
                                                {hourAgendamentos.length} {hourAgendamentos.length === 1 ? 'pessoa' : 'pessoas'}
                                            </Badge>
                                        </div>

                                        {/* Attendees list */}
                                        <div className="divide-y">
                                            {hourAgendamentos.map((agendamento) => {
                                                const status = getPresenceStatus(agendamento.presente)
                                                const StatusIcon = status.icon

                                                return (
                                                    <button
                                                        key={agendamento.id}
                                                        onClick={() => onMemberClick?.(agendamento)}
                                                        className={cn(
                                                            'w-full flex items-center gap-3 px-4 py-3 text-left',
                                                            'hover:bg-accent transition-colors',
                                                            onMemberClick && 'cursor-pointer'
                                                        )}
                                                    >
                                                        <Avatar className="h-10 w-10 shrink-0">
                                                            <AvatarImage
                                                                src={agendamento.membro.fotoUrl || undefined}
                                                            />
                                                            <AvatarFallback>
                                                                {getInitials(agendamento.membro.usuario.nome)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium truncate">
                                                                {agendamento.membro.usuario.nome}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {agendamento.horario.horaInicio} - {agendamento.horario.horaFim}
                                                            </p>
                                                        </div>
                                                        <div
                                                            className={cn(
                                                                'p-1.5 rounded-full shrink-0',
                                                                status.bg
                                                            )}
                                                        >
                                                            <StatusIcon className={cn('h-4 w-4', status.color)} />
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
