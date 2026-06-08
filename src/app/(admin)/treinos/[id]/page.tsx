import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Calendar, Dumbbell, Edit, Printer, User } from 'lucide-react'
import Link from 'next/link'
import { TreinoTemplateButton } from '@/components/admin/treino-template-button'
import type { TreinoExercise } from '@/domain/treino'

export const dynamic = 'force-dynamic'

type TreinoDetalhe = {
  id: string
  nome: string
  data: string | null
  criadoEm: Date
  objetivo: string | null
  observacoes: string | null
  membro: {
    usuario: {
      nome: string | null
    }
  }
  exercicios: TreinoExercise[]
}

interface PageProps {
  params: Promise<{
    id: string
  }>
}

async function getTreino(id: string): Promise<TreinoDetalhe | null> {
  const treino = await prisma.fichaTreino.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      data: true,
      criadoEm: true,
      objetivo: true,
      observacoes: true,
      membro: {
        select: {
          usuario: {
            select: { nome: true },
          },
        },
      },
      exercicios: {
        select: {
          id: true,
          sessao: true,
          nome: true,
          grupoMuscular: true,
          series: true,
          repeticoes: true,
          observacoes: true,
        },
        orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
      },
    },
  })
  return treino
}

export default async function TreinoDetalhesPage({ params }: PageProps) {
  const { id } = await params
  const treino = await getTreino(id)

  if (!treino) {
    notFound()
  }

  // Group exercises by session
  const exerciciosPorSessao = treino.exercicios.reduce((acc, exercicio) => {
    if (!acc[exercicio.sessao]) {
      acc[exercicio.sessao] = []
    }
    acc[exercicio.sessao].push(exercicio)
    return acc
  }, {} as Record<string, typeof treino.exercicios>)

  const sessoes = Object.keys(exerciciosPorSessao).sort()
  const templateDefaultName = `${treino.nome} - ${treino.membro.usuario.nome}`

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/treinos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Detalhes do Treino</h1>
            <p className="text-muted-foreground">Visualize o plano de treino completo</p>
          </div>
        </div>

        <div className="flex gap-2">
          <TreinoTemplateButton treinoId={treino.id} defaultName={templateDefaultName} />
          <Link href={`/treinos/${treino.id}/editar`}>
            <Button variant="outline" className="gap-2">
              <Edit className="size-4" />
              Editar
            </Button>
          </Link>
          <Link href={`/api/treinos/${treino.id}/pdf`}>
            <Button className="gap-2">
              <Printer className="size-4" />
              Imprimir
            </Button>
          </Link>
        </div>
      </div>

      <Separator />

      {/* Member Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="size-4" />
                Aluno
              </p>
              <p className="text-lg font-semibold">{treino.membro.usuario.nome}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="size-4" />
                Data
              </p>
              <p className="text-lg font-semibold">
                {treino.data || new Date(treino.criadoEm).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Dumbbell className="size-4" />
                Total de Exercícios
              </p>
              <p className="text-lg font-semibold">{treino.exercicios.length} exercícios</p>
            </div>
          </div>
          {treino.objetivo && (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Objetivo</p>
              <p className="text-base">{treino.objetivo}</p>
            </div>
          )}
          {treino.observacoes && (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Observações</p>
              <p className="text-base">{treino.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessions */}
      <div className="grid grid-cols-1 gap-6">
        {sessoes.map((sessao) => {
          // Extract just the letter from session name (e.g., "A - Costas" → "A")
          const sessionLetter = sessao.charAt(0)
          return (
          <Card key={sessao} className="relative overflow-hidden shadow-[inset_4px_0_0_hsl(var(--primary))]">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-sm">
                  {sessionLetter}
                </div>
                Treino {sessao}
                <Badge variant="secondary" className="ml-auto">
                  {exerciciosPorSessao[sessao].length} exercícios
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-1 text-sm font-medium text-muted-foreground border-b pb-2">
                  <div className="col-span-5">Exercício</div>
                  <div className="col-span-2 text-center">Séries</div>
                  <div className="col-span-2 text-center">Repetições</div>
                  <div className="col-span-3">Observações</div>
                </div>

                {/* Exercises */}
                {exerciciosPorSessao[sessao].map((exercicio, index) => (
                  <div
                    key={exercicio.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-card md:bg-transparent p-3 md:p-2 rounded-lg border md:border-0 shadow-sm md:shadow-none hover:bg-muted/50 transition-colors"
                  >
                    <div className="col-span-1 md:col-span-5 w-full flex items-center gap-3">
                      <span className="hidden md:flex items-center justify-center size-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{exercicio.nome}</p>
                        {exercicio.grupoMuscular && (
                          <p className="text-xs text-muted-foreground">{exercicio.grupoMuscular}</p>
                        )}
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 flex md:block">
                      <span className="md:hidden text-xs text-muted-foreground mr-2">Séries:</span>
                      <p className="text-center font-medium">{exercicio.series}</p>
                    </div>

                    <div className="col-span-1 md:col-span-2 flex md:block">
                      <span className="md:hidden text-xs text-muted-foreground mr-2">Reps:</span>
                      <p className="text-center font-medium">{exercicio.repeticoes}</p>
                    </div>

                    <div className="col-span-1 md:col-span-3 flex md:block">
                      <span className="md:hidden text-xs text-muted-foreground mr-2">Observações:</span>
                      <p className="text-sm text-muted-foreground">{exercicio.observacoes || '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )})}
      </div>

      {sessoes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Dumbbell className="size-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Nenhum exercício cadastrado neste treino.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
