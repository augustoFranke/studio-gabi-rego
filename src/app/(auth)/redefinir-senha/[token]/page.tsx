"use client"

import { useReducer, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthThemeBackdrop } from "@/components/auth-theme-backdrop"
import { ThemeToggleSimple } from "@/components/theme-toggle"
import { AlertCircle, CheckCircle2, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"
import Image from "next/image"
import { fetchWithTimeout } from "@/lib/http"

interface PageProps {
  params: Promise<{ token: string }>
}

type TokenStatus = "validating" | "valid" | "invalid"

type ResetPasswordState = {
  isLoading: boolean
  tokenStatus: TokenStatus
  isSuccess: boolean
  showPassword: boolean
  showConfirmPassword: boolean
  password: string
  confirmPassword: string
}

type ResetPasswordAction =
  | { type: "tokenStatus"; tokenStatus: TokenStatus }
  | { type: "loading"; isLoading: boolean }
  | { type: "success" }
  | { type: "togglePassword" }
  | { type: "toggleConfirmPassword" }
  | { type: "password"; password: string }
  | { type: "confirmPassword"; confirmPassword: string }

const initialResetPasswordState: ResetPasswordState = {
  isLoading: false,
  tokenStatus: "validating",
  isSuccess: false,
  showPassword: false,
  showConfirmPassword: false,
  password: "",
  confirmPassword: "",
}

function resetPasswordReducer(
  state: ResetPasswordState,
  action: ResetPasswordAction
): ResetPasswordState {
  switch (action.type) {
    case "tokenStatus":
      return { ...state, tokenStatus: action.tokenStatus }
    case "loading":
      return { ...state, isLoading: action.isLoading }
    case "success":
      return { ...state, isSuccess: true }
    case "togglePassword":
      return { ...state, showPassword: !state.showPassword }
    case "toggleConfirmPassword":
      return { ...state, showConfirmPassword: !state.showConfirmPassword }
    case "password":
      return { ...state, password: action.password }
    case "confirmPassword":
      return { ...state, confirmPassword: action.confirmPassword }
  }
}

export default function RedefinirSenhaPage({ params }: PageProps) {
  const { token } = use(params)
  const { push } = useRouter()
  const [state, dispatch] = useReducer(resetPasswordReducer, initialResetPasswordState)
  const {
    isLoading,
    tokenStatus,
    isSuccess,
    showPassword,
    showConfirmPassword,
    password,
    confirmPassword,
  } = state

  // Password validation
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && password.length > 0

  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetchWithTimeout(`/api/auth/validar-token-reset?token=${token}`)
        const data = await response.json()
        dispatch({ type: "tokenStatus", tokenStatus: data.valid === true ? "valid" : "invalid" })
      } catch {
        dispatch({ type: "tokenStatus", tokenStatus: "invalid" })
      }
    }
    validateToken()
  }, [token])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!hasMinLength || !hasUppercase || !hasNumber) {
      toast.error("A senha não atende aos requisitos mínimos")
      return
    }

    if (!passwordsMatch) {
      toast.error("As senhas não coincidem")
      return
    }

    dispatch({ type: "loading", isLoading: true })

    try {
      const response = await fetchWithTimeout("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha: password }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Erro ao redefinir senha")
        return
      }

      dispatch({ type: "success" })
      toast.success("Senha redefinida com sucesso!")
    } catch {
      toast.error("Erro ao redefinir senha. Tente novamente.")
    } finally {
      dispatch({ type: "loading", isLoading: false })
    }
  }

  // Loading state
  if (tokenStatus === "validating") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-950 via-background to-orange-900/20">
        <div className="text-center">
          <div className="animate-spin size-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Validando link…</p>
        </div>
      </div>
    )
  }

  // Invalid token
  if (tokenStatus !== "valid") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
        <AuthThemeBackdrop />
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggleSimple />
        </div>

        <Card className="w-full max-w-md relative z-10 border-orange-500/20 shadow-2xl shadow-orange-900/20 dark:shadow-orange-500/10 backdrop-blur-sm bg-card/95">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-400 rounded-t-xl" />

          <CardHeader className="text-center pb-4 pt-6">
            <div className="mx-auto size-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="size-8 text-red-500" />
            </div>
            <CardTitle className="text-xl font-semibold text-red-500">Link Inválido ou Expirado</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Este link de redefinição de senha não é mais válido. Ele pode ter expirado ou já foi utilizado.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <Link href="/login">
              <Button className="w-full h-10 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30">
                <ArrowLeft className="size-4 mr-2" />
                Voltar para o Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
        <AuthThemeBackdrop />
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggleSimple />
        </div>

        <Card className="w-full max-w-md relative z-10 border-orange-500/20 shadow-2xl shadow-orange-900/20 dark:shadow-orange-500/10 backdrop-blur-sm bg-card/95">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-green-500 to-green-400 rounded-t-xl" />

          <CardHeader className="text-center pb-4 pt-6">
            <div className="mx-auto size-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="size-8 text-green-500" />
            </div>
            <CardTitle className="text-xl font-semibold text-green-500">Senha Redefinida!</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Sua senha foi alterada com sucesso. Agora você pode fazer login com sua nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <Button
              onClick={() => push("/login")}
              className="w-full h-10 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30"
            >
              Ir para o Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password reset form
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <AuthThemeBackdrop />

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
              width={160}
              height={160}
              className="object-contain"
              priority
            />
          </div>
          <div className="mx-auto size-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
            <Lock className="size-6 text-orange-500" />
          </div>
          <CardTitle className="text-xl font-semibold">Redefinir Senha</CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-orange-500" />
                Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => dispatch({ type: "password", password: e.target.value })}
                  placeholder="Digite sua nova senha"
                  required
                  disabled={isLoading}
                  className="h-10 pr-10 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                />
                <button
                  type="button"
                  onClick={() => dispatch({ type: "togglePassword" })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-orange-500" />
                Confirmar Senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => dispatch({ type: "confirmPassword", confirmPassword: e.target.value })}
                  placeholder="Confirme sua nova senha"
                  required
                  disabled={isLoading}
                  className="h-10 pr-10 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                />
                <button
                  type="button"
                  onClick={() => dispatch({ type: "toggleConfirmPassword" })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Password requirements */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground mb-2">Requisitos da senha:</p>
              <div className={`flex items-center gap-2 text-xs ${hasMinLength ? 'text-green-500' : 'text-muted-foreground'}`}>
                <div className={`size-1.5 rounded-full ${hasMinLength ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
                Mínimo 8 caracteres
              </div>
              <div className={`flex items-center gap-2 text-xs ${hasUppercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                <div className={`size-1.5 rounded-full ${hasUppercase ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
                Uma letra maiúscula
              </div>
              <div className={`flex items-center gap-2 text-xs ${hasNumber ? 'text-green-500' : 'text-muted-foreground'}`}>
                <div className={`size-1.5 rounded-full ${hasNumber ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
                Um número
              </div>
              <div className={`flex items-center gap-2 text-xs ${passwordsMatch ? 'text-green-500' : 'text-muted-foreground'}`}>
                <div className={`size-1.5 rounded-full ${passwordsMatch ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
                Senhas coincidem
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-shadow border-0 mt-2"
              disabled={isLoading || !hasMinLength || !hasUppercase || !hasNumber || !passwordsMatch}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Redefinindo…
                </span>
              ) : (
                "Redefinir Senha"
              )}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
            <div className="size-1.5 rounded-full bg-orange-500/50" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          </div>

          <div className="text-center">
            <Link href="/login" className="text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors inline-flex items-center gap-1">
              <ArrowLeft className="size-4" />
              Voltar para o Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
