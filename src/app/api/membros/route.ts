import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth, validateRequest } from '@/lib/api'
import { hash } from 'bcryptjs'
import { validarCPF, validarEmail } from '@/lib/validators'
import { Prisma, StatusMembro } from '@prisma/client'
import { membroCreateSchema } from '@/schemas/membro.schema'
import { normalizeEmailForStorage } from '@/lib/email'

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
    const validation = await validateRequest(request, membroCreateSchema, {
      invalidJsonMessage: "Dados inválidos enviados. Verifique o formulário.",
      errorMessage: (error) => {
        const issue = error.issues[0]
        const path = issue.path.join('.')
        return `Erro no campo '${path}': ${issue.message}`
      },
    })

    if ('error' in validation) {
      return validation.error
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

    const normalizedEmail = normalizeEmailForStorage(email)

    // Validate email if provided
    if (normalizedEmail && !validarEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'O email informado é inválido.' }, { status: 400 })
    }

    // Validate CPF if provided
    if (cpf && !validarCPF(cpf)) {
      return NextResponse.json({ error: 'O CPF informado é inválido.' }, { status: 400 })
    }

    // Prepare CPF for validation
    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : null

    // Run all existence checks in parallel for better performance
    const [emailExiste, cpfExiste, plano] = await Promise.all([
      normalizedEmail
        ? prisma.usuario.findUnique({ where: { email: normalizedEmail } })
        : null,
      cpfLimpo
        ? prisma.membro.findUnique({ where: { cpf: cpfLimpo } })
        : null,
      horariosFixos?.length && planoId
        ? prisma.plano.findUnique({ where: { id: planoId }, select: { aulasSemanais: true } })
        : null,
    ])

    // Check email uniqueness
    if (normalizedEmail && emailExiste) {
      return NextResponse.json({ error: 'Este email já está cadastrado no sistema.' }, { status: 400 })
    }

    // Check CPF uniqueness
    if (cpfLimpo && cpfExiste) {
      return NextResponse.json({ error: 'Este CPF já está cadastrado para outro membro.' }, { status: 400 })
    }

    // Validate horarios fixos against plan limit
    if (horariosFixos?.length && planoId && plano && plano.aulasSemanais !== 7) {
      const uniqueSlots = new Set(
        horariosFixos.map((horario) => `${horario.diaSemana}-${horario.hora}`)
      )
      const totalSlots = uniqueSlots.size

      if (totalSlots > plano.aulasSemanais) {
        return NextResponse.json(
          {
            error: `Limite do plano: ${plano.aulasSemanais} aulas por semana. Foram informados ${totalSlots} horários fixos.`,
          },
          { status: 400 }
        )
      }
    }

    // Create password hash if provided, otherwise generate a random one
    const senhaHash = senhaDefinida ? await hash(senhaValue, 12) : await hash(Math.random().toString(36), 12)

    const membro = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: nome || 'Sem nome',
          email: normalizedEmail,
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
