"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"

const PROFILE_TOKEN_STORAGE_KEY = "onboarding_profile_token"

type FormState = {
  nome: string
  cpf: string
  rg: string
  telefone: string
  dataNascimento: string
  sexo: "" | "MASCULINO" | "FEMININO"
}

const initialState: FormState = {
  nome: "",
  cpf: "",
  rg: "",
  telefone: "",
  dataNascimento: "",
  sexo: "",
}

function loadStoredToken() {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(PROFILE_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function saveStoredToken(token: string) {
  try {
    localStorage.setItem(PROFILE_TOKEN_STORAGE_KEY, token)
  } catch {
    // Ignore storage failures
  }
}

function clearStoredToken() {
  try {
    localStorage.removeItem(PROFILE_TOKEN_STORAGE_KEY)
  } catch {
    // Ignore storage failures
  }
}

function CompletarPerfilContent() {
  const { status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [profileToken, setProfileToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(initialState)

  useEffect(() => {
    if (status === "loading") return

    if (status === "authenticated") {
      router.replace("/meu-perfil")
      return
    }

    const tokenFromUrl = searchParams.get("token")
    const tokenFromStorage = loadStoredToken()
    const token = tokenFromUrl || tokenFromStorage

    if (tokenFromUrl) {
      saveStoredToken(tokenFromUrl)
    }

    if (!token) {
      router.replace("/cadastro")
      return
    }

    setProfileToken(token)
    setReady(true)
  }, [searchParams, router, status])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profileToken) return

    setSubmitting(true)
    setMessage(null)

    try {
      const cpf = formState.cpf.replace(/\D/g, "")
      const telefone = formState.telefone.replace(/\D/g, "")

      const response = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: profileToken,
          nome: formState.nome,
          cpf: cpf || null,
          rg: formState.rg.trim() || null,
          telefone: telefone || null,
          dataNascimento: formState.dataNascimento || null,
          sexo: formState.sexo || null,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar perfil")
      }

      setMessage("Perfil salvo com sucesso. Você será redirecionado.")
      clearStoredToken()
      if (data.anamneseToken) {
        router.replace(`/anamnese?token=${encodeURIComponent(data.anamneseToken)}`)
        return
      }

      router.replace("/anamnese")
    } catch (error) {
      const text = error instanceof Error ? error.message : "Erro ao salvar perfil"
      toast.error(text)
      setMessage(text)
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "loading" || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-stone-50 via-background to-stone-200/60 dark:from-orange-950/50 dark:via-background dark:to-orange-900/10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-orange-600/25 to-amber-500/10 blur-3xl" />
      </div>

      <Card className="w-full max-w-xl relative z-10 border-orange-500/20 shadow-2xl shadow-orange-900/20 dark:shadow-orange-500/10 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Gabi Studio"
              width={140}
              height={140}
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl">Completar perfil</CardTitle>
          <CardDescription>
            Preencha seus dados para finalizar o acesso e seguir para a anamnese.
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formState.nome}
                onChange={(event) => setFormState((current) => ({ ...current, nome: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formState.cpf}
                onChange={(event) => setFormState((current) => ({ ...current, cpf: event.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rg">RG</Label>
              <Input
                id="rg"
                value={formState.rg}
                onChange={(event) => setFormState((current) => ({ ...current, rg: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formState.telefone}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, telefone: event.target.value }))
                }
                placeholder="(65) 99999-9999"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dataNascimento">Data de nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={formState.dataNascimento}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, dataNascimento: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Sexo</Label>
              <Select
                value={formState.sexo || undefined}
                onValueChange={(value: "MASCULINO" | "FEMININO") =>
                  setFormState((current) => ({ ...current, sexo: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MASCULINO">Masculino</SelectItem>
                  <SelectItem value="FEMININO">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Continuar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CompletarPerfilPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <CompletarPerfilContent />
    </Suspense>
  )
}
