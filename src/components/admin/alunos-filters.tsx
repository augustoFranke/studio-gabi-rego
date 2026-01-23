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

export function AlunosFilters({ search, status, plano, order, planos }: AlunosFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(search ?? "")
  const [statusValue, setStatusValue] = useState(status ?? "todos")
  const [planoValue, setPlanoValue] = useState(plano ?? "todos")
  const [orderValue, setOrderValue] = useState(order ?? "recent_desc")

  const groupedPlanos = useMemo(() => {
    const planosGabi = planos.filter(p => p.nome.toLowerCase().includes("gabi"))
    const planosEstagiarios = planos.filter(p => p.nome.toLowerCase().includes("estagiário") || p.nome.toLowerCase().includes("estagiarios"))
    const planosOutros = planos.filter(p => !p.nome.toLowerCase().includes("gabi") && !p.nome.toLowerCase().includes("estagiário") && !p.nome.toLowerCase().includes("estagiarios"))

    return { planosGabi, planosEstagiarios, planosOutros }
  }, [planos])

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
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }, [buildQuery, pathname, router, searchParams])

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
      applyFilters({ search: nextSearch, status: statusValue, plano: planoValue, order: orderValue })
    }, 300)
    return () => clearTimeout(timer)
  }, [applyFilters, orderValue, planoValue, searchParams, searchValue, statusValue])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full md:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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

      <Select
        value={planoValue}
        onValueChange={(value) => {
          setPlanoValue(value)
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
        onClick={() => router.push(pathname)}
      >
        Limpar
      </Button>
    </div>
  )
}
