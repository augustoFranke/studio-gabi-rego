import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import {
  extractCanonicalAnamneseData,
  normalizeAnamneseRecord,
  sanitizeAnamnesePayload,
} from '@/lib/anamnese'

interface Params {
  params: Promise<{
    id: string
  }>
}

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
            nome: true,
          },
        },
        anamnese: true,
      },
    })

    if (!membro) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }

    const sexo = membro.sexo
      ? (membro.sexo === 'FEMININO' ? 'Feminino' : 'Masculino')
      : null

    const normalized = normalizeAnamneseRecord(
      extractCanonicalAnamneseData(membro.anamnese)
    )
    if ('error' in normalized) {
      return NextResponse.json({ error: 'Dados de anamnese inválidos' }, { status: 500 })
    }

    if (membro.anamnese && normalized.changed) {
      await prisma.anamnese.update({
        where: { membroId: id },
        data: normalized.data,
      })
    }

    return NextResponse.json({
      member: {
        id: membro.id,
        nome: membro.usuario.nome,
        sexo,
      },
      anamnese: membro.anamnese ? normalized.data : null,
    })
  }, { requiredRole: 'ADMIN' })
}

export async function POST(
  request: NextRequest,
  { params }: Params
) {
  return withApiAuth(async () => {
    const { id } = await params
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const sanitized = sanitizeAnamnesePayload(body, {
      ignoreUnknownFields: true,
      fillMissingFields: true,
    })
    if ('error' in sanitized) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    if (sanitized.ignoredKeys.length > 0) {
      console.warn('[anamnese_sanitize] Campos ignorados em membros/[id]/anamnese:', sanitized.ignoredKeys)
    }

    const membro = await prisma.membro.findUnique({
      where: { id },
    })

    if (!membro) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }

    const anamnese = await prisma.anamnese.upsert({
      where: { membroId: id },
      create: {
        membroId: id,
        ...sanitized.data,
      },
      update: sanitized.data,
    })

    return NextResponse.json(anamnese)
  }, { requiredRole: 'ADMIN' })
}
