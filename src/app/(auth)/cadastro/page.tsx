"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AuthThemeBackdrop } from "@/components/auth-theme-backdrop"
import { Eye, EyeOff, ArrowRight, ArrowLeft, Check, X, ClipboardList, Heart, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import Image from "next/image"
import type { AnamneseFormData } from '@/lib/anamnese'

const SESSION_STORAGE_KEY = "cadastro_wizard_state"

interface WizardState {
  step: number
  email: string
  password: string
  confirmPassword: string
  nome: string
  cpf: string
  rg: string
  telefone: string
  dataNascimento: string
  sexo: string
  anamnese: AnamneseFormData
}

const defaultState: WizardState = {
  step: 1,
  email: "",
  password: "",
  confirmPassword: "",
  nome: "",
  cpf: "",
  rg: "",
  telefone: "",
  dataNascimento: "",
  sexo: "",
  anamnese: {},
}

function loadState(): WizardState {
  if (typeof window === "undefined") return defaultState
  try {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (saved) return { ...defaultState, ...JSON.parse(saved) }
  } catch {
    // Ignore storage errors
  }
  return defaultState
}

function saveState(state: WizardState) {
  try {
    // Don't persist passwords in sessionStorage
    const { password, confirmPassword, ...safe } = state
    void password
    void confirmPassword
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safe))
  } catch {
    // Ignore storage errors
  }
}

function clearState() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export default function CadastroPage() {
  const [state, setState] = useState<WizardState>(loadState)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    medical: false,
    parq: false,
    experience: false,
  })
  const router = useRouter()
  const isFirstRender = useRef(true)

  // Persist state to sessionStorage on changes (except passwords), skip initial render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    saveState(state)
  }, [state])

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const updateAnamnese = useCallback((field: keyof AnamneseFormData, value: string) => {
    setState(prev => ({
      ...prev,
      anamnese: { ...prev.anamnese, [field]: value },
    }))
  }, [])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Password validation
  const passwordRules = [
    { label: "Mínimo 8 caracteres", valid: state.password.length >= 8 },
    { label: "Uma letra maiúscula", valid: /[A-Z]/.test(state.password) },
    { label: "Um número", valid: /[0-9]/.test(state.password) },
  ]
  const allRulesValid = passwordRules.every(rule => rule.valid)
  const passwordsMatch = state.password === state.confirmPassword && state.password.length > 0

  // CPF formatter
  function handleCpfChange(value: string) {
    const numbers = value.replace(/\D/g, "")
    let formatted = numbers
    if (numbers.length > 3) formatted = numbers.slice(0, 3) + "." + numbers.slice(3)
    if (numbers.length > 6) formatted = formatted.slice(0, 7) + "." + numbers.slice(6)
    if (numbers.length > 9) formatted = formatted.slice(0, 11) + "-" + numbers.slice(9, 11)
    updateState({ cpf: formatted })
  }

  // Phone formatter
  function handleTelefoneChange(value: string) {
    const numbers = value.replace(/\D/g, "")
    let formatted = numbers
    if (numbers.length > 0) formatted = "(" + numbers.slice(0, 2)
    if (numbers.length > 2) formatted += ") " + numbers.slice(2, 7)
    if (numbers.length > 7) formatted += "-" + numbers.slice(7, 11)
    updateState({ telefone: formatted })
  }

  // Step 1 validation
  function validateStep1(): boolean {
    if (!state.email) {
      toast.error("Informe seu email")
      return false
    }
    if (!allRulesValid) {
      toast.error("A senha não atende aos requisitos mínimos")
      return false
    }
    if (!passwordsMatch) {
      toast.error("As senhas não coincidem")
      return false
    }
    return true
  }

  // Step 2 validation
  function validateStep2(): boolean {
    if (!state.nome || state.nome.trim().length < 3) {
      toast.error("Informe seu nome completo (mínimo 3 caracteres)")
      return false
    }
    const cpfNumbers = state.cpf.replace(/\D/g, "")
    if (cpfNumbers.length > 0 && cpfNumbers.length !== 11) {
      toast.error("CPF inválido")
      return false
    }
    const telefoneNumbers = state.telefone.replace(/\D/g, "")
    if (telefoneNumbers.length > 0 && telefoneNumbers.length < 10) {
      toast.error("Telefone inválido")
      return false
    }
    if (state.dataNascimento) {
      const birthDate = new Date(state.dataNascimento)
      if (Number.isNaN(birthDate.getTime())) {
        toast.error("Data de nascimento inválida")
        return false
      }
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      if (age < 16) {
        toast.error("Você precisa ter pelo menos 16 anos")
        return false
      }
    }
    return true
  }

  function goToStep(nextStep: number) {
    if (nextStep > state.step) {
      if (state.step === 1 && !validateStep1()) return
      if (state.step === 2 && !validateStep2()) return
    }
    updateState({ step: nextStep })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateStep1() || !validateStep2()) return

    setIsLoading(true)
    try {
      const cpfNumbers = state.cpf.replace(/\D/g, "")
      const telefoneNumbers = state.telefone.replace(/\D/g, "")

      const response = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.email,
          senha: state.password,
          nome: state.nome,
          cpf: cpfNumbers || null,
          rg: state.rg.trim() || null,
          telefone: telefoneNumbers || null,
          dataNascimento: state.dataNascimento || null,
          sexo: state.sexo || null,
          anamnese: state.anamnese,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Erro ao criar conta")
        setIsLoading(false)
        return
      }

      clearState()
      toast.success("Cadastro realizado! Verifique seu email.")
      router.push("/verificar-email?email=" + encodeURIComponent(state.email))
    } catch (error) {
      toast.error("Ocorreu um erro ao criar sua conta")
      console.error(error)
      setIsLoading(false)
    }
  }

  const isWoman = state.sexo === "FEMININO"
  const stepLabels = ["Conta", "Perfil", "Saúde"]

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <AuthThemeBackdrop />

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 w-2 h-2 rounded-full bg-orange-500/60 animate-pulse" />
      <div className="absolute top-40 right-20 w-3 h-3 rounded-full bg-orange-400/40 animate-pulse delay-300" />
      <div className="absolute bottom-32 left-20 w-2 h-2 rounded-full bg-orange-600/50 animate-pulse delay-700" />
      <div className="absolute bottom-20 right-32 w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse delay-500" />

      <div className={`w-full relative z-10 ${state.step === 3 ? "max-w-2xl" : "max-w-md"}`}>
        {state.step === 3 ? (
          /* Step 3: Anamnesis - full-width layout */
          <div className="space-y-6 pb-20">
            <div className="text-center pt-2 pb-4">
              <Image
                src="/logo.png"
                alt="Gabi Studio"
                width={120}
                height={120}
                className="object-contain mx-auto mb-4"
                priority
              />
              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-3 mb-4">
                {stepLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i + 1 <= state.step
                        ? "bg-orange-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1 < state.step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${
                      i + 1 === state.step ? "text-orange-500" : "text-muted-foreground"
                    }`}>
                      {label}
                    </span>
                    {i < stepLabels.length - 1 && (
                      <div className={`w-8 h-px mx-1 ${
                        i + 1 < state.step ? "bg-orange-500" : "bg-muted"
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              <h1 className="text-2xl font-bold text-foreground">Anamnese</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Conte-nos sobre sua saúde para um treino seguro
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {/* Basic Info Section */}
              <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
                <CardHeader className="cursor-pointer" onClick={() => toggleSection("basic")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-orange-500" />
                      <CardTitle className="text-lg">Informações Básicas</CardTitle>
                    </div>
                    {expandedSections.basic ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CardHeader>
                {expandedSections.basic && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Altura (m)</Label>
                        <Input type="number" step="0.01" placeholder="1.70" value={state.anamnese.altura || ""} onChange={(e) => updateAnamnese("altura", e.target.value)} className="h-12 border-orange-500/20" />
                      </div>
                      <div className="space-y-2">
                        <Label>Peso (kg)</Label>
                        <Input type="number" step="0.1" placeholder="70.0" value={state.anamnese.pesoAtual || ""} onChange={(e) => updateAnamnese("pesoAtual", e.target.value)} className="h-12 border-orange-500/20" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivo</Label>
                      <Select value={state.anamnese.objetivo || ""} onValueChange={(value) => updateAnamnese("objetivo", value)}>
                        <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione seu objetivo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                          <SelectItem value="Emagrecimento">Emagrecimento</SelectItem>
                          <SelectItem value="Condicionamento">Condicionamento</SelectItem>
                          <SelectItem value="Saúde">Saúde</SelectItem>
                          <SelectItem value="Reabilitação">Reabilitação</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Pratica alguma atividade física regularmente?</Label>
                      <Select value={state.anamnese.praticaAtividade || ""} onValueChange={(value) => updateAnamnese("praticaAtividade", value)}>
                        <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {state.anamnese.praticaAtividade === "Sim" && (
                      <div className="space-y-2">
                        <Label>Qual atividade?</Label>
                        <Input value={state.anamnese.praticaAtividadeQual || ""} onChange={(e) => updateAnamnese("praticaAtividadeQual", e.target.value)} className="h-12 border-orange-500/20" />
                      </div>
                    )}
                    {state.anamnese.praticaAtividade === "Não" && (
                      <div className="space-y-2">
                        <Label>Há quanto tempo está sem atividade física?</Label>
                        <Input value={state.anamnese.tempoSedentario || ""} onChange={(e) => updateAnamnese("tempoSedentario", e.target.value)} className="h-12 border-orange-500/20" />
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Medical History Section */}
              <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
                <CardHeader className="cursor-pointer" onClick={() => toggleSection("medical")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-orange-500" />
                      <CardTitle className="text-lg">Histórico Médico</CardTitle>
                    </div>
                    {expandedSections.medical ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CardHeader>
                {expandedSections.medical && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Possui alguma condição médica?</Label>
                      <Select value={state.anamnese.condicaoMedica || ""} onValueChange={(value) => updateAnamnese("condicaoMedica", value)}>
                        <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                      </Select>
                    </div>
                    {state.anamnese.condicaoMedica === "Sim" && (
                      <div className="space-y-2">
                        <Label>Qual?</Label>
                        <Input value={state.anamnese.condicaoMedicaQual || ""} onChange={(e) => updateAnamnese("condicaoMedicaQual", e.target.value)} className="h-12 border-orange-500/20" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Teve ou tem alguma lesão?</Label>
                      <Select value={state.anamnese.lesao || ""} onValueChange={(value) => updateAnamnese("lesao", value)}>
                        <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                      </Select>
                    </div>
                    {state.anamnese.lesao === "Sim" && (
                      <div className="space-y-2">
                        <Label>Qual?</Label>
                        <Input value={state.anamnese.lesaoQual || ""} onChange={(e) => updateAnamnese("lesaoQual", e.target.value)} className="h-12 border-orange-500/20" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Toma algum medicamento controlado?</Label>
                      <Select value={state.anamnese.medicamentoControlado || ""} onValueChange={(value) => updateAnamnese("medicamentoControlado", value)}>
                        <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                      </Select>
                    </div>
                    {state.anamnese.medicamentoControlado === "Sim" && (
                      <div className="space-y-2">
                        <Label>Qual?</Label>
                        <Input value={state.anamnese.medicamentoControladoQual || ""} onChange={(e) => updateAnamnese("medicamentoControladoQual", e.target.value)} className="h-12 border-orange-500/20" />
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Colesterol elevado</Label>
                        <Select value={state.anamnese.colesterolElevado || ""} onValueChange={(value) => updateAnamnese("colesterolElevado", value)}>
                          <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Diabetes</Label>
                        <Select value={state.anamnese.diabetes || ""} onValueChange={(value) => updateAnamnese("diabetes", value)}>
                          <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Doenças cardíacas</Label>
                        <Select value={state.anamnese.doencasCardiacas || ""} onValueChange={(value) => updateAnamnese("doencasCardiacas", value)}>
                          <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Taquicardia</Label>
                        <Select value={state.anamnese.taquicardia || ""} onValueChange={(value) => updateAnamnese("taquicardia", value)}>
                          <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                    {isWoman && (
                      <div className="space-y-2 p-4 bg-pink-50 dark:bg-pink-950/30 rounded-lg">
                        <Label>Ciclo menstrual e desconfortos</Label>
                        <Textarea placeholder="Seu ciclo é de quantos dias? Sente desconforto em algum período?" value={state.anamnese.cicloMenstrual || ""} onChange={(e) => updateAnamnese("cicloMenstrual", e.target.value)} className="min-h-[80px] border-orange-500/20" />
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* PAR-Q Section */}
              <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
                <CardHeader className="cursor-pointer" onClick={() => toggleSection("parq")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      <div>
                        <CardTitle className="text-lg">PAR-Q</CardTitle>
                        <CardDescription className="text-xs">Prontidão para Atividade Física</CardDescription>
                      </div>
                    </div>
                    {expandedSections.parq ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CardHeader>
                {expandedSections.parq && (
                  <CardContent className="space-y-4">
                    {[
                      { field: "parq1", question: "Algum médico disse que você possui problema no coração?" },
                      { field: "parq2", question: "Sente dor no peito durante atividade física?" },
                      { field: "parq3", question: "Sentiu dor no peito no último mês?" },
                      { field: "parq4", question: "Tende a perder consciência ou cair por tontura?" },
                      { field: "parq5", question: "Tem problema ósseo ou muscular que pode ser agravado?" },
                      { field: "parq6", question: "Médico recomendou medicamento para pressão/coração?" },
                      { field: "parq7", question: "Conhece outra razão que impeça atividade física?" },
                    ].map(({ field, question }, index) => (
                      <div key={field} className="space-y-2">
                        <Label className="text-sm">{index + 1}. {question}</Label>
                        <Select value={state.anamnese[field as keyof AnamneseFormData] || ""} onValueChange={(value) => updateAnamnese(field as keyof AnamneseFormData, value)}>
                          <SelectTrigger className="h-12 border-orange-500/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                        </Select>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>

              {/* Experience Section */}
              <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
                <CardHeader className="cursor-pointer" onClick={() => toggleSection("experience")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-orange-500" />
                      <CardTitle className="text-lg">Experiência</CardTitle>
                    </div>
                    {expandedSections.experience ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </CardHeader>
                {expandedSections.experience && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Experiência com musculação</Label>
                      <Textarea placeholder="Iniciante, intermediário ou avançado?" value={state.anamnese.experienciaMusculacao || ""} onChange={(e) => updateAnamnese("experienciaMusculacao", e.target.value)} className="min-h-[80px] border-orange-500/20" />
                    </div>
                    <div className="space-y-2">
                      <Label>Como conheceu o Gabi Studio?</Label>
                      <Input value={state.anamnese.ondeConheceu || ""} onChange={(e) => updateAnamnese("ondeConheceu", e.target.value)} className="h-12 border-orange-500/20" />
                    </div>
                    <div className="space-y-2">
                      <Label>O que espera do nosso trabalho?</Label>
                      <Textarea value={state.anamnese.expectativas || ""} onChange={(e) => updateAnamnese("expectativas", e.target.value)} className="min-h-[80px] border-orange-500/20" />
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Navigation buttons */}
              <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-background to-transparent md:relative md:p-0 md:bg-none">
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => goToStep(2)} className="h-14 px-6 border-orange-500/30 hover:bg-orange-500/10">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-14 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-shadow border-0"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Finalizando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Concluir Cadastro
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {/* Spacer for fixed bottom bar on mobile */}
            <div className="h-16 md:h-0" />
          </div>
        ) : (
          /* Steps 1 & 2: Card layout */
          <Card className="border-orange-500/20 shadow-2xl shadow-orange-900/20 dark:shadow-orange-500/10 gap-0 backdrop-blur-sm bg-card/95">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-t-xl" />

            <CardHeader className="text-center pb-4 pt-6">
              <div className="flex justify-center mb-4">
                <Image src="/logo.png" alt="Gabi Studio" width={180} height={180} className="object-contain" priority />
              </div>

              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-3 mb-3">
                {stepLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      i + 1 <= state.step
                        ? "bg-orange-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1 < state.step ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${
                      i + 1 === state.step ? "text-orange-500" : "text-muted-foreground"
                    }`}>
                      {label}
                    </span>
                    {i < stepLabels.length - 1 && (
                      <div className={`w-8 h-px mx-1 ${
                        i + 1 < state.step ? "bg-orange-500" : "bg-muted"
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              <CardDescription className="text-muted-foreground mt-1">
                {state.step === 1 ? "Crie sua conta para começar" : "Precisamos de algumas informações"}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0 pb-6">
              {state.step === 1 ? (
                /* Step 1: Credentials */
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-orange-500" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      required
                      disabled={isLoading}
                      value={state.email}
                      onChange={(e) => updateState({ email: e.target.value })}
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
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        disabled={isLoading}
                        value={state.password}
                        onChange={(e) => updateState({ password: e.target.value })}
                        className="h-12 pr-10 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {state.password.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {passwordRules.map((rule, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs">
                            {rule.valid ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-red-500" />}
                            <span className={rule.valid ? "text-green-500" : "text-muted-foreground"}>{rule.label}</span>
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
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        disabled={isLoading}
                        value={state.confirmPassword}
                        onChange={(e) => updateState({ confirmPassword: e.target.value })}
                        className="h-12 pr-10 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {state.confirmPassword.length > 0 && (
                      <div className="flex items-center gap-2 text-xs mt-1">
                        {passwordsMatch ? (
                          <><Check className="h-3 w-3 text-green-500" /><span className="text-green-500">Senhas coincidem</span></>
                        ) : (
                          <><X className="h-3 w-3 text-red-500" /><span className="text-red-500">Senhas não coincidem</span></>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-shadow border-0 mt-2"
                    disabled={!allRulesValid || !passwordsMatch}
                  >
                    <span className="flex items-center gap-2">
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Button>
                </div>
              ) : (
                /* Step 2: Profile */
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome" className="text-sm font-medium flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-orange-500" />
                      Nome completo *
                    </Label>
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome completo"
                      required
                      minLength={3}
                      disabled={isLoading}
                      value={state.nome}
                      onChange={(e) => updateState({ nome: e.target.value })}
                      className="h-12 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cpf" className="text-sm font-medium flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                        CPF
                      </Label>
                      <Input
                        id="cpf"
                        type="text"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        disabled={isLoading}
                        value={state.cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        maxLength={14}
                        className="h-12 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rg" className="text-sm font-medium flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                        RG
                      </Label>
                      <Input
                        id="rg"
                        type="text"
                        placeholder="Opcional"
                        disabled={isLoading}
                        value={state.rg}
                        onChange={(e) => updateState({ rg: e.target.value })}
                        className="h-12 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="telefone" className="text-sm font-medium flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                      Telefone
                    </Label>
                    <Input
                      id="telefone"
                      type="tel"
                      inputMode="tel"
                      placeholder="(00) 00000-0000"
                      disabled={isLoading}
                      value={state.telefone}
                      onChange={(e) => handleTelefoneChange(e.target.value)}
                      maxLength={15}
                      className="h-12 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="dataNascimento" className="text-sm font-medium flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                        Data de nascimento
                      </Label>
                      <Input
                        id="dataNascimento"
                        type="date"
                        disabled={isLoading}
                        value={state.dataNascimento}
                        onChange={(e) => updateState({ dataNascimento: e.target.value })}
                        className="h-12 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50 max-w-full"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="sexo" className="text-sm font-medium flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                        Sexo
                      </Label>
                      <Select value={state.sexo} onValueChange={(value) => updateState({ sexo: value })} disabled={isLoading}>
                        <SelectTrigger className="h-12 border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background/50">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FEMININO">Feminino</SelectItem>
                          <SelectItem value="MASCULINO">Masculino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-2">
                    <Button type="button" variant="outline" onClick={() => goToStep(1)} className="h-12 px-4 border-orange-500/30 hover:bg-orange-500/10">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => goToStep(3)}
                      className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-shadow border-0"
                    >
                      <span className="flex items-center gap-2">
                        Continuar
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Button>
                  </div>
                </div>
              )}

              {state.step === 1 && (
                <>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
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
                      &copy; {new Date().getFullYear()} <span className="text-orange-500/80 font-medium">Gabi Studio</span>. Todos os direitos reservados.
                    </p>
                  </div>
                </>
              )}

              {state.step === 2 && (
                <p className="text-xs text-center text-muted-foreground mt-5">
                  Seus dados estão protegidos e serão usados apenas para o cadastro.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
