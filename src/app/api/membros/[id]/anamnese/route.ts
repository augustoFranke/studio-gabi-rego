import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'
import { sanitizeAnamnesePayload } from '@/lib/anamnese'

interface Params {
  params: Promise<{
    id: string
  }>
}

// GET /api/membros/[id]/anamnese - Obter anamnese do membro
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

    // Use explicit DB-backed sexo; null when unset.
    const sexo = membro.sexo
      ? (membro.sexo === 'FEMININO' ? 'Feminino' : 'Masculino')
      : null

    return NextResponse.json({
      member: {
        id: membro.id,
        nome: membro.usuario.nome,
        sexo,
      },
      anamnese: membro.anamnese,
    })
  }, { requiredRole: 'ADMIN' })
}

// POST /api/membros/[id]/anamnese - Salvar anamnese do membro
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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const sanitized = sanitizeAnamnesePayload(body as Record<string, unknown>)
    if ('error' in sanitized || Object.keys(sanitized.data).length === 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const membro = await prisma.membro.findUnique({
      where: { id },
    })

    if (!membro) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }

    // Upsert anamnese
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
