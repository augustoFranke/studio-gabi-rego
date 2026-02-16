import { z } from 'zod'

export const PASSWORD_POLICY_MESSAGE = 'Password does not meet policy'

export const passwordPolicySchema = z
  .string()
  .min(8, PASSWORD_POLICY_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[0-9]/, PASSWORD_POLICY_MESSAGE)
