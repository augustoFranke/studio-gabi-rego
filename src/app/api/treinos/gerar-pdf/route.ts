import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api'
import { generateTrainingPDF } from '@/lib/pdf'
import { logError, safeErrorData } from '@/lib/observability/logger'
import { trainingPdfSchema } from '@/schemas/treino.schema'

export async function POST(request: NextRequest) {
  return withApiAuth(async () => {
    try {
      const validation = trainingPdfSchema.safeParse(await request.json())

      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues[0]?.message ?? 'Dados inválidos.' },
          { status: 400 }
        )
      }

      const { aluno, date, observacoes, sessions } = validation.data

      if (!aluno || !date || !sessions || sessions.length === 0) {
        return NextResponse.json(
          { error: 'Dados incompletos. Preencha aluno, data e pelo menos um treino.' },
          { status: 400 }
        )
      }

      const validSessions = sessions.filter(s => s.exercises && s.exercises.length > 0)

      if (validSessions.length === 0) {
        return NextResponse.json(
          { error: 'Adicione pelo menos um exercício em um treino.' },
          { status: 400 }
        )
      }

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
      logError('training_pdf_generation_failed', {
        message: 'Error generating PDF:',
        ...safeErrorData(error),
      })
      return NextResponse.json(
        { error: 'Erro ao gerar PDF.' },
        { status: 500 }
      )
    }
  }, { requiredRole: 'ADMIN' })
}
