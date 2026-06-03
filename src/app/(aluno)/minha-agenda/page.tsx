import type { Metadata } from 'next'
import MinhaAgendaClient from './minha-agenda-client'

export const metadata: Metadata = {
  title: 'Minha agenda | Gabi Rego Studio',
  description: 'Veja seus próximos agendamentos no Gabi Rego Studio.',
}

export default function MinhaAgendaPage() {
  return <MinhaAgendaClient />
}
