import { sortByNomePtBr } from "@/lib/select-options"

export type PlanoNome = { nome: string }

export function groupPlansByCategory<T extends PlanoNome>(planos: T[]) {
  const planosGabi: T[] = []
  const planosEstagiarios: T[] = []
  const planosOutros: T[] = []

  for (const plano of planos) {
    const nome = plano.nome.toLowerCase()
    const isGabi = /gabi/.test(nome)
    const isEstagiario = /estagiário|estagiarios/.test(nome)

    if (isGabi) {
      planosGabi.push(plano)
    } else if (isEstagiario) {
      planosEstagiarios.push(plano)
    } else {
      planosOutros.push(plano)
    }
  }

  return {
    planosGabi: sortByNomePtBr(planosGabi),
    planosEstagiarios: sortByNomePtBr(planosEstagiarios),
    planosOutros: sortByNomePtBr(planosOutros),
  }
}

export function formatPlanoDuration(duracaoDias: number): string {
  if (duracaoDias === 30) return "mês"
  if (duracaoDias === 90) return "trimestre"
  if (duracaoDias === 180) return "semestre"
  return "ano"
}
