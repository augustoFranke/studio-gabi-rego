import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dumbbell, Plus, Calendar, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { isValidTreinoDate } from "@/lib/dates"

export const dynamic = "force-dynamic"

async function getTreinos() {
  const treinos = await prisma.fichaTreino.findMany({
    where: { ativo: true },
    select: {
      id: true,
      data: true,
      criadoEm: true,
      membro: {
        select: {
          usuario: {
            select: { nome: true },
          },
        },
      },
      exercicios: {
        select: { sessao: true },
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
            Crie e gerencie fichas de treino para os alunos
          </p>
        </div>
        <Link href="/treinos/gerador">
          <Button>
            <Plus className="mr-2 size-4" />
            Novo Treino
          </Button>
        </Link>
      </div>

      {treinos.length === 0 ? (
        <Card className="border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Dumbbell className="size-5 text-primary" />
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
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Dumbbell className="size-8 text-primary" />
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
        <div className="rounded-md border border-border/50 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Aluno</TableHead>
                <TableHead>Sessões</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treinos.map((treino) => {
                const sessions = groupExercisesBySession(treino.exercicios)
                const parsedDate = treino.data ? new Date(treino.data) : new Date(treino.criadoEm)
                const displayDate = treino.data && isValidTreinoDate(treino.data)
                  ? treino.data
                  : Number.isNaN(parsedDate.getTime())
                    ? new Date(treino.criadoEm).toLocaleDateString('pt-BR')
                    : parsedDate.toLocaleDateString('pt-BR')
                return (
                  <TableRow key={treino.id} className="hover:bg-primary/5">
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{treino.membro.usuario.nome}</span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{treino.exercicios.length} exercícios</Badge>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {displayDate}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {sessions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {sessions.map((session) => (
                            <Badge key={session} variant="outline" className="text-xs">
                              Treino {session}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sem sessões</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm" className="hover:border-primary/40 hover:text-primary">
                          <Link href={`/treinos/${treino.id}`}>Ver Detalhes</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                          <Link href={`/api/treinos/${treino.id}/pdf`}>
                            <Printer className="size-4" />
                            <span className="sr-only">Baixar PDF</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
