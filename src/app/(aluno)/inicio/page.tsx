import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Calendar, Dumbbell, Clock, CheckCircle2, ArrowRight } from "lucide-react"
import { format, startOfWeek, endOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import {
  combineYmdAndTime,
  getAppTimezone,
  getDateFromYmd,
  getTimeHmInTimeZone,
  getYmdInTimeZone,
} from "@/lib/dates"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Início | Gabi Rego Studio",
  description: "Resumo da agenda e dos próximos treinos no Gabi Rego Studio.",
}

export default async function MemberDashboard() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  // Fetch membro from database (session.user.membroId may be stale if user just completed profile)
  const membro = await prisma.membro.findUnique({
    where: { usuarioId: session.user.id },
    select: { id: true },
  })

  if (!membro) {
    // User hasn't completed profile yet - redirect to onboarding
    redirect("/completar-perfil")
  }

  const membroId = membro.id
  const firstName = session.user.name?.split(' ')[0] || 'Aluno'
  const now = new Date()
  const timeZone = getAppTimezone()
  const todayYmd = getYmdInTimeZone(now, timeZone)
  const currentTimeHm = getTimeHmInTimeZone(now, timeZone)
  const today = getDateFromYmd(todayYmd)
  const nowKey = combineYmdAndTime(todayYmd, currentTimeHm)
  const startWeek = startOfWeek(today, { weekStartsOn: 1 })
  const endWeek = endOfWeek(today, { weekStartsOn: 1 })

  // Parallel data fetching
  const [upcomingClasses, classesScheduledCount, classesAttendedCount] = await Promise.all([
    prisma.agendamento.findMany({
      where: {
        membroId,
        data: {
          gte: today,
        },
      },
      orderBy: [
        { data: 'asc' },
        { horario: { horaInicio: 'asc' } }
      ],
      take: 50,
      select: {
        data: true,
        presente: true,
        horario: {
          select: {
            horaInicio: true,
            horaFim: true,
          },
        },
      },
    }),

    prisma.agendamento.count({
      where: {
        membroId,
        data: {
          gte: startWeek,
          lte: endWeek
        }
      }
    }),
    prisma.agendamento.count({
      where: {
        membroId,
        data: {
          gte: startWeek,
          lte: endWeek
        },
        presente: true,
      }
    }),
  ])

  const nextClass = upcomingClasses.find((agendamento) => {
    const scheduledYmd = getYmdInTimeZone(agendamento.data, timeZone)
    const scheduledKey = combineYmdAndTime(scheduledYmd, agendamento.horario.horaInicio)
    return scheduledKey > nowKey
  }) ?? null
  const nextClassDate = nextClass
    ? getDateFromYmd(getYmdInTimeZone(nextClass.data, timeZone))
    : null

  // Process Weekly Stats
  const classesAttended = classesAttendedCount
  const classesScheduled = classesScheduledCount
  
  // Determine greeting based on time of day
  const hour = Number(currentTimeHm.split(':')[0] || '0')
  let greeting = "Olá"
  if (hour < 12) greeting = "Bom dia"
  else if (hour < 18) greeting = "Boa tarde"
  else greeting = "Boa noite"

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}, {firstName}!</h1>
          <p className="text-muted-foreground">
            Vamos treinar? Aqui está o resumo da sua semana.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <Button asChild>
            <Link href="/minha-agenda">
              <Calendar className="mr-2 size-4" />
              Ver Agenda
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/meu-treino">
              <Dumbbell className="mr-2 size-4" />
              Treino
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Next Class Card */}
        <Card className="col-span-full md:col-span-1 lg:col-span-2 shadow-[inset_4px_0_0_hsl(var(--primary))]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-primary" />
              Próxima Aula
            </CardTitle>
            <CardDescription>Seu próximo compromisso agendado</CardDescription>
          </CardHeader>
          <CardContent>
            {nextClass ? (
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                <div className="space-y-1">
                  <p className="font-medium text-lg capitalize">
                    {format(nextClassDate ?? nextClass.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" />
                    <span>
                      {nextClass.horario.horaInicio} - {nextClass.horario.horaFim}
                    </span>
                  </div>
                </div>
                <Badge variant={nextClass.presente ? "default" : "outline"} className="ml-2">
                  {nextClass.presente ? "Confirmado" : "Agendado"}
                </Badge>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-y-3">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="size-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Nenhuma aula agendada</p>
                  <p className="text-sm text-muted-foreground">Que tal marcar seu próximo treino?</p>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/minha-agenda">Agendar Agora</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Progress Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-500" />
              Frequência Semanal
            </CardTitle>
            <CardDescription>Sua dedicação nesta semana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-2 gap-y-4">
              <div className="relative flex items-center justify-center">
                <div className="text-4xl font-bold">
                  {classesAttended}<span className="text-muted-foreground text-xl">/{classesScheduled}</span>
                </div>
              </div>
              <p className="text-sm text-center text-muted-foreground">
                {classesAttended > 0 
                  ? "Parabéns! Continue firme nos treinos." 
                  : "Comece a semana treinando!"}
              </p>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-green-500 h-full transition-[width] duration-1000" 
                  style={{ width: `${classesScheduled > 0 ? (classesAttended / classesScheduled) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Grid */}
      <h2 className="text-lg font-semibold tracking-tight mt-8 mb-4">Acesso Rápido</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/meu-treino" className="group">
          <Card className="h-full transition-colors hover:bg-muted/50 hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Meu Treino
                <ArrowRight className="size-4 opacity-0 -translate-x-2 transition-[opacity,transform] group-hover:opacity-100 group-hover:translate-x-0" />
              </CardTitle>
              <CardDescription>Acesse sua ficha atual</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/minha-agenda" className="group">
          <Card className="h-full transition-colors hover:bg-muted/50 hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Histórico
                <ArrowRight className="size-4 opacity-0 -translate-x-2 transition-[opacity,transform] group-hover:opacity-100 group-hover:translate-x-0" />
              </CardTitle>
              <CardDescription>Veja suas aulas passadas</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
