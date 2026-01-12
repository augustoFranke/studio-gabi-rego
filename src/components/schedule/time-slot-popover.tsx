'use client'

import { useState } from 'react'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Check, X, Clock, Users } from 'lucide-react'
import type { Agendamento } from '@/types/schedule'
import { cn } from '@/lib/utils'

interface TimeSlotPopoverProps {
    hour: number
    agendamentos: Agendamento[]
    onMemberClick?: (agendamento: Agendamento) => void
    children: React.ReactNode
    disabled?: boolean
}

export function TimeSlotPopover({
    hour,
    agendamentos,
    onMemberClick,
    children,
    disabled = false,
}: TimeSlotPopoverProps) {
    const [open, setOpen] = useState(false)
    const hourLabel = `${hour.toString().padStart(2, '0')}:00`

    const getInitials = (nome: string) =>
        nome
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()

    const getPresenceStatus = (presente: boolean | null) => {
        if (presente === true) {
            return {
                icon: Check,
                color: 'text-green-600',
                bg: 'bg-green-100 dark:bg-green-900/30',
            }
        }
        if (presente === false) {
            return {
                icon: X,
                color: 'text-red-600',
                bg: 'bg-red-100 dark:bg-red-900/30',
            }
        }
        return {
            icon: Clock,
            color: 'text-gray-500',
            bg: 'bg-gray-100 dark:bg-gray-800',
        }
    }

    if (disabled || agendamentos.length === 0) {
        return <>{children}</>
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{hourLabel}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {agendamentos.length}
                    </Badge>
                </div>

                {/* Attendees list */}
                <div className="max-h-64 overflow-y-auto divide-y">
                    {agendamentos.map((agendamento) => {
                        const status = getPresenceStatus(agendamento.presente)
                        const StatusIcon = status.icon

                        return (
                            <button
                                key={agendamento.id}
                                onClick={() => {
                                    onMemberClick?.(agendamento)
                                    setOpen(false)
                                }}
                                className={cn(
                                    'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                                    'hover:bg-accent transition-colors',
                                    onMemberClick && 'cursor-pointer'
                                )}
                            >
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarImage src={agendamento.membro.fotoUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                        {getInitials(agendamento.membro.usuario.nome)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {agendamento.membro.usuario.nome}
                                    </p>
                                </div>
                                <div
                                    className={cn('p-1 rounded-full shrink-0', status.bg)}
                                >
                                    <StatusIcon className={cn('h-3 w-3', status.color)} />
                                </div>
                            </button>
                        )
                    })}
                </div>
            </PopoverContent>
        </Popover>
    )
}
