import { sortByNomePtBr } from "@/lib/select-options"

export type PlanoNome = { nome: string }

export function groupPlansByCategory<T extends PlanoNome>(planos: T[]) {
  const planosGabi: T[] = []
  const planosEstagiarios: T[] = []
  const planosOutros: T[] = []

  for (const plano of planos) {
    const nome = plano.nome.toLowerCase()
    const isGabi = nome.includes('gabi')
    const isEstagiario = nome.includes('estagiário') || nome.includes('estagiarios')

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
