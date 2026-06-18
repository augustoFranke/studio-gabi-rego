import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ReactNode } from "react"
import { Users, Calendar, DollarSign, TrendingUp, AlertCircle, Clock, type LucideIcon } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { unstable_cache } from "next/cache"
import { DiaSemana } from "@prisma/client"
import {
  addDaysYmd,
  getAppTimezone,
  getDateFromYmd,
  getTimeHmInTimeZone,
  getYmdInTimeZone,
} from "@/lib/dates"
import { formatCurrency } from '@/lib/currency'

export const dynamic = "force-dynamic"


const dayMap: DiaSemana[] = [
  DiaSemana.DOMINGO,
  DiaSemana.SEGUNDA,
  DiaSemana.TERCA,
  DiaSemana.QUARTA,
  DiaSemana.QUINTA,
  DiaSemana.SEXTA,
  DiaSemana.SABADO,
]

interface MetricCardProps {
  title: string
  value: ReactNode
  description?: string
  icon: LucideIcon
  progress?: number
}

interface NextAppointment {
  id: string
  presente: boolean | null
  membro: { usuario: { nome: string | null } }
  horario: { horaInicio: string; horaFim: string }
}

interface PendingPayment {
  id: string
  status: string
  valor: unknown
  dataVencimento: Date
  payerNome: string | null
  membro: { usuario: { nome: string | null } } | null
}

export default async function DashboardPage() {
  const now = new Date()
  const timeZone = getAppTimezone()
  const todayYmd = getYmdInTimeZone(now, timeZone)
  const currentTimeHm = getTimeHmInTimeZone(now, timeZone)
  const today = getDateFromYmd(todayYmd)
  const tomorrow = getDateFromYmd(addDaysYmd(todayYmd, 1))
  const diaSemanaHoje = dayMap[today.getDay()]

  const firstDayOfMonth = getDateFromYmd(`${todayYmd.slice(0, 7)}-01`)

  const getDashboardData = unstable_cache(
    async () => {
      const [
        membrosAtivos,
        agendamentosHoje,
        receitaMes,
        totalVagasHoje,
        proximosAgendamentos,
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
        prisma.agendamento.findMany({
          where: {
            OR: [
              {
                data: {
                  gt: today,
                },
              },
              {
                data: {
                  gte: today,
                  lt: tomorrow,
                },
                horario: {
                  horaInicio: {
                    gt: currentTimeHm,
                  },
                },
              },
            ],
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
          take: 5,
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
        proximosAgendamentos,
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
    proximosAgendamentos,
    pagamentosPendentes,
  } = await getDashboardData()

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

      <DashboardMetrics
        membrosAtivos={membrosAtivos}
        agendamentosHoje={agendamentosHoje}
        receitaMes={Number(receitaMes._sum.valor || 0)}
        ocupacaoHoje={ocupacaoHoje}
      />

      <DashboardLists
        proximosAgendamentos={proximosAgendamentos}
        pagamentosPendentes={pagamentosPendentes}
      />
    </div>
  )
}

function DashboardMetrics({
  membrosAtivos,
  agendamentosHoje,
  receitaMes,
  ocupacaoHoje,
}: {
  membrosAtivos: number
  agendamentosHoje: number
  receitaMes: number
  ocupacaoHoje: number
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard title="Alunos Ativos" value={membrosAtivos} description="Total de alunos ativos" icon={Users} />
      <MetricCard title="Aulas Hoje" value={agendamentosHoje} description="Agendamentos para hoje" icon={Calendar} />
      <MetricCard title="Receita do Mês" value={formatCurrency(receitaMes)} description="Total recebido este mês" icon={DollarSign} />
      <MetricCard title="Taxa de Ocupação" value={`${ocupacaoHoje}%`} icon={TrendingUp} progress={ocupacaoHoje} />
    </div>
  )
}

function MetricCard({ title, value, description, icon: Icon, progress }: MetricCardProps) {
  return (
    <Card className="group hover:shadow-md hover:shadow-primary/5 transition-shadow border-primary/10">
      <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          <Icon className="size-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        {typeof progress === "number" ? (
          <div className="flex items-center pt-1">
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function DashboardLists({
  proximosAgendamentos,
  pagamentosPendentes,
}: {
  proximosAgendamentos: NextAppointment[]
  pagamentosPendentes: PendingPayment[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <UpcomingAppointments appointments={proximosAgendamentos} />
      <PendingPayments payments={pagamentosPendentes} />
    </div>
  )
}

function UpcomingAppointments({ appointments }: { appointments: NextAppointment[] }) {
  return (
    <Card className="col-span-1 border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="size-4 text-primary" />
          </div>
          Próximas Aulas
        </CardTitle>
        <CardDescription>Agendamentos para as próximas horas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {appointments.length > 0 ? appointments.map((agendamento) => (
            <div key={agendamento.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
              <div className="flex flex-col">
                <span className="font-medium text-sm">{agendamento.membro.usuario.nome || "Aluno"}</span>
                <span className="text-xs text-muted-foreground">{agendamento.horario.horaInicio} - {agendamento.horario.horaFim}</span>
              </div>
              <Badge
                variant={agendamento.presente === true ? "default" : "outline"}
                className={agendamento.presente === true ? "bg-primary" : "border-primary/30 text-primary"}
              >
                {agendamento.presente === true ? "Presente" : "Agendado"}
              </Badge>
            </div>
          )) : <EmptyDashboardList icon={Calendar} message="Nenhum agendamento encontrado para hoje." />}
        </div>
      </CardContent>
    </Card>
  )
}

function PendingPayments({ payments }: { payments: PendingPayment[] }) {
  return (
    <Card className="col-span-1 border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="size-4 text-destructive" />
          </div>
          Pagamentos Pendentes
        </CardTitle>
        <CardDescription>Alunos com pagamento em atraso ou pendente</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.length > 0 ? payments.map((pagamento) => (
            <div key={pagamento.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
              <div className="flex flex-col">
                <span className="font-medium text-sm">{pagamento.membro?.usuario?.nome || pagamento.payerNome || 'Pagador nao vinculado'}</span>
                <span className="text-xs text-muted-foreground">Vence em {format(new Date(pagamento.dataVencimento), "dd/MM/yyyy")}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-bold text-sm">{formatCurrency(Number(pagamento.valor))}</span>
                <Badge variant={pagamento.status === 'ATRASADO' ? "destructive" : "secondary"} className="text-[10px] h-5">
                  {pagamento.status}
                </Badge>
              </div>
            </div>
          )) : <EmptyDashboardList icon={DollarSign} message="Nenhum pagamento pendente encontrado." />}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyDashboardList({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
