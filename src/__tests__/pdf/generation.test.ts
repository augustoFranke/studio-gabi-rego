import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { generateTrainingPDF } from '@/lib/pdf'
import { minimalPDFData, multiSessionPDFData, testPDFData, type PDFData } from './fixtures'

async function loadPdf(buffer: Buffer) {
  const pdfDoc = await PDFDocument.load(buffer)
  expect(pdfDoc.getPages().length).toBeGreaterThanOrEqual(1)
  return pdfDoc
}

async function expectValidPdf(data: PDFData, minBytes = 500) {
  const pdfBuffer = await generateTrainingPDF(data)
  expect(pdfBuffer).toBeInstanceOf(Buffer)
  expect(pdfBuffer.length).toBeGreaterThan(minBytes)
  const pdfDoc = await loadPdf(pdfBuffer)
  return { pdfBuffer, pdfDoc }
}

describe('PDF Generation', () => {
  it('generates valid PDFs across core scenarios', async () => {
    const scenarios: PDFData[] = [
      testPDFData,
      minimalPDFData,
      multiSessionPDFData,
      { ...testPDFData, sessions: [] },
      { ...testPDFData, observacoes: '' },
      { ...testPDFData, observacoes: undefined },
      { ...testPDFData, aluno: 'José da Silva Júnior' },
    ]

    for (const scenario of scenarios) {
      await expectValidPdf(scenario)
    }
  })

  it('sets the PDF title with the student name (including accents)', async () => {
    const data = { ...testPDFData, aluno: 'José da Silva Júnior' }
    const { pdfDoc } = await expectValidPdf(data)

    expect(pdfDoc.getTitle()).toContain('José da Silva Júnior')
  })

  it('keeps normal PDFs within sane size bounds', async () => {
    const { pdfBuffer } = await expectValidPdf(testPDFData, 1000)

    expect(pdfBuffer.length).toBeGreaterThan(1000)
    expect(pdfBuffer.length).toBeLessThan(1_000_000)
  })

  it('handles large workout payloads without breaking', async () => {
    const largeData: PDFData = {
      ...testPDFData,
      sessions: [
        { name: 'A', exercises: Array(40).fill({ name: 'Exercício A', sets: '4', reps: '12' }) },
        { name: 'B', exercises: Array(40).fill({ name: 'Exercício B', sets: '4', reps: '12' }) },
        { name: 'C', exercises: Array(40).fill({ name: 'Exercício C', sets: '4', reps: '12' }) },
      ],
    }

    await expectValidPdf(largeData, 5_000)
  })

  it('stays within a generous performance budget', async () => {
    const start = Date.now()
    await generateTrainingPDF(testPDFData)
    const durationMs = Date.now() - start

    expect(durationMs).toBeLessThan(5_000)
  })
})
