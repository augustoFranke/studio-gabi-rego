import type { Metadata } from 'next'
import PagamentosClient from './pagamentos-client'

export const metadata: Metadata = {
  title: 'Pagamentos | Gabi Rego Studio',
  description: 'Acompanhe seus pagamentos no Gabi Rego Studio.',
}

export default function PagamentosPage() {
  return <PagamentosClient />
}
