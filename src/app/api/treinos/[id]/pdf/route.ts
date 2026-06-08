import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureOwnerOrAdmin, withApiAuth } from '@/lib/api'
import { generateTrainingPDF } from '@/lib/pdf'
import { logError, safeErrorData } from '@/lib/observability/logger'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withApiAuth(async (session) => {
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

    const authError = ensureOwnerOrAdmin(session, ficha.membroId)
    if (authError) {
      return authError
    }

    try {
      const sessionsByName = ficha.exercicios.reduce<Record<string, Array<{ name: string; sets: string; reps: string; observacoes?: string }>>>((acc, ex) => {
        const sessionName = ex.sessao || 'A'
        acc[sessionName] ??= []
        acc[sessionName].push({
          name: ex.nome,
          sets: ex.series,
          reps: ex.repeticoes,
          observacoes: ex.observacoes ?? undefined,
        })
        return acc
      }, {})

      const sessions = Object.entries(sessionsByName)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, exercises]) => ({ name, exercises }))

      const pdfBuffer = await generateTrainingPDF({
        aluno: ficha.membro.usuario.nome || 'Aluno',
        date: ficha.data || new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
        observacoes: ficha.observacoes || '',
        sessions,
      })

      const safeNome = (ficha.membro.usuario.nome || 'aluno').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      const filename = `treino-${safeNome}.pdf`

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (error) {
      logError('training_pdf_generation_failed', {
        message: 'Erro ao gerar PDF:',
        ...safeErrorData(error),
      })
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json({ error: `Erro ao gerar PDF: ${errorMessage}` }, { status: 500 })
    }
  })
}
