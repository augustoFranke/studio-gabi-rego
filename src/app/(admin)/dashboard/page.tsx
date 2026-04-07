import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, DollarSign, TrendingUp, AlertCircle, Clock } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { unstable_cache } from "next/cache"
import { DiaSemana } from "@prisma/client"
import {
  addDaysYmd,
  combineYmdAndTime,
  getAppTimezone,
  getDateFromYmd,
  getTimeHmInTimeZone,
  getYmdInTimeZone,
} from "@/lib/dates"

export const dynamic = "force-dynamic"

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const dayMap: DiaSemana[] = [
  DiaSemana.DOMINGO,
  DiaSemana.SEGUNDA,
  DiaSemana.TERCA,
  DiaSemana.QUARTA,
  DiaSemana.QUINTA,
  DiaSemana.SEXTA,
  DiaSemana.SABADO,
]

export default async function DashboardPage() {
  const now = new Date()
  const timeZone = getAppTimezone()
  const todayYmd = getYmdInTimeZone(now, timeZone)
  const currentTimeHm = getTimeHmInTimeZone(now, timeZone)
  const today = getDateFromYmd(todayYmd)
  const tomorrow = getDateFromYmd(addDaysYmd(todayYmd, 1))
  const diaSemanaHoje = dayMap[today.getDay()]

  const firstDayOfMonth = getDateFromYmd(`${todayYmd.slice(0, 7)}-01`)
  const currentDateTimeKey = combineYmdAndTime(todayYmd, currentTimeHm)

  const getDashboardData = unstable_cache(
    async () => {
      const [
        membrosAtivos,
        agendamentosHoje,
        receitaMes,
        totalVagasHoje,
        todosAgendamentos,
        pagamentosPendentes,
      ] = await Promise.all([
        prisma.membro.count({ where: { status: 'ATIVO' } }),
        prisma.agendamento.count({
          where: {
            data: {
              gte: today,
              lt: tomorrow,
            }
          }
        }),
        prisma.pagamento.aggregate({
          where: {
            status: 'PAGO',
            dataPagamento: {
              gte: firstDayOfMonth,
            }
          },
          _sum: {
            valor: true
          }
        }),
        prisma.horarioDisponivel.aggregate({
          where: {
            ativo: true,
            diaSemana: diaSemanaHoje,
          },
          _sum: {
            vagasTotal: true
          }
        }),
        // Fetch more to allow for filtering
        prisma.agendamento.findMany({
          where: {
            data: {
              gte: today,
            }
          },
          select: {
            id: true,
            data: true,
            presente: true,
            membro: {
              select: {
                usuario: {
                  select: { nome: true },
                },
              },
            },
            horario: {
              select: {
                horaInicio: true,
                horaFim: true,
              },
            },
          },
          orderBy: [
            { data: 'asc' },
            { horario: { horaInicio: 'asc' } }
          ],
          take: 100 // Increased from 20 to ensure we get upcoming classes even if many passed
        }),
        prisma.pagamento.findMany({
          where: {
            status: {
              in: ['PENDENTE', 'ATRASADO']
            }
          },
          select: {
            id: true,
            status: true,
            valor: true,
            dataVencimento: true,
            payerNome: true,
            membro: {
              select: {
                usuario: {
                  select: { nome: true },
                },
              },
            },
          },
          orderBy: {
            dataVencimento: 'asc'
          },
          take: 5
        })
      ])

      return {
        membrosAtivos,
        agendamentosHoje,
        receitaMes,
        totalVagasHoje,
        todosAgendamentos,
        pagamentosPendentes,
      }
    },
    ['dashboard-metrics', todayYmd],
    { revalidate: 30 }
  )

  const {
    membrosAtivos,
    agendamentosHoje,
    receitaMes,
    totalVagasHoje,
    todosAgendamentos,
    pagamentosPendentes,
  } = await getDashboardData()

  // Filter appointments to show only upcoming classes (not classes that already happened today)
  const proximosAgendamentos = todosAgendamentos.filter((agendamento) => {
    const scheduledYmd = getYmdInTimeZone(agendamento.data, timeZone)
    const scheduledKey = combineYmdAndTime(scheduledYmd, agendamento.horario.horaInicio)
    return scheduledKey > currentDateTimeKey
  }).slice(0, 5) // Take only the first 5 after filtering

  const ocupacaoHoje = totalVagasHoje._sum.vagasTotal
    ? Math.round((agendamentosHoje / totalVagasHoje._sum.vagasTotal) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu estúdio - {format(today, "dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Alunos Ativos
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{membrosAtivos}</div>
            <p className="text-xs text-muted-foreground">
              Total de alunos ativos
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Aulas Hoje
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agendamentosHoje}</div>
            <p className="text-xs text-muted-foreground">
              Agendamentos para hoje
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Receita do Mês
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Number(receitaMes._sum.valor || 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Total recebido este mês
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md hover:shadow-primary/5 transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Ocupação
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ocupacaoHoje}%</div>
            <div className="flex items-center pt-1">
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-500"
                  style={{ width: `${Math.min(ocupacaoHoje, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="col-span-1 border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              Próximas Aulas
            </CardTitle>
            <CardDescription>
              Agendamentos para as próximas horas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proximosAgendamentos.length > 0 ? (
                proximosAgendamentos.map((agendamento) => (
                  <div key={agendamento.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {agendamento.membro.usuario.nome}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {agendamento.horario.horaInicio} - {agendamento.horario.horaFim}
                      </span>
                    </div>
                    <Badge
                      variant={agendamento.presente === true ? "default" : "outline"}
                      className={agendamento.presente === true ? "bg-primary" : "border-primary/30 text-primary"}
                    >
                      {agendamento.presente === true ? "Presente" : "Agendado"}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nenhum agendamento encontrado para hoje.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              Pagamentos Pendentes
            </CardTitle>
            <CardDescription>
              Alunos com pagamento em atraso ou pendente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pagamentosPendentes.length > 0 ? (
                pagamentosPendentes.map((pagamento) => (
                  <div key={pagamento.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {pagamento.membro?.usuario?.nome || pagamento.payerNome || 'Pagador nao vinculado'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Vence em {format(new Date(pagamento.dataVencimento), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-sm">
                        {formatCurrency(Number(pagamento.valor))}
                      </span>
                      <Badge
                        variant={pagamento.status === 'ATRASADO' ? "destructive" : "secondary"}
                        className="text-[10px] h-5"
                      >
                        {pagamento.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <DollarSign className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nenhum pagamento pendente encontrado.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
