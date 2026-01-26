import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
    // Use getToken which is Edge-compatible (doesn't need Prisma)
    // Support both NEXTAUTH_SECRET and AUTH_SECRET for NextAuth v5 compatibility
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET

    let token = await getToken({
        req: request,
        secret
    })

    // Fallback: try v5 cookie name explicitly if default lookup failed
    // NextAuth v5 uses 'authjs.session-token' instead of 'next-auth.session-token'
    if (!token) {
        token = await getToken({
            req: request,
            secret,
            cookieName: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token"
        })
    }

    // If no token, redirect to login
    if (!token) {
        const loginUrl = new URL("/login", request.url)
        return NextResponse.redirect(loginUrl)
    }

    // User is authenticated, continue
    return NextResponse.next()
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|login|cadastro|verificar-email|completar-perfil|anamnese|redefinir-senha|.*\\.(?:png|svg|jpg|jpeg|gif|ico|webp)$).*)",
    ],
}
