import { handlers } from "@/lib/auth"

// Force Node.js runtime for auth routes (Prisma doesn't work in Edge)
export const runtime = 'nodejs'

export const { GET, POST } = handlers

