import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  Check,
  Clock,
  AlertCircle,
  XCircle,
  Pencil,
  ClipboardList
} from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface MembroPageProps {
  params: Promise<{
    id: string
  }>
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
  }
  return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
}

function getStatusBadge(status: "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO") {
  const variants: Record<typeof status, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
    PAGO: { variant: "default", icon: <Check className="h-3 w-3" />, label: "Pago" },
    PENDENTE: { variant: "secondary", icon: <Clock className="h-3 w-3" />, label: "Pendente" },
    ATRASADO: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" />, label: "Atrasado" },
    CANCELADO: { variant: "outline", icon: <XCircle className="h-3 w-3" />, label: "Cancelado" },
  }
  const { variant, icon, label } = variants[status]
  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {label}
    </Badge>
  )
}

function getMemberStatusBadge(status: "ATIVO" | "INATIVO" | "PENDENTE") {
  const variants: Record<typeof status, "default" | "destructive" | "secondary"> = {
    ATIVO: "default",
    INATIVO: "destructive",
    PENDENTE: "secondary",
  }
  return <Badge variant={variants[status]}>{status}</Badge>
}

export default async function MembroPage({ params }: MembroPageProps) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const { id } = await params

  const membro = await prisma.membro.findUnique({
    where: { id },
    include: {
      usuario: true,
      plano: true,
      pagamentos: {
        include: {
          plano: true,
        },
        orderBy: {
          dataVencimento: "desc",
        },
        take: 10,
      },
      fichasTreino: {
        where: { ativo: true },
        orderBy: { criadoEm: 'desc' },
        take: 1,
      },
    },
  })

  if (!membro) {
    notFound()
  }

  // Authorization check: Only ADMIN or the member themselves can access
  if (session.user.role !== "ADMIN" && session.user.membroId !== membro.id) {
    redirect("/meus-dados")
  }

  // Calculate age outside of the render return for purity
  let idade: number | null = null
  if (membro.dataNascimento) {
    const nascimento = new Date(membro.dataNascimento)
    const hoje = new Date()
    idade = hoje.getFullYear() - nascimento.getFullYear()
    const m = hoje.getMonth() - nascimento.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--
    }
  }

  // Calculate payment stats
  const pagamentosPagos = membro.pagamentos.filter(p => p.status === "PAGO").length
  const pagamentosPendentes = membro.pagamentos.filter(p => p.status === "PENDENTE").length
  const pagamentosAtrasados = membro.pagamentos.filter(p => p.status === "ATRASADO").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/membros">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{membro.usuario.nome}</h1>
              {getMemberStatusBadge(membro.status)}
            </div>
            <p className="text-muted-foreground">
              Membro desde {format(new Date(membro.criadoEm), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/membros/${id}/anamnese`}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Anamnese
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/membros/${id}/editar`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Personal Data Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados Pessoais
            </CardTitle>
            <CardDescription>
              Informações básicas do membro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CPF</p>
                <p className="text-sm">{formatCPF(membro.cpf)}</p>
              </div>
              {membro.rg && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">RG</p>
                  <p className="text-sm">{membro.rg}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data de Nascimento
              </p>
              <p className="text-sm">
                {membro.dataNascimento ? (
                  <>
                    {format(new Date(membro.dataNascimento), "dd/MM/yyyy")}
                    {" "}
                    <span className="text-muted-foreground">
                      ({idade} anos)
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Não informado</span>
                )}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Telefone
              </p>
              <p className="text-sm">{membro.telefone ? formatPhone(membro.telefone) : <span className="text-muted-foreground">Não informado</span>}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </p>
              <p className="text-sm">{membro.usuario.email}</p>
            </div>

            {membro.observacoes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Observações</p>
                <p className="text-sm text-muted-foreground">{membro.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plano Atual
            </CardTitle>
            <CardDescription>
              Informações do plano contratado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membro.plano ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold">{membro.plano.nome}</p>
                    {membro.plano.descricao && (
                      <p className="text-sm text-muted-foreground">{membro.plano.descricao}</p>
                    )}
                  </div>
                  <Badge variant={membro.plano.ativo ? "default" : "secondary"}>
                    {membro.plano.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Valor</p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {(membro as any).precoCustomizado ? (
                        <>
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(Number((membro as any).precoCustomizado))}
                          </p>
                          <p className="text-sm text-muted-foreground line-through">
                            {formatCurrency(Number(membro.plano.valor))}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            Personalizado
                          </Badge>
                        </>
                      ) : (
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(Number(membro.plano.valor))}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Duração</p>
                    <p className="text-sm">
                      {membro.plano.duracaoDias === 30 ? "Mensal" :
                        membro.plano.duracaoDias === 90 ? "Trimestral" :
                          membro.plano.duracaoDias === 180 ? "Semestral" :
                            membro.plano.duracaoDias === 365 ? "Anual" :
                              `${membro.plano.duracaoDias} dias`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Aulas por Semana</p>
                    <p className="text-sm">
                      {membro.plano.aulasSemanais === 7 ? "Ilimitado" : `${membro.plano.aulasSemanais}x/semana`}
                    </p>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium mb-2">Resumo de Pagamentos</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2">
                      <p className="text-lg font-bold text-green-600">{pagamentosPagos}</p>
                      <p className="text-xs text-muted-foreground">Pagos</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-2">
                      <p className="text-lg font-bold text-yellow-600">{pagamentosPendentes}</p>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 rounded-lg p-2">
                      <p className="text-lg font-bold text-red-600">{pagamentosAtrasados}</p>
                      <p className="text-xs text-muted-foreground">Atrasados</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum plano atribuído</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/membros/${id}/editar`}>Atribuir Plano</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Training Sheet Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Ficha de Treino
              </CardTitle>
              <CardDescription>
                Treino atual do membro
              </CardDescription>
            </div>
            {membro.fichasTreino.length > 0 && (
              <Button variant="outline" asChild>
                <Link href={`/treinos?membro=${id}`}>Ver Treino Completo</Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {membro.fichasTreino.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{membro.fichasTreino[0].nome}</p>
                <Badge variant={membro.fichasTreino[0].ativo ? "default" : "secondary"}>
                  {membro.fichasTreino[0].ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {membro.fichasTreino[0].objetivo && (
                <p className="text-sm text-muted-foreground">
                  Objetivo: {membro.fichasTreino[0].objetivo}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Atualizado em {format(new Date(membro.fichasTreino[0].atualizadoEm), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma ficha de treino cadastrada</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href={`/treinos?novo=true&membro=${id}`}>Criar Ficha de Treino</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Pagamentos</CardTitle>
              <CardDescription>
                Últimos 10 pagamentos registrados
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/financeiro?membro=${id}`}>Ver Todos</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {membro.pagamentos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membro.pagamentos.map((pagamento) => (
                  <TableRow key={pagamento.id}>
                    <TableCell className="font-medium">{pagamento.plano.nome}</TableCell>
                    <TableCell>{formatCurrency(Number(pagamento.valor))}</TableCell>
                    <TableCell>{format(new Date(pagamento.dataVencimento), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      {pagamento.dataPagamento
                        ? format(new Date(pagamento.dataPagamento), "dd/MM/yyyy")
                        : "-"
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(pagamento.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum pagamento registrado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
