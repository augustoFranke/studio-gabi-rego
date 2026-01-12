import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dumbbell, Plus, Calendar, User, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { prisma } from "@/lib/prisma"

async function getTreinos() {
  const treinos = await prisma.fichaTreino.findMany({
    where: { ativo: true },
    include: {
      membro: {
        include: {
          usuario: {
            select: { nome: true },
          },
        },
      },
      exercicios: {
        orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
      },
    },
    orderBy: { criadoEm: 'desc' },
  })
  return treinos
}

export default async function TreinosPage() {
  const treinos = await getTreinos()

  // Group exercises by session
  const groupExercisesBySession = (exercicios: { sessao: string }[]) => {
    const sessions = new Set(exercicios.map(e => e.sessao))
    return Array.from(sessions).sort()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Treinos</h1>
          <p className="text-muted-foreground">
            Crie e gerencie fichas de treino para os membros
          </p>
        </div>
        <Link href="/treinos/gerador">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Treino
          </Button>
        </Link>
      </div>

      {treinos.length === 0 ? (
        <Card className="border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Fichas de Treino</CardTitle>
                <CardDescription>
                  Todas as fichas de treino cadastradas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Dumbbell className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground text-center">
                Nenhuma ficha de treino cadastrada.
              </p>
              <p className="text-sm text-muted-foreground/70 text-center mt-1">
                Comece criando uma nova ficha de treino para seus alunos.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {treinos.map((treino) => {
            const sessions = groupExercisesBySession(treino.exercicios)
            return (
              <Card key={treino.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {treino.membro.usuario.nome}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {treino.data || new Date(treino.criadoEm).toLocaleDateString('pt-BR')}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{treino.exercicios.length} exercícios</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {sessions.map((session) => (
                      <Badge key={session} variant="outline" className="text-xs">
                        Treino {session}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/treinos/${treino.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Ver Detalhes
                      </Button>
                    </Link>
                    <Link href={`/api/treinos/${treino.id}/pdf`}>
                      <Button variant="ghost" size="sm">
                        <Printer className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
