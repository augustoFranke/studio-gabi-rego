import NextAuth from "next-auth"
import type { Session } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { cache } from "react"
import { logWarn, logInfo } from "@/lib/observability/logger"
import { AUTH_SIGN_IN_FAILED, AUTH_SIGN_IN_OK } from "@/lib/observability/events"

const isProduction = process.env.NODE_ENV === "production"

const authError = (code: string) => (isProduction ? "INVALID_CREDENTIALS" : code)

const nextAuth = NextAuth({
  // Trust host in dev or when behind Vercel's proxy
  trustHost: process.env.NODE_ENV !== "production" || process.env.VERCEL === "1",
  // Explicitly use NEXTAUTH_SECRET for backward compatibility
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = (credentials.email as string).toLowerCase().trim()
        const password = credentials.password as string

        // Dynamic import to avoid Prisma initialization at module load time
        const { prisma } = await import("@/lib/prisma")

        const usuario = await prisma.usuario.findUnique({
          where: { email },
          include: { membro: true },
        })

        if (!usuario) {
          logWarn(AUTH_SIGN_IN_FAILED, { reason: 'user_not_found' })
          throw new Error(authError("USER_NOT_FOUND"))
        }

        if (!usuario.emailVerificado) {
          logWarn(AUTH_SIGN_IN_FAILED, { reason: 'email_not_verified' })
          throw new Error(authError("EMAIL_NOT_VERIFIED"))
        }

        if (!usuario.senhaDefinida) {
          logWarn(AUTH_SIGN_IN_FAILED, { reason: 'password_setup_required' })
          throw new Error(authError("PASSWORD_SETUP_REQUIRED"))
        }

        const senhaCorreta = await compare(password, usuario.senha)

        if (!senhaCorreta) {
          logWarn(AUTH_SIGN_IN_FAILED, { reason: 'wrong_password' })
          throw new Error(authError("WRONG_PASSWORD"))
        }

        logInfo(AUTH_SIGN_IN_OK, { userId: usuario.id, role: usuario.role })

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nome,
          role: usuario.role,
          membroId: usuario.membro?.id,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.membroId = user.membroId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role
        session.user.membroId = token.membroId as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
})

export const { handlers, signIn, signOut } = nextAuth

// Wrap auth with React.cache for request deduplication
// This ensures multiple auth() calls in the same request share the same result
export const auth = cache(async (): Promise<Session | null> => nextAuth.auth())
