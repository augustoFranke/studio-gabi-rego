import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { withApiAuth, validateRequest } from "@/lib/api"
import { normalizeMemberProfileInput } from "@/lib/member-profile"
import { validarCPF } from "@/lib/validators"
import { z } from "zod"
import {
  completePerfilFromToken,
  getPerfilByUsuarioId,
  updatePerfilForUser,
  savePerfilForUser,
} from "@/services/perfil.service"

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
    const membro = await getPerfilByUsuarioId(session.user.id)

    if (!membro) {
      return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 })
    }

    return NextResponse.json(membro)
  })
}

export async function PUT(request: NextRequest) {
  return withApiAuth(async (session) => {
    const validation = await validateRequest(request, perfilUpdateSchema)
    if ("error" in validation) {
      return validation.error
    }

    const { nome, telefone, dataNascimento, sexo } = validation.data
    const normalizedProfile = normalizeMemberProfileInput({
      telefone,
      dataNascimento,
      sexo,
    })

    if (normalizedProfile.telefoneIsInvalid) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 })
    }

    if (normalizedProfile.dataNascimentoIsInvalid) {
      return NextResponse.json(
        { error: "Data de nascimento inválida" },
        { status: 400 }
      )
    }

    const result = await updatePerfilForUser({
      userId: session.user.id,
      nome,
      telefone,
      dataNascimento,
      sexo: normalizedProfile.sexo,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

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
    const hasCpf = cpf !== undefined
    const hasRg = rg !== undefined
    const hasTelefone = telefone !== undefined
    const hasDataNascimento = dataNascimento !== undefined
    const hasSexo = sexo !== undefined

    const normalizedProfile = normalizeMemberProfileInput({
      cpf,
      rg,
      telefone,
      dataNascimento,
      sexo,
    })

    if (normalizedProfile.cpf && !validarCPF(normalizedProfile.cpf)) {
      return NextResponse.json({ error: "CPF inválido" }, { status: 400 })
    }

    if (normalizedProfile.telefoneIsInvalid) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 })
    }

    if (normalizedProfile.dataNascimentoIsInvalid) {
      return NextResponse.json(
        { error: "Data de nascimento inválida" },
        { status: 400 }
      )
    }

    let result

    if (token) {
      result = await completePerfilFromToken({
        token,
        nome,
        cpf: normalizedProfile.cpf,
        rg: normalizedProfile.rg ?? null,
        telefone: normalizedProfile.telefone,
        dataNascimento: normalizedProfile.dataNascimento?.toISOString() ?? null,
        sexo: normalizedProfile.sexo,
        hasCpf,
        hasRg,
        hasTelefone,
        hasDataNascimento,
        hasSexo,
      })
    } else {
      // Check for session (logged-in flow)
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Não autorizado" },
          { status: 401 }
        )
      }
      result = await savePerfilForUser({
        userId: session.user.id,
        nome,
        cpf: normalizedProfile.cpf,
        rg: normalizedProfile.rg ?? null,
        telefone: normalizedProfile.telefone,
        dataNascimento: normalizedProfile.dataNascimento?.toISOString() ?? null,
        sexo: normalizedProfile.sexo,
        hasCpf,
        hasRg,
        hasTelefone,
        hasDataNascimento,
        hasSexo,
      })
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const response = NextResponse.json({
      success: true,
      message: "Perfil salvo com sucesso!",
      anamneseToken: result.anamneseToken,
    })

    if (result.anamneseToken) {
      response.cookies.set("anamnese_token", result.anamneseToken, {
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
