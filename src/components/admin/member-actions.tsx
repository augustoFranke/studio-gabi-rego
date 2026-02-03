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
import { ShieldCheck, Trash2, UserMinus } from "lucide-react"
import { useRouter } from "next/navigation"
import { deactivateMembro, deleteMembro, toggleMembroStatus } from "@/app/actions/membros"
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
  const router = useRouter()

  const handleSelect = (e: Event) => {
    if (isActive) {
      e.preventDefault()
      setShowConfirmDialog(true)
    } else {
      handleActivate()
    }
  }

  const handleActivate = () => {
    startTransition(async () => {
      const result = await toggleMembroStatus(id, status)
      if (result.success) {
        toast.success("Aluno ativado")
        router.refresh()
      } else {
        toast.error(result.error || "Erro ao alterar status")
      }
    })
  }

  const handleConfirmDelete = () => {
    startTransition(async () => {
      const result = await deleteMembro(id)
      if (result.success) {
        toast.success("Aluno excluído permanentemente")
        setShowConfirmDialog(false)
        router.refresh()
      } else {
        toast.error(result.error || "Erro ao excluir aluno")
      }
    })
  }

  return (
    <>
      <DropdownMenuItem onSelect={handleSelect} disabled={isPending}>
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
              Tem certeza que deseja excluir {nome ? <strong>{nome}</strong> : "este aluno"}?
              Esta ação é <strong>permanente</strong> e irá remover todos os dados do aluno,
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

export function MemberDeactivateItem({
  id,
  nome,
  disabled = false,
}: {
  id: string
  nome?: string
  disabled?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDeactivate = (event: Event) => {
    if (disabled || isPending) {
      event.preventDefault()
      return
    }

    const label = nome ? `o aluno "${nome}"` : "este aluno"
    if (!window.confirm(`Deseja desativar ${label}?`)) {
      event.preventDefault()
      return
    }

    startTransition(async () => {
      const result = await deactivateMembro(id)
      if (result.success) {
        toast.success("Aluno desativado")
        router.refresh()
      } else {
        toast.error(result.error || "Erro ao desativar aluno")
      }
    })
  }

  return (
    <DropdownMenuItem onSelect={handleDeactivate} disabled={disabled || isPending}>
      <UserMinus className="mr-2 h-4 w-4" />
      {isPending ? "Desativando..." : "Desativar"}
    </DropdownMenuItem>
  )
}
