"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { ThemeToggleSimple } from "@/components/theme-toggle"
import Image from "next/image"

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()

  // Check for registration complete message
  useEffect(() => {
    if (searchParams.get("cadastro") === "completo") {
      toast.success("Cadastro concluído! Agora você pode fazer login.")
    }
  }, [searchParams])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error.includes("USER_NOT_FOUND")) {
          toast.error("Nenhuma conta encontrada com este email")
        } else if (result.error.includes("WRONG_PASSWORD")) {
          toast.error("Senha incorreta")
        } else {
          toast.error("Email ou senha incorretos")
        }
        setIsLoading(false)
      } else {
        toast.success("Login realizado com sucesso!")
        // Use window.location.href for a hard navigation to ensure 
        // fresh session state and cookie transmission
        window.location.href = "/"
      }
    } catch (error) {
      toast.error("Ocorreu um erro ao tentar entrar")
      console.error(error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-orange-950 via-background to-orange-900/20 dark:from-orange-950/50 dark:via-background dark:to-orange-900/10">
      {/* Animated background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large orange glow - top right */}
        <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 blur-3xl animate-pulse" />
        {/* Deep orange glow - bottom left */}
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-orange-600/25 to-amber-500/10 blur-3xl" />
        {/* Center accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-orange-500/5 blur-3xl" />

        {/* Decorative lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-600/30 to-transparent" />
      </div>

      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggleSimple />
      </div>

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 w-2 h-2 rounded-full bg-orange-500/60 animate-pulse" />
      <div className="absolute top-40 right-20 w-3 h-3 rounded-full bg-orange-400/40 animate-pulse delay-300" />
      <div className="absolute bottom-32 left-20 w-2 h-2 rounded-full bg-orange-600/50 animate-pulse delay-700" />
      <div className="absolute bottom-20 right-32 w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse delay-500" />

      <Card className="w-full max-w-md relative z-10 border-orange-500/20 shadow-2xl shadow-orange-900/20 dark:shadow-orange-500/10 gap-0 backdrop-blur-sm bg-card/95">
        {/* Orange accent line at top of card */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-t-xl" />

        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Gabi Studio"
              width={224}
              height={224}
              className="object-contain"
              priority
            />
          </div>
          <CardDescription className="text-muted-foreground mt-1">
            Entre com seu email e senha para acessar
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
                className="h-10 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-orange-500" />
                Senha
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isLoading}
                className="h-10 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-all border-0 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          {/* Decorative divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Não tem uma conta?{" "}
              <Link href="/cadastro" className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
                Cadastre-se
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-950 via-background to-orange-900/20">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
