const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value
  return currencyFormatter.format(num)
}
