import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { generateTrainingPDF } from '@/lib/pdf'

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
    // Group exercises by session
    const sessionsMap = new Map<string, Array<{ name: string; sets: string; reps: string }>>()

    for (const ex of ficha.exercicios) {
      const sessionName = ex.sessao || 'A'
      if (!sessionsMap.has(sessionName)) {
        sessionsMap.set(sessionName, [])
      }
      sessionsMap.get(sessionName)!.push({
        name: ex.nome,
        sets: ex.series,
        reps: ex.repeticoes,
      })
    }

    // Convert to array format
    const sessions = Array.from(sessionsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, exercises]) => ({ name, exercises }))

    // Generate PDF using PDFKit
    const pdfBuffer = await generateTrainingPDF({
      aluno: ficha.membro.usuario.nome || 'Aluno',
      date: ficha.data || new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
      observacoes: ficha.observacoes || '',
      sessions,
    })

    // Generate filename
    const safeNome = (ficha.membro.usuario.nome || 'aluno').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
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