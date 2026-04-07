"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggleSimple } from "@/components/theme-toggle"
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react"
import Image from "next/image"

type VerificationStatus = "loading" | "success" | "error" | "expired"

export default function VerificarTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const resolvedParams = use(params)
  const [status, setStatus] = useState<VerificationStatus>("loading")
  const [message, setMessage] = useState("")
  const [redirectUrl, setRedirectUrl] = useState("/login")
  const [nextStep, setNextStep] = useState<"dashboard" | "login" | "complete_profile" | "complete_anamnese">("login")
  const router = useRouter()

  useEffect(() => {
    async function verifyToken() {
      try {
        const response = await fetch("/api/auth/verificar-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resolvedParams.token }),
        })

        const data = await response.json()

        if (response.ok) {
          setStatus("success")
          setMessage(data.message || "Email verificado com sucesso!")
          setRedirectUrl(data.redirectUrl || (data.isAdmin ? "/dashboard" : "/login"))
          setNextStep(data.nextStep || (data.isAdmin ? "dashboard" : "login"))
        } else if (data.error === "Token expirado") {
          setStatus("expired")
          setMessage("O link de verificação expirou.")
        } else {
          setStatus("error")
          setMessage(data.error || "Erro ao verificar email")
        }
      } catch {
        setStatus("error")
        setMessage("Erro ao verificar email")
      }
    }

    verifyToken()
  }, [resolvedParams.token])

  function handleContinue() {
    router.push(redirectUrl)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-orange-600/25 to-amber-500/10 blur-3xl" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-600/30 to-transparent" />
      </div>

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
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              status === "loading" ? "bg-orange-500/10" :
              status === "success" ? "bg-green-500/10" :
              "bg-red-500/10"
            }`}>
              {status === "loading" && (
                <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
              )}
              {status === "success" && (
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              )}
              {(status === "error" || status === "expired") && (
                <XCircle className="h-10 w-10 text-red-500" />
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
                <ArrowRight className="h-4 w-4" />
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
