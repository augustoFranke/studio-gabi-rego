export interface Exercise {
  name: string
  sets: string
  reps: string
}

export interface Session {
  name: string
  exercises: Exercise[]
}

export interface PDFData {
  aluno: string
  date: string
  observacoes?: string
  sessions: Session[]
}

export const testPDFData: PDFData = {
  aluno: 'Maria Silva',
  date: '01/2026',
  observacoes: 'Focar em postura durante agachamentos',
  sessions: [
    {
      name: 'A',
      exercises: [
        { name: 'Supino Reto', sets: '4', reps: '12' },
        { name: 'Agachamento', sets: '4', reps: '10' },
        { name: 'Puxada', sets: '3', reps: '10' }
      ]
    },
    {
      name: 'B',
      exercises: [
        { name: 'Leg Press', sets: '4', reps: '12' },
        { name: 'Rosca Direta', sets: '3', reps: '12' }
      ]
    }
  ]
}

export const minimalPDFData: PDFData = {
  aluno: 'João Santos',
  date: '02/2026',
  sessions: [
    {
      name: 'A',
      exercises: [
        { name: 'Flexão', sets: '3', reps: '15' }
      ]
    }
  ]
}

export const multiSessionPDFData: PDFData = {
  aluno: 'Carlos Oliveira',
  date: '03/2026',
  observacoes: '',
  sessions: [
    {
      name: 'A',
      exercises: [
        { name: 'Barra Fixa', sets: '4', reps: '8' },
        { name: 'Supino', sets: '4', reps: '10' },
        { name: 'Agachamento', sets: '4', reps: '8' },
        { name: 'Abdômen', sets: '3', reps: '20' }
      ]
    },
    {
      name: 'B',
      exercises: [
        { name: 'Leg Press', sets: '4', reps: '12' },
        { name: 'Cadeira Extensora', sets: '3', reps: '12' },
        { name: 'Rosca', sets: '3', reps: '12' }
      ]
    },
    {
      name: 'C',
      exercises: [
        { name: 'Corrida', sets: '1', reps: '20 min' },
        { name: 'Abdominal', sets: '3', reps: '25' }
      ]
    }
  ]
}
