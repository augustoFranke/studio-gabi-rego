import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { Pencil, Trash2, CreditCard, Check, Clock, AlertCircle, XCircle } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { formatDateBR, parseDateFromAPI } from "@/lib/schedule"
import type { Pagamento } from "./types"

function formatDate(date: string): string {
  return formatDateBR(parseDateFromAPI(date))
}

function getStatusBadge(status: Pagamento["status"]) {
  const variants: Record<Pagamento["status"], { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
    PAGO: { variant: "default", icon: <Check className="size-3" />, label: "Pago" },
    PENDENTE: { variant: "secondary", icon: <Clock className="size-3" />, label: "Pendente" },
    ATRASADO: { variant: "destructive", icon: <AlertCircle className="size-3" />, label: "Atrasado" },
    CANCELADO: { variant: "outline", icon: <XCircle className="size-3" />, label: "Cancelado" },
  }
  const { variant, icon, label } = variants[status]
  return (
    <Badge variant={variant} className={`gap-1 ${variant === 'default' ? 'bg-primary' : ''}`}>
      {icon}
      {label}
    </Badge>
  )
}

type PagamentoRowProps = {
  pagamento: Pagamento
  onEdit: (pagamento: Pagamento) => void
  onUpdateStatus: (pagamento: Pagamento, newStatus: Pagamento["status"]) => void
  onDelete: (pagamento: Pagamento) => void
}

function PagamentoRowComponent({ pagamento, onEdit, onUpdateStatus, onDelete }: PagamentoRowProps) {
  return (
    <TableRow className="hover:bg-primary/5">
      <TableCell className="font-medium">
        {pagamento.membro?.usuario?.nome || pagamento.payerNome || "Sem vinculo"}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="flex items-center w-fit border-primary/30 text-primary">
          <CreditCard className="mr-1 size-3" />
          {pagamento.plano.nome}
        </Badge>
      </TableCell>
      <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
      <TableCell>{formatDate(pagamento.dataVencimento)}</TableCell>
      <TableCell>{getStatusBadge(pagamento.status)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {pagamento.status === "PENDENTE" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateStatus(pagamento, "PAGO")}
              title="Marcar como pago"
              className="hover:bg-primary/10 hover:text-primary"
            >
              <Check className="size-4 text-primary" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(pagamento)}
            className="hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(pagamento)}
            className="hover:bg-destructive/10"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export const PagamentoRow = memo(PagamentoRowComponent)
