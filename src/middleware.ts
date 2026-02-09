import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const ADMIN_ROUTES = ["/dashboard", "/alunos", "/treinos", "/financeiro", "/agenda", "/configuracoes"]
const MEMBER_ROUTES = ["/inicio", "/minha-agenda", "/meu-treino", "/pagamentos", "/meu-perfil"]
const PUBLIC_ROUTES = [
  "/login",
  "/cadastro",
  "/verificar-email",
  "/anamnese",
  "/completar-perfil",
  "/redefinir-senha",
  "/reenviar-verificacao",
  "/api/auth",
  "/api/health",
  "/api/anamnese-token",
  "/api/cron",
]

function routeMatches(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

async function readSessionToken(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  const token = await getToken({ req: request, secret })
  if (token) {
    return token
  }

  return getToken({
    req: request,
    secret,
    cookieName:
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
  })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (routeMatches(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next()
  }

  const requiresAdmin = routeMatches(pathname, ADMIN_ROUTES)
  const requiresMember = routeMatches(pathname, MEMBER_ROUTES)

  if (!requiresAdmin && !requiresMember) {
    return NextResponse.next()
  }

  const token = await readSessionToken(request)
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const role = token.role
  if (requiresAdmin && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/inicio", request.url))
  }

  if (requiresMember && role !== "MEMBRO" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo|fonts|.*\\..*).*)"],
}
