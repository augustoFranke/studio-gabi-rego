import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
    // Use getToken which is Edge-compatible (doesn't need Prisma)
    const token = await getToken({ 
        req: request,
        secret: process.env.NEXTAUTH_SECRET 
    })

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
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes handled individually or via withApiAuth)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - login (login page)
         * - (public pages if any)
         */
        "/((?!api|_next/static|_next/image|favicon.ico|login).*)",
    ],
}
