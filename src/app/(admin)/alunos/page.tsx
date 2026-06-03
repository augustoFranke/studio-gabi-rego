import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, MoreHorizontal, Phone, Mail, User, CreditCard, Users } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { MemberDeactivateItem, MemberStatusToggle } from "@/components/admin/member-actions"
import { Prisma, StatusMembro } from "@prisma/client"
import { Pagination } from "@/components/ui/pagination-custom"
import { AlunosFilters } from "@/components/admin/alunos-filters"
import { normalizeEmail } from "@/lib/email"
import { unstable_cache } from "next/cache"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; plano?: string; page?: string; order?: string }>
}) {
  const { search, status, plano, page, order } = await searchParams
  const currentPage = Number(page) || 1
  const itemsPerPage = 10
  const skip = (currentPage - 1) * itemsPerPage

  const where: Prisma.MembroWhereInput = {}

  if (search) {
    where.OR = [
      { usuario: { nome: { contains: search, mode: 'insensitive' } } },
      { cpf: { contains: search } },
      { usuario: { email: { contains: search, mode: 'insensitive' } } },
    ]
  }

  if (status && status !== 'todos') {
    where.status = status as StatusMembro
  }

  if (plano && plano !== 'todos') {
    where.planoId = plano
  }

  const orderBy: Prisma.MembroOrderByWithRelationInput =
    order === "nome_asc"
      ? { usuario: { nome: "asc" } }
      : { criadoEm: "desc" }

  const getPlanos = unstable_cache(
    async () => prisma.plano.findMany({
      where: { ativo: true },
      select: { id: true, nome: true }
    }),
    ['planos-ativos'],
    { revalidate: 60 }
  )

  const [totalMembros, membros, planos] = await Promise.all([
    prisma.membro.count({ where }),
    prisma.membro.findMany({
      where,
      select: {
        id: true,
        cpf: true,
        telefone: true,
        status: true,
        usuario: {
          select: {
            nome: true,
            email: true,
          },
        },
        plano: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy,
      skip,
      take: itemsPerPage,
    }),
    getPlanos()
  ])

  const totalPages = Math.ceil(totalMembros / itemsPerPage)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alunos</h1>
          <p className="text-muted-foreground">
            Gerencie os alunos do seu estúdio ({totalMembros} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-shadow">
            <Link href="/alunos/novo">
              <Plus className="mr-2 size-4" />
              Novo Aluno
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-primary/10">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle>Filtros</CardTitle>
                <CardDescription>
                  Refine sua busca por alunos
                </CardDescription>
              </div>
            </div>
            <Suspense>
              <AlunosFilters
                search={search}
                status={status}
                plano={plano}
                order={order}
                planos={planos}
              />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Aluno</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membros.length > 0 ? (
                  membros.map((membro) => {
                    const email = normalizeEmail(membro.usuario.email)
                    return (
                      <TableRow key={membro.id} className="hover:bg-primary/5">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{membro.usuario.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {membro.cpf ? membro.cpf : "Não informado"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-xs">
                            <Phone className="mr-1.5 size-3 text-primary" />
                            {membro.telefone ? membro.telefone : "Não informado"}
                          </div>
                          <div className="flex items-center text-xs">
                            <Mail className="mr-1.5 size-3 text-primary" />
                            {email ? email : <span className="text-muted-foreground">Não informado</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {membro.plano ? (
                          <Badge variant="outline" className="flex items-center w-fit border-primary/30 text-primary">
                            <CreditCard className="mr-1 size-3" />
                            {membro.plano.nome}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem plano</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            membro.status === 'ATIVO' ? "default" :
                              membro.status === 'INATIVO' ? "destructive" : "secondary"
                          }
                          className={membro.status === 'ATIVO' ? "bg-primary" : ""}
                        >
                          {membro.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:text-primary hover:bg-primary/10">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/alunos/${membro.id}`} className="flex items-center">
                                <User className="mr-2 size-4 text-primary" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            <MemberDeactivateItem
                              id={membro.id}
                              nome={membro.usuario.nome || undefined}
                              disabled={membro.status === "PENDENTE"}
                            />
                            <MemberStatusToggle id={membro.id} status={membro.status} nome={membro.usuario.nome || undefined} />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                          <Users className="size-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">Nenhum aluno encontrado.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4">
              <Suspense>
                <Pagination currentPage={currentPage} totalPages={totalPages} />
              </Suspense>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
