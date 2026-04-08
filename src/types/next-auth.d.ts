import { DefaultSession } from "next-auth"
import type { UserRole } from "@/lib/auth-session"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      membroId?: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    role: UserRole
    membroId?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    membroId?: string
  }
}
