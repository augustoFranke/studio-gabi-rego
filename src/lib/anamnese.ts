const INVALID_ANAMNESE_ERROR = 'Dados inválidos'

export const ANAMNESE_FIELD_KEYS = [
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
] as const

type AnamneseField = (typeof ANAMNESE_FIELD_KEYS)[number]

export type CanonicalAnamneseData = Record<AnamneseField, string | null>

export const ANAMNESE_FIELDS = new Set<string>(ANAMNESE_FIELD_KEYS)

type AnamneseRecord = Record<string, unknown>

type SanitizeOptions = {
  ignoreUnknownFields?: boolean
  fillMissingFields?: boolean
}

function isRecord(value: unknown): value is AnamneseRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function createCanonicalAnamneseData() {
  return ANAMNESE_FIELD_KEYS.reduce<CanonicalAnamneseData>((acc, key) => {
    acc[key] = null
    return acc
  }, {} as CanonicalAnamneseData)
}

function normalizeValue(value: unknown): { value: string | null } | { error: true } {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return { value: trimmed === '' ? null : trimmed }
  }

  if (value === null || value === undefined) {
    return { value: null }
  }

  return { error: true }
}

export function sanitizeAnamnesePayload(payload: AnamneseRecord, options?: SanitizeOptions) {
  if (!isRecord(payload)) {
    return { error: INVALID_ANAMNESE_ERROR } as const
  }

  const ignoreUnknownFields = options?.ignoreUnknownFields ?? false
  const fillMissingFields = options?.fillMissingFields ?? false
  const data: Record<string, string | null> = fillMissingFields ? createCanonicalAnamneseData() : {}
  const ignoredKeys: string[] = []

  for (const [key, value] of Object.entries(payload)) {
    if (!ANAMNESE_FIELDS.has(key)) {
      if (ignoreUnknownFields) {
        ignoredKeys.push(key)
        continue
      }
      return { error: INVALID_ANAMNESE_ERROR } as const
    }

    const normalized = normalizeValue(value)
    if ('error' in normalized) {
      return { error: INVALID_ANAMNESE_ERROR } as const
    }

    data[key] = normalized.value
  }

  if (fillMissingFields) {
    for (const field of ANAMNESE_FIELD_KEYS) {
      if (!(field in data)) {
        data[field] = null
      }
    }
  }

  return { data, ignoredKeys } as const
}

export function normalizeAnamneseRecord(record: unknown) {
  if (record === null || record === undefined) {
    return { data: createCanonicalAnamneseData(), changed: false, ignoredKeys: [] } as const
  }

  if (!isRecord(record)) {
    return { error: INVALID_ANAMNESE_ERROR } as const
  }

  const data = createCanonicalAnamneseData()
  const ignoredKeys: string[] = []
  let changed = false

  for (const key of Object.keys(record)) {
    if (!ANAMNESE_FIELDS.has(key)) {
      ignoredKeys.push(key)
      changed = true
    }
  }

  for (const field of ANAMNESE_FIELD_KEYS) {
    const rawValue = record[field]
    const normalized = normalizeValue(rawValue)

    if ('error' in normalized) {
      return { error: INVALID_ANAMNESE_ERROR } as const
    }

    data[field] = normalized.value

    if (rawValue === undefined || normalized.value !== rawValue) {
      changed = true
    }
  }

  return { data, changed, ignoredKeys } as const
}

export function extractCanonicalAnamneseData(source: unknown) {
  if (!isRecord(source)) {
    return null
  }

  const data: Record<string, unknown> = {}
  for (const field of ANAMNESE_FIELD_KEYS) {
    data[field] = source[field] ?? null
  }

  return data
}
