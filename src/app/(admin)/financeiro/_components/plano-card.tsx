import { memo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Calendar, Users } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { formatPlanoDuration } from "@/lib/planos"
import type { Plano } from "./types"
import type { PlanoTheme } from "./plano-themes"

type PlanoCardProps = {
  plano: Plano
  theme: PlanoTheme
  onEdit: (plano: Plano) => void
  onToggleAtivo: (plano: Plano) => void
  onDelete: (plano: Plano) => void
}

function PlanoCardComponent({ plano, theme, onEdit, onToggleAtivo, onDelete }: PlanoCardProps) {
  return (
    <Card className={`${!plano.ativo ? "opacity-60" : ""} ${theme.cardBorderBg}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className={`text-lg ${theme.titleColor}`}>{plano.nome}</CardTitle>
            {plano.descricao && (
              <CardDescription className="mt-1">
                {plano.descricao}
              </CardDescription>
            )}
          </div>
          {!plano.ativo && (
            <Badge variant="secondary">Inativo</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-2xl font-bold ${theme.valueColor}`}>
              {formatCurrency(plano.valor)}
            </span>
            <span className="text-sm text-muted-foreground">
              /{formatPlanoDuration(plano.duracaoDias)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className={`size-4 ${theme.iconColor}`} />
              {plano.aulasSemanais === 7 ? "Ilimitado" : `${plano.aulasSemanais}x/semana`}
            </div>
            <div className="flex items-center gap-1">
              <Users className={`size-4 ${theme.iconColor}`} />
              {plano._count?.membros || 0} alunos
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className={`flex-1 ${theme.buttonHover}`}
              onClick={() => onEdit(plano)}
            >
              <Pencil className="mr-2 size-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleAtivo(plano)}
              className={theme.buttonHover}
            >
              {plano.ativo ? "Desativar" : "Ativar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(plano)}
              className="hover:bg-destructive/10"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const PlanoCard = memo(PlanoCardComponent)

type PlanoSectionProps = {
  theme: PlanoTheme
  planos: Plano[]
  onEdit: (plano: Plano) => void
  onToggleAtivo: (plano: Plano) => void
  onDelete: (plano: Plano) => void
}

export function PlanoSection({ theme, planos, onEdit, onToggleAtivo, onDelete }: PlanoSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className={`size-8 rounded-full ${theme.iconGradient}`}>
          <span className="text-white text-sm font-bold">{theme.iconLetter}</span>
        </div>
        <div>
          <h3 className="font-semibold text-lg">{theme.title}</h3>
          <p className="text-xs text-muted-foreground">{theme.subtitle}</p>
        </div>
        <Badge className={theme.badgeGradient}>
          {planos.length} {planos.length === 1 ? 'plano' : 'planos'}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planos.map((plano) => (
          <PlanoCard
            key={plano.id}
            plano={plano}
            theme={theme}
            onEdit={onEdit}
            onToggleAtivo={onToggleAtivo}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
