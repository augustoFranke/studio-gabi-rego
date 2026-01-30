import type { Sexo as PrismaSexo, StatusMembro } from '@prisma/client'

export type MembroStatus = StatusMembro
export type Sexo = PrismaSexo

export type UsuarioBasic = {
  id: string
  nome?: string | null
  email?: string | null
}

export type PlanoBasic = {
  id: string
  nome: string
  valor: string | number
  ativo: boolean
}

export type Membro = {
  id: string
  usuarioId: string
  cpf?: string | null
  rg?: string | null
  telefone?: string | null
  dataNascimento?: string | Date | null
  observacoes?: string | null
  status: MembroStatus
  fotoUrl?: string | null
  sexo?: Sexo | null
  planoId?: string | null
  precoCustomizado?: string | number | null
  usuario: UsuarioBasic
  plano?: PlanoBasic | null
}
