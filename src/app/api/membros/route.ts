import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { hash } from 'bcryptjs'
import { validarCPF, validarEmail } from '@/lib/validators'
import { z } from 'zod'

const membroSchema = z.object({
  nome: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  senha: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  endereco: z.string().optional(),
  planoId: z.string().optional(),
  precoCustomizado: z.number().optional(),
})

// GET /api/membros - Listar todos os membros
export async function GET() {
  return withApiAuth(async () => {
    const membros = await prisma.membro.findMany({
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
      orderBy: {
        criadoEm: 'desc',
      },
    })

    return NextResponse.json(membros)
  }, { requiredRole: 'ADMIN' })
}

// POST /api/membros - Criar novo membro
export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    const body = await request.json()
    const validation = membroSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { nome, email, senha, cpf, rg, telefone, dataNascimento, endereco, planoId, precoCustomizado } = validation.data

    // Validate email if provided
    if (email && !validarEmail(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Validate CPF if provided
    if (cpf && !validarCPF(cpf)) {
      return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
    }

    // Check if email already exists (only if provided)
    if (email) {
      const emailExiste = await prisma.usuario.findUnique({ where: { email } })
      if (emailExiste) {
        return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
      }
    }

    // Check if CPF already exists (only if provided)
    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : null
    if (cpfLimpo) {
      const cpfExiste = await prisma.membro.findUnique({ where: { cpf: cpfLimpo } })
      if (cpfExiste) {
        return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 400 })
      }
    }

    // Create password hash if provided, otherwise generate a random one
    const senhaHash = senha ? await hash(senha, 12) : await hash(Math.random().toString(36), 12)

    const membro = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: nome || 'Sem nome',
          email: email || `temp_${Date.now()}@placeholder.local`,
          senha: senhaHash,
          role: 'MEMBRO',
        },
      })

      return tx.membro.create({
        data: {
          usuarioId: usuario.id,
          cpf: cpfLimpo,
          rg,
          telefone: telefone ? telefone.replace(/\D/g, '') : null,
          dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
          endereco,
          planoId,
          precoCustomizado,
          status: 'ATIVO',
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

