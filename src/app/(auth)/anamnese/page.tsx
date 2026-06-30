"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Loader2 } from "lucide-react"
import Image from "next/image"
import { fetchWithTimeout, readResponseErrorMessage } from "@/lib/http"
import type { AnamneseFormData } from '@/lib/anamnese'
import {
  AnamneseBasicSection,
  AnamneseExperienceSection,
  AnamneseMedicalSection,
  AnamneseParqSection,
  type AnamneseSectionKey,
} from "@/components/anamnese/anamnese-form-sections"

const PROFILE_TOKEN_STORAGE_KEY = "onboarding_profile_token"

function AnamneseContent() {
  return useAnamneseContent()
}

function useAnamneseContent() {
  const { status } = useSession()
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [formData, setFormData] = useState<AnamneseFormData>({})
  const [sexo, setSexo] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    medical: false,
    parq: false,
    experience: false,
  })
  const [submissionSuccessful, setSubmissionSuccessful] = useState(false)
  const { push, replace } = useRouter()

  useEffect(() => {
    let nextToken: string | null = null

    if (status === "authenticated") {
      nextToken = null
    } else if (typeof window !== "undefined") {
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.replace(/^#/, ""))
        const tokenFromHash = params.get("token")
        if (tokenFromHash) {
          nextToken = tokenFromHash
          window.history.replaceState(null, "", window.location.pathname)
        }
      }
    }

    // Token is resolved from window.location.hash and history side-effects, which
    // are not derivable during render, so it must be synced into state here.
    if (nextToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(nextToken)
    }
    if (status === "unauthenticated" && !nextToken && !token) {
      push("/login")
    }
  }, [status, token, push])

  // Load user data on mount
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      // Don't reload data if submission was successful (prevents race condition redirect)
      if (submissionSuccessful) return

      try {
        setTokenError(null)
        const endpoint = token ? "/api/anamnese-token" : "/api/minha-anamnese"
        const response = await fetchWithTimeout(endpoint, {
          headers: token ? { "X-Anamnese-Token": token } : undefined,
          credentials: "include",
        })
        if (response.ok) {
          const data = await response.json()
          if (isMounted) {
            if (data.anamnese) {
              setFormData(data.anamnese)
            }
            if (data.sexo) {
              setSexo(data.sexo)
            }
            setLoadingData(false)
          }
        } else {
          if (token) {
            const errorMessage = await readResponseErrorMessage(
              response,
              "Link inválido ou expirado."
            )
            if (isMounted) {
              setTokenError(errorMessage)
              setLoadingData(false)
            }
            setToken(null)
            return
          }
          if (response.status === 404) {
            // Profile not found - redirect to complete profile first (no toast needed, the redirect is self-explanatory)
            push("/completar-perfil")
            // Don't set loadingData to false - keep loading state during redirect
            return
          }
          // Other errors
          if (isMounted) {
            setLoadingData(false)
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
        if (isMounted) {
          setLoadingData(false)
        }
      }
    }

    const shouldLoad = Boolean(token) || status === "authenticated"
    if (shouldLoad) {
      loadData()
    }

    return () => {
      isMounted = false
    }
  }, [status, push, token, submissionSuccessful])

  const updateField = (field: keyof AnamneseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleSection = (section: AnamneseSectionKey) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const isWoman = sexo === "FEMININO"

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    try {
      const endpoint = token ? "/api/anamnese-token" : "/api/minha-anamnese"
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Anamnese-Token": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        toast.error(await readResponseErrorMessage(response, "Erro ao salvar anamnese"))
        setIsLoading(false)
        return
      }

      setSubmissionSuccessful(true)
      toast.success(token ? "Anamnese enviada com sucesso!" : "Cadastro concluído!")
      setIsLoading(false)
      if (token) {
        setToken(null)
        try {
          localStorage.removeItem(PROFILE_TOKEN_STORAGE_KEY)
        } catch {
          // Ignore storage errors (private mode / blocked storage)
        }
      }
      replace("/inicio")
    } catch (error) {
      toast.error("Ocorreu um erro ao salvar")
      console.error(error)
      setIsLoading(false)
    }
  }

  if (status === "loading" || loadingData) {
    return <AnamneseLoadingScreen />
  }

  if (tokenError) {
    return <AnamneseTokenError message={tokenError} />
  }

  return (
    <div className="min-h-screen p-4 relative overflow-hidden bg-background">
      <AnamneseBackground />

      {/* Theme toggle */}
      <div className="max-w-2xl mx-auto relative z-10 space-y-6 pb-20">
        <AnamneseHeader />

        <form onSubmit={onSubmit} className="space-y-4">
          <AnamneseBasicSection
            formData={formData}
            expandedSections={expandedSections}
            isWoman={isWoman}
            onToggleSection={toggleSection}
            onUpdateField={updateField}
          />

          <AnamneseMedicalSection
            formData={formData}
            expandedSections={expandedSections}
            isWoman={isWoman}
            onToggleSection={toggleSection}
            onUpdateField={updateField}
          />

          <AnamneseParqSection
            formData={formData}
            expandedSections={expandedSections}
            isWoman={isWoman}
            onToggleSection={toggleSection}
            onUpdateField={updateField}
          />

          <AnamneseExperienceSection
            formData={formData}
            expandedSections={expandedSections}
            isWoman={isWoman}
            onToggleSection={toggleSection}
            onUpdateField={updateField}
          />

          <AnamneseSubmitButton isLoading={isLoading} />
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 pb-16 md:pb-0">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        </div>
      </div>
    </div>
  )
}

function AnamneseLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin size-8 border-4 border-orange-500 border-t-transparent rounded-full" />
    </div>
  )
}

function AnamneseTokenError({ message }: { message: string }) {
  return (
    <div className="min-h-screen p-4 relative overflow-hidden bg-background">
      <AnamneseBackground />
      <div className="max-w-md mx-auto relative z-10 pt-24">
        <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95 text-center">
          <CardHeader>
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Solicite um novo link para responder sua anamnese.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AnamneseBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-1/3 -right-1/4 size-[600px] rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 blur-3xl animate-pulse" />
      <div className="absolute -bottom-1/4 -left-1/4 size-[500px] rounded-full bg-gradient-to-tr from-orange-600/25 to-amber-500/10 blur-3xl" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
    </div>
  )
}

function AnamneseHeader() {
  return (
    <div className="text-center pt-6 pb-4">
      <Image
        src="/logo-and-title.png"
        alt="Gabi Studio"
        width={120}
        height={120}
        className="object-contain mx-auto mb-4"
        priority
      />
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="size-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">4</div>
        <span className="text-xs text-orange-500 font-medium">Anamnese</span>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Anamnese</h1>
      <p className="text-muted-foreground text-sm mt-1">
        Última etapa: conte-nos sobre sua saúde
      </p>
    </div>
  )
}

function AnamneseSubmitButton({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-background to-transparent md:relative md:p-0 md:bg-none">
      <Button
        type="submit"
        className="w-full h-14 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-shadow border-0"
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" />
            Finalizando…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Concluir Cadastro
            <ArrowRight className="size-5" />
          </span>
        )}
      </Button>
    </div>
  )
}

export default function AnamnesePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin size-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <AnamneseContent />
    </Suspense>
  )
}
