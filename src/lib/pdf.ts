/**
 * PDF Generator for Training Plans using pdf-lib
 * Pure JavaScript implementation compatible with serverless environments
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import path from 'path'
import fs from 'fs'

// A4 dimensions in points (72 points per inch)
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const CM = 28.35

const MARGIN_LEFT = 1.5 * CM
const MARGIN_RIGHT = 1.5 * CM
const MARGIN_TOP = 1.5 * CM
const USEABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

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

function mmToPoints(mm: number): number {
  return mm * 2.83465
}

export async function generateTrainingPDF(data: PDFData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Ficha de Treino - ${data.aluno}`)

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const { width, height } = page.getSize()

  let cursorY = height - MARGIN_TOP

  // 1. DRAW LOGO
  const logoPath = getLogoPath()
  if (logoPath) {
    try {
      const logoImageBytes = fs.readFileSync(logoPath)
      const logoImage = await pdfDoc.embedPng(logoImageBytes)
      const logoDims = logoImage.scale(mmToPoints(5) / logoImage.width)

      page.drawImage(logoImage, {
        x: MARGIN_LEFT,
        y: cursorY - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      })

      cursorY -= logoDims.height + mmToPoints(1)
    } catch (e) {
      console.warn('Could not load logo:', e)
    }
  }

  // 2. DRAW HEADER TEXT (ALUNO / DATA)
  const textXStart = MARGIN_LEFT + mmToPoints(5) + 1 * CM

  // Aluno Line
  page.drawText('ALUNO:', {
    x: textXStart,
    y: cursorY - mmToPoints(2),
    size: 20,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })

  const alunoWidth = helveticaBoldFont.widthOfTextAtSize(data.aluno, 20)
  page.drawText(data.aluno, {
    x: textXStart + mmToPoints(2.5),
    y: cursorY - mmToPoints(2),
    size: 20,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })

  page.drawLine({
    start: { x: textXStart + mmToPoints(2.3), y: cursorY - mmToPoints(2.2) },
    end: { x: width - MARGIN_RIGHT, y: cursorY - mmToPoints(2.2) },
    thickness: 1,
    color: rgb(0, 0, 0),
  })

  // Data Line
  page.drawText('DATA:', {
    x: textXStart,
    y: cursorY - mmToPoints(3.5),
    size: 20,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })

  page.drawText(data.date, {
    x: textXStart + mmToPoints(2.5),
    y: cursorY - mmToPoints(3.5),
    size: 20,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })

  page.drawLine({
    start: { x: textXStart + mmToPoints(2.3), y: cursorY - mmToPoints(3.7) },
    end: { x: width - MARGIN_RIGHT, y: cursorY - mmToPoints(3.7) },
    thickness: 1,
    color: rgb(0, 0, 0),
  })

  // Move cursor below header
  if (logoPath) {
    cursorY = height - MARGIN_TOP - mmToPoints(5) - mmToPoints(1)
  } else {
    cursorY -= mmToPoints(1)
  }

  // Function to draw workout table
  function drawWorkoutTable(
    title: string,
    startY: number,
    exercises: Exercise[]
  ): number {
    const tableHeaderHeight = mmToPoints(0.7)
    const rowHeight = mmToPoints(0.7)
    const estimatedHeight =
      (exercises.length + EXTRA_ROWS + 1) * rowHeight + mmToPoints(2)

    if (startY - estimatedHeight < MARGIN_TOP + mmToPoints(2)) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      cursorY = height - MARGIN_TOP
    }

    // Draw title
    page.drawText(title, {
      x: MARGIN_LEFT,
      y: startY,
      size: 18,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    })

    let tableTop = startY - mmToPoints(0.6) - 18

    const colWidths = [
      USEABLE_WIDTH * 0.45,
      USEABLE_WIDTH * 0.15,
      USEABLE_WIDTH * 0.15,
      USEABLE_WIDTH * 0.25,
    ]

    const rows: string[][] = [
      ['EXERCÍCIOS', 'SÉRIES', 'REPETIÇÕES', ''],
      ...exercises.map((ex) => [ex.name, ex.sets, ex.reps, '']),
      ...Array(EXTRA_ROWS).fill(['', '', '', '']),
    ]

    // Draw table
    let y = tableTop
    for (let i = 0; i < rows.length; i++) {
      let x = MARGIN_LEFT
      for (let j = 0; j < rows[i].length; j++) {
        // Draw cell border
        page.drawRectangle({
          x,
          y: y - rowHeight,
          width: colWidths[j],
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        })

        // Draw cell text
        const font = i === 0 ? helveticaBoldFont : helveticaFont
        const text = rows[i][j]
        const fontSize = 12

        const textY = y - rowHeight + (rowHeight - fontSize) / 2

        if (j === 1 || j === 2) {
          const textWidth = font.widthOfTextAtSize(text, fontSize)
          const textX = x + (colWidths[j] - textWidth) / 2
          page.drawText(text, {
            x: textX,
            y: textY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          })
        } else {
          page.drawText(text, {
            x: x + 4,
            y: textY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          })
        }

        x += colWidths[j]
      }
      y -= rowHeight
    }

    return y - mmToPoints(1)
  }

  // Draw each session as a table
  for (const session of data.sessions) {
    if (session.exercises && session.exercises.length > 0) {
      cursorY = drawWorkoutTable(
        `TREINO ${session.name}`,
        cursorY,
        session.exercises
      )
    }
  }

  // Draw observations
  if (data.observacoes && data.observacoes.trim()) {
    if (cursorY - mmToPoints(4) < MARGIN_TOP + mmToPoints(2)) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      cursorY = height - MARGIN_TOP
    }

    page.drawText(`OBSERVAÇÕES: ${data.observacoes.trim()}`, {
      x: MARGIN_LEFT,
      y: cursorY,
      size: 18,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
