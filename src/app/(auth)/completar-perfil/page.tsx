"use client"

import { useEffect, Suspense, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"

const PROFILE_TOKEN_STORAGE_KEY = "onboarding_profile_token"

function CompletarPerfilRedirect() {
  const { status } = useSession()
  const searchParams = useSearchParams()
  const tokenFromUrl = searchParams.get("token")
  const profileTokenFromStorage = useSyncExternalStore(
    () => () => {},
    () => {
      if (typeof window === "undefined") return null
      try {
        return localStorage.getItem(PROFILE_TOKEN_STORAGE_KEY)
      } catch {
        return null
      }
    },
    () => null
  )
  const profileToken = tokenFromUrl ?? profileTokenFromStorage
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    if (status === "authenticated") {
      // Authenticated users go to their profile page
      router.replace("/meu-perfil")
      return
    }

    if (!profileToken) {
      // No token and not authenticated -> go to registration
      router.replace("/cadastro")
      return
    }

    // Legacy users with a valid profileToken: keep them here
    // but since the old form is gone, redirect to cadastro
    // They can re-register with the new flow
    router.replace("/cadastro")
  }, [status, profileToken, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
    </div>
  )
}

export default function CompletarPerfilPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <CompletarPerfilRedirect />
    </Suspense>
  )
}
