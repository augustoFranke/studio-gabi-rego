import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"

// Determine if we're in production
const isProduction = process.env.NODE_ENV === "production"

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Required for Vercel deployment - trust the proxy headers
  trustHost: true,
  // Explicitly use NEXTAUTH_SECRET for backward compatibility
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  // Use secure cookies in production (HTTPS)
  useSecureCookies: isProduction,
  cookies: {
    sessionToken: {
      name: isProduction ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
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

        const email = credentials.email as string
        const password = credentials.password as string

        // Dynamic import to avoid Prisma initialization at module load time
        const { prisma } = await import("@/lib/prisma")

        const usuario = await prisma.usuario.findUnique({
          where: { email },
          include: { membro: true },
        })

        if (!usuario) {
          return null
        }

        const senhaCorreta = await compare(password, usuario.senha)

        if (!senhaCorreta) {
          return null
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

