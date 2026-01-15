import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateTrainingPDF } from '@/lib/pdf'

interface Exercise {
  name: string
  sets: string | number
  reps: string | number
}

interface Session {
  name: string
  exercises: Exercise[]
}

interface TrainingPDFData {
  aluno: string
  date: string
  observacoes?: string
  sessions: Session[]
}

/**
 * POST /api/treinos/gerar-pdf
 * Generate a training plan PDF using PDFKit
 */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body: TrainingPDFData = await request.json()
    const { aluno, date, observacoes, sessions } = body

    if (!aluno || !date || !sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: 'Dados incompletos. Preencha aluno, data e pelo menos um treino.' },
        { status: 400 }
      )
    }

    // Filter out empty sessions (no exercises)
    const validSessions = sessions.filter(s => s.exercises && s.exercises.length > 0)

    if (validSessions.length === 0) {
      return NextResponse.json(
        { error: 'Adicione pelo menos um exercício em um treino.' },
        { status: 400 }
      )
    }

    // Generate PDF using PDFKit
    const pdfBuffer = await generateTrainingPDF({
      aluno,
      date,
      observacoes: observacoes || '',
      sessions: validSessions.map(s => ({
        name: s.name,
        exercises: s.exercises.map(ex => ({
          name: ex.name,
          sets: String(ex.sets),
          reps: String(ex.reps),
        })),
      })),
    })

    // Generate filename
    const safeAluno = aluno.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
    const safeDate = date.replace(/\//g, '-')
    const filename = `Treino-${safeAluno}-${safeDate}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Erro ao gerar PDF: ${errorMessage}` },
      { status: 500 }
    )
  }
}