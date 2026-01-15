import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET - Fetch member's anamnesis
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      )
    }

    // Get the member record
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
}

// POST - Save member's anamnesis
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Get the member record
    const membro = await prisma.membro.findUnique({
      where: { usuarioId: session.user.id },
    })

    if (!membro) {
      return NextResponse.json(
        { error: "Perfil não encontrado. Complete seu perfil primeiro." },
        { status: 404 }
      )
    }

    // Upsert anamnesis
    await prisma.anamnese.upsert({
      where: { membroId: membro.id },
      create: {
        membroId: membro.id,
        altura: body.altura || null,
        pesoAtual: body.pesoAtual || null,
        objetivo: body.objetivo || null,
        praticaAtividade: body.praticaAtividade || null,
        praticaAtividadeQual: body.praticaAtividadeQual || null,
        tempoSedentario: body.tempoSedentario || null,
        condicaoMedica: body.condicaoMedica || null,
        condicaoMedicaQual: body.condicaoMedicaQual || null,
        lesao: body.lesao || null,
        lesaoQual: body.lesaoQual || null,
        restricaoMovimento: body.restricaoMovimento || null,
        restricaoMovimentoQual: body.restricaoMovimentoQual || null,
        desconfortoMovimento: body.desconfortoMovimento || null,
        desconfortoMovimentoQual: body.desconfortoMovimentoQual || null,
        problemasOrtopedicos: body.problemasOrtopedicos || null,
        problemasOrtopedicosQual: body.problemasOrtopedicosQual || null,
        medicamentoControlado: body.medicamentoControlado || null,
        medicamentoControladoQual: body.medicamentoControladoQual || null,
        obesoSobrepeso: body.obesoSobrepeso || null,
        colesterolElevado: body.colesterolElevado || null,
        taquicardia: body.taquicardia || null,
        doencasCardiacas: body.doencasCardiacas || null,
        diabetes: body.diabetes || null,
        dificuldadeExercicio: body.dificuldadeExercicio || null,
        cicloMenstrual: body.cicloMenstrual || null,
        experienciaMusculacao: body.experienciaMusculacao || null,
        ondeConheceu: body.ondeConheceu || null,
        expectativas: body.expectativas || null,
        parq1: body.parq1 || null,
        parq2: body.parq2 || null,
        parq3: body.parq3 || null,
        parq4: body.parq4 || null,
        parq5: body.parq5 || null,
        parq6: body.parq6 || null,
        parq7: body.parq7 || null,
      },
      update: {
        altura: body.altura || null,
        pesoAtual: body.pesoAtual || null,
        objetivo: body.objetivo || null,
        praticaAtividade: body.praticaAtividade || null,
        praticaAtividadeQual: body.praticaAtividadeQual || null,
        tempoSedentario: body.tempoSedentario || null,
        condicaoMedica: body.condicaoMedica || null,
        condicaoMedicaQual: body.condicaoMedicaQual || null,
        lesao: body.lesao || null,
        lesaoQual: body.lesaoQual || null,
        restricaoMovimento: body.restricaoMovimento || null,
        restricaoMovimentoQual: body.restricaoMovimentoQual || null,
        desconfortoMovimento: body.desconfortoMovimento || null,
        desconfortoMovimentoQual: body.desconfortoMovimentoQual || null,
        problemasOrtopedicos: body.problemasOrtopedicos || null,
        problemasOrtopedicosQual: body.problemasOrtopedicosQual || null,
        medicamentoControlado: body.medicamentoControlado || null,
        medicamentoControladoQual: body.medicamentoControladoQual || null,
        obesoSobrepeso: body.obesoSobrepeso || null,
        colesterolElevado: body.colesterolElevado || null,
        taquicardia: body.taquicardia || null,
        doencasCardiacas: body.doencasCardiacas || null,
        diabetes: body.diabetes || null,
        dificuldadeExercicio: body.dificuldadeExercicio || null,
        cicloMenstrual: body.cicloMenstrual || null,
        experienciaMusculacao: body.experienciaMusculacao || null,
        ondeConheceu: body.ondeConheceu || null,
        expectativas: body.expectativas || null,
        parq1: body.parq1 || null,
        parq2: body.parq2 || null,
        parq3: body.parq3 || null,
        parq4: body.parq4 || null,
        parq5: body.parq5 || null,
        parq6: body.parq6 || null,
        parq7: body.parq7 || null,
      },
    })

    // Mark onboarding as complete
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
}
