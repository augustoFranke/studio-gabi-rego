"use client"

import { useEffect, useState, useCallback, useEffectEvent, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type SearchableSelectOption } from "@/components/ui/searchable-select"
import {
  CreditCard,
  Clock,
  AlertCircle,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { groupPlansByCategory } from "@/lib/planos"
import { sortByTextPtBr } from "@/lib/select-options"
import { formatDateISO, parseDateFromAPI } from "@/lib/schedule"
import { fetchWithTimeout } from "@/lib/http"
import { formatCurrency } from "@/lib/currency"
import type { FinanceiroStats, Plano, Pagamento, Membro } from "./_components/types"
import { PagamentosTab } from "./_components/pagamentos-tab"
import { PlanosTab } from "./_components/planos-tab"

// Helper functions

function getNextBillingDate(date: Date): string {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1, 12, 0, 0)
  const maxDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()

  nextMonth.setDate(Math.min(date.getDate(), maxDay))

  return formatDateISO(nextMonth)
}

type FinanceiroClientProps = {
  initialPlanos: Plano[]
  initialMembros: Membro[]
  initialStats: FinanceiroStats
}

export function FinanceiroClient({
  initialPlanos,
  initialMembros,
  initialStats,
}: FinanceiroClientProps) {
  const [planos, setPlanos] = useState<Plano[]>(initialPlanos)
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [membros, setMembros] = useState<Membro[]>(initialMembros)
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
  const [stats, setStats] = useState<FinanceiroStats>(initialStats)

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
    }
  }, [])

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
        <PagamentosTab
          pagamentos={pagamentos}
          searchPagamento={searchPagamento}
          setSearchPagamento={setSearchPagamento}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          sortPagamento={sortPagamento}
          setSortPagamento={setSortPagamento}
          currentPage={currentPage}
          totalPages={totalPages}
          loadingPagamentos={loadingPagamentos}
          fetchPagamentos={fetchPagamentos}
          onEditPagamento={handleOpenPagamentoDialog}
          onUpdatePagamentoStatus={handleUpdatePagamentoStatus}
          onDeletePagamento={handleDeletePagamento}
          pagamentoDialogOpen={pagamentoDialogOpen}
          setPagamentoDialogOpen={setPagamentoDialogOpen}
          editingPagamento={editingPagamento}
          pagamentoForm={pagamentoForm}
          setPagamentoForm={setPagamentoForm}
          pagamentoErrors={pagamentoErrors}
          setPagamentoErrors={setPagamentoErrors}
          submitting={submitting}
          planos={planos}
          pagamentoMembroOptions={pagamentoMembroOptions}
          pagamentoPlanoOptions={pagamentoPlanoOptions}
          getMemberPlanDefaults={getMemberPlanDefaults}
          getMemberNextBillingDate={getMemberNextBillingDate}
          onNewPagamento={() => handleOpenPagamentoDialog()}
          onSavePagamento={handleSavePagamento}
          showDeletePagamentoDialog={showDeletePagamentoDialog}
          setShowDeletePagamentoDialog={setShowDeletePagamentoDialog}
          pagamentoToDelete={pagamentoToDelete}
          deletingPagamento={deletingPagamento}
          onCancelDeletePagamento={() => {
            setShowDeletePagamentoDialog(false)
            setPagamentoToDelete(null)
          }}
          onConfirmDeletePagamento={handleConfirmDeletePagamento}
        />

        {/* Planos Tab */}
        <PlanosTab
          planos={planos}
          groupedTodosPlanos={groupedTodosPlanos}
          onEditPlano={handleOpenPlanoDialog}
          onTogglePlanoAtivo={handleTogglePlanoAtivo}
          onDeletePlano={handleDeletePlano}
          planoDialogOpen={planoDialogOpen}
          setPlanoDialogOpen={setPlanoDialogOpen}
          editingPlano={editingPlano}
          planoForm={planoForm}
          setPlanoForm={setPlanoForm}
          planoErrors={planoErrors}
          setPlanoErrors={setPlanoErrors}
          submitting={submitting}
          onNewPlano={() => handleOpenPlanoDialog()}
          onSavePlano={handleSavePlano}
        />
      </Tabs>
    </div>
  )
}
