"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { ThemeToggleSimple } from "@/components/theme-toggle"
import { Mail, Flame, RefreshCw, ArrowLeft } from "lucide-react"
import Image from "next/image"

function VerificarEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email")
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  async function handleResend() {
    if (!email || countdown > 0) return

    setIsResending(true)
    try {
      const response = await fetch("/api/auth/reenviar-verificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Email reenviado com sucesso!")
        setCountdown(60) // 60 seconds cooldown
      } else {
        toast.error(data.error || "Erro ao reenviar email")
      }
    } catch (error) {
      toast.error("Erro ao reenviar email")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-orange-950 via-background to-orange-900/20 dark:from-orange-950/50 dark:via-background dark:to-orange-900/10">
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

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs text-green-500 font-medium">Cadastro</span>
            </div>
            <div className="w-8 h-px bg-orange-500" />
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">2</div>
              <span className="text-xs text-orange-500 font-medium">Verificar</span>
            </div>
            <div className="w-8 h-px bg-orange-500/30" />
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">3</div>
              <span className="text-xs text-muted-foreground">Perfil</span>
            </div>
          </div>

          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Mail className="h-10 w-10 text-orange-500" />
            </div>
          </div>

          <CardDescription className="text-foreground font-medium text-lg">
            Verifique seu email
          </CardDescription>
          <CardDescription className="text-muted-foreground mt-2">
            Enviamos um link de verificação para
            {email && (
              <span className="block text-orange-500 font-medium mt-1">{email}</span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-6 space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="mb-2">Não recebeu o email? Verifique:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Sua caixa de spam ou lixo eletrônico</li>
              <li>Se o email digitado está correto</li>
            </ul>
          </div>

          <Button
            onClick={handleResend}
            disabled={isResending || countdown > 0 || !email}
            variant="outline"
            className="w-full h-12 border-orange-500/30 hover:bg-orange-500/10"
          >
            {isResending ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Reenviando...
              </span>
            ) : countdown > 0 ? (
              <span>Reenviar em {countdown}s</span>
            ) : (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Reenviar email
              </span>
            )}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
            <Flame className="h-3 w-3 text-orange-500/50" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          </div>

          <div className="text-center">
            <Link
              href="/cadastro"
              className="text-sm text-muted-foreground hover:text-orange-500 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar para o cadastro
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <VerificarEmailContent />
    </Suspense>
  )
}
