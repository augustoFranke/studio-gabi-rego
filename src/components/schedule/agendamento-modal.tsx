'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trash2, Loader2 } from 'lucide-react'
import { formatDateBR, formatHour, parseDateFromAPI, HOURS } from '@/lib/schedule'
import type { Agendamento, Membro } from '@/types/schedule'

interface AgendamentoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agendamento?: Agendamento | null
  membros?: Membro[]
  selectedDate?: Date
  selectedHour?: number
  mode: 'view' | 'edit' | 'create'
  onSave?: (data: {
    membroId?: string
    horarioId?: string
    data?: string
    hour?: number
    observacao?: string
  }) => void
  onDelete?: () => void
  isLoading?: boolean
}

export function AgendamentoModal({
  open,
  onOpenChange,
  agendamento,
  membros = [],
  selectedDate,
  selectedHour,
  mode,
  onSave,
  onDelete,
  isLoading = false,
}: AgendamentoModalProps) {
  const [selectedMembro, setSelectedMembro] = useState<string>(agendamento?.membroId || '')
  const [selectedHourValue, setSelectedHourValue] = useState<string>(
    agendamento?.horario.horaInicio.split(':')[0] || selectedHour?.toString() || ''
  )
  const [observacao, setObservacao] = useState(agendamento?.observacao || '')

  const handleSave = () => {
    if (mode === 'create') {
      onSave?.({
        membroId: selectedMembro,
        data: selectedDate?.toISOString(),
        hour: selectedHourValue ? Number(selectedHourValue) : undefined,
      })
    } else {
      onSave?.({
        observacao,
      })
    }
  }

  const getInitials = (nome: string) =>
    nome
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

  const renderViewMode = () => {
    if (!agendamento) return null

    return (
      <>
        <DialogHeader>
          <DialogTitle>Detalhes do Agendamento</DialogTitle>
          <DialogDescription>
            {formatDateBR(parseDateFromAPI(agendamento.data))} -{' '}
            {agendamento.horario.horaInicio}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarImage src={agendamento.membro.fotoUrl || undefined} />
              <AvatarFallback>
                {getInitials(agendamento.membro.usuario.nome)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{agendamento.membro.usuario.nome}</p>
            </div>
          </div>

          {/* Observation */}
          {agendamento.observacao && (
            <div>
              <Label className="text-muted-foreground">Observação</Label>
              <p className="text-sm mt-1">{agendamento.observacao}</p>
            </div>
          )}
        </div>
      </>
    )
  }

  const renderEditMode = () => {
    if (!agendamento) return null

    return (
      <>
        <DialogHeader>
          <DialogTitle>Editar Agendamento</DialogTitle>
          <DialogDescription>
            {agendamento.membro.usuario.nome} -{' '}
            {formatDateBR(parseDateFromAPI(agendamento.data))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Observation */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Adicione uma observação..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remover
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </>
    )
  }

  const renderCreateMode = () => {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            {selectedDate && formatDateBR(selectedDate)}
            {selectedHour !== undefined && ` - ${formatHour(selectedHour)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member selection */}
          <div className="space-y-2">
            <Label htmlFor="membro">Membro</Label>
            <Select value={selectedMembro} onValueChange={setSelectedMembro}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                {membros.map((membro) => (
                  <SelectItem key={membro.id} value={membro.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={membro.fotoUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(membro.usuario.nome)}
                        </AvatarFallback>
                      </Avatar>
                      {membro.usuario.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hour selection */}
          <div className="space-y-2">
            <Label htmlFor="hora">Horário</Label>
            <Select
              value={selectedHourValue}
              onValueChange={setSelectedHourValue}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um horário" />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !selectedMembro || !selectedHourValue}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </>
    )
  }

  const dialogKey = mode === 'create'
    ? `create-${selectedDate?.toISOString() ?? 'no-date'}-${selectedHour ?? 'no-hour'}`
    : agendamento?.id || 'view'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={dialogKey}>
        {mode === 'view' && renderViewMode()}
        {mode === 'edit' && renderEditMode()}
        {mode === 'create' && renderCreateMode()}
      </DialogContent>
    </Dialog>
  )
}
