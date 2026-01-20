'use client'

import { useState, useTransition } from "react"
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Send, Trash2 } from "lucide-react"
import { toggleMembroStatus, enviarLembreteBoasVindas, deleteMembro } from "@/app/actions/membros"
import { toast } from "sonner"

interface MemberActionsProps {
  id: string
  status: string
  nome?: string
}

export function MemberStatusToggle({ id, status, nome }: MemberActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const isActive = status === 'ATIVO'

  const handleClick = () => {
    if (isActive) {
      setShowConfirmDialog(true)
    } else {
      handleActivate()
    }
  }

  const handleActivate = () => {
    startTransition(async () => {
      const result = await toggleMembroStatus(id, status)
      if (result.success) {
        toast.success("Membro ativado")
      } else {
        toast.error(result.error || "Erro ao alterar status")
      }
    })
  }

  const handleConfirmDelete = () => {
    startTransition(async () => {
      const result = await deleteMembro(id)
      if (result.success) {
        toast.success("Membro excluído permanentemente")
        setShowConfirmDialog(false)
      } else {
        toast.error(result.error || "Erro ao excluir membro")
      }
    })
  }

  return (
    <>
      <DropdownMenuItem onClick={handleClick} disabled={isPending}>
        {isActive ? (
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </>
        ) : (
          <>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Ativar
          </>
        )}
      </DropdownMenuItem>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {nome ? <strong>{nome}</strong> : "este membro"}?
              Esta ação é <strong>permanente</strong> e irá remover todos os dados do membro,
              incluindo agendamentos, pagamentos, treinos e anamnese.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isPending}
            >
              {isPending ? "Excluindo..." : "Excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function SendMemberReminder({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  const handleSend = () => {
    startTransition(async () => {
      const result = await enviarLembreteBoasVindas(id)
      if (result.success) {
        toast.success("Boas-vindas enviada com sucesso!")
      } else {
        toast.error(result.error || "Erro ao enviar lembrete")
      }
    })
  }

  return (
    <DropdownMenuItem onClick={handleSend} disabled={isPending}>
      <Send className="mr-2 h-4 w-4" />
      Enviar Boas-vindas
    </DropdownMenuItem>
  )
}

