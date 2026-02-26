const PT_BR_COLLATOR = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
  usage: "sort",
})

function comparePtBrText(left: string, right: string) {
  const baseComparison = PT_BR_COLLATOR.compare(left, right)

  if (baseComparison !== 0) {
    return baseComparison
  }

  return left.localeCompare(right, "pt-BR", {
    numeric: true,
    sensitivity: "variant",
  })
}

export function sortByTextPtBr<T>(
  items: readonly T[],
  getLabel: (item: T) => string
) {
  return items
    .map((item, index) => ({ index, item }))
    .sort((left, right) => {
      const labelComparison = comparePtBrText(
        getLabel(left.item),
        getLabel(right.item)
      )

      if (labelComparison !== 0) {
        return labelComparison
      }

      return left.index - right.index
    })
    .map(({ item }) => item)
}

export function sortByLabelPtBr<T extends { label: string }>(items: readonly T[]) {
  return sortByTextPtBr(items, (item) => item.label)
}

export function sortByNomePtBr<T extends { nome: string }>(items: readonly T[]) {
  return sortByTextPtBr(items, (item) => item.nome)
}
