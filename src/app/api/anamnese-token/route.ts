import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"

const TOKEN_EXPIRY_ERROR = "Link inválido ou expirado. Solicite um novo link."

function determineSexoEnum(nome?: string | null): "FEMININO" | "MASCULINO" {
  const normalized = nome?.toLowerCase().trim()

  if (!normalized) {
    return "MASCULINO"
  }

  const femaleEndings = ["a", "e", "ia", "ana", "ine", "ene"]
  const femaleNames = [
    "maria", "ana", "julia", "gabriela", "fernanda", "amanda", "bruna", "camila", "carla", "claudia", "cristina",
    "daniela", "elaine", "fabiana", "juliana", "larissa", "leticia", "luciana", "marcia", "patricia", "priscila",
    "renata", "sandra", "tatiana", "vanessa", "adriana", "aline", "beatriz", "bianca", "carolina", "debora",
    "denise", "eduarda", "eliana", "elisabete", "flavia", "franciele", "gisele", "helena", "isabela", "jessica",
    "joana", "jussara", "karen", "karina", "lais", "lilian", "livia", "luana", "lucia", "luciane", "luiza",
    "mara", "marcela", "mariana", "marina", "marta", "michele", "milena", "monica", "natalia", "paula",
    "rafaela", "raquel", "regina", "roberta", "rosana", "sabrina", "samantha", "simone", "solange", "sonia",
    "suzana", "tais", "thais", "vera", "vivian", "viviane",
  ]

  const firstName = normalized.split(" ")[0]

  if (femaleNames.includes(firstName)) {
    return "FEMININO"
  }

  for (const ending of femaleEndings) {
    if (firstName.endsWith(ending) && !firstName.endsWith("o")) {
      return "FEMININO"
    }
  }

  return "MASCULINO"
}

async function findMemberByToken(token: string) {
  return prisma.membro.findFirst({
    where: {
      anamneseToken: token,
      anamneseTokenExpira: { gt: new Date() },
    },
    include: {
      usuario: { select: { nome: true, email: true, onboardingCompleto: true } },
      anamnese: true,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
    }

    const membro = await findMemberByToken(token)

    if (!membro) {
      return NextResponse.json({ error: TOKEN_EXPIRY_ERROR }, { status: 404 })
    }

    const sexo = membro.sexo ?? determineSexoEnum(membro.usuario.nome)

    return NextResponse.json({
      sexo,
      anamnese: membro.anamnese || null,
    })
  } catch (error) {
    console.error("Erro ao buscar anamnese por token:", error)
    return NextResponse.json(
      { error: "Erro interno ao buscar anamnese" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
    }

    const membro = await findMemberByToken(token)

    if (!membro) {
      return NextResponse.json({ error: TOKEN_EXPIRY_ERROR }, { status: 404 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Dados inválidos enviados" }, { status: 400 })
    }

    const anamneseData = {
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
    }
    const shouldSendWelcome = !membro.usuario.onboardingCompleto

    await prisma.anamnese.upsert({
      where: { membroId: membro.id },
      create: {
        membroId: membro.id,
        ...anamneseData,
      },
      update: anamneseData,
    })

    await prisma.usuario.update({
      where: { id: membro.usuarioId },
      data: {
        etapaOnboarding: 4,
        onboardingCompleto: true,
      },
    })

    if (shouldSendWelcome && membro.usuario.email) {
      if (isResendConfigured()) {
        const emailResult = await enviarEmail({
          para: membro.usuario.email,
          assunto: "Bem-vindo(a) ao Studio Gabi Rego",
          html: emailTemplates.boasVindas(membro.usuario.nome || "Aluno(a)"),
        })

        if (!emailResult.success) {
          console.error("Failed to send welcome email:", emailResult.error)
        }
      } else {
        console.warn("Resend not configured - skipping welcome email send")
      }
    }

    return NextResponse.json({
      success: true,
      message: "Anamnese salva com sucesso!",
    })
  } catch (error) {
    console.error("Erro ao salvar anamnese por token:", error)
    return NextResponse.json(
      { error: "Erro interno ao salvar anamnese" },
      { status: 500 }
    )
  }
}
