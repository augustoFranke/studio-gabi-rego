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
import { formatCurrency } from "@/lib/currency"
import type { Pagamento } from "./types"

type DeletePagamentoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pagamentoToDelete: Pagamento | null
  deletingPagamento: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeletePagamentoDialog({
  open,
  onOpenChange,
  pagamentoToDelete,
  deletingPagamento,
  onCancel,
  onConfirm,
}: DeletePagamentoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar exclusão</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o pagamento de{" "}
            {pagamentoToDelete?.membro?.usuario?.nome
              ? <strong>{pagamentoToDelete.membro.usuario.nome}</strong>
              : pagamentoToDelete?.payerNome
                ? <strong>{pagamentoToDelete.payerNome}</strong>
                : "este pagador"}
            {" "}no valor de <strong>{pagamentoToDelete ? formatCurrency(pagamentoToDelete.valor) : ""}</strong>?
            Esta ação é <strong>permanente</strong> e não poderá ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={deletingPagamento}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deletingPagamento}
          >
            {deletingPagamento ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Excluindo…
              </>
            ) : (
              "Excluir permanentemente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
