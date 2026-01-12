import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

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
  sessions: Session[]
}

/**
 * POST /api/treinos/gerar-pdf
 * Generate a training plan PDF using Python reportlab
 */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body: TrainingPDFData = await request.json()
    const { aluno, date, sessions } = body

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

    // Create temp file for output
    const tempDir = os.tmpdir()
    const outputPath = path.join(tempDir, `treino-${Date.now()}.pdf`)

    // Prepare data for Python script
    const pdfData = {
      aluno,
      date,
      sessions: validSessions,
    }

    // Path to Python script
    const scriptPath = path.join(process.cwd(), 'utility', 'pdf_creation.py')

    // Use virtual environment Python if available
    const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python')

    // Execute Python script
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const pythonProcess = spawn(venvPython, [
        scriptPath,
        '--output', outputPath,
      ])

      let stderr = ''

      pythonProcess.stdin.write(JSON.stringify(pdfData))
      pythonProcess.stdin.end()

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          console.error('Python script error:', stderr)
          reject(new Error(`Python script failed with code ${code}: ${stderr}`))
          return
        }

        try {
          const buffer = await fs.readFile(outputPath)
          // Clean up temp file
          await fs.unlink(outputPath).catch(() => {})
          resolve(buffer)
        } catch (err) {
          reject(err)
        }
      })

      pythonProcess.on('error', (err) => {
        reject(err)
      })
    })

    // Generate filename
    const safeAluno = aluno.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
    const safeDate = date.replace(/\//g, '-')
    const filename = `Treino-${safeAluno}-${safeDate}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF. Verifique se Python está instalado.' },
      { status: 500 }
    )
  }
}

