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
  draggable = false,
  compact = false,
}: MemberBadgeProps) {
  const initials = useMemo(() =>
    nome
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    , [nome])

  const presenceIcon = useMemo(() => {
    if (presente === true) {
      return <Check className="h-3 w-3 text-green-600" />
    }
    if (presente === false) {
      return <X className="h-3 w-3 text-red-600" />
    }
    return <Clock className="h-3 w-3 text-muted-foreground" />
  }, [presente])

  const presenceColor = useMemo(() => {
    if (presente === true) return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
    if (presente === false) return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
    return 'bg-background border-border'
  }, [presente])

  const firstName = useMemo(() => nome.split(' ')[0], [nome])

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border transition-all',
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
        {presenceIcon}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all',
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
      <Avatar className="h-6 w-6">
        <AvatarImage src={fotoUrl || undefined} alt={nome} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm truncate max-w-[120px]">{nome}</span>
      {presenceIcon}
    </div>
  )
}

export const MemberBadge = memo(MemberBadgeBase)

