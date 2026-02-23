import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { withApiAuth } from "@/lib/api"
import { sanitizeAnamnesePayload } from "@/lib/anamnese"

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
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return NextResponse.json(
          { error: "Dados inválidos enviados" },
          { status: 400 }
        )
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json(
          { error: "Dados inválidos enviados" },
          { status: 400 }
        )
      }

      const membro = await prisma.membro.findUnique({
        where: { usuarioId: session.user.id },
        include: {
          usuario: {
            select: {
              email: true,
              nome: true,
              onboardingCompleto: true,
            },
          },
        },
      })

      if (!membro) {
        return NextResponse.json(
          { error: "Perfil não encontrado. Complete seu perfil primeiro." },
          { status: 404 }
        )
      }

      const sanitized = sanitizeAnamnesePayload(body as Record<string, unknown>, {
        ignoreUnknownFields: true,
        fillMissingFields: true,
      })
      if ("error" in sanitized) {
        return NextResponse.json(
          { error: "Dados inválidos enviados" },
          { status: 400 }
        )
      }
      if (sanitized.ignoredKeys.length > 0) {
        console.warn(
          "[anamnese_sanitize] Campos ignorados em minha-anamnese:",
          sanitized.ignoredKeys
        )
      }

      const anamneseData = sanitized.data
      const shouldSendWelcome = !membro.usuario.onboardingCompleto

      // Parallelize database operations
      await Promise.all([
        prisma.anamnese.upsert({
          where: { membroId: membro.id },
          create: {
            membroId: membro.id,
            ...anamneseData,
          },
          update: anamneseData,
        }),
        prisma.usuario.update({
          where: { id: session.user.id },
          data: {
            etapaOnboarding: 4,
            onboardingCompleto: true,
          },
        }),
      ])

      // Fire-and-forget email sending (non-blocking)
      if (shouldSendWelcome && membro.usuario.email && isResendConfigured()) {
        enviarEmail({
          para: membro.usuario.email,
          assunto: "Bem-vindo(a) ao Studio Gabi Rego",
          html: emailTemplates.boasVindas(membro.usuario.nome || "Aluno(a)"),
        }).catch((err) => console.error("Failed to send welcome email:", err))
      }

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
