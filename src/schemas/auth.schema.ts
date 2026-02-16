import { z } from 'zod'
import { validarEmail } from '@/lib/validators'
import { passwordPolicySchema } from '@/schemas/password-policy.schema'

export const cadastroSchema = z.object({
  email: z.string().refine((value) => validarEmail(value), {
    message: 'Email inválido',
  }),
  senha: passwordPolicySchema,
})

export const reenviarVerificacaoSchema = z.object({
  email: z.string().refine((value) => validarEmail(value), {
    message: 'Email inválido',
  }),
})

export const enviarResetSenhaSchema = z.object({
  usuarioId: z.string().min(1),
})

export const redefinirSenhaSchema = z.object({
  token: z.string().min(1),
  senha: passwordPolicySchema,
})

export const validarTokenResetSchema = z.object({
  token: z.string().min(1),
})

export type CadastroInput = z.infer<typeof cadastroSchema>
export type ReenviarVerificacaoInput = z.infer<typeof reenviarVerificacaoSchema>
export type EnviarResetSenhaInput = z.infer<typeof enviarResetSenhaSchema>
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>
export type ValidarTokenResetInput = z.infer<typeof validarTokenResetSchema>
