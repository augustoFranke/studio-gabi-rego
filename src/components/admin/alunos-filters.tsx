"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { groupPlansByCategory } from "@/lib/planos"

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

type FilterValues = {
  search: string
  status: string
  plano: string
  order: string
}

const DEFAULT_FILTERS: FilterValues = {
  search: "",
  status: "todos",
  plano: "todos",
  order: "recent_desc",
}

function useUrlSyncFilters(initial: FilterValues) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState(initial)

  const buildQuery = useCallback((values: FilterValues) => {
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

  const applyFilters = useCallback((values: FilterValues) => {
    const nextQuery = buildQuery(values)
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) {
      return
    }
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }, [buildQuery, pathname, router, searchParams])

  useEffect(() => {
    const currentSearch = searchParams.get("search") ?? ""
    const currentStatus = searchParams.get("status") ?? "todos"
    const currentPlano = searchParams.get("plano") ?? "todos"
    const currentOrder = searchParams.get("order") ?? "recent_desc"
    const nextSearch = filters.search.trim()

    const filtersChanged =
      currentSearch !== nextSearch ||
      currentStatus !== filters.status ||
      currentPlano !== filters.plano ||
      currentOrder !== filters.order

    if (!filtersChanged) {
      return
    }

    const timer = setTimeout(() => {
      applyFilters({
        search: nextSearch,
        status: filters.status,
        plano: filters.plano,
        order: filters.order,
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [applyFilters, filters, searchParams])

  const clearFilters = useCallback(() => {
    router.push(pathname)
  }, [pathname, router])

  return { filters, setFilters, applyFilters, clearFilters }
}

export function AlunosFilters({ search, status, plano, order, planos }: AlunosFiltersProps) {
  const { filters, setFilters, applyFilters, clearFilters } = useUrlSyncFilters({
    ...DEFAULT_FILTERS,
    search: search ?? DEFAULT_FILTERS.search,
    status: status ?? DEFAULT_FILTERS.status,
    plano: plano ?? DEFAULT_FILTERS.plano,
    order: order ?? DEFAULT_FILTERS.order,
  })

  const groupedPlanos = useMemo(() => groupPlansByCategory(planos), [planos])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full md:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          name="search"
          placeholder="Nome, CPF ou Email..."
          className="pl-8 border-input/50 focus:border-primary"
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(value) => {
          setFilters((prev) => ({ ...prev, status: value }))
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

      <Select
        value={filters.plano}
        onValueChange={(value) => {
          setFilters((prev) => ({ ...prev, plano: value }))
        }}
      >
        <SelectTrigger className="w-[220px] border-input/50">
          <SelectValue placeholder="Plano" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos Planos</SelectItem>
          {groupedPlanos.planosGabi.length > 0 && (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                Gabi
              </SelectLabel>
              {groupedPlanos.planosGabi.map((p) => (
                <SelectItem key={p.id} value={p.id} className="pl-6">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                    {p.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {groupedPlanos.planosEstagiarios.length > 0 && (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                Estagiários
              </SelectLabel>
              {groupedPlanos.planosEstagiarios.map((p) => (
                <SelectItem key={p.id} value={p.id} className="pl-6">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                    {p.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {groupedPlanos.planosOutros.length > 0 && (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-violet-500"></span>
                Outros
              </SelectLabel>
              {groupedPlanos.planosOutros.map((p) => (
                <SelectItem key={p.id} value={p.id} className="pl-6">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                    {p.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      <Select
        value={filters.order}
        onValueChange={(value) => {
          setFilters((prev) => ({ ...prev, order: value }))
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
        onClick={() => applyFilters(filters)}
      >
        Filtrar
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="hover:text-primary"
        onClick={clearFilters}
      >
        Limpar
      </Button>
    </div>
  )
}
