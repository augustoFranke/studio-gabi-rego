import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { hash } from 'bcryptjs'
import { validarCPF, validarEmail } from '@/lib/validators'
import { z } from 'zod'

const membroSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  cpf: z.string().min(11, 'CPF deve ter pelo menos 11 dígitos'),
  rg: z.string().optional(),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  dataNascimento: z.string().min(1, 'Data de nascimento é obrigatória'),
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

    if (!validarEmail(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    if (!validarCPF(cpf)) {
      return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
    }

    // Verificar se email já existe
    const emailExiste = await prisma.usuario.findUnique({ where: { email } })
    if (emailExiste) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
    }

    // Verificar se CPF já existe
    const cpfLimpo = cpf.replace(/\D/g, '')
    const cpfExiste = await prisma.membro.findUnique({ where: { cpf: cpfLimpo } })
    if (cpfExiste) {
      return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 400 })
    }

    // Criar usuário e membro em uma transação
    const senhaHash = await hash(senha, 12)

    const membro = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome,
          email,
          senha: senhaHash,
          role: 'MEMBRO',
        },
      })

      return tx.membro.create({
        data: {
          usuarioId: usuario.id,
          cpf: cpfLimpo,
          rg,
          telefone: telefone.replace(/\D/g, ''),
          dataNascimento: new Date(dataNascimento),
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

