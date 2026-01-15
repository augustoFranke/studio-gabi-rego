"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { ThemeToggleSimple } from "@/components/theme-toggle"
import { Flame, Eye, EyeOff, ArrowRight, Check, X } from "lucide-react"
import Image from "next/image"

export default function CadastroPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const router = useRouter()

  // Password validation rules
  const passwordRules = [
    { label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { label: "Uma letra maiúscula", valid: /[A-Z]/.test(password) },
    { label: "Um número", valid: /[0-9]/.test(password) },
  ]

  const allRulesValid = passwordRules.every(rule => rule.valid)
  const passwordsMatch = password === confirmPassword && password.length > 0

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!allRulesValid) {
      toast.error("A senha não atende aos requisitos mínimos")
      return
    }

    if (!passwordsMatch) {
      toast.error("As senhas não coincidem")
      return
    }

    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string

    try {
      const response = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: password }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Erro ao criar conta")
        setIsLoading(false)
        return
      }

      toast.success("Conta criada! Verifique seu email.")
      router.push("/verificar-email?email=" + encodeURIComponent(email))
    } catch (error) {
      toast.error("Ocorreu um erro ao criar sua conta")
      console.error(error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-orange-950 via-background to-orange-900/20 dark:from-orange-950/50 dark:via-background dark:to-orange-900/10">
      {/* Animated background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-orange-600/25 to-amber-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-orange-500/5 blur-3xl" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-600/30 to-transparent" />
      </div>

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggleSimple />
      </div>

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 w-2 h-2 rounded-full bg-orange-500/60 animate-pulse" />
      <div className="absolute top-40 right-20 w-3 h-3 rounded-full bg-orange-400/40 animate-pulse delay-300" />
      <div className="absolute bottom-32 left-20 w-2 h-2 rounded-full bg-orange-600/50 animate-pulse delay-700" />
      <div className="absolute bottom-20 right-32 w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse delay-500" />

      <Card className="w-full max-w-md relative z-10 border-orange-500/20 shadow-2xl shadow-orange-900/20 dark:shadow-orange-500/10 gap-0 backdrop-blur-sm bg-card/95">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-t-xl" />

        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Gabi Studio"
              width={180}
              height={180}
              className="object-contain"
              priority
            />
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">1</div>
              <span className="text-xs text-orange-500 font-medium">Cadastro</span>
            </div>
            <div className="w-8 h-px bg-orange-500/30" />
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">2</div>
              <span className="text-xs text-muted-foreground">Verificar</span>
            </div>
            <div className="w-8 h-px bg-orange-500/30" />
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">3</div>
              <span className="text-xs text-muted-foreground">Perfil</span>
            </div>
          </div>

          <CardDescription className="text-muted-foreground mt-1">
            Crie sua conta para começar
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-orange-500" />
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                required
                disabled={isLoading}
                className="h-12 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-orange-500" />
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-10 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password rules */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passwordRules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      {rule.valid ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-red-500" />
                      )}
                      <span className={rule.valid ? "text-green-500" : "text-muted-foreground"}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-orange-500" />
                Confirmar Senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 pr-10 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {confirmPassword.length > 0 && (
                <div className="flex items-center gap-2 text-xs mt-1">
                  {passwordsMatch ? (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Senhas coincidem</span>
                    </>
                  ) : (
                    <>
                      <X className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">Senhas não coincidem</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-all border-0 mt-2"
              disabled={isLoading || !allRulesValid || !passwordsMatch}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando conta...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
            <Flame className="h-3 w-3 text-orange-500/50" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link href="/login" className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
                Entrar
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} <span className="text-orange-500/80 font-medium">Gabi Studio</span>. Todos os direitos reservados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
