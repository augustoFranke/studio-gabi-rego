import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

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
 * Generate a training plan PDF using Python/ReportLab
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

    // Call Python PDF generator endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const pdfResponse = await fetch(`${baseUrl}/api/generate_pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aluno,
        date,
        observacoes: observacoes || '',
        sessions: validSessions,
      }),
    })

    if (!pdfResponse.ok) {
      const errorData = await pdfResponse.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(
        { error: errorData.error || 'Erro ao gerar PDF' },
        { status: pdfResponse.status }
      )
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()

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