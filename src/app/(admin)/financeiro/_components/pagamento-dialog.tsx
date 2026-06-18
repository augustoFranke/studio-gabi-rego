import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select"
import { Plus, Loader2 } from "lucide-react"
import type { Pagamento, Plano } from "./types"

export type PagamentoForm = {
  membroId: string
  planoId: string
  valor: string
  dataVencimento: string
  formaPagamento: string
  observacao: string
}

type PagamentoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingPagamento: Pagamento | null
  pagamentoForm: PagamentoForm
  setPagamentoForm: React.Dispatch<React.SetStateAction<PagamentoForm>>
  pagamentoErrors: Record<string, string>
  setPagamentoErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  submitting: boolean
  planos: Plano[]
  pagamentoMembroOptions: SearchableSelectOption[]
  pagamentoPlanoOptions: SearchableSelectOption[]
  getMemberPlanDefaults: (memberId: string) => { planoId: string; valor: string }
  getMemberNextBillingDate: (memberId: string) => Promise<string | null>
  onNew: () => void
  onSave: () => void
}

export function PagamentoDialog({
  open,
  onOpenChange,
  editingPagamento,
  pagamentoForm,
  setPagamentoForm,
  pagamentoErrors,
  setPagamentoErrors,
  submitting,
  planos,
  pagamentoMembroOptions,
  pagamentoPlanoOptions,
  getMemberPlanDefaults,
  getMemberNextBillingDate,
  onNew,
  onSave,
}: PagamentoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onNew} className="shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-shadow">
          <Plus className="mr-2 size-4" />
          Novo Pagamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingPagamento ? "Editar Pagamento" : "Novo Pagamento"}
          </DialogTitle>
          <DialogDescription>
            {editingPagamento
              ? "Atualize as informações do pagamento"
              : "Registre um novo pagamento para um aluno"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="membro" className={pagamentoErrors.membroId ? "text-destructive" : ""}>
              Aluno
            </Label>
            <SearchableSelect
              value={pagamentoForm.membroId}
              onValueChange={(value) => {
                const defaults = getMemberPlanDefaults(value)
                setPagamentoForm((current) => ({
                  ...current,
                  membroId: value,
                  planoId: defaults.planoId,
                  valor: defaults.valor,
                }))
                if (pagamentoErrors.membroId) {
                  setPagamentoErrors({ ...pagamentoErrors, membroId: "" })
                }
                if (pagamentoErrors.planoId || pagamentoErrors.valor) {
                  setPagamentoErrors({ ...pagamentoErrors, planoId: "", valor: "" })
                }

                void getMemberNextBillingDate(value).then((nextBillingDate) => {
                  if (!nextBillingDate) {
                    return
                  }

                  setPagamentoForm((current) =>
                    current.membroId === value
                      ? { ...current, dataVencimento: nextBillingDate }
                      : current
                  )
                })
              }}
              options={pagamentoMembroOptions}
              placeholder="Selecione o aluno"
              searchPlaceholder="Buscar aluno..."
              emptyMessage="Nenhum aluno encontrado."
              disabled={submitting}
              className={pagamentoErrors.membroId ? "border-destructive" : "border-input/50"}
            />
            {pagamentoErrors.membroId && (
              <p className="text-xs text-destructive">{pagamentoErrors.membroId}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plano" className={pagamentoErrors.planoId ? "text-destructive" : ""}>
              Plano
            </Label>
            <SearchableSelect
              value={pagamentoForm.planoId}
              onValueChange={(value) => {
                const plano = planos.find((p) => p.id === value)
                setPagamentoForm({
                  ...pagamentoForm,
                  planoId: value,
                  valor: plano ? String(plano.valor) : pagamentoForm.valor,
                })
                if (pagamentoErrors.planoId) {
                  setPagamentoErrors({ ...pagamentoErrors, planoId: "", valor: "" })
                }
              }}
              options={pagamentoPlanoOptions}
              placeholder="Selecione o plano"
              searchPlaceholder="Buscar plano..."
              emptyMessage="Nenhum plano encontrado."
              disabled={submitting}
              className={pagamentoErrors.planoId ? "border-destructive" : "border-input/50"}
              renderOption={(option) => {
                const dotClass =
                  option.group === "Planos com Gabi"
                    ? "bg-amber-400"
                    : option.group === "Planos com Estagiários"
                      ? "bg-sky-400"
                      : option.group === "Outros Planos"
                        ? "bg-violet-400"
                        : null

                if (!dotClass) {
                  return option.label
                }

                return (
                  <span className="flex items-center gap-2">
                    <span className={`size-1.5 rounded-full ${dotClass}`} />
                    {option.label}
                  </span>
                )
              }}
            />
            {pagamentoErrors.planoId && (
              <p className="text-xs text-destructive">{pagamentoErrors.planoId}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="valor" className={pagamentoErrors.valor ? "text-destructive" : ""}>
                Valor
              </Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={pagamentoForm.valor}
                onChange={(e) => {
                  setPagamentoForm({ ...pagamentoForm, valor: e.target.value })
                  if (pagamentoErrors.valor) {
                    setPagamentoErrors({ ...pagamentoErrors, valor: "" })
                  }
                }}
                disabled={submitting}
                className={pagamentoErrors.valor ? "border-destructive" : "border-input/50"}
              />
              {pagamentoErrors.valor && (
                <p className="text-xs text-destructive">{pagamentoErrors.valor}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataVencimento" className={pagamentoErrors.dataVencimento ? "text-destructive" : ""}>
                Vencimento
              </Label>
              <Input
                id="dataVencimento"
                type="date"
                value={pagamentoForm.dataVencimento}
                onChange={(e) => {
                  setPagamentoForm({ ...pagamentoForm, dataVencimento: e.target.value })
                  if (pagamentoErrors.dataVencimento) {
                    setPagamentoErrors({ ...pagamentoErrors, dataVencimento: "" })
                  }
                }}
                disabled={submitting}
                className={pagamentoErrors.dataVencimento ? "border-destructive" : "border-input/50"}
              />
              {pagamentoErrors.dataVencimento && (
                <p className="text-xs text-destructive">{pagamentoErrors.dataVencimento}</p>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label
              htmlFor="formaPagamento"
              className={pagamentoErrors.formaPagamento ? "text-destructive" : ""}
            >
              Forma de Pagamento
            </Label>
            <Select
              value={pagamentoForm.formaPagamento}
              onValueChange={(v) => {
                setPagamentoForm({ ...pagamentoForm, formaPagamento: v })
                if (pagamentoErrors.formaPagamento) {
                  setPagamentoErrors({ ...pagamentoErrors, formaPagamento: "" })
                }
              }}
            >
              <SelectTrigger className={pagamentoErrors.formaPagamento ? "border-destructive" : "border-input/50"}>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
              </SelectContent>
            </Select>
            {pagamentoErrors.formaPagamento && (
              <p className="text-xs text-destructive">{pagamentoErrors.formaPagamento}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              placeholder="Observações sobre o pagamento..."
              value={pagamentoForm.observacao}
              onChange={(e) => setPagamentoForm({ ...pagamentoForm, observacao: e.target.value })}
              className="border-input/50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={submitting} className="shadow-md shadow-primary/25">
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {editingPagamento ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
