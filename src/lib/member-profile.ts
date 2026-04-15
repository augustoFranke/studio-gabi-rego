export function normalizeCpf(value?: string | null): string | null {
  return value ? value.replace(/\D/g, '') : null
}

export function normalizeTelefone(value?: string | null): string | null {
  return value ? value.replace(/\D/g, '') : null
}

export function normalizeOptionalString(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function parseOptionalDate(value?: string | null): Date | null {
  if (value === undefined || value === null || value.trim() === '') {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

type MemberProfileInput = {
  cpf?: string | null
  rg?: string | null
  telefone?: string | null
  dataNascimento?: string | null
  sexo?: 'MASCULINO' | 'FEMININO' | '' | null
}

export type NormalizedMemberProfileInput = {
  cpf: string | null
  rg: string | null | undefined
  telefone: string | null
  telefoneIsInvalid: boolean
  dataNascimento: Date | null
  dataNascimentoIsInvalid: boolean
  sexo: 'MASCULINO' | 'FEMININO' | null
}

function hasSubmittedText(value?: string | null): boolean {
  return value !== undefined && value !== null && value.trim() !== ''
}

export function normalizeMemberProfileInput(
  input: MemberProfileInput
): NormalizedMemberProfileInput {
  const cpf = normalizeCpf(input.cpf)
  const rg = normalizeOptionalString(input.rg)
  const telefone = normalizeTelefone(input.telefone)
  const dataNascimento = parseOptionalDate(input.dataNascimento)

  return {
    cpf,
    rg,
    telefone,
    telefoneIsInvalid: telefone !== null && telefone.length < 10,
    dataNascimento,
    dataNascimentoIsInvalid: hasSubmittedText(input.dataNascimento) && dataNascimento === null,
    sexo: input.sexo === '' ? null : (input.sexo ?? null),
  }
}
