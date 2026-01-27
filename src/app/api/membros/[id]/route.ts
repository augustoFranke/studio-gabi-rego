import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { hash } from 'bcryptjs'
import { validarCPF, validarEmail } from '@/lib/validators'
import { Prisma } from '@prisma/client'
import { membroUpdateSchema } from '@/schemas/membro.schema'

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
        const validation = membroUpdateSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            )
        }

        const data = validation.data

        // Normalize email to lowercase
        const normalizedEmail = data.email ? data.email.toLowerCase().trim() : undefined

        // Verificar se membro existe
        const membroExistente = await prisma.membro.findUnique({
            where: { id },
            include: { usuario: true }
        })

        if (!membroExistente) {
            return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
        }

        // Validações de unicidade se houver alteração
        if (normalizedEmail && normalizedEmail !== membroExistente.usuario.email) {
            if (!validarEmail(normalizedEmail)) {
                return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
            }
            const emailExiste = await prisma.usuario.findUnique({ where: { email: normalizedEmail } })
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
            if (data.nome || normalizedEmail || data.senha) {
                const usuarioUpdateData: { nome?: string; email?: string; senha?: string; senhaDefinida?: boolean } = {}
                if (data.nome) usuarioUpdateData.nome = data.nome
                if (normalizedEmail) usuarioUpdateData.email = normalizedEmail
                if (data.senha) {
                    usuarioUpdateData.senha = await hash(data.senha, 12)
                    usuarioUpdateData.senhaDefinida = true
                }

                await tx.usuario.update({
                    where: { id: membroExistente.usuarioId },
                    data: usuarioUpdateData,
                })
            }

            // Preparar dados de atualização do membro
            const memberUpdateData: Prisma.MembroUpdateInput = {}
            if (data.cpf) memberUpdateData.cpf = data.cpf.replace(/\D/g, '')
            if (data.rg !== undefined) memberUpdateData.rg = data.rg // Permitir limpar RG? se string vazia
            if (data.telefone) memberUpdateData.telefone = data.telefone.replace(/\D/g, '')
            if (data.dataNascimento) memberUpdateData.dataNascimento = new Date(data.dataNascimento)
            if (data.planoId) memberUpdateData.plano = { connect: { id: data.planoId } }
            if (data.precoCustomizado !== undefined) memberUpdateData.precoCustomizado = data.precoCustomizado
            if (data.sexo) memberUpdateData.sexo = data.sexo

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
