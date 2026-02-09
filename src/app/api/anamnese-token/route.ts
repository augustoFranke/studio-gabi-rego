import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enviarEmail, emailTemplates, isResendConfigured } from "@/lib/resend"
import { sanitizeAnamnesePayload } from "@/lib/anamnese"

const TOKEN_EXPIRY_ERROR = "Link inválido ou expirado. Solicite um novo link."
const TOKEN_COOKIE_NAME = "anamnese_token"
const isProduction = process.env.NODE_ENV === "production"

// Module-level Set for O(1) lookups instead of O(n) array.includes()
const FEMALE_NAMES = new Set([
  "maria", "ana", "julia", "gabriela", "fernanda", "amanda", "bruna", "camila", "carla", "claudia", "cristina",
  "daniela", "elaine", "fabiana", "juliana", "larissa", "leticia", "luciana", "marcia", "patricia", "priscila",
  "renata", "sandra", "tatiana", "vanessa", "adriana", "aline", "beatriz", "bianca", "carolina", "debora",
  "denise", "eduarda", "eliana", "elisabete", "flavia", "franciele", "gisele", "helena", "isabela", "jessica",
  "joana", "jussara", "karen", "karina", "lais", "lilian", "livia", "luana", "lucia", "luciane", "luiza",
  "mara", "marcela", "mariana", "marina", "marta", "michele", "milena", "monica", "natalia", "paula",
  "rafaela", "raquel", "regina", "roberta", "rosana", "sabrina", "samantha", "simone", "solange", "sonia",
  "suzana", "tais", "thais", "vera", "vivian", "viviane",
])

const FEMALE_ENDINGS = ["a", "e", "ia", "ana", "ine", "ene"]

function determineSexoEnum(nome?: string | null): "FEMININO" | "MASCULINO" {
  const normalized = nome?.toLowerCase().trim()

  if (!normalized) {
    return "MASCULINO"
  }

  const firstName = normalized.split(" ")[0]

  if (FEMALE_NAMES.has(firstName)) {
    return "FEMININO"
  }

  for (const ending of FEMALE_ENDINGS) {
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

function getTokenFromRequest(request: NextRequest) {
  const tokenFromHeader = request.headers.get("x-anamnese-token")?.trim() || null
  const tokenFromQuery = request.nextUrl.searchParams.get("token")
  const tokenFromCookie = request.cookies.get(TOKEN_COOKIE_NAME)?.value || null

  if (tokenFromHeader) {
    return { token: tokenFromHeader, source: "header" as const }
  }
  if (tokenFromQuery) {
    return { token: tokenFromQuery, source: "query" as const }
  }
  if (tokenFromCookie) {
    return { token: tokenFromCookie, source: "cookie" as const }
  }
  return { token: null, source: null }
}

function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/anamnese",
    maxAge: 60 * 60,
  })
}

function clearTokenCookie(response: NextResponse) {
  response.cookies.set(TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/anamnese",
    maxAge: 0,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { token, source } = getTokenFromRequest(request)

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
    }

    const membro = await findMemberByToken(token)

    if (!membro) {
      const response = NextResponse.json({ error: TOKEN_EXPIRY_ERROR }, { status: 404 })
      if (source === "cookie") {
        clearTokenCookie(response)
      }
      return response
    }

    const sexo = membro.sexo ?? determineSexoEnum(membro.usuario.nome)

    const response = NextResponse.json({
      sexo,
      anamnese: membro.anamnese || null,
    })

    if (source && source !== "cookie") {
      setTokenCookie(response, token)
    }

    return response
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
    const { token, source } = getTokenFromRequest(request)

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 })
    }

    const membro = await findMemberByToken(token)

    if (!membro) {
      const response = NextResponse.json({ error: TOKEN_EXPIRY_ERROR }, { status: 404 })
      if (source === "cookie") {
        clearTokenCookie(response)
      }
      return response
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Dados inválidos enviados" }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: "Dados inválidos enviados" }, { status: 400 })
    }

    const sanitized = sanitizeAnamnesePayload(body as Record<string, unknown>)
    if ('error' in sanitized || Object.keys(sanitized.data).length === 0) {
      return NextResponse.json({ error: "Dados inválidos enviados" }, { status: 400 })
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
        where: { id: membro.usuarioId },
        data: {
          etapaOnboarding: 4,
          onboardingCompleto: true,
        },
      }),
      prisma.membro.update({
        where: { id: membro.id },
        data: {
          anamneseToken: null,
          anamneseTokenExpira: null,
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

    const response = NextResponse.json({
      success: true,
      message: "Anamnese salva com sucesso!",
    })

    clearTokenCookie(response)

    return response
  } catch (error) {
    console.error("Erro ao salvar anamnese por token:", error)
    return NextResponse.json(
      { error: "Erro interno ao salvar anamnese" },
      { status: 500 }
    )
  }
}
