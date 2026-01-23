import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare, hash } from "bcryptjs"

const isStrongPassword = (value: string) =>
  value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value)

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Required for Vercel deployment - trust the proxy headers
  trustHost: true,
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
          throw new Error("USER_NOT_FOUND")
        }

        if (!usuario.senhaDefinida) {
          if (!isStrongPassword(password)) {
            throw new Error("WEAK_PASSWORD")
          }

          const senhaHash = await hash(password, 12)
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
              senha: senhaHash,
              senhaDefinida: true,
            },
          })

          return {
            id: usuario.id,
            email: usuario.email,
            name: usuario.nome,
            role: usuario.role,
            membroId: usuario.membro?.id,
          }
        }

        const senhaCorreta = await compare(password, usuario.senha)

        if (!senhaCorreta) {
          throw new Error("WRONG_PASSWORD")
        }

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
        session.user.role = token.role as string
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
  },
})
