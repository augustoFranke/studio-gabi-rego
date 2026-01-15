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
    const pdfBuffer = await gerarPDFFichaTreino({
      nome: ficha.nome,
      data: ficha.data,
      objetivo: ficha.objetivo,
      observacoes: ficha.observacoes,
      membro: {
        nome: ficha.membro.usuario.nome,
      },
      exercicios: ficha.exercicios.map(ex => ({
        nome: ex.nome,
        sessao: ex.sessao,
        grupoMuscular: ex.grupoMuscular,
        series: ex.series,
        repeticoes: ex.repeticoes,
        descanso: ex.descanso,
        observacoes: ex.observacoes
      }))
    });

    // Generate filename
    const safeNome = ficha.membro.usuario.nome.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    const filename = `treino-${safeNome}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Erro ao gerar PDF: ${errorMessage}` }, { status: 500 })
  }
}