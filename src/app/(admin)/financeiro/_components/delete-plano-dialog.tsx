import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import type { Plano } from "./types"

type DeletePlanoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  planoToDelete: Plano | null
  deletingPlano: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeletePlanoDialog({
  open,
  onOpenChange,
  planoToDelete,
  deletingPlano,
  onCancel,
  onConfirm,
}: DeletePlanoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover plano</DialogTitle>
          <DialogDescription>
            O plano <strong>{planoToDelete?.nome ?? "selecionado"}</strong> será
            desativado se ainda houver alunos ativos ou pagamentos registrados nele,
            e nesse caso você poderá reativá-lo depois. Se não houver nenhum, ele
            será removido permanentemente e não poderá ser recuperado.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={deletingPlano}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deletingPlano}>
            {deletingPlano ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Removendo…
              </>
            ) : (
              "Remover plano"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
