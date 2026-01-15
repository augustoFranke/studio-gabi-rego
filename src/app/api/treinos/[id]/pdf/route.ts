import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/treinos/[id]/pdf - Gerar PDF da ficha de treino usando Python
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
    // Create temp file for output
    const tempDir = os.tmpdir()
    const outputPath = path.join(tempDir, `treino-${Date.now()}.pdf`)

    // Group exercises by session
    const sessionsMap = new Map<string, Array<{ name: string; sets: string; reps: string }>>()

    for (const ex of ficha.exercicios) {
      const sessao = ex.sessao || 'A'
      const exercises = sessionsMap.get(sessao) || []
      exercises.push({
        name: ex.nome,
        sets: ex.series.toString(),
        reps: ex.repeticoes,
      })
      sessionsMap.set(sessao, exercises)
    }

    // Convert to sessions array format expected by Python script
    const sessions = Array.from(sessionsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, exercises]) => ({
        name,
        exercises,
      }))

    // Prepare data for Python script
    const pdfData = {
      aluno: ficha.membro.usuario.nome,
      date: ficha.data || new Date(ficha.criadoEm).toLocaleDateString('pt-BR', {
        month: '2-digit',
        year: 'numeric'
      }),
      observacoes: ficha.observacoes || undefined,
      sessions,
    }

    // Path to Python script
    const scriptPath = path.join(process.cwd(), 'utility', 'pdf_creation.py')

    // Use virtual environment Python if available
    const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python')

    try {
      await fs.access(venvPython)
    } catch {
      throw new Error(`Python interpreter not found at: ${venvPython}`)
    }

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
          await fs.unlink(outputPath).catch(() => { })
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
