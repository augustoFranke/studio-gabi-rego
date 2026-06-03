"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ClipboardList, Copy, Heart, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useReducer } from "react"
import { toast } from "sonner"
import { fetchWithTimeout, readResponseErrorMessage } from "@/lib/http"
import type { AnamneseFormData } from '@/lib/anamnese'

interface MemberInfo {
  id: string
  nome: string
  sexo: "Masculino" | "Feminino"
}

type AnamnesePageState = {
  loading: boolean
  saving: boolean
  copying: boolean
  memberInfo: MemberInfo | null
  formData: AnamneseFormData
}

type AnamnesePageAction =
  | { type: "loading"; loading: boolean }
  | { type: "saving"; saving: boolean }
  | { type: "copying"; copying: boolean }
  | { type: "loaded"; memberInfo: MemberInfo | null; formData: AnamneseFormData }
  | { type: "formData"; formData: AnamneseFormData }

const initialAnamnesePageState: AnamnesePageState = {
  loading: true,
  saving: false,
  copying: false,
  memberInfo: null,
  formData: {},
}

function anamnesePageReducer(
  state: AnamnesePageState,
  action: AnamnesePageAction
): AnamnesePageState {
  switch (action.type) {
    case "loading":
      return { ...state, loading: action.loading }
    case "saving":
      return { ...state, saving: action.saving }
    case "copying":
      return { ...state, copying: action.copying }
    case "loaded":
      return {
        ...state,
        loading: false,
        memberInfo: action.memberInfo,
        formData: action.formData,
      }
    case "formData":
      return { ...state, formData: action.formData }
  }
}

export default function AnamnesePage() {
  return useAdminAnamnesePage()
}

function useAdminAnamnesePage() {
  const params = useParams()
  const memberId = params.id as string

  const [{ loading, saving, copying, memberInfo, formData }, dispatch] =
    useReducer(anamnesePageReducer, initialAnamnesePageState)

  const loadMemberData = useCallback(async () => {
    try {
      dispatch({ type: "loading", loading: true })
      const response = await fetchWithTimeout(`/api/membros/${memberId}/anamnese`)
      if (response.ok) {
        const data = await response.json()
        dispatch({ type: "loaded", memberInfo: data.member, formData: data.anamnese || {} })
      }
    } catch (error) {
      console.error("Error loading anamnese:", error)
      toast.error("Erro ao carregar dados da anamnese")
    } finally {
      dispatch({ type: "loading", loading: false })
    }
  }, [memberId])

  useEffect(() => {
    loadMemberData()
  }, [loadMemberData])



  const handleSave = async () => {
    try {
      dispatch({ type: "saving", saving: true })
      const response = await fetchWithTimeout(`/api/membros/${memberId}/anamnese`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
      if (response.ok) {
        toast.success("Anamnese salva com sucesso!")
      } else {
        toast.error("Erro ao salvar anamnese")
      }
    } catch (error) {
      console.error("Error saving:", error)
      toast.error("Erro ao salvar anamnese")
    } finally {
      dispatch({ type: "saving", saving: false })
    }
  }

  const handleCopyLink = async () => {
    try {
      dispatch({ type: "copying", copying: true })
      const response = await fetchWithTimeout(`/api/membros/${memberId}/anamnese-link`, { method: "POST" })
      if (!response.ok) {
        toast.error(await readResponseErrorMessage(response, "Erro ao gerar link"))
        return
      }

      const data = await response.json()
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.link)
      } else {
        window.prompt("Copie o link abaixo:", data.link)
      }

      toast.success("Link copiado! Ele expira em 1 hora.")
    } catch (error) {
      console.error("Error copying link:", error)
      toast.error("Erro ao copiar link")
    } finally {
      dispatch({ type: "copying", copying: false })
    }
  }

  const updateField = (field: keyof AnamneseFormData, value: string) => {
    dispatch({ type: "formData", formData: { ...formData, [field]: value } })
  }

  const isWoman = memberInfo?.sexo === "Feminino"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/alunos/${memberId}`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Anamnese</h1>
            <p className="text-muted-foreground">
              {memberInfo?.nome || "Membro"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCopyLink} disabled={copying}>
            {copying ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Copy className="mr-2 size-4" />
            )}
            Copiar link
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Salvar
          </Button>
        </div>
      </div>

      {/* Anamnese Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" />
            Anamnese
          </CardTitle>
          <CardDescription>
            Questionário de saúde e histórico do aluno
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="altura">Qual sua altura?</Label>
              <Input
                id="altura"
                type="number"
                step="0.01"
                placeholder="1.70"
                value={formData.altura || ""}
                onChange={(e) => updateField("altura", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pesoAtual">Peso atual?</Label>
              <Input
                id="pesoAtual"
                type="number"
                step="0.1"
                placeholder="70.0"
                value={formData.pesoAtual || ""}
                onChange={(e) => updateField("pesoAtual", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="objetivo">Objetivo atividade física</Label>
              <Select
                value={formData.objetivo || ""}
                onValueChange={(value) => updateField("objetivo", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
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
          </div>

          {/* Activity */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pratica alguma atividade física regularmente?</Label>
                <Select
                  value={formData.praticaAtividade || ""}
                  onValueChange={(value) => updateField("praticaAtividade", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.praticaAtividade === "Sim" && (
                <div className="space-y-2">
                  <Label htmlFor="praticaAtividadeQual">Qual?</Label>
                  <Input
                    id="praticaAtividadeQual"
                    value={formData.praticaAtividadeQual || ""}
                    onChange={(e) => updateField("praticaAtividadeQual", e.target.value)}
                  />
                </div>
              )}
            </div>

            {formData.praticaAtividade === "Não" && (
              <div className="space-y-2">
                <Label htmlFor="tempoSedentario">Se está sedentário, quanto tempo está sem atividade física?</Label>
                <Input
                  id="tempoSedentario"
                  value={formData.tempoSedentario || ""}
                  onChange={(e) => updateField("tempoSedentario", e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Medical History */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Histórico Médico</h3>

            {/* Medical condition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Possui alguma condição médica ou problemas previamente mencionados?</Label>
                <Select
                  value={formData.condicaoMedica || ""}
                  onValueChange={(value) => updateField("condicaoMedica", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.condicaoMedica === "Sim" && (
                <div className="space-y-2">
                  <Label htmlFor="condicaoMedicaQual">Qual?</Label>
                  <Input
                    id="condicaoMedicaQual"
                    value={formData.condicaoMedicaQual || ""}
                    onChange={(e) => updateField("condicaoMedicaQual", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Injury */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teve ou tem alguma lesão?</Label>
                <Select
                  value={formData.lesao || ""}
                  onValueChange={(value) => updateField("lesao", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.lesao === "Sim" && (
                <div className="space-y-2">
                  <Label htmlFor="lesaoQual">Qual?</Label>
                  <Input
                    id="lesaoQual"
                    value={formData.lesaoQual || ""}
                    onChange={(e) => updateField("lesaoQual", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Movement restriction */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tem alguma restrição de movimento com laudo médico?</Label>
                <Select
                  value={formData.restricaoMovimento || ""}
                  onValueChange={(value) => updateField("restricaoMovimento", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.restricaoMovimento === "Sim" && (
                <div className="space-y-2">
                  <Label htmlFor="restricaoMovimentoQual">Qual?</Label>
                  <Input
                    id="restricaoMovimentoQual"
                    value={formData.restricaoMovimentoQual || ""}
                    onChange={(e) => updateField("restricaoMovimentoQual", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Movement discomfort */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sente algum desconforto ou dor ao realizar algum movimento?</Label>
                <Select
                  value={formData.desconfortoMovimento || ""}
                  onValueChange={(value) => updateField("desconfortoMovimento", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.desconfortoMovimento === "Sim" && (
                <div className="space-y-2">
                  <Label htmlFor="desconfortoMovimentoQual">Qual?</Label>
                  <Input
                    id="desconfortoMovimentoQual"
                    value={formData.desconfortoMovimentoQual || ""}
                    onChange={(e) => updateField("desconfortoMovimentoQual", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Orthopedic problems */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Você tem quaisquer lesões ou problemas ortopédicos (Bursite, Tendinite, Condromalácia patelas, Hérnia de disco, etc.)?</Label>
                <Select
                  value={formData.problemasOrtopedicos || ""}
                  onValueChange={(value) => updateField("problemasOrtopedicos", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.problemasOrtopedicos === "Sim" && (
                <div className="space-y-2">
                  <Label htmlFor="problemasOrtopedicosQual">Qual?</Label>
                  <Input
                    id="problemasOrtopedicosQual"
                    value={formData.problemasOrtopedicosQual || ""}
                    onChange={(e) => updateField("problemasOrtopedicosQual", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Controlled medication */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Toma algum medicamento controlado?</Label>
                <Select
                  value={formData.medicamentoControlado || ""}
                  onValueChange={(value) => updateField("medicamentoControlado", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.medicamentoControlado === "Sim" && (
                <div className="space-y-2">
                  <Label htmlFor="medicamentoControladoQual">Qual?</Label>
                  <Input
                    id="medicamentoControladoQual"
                    value={formData.medicamentoControladoQual || ""}
                    onChange={(e) => updateField("medicamentoControladoQual", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Weight status */}
            <div className="space-y-2">
              <Label htmlFor="obesoSobrepeso">Está obeso ou com sobre peso?</Label>
              <Input
                id="obesoSobrepeso"
                value={formData.obesoSobrepeso || ""}
                onChange={(e) => updateField("obesoSobrepeso", e.target.value)}
              />
            </div>

            {/* Health conditions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Colesterol elevado</Label>
                <Select
                  value={formData.colesterolElevado || ""}
                  onValueChange={(value) => updateField("colesterolElevado", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Exercise difficulty */}
            <div className="space-y-2">
              <Label htmlFor="dificuldadeExercicio">Sente dificuldade de execução ou sente dor em algum exercício específico?</Label>
              <Textarea
                id="dificuldadeExercicio"
                value={formData.dificuldadeExercicio || ""}
                onChange={(e) => updateField("dificuldadeExercicio", e.target.value)}
              />
            </div>

            {/* Women-specific question */}
            {isWoman && (
              <div className="space-y-2 p-4 bg-pink-50 dark:bg-pink-950 rounded-lg">
                <Label htmlFor="cicloMenstrual">Seu ciclo menstrual é de quantos dias? Sente desconforto ou fraqueza em algum período do seu ciclo?</Label>
                <Textarea
                  id="cicloMenstrual"
                  value={formData.cicloMenstrual || ""}
                  onChange={(e) => updateField("cicloMenstrual", e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Experience */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Experiência</h3>

            <div className="space-y-2">
              <Label htmlFor="experienciaMusculacao">Você tem ou já teve alguma experiência na musculação? Se considera iniciante, intermediário ou avançado?</Label>
              <Textarea
                id="experienciaMusculacao"
                value={formData.experienciaMusculacao || ""}
                onChange={(e) => updateField("experienciaMusculacao", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ondeConheceu">Onde você conheceu meu trabalho?</Label>
              <Input
                id="ondeConheceu"
                value={formData.ondeConheceu || ""}
                onChange={(e) => updateField("ondeConheceu", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectativas">O que você espera de mim como profissional?</Label>
              <Textarea
                id="expectativas"
                value={formData.expectativas || ""}
                onChange={(e) => updateField("expectativas", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PAR-Q Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="size-5" />
            PAR-Q
          </CardTitle>
          <CardDescription>
            Questionário de Prontidão para Atividade Física
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>1 - Alguma vez um médico disse que você possui um problema no coração e lhe recomendou que só fizesse atividade física sob supervisão médica?</Label>
              <Select
                value={formData.parq1 || ""}
                onValueChange={(value) => updateField("parq1", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>2 - Você sente dor no peito, causada pela prática de atividade física?</Label>
              <Select
                value={formData.parq2 || ""}
                onValueChange={(value) => updateField("parq2", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>3 - Você sentiu dor no peito no último mês?</Label>
              <Select
                value={formData.parq3 || ""}
                onValueChange={(value) => updateField("parq3", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>4 - Você tende a perder a consciência ou cair, como resultado de tonteira ou desmaio?</Label>
              <Select
                value={formData.parq4 || ""}
                onValueChange={(value) => updateField("parq4", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>5 - Você tem algum problema ósseo ou muscular que poderia ser agravado com a prática de atividade física?</Label>
              <Select
                value={formData.parq5 || ""}
                onValueChange={(value) => updateField("parq5", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>6 - Algum médico já lhe recomendou o uso de medicamentos para a sua pressão arterial, para circulação ou coração?</Label>
              <Select
                value={formData.parq6 || ""}
                onValueChange={(value) => updateField("parq6", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>7 - Você tem conhecimento, através da sua própria experiência ou aconselhamento médico, de alguma outra razão física que impeça sua prática de atividade física sem supervisão médica?</Label>
              <Select
                value={formData.parq7 || ""}
                onValueChange={(value) => updateField("parq7", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={`/alunos/${memberId}`}>Cancelar</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : null}
          Salvar Anamnese
        </Button>
      </div>
    </div>
  )
}
