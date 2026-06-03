"use client"

import { Suspense, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { groupPlansByCategory } from "@/lib/planos"
import { cn } from "@/lib/utils"

interface PlanoOption {
  id: string
  nome: string
}

interface AlunosFiltersProps {
  search?: string
  status?: string
  plano?: string
  order?: string
  planos: PlanoOption[]
}

function AlunosFiltersContent({ search, status, plano, order, planos }: AlunosFiltersProps) {
  const { push } = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(search ?? "")
  const [statusValue, setStatusValue] = useState(status ?? "todos")
  const [planoValue, setPlanoValue] = useState(plano ?? "todos")
  const [orderValue, setOrderValue] = useState(order ?? "recent_desc")

  const groupedPlanos = useMemo(() => groupPlansByCategory(planos), [planos])

  const planoOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: "todos", label: "Todos Planos", keywords: ["todos"] },
      ...groupedPlanos.planosGabi.map((plano) => ({
        value: plano.id,
        label: plano.nome,
        group: "Gabi",
      })),
      ...groupedPlanos.planosEstagiarios.map((plano) => ({
        value: plano.id,
        label: plano.nome,
        group: "Estagiários",
      })),
      ...groupedPlanos.planosOutros.map((plano) => ({
        value: plano.id,
        label: plano.nome,
        group: "Outros",
      })),
    ],
    [groupedPlanos]
  )

  const buildQuery = useCallback((values: { search: string; status: string; plano: string; order: string }) => {
    const params = new URLSearchParams()
    let hasFilters = false
    if (values.search.trim()) params.set("search", values.search.trim())
    if (values.search.trim()) hasFilters = true
    if (values.status && values.status !== "todos") {
      params.set("status", values.status)
      hasFilters = true
    }
    if (values.plano && values.plano !== "todos") {
      params.set("plano", values.plano)
      hasFilters = true
    }
    if (values.order && values.order !== "recent_desc") {
      params.set("order", values.order)
      hasFilters = true
    }
    if (hasFilters) {
      params.set("page", "1")
    }
    return params.toString()
  }, [])

  const applyFilters = useCallback((values: { search: string; status: string; plano: string; order: string }) => {
    const nextQuery = buildQuery(values)
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) {
      return
    }
    push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }, [buildQuery, pathname, push, searchParams])
  const applyFiltersEvent = useEffectEvent(applyFilters)

  useEffect(() => {
    const currentSearch = searchParams.get("search") ?? ""
    const currentStatus = searchParams.get("status") ?? "todos"
    const currentPlano = searchParams.get("plano") ?? "todos"
    const currentOrder = searchParams.get("order") ?? "recent_desc"
    const nextSearch = searchValue.trim()

    const filtersChanged =
      currentSearch !== nextSearch ||
      currentStatus !== statusValue ||
      currentPlano !== planoValue ||
      currentOrder !== orderValue

    if (!filtersChanged) {
      return
    }

    const timer = setTimeout(() => {
      applyFiltersEvent({ search: nextSearch, status: statusValue, plano: planoValue, order: orderValue })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchParams, orderValue, planoValue, searchValue, statusValue])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full md:w-64">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          name="search"
          placeholder="Nome, CPF ou Email..."
          className="pl-8 border-input/50 focus:border-primary"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </div>

      <Select
        value={statusValue}
        onValueChange={(value) => {
          setStatusValue(value)
        }}
      >
        <SelectTrigger className="w-[140px] border-input/50">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos Status</SelectItem>
          <SelectItem value="ATIVO">Ativos</SelectItem>
          <SelectItem value="INATIVO">Inativos</SelectItem>
          <SelectItem value="PENDENTE">Pendentes</SelectItem>
        </SelectContent>
      </Select>

      <SearchableSelect
        value={planoValue}
        onValueChange={setPlanoValue}
        options={planoOptions}
        placeholder="Plano"
        searchPlaceholder="Buscar plano..."
        emptyMessage="Nenhum plano encontrado."
        className="w-[220px] border-input/50"
        renderOption={(option) => {
          const dotClass =
            option.group === "Gabi"
              ? "bg-amber-400"
              : option.group === "Estagiários"
                ? "bg-sky-400"
                : option.group === "Outros"
                  ? "bg-violet-400"
                  : null

          if (!dotClass) {
            return option.label
          }

          return (
            <span className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full", dotClass)} />
              {option.label}
            </span>
          )
        }}
      />

      <Select
        value={orderValue}
        onValueChange={(value) => {
          setOrderValue(value)
        }}
      >
        <SelectTrigger className="w-[200px] border-input/50">
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nome_asc">Nome (A-Z)</SelectItem>
          <SelectItem value="recent_desc">Mais recentes</SelectItem>
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="secondary"
        className="hover:bg-primary/10 hover:text-primary"
        onClick={() => applyFilters({ search: searchValue, status: statusValue, plano: planoValue, order: orderValue })}
      >
        Filtrar
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="hover:text-primary"
        onClick={() => push(pathname)}
      >
        Limpar
      </Button>
    </div>
  )
}

export function AlunosFilters(props: AlunosFiltersProps) {
  return (
    <Suspense>
      <AlunosFiltersContent {...props} />
    </Suspense>
  )
}
