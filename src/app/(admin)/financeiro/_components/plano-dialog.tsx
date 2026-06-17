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
import { Plus, Loader2 } from "lucide-react"
import type { Plano } from "./types"

export type PlanoForm = {
  nome: string
  descricao: string
  valor: string
  duracaoDias: string
  aulasSemanais: string
}

type PlanoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingPlano: Plano | null
  planoForm: PlanoForm
  setPlanoForm: React.Dispatch<React.SetStateAction<PlanoForm>>
  planoErrors: Record<string, string>
  setPlanoErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  submitting: boolean
  onNew: () => void
  onSave: () => void
}

export function PlanoDialog({
  open,
  onOpenChange,
  editingPlano,
  planoForm,
  setPlanoForm,
  planoErrors,
  setPlanoErrors,
  submitting,
  onNew,
  onSave,
}: PlanoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onNew} className="shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-shadow">
          <Plus className="mr-2 size-4" />
          Novo Plano
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingPlano ? "Editar Plano" : "Novo Plano"}
          </DialogTitle>
          <DialogDescription>
            {editingPlano
              ? "Atualize as informações do plano"
              : "Crie um novo plano para o estúdio"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="nome" className={planoErrors.nome ? "text-destructive" : ""}>
              Nome do Plano
            </Label>
            <Input
              id="nome"
              placeholder="Ex: Mensal 3x/semana"
              value={planoForm.nome}
              onChange={(e) => {
                setPlanoForm({ ...planoForm, nome: e.target.value })
                if (planoErrors.nome) {
                  setPlanoErrors({ ...planoErrors, nome: "" })
                }
              }}
              className={planoErrors.nome ? "border-destructive" : "border-input/50"}
            />
            {planoErrors.nome && (
              <p className="text-xs text-destructive">{planoErrors.nome}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              placeholder="Descrição do plano..."
              value={planoForm.descricao}
              onChange={(e) => setPlanoForm({ ...planoForm, descricao: e.target.value })}
              className="border-input/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="valor" className={planoErrors.valor ? "text-destructive" : ""}>
                Valor (R$)
              </Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={planoForm.valor}
                onChange={(e) => {
                  setPlanoForm({ ...planoForm, valor: e.target.value })
                  if (planoErrors.valor) {
                    setPlanoErrors({ ...planoErrors, valor: "" })
                  }
                }}
                className={planoErrors.valor ? "border-destructive" : "border-input/50"}
              />
              {planoErrors.valor && (
                <p className="text-xs text-destructive">{planoErrors.valor}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duracaoDias" className={planoErrors.duracaoDias ? "text-destructive" : ""}>
                Duração (dias)
              </Label>
              <Select
                value={planoForm.duracaoDias}
                onValueChange={(v) => {
                  setPlanoForm({ ...planoForm, duracaoDias: v })
                  if (planoErrors.duracaoDias) {
                    setPlanoErrors({ ...planoErrors, duracaoDias: "" })
                  }
                }}
              >
                <SelectTrigger className={planoErrors.duracaoDias ? "border-destructive" : "border-input/50"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Mensal (30 dias)</SelectItem>
                  <SelectItem value="90">Trimestral (90 dias)</SelectItem>
                  <SelectItem value="180">Semestral (180 dias)</SelectItem>
                  <SelectItem value="365">Anual (365 dias)</SelectItem>
                </SelectContent>
              </Select>
              {planoErrors.duracaoDias && (
                <p className="text-xs text-destructive">{planoErrors.duracaoDias}</p>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="aulasSemanais" className={planoErrors.aulasSemanais ? "text-destructive" : ""}>
              Aulas por Semana
            </Label>
            <Select
              value={planoForm.aulasSemanais}
              onValueChange={(v) => {
                setPlanoForm({ ...planoForm, aulasSemanais: v })
                if (planoErrors.aulasSemanais) {
                  setPlanoErrors({ ...planoErrors, aulasSemanais: "" })
                }
              }}
            >
              <SelectTrigger className={planoErrors.aulasSemanais ? "border-destructive" : "border-input/50"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 aula/semana</SelectItem>
                <SelectItem value="2">2 aulas/semana</SelectItem>
                <SelectItem value="3">3 aulas/semana</SelectItem>
                <SelectItem value="4">4 aulas/semana</SelectItem>
                <SelectItem value="5">5 aulas/semana</SelectItem>
                <SelectItem value="6">6 aulas/semana</SelectItem>
                <SelectItem value="7">Ilimitado</SelectItem>
              </SelectContent>
            </Select>
            {planoErrors.aulasSemanais && (
              <p className="text-xs text-destructive">{planoErrors.aulasSemanais}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={submitting} className="shadow-md shadow-primary/25">
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {editingPlano ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
