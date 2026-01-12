import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { gerarPDFFichaTreino } from '@/lib/pdf'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/treinos/[id]/pdf - Gerar PDF da ficha de treino
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  const ficha = await prisma.fichaTreino.findUnique({
    where: { id },
    include: {
      membro: {
        include: {
          usuario: {
            select: { nome: true },
          },
        },
      },
      exercicios: {
        orderBy: [{ sessao: 'asc' }, { ordem: 'asc' }],
      },
    },
  })

  if (!ficha) {
    return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
  }

  // Se for membro, só pode ver seu próprio treino
  if (session.user.role === 'MEMBRO' && ficha.membroId !== session.user.membroId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Gerar PDF real
    const pdfBuffer = await gerarPDFFichaTreino({
      nome: ficha.nome,
      objetivo: ficha.objetivo ?? undefined,
      observacoes: ficha.observacoes ?? undefined,
      exercicios: ficha.exercicios.map((ex) => ({
        nome: ex.nome,
        grupoMuscular: ex.grupoMuscular ?? '',
        series: ex.series,
        repeticoes: ex.repeticoes,
        carga: ex.carga ?? undefined,
        descanso: ex.descanso ?? undefined,
        observacoes: ex.observacoes ?? undefined,
      })),
      membro: {
        nome: ficha.membro.usuario.nome,
      },
      criadoEm: ficha.criadoEm,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="treino-${ficha.nome.toLowerCase().replace(/\s+/g, '-')}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 })
  }
}

