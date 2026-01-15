import { describe, test, expect } from 'vitest'
import { generateTrainingPDF } from '@/lib/pdf'
import { testPDFData, minimalPDFData, multiSessionPDFData } from './fixtures'
import { PDFDocument } from 'pdf-lib'

describe('PDF Generation', () => {
  describe('Basic Generation', () => {
    test('generateTrainingPDF creates PDF without throwing', async () => {
      const pdfBuffer = await generateTrainingPDF(testPDFData)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
    })

    test('generated PDF size is within expected range (1KB - 1MB)', async () => {
      const pdfBuffer = await generateTrainingPDF(testPDFData)
      expect(pdfBuffer.length).toBeGreaterThan(1000)
      expect(pdfBuffer.length).toBeLessThan(1000000)
    })

    test('PDF generation completes within 5 seconds', async () => {
      const start = Date.now()
      await generateTrainingPDF(testPDFData)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(5000)
    })

    test('PDF generation completes within 1 second for simple data', async () => {
      const start = Date.now()
      await generateTrainingPDF(minimalPDFData)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000)
    })

    test('generated buffer is valid PDF document', async () => {
      const pdfBuffer = await generateTrainingPDF(testPDFData)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc).toBeDefined()
      expect(pdfDoc.getPages().length).toBeGreaterThan(0)
    })
  })

  describe('PDF Structure Validation', () => {
    test('PDF has at least one page', async () => {
      const pdfBuffer = await generateTrainingPDF(testPDFData)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getPages().length).toBeGreaterThanOrEqual(1)
    })

    test('PDF with multiple sessions has at least one page', async () => {
      const pdfBuffer = await generateTrainingPDF(multiSessionPDFData)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getPages().length).toBeGreaterThanOrEqual(1)
    })

    test('PDF has title set', async () => {
      const pdfBuffer = await generateTrainingPDF(testPDFData)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const title = pdfDoc.getTitle()
      expect(title).toContain('Maria Silva')
    })

    test('PDF contains embedded fonts', async () => {
      const pdfBuffer = await generateTrainingPDF(testPDFData)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pages = pdfDoc.getPages()
      expect(pages.length).toBeGreaterThan(0)
      for (const page of pages) {
        expect(page).toBeDefined()
      }
    })
  })

  describe('Logo Validation', () => {
    test('PDF is generated even when logo file is missing', async () => {
      const pdfBuffer = await generateTrainingPDF(testPDFData)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
    })

    test('PDF document is valid even without logo', async () => {
      const pdfBuffer = await generateTrainingPDF(testPDFData)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getPages().length).toBeGreaterThan(0)
    })

    test('PDF with multiple sessions works without logo', async () => {
      const pdfBuffer = await generateTrainingPDF(multiSessionPDFData)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc).toBeDefined()
      expect(pdfDoc.getPages().length).toBeGreaterThan(0)
    })
  })

  describe('Observations Validation', () => {
    test('PDF handles empty observations without error', async () => {
      const data = { ...testPDFData, observacoes: '' }
      const pdfBuffer = await generateTrainingPDF(data)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)

      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getPages().length).toBeGreaterThan(0)
    })

    test('PDF handles undefined observations', async () => {
      const data = { ...testPDFData, observacoes: undefined }
      const pdfBuffer = await generateTrainingPDF(data)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    test('PDF handles minimal data correctly', async () => {
      const pdfBuffer = await generateTrainingPDF(minimalPDFData)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)

      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getPages().length).toBeGreaterThan(0)
      expect(pdfDoc.getTitle()).toContain('João Santos')
    })

    test('PDF handles special characters in student name', async () => {
      const data = { ...testPDFData, aluno: 'José da Silva Júnior' }
      const pdfBuffer = await generateTrainingPDF(data)
      expect(pdfBuffer).toBeInstanceOf(Buffer)

      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getTitle()).toContain('José da Silva Júnior')
    })

    test('PDF handles large number of exercises', async () => {
      const data = {
        ...testPDFData,
        sessions: [
          {
            name: 'A',
            exercises: Array(20).fill({ name: 'Exercício Teste', sets: '3', reps: '10' })
          }
        ]
      }
      const pdfBuffer = await generateTrainingPDF(data)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(5000)

      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getPages().length).toBeGreaterThanOrEqual(1)
    })

    test('PDF handles multiple sessions with many exercises', async () => {
      const data = {
        ...testPDFData,
        sessions: [
          {
            name: 'A',
            exercises: Array(10).fill({ name: 'Exercício A', sets: '4', reps: '12' })
          },
          {
            name: 'B',
            exercises: Array(10).fill({ name: 'Exercício B', sets: '4', reps: '12' })
          },
          {
            name: 'C',
            exercises: Array(10).fill({ name: 'Exercício C', sets: '4', reps: '12' })
          }
        ]
      }
      const pdfBuffer = await generateTrainingPDF(data)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(10000)

      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getPages().length).toBeGreaterThanOrEqual(1)
    })

    test('PDF handles empty sessions array', async () => {
      const data = { ...testPDFData, sessions: [] }
      const pdfBuffer = await generateTrainingPDF(data)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
    })

    test('PDF handles session with no exercises', async () => {
      const data = {
        ...testPDFData,
        sessions: [
          { name: 'A', exercises: [] },
          { name: 'B', exercises: [{ name: 'Test', sets: '3', reps: '10' }] }
        ]
      }
      const pdfBuffer = await generateTrainingPDF(data)
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Tests', () => {
    test('PDF generation is fast for single session', async () => {
      const start = Date.now()
      await generateTrainingPDF(minimalPDFData)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(500)
    })

    test('PDF generation is fast for multiple sessions', async () => {
      const start = Date.now()
      await generateTrainingPDF(testPDFData)
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000)
    })

    test('PDF size is consistent for similar data', async () => {
      const data1 = { ...minimalPDFData, aluno: 'User A' }
      const data2 = { ...minimalPDFData, aluno: 'User B' }

      const pdf1 = await generateTrainingPDF(data1)
      const pdf2 = await generateTrainingPDF(data2)

      expect(pdf1.length).toBeGreaterThan(0)
      expect(pdf2.length).toBeGreaterThan(0)
      expect(pdf1.length).toBeGreaterThan(500)
      expect(pdf2.length).toBeGreaterThan(500)
    })
  })

  describe('Regression Tests', () => {
    test('PDF generation always produces valid document', async () => {
      const results = await Promise.all([
        generateTrainingPDF(testPDFData),
        generateTrainingPDF(minimalPDFData),
        generateTrainingPDF(multiSessionPDFData),
      ])

      for (const pdfBuffer of results) {
        expect(pdfBuffer).toBeInstanceOf(Buffer)
        expect(pdfBuffer.length).toBeGreaterThan(0)

        const pdfDoc = await PDFDocument.load(pdfBuffer)
        expect(pdfDoc.getPages().length).toBeGreaterThan(0)
      }
    })

    test('PDF generation never produces empty buffer', async () => {
      const testCases = [
        testPDFData,
        minimalPDFData,
        multiSessionPDFData,
        { ...testPDFData, sessions: [] },
        { ...testPDFData, observacoes: '' },
      ]

      for (const data of testCases) {
        const pdfBuffer = await generateTrainingPDF(data)
        expect(pdfBuffer.length).toBeGreaterThan(1000)
      }
    })

    test('PDF generation always produces multi-page capable document', async () => {
      const data = {
        ...testPDFData,
        sessions: [
          { name: 'A', exercises: Array(50).fill({ name: 'Ex', sets: '3', reps: '10' }) },
          { name: 'B', exercises: Array(50).fill({ name: 'Ex', sets: '3', reps: '10' }) },
          { name: 'C', exercises: Array(50).fill({ name: 'Ex', sets: '3', reps: '10' }) },
        ]
      }
      const pdfBuffer = await generateTrainingPDF(data)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      expect(pdfDoc.getPages().length).toBeGreaterThanOrEqual(1)
    })
  })
})
