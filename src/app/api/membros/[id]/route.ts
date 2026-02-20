import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth, validateRequest } from '@/lib/api'
import { hash } from 'bcryptjs'
import { validarCPF, validarEmail } from '@/lib/validators'
import { Prisma } from '@prisma/client'
import { membroUpdateSchema } from '@/schemas/membro.schema'
import { normalizeEmailForStorage } from '@/lib/email'

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
        const validation = await validateRequest(request, membroUpdateSchema)

        if ('error' in validation) {
            return validation.error
        }

        const data = validation.data

        const normalizedEmail = data.email === undefined
            ? undefined
            : normalizeEmailForStorage(data.email)

        const cpfLimpo = typeof data.cpf === 'string' && data.cpf
            ? data.cpf.replace(/\D/g, '')
            : null

        // Parallelize member lookup and validation checks
        const [membroExistente, emailExiste, cpfExiste] = await Promise.all([
            prisma.membro.findUnique({
                where: { id },
                include: { usuario: true }
            }),
            normalizedEmail
                ? prisma.usuario.findUnique({ where: { email: normalizedEmail } })
                : Promise.resolve(null),
            cpfLimpo
                ? prisma.membro.findUnique({ where: { cpf: cpfLimpo } })
                : Promise.resolve(null),
        ])

        if (!membroExistente) {
            return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
        }

        // Validate email uniqueness
        if (normalizedEmail && normalizedEmail !== membroExistente.usuario.email) {
            if (!validarEmail(normalizedEmail)) {
                return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
            }
            if (emailExiste) {
                return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
            }
        }

        // Validate CPF uniqueness
        if (cpfLimpo && cpfLimpo !== membroExistente.cpf) {
            if (!validarCPF(data.cpf!)) {
                return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
            }
            if (cpfExiste) {
                return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 400 })
            }
        }

        if (data.horariosFixos && data.horariosFixos.length) {
            const planoIdParaValidar = data.planoId ?? membroExistente.planoId

            if (planoIdParaValidar) {
                const plano = await prisma.plano.findUnique({
                    where: { id: planoIdParaValidar },
                    select: { aulasSemanais: true },
                })

                if (plano && plano.aulasSemanais !== 7) {
                    const uniqueSlots = new Set(
                        data.horariosFixos.map((horario) => `${horario.diaSemana}-${horario.hora}`)
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
            }
        }

        // Atualizar dados em transação
        const membroAtualizado = await prisma.$transaction(async (tx) => {
            // Atualizar usuário se necessário
            if (data.nome || normalizedEmail !== undefined || data.senha) {
                const usuarioUpdateData: { nome?: string; email?: string | null; senha?: string; senhaDefinida?: boolean } = {}
                if (data.nome) usuarioUpdateData.nome = data.nome
                if (normalizedEmail !== undefined) usuarioUpdateData.email = normalizedEmail
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
            if (data.cpf === null || data.cpf === '') {
                memberUpdateData.cpf = null
            } else if (data.cpf) {
                memberUpdateData.cpf = data.cpf.replace(/\D/g, '')
            }
            if (data.rg !== undefined) {
                memberUpdateData.rg = data.rg && data.rg.trim() !== '' ? data.rg : null
            }
            if (data.telefone !== undefined) {
                memberUpdateData.telefone = data.telefone
                    ? data.telefone.replace(/\D/g, '')
                    : null
            }
            if (data.dataNascimento !== undefined) {
                memberUpdateData.dataNascimento = data.dataNascimento
                    ? new Date(data.dataNascimento)
                    : null
            }
            if (data.planoId) memberUpdateData.plano = { connect: { id: data.planoId } }
            if (data.precoCustomizado !== undefined) memberUpdateData.precoCustomizado = data.precoCustomizado
            if (data.sexo) memberUpdateData.sexo = data.sexo
            if (data.horariosFixos) {
                memberUpdateData.horariosFixos = {
                    deleteMany: {},
                    create: data.horariosFixos.map((horario) => ({
                        diaSemana: horario.diaSemana,
                        hora: horario.hora,
                    })),
                }
            }

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
