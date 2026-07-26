import { AlertCircle, Check, Clock, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export type PagamentoStatus = "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO"
export type MembroStatus = "ATIVO" | "INATIVO" | "PENDENTE"

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"]

// Settled, awaiting, and failed states must not share the brand accent, or a
// paid row reads the same as an overdue one at a glance. CANCELADO is inert
// rather than failed, so it stays neutral instead of destructive.
const PAGAMENTO_STATUS: Record<
  PagamentoStatus,
  { variant: BadgeVariant; icon: React.ReactNode; label: string }
> = {
  PAGO: { variant: "success", icon: <Check />, label: "Pago" },
  PENDENTE: { variant: "warning", icon: <Clock />, label: "Pendente" },
  ATRASADO: { variant: "destructive", icon: <AlertCircle />, label: "Atrasado" },
  CANCELADO: { variant: "muted", icon: <XCircle />, label: "Cancelado" },
}

// INATIVO is a deliberate archival state, not an error, so it reads neutral.
const MEMBRO_STATUS: Record<MembroStatus, { variant: BadgeVariant; label: string }> = {
  ATIVO: { variant: "success", label: "Ativo" },
  INATIVO: { variant: "muted", label: "Inativo" },
  PENDENTE: { variant: "warning", label: "Pendente" },
}

export function PagamentoStatusBadge({
  status,
  className,
}: {
  status: PagamentoStatus
  className?: string
}) {
  const { variant, icon, label } = PAGAMENTO_STATUS[status]
  return (
    <Badge variant={variant} className={className}>
      {icon}
      {label}
    </Badge>
  )
}

export function MembroStatusBadge({
  status,
  className,
}: {
  status: MembroStatus
  className?: string
}) {
  const { variant, label } = MEMBRO_STATUS[status]
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
