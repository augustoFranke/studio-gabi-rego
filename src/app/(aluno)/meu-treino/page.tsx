import type { Metadata } from 'next'
import MeuTreinoClient from './meu-treino-client'

export const metadata: Metadata = {
  title: 'Meu treino | Gabi Rego Studio',
  description: 'Acompanhe sua ficha de treino atual no Gabi Rego Studio.',
}

export default function MeuTreinoPage() {
  return <MeuTreinoClient />
}
