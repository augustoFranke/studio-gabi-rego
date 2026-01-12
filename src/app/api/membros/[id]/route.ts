import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { z } from 'zod'
import { validarCPF, validarEmail } from '@/lib/validators'

const updateMembroSchema = z.object({
    nome: z.string().optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    cpf: z.string().optional(),
    rg: z.string().optional(),
    telefone: z.string().optional(),
    dataNascimento: z.string().optional(),
    endereco: z.string().optional(),
    planoId: z.string().optional(),
    precoCustomizado: z.union([z.number(), z.string(), z.null()]).optional().transform(val => {
        if (val === '' || val === null) return null;
        return Number(val);
    }),
})

interface Params {
    params: Promise<{
        id: string
    }>
}

// GET /api/membros/[id] - Obter detalhes do membro
export async function GET(
    request: NextRequest,
    { params }: Params
) {
    return withApiAuth(async () => {
        const { id } = await params

        const membro = await prisma.membro.findUnique({
            where: { id },
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

        if (!membro) {
            return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
        }

        return NextResponse.json(membro)
    }, { requiredRole: 'ADMIN' })
}

// PATCH /api/membros/[id] - Atualizar membro
export async function PATCH(
    request: NextRequest,
    { params }: Params
) {
    return withApiAuth(async () => {
        const { id } = await params
        const body = await request.json()
        const validation = updateMembroSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            )
        }

        const data = validation.data

        // Verificar se membro existe
        const membroExistente = await prisma.membro.findUnique({
            where: { id },
            include: { usuario: true }
        })

        if (!membroExistente) {
            return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
        }

        // Validações de unicidade se houver alteração
        if (data.email && data.email !== membroExistente.usuario.email) {
            if (!validarEmail(data.email)) {
                return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
            }
            const emailExiste = await prisma.usuario.findUnique({ where: { email: data.email } })
            if (emailExiste) {
                return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
            }
        }

        if (data.cpf) {
            const cpfLimpo = data.cpf.replace(/\D/g, '')
            if (cpfLimpo !== membroExistente.cpf) {
                if (!validarCPF(data.cpf)) {
                    return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
                }
                const cpfExiste = await prisma.membro.findUnique({ where: { cpf: cpfLimpo } })
                if (cpfExiste) {
                    return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 400 })
                }
            }
        }

        // Atualizar dados em transação
        const membroAtualizado = await prisma.$transaction(async (tx) => {
            // Atualizar usuário se necessário
            if (data.nome || data.email) {
                await tx.usuario.update({
                    where: { id: membroExistente.usuarioId },
                    data: {
                        nome: data.nome,
                        email: data.email,
                    },
                })
            }

            // Preparar dados de atualização do membro
            const memberUpdateData: any = {}
            if (data.cpf) memberUpdateData.cpf = data.cpf.replace(/\D/g, '')
            if (data.rg !== undefined) memberUpdateData.rg = data.rg // Permitir limpar RG? se string vazia
            if (data.telefone) memberUpdateData.telefone = data.telefone.replace(/\D/g, '')
            if (data.dataNascimento) memberUpdateData.dataNascimento = new Date(data.dataNascimento)
            if (data.endereco !== undefined) memberUpdateData.endereco = data.endereco
            if (data.planoId) memberUpdateData.planoId = data.planoId
            if (data.precoCustomizado !== undefined) memberUpdateData.precoCustomizado = data.precoCustomizado

            return tx.membro.update({
                where: { id },
                data: memberUpdateData,
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

        return NextResponse.json(membroAtualizado)
    }, { requiredRole: 'ADMIN' })
}
