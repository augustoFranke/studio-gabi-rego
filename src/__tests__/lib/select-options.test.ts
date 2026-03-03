import { describe, expect, it } from "vitest"
import { groupPlansByCategory } from "@/lib/planos"
import { sortByLabelPtBr, sortByTextPtBr } from "@/lib/select-options"

describe("select option helpers", () => {
  it("sorts labels using pt-BR alphabetical rules", () => {
    const sorted = sortByLabelPtBr([
      { value: "1", label: "Zeta" },
      { value: "2", label: "árvore" },
      { value: "3", label: "Banana" },
      { value: "4", label: "Abacate" },
    ])

    expect(sorted.map((option) => option.label)).toEqual([
      "Abacate",
      "árvore",
      "Banana",
      "Zeta",
    ])
  })

  it("keeps original order for exact duplicate labels", () => {
    const sorted = sortByLabelPtBr([
      { id: "a", label: "Plano A" },
      { id: "b", label: "Plano A" },
      { id: "c", label: "Plano B" },
    ])

    expect(sorted.map((option) => option.id)).toEqual(["a", "b", "c"])
  })

  it("sorts by custom text selector", () => {
    const sorted = sortByTextPtBr(
      [
        { id: "3", usuario: { nome: "Carlos" } },
        { id: "1", usuario: { nome: "Ana" } },
        { id: "2", usuario: { nome: "Bruna" } },
      ],
      (item) => item.usuario.nome
    )

    expect(sorted.map((item) => item.id)).toEqual(["1", "2", "3"])
  })

  it("groups plans by category and sorts each category alphabetically", () => {
    const grouped = groupPlansByCategory([
      { id: "3", nome: "Gabi Intensivo" },
      { id: "1", nome: "Estagiário Avançado" },
      { id: "2", nome: "Gabi Básico" },
      { id: "4", nome: "Pilates Livre" },
      { id: "5", nome: "Estagiário Básico" },
    ])

    expect(grouped.planosGabi.map((plano) => plano.nome)).toEqual([
      "Gabi Básico",
      "Gabi Intensivo",
    ])
    expect(grouped.planosEstagiarios.map((plano) => plano.nome)).toEqual([
      "Estagiário Avançado",
      "Estagiário Básico",
    ])
    expect(grouped.planosOutros.map((plano) => plano.nome)).toEqual([
      "Pilates Livre",
    ])
  })
})
