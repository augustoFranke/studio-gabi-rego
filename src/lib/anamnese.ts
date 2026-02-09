export const ANAMNESE_FIELDS = new Set([
  'altura',
  'pesoAtual',
  'objetivo',
  'praticaAtividade',
  'praticaAtividadeQual',
  'tempoSedentario',
  'condicaoMedica',
  'condicaoMedicaQual',
  'lesao',
  'lesaoQual',
  'restricaoMovimento',
  'restricaoMovimentoQual',
  'desconfortoMovimento',
  'desconfortoMovimentoQual',
  'problemasOrtopedicos',
  'problemasOrtopedicosQual',
  'medicamentoControlado',
  'medicamentoControladoQual',
  'obesoSobrepeso',
  'colesterolElevado',
  'taquicardia',
  'doencasCardiacas',
  'diabetes',
  'dificuldadeExercicio',
  'cicloMenstrual',
  'experienciaMusculacao',
  'ondeConheceu',
  'expectativas',
  'parq1',
  'parq2',
  'parq3',
  'parq4',
  'parq5',
  'parq6',
  'parq7',
])

export function sanitizeAnamnesePayload(payload: Record<string, unknown>) {
  const data: Record<string, string | null> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (!ANAMNESE_FIELDS.has(key)) {
      return { error: 'Dados inválidos' } as const
    }

    if (typeof value === 'string') {
      data[key] = value.trim() === '' ? null : value
      continue
    }

    if (value === null) {
      data[key] = null
      continue
    }

    return { error: 'Dados inválidos' } as const
  }

  return { data } as const
}
