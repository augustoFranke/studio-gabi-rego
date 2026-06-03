"use client"

import { useEffect, useReducer, useRef, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AuthThemeBackdrop } from "@/components/auth-theme-backdrop"
import { ThemeToggleSimple } from "@/components/theme-toggle"
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react"
import Image from "next/image"
import { fetchWithTimeout } from "@/lib/http"

type VerificationStatus = "loading" | "success" | "error" | "expired"

type VerifyEmailResponse = {
  error?: string
  message?: string
  redirectUrl: string
  nextStep: "dashboard" | "login" | "complete_profile" | "complete_anamnese"
}

type VerificationState = {
  status: VerificationStatus
  message: string
  nextStep: VerifyEmailResponse["nextStep"]
}

function verificationReducer(_: VerificationState, next: VerificationState) {
  return next
}

export default function VerificarTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const resolvedParams = use(params)
  const [verification, setVerification] = useReducer(verificationReducer, {
    status: "loading",
    message: "",
    nextStep: "login",
  })
  const redirectUrlRef = useRef("/login")
  const { push } = useRouter()
  const { status, message, nextStep } = verification

  useEffect(() => {
    async function verifyToken() {
      try {
        const response = await fetchWithTimeout("/api/auth/verificar-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resolvedParams.token }),
        })

        const data = (await response.json()) as VerifyEmailResponse

        if (response.ok) {
          redirectUrlRef.current = data.redirectUrl
          setVerification({
            status: "success",
            message: data.message || "Email verificado com sucesso!",
            nextStep: data.nextStep,
          })
        } else if (data.error === "Token expirado") {
          setVerification({
            status: "expired",
            message: "O link de verificação expirou.",
            nextStep: "login",
          })
        } else {
          setVerification({
            status: "error",
            message: data.error || "Erro ao verificar email",
            nextStep: "login",
          })
        }
      } catch {
        setVerification({
          status: "error",
          message: "Erro ao verificar email",
          nextStep: "login",
        })
      }
    }

    verifyToken()
  }, [resolvedParams.token])

  function handleContinue() {
    push(redirectUrlRef.current)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <AuthThemeBackdrop />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggleSimple />
      </div>

      <Card className="w-full max-w-md relative z-10 border-orange-500/20 shadow-2xl shadow-orange-900/20 dark:shadow-orange-500/10 gap-0 backdrop-blur-sm bg-card/95">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-t-xl" />

        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Gabi Studio"
              width={150}
              height={150}
              className="object-contain"
              priority
            />
          </div>

          {/* Status icon */}
          <div className="flex justify-center mb-4">
            <div className={`size-20 rounded-full flex items-center justify-center ${
              status === "loading" ? "bg-orange-500/10" :
              status === "success" ? "bg-green-500/10" :
              "bg-red-500/10"
            }`}>
              {status === "loading" && (
                <Loader2 className="size-10 text-orange-500 animate-spin" />
              )}
              {status === "success" && (
                <CheckCircle2 className="size-10 text-green-500" />
              )}
              {(status === "error" || status === "expired") && (
                <XCircle className="size-10 text-red-500" />
              )}
            </div>
          </div>

          <CardDescription className={`font-medium text-lg ${
            status === "success" ? "text-green-500" :
            status === "error" || status === "expired" ? "text-red-500" :
            "text-foreground"
          }`}>
            {status === "loading" ? "Verificando..." : message}
          </CardDescription>

          {status === "success" && (
            <CardDescription className="text-muted-foreground mt-2">
              {nextStep === "dashboard" && "Você foi adicionado como administrador."}
              {nextStep === "login" && "Seu cadastro está completo! Faça login para acessar."}
              {nextStep === "complete_profile" && "Agora complete seu perfil para continuar."}
              {nextStep === "complete_anamnese" && "Agora finalize sua anamnese para concluir o acesso."}
            </CardDescription>
          )}

          {status === "expired" && (
            <CardDescription className="text-muted-foreground mt-2">
              Solicite um novo link de verificação.
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-0 pb-6">
          {status === "success" && (
            <Button
              onClick={handleContinue}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-shadow border-0"
            >
              <span className="flex items-center gap-2">
                {nextStep === "dashboard" && "Acessar painel admin"}
                {nextStep === "login" && "Fazer login"}
                {nextStep === "complete_profile" && "Completar perfil"}
                {nextStep === "complete_anamnese" && "Abrir anamnese"}
                <ArrowRight className="size-4" />
              </span>
            </Button>
          )}

          {status === "expired" && (
            <Link href="/cadastro">
              <Button
                variant="outline"
                className="w-full h-12 border-orange-500/30 hover:bg-orange-500/10"
              >
                Voltar para o cadastro
              </Button>
            </Link>
          )}

          {status === "error" && (
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full h-12 border-orange-500/30 hover:bg-orange-500/10"
              >
                Ir para o login
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
