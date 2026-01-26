import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { validarCPF } from "@/lib/validators"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, nome, cpf, rg, telefone, dataNascimento, sexo } = body

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

    // Validate required fields
    if (!nome || nome.length < 3) {
      return NextResponse.json(
        { error: "Nome deve ter pelo menos 3 caracteres" },
        { status: 400 }
      )
    }

    if (!cpf || !validarCPF(cpf)) {
      return NextResponse.json(
        { error: "CPF inválido" },
        { status: 400 }
      )
    }

    if (!telefone || telefone.length < 10) {
      return NextResponse.json(
        { error: "Telefone inválido" },
        { status: 400 }
      )
    }

    if (!dataNascimento) {
      return NextResponse.json(
        { error: "Data de nascimento é obrigatória" },
        { status: 400 }
      )
    }

    if (!sexo || !["MASCULINO", "FEMININO"].includes(sexo)) {
      return NextResponse.json(
        { error: "Sexo é obrigatório" },
        { status: 400 }
      )
    }

    // Check if CPF already exists
    const existingCpf = await prisma.membro.findUnique({
      where: { cpf },
    })

    if (existingCpf) {
      return NextResponse.json(
        { error: "Este CPF já está cadastrado" },
        { status: 400 }
      )
    }

    const isTokenFlow = Boolean(token)
    const anamneseToken = isTokenFlow ? randomBytes(32).toString("hex") : null
    const anamneseTokenExpiry = isTokenFlow ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null

    // Check if user already has a member profile
    const existingMembro = await prisma.membro.findUnique({
      where: { usuarioId: userId },
    })

    if (existingMembro) {
      // Update existing profile
      await prisma.membro.update({
        where: { usuarioId: userId },
        data: {
          cpf,
          rg: rg || null,
          telefone,
          dataNascimento: new Date(dataNascimento),
          sexo: sexo as "MASCULINO" | "FEMININO",
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
          cpf,
          rg: rg || null,
          telefone,
          dataNascimento: new Date(dataNascimento),
          sexo: sexo as "MASCULINO" | "FEMININO",
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

    return NextResponse.json({
      success: true,
      message: "Perfil salvo com sucesso!",
      ...(isTokenFlow ? { anamneseToken } : {}),
    })
  } catch (error) {
    console.error("Erro ao salvar perfil:", error)
    return NextResponse.json(
      { error: "Erro interno ao salvar perfil" },
      { status: 500 }
    )
  }
}
