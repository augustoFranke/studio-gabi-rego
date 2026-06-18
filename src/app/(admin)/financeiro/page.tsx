import type { Prisma } from "@prisma/client"
import { listPlanos } from "@/services/plano.service"
import { listMembros } from "@/services/membro.service"
import { getFinanceiroStats } from "@/services/financeiro.service"
import { FinanceiroClient } from "./financeiro-client"
import type { Plano, Membro } from "./_components/types"

// Per-request admin data fetched from the DB at render time; never prerender at build.
export const dynamic = "force-dynamic"

// Runtime shapes for the params used below: listPlanos with includeCounts,
// and listMembros with no fields filter (the default full include).
type PlanoRow = Prisma.PlanoGetPayload<{
  include: { _count: { select: { membros: true; pagamentos: true } } }
}>
type MembroRow = Prisma.MembroGetPayload<{
  include: {
    usuario: { select: { id: true; nome: true; email: true } }
    plano: true
  }
}>

function serializePlanos(planos: PlanoRow[]): Plano[] {
  return planos.map((plano) => ({
    ...plano,
    valor: plano.valor.toString(),
  }))
}

function serializeMembros(membros: MembroRow[]): Membro[] {
  return membros.map((membro) => ({
    ...membro,
    precoCustomizado: membro.precoCustomizado?.toString() ?? null,
    plano: membro.plano
      ? { ...membro.plano, valor: membro.plano.valor.toString() }
      : null,
  }))
}

export default async function FinanceiroPage() {
  const [planos, membros, stats] = await Promise.all([
    listPlanos({ includeInactive: true, includeCounts: true }),
    listMembros({}),
    getFinanceiroStats(),
  ])

  return (
    <FinanceiroClient
      initialPlanos={serializePlanos(planos as PlanoRow[])}
      initialMembros={serializeMembros(membros as MembroRow[])}
      initialStats={{ ...stats, receitaMes: stats.receitaMes.toString() }}
    />
  )
}
