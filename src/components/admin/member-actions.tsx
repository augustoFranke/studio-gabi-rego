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
import { ShieldCheck, UserMinus } from "lucide-react"
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
        toast.error(result.message || "Erro ao alterar status")
      }
    })
  }

  const handleConfirmDelete = () => {
    startTransition(async () => {
      const result = await deleteMembro(id)
      if (result.success) {
        toast.success("Aluno inativado")
        setShowConfirmDialog(false)
        router.refresh()
      } else {
        toast.error(result.message || "Erro ao inativar aluno")
      }
    })
  }

  return (
    <>
      <DropdownMenuItem onSelect={handleSelect} disabled={isPending}>
        {isActive ? (
          <>
            <UserMinus className="mr-2 h-4 w-4" />
            Inativar
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
            <DialogTitle>Confirmar inativação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja inativar {nome ? <strong>{nome}</strong> : "este aluno"}?
              Os dados do aluno serão preservados para histórico e auditoria.
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
              {isPending ? "Inativando..." : "Inativar aluno"}
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
        toast.success("Aluno inativado")
        router.refresh()
      } else {
        toast.error(result.message || "Erro ao inativar aluno")
      }
    })
  }

  return (
    <DropdownMenuItem onSelect={handleDeactivate} disabled={disabled || isPending}>
      <UserMinus className="mr-2 h-4 w-4" />
      {isPending ? "Inativando..." : "Inativar"}
    </DropdownMenuItem>
  )
}
