'use client'

import { useMemo, memo } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Check, X, Clock } from 'lucide-react'

interface MemberBadgeProps {
  nome: string
  fotoUrl?: string | null
  presente?: boolean | null
  isDragging?: boolean
  isDragOver?: boolean
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  draggable?: boolean
  compact?: boolean
}

const MemberBadgeBase = function MemberBadge({
  nome,
  fotoUrl,
  presente,
  isDragging,
  isDragOver,
  onClick,
  onDragStart,
  onDragEnd,
  draggable: draggableProp,
  compact: compactProp,
}: MemberBadgeProps) {
  // Hoisted out of the parameter list: React Compiler bails on destructuring
  // defaults, which would leave this component unmemoized.
  const draggable = draggableProp ?? false
  const compact = compactProp ?? false

  const initials = useMemo(() =>
    nome
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    , [nome])

  const presenceColor = useMemo(() => {
    if (presente === true) return 'bg-success/10 border-success/30'
    if (presente === false) return 'bg-destructive/10 border-destructive/30'
    return 'bg-background border-border'
  }, [presente])

  const firstName = useMemo(() => nome.split(' ')[0], [nome])
  const PresenceIcon = presente === true ? Check : presente === false ? X : Clock
  const presenceIconClassName =
    presente === true
      ? 'text-success'
      : presente === false
        ? 'text-destructive'
        : 'text-muted-foreground'

  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border transition-[opacity,transform,box-shadow]',
          presenceColor,
          isDragging && 'opacity-50 scale-95',
          isDragOver && 'ring-2 ring-primary',
          draggable && 'cursor-grab active:cursor-grabbing',
          onClick && 'cursor-pointer hover:bg-accent'
        )}
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <span className="truncate max-w-[80px]">{firstName}</span>
        <PresenceIcon className={cn('size-3', presenceIconClassName)} />
      </button>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-[opacity,transform,box-shadow]',
        presenceColor,
        isDragging && 'opacity-50 scale-95',
        isDragOver && 'ring-2 ring-primary',
        draggable && 'cursor-grab active:cursor-grabbing',
        onClick && 'cursor-pointer hover:bg-accent'
      )}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Avatar className="size-6">
        <AvatarImage src={fotoUrl || undefined} alt={nome} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm truncate max-w-[120px]">{nome}</span>
      <PresenceIcon className={cn('size-3', presenceIconClassName)} />
    </button>
  )
}

export const MemberBadge = memo(MemberBadgeBase)
