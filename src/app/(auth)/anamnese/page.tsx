"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggleSimple } from "@/components/theme-toggle"
import { Flame, ArrowRight, ClipboardList, Heart, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import Image from "next/image"

interface AnamneseData {
  altura?: string
  pesoAtual?: string
  objetivo?: string
  praticaAtividade?: string
  praticaAtividadeQual?: string
  tempoSedentario?: string
  condicaoMedica?: string
  condicaoMedicaQual?: string
  lesao?: string
  lesaoQual?: string
  restricaoMovimento?: string
  restricaoMovimentoQual?: string
  desconfortoMovimento?: string
  desconfortoMovimentoQual?: string
  problemasOrtopedicos?: string
  problemasOrtopedicosQual?: string
  medicamentoControlado?: string
  medicamentoControladoQual?: string
  obesoSobrepeso?: string
  colesterolElevado?: string
  taquicardia?: string
  doencasCardiacas?: string
  diabetes?: string
  dificuldadeExercicio?: string
  cicloMenstrual?: string
  experienciaMusculacao?: string
  ondeConheceu?: string
  expectativas?: string
  parq1?: string
  parq2?: string
  parq3?: string
  parq4?: string
  parq5?: string
  parq6?: string
  parq7?: string
}

function AnamneseContent() {
  const { status } = useSession()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [formData, setFormData] = useState<AnamneseData>({})
  const [sexo, setSexo] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    medical: false,
    parq: false,
    experience: false,
  })
  const router = useRouter()

  // Load user data on mount
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        setTokenError(null)
        const endpoint = token
          ? `/api/anamnese-token?token=${encodeURIComponent(token)}`
          : "/api/minha-anamnese"
        const response = await fetch(endpoint)
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
          const data = await response.json().catch(() => ({}))
          if (token) {
            if (isMounted) {
              setTokenError(data.error || "Link inválido ou expirado.")
              setLoadingData(false)
            }
            return
          }
          if (response.status === 404) {
            // Profile not found - redirect to complete profile first (no toast needed, the redirect is self-explanatory)
            router.push("/completar-perfil")
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

    if (token || status !== "loading") {
      loadData()
    }

    return () => {
      isMounted = false
    }
  }, [status, router, token])

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated" && !token) {
      router.push("/login")
    }
  }, [status, router, token])

  const updateField = (field: keyof AnamneseData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const isWoman = sexo === "FEMININO"

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    try {
      const endpoint = token
        ? `/api/anamnese-token?token=${encodeURIComponent(token)}`
        : "/api/minha-anamnese"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Erro ao salvar anamnese")
        setIsLoading(false)
        return
      }

      if (token) {
        toast.success("Anamnese enviada com sucesso!")
        setIsLoading(false)
        return
      }

      toast.success("Cadastro concluído!")
      // Redirect to login with success message
      router.push("/login?cadastro=completo")
    } catch (error) {
      toast.error("Ocorreu um erro ao salvar")
      console.error(error)
      setIsLoading(false)
    }
  }

  if (status === "loading" || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-950 via-background to-orange-900/20">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="min-h-screen p-4 relative overflow-hidden bg-gradient-to-br from-orange-950 via-background to-orange-900/20 dark:from-orange-950/50 dark:via-background dark:to-orange-900/10">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-orange-600/25 to-amber-500/10 blur-3xl" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        </div>
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggleSimple />
        </div>
        <div className="max-w-md mx-auto relative z-10 pt-24">
          <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95 text-center">
            <CardHeader>
              <CardTitle>Link inválido</CardTitle>
              <CardDescription>{tokenError}</CardDescription>
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

  return (
    <div className="min-h-screen p-4 relative overflow-hidden bg-gradient-to-br from-orange-950 via-background to-orange-900/20 dark:from-orange-950/50 dark:via-background dark:to-orange-900/10">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-orange-600/25 to-amber-500/10 blur-3xl" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
      </div>

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggleSimple />
      </div>

      <div className="max-w-2xl mx-auto relative z-10 space-y-6 pb-20">
        {/* Header */}
        <div className="text-center pt-6 pb-4">
          <Image
            src="/logo.png"
            alt="Gabi Studio"
            width={120}
            height={120}
            className="object-contain mx-auto mb-4"
            priority
          />

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-1">
              <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">
                <Check className="w-4 h-4" />
              </div>
            </div>
            <div className="w-6 h-px bg-green-500" />
            <div className="flex items-center gap-1">
              <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">
                <Check className="w-4 h-4" />
              </div>
            </div>
            <div className="w-6 h-px bg-green-500" />
            <div className="flex items-center gap-1">
              <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">
                <Check className="w-4 h-4" />
              </div>
            </div>
            <div className="w-6 h-px bg-orange-500" />
            <div className="flex items-center gap-1">
              <div className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">4</div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground">Anamnese</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Última etapa: conte-nos sobre sua saúde
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Basic Info Section */}
          <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleSection("basic")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-lg">Informações Básicas</CardTitle>
                </div>
                {expandedSections.basic ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {expandedSections.basic && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Altura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="1.70"
                      value={formData.altura || ""}
                      onChange={(e) => updateField("altura", e.target.value)}
                      className="h-12 border-orange-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="70.0"
                      value={formData.pesoAtual || ""}
                      onChange={(e) => updateField("pesoAtual", e.target.value)}
                      className="h-12 border-orange-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select
                    value={formData.objetivo || ""}
                    onValueChange={(value) => updateField("objetivo", value)}
                  >
                    <SelectTrigger className="h-12 border-orange-500/20">
                      <SelectValue placeholder="Selecione seu objetivo" />
                    </SelectTrigger>
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
                  <Select
                    value={formData.praticaAtividade || ""}
                    onValueChange={(value) => updateField("praticaAtividade", value)}
                  >
                    <SelectTrigger className="h-12 border-orange-500/20">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.praticaAtividade === "Sim" && (
                  <div className="space-y-2">
                    <Label>Qual atividade?</Label>
                    <Input
                      value={formData.praticaAtividadeQual || ""}
                      onChange={(e) => updateField("praticaAtividadeQual", e.target.value)}
                      className="h-12 border-orange-500/20"
                    />
                  </div>
                )}

                {formData.praticaAtividade === "Não" && (
                  <div className="space-y-2">
                    <Label>Há quanto tempo está sem atividade física?</Label>
                    <Input
                      value={formData.tempoSedentario || ""}
                      onChange={(e) => updateField("tempoSedentario", e.target.value)}
                      className="h-12 border-orange-500/20"
                    />
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Medical History Section */}
          <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleSection("medical")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-lg">Histórico Médico</CardTitle>
                </div>
                {expandedSections.medical ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {expandedSections.medical && (
              <CardContent className="space-y-4">
                {/* Condition */}
                <div className="space-y-2">
                  <Label>Possui alguma condição médica?</Label>
                  <Select
                    value={formData.condicaoMedica || ""}
                    onValueChange={(value) => updateField("condicaoMedica", value)}
                  >
                    <SelectTrigger className="h-12 border-orange-500/20">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.condicaoMedica === "Sim" && (
                  <div className="space-y-2">
                    <Label>Qual?</Label>
                    <Input
                      value={formData.condicaoMedicaQual || ""}
                      onChange={(e) => updateField("condicaoMedicaQual", e.target.value)}
                      className="h-12 border-orange-500/20"
                    />
                  </div>
                )}

                {/* Injury */}
                <div className="space-y-2">
                  <Label>Teve ou tem alguma lesão?</Label>
                  <Select
                    value={formData.lesao || ""}
                    onValueChange={(value) => updateField("lesao", value)}
                  >
                    <SelectTrigger className="h-12 border-orange-500/20">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.lesao === "Sim" && (
                  <div className="space-y-2">
                    <Label>Qual?</Label>
                    <Input
                      value={formData.lesaoQual || ""}
                      onChange={(e) => updateField("lesaoQual", e.target.value)}
                      className="h-12 border-orange-500/20"
                    />
                  </div>
                )}

                {/* Medication */}
                <div className="space-y-2">
                  <Label>Toma algum medicamento controlado?</Label>
                  <Select
                    value={formData.medicamentoControlado || ""}
                    onValueChange={(value) => updateField("medicamentoControlado", value)}
                  >
                    <SelectTrigger className="h-12 border-orange-500/20">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.medicamentoControlado === "Sim" && (
                  <div className="space-y-2">
                    <Label>Qual?</Label>
                    <Input
                      value={formData.medicamentoControladoQual || ""}
                      onChange={(e) => updateField("medicamentoControladoQual", e.target.value)}
                      className="h-12 border-orange-500/20"
                    />
                  </div>
                )}

                {/* Health conditions grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Colesterol elevado</Label>
                    <Select
                      value={formData.colesterolElevado || ""}
                      onValueChange={(value) => updateField("colesterolElevado", value)}
                    >
                      <SelectTrigger className="h-12 border-orange-500/20">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Diabetes</Label>
                    <Select
                      value={formData.diabetes || ""}
                      onValueChange={(value) => updateField("diabetes", value)}
                    >
                      <SelectTrigger className="h-12 border-orange-500/20">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Doenças cardíacas</Label>
                    <Select
                      value={formData.doencasCardiacas || ""}
                      onValueChange={(value) => updateField("doencasCardiacas", value)}
                    >
                      <SelectTrigger className="h-12 border-orange-500/20">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Taquicardia</Label>
                    <Select
                      value={formData.taquicardia || ""}
                      onValueChange={(value) => updateField("taquicardia", value)}
                    >
                      <SelectTrigger className="h-12 border-orange-500/20">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Women-specific */}
                {isWoman && (
                  <div className="space-y-2 p-4 bg-pink-50 dark:bg-pink-950/30 rounded-lg">
                    <Label>Ciclo menstrual e desconfortos</Label>
                    <Textarea
                      placeholder="Seu ciclo é de quantos dias? Sente desconforto em algum período?"
                      value={formData.cicloMenstrual || ""}
                      onChange={(e) => updateField("cicloMenstrual", e.target.value)}
                      className="min-h-[80px] border-orange-500/20"
                    />
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* PAR-Q Section */}
          <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleSection("parq")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  <div>
                    <CardTitle className="text-lg">PAR-Q</CardTitle>
                    <CardDescription className="text-xs">Prontidão para Atividade Física</CardDescription>
                  </div>
                </div>
                {expandedSections.parq ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
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
                    <Select
                      value={formData[field as keyof AnamneseData] || ""}
                      onValueChange={(value) => updateField(field as keyof AnamneseData, value)}
                    >
                      <SelectTrigger className="h-12 border-orange-500/20">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Experience Section */}
          <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleSection("experience")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-lg">Experiência</CardTitle>
                </div>
                {expandedSections.experience ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {expandedSections.experience && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Experiência com musculação</Label>
                  <Textarea
                    placeholder="Iniciante, intermediário ou avançado?"
                    value={formData.experienciaMusculacao || ""}
                    onChange={(e) => updateField("experienciaMusculacao", e.target.value)}
                    className="min-h-[80px] border-orange-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Como conheceu o Gabi Studio?</Label>
                  <Input
                    value={formData.ondeConheceu || ""}
                    onChange={(e) => updateField("ondeConheceu", e.target.value)}
                    className="h-12 border-orange-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label>O que espera do nosso trabalho?</Label>
                  <Textarea
                    value={formData.expectativas || ""}
                    onChange={(e) => updateField("expectativas", e.target.value)}
                    className="min-h-[80px] border-orange-500/20"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Submit Button - Fixed at bottom on mobile */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent md:relative md:p-0 md:bg-none">
            <Button
              type="submit"
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 transition-all border-0"
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
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 pb-16 md:pb-0">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          <Flame className="h-3 w-3 text-orange-500/50" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        </div>
      </div>
    </div>
  )
}

export default function AnamnesePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-950 via-background to-orange-900/20">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <AnamneseContent />
    </Suspense>
  )
}
