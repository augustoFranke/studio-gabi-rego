import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { hash } from 'bcryptjs'
import { validarCPF, validarEmail } from '@/lib/validators'
import { Prisma, StatusMembro } from '@prisma/client'
import { membroCreateSchema } from '@/schemas/membro.schema'

// GET /api/membros - Listar todos os membros
export async function GET(request: NextRequest) {
  return withApiAuth(async () => {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const fields = searchParams.get('fields')

    const where: Prisma.MembroWhereInput = {}
    if (status && status !== 'todos') {
      where.status = status as StatusMembro
    }

    const compactSelect = {
      id: true,
      usuarioId: true,
      cpf: true,
      telefone: true,
      status: true,
      fotoUrl: true,
      usuario: {
        select: {
          nome: true,
          email: true,
        },
      },
    } satisfies Prisma.MembroSelect

    const membros = fields === 'compact'
      ? await prisma.membro.findMany({
          where,
          select: compactSelect,
          orderBy: { criadoEm: 'desc' },
        })
      : await prisma.membro.findMany({
          where,
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                email: true,
              },
            },
            plano: true,
          },
          orderBy: { criadoEm: 'desc' },
        })

    return NextResponse.json(membros)
  }, { requiredRole: 'ADMIN' })
}

// POST /api/membros - Criar novo membro
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    let body;
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Dados inválidos enviados. Verifique o formulário." }, { status: 400 })
    }

    const validation = membroCreateSchema.safeParse(body)

    if (!validation.success) {
      const errorMessage = validation.error.issues[0].message;
      const path = validation.error.issues[0].path.join('.');
      return NextResponse.json(
        { error: `Erro no campo '${path}': ${errorMessage}` },
        { status: 400 }
      )
    }

    const {
      nome,
      email,
      senha,
      cpf,
      rg,
      telefone,
      dataNascimento,
      planoId,
      precoCustomizado,
      sexo,
      horariosFixos,
    } = validation.data
    const senhaValue = typeof senha === "string" ? senha.trim() : ""
    const senhaDefinida = Boolean(senhaValue)

    // Normalize email to lowercase
    const normalizedEmail = email ? email.toLowerCase().trim() : null

    // Validate email if provided
    if (normalizedEmail && !validarEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'O email informado é inválido.' }, { status: 400 })
    }

    // Validate CPF if provided
    if (cpf && !validarCPF(cpf)) {
      return NextResponse.json({ error: 'O CPF informado é inválido.' }, { status: 400 })
    }

    // Check if email already exists (only if provided)
    if (normalizedEmail) {
      const emailExiste = await prisma.usuario.findUnique({ where: { email: normalizedEmail } })
      if (emailExiste) {
        return NextResponse.json({ error: 'Este email já está cadastrado no sistema.' }, { status: 400 })
      }
    }

    // Check if CPF already exists (only if provided)
    let cpfLimpo: string | null = null
    if (cpf) {
      cpfLimpo = cpf.replace(/\D/g, '')
      const cpfExiste = await prisma.membro.findUnique({ where: { cpf: cpfLimpo } })
      if (cpfExiste) {
        return NextResponse.json({ error: 'Este CPF já está cadastrado para outro membro.' }, { status: 400 })
      }
    }

    // Create password hash if provided, otherwise generate a random one
    const senhaHash = senhaDefinida ? await hash(senhaValue, 12) : await hash(Math.random().toString(36), 12)

    const membro = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: nome || 'Sem nome',
          email: normalizedEmail || `temp_${Date.now()}@placeholder.local`,
          senha: senhaHash,
          senhaDefinida,
          role: 'MEMBRO',
          // Skip onboarding for admin-created users
          onboardingCompleto: true,
          etapaOnboarding: 4,
        },
      })

      return tx.membro.create({
        data: {
          usuarioId: usuario.id,
          cpf: cpfLimpo,
          rg,
          telefone: telefone ? telefone.replace(/\D/g, '') : null,
          dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
          planoId,
          precoCustomizado,
          sexo,
          status: 'ATIVO',
          horariosFixos: horariosFixos?.length
            ? {
                create: horariosFixos.map((horario) => ({
                  diaSemana: horario.diaSemana,
                  hora: horario.hora,
                })),
              }
            : undefined,
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
            },
          },
          plano: true,
        },
      })
    })

    return NextResponse.json(membro, { status: 201 })
  }, { requiredRole: 'ADMIN' })
}
