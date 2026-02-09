import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { withApiAuth, validateRequest } from "@/lib/api"
import { validarCPF } from "@/lib/validators"
import { z } from "zod"

const isProduction = process.env.NODE_ENV === "production"

const perfilSchema = z.object({
  token: z.string().optional().nullable(),
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().optional().nullable().or(z.literal("")),
  rg: z.string().optional().nullable().or(z.literal("")),
  telefone: z.string().optional().nullable().or(z.literal("")),
  dataNascimento: z.string().optional().nullable().or(z.literal("")),
  sexo: z.enum(["MASCULINO", "FEMININO"]).optional().or(z.literal("")),
})

const perfilUpdateSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  telefone: z.string().optional().nullable().or(z.literal("")),
  dataNascimento: z.string().optional().nullable().or(z.literal("")),
  sexo: z.enum(["MASCULINO", "FEMININO"]).optional().nullable().or(z.literal("")),
})

export async function GET() {
  return withApiAuth(async (session) => {
    const membro = await prisma.membro.findUnique({
      where: { usuarioId: session.user.id },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    })

    if (!membro) {
      return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      id: membro.id,
      nome: membro.usuario.nome || "",
      email: membro.usuario.email,
      cpf: membro.cpf,
      rg: membro.rg,
      telefone: membro.telefone,
      dataNascimento: membro.dataNascimento,
      sexo: membro.sexo,
    })
  })
}

export async function PUT(request: NextRequest) {
  return withApiAuth(async (session) => {
    const validation = await validateRequest(request, perfilUpdateSchema)
    if ("error" in validation) {
      return validation.error
    }

    const { nome, telefone, dataNascimento, sexo } = validation.data
    const normalizedTelefone = telefone ? telefone.replace(/\D/g, "") : null
    const normalizedDataNascimento =
      dataNascimento && dataNascimento.trim() !== "" ? new Date(dataNascimento) : null
    const normalizedSexo: "MASCULINO" | "FEMININO" | null =
      sexo === "" ? null : (sexo ?? null)

    if (normalizedTelefone && normalizedTelefone.length < 10) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 })
    }

    if (
      normalizedDataNascimento &&
      Number.isNaN(normalizedDataNascimento.getTime())
    ) {
      return NextResponse.json(
        { error: "Data de nascimento inválida" },
        { status: 400 }
      )
    }

    const membro = await prisma.membro.findUnique({
      where: { usuarioId: session.user.id },
      select: { id: true },
    })

    if (!membro) {
      return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: session.user.id },
        data: { nome },
      }),
      prisma.membro.update({
        where: { id: membro.id },
        data: {
          telefone: normalizedTelefone,
          dataNascimento: normalizedDataNascimento,
          sexo: normalizedSexo,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = perfilSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { token, nome, cpf, rg, telefone, dataNascimento, sexo } = validation.data

    let userId: string | null = null

    // Check for profile completion token (onboarding flow)
    if (token) {
      const usuario = await prisma.usuario.findUnique({
        where: { tokenReset: token },
      })

      if (!usuario) {
        return NextResponse.json(
          { error: "Token inválido ou expirado" },
          { status: 401 }
        )
      }

      if (usuario.tokenResetExpira && usuario.tokenResetExpira < new Date()) {
        return NextResponse.json(
          { error: "Token expirado. Faça login novamente." },
          { status: 401 }
        )
      }

      userId = usuario.id
    } else {
      // Check for session (logged-in flow)
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Não autorizado" },
          { status: 401 }
        )
      }
      userId = session.user.id
    }

    const hasCpf = cpf !== undefined
    const hasRg = rg !== undefined
    const hasTelefone = telefone !== undefined
    const hasDataNascimento = dataNascimento !== undefined
    const hasSexo = sexo !== undefined

    const normalizedCpf = cpf ? cpf.replace(/\D/g, "") : null
    const normalizedTelefone = telefone ? telefone.replace(/\D/g, "") : null
    const normalizedRg = rg && rg.trim() !== "" ? rg : null
    const normalizedSexo = sexo ? sexo : null
    const normalizedDataNascimento =
      dataNascimento && dataNascimento.trim() !== "" ? new Date(dataNascimento) : null
    const isDataNascimentoInvalid =
      Boolean(dataNascimento) &&
      normalizedDataNascimento !== null &&
      Number.isNaN(normalizedDataNascimento.getTime())

    if (normalizedCpf && !validarCPF(normalizedCpf)) {
      return NextResponse.json({ error: "CPF inválido" }, { status: 400 })
    }

    if (normalizedTelefone && normalizedTelefone.length < 10) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 })
    }

    if (isDataNascimentoInvalid) {
      return NextResponse.json(
        { error: "Data de nascimento inválida" },
        { status: 400 }
      )
    }

    const isTokenFlow = Boolean(token)
    const anamneseToken = isTokenFlow ? randomBytes(32).toString("hex") : null
    const anamneseTokenExpiry = isTokenFlow ? new Date(Date.now() + 60 * 60 * 1000) : null

    // Parallelize CPF check and member profile lookup
    const [existingCpf, existingMembro] = await Promise.all([
      normalizedCpf
        ? prisma.membro.findUnique({ where: { cpf: normalizedCpf } })
        : Promise.resolve(null),
      prisma.membro.findUnique({ where: { usuarioId: userId } }),
    ])

    if (existingCpf && existingCpf.usuarioId !== userId) {
      return NextResponse.json(
        { error: "Este CPF já está cadastrado" },
        { status: 400 }
      )
    }

    if (existingMembro) {
      // Update existing profile
      await prisma.membro.update({
        where: { usuarioId: userId },
        data: {
          ...(hasCpf ? { cpf: normalizedCpf } : {}),
          ...(hasRg ? { rg: normalizedRg } : {}),
          ...(hasTelefone ? { telefone: normalizedTelefone } : {}),
          ...(hasDataNascimento ? { dataNascimento: normalizedDataNascimento } : {}),
          ...(hasSexo ? { sexo: normalizedSexo as "MASCULINO" | "FEMININO" | null } : {}),
          ...(isTokenFlow
            ? {
                anamneseToken,
                anamneseTokenExpira: anamneseTokenExpiry,
              }
            : {}),
        },
      })
    } else {
      // Create new member profile
      await prisma.membro.create({
        data: {
          usuarioId: userId,
          cpf: normalizedCpf,
          rg: normalizedRg,
          telefone: normalizedTelefone,
          dataNascimento: normalizedDataNascimento,
          sexo: normalizedSexo as "MASCULINO" | "FEMININO" | null,
          status: "PENDENTE",
          ...(isTokenFlow
            ? {
                anamneseToken,
                anamneseTokenExpira: anamneseTokenExpiry,
              }
            : {}),
        },
      })
    }

    // Update user name and advance onboarding
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        nome,
        etapaOnboarding: 3, // Move to anamnesis step
        tokenReset: null, // Clear the profile token
        tokenResetExpira: null,
      },
    })

    const response = NextResponse.json({
      success: true,
      message: "Perfil salvo com sucesso!",
    })

    if (isTokenFlow && anamneseToken) {
      response.cookies.set("anamnese_token", anamneseToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/anamnese",
        maxAge: 60 * 60,
      })
    }

    return response
  } catch (error) {
    console.error("Erro ao salvar perfil:", error)
    return NextResponse.json(
      { error: "Erro interno ao salvar perfil" },
      { status: 500 }
    )
  }
}
