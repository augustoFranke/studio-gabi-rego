"use client"

import { ChevronDown, ChevronUp, ClipboardList, Heart } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { AnamneseFormData } from "@/lib/anamnese"

export type AnamneseSectionKey = "basic" | "medical" | "parq" | "experience"

export type AnamneseSectionsState = Record<AnamneseSectionKey, boolean>

interface AnamneseSectionProps {
  formData: AnamneseFormData
  expandedSections: AnamneseSectionsState
  isWoman: boolean
  onToggleSection: (section: AnamneseSectionKey) => void
  onUpdateField: (field: keyof AnamneseFormData, value: string) => void
}

const yesNoItems = (
  <SelectContent>
    <SelectItem value="Sim">Sim</SelectItem>
    <SelectItem value="Não">Não</SelectItem>
  </SelectContent>
)

const parqQuestions: Array<{ field: keyof AnamneseFormData; question: string }> = [
  { field: "parq1", question: "Algum médico disse que você possui problema no coração?" },
  { field: "parq2", question: "Sente dor no peito durante atividade física?" },
  { field: "parq3", question: "Sentiu dor no peito no último mês?" },
  { field: "parq4", question: "Tende a perder consciência ou cair por tontura?" },
  { field: "parq5", question: "Tem problema ósseo ou muscular que pode ser agravado?" },
  { field: "parq6", question: "Médico recomendou medicamento para pressão/coração?" },
  { field: "parq7", question: "Conhece outra razão que impeça atividade física?" },
]

export function AnamneseBasicSection({
  formData,
  expandedSections,
  onToggleSection,
  onUpdateField,
}: AnamneseSectionProps) {
  return (
    <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
      <SectionHeader
        title="Informações Básicas"
        section="basic"
        expanded={expandedSections.basic}
        icon={<ClipboardList className="size-5 text-orange-500" />}
        onToggleSection={onToggleSection}
      />
      {expandedSections.basic && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="Altura (m)" value={formData.altura} placeholder="1.70" onChange={(value) => onUpdateField("altura", value)} type="number" step="0.01" />
            <TextInput label="Peso (kg)" value={formData.pesoAtual} placeholder="70.0" onChange={(value) => onUpdateField("pesoAtual", value)} type="number" step="0.1" />
          </div>
          <SelectField
            label="Objetivo"
            value={formData.objetivo}
            placeholder="Selecione seu objetivo"
            onChange={(value) => onUpdateField("objetivo", value)}
            options={["Hipertrofia", "Emagrecimento", "Condicionamento", "Saúde", "Reabilitação", "Outro"]}
          />
          <YesNoField label="Pratica alguma atividade física regularmente?" value={formData.praticaAtividade} onChange={(value) => onUpdateField("praticaAtividade", value)} />
          {formData.praticaAtividade === "Sim" && (
            <TextInput label="Qual atividade?" value={formData.praticaAtividadeQual} onChange={(value) => onUpdateField("praticaAtividadeQual", value)} />
          )}
          {formData.praticaAtividade === "Não" && (
            <TextInput label="Há quanto tempo está sem atividade física?" value={formData.tempoSedentario} onChange={(value) => onUpdateField("tempoSedentario", value)} />
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function AnamneseMedicalSection({
  formData,
  expandedSections,
  isWoman,
  onToggleSection,
  onUpdateField,
}: AnamneseSectionProps) {
  return (
    <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
      <SectionHeader
        title="Histórico Médico"
        section="medical"
        expanded={expandedSections.medical}
        icon={<Heart className="size-5 text-orange-500" />}
        onToggleSection={onToggleSection}
      />
      {expandedSections.medical && (
        <CardContent className="space-y-4">
          <YesNoField label="Possui alguma condição médica?" value={formData.condicaoMedica} onChange={(value) => onUpdateField("condicaoMedica", value)} />
          {formData.condicaoMedica === "Sim" && <TextInput label="Qual?" value={formData.condicaoMedicaQual} onChange={(value) => onUpdateField("condicaoMedicaQual", value)} />}
          <YesNoField label="Teve ou tem alguma lesão?" value={formData.lesao} onChange={(value) => onUpdateField("lesao", value)} />
          {formData.lesao === "Sim" && <TextInput label="Qual?" value={formData.lesaoQual} onChange={(value) => onUpdateField("lesaoQual", value)} />}
          <YesNoField label="Toma algum medicamento controlado?" value={formData.medicamentoControlado} onChange={(value) => onUpdateField("medicamentoControlado", value)} />
          {formData.medicamentoControlado === "Sim" && <TextInput label="Qual?" value={formData.medicamentoControladoQual} onChange={(value) => onUpdateField("medicamentoControladoQual", value)} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <YesNoField label="Colesterol elevado" value={formData.colesterolElevado} onChange={(value) => onUpdateField("colesterolElevado", value)} />
            <YesNoField label="Diabetes" value={formData.diabetes} onChange={(value) => onUpdateField("diabetes", value)} />
            <YesNoField label="Doenças cardíacas" value={formData.doencasCardiacas} onChange={(value) => onUpdateField("doencasCardiacas", value)} />
            <YesNoField label="Taquicardia" value={formData.taquicardia} onChange={(value) => onUpdateField("taquicardia", value)} />
          </div>
          {isWoman && (
            <div className="space-y-2 p-4 bg-pink-50 dark:bg-pink-950/30 rounded-lg">
              <Label>Ciclo menstrual e desconfortos</Label>
              <Textarea
                placeholder="Seu ciclo é de quantos dias? Sente desconforto em algum período?"
                value={formData.cicloMenstrual || ""}
                onChange={(event) => onUpdateField("cicloMenstrual", event.target.value)}
                className="min-h-[80px] border-orange-500/20"
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function AnamneseParqSection({
  formData,
  expandedSections,
  onToggleSection,
  onUpdateField,
}: AnamneseSectionProps) {
  return (
    <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
      <SectionHeader
        title="PAR-Q"
        description="Prontidão para Atividade Física"
        section="parq"
        expanded={expandedSections.parq}
        icon={<Heart className="size-5 text-red-500" />}
        onToggleSection={onToggleSection}
      />
      {expandedSections.parq && (
        <CardContent className="space-y-4">
          {parqQuestions.map(({ field, question }, index) => (
            <YesNoField
              key={field}
              label={`${index + 1}. ${question}`}
              value={formData[field]}
              onChange={(value) => onUpdateField(field, value)}
            />
          ))}
        </CardContent>
      )}
    </Card>
  )
}

export function AnamneseExperienceSection({
  formData,
  expandedSections,
  onToggleSection,
  onUpdateField,
}: AnamneseSectionProps) {
  return (
    <Card className="border-orange-500/20 backdrop-blur-sm bg-card/95">
      <SectionHeader
        title="Experiência"
        section="experience"
        expanded={expandedSections.experience}
        icon={<ClipboardList className="size-5 text-orange-500" />}
        onToggleSection={onToggleSection}
      />
      {expandedSections.experience && (
        <CardContent className="space-y-4">
          <TextAreaField label="Experiência com musculação" value={formData.experienciaMusculacao} placeholder="Iniciante, intermediário ou avançado?" onChange={(value) => onUpdateField("experienciaMusculacao", value)} />
          <TextInput label="Como conheceu o Gabi Studio?" value={formData.ondeConheceu} onChange={(value) => onUpdateField("ondeConheceu", value)} />
          <TextAreaField label="O que espera do nosso trabalho?" value={formData.expectativas} onChange={(value) => onUpdateField("expectativas", value)} />
        </CardContent>
      )}
    </Card>
  )
}

function SectionHeader({
  title,
  description,
  section,
  expanded,
  icon,
  onToggleSection,
}: {
  title: string
  description?: string
  section: AnamneseSectionKey
  expanded: boolean
  icon: ReactNode
  onToggleSection: (section: AnamneseSectionKey) => void
}) {
  return (
    <CardHeader className="cursor-pointer" onClick={() => onToggleSection(section)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
          </div>
        </div>
        {expanded ? <ChevronUp className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
      </div>
    </CardHeader>
  )
}

function TextInput({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  step,
}: {
  label: string
  value?: string
  placeholder?: string
  onChange: (value: string) => void
  type?: string
  step?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        step={step}
        placeholder={placeholder}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 border-orange-500/20"
      />
    </div>
  )
}

function TextAreaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value?: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        placeholder={placeholder}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[80px] border-orange-500/20"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string
  value?: string
  placeholder: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="h-12 border-orange-500/20">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="h-12 border-orange-500/20">
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        {yesNoItems}
      </Select>
    </div>
  )
}
