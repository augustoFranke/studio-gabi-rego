/**
 * PDF Generator for Training Plans using PDFKit
 * This replicates the Python/ReportLab implementation style
 */

import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

// A4 dimensions in points (72 points per inch)
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const CM = 28.35 // 1 cm in points

const MARGIN_LEFT = 1.5 * CM
const MARGIN_RIGHT = 1.5 * CM
const MARGIN_TOP = 1.5 * CM
const USEABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

// Extra rows for notes
const EXTRA_ROWS = 3

interface Exercise {
  name: string
  sets: string
  reps: string
}

interface Session {
  name: string
  exercises: Exercise[]
}

interface PDFData {
  aluno: string
  date: string
  observacoes?: string
  sessions: Session[]
}

function getLogoPath(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'logo-black.png'),
    path.join(__dirname, '..', '..', 'public', 'logo-black.png'),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

export async function generateTrainingPDF(data: PDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: MARGIN_TOP,
        bottom: MARGIN_TOP,
        left: MARGIN_LEFT,
        right: MARGIN_RIGHT,
      },
      info: {
        Title: `Ficha de Treino - ${data.aluno}`,
      },
    })

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    let cursorY = MARGIN_TOP

    // 1. DRAW LOGO
    const logoW = 5 * CM
    const logoH = 5 * CM
    const logoPath = getLogoPath()

    if (logoPath) {
      try {
        doc.image(logoPath, MARGIN_LEFT, cursorY, {
          width: logoW,
          height: logoH,
          fit: [logoW, logoH],
        })
      } catch (e) {
        console.warn('Could not load logo:', e)
      }
    }

    // 2. DRAW HEADER TEXT (ALUNO / DATA)
    const textXStart = MARGIN_LEFT + logoW + 1 * CM

    // Aluno Line
    doc.font('Helvetica-Bold').fontSize(20)
    doc.text('ALUNO:', textXStart, cursorY + 2 * CM, { continued: true })
    doc.font('Helvetica').text(` ${data.aluno}`)

    // Draw underline
    const lineY1 = cursorY + 2 * CM + 22
    doc.moveTo(textXStart + 2.3 * CM, lineY1)
       .lineTo(PAGE_WIDTH - MARGIN_RIGHT, lineY1)
       .stroke()

    // Data Line
    doc.font('Helvetica-Bold').fontSize(20)
    doc.text('DATA:', textXStart, cursorY + 3.5 * CM, { continued: true })
    doc.font('Helvetica').text(` ${data.date}`)

    // Draw underline
    const lineY2 = cursorY + 3.5 * CM + 22
    doc.moveTo(textXStart + 2.3 * CM, lineY2)
       .lineTo(PAGE_WIDTH - MARGIN_RIGHT, lineY2)
       .stroke()

    // Move cursor below the header section
    cursorY += logoH + 1 * CM

    // Function to draw a workout table
    function drawWorkoutTable(title: string, startY: number, exercises: Exercise[]): number {
      // Check if we need a new page
      const estimatedHeight = (exercises.length + EXTRA_ROWS + 1) * 0.7 * CM + 2 * CM
      if (startY + estimatedHeight > PAGE_HEIGHT - MARGIN_TOP) {
        doc.addPage()
        startY = MARGIN_TOP
      }

      // Draw title
      doc.font('Helvetica-Bold').fontSize(18)
      doc.text(title, MARGIN_LEFT, startY)

      const tableTop = startY + 0.6 * CM + 18
      const rowHeight = 0.7 * CM
      const colWidths = [
        USEABLE_WIDTH * 0.45,
        USEABLE_WIDTH * 0.15,
        USEABLE_WIDTH * 0.15,
        USEABLE_WIDTH * 0.25,
      ]

      // Table data
      const rows = [
        ['EXERCICIOS', 'SERIES', 'REPETICOES', ''],
        ...exercises.map((ex) => [ex.name, ex.sets, ex.reps, '']),
        ...Array(EXTRA_ROWS).fill(['', '', '', '']),
      ]

      // Draw table
      let y = tableTop
      for (let i = 0; i < rows.length; i++) {
        let x = MARGIN_LEFT
        for (let j = 0; j < rows[i].length; j++) {
          // Draw cell border
          doc.rect(x, y, colWidths[j], rowHeight).stroke()

          // Draw cell text
          doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(12)
          const textY = y + (rowHeight - 12) / 2
          const textX = j === 1 || j === 2
            ? x + colWidths[j] / 2 // Center for series/reps
            : x + 4 // Left align for others

          if (j === 1 || j === 2) {
            doc.text(rows[i][j], x, textY, {
              width: colWidths[j],
              align: 'center',
            })
          } else {
            doc.text(rows[i][j], textX, textY)
          }

          x += colWidths[j]
        }
        y += rowHeight
      }

      return y + 1 * CM
    }

    // Draw each session as a table
    for (const session of data.sessions) {
      if (session.exercises && session.exercises.length > 0) {
        cursorY = drawWorkoutTable(`TREINO ${session.name}`, cursorY, session.exercises)
      }
    }

    // Draw observations at the bottom if present
    if (data.observacoes && data.observacoes.trim()) {
      // Check if we need a new page
      if (cursorY + 4 * CM > PAGE_HEIGHT - MARGIN_TOP) {
        doc.addPage()
        cursorY = MARGIN_TOP
      }

      doc.font('Helvetica').fontSize(18)
      doc.text(`OBSERVACOES: ${data.observacoes.trim()}`, MARGIN_LEFT, cursorY, {
        width: USEABLE_WIDTH,
      })
    }

    doc.end()
  })
}
