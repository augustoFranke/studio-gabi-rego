import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Search, MoreHorizontal, Phone, Mail, User, CreditCard, Users } from "lucide-react"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MemberStatusToggle, SendMemberReminder } from "@/components/admin/member-actions"
import { Prisma, StatusMembro } from "@prisma/client"
import { Pagination } from "@/components/ui/pagination-custom"

export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; plano?: string; page?: string }>
}) {
  const { search, status, plano, page } = await searchParams
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

  const [totalMembros, membros, planos] = await Promise.all([
    prisma.membro.count({ where }),
    prisma.membro.findMany({
      where,
      include: {
        usuario: true,
        plano: true,
      },
      orderBy: {
        usuario: {
          nome: 'asc'
        }
      },
      skip,
      take: itemsPerPage,
    }),
    prisma.plano.findMany({
      where: { ativo: true },
      select: { id: true, nome: true }
    })
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
          <Button asChild className="shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all">
            <Link href="/alunos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo Aluno
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-primary/10">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Filtros</CardTitle>
                <CardDescription>
                  Refine sua busca por alunos
                </CardDescription>
              </div>
            </div>
            <form className="flex flex-wrap items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  name="search"
                  placeholder="Nome, CPF ou Email..."
                  className="pl-8 border-input/50 focus:border-primary"
                  defaultValue={search}
                />
              </div>

              <Select name="status" defaultValue={status || 'todos'}>
                <SelectTrigger className="w-[140px] border-input/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="ATIVO">Ativos</SelectItem>
                  <SelectItem value="INATIVO">Inativos</SelectItem>
                  <SelectItem value="PENDENTE">Pendentes</SelectItem>
                </SelectContent>
              </Select>

              {(() => {
                const planosGabi = planos.filter(p => p.nome.toLowerCase().includes('gabi'))
                const planosEstagiarios = planos.filter(p => p.nome.toLowerCase().includes('estagiário') || p.nome.toLowerCase().includes('estagiarios'))
                const planosOutros = planos.filter(p => !p.nome.toLowerCase().includes('gabi') && !p.nome.toLowerCase().includes('estagiário') && !p.nome.toLowerCase().includes('estagiarios'))

                return (
                  <Select name="plano" defaultValue={plano || 'todos'}>
                    <SelectTrigger className="w-[220px] border-input/50">
                      <SelectValue placeholder="Plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Planos</SelectItem>
                      {planosGabi.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                            Gabi
                          </SelectLabel>
                          {planosGabi.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="pl-6">
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                                {p.nome}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {planosEstagiarios.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                            Estagiários
                          </SelectLabel>
                          {planosEstagiarios.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="pl-6">
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                                {p.nome}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {planosOutros.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-violet-500"></span>
                            Outros
                          </SelectLabel>
                          {planosOutros.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="pl-6">
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                                {p.nome}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                )
              })()}

              <Button type="submit" variant="secondary" className="hover:bg-primary/10 hover:text-primary">
                Filtrar
              </Button>
              <Button type="button" variant="ghost" asChild className="hover:text-primary">
                <Link href="/alunos">Limpar</Link>
              </Button>
            </form>
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
                  membros.map((membro) => (
                    <TableRow key={membro.id} className="hover:bg-primary/5">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{membro.usuario.nome}</span>
                          <span className="text-xs text-muted-foreground">{membro.cpf}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-xs">
                            <Phone className="mr-1.5 h-3 w-3 text-primary" />
                            {membro.telefone}
                          </div>
                          <div className="flex items-center text-xs">
                            <Mail className="mr-1.5 h-3 w-3 text-primary" />
                            {membro.usuario.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {membro.plano ? (
                          <Badge variant="outline" className="flex items-center w-fit border-primary/30 text-primary">
                            <CreditCard className="mr-1 h-3 w-3" />
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
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/alunos/${membro.id}`} className="flex items-center">
                                <User className="mr-2 h-4 w-4 text-primary" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            <SendMemberReminder id={membro.id} />
                            <DropdownMenuSeparator />
                            <MemberStatusToggle id={membro.id} status={membro.status} nome={membro.usuario.nome || undefined} />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                          <Users className="h-6 w-6 text-muted-foreground" />
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
              <Pagination currentPage={currentPage} totalPages={totalPages} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
