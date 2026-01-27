import { z } from 'zod'
import { validarEmail } from '@/lib/validators'

const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .refine((value) => /[A-Z]/.test(value), {
    message: 'A senha deve conter pelo menos uma letra maiúscula',
  })
  .refine((value) => /[0-9]/.test(value), {
    message: 'A senha deve conter pelo menos um número',
  })

export const cadastroSchema = z.object({
  email: z.string().refine((value) => validarEmail(value), {
    message: 'Email inválido',
  }),
  senha: passwordSchema,
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
  senha: passwordSchema,
})

export const validarTokenResetSchema = z.object({
  token: z.string().min(1),
})

export type CadastroInput = z.infer<typeof cadastroSchema>
export type ReenviarVerificacaoInput = z.infer<typeof reenviarVerificacaoSchema>
export type EnviarResetSenhaInput = z.infer<typeof enviarResetSenhaSchema>
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>
export type ValidarTokenResetInput = z.infer<typeof validarTokenResetSchema>
