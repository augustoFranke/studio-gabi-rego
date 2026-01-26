import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiAuth } from "@/lib/api"

const ANAMNESE_FIELDS = [
  "altura",
  "pesoAtual",
  "objetivo",
  "praticaAtividade",
  "praticaAtividadeQual",
  "tempoSedentario",
  "condicaoMedica",
  "condicaoMedicaQual",
  "lesao",
  "lesaoQual",
  "restricaoMovimento",
  "restricaoMovimentoQual",
  "desconfortoMovimento",
  "desconfortoMovimentoQual",
  "problemasOrtopedicos",
  "problemasOrtopedicosQual",
  "medicamentoControlado",
  "medicamentoControladoQual",
  "obesoSobrepeso",
  "colesterolElevado",
  "taquicardia",
  "doencasCardiacas",
  "diabetes",
  "dificuldadeExercicio",
  "cicloMenstrual",
  "experienciaMusculacao",
  "ondeConheceu",
  "expectativas",
  "parq1",
  "parq2",
  "parq3",
  "parq4",
  "parq5",
  "parq6",
  "parq7",
] as const

type AnamneseField = (typeof ANAMNESE_FIELDS)[number]

function buildAnamneseData(body: Record<string, unknown>) {
  const data = {} as Record<AnamneseField, string | null>
  for (const field of ANAMNESE_FIELDS) {
    const value = body[field]
    data[field] = typeof value === "string" && value.trim() !== "" ? value : null
  }
  return data
}

// GET - Fetch member's anamnesis
export async function GET() {
  return withApiAuth(async (session) => {
    try {
      const membro = await prisma.membro.findUnique({
        where: { usuarioId: session.user.id },
        include: { anamnese: true },
      })

      if (!membro) {
        return NextResponse.json(
          { error: "Perfil não encontrado. Complete seu perfil primeiro." },
          { status: 404 }
        )
      }

      return NextResponse.json({
        sexo: membro.sexo,
        anamnese: membro.anamnese || null,
      })
    } catch (error) {
      console.error("Erro ao buscar anamnese:", error)
      return NextResponse.json(
        { error: "Erro interno ao buscar anamnese" },
        { status: 500 }
      )
    }
  })
}

// POST - Save member's anamnesis
export async function POST(request: Request) {
  return withApiAuth(async (session) => {
    try {
      const body = await request.json()
      const membro = await prisma.membro.findUnique({
        where: { usuarioId: session.user.id },
      })

      if (!membro) {
        return NextResponse.json(
          { error: "Perfil não encontrado. Complete seu perfil primeiro." },
          { status: 404 }
        )
      }

      const anamneseData = buildAnamneseData(body)

      await prisma.anamnese.upsert({
        where: { membroId: membro.id },
        create: {
          membroId: membro.id,
          ...anamneseData,
        },
        update: anamneseData,
      })

      await prisma.usuario.update({
        where: { id: session.user.id },
        data: {
          etapaOnboarding: 4,
          onboardingCompleto: true,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Anamnese salva com sucesso!",
      })
    } catch (error) {
      console.error("Erro ao salvar anamnese:", error)
      return NextResponse.json(
        { error: "Erro interno ao salvar anamnese" },
        { status: 500 }
      )
    }
  })
}
