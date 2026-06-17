import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TabsContent } from "@/components/ui/tabs"
import { CreditCard } from "lucide-react"
import { PLAN_THEMES } from "./plano-themes"
import { PlanoSection } from "./plano-card"
import { PlanoDialog, type PlanoForm } from "./plano-dialog"
import type { Plano } from "./types"

type GroupedPlanos = {
  planosGabi: Plano[]
  planosEstagiarios: Plano[]
  planosOutros: Plano[]
}

type PlanosTabProps = {
  planos: Plano[]
  groupedTodosPlanos: GroupedPlanos
  onEditPlano: (plano: Plano) => void
  onTogglePlanoAtivo: (plano: Plano) => void
  onDeletePlano: (plano: Plano) => void
  planoDialogOpen: boolean
  setPlanoDialogOpen: (open: boolean) => void
  editingPlano: Plano | null
  planoForm: PlanoForm
  setPlanoForm: React.Dispatch<React.SetStateAction<PlanoForm>>
  planoErrors: Record<string, string>
  setPlanoErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  submitting: boolean
  onNewPlano: () => void
  onSavePlano: () => void
}

export function PlanosTab({
  planos,
  groupedTodosPlanos,
  onEditPlano,
  onTogglePlanoAtivo,
  onDeletePlano,
  planoDialogOpen,
  setPlanoDialogOpen,
  editingPlano,
  planoForm,
  setPlanoForm,
  planoErrors,
  setPlanoErrors,
  submitting,
  onNewPlano,
  onSavePlano,
}: PlanosTabProps) {
  return (
    <TabsContent value="planos" className="space-y-4">
      <Card className="border-primary/10">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle>Planos</CardTitle>
                <CardDescription>
                  Configure os planos oferecidos pelo estúdio
                </CardDescription>
              </div>
            </div>
            <PlanoDialog
              open={planoDialogOpen}
              onOpenChange={setPlanoDialogOpen}
              editingPlano={editingPlano}
              planoForm={planoForm}
              setPlanoForm={setPlanoForm}
              planoErrors={planoErrors}
              setPlanoErrors={setPlanoErrors}
              submitting={submitting}
              onNew={onNewPlano}
              onSave={onSavePlano}
            />
          </div>
        </CardHeader>
        <CardContent>
          {planos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <CreditCard className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhum plano cadastrado. Clique em &quot;Novo Plano&quot; para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {PLAN_THEMES.map((theme) => {
                const planosDoGrupo = groupedTodosPlanos[theme.groupKey]
                if (planosDoGrupo.length === 0) return null
                return (
                  <PlanoSection
                    key={theme.key}
                    theme={theme}
                    planos={planosDoGrupo}
                    onEdit={onEditPlano}
                    onToggleAtivo={onTogglePlanoAtivo}
                    onDelete={onDeletePlano}
                  />
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
