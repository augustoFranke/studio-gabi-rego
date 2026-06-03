'use client'

import { useCallback, memo } from 'react'
import { cn } from '@/lib/utils'
import { MemberBadge } from './member-badge'
import { TimeSlotPopover } from './time-slot-popover'
import { Plus, Users } from 'lucide-react'
import { getSlotCapacityInfo } from '@/lib/schedule'
import type { Agendamento } from '@/types/schedule'

interface TimeSlotProps {
  date?: Date
  hour: number
  agendamentos: Agendamento[]
  isEditable?: boolean
  onSlotClick?: (date: Date, hour: number) => void
  onMemberClick?: (agendamento: Agendamento) => void
  onDrop?: (date: Date, hour: number, agendamentoId: string) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  isDragOver?: boolean
  draggingId?: string | null
  onDragStart?: (agendamento: Agendamento) => void
  onDragEnd?: () => void
  compact?: boolean
}

const TimeSlotBase = function TimeSlot({
  date,
  hour,
  agendamentos,
  isEditable = false,
  onSlotClick,
  onMemberClick,
  onDrop,
  onDragOver,
  onDragLeave,
  isDragOver,
  draggingId,
  onDragStart,
  onDragEnd,
  compact = false,
}: TimeSlotProps) {
  const capacity = getSlotCapacityInfo(agendamentos.length)
  const hourLabel = `${hour.toString().padStart(2, '0')}:00`
  const capacityBackground = capacity.isFull
    ? 'bg-red-50/40 dark:bg-red-950/20'
    : 'bg-emerald-50/40 dark:bg-emerald-950/15'

  const handleDragStart = useCallback((agendamento: Agendamento) => (e: React.DragEvent) => {
    e.dataTransfer.setData('agendamentoId', agendamento.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.(agendamento)
  }, [onDragStart])

  const handleDragEnd = useCallback(() => {
    onDragEnd?.()
  }, [onDragEnd])

  const handleSlotClick = useCallback(() => {
    if (!date || !onSlotClick) return
    onSlotClick(date, hour)
  }, [date, hour, onSlotClick])

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!date || !onDrop) return
    e.preventDefault()
    const agendamentoId = e.dataTransfer.getData('agendamentoId')
    if (agendamentoId) {
      onDrop(date, hour, agendamentoId)
    }
  }, [date, hour, onDrop])

  if (compact) {
    return (
      <div
        className={cn(
          'min-h-[40px] p-1 border-b border-r last:border-r-0 transition-colors',
          capacityBackground,
          isDragOver && 'bg-primary/10',
        )}
        onDrop={handleDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {agendamentos.length > 0 ? (
          <div className="flex flex-wrap gap-0.5">
            {agendamentos.slice(0, 3).map((agendamento) => (
              <MemberBadge
                key={agendamento.id}
                nome={agendamento.membro.usuario.nome}
                fotoUrl={agendamento.membro.fotoUrl}
                presente={agendamento.presente}
                compact
                draggable={isEditable}
                isDragging={draggingId === agendamento.id}
                onClick={() => onMemberClick?.(agendamento)}
                onDragStart={handleDragStart(agendamento)}
                onDragEnd={handleDragEnd}
              />
            ))}
            {agendamentos.length > 3 && (
              <TimeSlotPopover
                hour={hour}
                agendamentos={agendamentos}
                onMemberClick={onMemberClick}
                disabled={isEditable}
              >
                <button
                  type="button"
                  className="text-xs text-muted-foreground px-1.5 py-0.5 hover:bg-accent rounded transition-colors flex items-center gap-0.5"
                >
                  <Users className="size-3" />
                  +{agendamentos.length - 3}
                </button>
              </TimeSlotPopover>
            )}
            {isEditable && (
              <button
                type="button"
                onClick={handleSlotClick}
                className="p-1 text-muted-foreground hover:bg-accent rounded border border-dashed border-muted-foreground/30 transition-colors flex items-center justify-center"
                aria-label="Adicionar agendamento"
              >
                <Plus className="size-3" />
              </button>
            )}
          </div>
        ) : (
          isEditable && (
            <button
              type="button"
              onClick={handleSlotClick}
              className="w-full h-full min-h-[32px] flex items-center justify-center text-muted-foreground hover:bg-accent rounded transition-colors"
            >
              <Plus className="size-3" />
            </button>
          )
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex border-b last:border-b-0 transition-colors',
        isDragOver && 'bg-primary/10'
      )}
      onDrop={handleDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="w-16 shrink-0 py-3 px-2 text-sm text-muted-foreground font-medium border-r bg-muted/30">
        {hourLabel}
      </div>

      <div
        className={cn(
          'flex-1 min-h-[60px] p-2',
          capacityBackground
        )}
      >
        {agendamentos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {agendamentos.map((agendamento) => (
              <MemberBadge
                key={agendamento.id}
                nome={agendamento.membro.usuario.nome}
                fotoUrl={agendamento.membro.fotoUrl}
                presente={agendamento.presente}
                draggable={isEditable}
                isDragging={draggingId === agendamento.id}
                onClick={() => onMemberClick?.(agendamento)}
                onDragStart={handleDragStart(agendamento)}
                onDragEnd={handleDragEnd}
              />
            ))}
            {isEditable && (
              <button
                type="button"
                onClick={handleSlotClick}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded border border-dashed border-muted-foreground/30 transition-colors"
              >
                <Plus className="size-3" />
                <span>Adicionar</span>
              </button>
            )}
          </div>
        ) : isEditable ? (
          <button
            type="button"
            onClick={handleSlotClick}
            className="w-full h-full min-h-[44px] flex items-center justify-center text-muted-foreground hover:bg-accent rounded-lg border-2 border-dashed border-muted-foreground/20 transition-colors"
          >
            <Plus className="size-4 mr-1" />
            <span className="text-sm">Adicionar</span>
          </button>
        ) : (
          <div className="w-full h-full min-h-[44px] flex items-center justify-center text-muted-foreground/50 text-sm">
            Sem agendamentos
          </div>
        )}
      </div>

      <TimeSlotPopover
        hour={hour}
        agendamentos={agendamentos}
        onMemberClick={onMemberClick}
        disabled={isEditable}
      >
        <button
          type="button"
          className={cn(
            'w-12 shrink-0 py-3 px-2 text-xs text-muted-foreground text-center border-l bg-muted/30 transition-colors',
            agendamentos.length > 0 && !isEditable && 'hover:bg-accent cursor-pointer'
          )}
          disabled={isEditable || agendamentos.length === 0}
        >
          <span
            className={cn(
              capacity.isFull && 'text-red-600 font-medium',
              capacity.percentage >= 70 && !capacity.isFull && 'text-yellow-600'
            )}
          >
            {agendamentos.length}/{capacity.total}
          </span>
        </button>
      </TimeSlotPopover>
    </div>
  )
}

export const TimeSlot = memo(TimeSlotBase)
