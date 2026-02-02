"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Users,
  CreditCard,
  Calendar,
  Check,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Search,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { toast } from "sonner"
import type { Prisma } from '@prisma/client'
import { groupPlansByCategory } from "@/lib/planos"

type FinanceiroStats = {
  totalPlanos: number
  pagamentosPendentes: number
  pagamentosAtrasados: number
  receitaMes: number
}

type Plano = Omit<
  Prisma.PlanoGetPayload<{
    include: { _count: { select: { membros: true; pagamentos: true } } }
  }>,
  'valor'
> & {
  valor: string | number
}

type Pagamento = Omit<
  Prisma.PagamentoGetPayload<{
    include: {
      membro: { include: { usuario: { select: { nome: true } } } }
      plano: true
    }
  }>,
  'valor' | 'dataVencimento' | 'dataPagamento'
> & {
  valor: string | number
  dataVencimento: string
  dataPagamento: string | null
}

type Membro = Omit<
  Prisma.MembroGetPayload<{
    include: {
      usuario: { select: { id: true; nome: true; email: true } }
      plano: true
    }
  }>,
  'dataNascimento' | 'precoCustomizado'
> & {
  dataNascimento?: string | Date | null
  precoCustomizado?: string | number | null
}

// Helper functions
function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("pt-BR")
}

function getStatusBadge(status: Pagamento["status"]) {
  const variants: Record<Pagamento["status"], { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
    PAGO: { variant: "default", icon: <Check className="h-3 w-3" />, label: "Pago" },
    PENDENTE: { variant: "secondary", icon: <Clock className="h-3 w-3" />, label: "Pendente" },
    ATRASADO: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" />, label: "Atrasado" },
    CANCELADO: { variant: "outline", icon: <XCircle className="h-3 w-3" />, label: "Cancelado" },
  }
  const { variant, icon, label } = variants[status]
  return (
    <Badge variant={variant} className={`gap-1 ${variant === 'default' ? 'bg-primary' : ''}`}>
      {icon}
      {label}
    </Badge>
  )
}

export default function FinanceiroPage() {
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

  // Stats state
  const [stats, setStats] = useState<FinanceiroStats>({
    totalPlanos: 0,
    pagamentosPendentes: 0,
    pagamentosAtrasados: 0,
    receitaMes: 0
  })

  const groupedPlanos = useMemo(() => groupPlansByCategory(planos), [planos])
  const groupedPlanosAtivos = useMemo(
    () => groupPlansByCategory(planos.filter((p) => p.ativo)),
    [planos]
  )

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/financeiro/stats")
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
    setLoadingPagamentos(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
      })
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      if (sort) params.set('sort', sort)

      const res = await fetch(`/api/pagamentos?${params.toString()}`)
      if (res.ok) {
        const response = await res.json()
        setPagamentos(response.data)
        setTotalPages(response.meta.totalPages)
        setCurrentPage(response.meta.page)
      }
    } catch (error) {
      console.error("Erro ao carregar pagamentos:", error)
      toast.error("Erro ao carregar pagamentos")
    } finally {
      setLoadingPagamentos(false)
    }
  }, [])

  // Fetch initial data (planos, membros, and first page of pagamentos)
  const fetchData = useCallback(async () => {
    try {
      const [planosRes, membrosRes] = await Promise.all([
        fetch("/api/planos?includeInactive=true"),
        fetch("/api/membros"),
      ])

      if (planosRes.ok) {
        const planosData = await planosRes.json()
        setPlanos(planosData)
      }
      if (membrosRes.ok) {
        const membrosData = await membrosRes.json()
        setMembros(membrosData)
      }

      // Fetch first page of pagamentos
      await fetchPagamentos(1, undefined, undefined, sortPagamento)
      await fetchStats()
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [fetchPagamentos, fetchStats, sortPagamento])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Refetch when search or filter changes (with debounce for search)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPagamentos(1, searchPagamento, filterStatus, sortPagamento)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchPagamento, filterStatus, sortPagamento, fetchPagamentos])

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

      const res = await fetch(url, {
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
        fetchData()
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
      const res = await fetch(`/api/planos/${plano.id}`, { method: "DELETE" })
      const data = await res.json()

      if (res.ok) {
        toast.success(data.message || "Plano removido!")
        fetchData()
      } else {
        toast.error(data.error || "Erro ao remover plano")
      }
    } catch {
      toast.error("Erro ao remover plano")
    }
  }

  const handleTogglePlanoAtivo = async (plano: Plano) => {
    try {
      const res = await fetch(`/api/planos/${plano.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !plano.ativo }),
      })

      if (res.ok) {
        toast.success(plano.ativo ? "Plano desativado!" : "Plano ativado!")
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erro ao atualizar plano")
      }
    } catch {
      toast.error("Erro ao atualizar plano")
    }
  }

  // Pagamento handlers
  const handleOpenPagamentoDialog = (pagamento?: Pagamento) => {
    if (pagamento) {
      setEditingPagamento(pagamento)
      setPagamentoForm({
        membroId: pagamento.membroId,
        planoId: pagamento.planoId,
        valor: String(pagamento.valor),
        dataVencimento: pagamento.dataVencimento.split("T")[0],
        formaPagamento: pagamento.formaPagamento || "",
        observacao: pagamento.observacao || "",
      })
    } else {
      // Calculate default due date: day 10 of current month (or next month if already past day 10)
      const today = new Date()
      const defaultDueDay = 10
      let defaultDate: Date

      if (today.getDate() > defaultDueDay) {
        // If we're past day 10, default to day 10 of next month
        defaultDate = new Date(today.getFullYear(), today.getMonth() + 1, defaultDueDay)
      } else {
        // Otherwise, day 10 of current month
        defaultDate = new Date(today.getFullYear(), today.getMonth(), defaultDueDay)
      }

      // Format as YYYY-MM-DD for the date input
      const defaultDateStr = defaultDate.toISOString().split("T")[0]

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
  }

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

      const body = editingPagamento
        ? {
          formaPagamento: pagamentoForm.formaPagamento,
          observacao: pagamentoForm.observacao || null,
        }
        : {
          membroId: pagamentoForm.membroId,
          planoId: pagamentoForm.planoId,
          valor: parseFloat(pagamentoForm.valor),
          dataVencimento: pagamentoForm.dataVencimento,
          formaPagamento: pagamentoForm.formaPagamento,
          observacao: pagamentoForm.observacao || null,
        }

      const res = await fetch(url, {
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

  const handleUpdatePagamentoStatus = async (pagamento: Pagamento, newStatus: Pagamento["status"]) => {
    try {
      const res = await fetch(`/api/pagamentos/${pagamento.id}`, {
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
  }

  const handleDeletePagamento = (pagamento: Pagamento) => {
    setPagamentoToDelete(pagamento)
    setShowDeletePagamentoDialog(true)
  }

  const handleConfirmDeletePagamento = async () => {
    if (!pagamentoToDelete) return

    setDeletingPagamento(true)
    try {
      const res = await fetch(`/api/pagamentos/${pagamentoToDelete.id}`, { method: "DELETE" })
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
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
        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-all border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlanos}</div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-all border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Clock className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pagamentosPendentes}</div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md hover:shadow-destructive/5 transition-all border-destructive/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/15 transition-colors">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.pagamentosAtrasados}</div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-all border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Wallet className="h-4 w-4 text-primary" />
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
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
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
                    <Button onClick={() => handleOpenPagamentoDialog()} className="shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all">
                      <Plus className="mr-2 h-4 w-4" />
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
                        <Select
                          value={pagamentoForm.membroId}
                          onValueChange={(v) => {
                            const defaults = getMemberPlanDefaults(v)
                            setPagamentoForm({
                              ...pagamentoForm,
                              membroId: v,
                              planoId: defaults.planoId,
                              valor: defaults.valor,
                            })
                            if (pagamentoErrors.membroId) {
                              setPagamentoErrors({ ...pagamentoErrors, membroId: "" })
                            }
                            if (pagamentoErrors.planoId || pagamentoErrors.valor) {
                              setPagamentoErrors({ ...pagamentoErrors, planoId: "", valor: "" })
                            }
                          }}
                          disabled={!!editingPagamento}
                        >
                          <SelectTrigger className={pagamentoErrors.membroId ? "border-destructive" : "border-input/50"}>
                            <SelectValue placeholder="Selecione o aluno" />
                          </SelectTrigger>
                          <SelectContent>
                            {membros.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.usuario.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {pagamentoErrors.membroId && (
                          <p className="text-xs text-destructive">{pagamentoErrors.membroId}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="plano" className={pagamentoErrors.planoId ? "text-destructive" : ""}>
                          Plano
                        </Label>
                        <Select
                          value={pagamentoForm.planoId}
                          onValueChange={(v) => {
                            const plano = planos.find((p) => p.id === v)
                            setPagamentoForm({
                              ...pagamentoForm,
                              planoId: v,
                              valor: plano ? String(plano.valor) : pagamentoForm.valor,
                            })
                            if (pagamentoErrors.planoId) {
                              setPagamentoErrors({ ...pagamentoErrors, planoId: "", valor: "" })
                            }
                          }}
                          disabled={!!editingPagamento}
                        >
                          <SelectTrigger className={pagamentoErrors.planoId ? "border-destructive" : "border-input/50"}>
                            <SelectValue placeholder="Selecione o plano" />
                          </SelectTrigger>
                          <SelectContent>
                            {groupedPlanosAtivos.planosGabi.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                  Planos com Gabi
                                </SelectLabel>
                                {groupedPlanosAtivos.planosGabi.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="pl-6">
                                    <span className="flex items-center gap-2">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                                      {p.nome} - {formatCurrency(p.valor)}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            {groupedPlanosAtivos.planosEstagiarios.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                                  Planos com Estagiários
                                </SelectLabel>
                                {groupedPlanosAtivos.planosEstagiarios.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="pl-6">
                                    <span className="flex items-center gap-2">
                                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                                      {p.nome} - {formatCurrency(p.valor)}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            {groupedPlanosAtivos.planosOutros.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-violet-500"></span>
                                  Outros Planos
                                </SelectLabel>
                                {groupedPlanosAtivos.planosOutros.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="pl-6">
                                    <span className="flex items-center gap-2">
                                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                                      {p.nome} - {formatCurrency(p.valor)}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                          </SelectContent>
                        </Select>
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
                            disabled={!!editingPagamento}
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
                            disabled={!!editingPagamento}
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
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                        {pagamentoToDelete?.membro?.usuario?.nome ? (
                          <strong>{pagamentoToDelete.membro.usuario.nome}</strong>
                        ) : (
                          "este aluno"
                        )}
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
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Excluindo...
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <DollarSign className="h-6 w-6 text-muted-foreground" />
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
                        <TableRow key={pagamento.id} className="hover:bg-primary/5">
                          <TableCell className="font-medium">
                            {pagamento.membro.usuario.nome}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center w-fit border-primary/30 text-primary">
                              <CreditCard className="mr-1 h-3 w-3" />
                              {pagamento.plano.nome}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
                          <TableCell>{formatDate(pagamento.dataVencimento)}</TableCell>
                          <TableCell>{getStatusBadge(pagamento.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {pagamento.status === "PENDENTE" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdatePagamentoStatus(pagamento, "PAGO")}
                                  title="Marcar como pago"
                                  className="hover:bg-primary/10 hover:text-primary"
                                >
                                  <Check className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenPagamentoDialog(pagamento)}
                                className="hover:bg-primary/10 hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePagamento(pagamento)}
                                className="hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
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
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0 lg:flex"
                      onClick={() => fetchPagamentos(1, searchPagamento, filterStatus, sortPagamento)}
                      disabled={currentPage === 1 || loadingPagamentos}
                    >
                      <span className="sr-only">Primeira página</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => fetchPagamentos(currentPage - 1, searchPagamento, filterStatus, sortPagamento)}
                      disabled={currentPage === 1 || loadingPagamentos}
                    >
                      <span className="sr-only">Página anterior</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => fetchPagamentos(currentPage + 1, searchPagamento, filterStatus, sortPagamento)}
                      disabled={currentPage === totalPages || loadingPagamentos}
                    >
                      <span className="sr-only">Próxima página</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0 lg:flex"
                      onClick={() => fetchPagamentos(totalPages, searchPagamento, filterStatus, sortPagamento)}
                      disabled={currentPage === totalPages || loadingPagamentos}
                    >
                      <span className="sr-only">Última página</span>
                      <ChevronsRight className="h-4 w-4" />
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
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
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
                    <Button onClick={() => handleOpenPlanoDialog()} className="shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all">
                      <Plus className="mr-2 h-4 w-4" />
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
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano cadastrado. Clique em &quot;Novo Plano&quot; para começar.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  <>
                    {groupedPlanos.planosGabi.length > 0 && (
                          <div>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30">
                                <span className="text-white text-sm font-bold">G</span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">Planos com Gabi</h3>
                                <p className="text-xs text-muted-foreground">Atendimento personalizado pela Gabi</p>
                              </div>
                              <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 ml-auto">
                                {groupedPlanos.planosGabi.length} {groupedPlanos.planosGabi.length === 1 ? 'plano' : 'planos'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {groupedPlanos.planosGabi.map((plano) => (
                                <Card key={plano.id} className={`${!plano.ativo ? "opacity-60" : ""} border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 dark:border-amber-800/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all`}>
                                  <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <CardTitle className="text-lg text-amber-900 dark:text-amber-100">{plano.nome}</CardTitle>
                                        {plano.descricao && (
                                          <CardDescription className="mt-1">
                                            {plano.descricao}
                                          </CardDescription>
                                        )}
                                      </div>
                                      {!plano.ativo && (
                                        <Badge variant="secondary">Inativo</Badge>
                                      )}
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                          {formatCurrency(plano.valor)}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                          /{plano.duracaoDias === 30 ? "mês" : plano.duracaoDias === 90 ? "trimestre" : plano.duracaoDias === 180 ? "semestre" : "ano"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <Calendar className="h-4 w-4 text-amber-500" />
                                          {plano.aulasSemanais === 7 ? "Ilimitado" : `${plano.aulasSemanais}x/semana`}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Users className="h-4 w-4 text-amber-500" />
                                          {plano._count?.membros || 0} alunos
                                        </div>
                                      </div>
                                      <div className="flex gap-2 pt-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="flex-1 hover:bg-amber-100 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/50"
                                          onClick={() => handleOpenPlanoDialog(plano)}
                                        >
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Editar
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTogglePlanoAtivo(plano)}
                                          className="hover:bg-amber-100 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/50"
                                        >
                                          {plano.ativo ? "Desativar" : "Ativar"}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeletePlano(plano)}
                                          className="hover:bg-destructive/10"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}

                        {groupedPlanos.planosEstagiarios.length > 0 && (
                          <div>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-md shadow-blue-500/30">
                                <span className="text-white text-sm font-bold">E</span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">Planos com Estagiários</h3>
                                <p className="text-xs text-muted-foreground">Atendimento pela equipe de estagiários</p>
                              </div>
                              <Badge className="bg-gradient-to-r from-sky-400 to-blue-500 text-white border-0 ml-auto">
                                {groupedPlanos.planosEstagiarios.length} {groupedPlanos.planosEstagiarios.length === 1 ? 'plano' : 'planos'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {groupedPlanos.planosEstagiarios.map((plano) => (
                                <Card key={plano.id} className={`${!plano.ativo ? "opacity-60" : ""} border-sky-200 bg-gradient-to-br from-sky-50/50 to-blue-50/30 dark:from-sky-950/20 dark:to-blue-950/10 dark:border-sky-800/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all`}>
                                  <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <CardTitle className="text-lg text-sky-900 dark:text-sky-100">{plano.nome}</CardTitle>
                                        {plano.descricao && (
                                          <CardDescription className="mt-1">
                                            {plano.descricao}
                                          </CardDescription>
                                        )}
                                      </div>
                                      {!plano.ativo && (
                                        <Badge variant="secondary">Inativo</Badge>
                                      )}
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                                          {formatCurrency(plano.valor)}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                          /{plano.duracaoDias === 30 ? "mês" : plano.duracaoDias === 90 ? "trimestre" : plano.duracaoDias === 180 ? "semestre" : "ano"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <Calendar className="h-4 w-4 text-sky-500" />
                                          {plano.aulasSemanais === 7 ? "Ilimitado" : `${plano.aulasSemanais}x/semana`}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Users className="h-4 w-4 text-sky-500" />
                                          {plano._count?.membros || 0} alunos
                                        </div>
                                      </div>
                                      <div className="flex gap-2 pt-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="flex-1 hover:bg-sky-100 hover:text-sky-700 hover:border-sky-300 dark:hover:bg-sky-950/50"
                                          onClick={() => handleOpenPlanoDialog(plano)}
                                        >
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Editar
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTogglePlanoAtivo(plano)}
                                          className="hover:bg-sky-100 hover:text-sky-700 hover:border-sky-300 dark:hover:bg-sky-950/50"
                                        >
                                          {plano.ativo ? "Desativar" : "Ativar"}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeletePlano(plano)}
                                          className="hover:bg-destructive/10"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}

                        {groupedPlanos.planosOutros.length > 0 && (
                          <div>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md shadow-purple-500/30">
                                <span className="text-white text-sm font-bold">+</span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">Outros Planos</h3>
                                <p className="text-xs text-muted-foreground">Planos especiais e personalizados</p>
                              </div>
                              <Badge className="bg-gradient-to-r from-violet-400 to-purple-500 text-white border-0 ml-auto">
                                {groupedPlanos.planosOutros.length} {groupedPlanos.planosOutros.length === 1 ? 'plano' : 'planos'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {groupedPlanos.planosOutros.map((plano) => (
                                <Card key={plano.id} className={`${!plano.ativo ? "opacity-60" : ""} border-violet-200 bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 dark:border-violet-800/30 hover:shadow-lg hover:shadow-purple-500/10 transition-all`}>
                                  <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <CardTitle className="text-lg text-violet-900 dark:text-violet-100">{plano.nome}</CardTitle>
                                        {plano.descricao && (
                                          <CardDescription className="mt-1">
                                            {plano.descricao}
                                          </CardDescription>
                                        )}
                                      </div>
                                      {!plano.ativo && (
                                        <Badge variant="secondary">Inativo</Badge>
                                      )}
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                                          {formatCurrency(plano.valor)}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                          /{plano.duracaoDias === 30 ? "mês" : plano.duracaoDias === 90 ? "trimestre" : plano.duracaoDias === 180 ? "semestre" : "ano"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <Calendar className="h-4 w-4 text-violet-500" />
                                          {plano.aulasSemanais === 7 ? "Ilimitado" : `${plano.aulasSemanais}x/semana`}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Users className="h-4 w-4 text-violet-500" />
                                          {plano._count?.membros || 0} alunos
                                        </div>
                                      </div>
                                      <div className="flex gap-2 pt-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="flex-1 hover:bg-violet-100 hover:text-violet-700 hover:border-violet-300 dark:hover:bg-violet-950/50"
                                          onClick={() => handleOpenPlanoDialog(plano)}
                                        >
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Editar
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTogglePlanoAtivo(plano)}
                                          className="hover:bg-violet-100 hover:text-violet-700 hover:border-violet-300 dark:hover:bg-violet-950/50"
                                        >
                                          {plano.ativo ? "Desativar" : "Ativar"}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeletePlano(plano)}
                                          className="hover:bg-destructive/10"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                  </>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
