import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/validators', () => ({
  validarEmail: vi.fn(),
}))

import {
  cadastroSchema,
  reenviarVerificacaoSchema,
  redefinirSenhaSchema,
} from '@/schemas/auth.schema'
import { validarEmail } from '@/lib/validators'
import { PASSWORD_POLICY_MESSAGE } from '@/schemas/password-policy.schema'

describe('auth schemas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cadastroSchema validates email and password rules', () => {
    vi.mocked(validarEmail).mockReturnValueOnce(true)

    const result = cadastroSchema.safeParse({
      email: 'user@example.com',
      senha: 'Senha123',
    })

    expect(result.success).toBe(true)
  })

  it('cadastroSchema rejects invalid email', () => {
    vi.mocked(validarEmail).mockReturnValueOnce(false)

    const result = cadastroSchema.safeParse({
      email: 'bad-email',
      senha: 'Senha123',
    })

    expect(result.success).toBe(false)
  })

  it('cadastroSchema rejects password without uppercase', () => {
    vi.mocked(validarEmail).mockReturnValueOnce(true)

    const result = cadastroSchema.safeParse({
      email: 'user@example.com',
      senha: 'senha123',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(PASSWORD_POLICY_MESSAGE)
    }
  })

  it('reenviarVerificacaoSchema uses email validator', () => {
    vi.mocked(validarEmail).mockReturnValueOnce(false)

    const result = reenviarVerificacaoSchema.safeParse({ email: 'bad' })

    expect(result.success).toBe(false)
  })

  it('redefinirSenhaSchema enforces password policy', () => {
    const result = redefinirSenhaSchema.safeParse({
      token: 'token',
      senha: 'Senha123',
    })

    expect(result.success).toBe(true)
  })
})
