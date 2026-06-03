import type { Metadata } from 'next'
import MeuPerfilClient from './meu-perfil-client'

export const metadata: Metadata = {
  title: 'Meu perfil | Gabi Rego Studio',
  description: 'Atualize seus dados pessoais no Gabi Rego Studio.',
}

export default function MeuPerfilPage() {
  return <MeuPerfilClient />
}
