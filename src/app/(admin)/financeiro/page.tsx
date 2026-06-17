"use client"

import { useEffect, useState, useCallback, useEffectEvent, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  DollarSign,
  CreditCard,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { toast } from "sonner"
import { groupPlansByCategory } from "@/lib/planos"
import { sortByTextPtBr } from "@/lib/select-options"
import { formatDateISO, parseDateFromAPI } from "@/lib/schedule"
import { fetchWithTimeout } from "@/lib/http"
import { formatCurrency } from "@/lib/currency"
import type { FinanceiroStats, Plano, Pagamento, Membro } from "./_components/types"
import { PLAN_THEMES } from "./_components/plano-themes"
import { PlanoSection } from "./_components/plano-card"
import { PagamentoRow } from "./_components/pagamento-row"

// Helper functions

function getNextBillingDate(date: Date): string {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1, 12, 0, 0)
  const maxDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()

  nextMonth.setDate(Math.min(date.getDate(), maxDay))

  return formatDateISO(nextMonth)
}

export default function FinanceiroPage() {
  return useFinanceiroPage()
}

function useFinanceiroPage() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [searchPagamento, setSearchPagamento] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [sortPagamento, setSortPagamento] = useState<string>("recent_desc")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingPagamentos, setLoadingPagamentos] = useState(false)
  const pagamentosRequestId = useRef(0)
  const pagamentoDueDateRequestId = useRef(0)
  const ITEMS_PER_PAGE = 10

  // Dialog states
  const [planoDialogOpen, setPlanoDialogOpen] = useState(false)
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false)
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null)
  const [editingPagamento, setEditingPagamento] = useState<Pagamento | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete confirmation dialog states
  const [showDeletePagamentoDialog, setShowDeletePagamentoDialog] = useState(false)
  const [pagamentoToDelete, setPagamentoToDelete] = useState<Pagamento | null>(null)
  const [deletingPagamento, setDeletingPagamento] = useState(false)

  // Form states for Plano
  const [planoForm, setPlanoForm] = useState({
    nome: "",
    descricao: "",
    valor: "",
    duracaoDias: "30",
    aulasSemanais: "3",
  })

  // Form states for Pagamento
  const [pagamentoForm, setPagamentoForm] = useState({
    membroId: "",
    planoId: "",
    valor: "",
    dataVencimento: "",
    formaPagamento: "",
    observacao: "",
  })

  // Validation error states
  const [planoErrors, setPlanoErrors] = useState<Record<string, string>>({})
  const [pagamentoErrors, setPagamentoErrors] = useState<Record<string, string>>({})
  const sortedMembros = useMemo(
    () => sortByTextPtBr(membros, (membro) => membro.usuario.nome ?? ""),
    [membros]
  )
  const groupedPlanosAtivos = useMemo(
    () => groupPlansByCategory(planos.filter((plano) => plano.ativo)),
    [planos]
  )
  const groupedTodosPlanos = useMemo(
    () => groupPlansByCategory(planos),
    [planos]
  )
  const pagamentoMembroOptions = useMemo<SearchableSelectOption[]>(
    () =>
      sortedMembros.map((membro) => ({
        value: membro.id,
        label: membro.usuario.nome ?? "Sem nome",
        keywords: [membro.usuario.nome, membro.usuario.email].filter(
          (keyword): keyword is string => Boolean(keyword)
        ),
      })),
    [sortedMembros]
  )
  const pagamentoPlanoOptions = useMemo<SearchableSelectOption[]>(
    () => [
      ...groupedPlanosAtivos.planosGabi.map((plano) => ({
        value: plano.id,
        label: `${plano.nome} - ${formatCurrency(plano.valor)}`,
        keywords: [plano.nome, "gabi"],
        group: "Planos com Gabi",
      })),
      ...groupedPlanosAtivos.planosEstagiarios.map((plano) => ({
        value: plano.id,
        label: `${plano.nome} - ${formatCurrency(plano.valor)}`,
        keywords: [plano.nome, "estagiario", "estagiários"],
        group: "Planos com Estagiários",
      })),
      ...groupedPlanosAtivos.planosOutros.map((plano) => ({
        value: plano.id,
        label: `${plano.nome} - ${formatCurrency(plano.valor)}`,
        keywords: [plano.nome],
        group: "Outros Planos",
      })),
    ],
    [groupedPlanosAtivos]
  )
  const getMemberPlanDefaults = (memberId: string) => {
    const member = membros.find((m) => m.id === memberId)
    if (!member) {
      return { planoId: "", valor: "" }
    }

    const planoId = member.planoId || member.plano?.id || ""
    if (!planoId) {
      return { planoId: "", valor: "" }
    }

    const plano = planos.find((p) => p.id === planoId)
    const customPrice = member.precoCustomizado
    const valor = customPrice !== null && customPrice !== undefined && String(customPrice).trim() !== ""
      ? String(customPrice)
      : plano
        ? String(plano.valor)
        : ""

    return { planoId, valor }
  }

  const getMemberNextBillingDate = useCallback(async (memberId: string) => {
    const requestId = ++pagamentoDueDateRequestId.current

    try {
      const params = new URLSearchParams({
        membroId: memberId,
        limit: "1",
        sort: "vencimento_desc",
      })

      if (requestId !== pagamentoDueDateRequestId.current) {
        return null
      }
      const res = await fetchWithTimeout(`/api/pagamentos?${params.toString()}`)
      if (!res.ok) {
        return null
      }

      const response = await res.json()
      const latestPagamento = response.data?.[0]
      if (!latestPagamento?.dataVencimento) {
        return null
      }

      return getNextBillingDate(parseDateFromAPI(latestPagamento.dataVencimento))
    } catch (error) {
      console.error("Erro ao carregar a próxima data de vencimento:", error)
      return null
    }
  }, [])

  // Stats state
  const [stats, setStats] = useState<FinanceiroStats>({
    totalPlanos: 0,
    pagamentosPendentes: 0,
    pagamentosAtrasados: 0,
    receitaMes: 0
  })

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithTimeout("/api/financeiro/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error)
    }
  }, [])

  // Fetch pagamentos with pagination and filters
  const fetchPagamentos = useCallback(async (page: number = 1, search?: string, status?: string, sort?: string) => {
    const requestId = ++pagamentosRequestId.current
    setLoadingPagamentos(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
      })
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      if (sort) params.set('sort', sort)

      if (requestId !== pagamentosRequestId.current) {
        return
      }
      const res = await fetchWithTimeout(`/api/pagamentos?${params.toString()}`)
      if (res.ok) {
        const response = await res.json()
        setPagamentos(response.data)
        setTotalPages(response.meta.totalPages)
        setCurrentPage(response.meta.page)
      }
    } catch (error) {
      if (requestId !== pagamentosRequestId.current) {
        return
      }
      console.error("Erro ao carregar pagamentos:", error)
      toast.error("Erro ao carregar pagamentos")
    } finally {
      if (requestId === pagamentosRequestId.current) {
        setLoadingPagamentos(false)
      }
    }
  }, [])

  const fetchBootstrapData = useCallback(async () => {
    try {
      const [planosRes, membrosRes] = await Promise.all([
        fetchWithTimeout("/api/planos?includeInactive=true"),
        fetchWithTimeout("/api/membros"),
      ])

      if (planosRes.ok) {
        const planosData = await planosRes.json()
        setPlanos(planosData)
      }
      if (membrosRes.ok) {
        const membrosData = await membrosRes.json()
        setMembros(membrosData)
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBootstrapData()
  }, [fetchBootstrapData])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const fetchPagamentosEvent = useEffectEvent(fetchPagamentos)

  // Refetch when search or filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPagamentosEvent(1, searchPagamento, filterStatus, sortPagamento)
    }, 350)
    return () => clearTimeout(timer)
  }, [filterStatus, searchPagamento, sortPagamento])

  // Plano handlers
  const handleOpenPlanoDialog = (plano?: Plano) => {
    if (plano) {
      setEditingPlano(plano)
      setPlanoForm({
        nome: plano.nome,
        descricao: plano.descricao || "",
        valor: String(plano.valor),
        duracaoDias: String(plano.duracaoDias),
        aulasSemanais: String(plano.aulasSemanais),
      })
    } else {
      setEditingPlano(null)
      setPlanoForm({
        nome: "",
        descricao: "",
        valor: "",
        duracaoDias: "30",
        aulasSemanais: "3",
      })
    }
    setPlanoErrors({})
    setPlanoDialogOpen(true)
  }

  const validatePlanoForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!planoForm.nome.trim()) {
      errors.nome = "Informe o nome do plano"
    }

    const valor = parseFloat(planoForm.valor)
    if (!planoForm.valor || Number.isNaN(valor)) {
      errors.valor = "Informe o valor do plano"
    } else if (valor <= 0) {
      errors.valor = "Valor deve ser maior que zero"
    }

    if (!planoForm.duracaoDias) {
      errors.duracaoDias = "Selecione a duração do plano"
    }

    if (!planoForm.aulasSemanais) {
      errors.aulasSemanais = "Selecione a quantidade de aulas"
    }

    setPlanoErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSavePlano = async () => {
    if (!validatePlanoForm()) {
      toast.error("Verifique os campos destacados")
      return
    }

    setSubmitting(true)
    try {
      const url = editingPlano ? `/api/planos/${editingPlano.id}` : "/api/planos"
      const method = editingPlano ? "PUT" : "POST"

      const res = await fetchWithTimeout(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: planoForm.nome,
          descricao: planoForm.descricao || null,
          valor: parseFloat(planoForm.valor),
          duracaoDias: parseInt(planoForm.duracaoDias),
          aulasSemanais: parseInt(planoForm.aulasSemanais),
        }),
      })

      if (res.ok) {
        toast.success(editingPlano ? "Plano atualizado!" : "Plano criado!")
        setPlanoDialogOpen(false)
        void fetchBootstrapData()
        void fetchStats()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erro ao salvar plano")
      }
    } catch {
      toast.error("Erro ao salvar plano")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePlano = async (plano: Plano) => {
    if (!confirm(`Deseja realmente ${plano.ativo ? "desativar" : "remover"} o plano "${plano.nome}"?`)) {
      return
    }

    try {
      const res = await fetchWithTimeout(`/api/planos/${plano.id}`, { method: "DELETE" })
      const data = await res.json()

      if (res.ok) {
        toast.success(data.message || "Plano removido!")
        void fetchBootstrapData()
        void fetchStats()
      } else {
        toast.error(data.error || "Erro ao remover plano")
      }
    } catch {
      toast.error("Erro ao remover plano")
    }
  }

  const handleTogglePlanoAtivo = async (plano: Plano) => {
    try {
      const res = await fetchWithTimeout(`/api/planos/${plano.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !plano.ativo }),
      })

      if (res.ok) {
        toast.success(plano.ativo ? "Plano desativado!" : "Plano ativado!")
        void fetchBootstrapData()
        void fetchStats()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erro ao atualizar plano")
      }
    } catch {
      toast.error("Erro ao atualizar plano")
    }
  }

  // Pagamento handlers
  const handleOpenPagamentoDialog = useCallback((pagamento?: Pagamento) => {
    if (pagamento) {
      setEditingPagamento(pagamento)
      setPagamentoForm({
        membroId: pagamento.membroId || "",
        planoId: pagamento.planoId,
        valor: String(pagamento.valor),
        dataVencimento: formatDateISO(parseDateFromAPI(pagamento.dataVencimento)),
        formaPagamento: pagamento.formaPagamento || "",
        observacao: pagamento.observacao || "",
      })
    } else {
      // Default to one month from today
      const today = new Date()
      const defaultDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())

      // Format as YYYY-MM-DD for the date input
      const defaultDateStr = formatDateISO(defaultDate)

      setEditingPagamento(null)
      setPagamentoForm({
        membroId: "",
        planoId: "",
        valor: "",
        dataVencimento: defaultDateStr,
        formaPagamento: "",
        observacao: "",
      })
    }
    setPagamentoErrors({})
    setPagamentoDialogOpen(true)
  }, [])

  const validatePagamentoForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!pagamentoForm.membroId) {
      errors.membroId = "Selecione um aluno"
    }

    if (!pagamentoForm.planoId) {
      errors.planoId = "Selecione um plano"
    }

    const valor = parseFloat(pagamentoForm.valor)
    if (!pagamentoForm.valor || Number.isNaN(valor)) {
      errors.valor = "Informe o valor do pagamento"
    } else if (valor <= 0) {
      errors.valor = "Valor deve ser maior que zero"
    }

    if (!pagamentoForm.dataVencimento) {
      errors.dataVencimento = "Informe a data de vencimento"
    }

    if (!pagamentoForm.formaPagamento) {
      errors.formaPagamento = "Selecione a forma de pagamento"
    }

    setPagamentoErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSavePagamento = async () => {
    if (!validatePagamentoForm()) {
      toast.error("Verifique os campos destacados")
      return
    }

    setSubmitting(true)
    try {
      const url = editingPagamento ? `/api/pagamentos/${editingPagamento.id}` : "/api/pagamentos"
      const method = editingPagamento ? "PUT" : "POST"

      const body = {
        membroId: pagamentoForm.membroId,
        planoId: pagamentoForm.planoId,
        valor: parseFloat(pagamentoForm.valor),
        dataVencimento: pagamentoForm.dataVencimento,
        formaPagamento: pagamentoForm.formaPagamento,
        observacao: pagamentoForm.observacao || null,
      }

      const res = await fetchWithTimeout(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingPagamento ? "Pagamento atualizado!" : "Pagamento criado!")
        setPagamentoDialogOpen(false)
        fetchPagamentos(currentPage, searchPagamento, filterStatus, sortPagamento)
        fetchStats()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erro ao salvar pagamento")
      }
    } catch {
      toast.error("Erro ao salvar pagamento")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdatePagamentoStatus = useCallback(async (pagamento: Pagamento, newStatus: Pagamento["status"]) => {
    try {
      const res = await fetchWithTimeout(`/api/pagamentos/${pagamento.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        toast.success("Status atualizado!")
        fetchPagamentos(currentPage, searchPagamento, filterStatus, sortPagamento)
        fetchStats()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erro ao atualizar status")
      }
    } catch {
      toast.error("Erro ao atualizar status")
    }
  }, [currentPage, searchPagamento, filterStatus, sortPagamento, fetchPagamentos, fetchStats])

  const handleDeletePagamento = useCallback((pagamento: Pagamento) => {
    setPagamentoToDelete(pagamento)
    setShowDeletePagamentoDialog(true)
  }, [])

  const handleConfirmDeletePagamento = async () => {
    if (!pagamentoToDelete) return

    setDeletingPagamento(true)
    try {
      const res = await fetchWithTimeout(`/api/pagamentos/${pagamentoToDelete.id}`, { method: "DELETE" })
      const data = await res.json()

      if (res.ok) {
        toast.success(data.message || "Pagamento removido!")
        fetchPagamentos(currentPage, searchPagamento, filterStatus, sortPagamento)
        fetchStats()
        setShowDeletePagamentoDialog(false)
        setPagamentoToDelete(null)
      } else {
        toast.error(data.error || "Erro ao remover pagamento")
      }
    } catch {
      toast.error("Erro ao remover pagamento")
    } finally {
      setDeletingPagamento(false)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando dados…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">
            Gerencie planos e pagamentos do estúdio
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <CreditCard className="size-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlanos}</div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Clock className="size-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pagamentosPendentes}</div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md hover:shadow-destructive/5 transition-shadow border-destructive/10">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
            <div className="size-9 rounded-lg bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/15 transition-colors">
              <AlertCircle className="size-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.pagamentosAtrasados}</div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Wallet className="size-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.receitaMes)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pagamentos" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pagamentos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="planos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Planos
          </TabsTrigger>
        </TabsList>

        {/* Pagamentos Tab */}
        <TabsContent value="pagamentos" className="space-y-4">
          <Card className="border-primary/10">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Pagamentos</CardTitle>
                    <CardDescription>
                      Controle de pagamentos dos alunos
                    </CardDescription>
                  </div>
                </div>
                <Dialog open={pagamentoDialogOpen} onOpenChange={setPagamentoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenPagamentoDialog()} className="shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-shadow">
                      <Plus className="mr-2 size-4" />
                      Novo Pagamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingPagamento ? "Editar Pagamento" : "Novo Pagamento"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingPagamento
                          ? "Atualize as informações do pagamento"
                          : "Registre um novo pagamento para um aluno"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="membro" className={pagamentoErrors.membroId ? "text-destructive" : ""}>
                          Aluno
                        </Label>
                        <SearchableSelect
                          value={pagamentoForm.membroId}
                          onValueChange={(value) => {
                            const defaults = getMemberPlanDefaults(value)
                            setPagamentoForm((current) => ({
                              ...current,
                              membroId: value,
                              planoId: defaults.planoId,
                              valor: defaults.valor,
                            }))
                            if (pagamentoErrors.membroId) {
                              setPagamentoErrors({ ...pagamentoErrors, membroId: "" })
                            }
                            if (pagamentoErrors.planoId || pagamentoErrors.valor) {
                              setPagamentoErrors({ ...pagamentoErrors, planoId: "", valor: "" })
                            }

                            void getMemberNextBillingDate(value).then((nextBillingDate) => {
                              if (!nextBillingDate) {
                                return
                              }

                              setPagamentoForm((current) =>
                                current.membroId === value
                                  ? { ...current, dataVencimento: nextBillingDate }
                                  : current
                              )
                            })
                          }}
                          options={pagamentoMembroOptions}
                          placeholder="Selecione o aluno"
                          searchPlaceholder="Buscar aluno..."
                          emptyMessage="Nenhum aluno encontrado."
                          disabled={submitting}
                          className={pagamentoErrors.membroId ? "border-destructive" : "border-input/50"}
                        />
                        {pagamentoErrors.membroId && (
                          <p className="text-xs text-destructive">{pagamentoErrors.membroId}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="plano" className={pagamentoErrors.planoId ? "text-destructive" : ""}>
                          Plano
                        </Label>
                        <SearchableSelect
                          value={pagamentoForm.planoId}
                          onValueChange={(value) => {
                            const plano = planos.find((p) => p.id === value)
                            setPagamentoForm({
                              ...pagamentoForm,
                              planoId: value,
                              valor: plano ? String(plano.valor) : pagamentoForm.valor,
                            })
                            if (pagamentoErrors.planoId) {
                              setPagamentoErrors({ ...pagamentoErrors, planoId: "", valor: "" })
                            }
                          }}
                          options={pagamentoPlanoOptions}
                          placeholder="Selecione o plano"
                          searchPlaceholder="Buscar plano..."
                          emptyMessage="Nenhum plano encontrado."
                          disabled={submitting}
                          className={pagamentoErrors.planoId ? "border-destructive" : "border-input/50"}
                          renderOption={(option) => {
                            const dotClass =
                              option.group === "Planos com Gabi"
                                ? "bg-amber-400"
                                : option.group === "Planos com Estagiários"
                                  ? "bg-sky-400"
                                  : option.group === "Outros Planos"
                                    ? "bg-violet-400"
                                    : null

                            if (!dotClass) {
                              return option.label
                            }

                            return (
                              <span className="flex items-center gap-2">
                                <span className={`size-1.5 rounded-full ${dotClass}`} />
                                {option.label}
                              </span>
                            )
                          }}
                        />
                        {pagamentoErrors.planoId && (
                          <p className="text-xs text-destructive">{pagamentoErrors.planoId}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="valor" className={pagamentoErrors.valor ? "text-destructive" : ""}>
                            Valor
                          </Label>
                          <Input
                            id="valor"
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={pagamentoForm.valor}
                            onChange={(e) => {
                              setPagamentoForm({ ...pagamentoForm, valor: e.target.value })
                              if (pagamentoErrors.valor) {
                                setPagamentoErrors({ ...pagamentoErrors, valor: "" })
                              }
                            }}
                            disabled={submitting}
                            className={pagamentoErrors.valor ? "border-destructive" : "border-input/50"}
                          />
                          {pagamentoErrors.valor && (
                            <p className="text-xs text-destructive">{pagamentoErrors.valor}</p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="dataVencimento" className={pagamentoErrors.dataVencimento ? "text-destructive" : ""}>
                            Vencimento
                          </Label>
                          <Input
                            id="dataVencimento"
                            type="date"
                            value={pagamentoForm.dataVencimento}
                            onChange={(e) => {
                              setPagamentoForm({ ...pagamentoForm, dataVencimento: e.target.value })
                              if (pagamentoErrors.dataVencimento) {
                                setPagamentoErrors({ ...pagamentoErrors, dataVencimento: "" })
                              }
                            }}
                            disabled={submitting}
                            className={pagamentoErrors.dataVencimento ? "border-destructive" : "border-input/50"}
                          />
                          {pagamentoErrors.dataVencimento && (
                            <p className="text-xs text-destructive">{pagamentoErrors.dataVencimento}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label
                          htmlFor="formaPagamento"
                          className={pagamentoErrors.formaPagamento ? "text-destructive" : ""}
                        >
                          Forma de Pagamento
                        </Label>
                        <Select
                          value={pagamentoForm.formaPagamento}
                          onValueChange={(v) => {
                            setPagamentoForm({ ...pagamentoForm, formaPagamento: v })
                            if (pagamentoErrors.formaPagamento) {
                              setPagamentoErrors({ ...pagamentoErrors, formaPagamento: "" })
                            }
                          }}
                        >
                          <SelectTrigger className={pagamentoErrors.formaPagamento ? "border-destructive" : "border-input/50"}>
                            <SelectValue placeholder="Selecione a forma de pagamento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PIX">PIX</SelectItem>
                            <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                            <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                            <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                            <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                        {pagamentoErrors.formaPagamento && (
                          <p className="text-xs text-destructive">{pagamentoErrors.formaPagamento}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="observacao">Observação</Label>
                        <Textarea
                          id="observacao"
                          placeholder="Observações sobre o pagamento..."
                          value={pagamentoForm.observacao}
                          onChange={(e) => setPagamentoForm({ ...pagamentoForm, observacao: e.target.value })}
                          className="border-input/50"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPagamentoDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSavePagamento} disabled={submitting} className="shadow-md shadow-primary/25">
                        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                        {editingPagamento ? "Salvar" : "Criar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog open={showDeletePagamentoDialog} onOpenChange={setShowDeletePagamentoDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirmar exclusão</DialogTitle>
                      <DialogDescription>
                        Tem certeza que deseja excluir o pagamento de{" "}
                        {pagamentoToDelete?.membro?.usuario?.nome
                          ? <strong>{pagamentoToDelete.membro.usuario.nome}</strong>
                          : pagamentoToDelete?.payerNome
                            ? <strong>{pagamentoToDelete.payerNome}</strong>
                            : "este pagador"}
                        {" "}no valor de <strong>{pagamentoToDelete ? formatCurrency(pagamentoToDelete.valor) : ""}</strong>?
                        Esta ação é <strong>permanente</strong> e não poderá ser desfeita.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDeletePagamentoDialog(false)
                          setPagamentoToDelete(null)
                        }}
                        disabled={deletingPagamento}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleConfirmDeletePagamento}
                        disabled={deletingPagamento}
                      >
                        {deletingPagamento ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Excluindo…
                          </>
                        ) : (
                          "Excluir permanentemente"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome..."
                    value={searchPagamento}
                    onChange={(e) => setSearchPagamento(e.target.value)}
                    className="pl-9 border-input/50 focus:border-primary"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px] border-input/50">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDENTE">Pendentes</SelectItem>
                    <SelectItem value="PAGO">Pagos</SelectItem>
                    <SelectItem value="ATRASADO">Atrasados</SelectItem>
                    <SelectItem value="CANCELADO">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortPagamento} onValueChange={setSortPagamento}>
                  <SelectTrigger className="w-[200px] border-input/50">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vencimento_desc">Vencimento (mais distante)</SelectItem>
                    <SelectItem value="vencimento_asc">Vencimento (mais próximo)</SelectItem>
                    <SelectItem value="recent_desc">Mais recentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pagamentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <DollarSign className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nenhum pagamento encontrado.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Aluno</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagamentos.map((pagamento) => (
                        <PagamentoRow
                          key={pagamento.id}
                          pagamento={pagamento}
                          onEdit={handleOpenPagamentoDialog}
                          onUpdateStatus={handleUpdatePagamentoStatus}
                          onDelete={handleDeletePagamento}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/50 px-2">
                  <div className="flex-1 text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex items-center gap-x-2">
                    <Button
                      variant="outline"
                      className="size-8 p-0 lg:flex"
                      onClick={() => fetchPagamentos(1, searchPagamento, filterStatus, sortPagamento)}
                      disabled={currentPage === 1 || loadingPagamentos}
                    >
                      <span className="sr-only">Primeira página</span>
                      <ChevronsLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="size-8 p-0"
                      onClick={() => fetchPagamentos(currentPage - 1, searchPagamento, filterStatus, sortPagamento)}
                      disabled={currentPage === 1 || loadingPagamentos}
                    >
                      <span className="sr-only">Página anterior</span>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="size-8 p-0"
                      onClick={() => fetchPagamentos(currentPage + 1, searchPagamento, filterStatus, sortPagamento)}
                      disabled={currentPage === totalPages || loadingPagamentos}
                    >
                      <span className="sr-only">Próxima página</span>
                      <ChevronRight className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="size-8 p-0 lg:flex"
                      onClick={() => fetchPagamentos(totalPages, searchPagamento, filterStatus, sortPagamento)}
                      disabled={currentPage === totalPages || loadingPagamentos}
                    >
                      <span className="sr-only">Última página</span>
                      <ChevronsRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Planos Tab */}
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
                <Dialog open={planoDialogOpen} onOpenChange={setPlanoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenPlanoDialog()} className="shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-shadow">
                      <Plus className="mr-2 size-4" />
                      Novo Plano
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingPlano ? "Editar Plano" : "Novo Plano"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingPlano
                          ? "Atualize as informações do plano"
                          : "Crie um novo plano para o estúdio"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="nome" className={planoErrors.nome ? "text-destructive" : ""}>
                          Nome do Plano
                        </Label>
                        <Input
                          id="nome"
                          placeholder="Ex: Mensal 3x/semana"
                          value={planoForm.nome}
                          onChange={(e) => {
                            setPlanoForm({ ...planoForm, nome: e.target.value })
                            if (planoErrors.nome) {
                              setPlanoErrors({ ...planoErrors, nome: "" })
                            }
                          }}
                          className={planoErrors.nome ? "border-destructive" : "border-input/50"}
                        />
                        {planoErrors.nome && (
                          <p className="text-xs text-destructive">{planoErrors.nome}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="descricao">Descrição</Label>
                        <Textarea
                          id="descricao"
                          placeholder="Descrição do plano..."
                          value={planoForm.descricao}
                          onChange={(e) => setPlanoForm({ ...planoForm, descricao: e.target.value })}
                          className="border-input/50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="valor" className={planoErrors.valor ? "text-destructive" : ""}>
                            Valor (R$)
                          </Label>
                          <Input
                            id="valor"
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={planoForm.valor}
                            onChange={(e) => {
                              setPlanoForm({ ...planoForm, valor: e.target.value })
                              if (planoErrors.valor) {
                                setPlanoErrors({ ...planoErrors, valor: "" })
                              }
                            }}
                            className={planoErrors.valor ? "border-destructive" : "border-input/50"}
                          />
                          {planoErrors.valor && (
                            <p className="text-xs text-destructive">{planoErrors.valor}</p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="duracaoDias" className={planoErrors.duracaoDias ? "text-destructive" : ""}>
                            Duração (dias)
                          </Label>
                          <Select
                            value={planoForm.duracaoDias}
                            onValueChange={(v) => {
                              setPlanoForm({ ...planoForm, duracaoDias: v })
                              if (planoErrors.duracaoDias) {
                                setPlanoErrors({ ...planoErrors, duracaoDias: "" })
                              }
                            }}
                          >
                            <SelectTrigger className={planoErrors.duracaoDias ? "border-destructive" : "border-input/50"}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">Mensal (30 dias)</SelectItem>
                              <SelectItem value="90">Trimestral (90 dias)</SelectItem>
                              <SelectItem value="180">Semestral (180 dias)</SelectItem>
                              <SelectItem value="365">Anual (365 dias)</SelectItem>
                            </SelectContent>
                          </Select>
                          {planoErrors.duracaoDias && (
                            <p className="text-xs text-destructive">{planoErrors.duracaoDias}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="aulasSemanais" className={planoErrors.aulasSemanais ? "text-destructive" : ""}>
                          Aulas por Semana
                        </Label>
                        <Select
                          value={planoForm.aulasSemanais}
                          onValueChange={(v) => {
                            setPlanoForm({ ...planoForm, aulasSemanais: v })
                            if (planoErrors.aulasSemanais) {
                              setPlanoErrors({ ...planoErrors, aulasSemanais: "" })
                            }
                          }}
                        >
                          <SelectTrigger className={planoErrors.aulasSemanais ? "border-destructive" : "border-input/50"}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 aula/semana</SelectItem>
                            <SelectItem value="2">2 aulas/semana</SelectItem>
                            <SelectItem value="3">3 aulas/semana</SelectItem>
                            <SelectItem value="4">4 aulas/semana</SelectItem>
                            <SelectItem value="5">5 aulas/semana</SelectItem>
                            <SelectItem value="6">6 aulas/semana</SelectItem>
                            <SelectItem value="7">Ilimitado</SelectItem>
                          </SelectContent>
                        </Select>
                        {planoErrors.aulasSemanais && (
                          <p className="text-xs text-destructive">{planoErrors.aulasSemanais}</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPlanoDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSavePlano} disabled={submitting} className="shadow-md shadow-primary/25">
                        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                        {editingPlano ? "Salvar" : "Criar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                        onEdit={handleOpenPlanoDialog}
                        onToggleAtivo={handleTogglePlanoAtivo}
                        onDelete={handleDeletePlano}
                      />
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
