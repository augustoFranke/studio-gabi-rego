'use client'

import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { fetcher } from '@/lib/fetcher'
import { formatCurrency } from '@/lib/currency'

type Pagamento = {
  id: string
  valor: string | number
  dataVencimento: string
  dataPagamento: string | null
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO'
  plano: {
    nome: string
  }
}

type PagamentosResponse = {
  data: Pagamento[]
  meta: {
    total: number
    page: number
    totalPages: number
  }
}


function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleDateString('pt-BR')
}

function getStatusBadge(status: Pagamento['status']) {
  if (status === 'PAGO') {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Pago</Badge>
  }

  if (status === 'ATRASADO') {
    return <Badge variant="destructive">Atrasado</Badge>
  }

  if (status === 'CANCELADO') {
    return <Badge variant="outline">Cancelado</Badge>
  }

  return <Badge variant="secondary">Pendente</Badge>
}

export default function PagamentosPage() {
  const { data, isLoading } = useSWR<PagamentosResponse>('/api/pagamentos?limit=50', fetcher, {
    revalidateOnFocus: false,
  })

  const pagamentos = data?.data || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pagamentos</h1>
        <p className="text-muted-foreground">Histórico de pagamentos da sua conta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Consulte vencimentos, valores e status dos pagamentos.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!isLoading && pagamentos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
          )}

          {!isLoading && pagamentos.length > 0 && (
            <div className="space-y-3">
              {pagamentos.map((pagamento) => (
                <div key={pagamento.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{pagamento.plano.nome}</p>
                      <p className="text-sm text-muted-foreground">Valor: {formatCurrency(pagamento.valor)}</p>
                    </div>
                    {getStatusBadge(pagamento.status)}
                  </div>

                  <div className="grid gap-2 pt-3 text-sm text-muted-foreground md:grid-cols-2">
                    <p>Vencimento: {formatDate(pagamento.dataVencimento)}</p>
                    <p>Pagamento: {formatDate(pagamento.dataPagamento)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
