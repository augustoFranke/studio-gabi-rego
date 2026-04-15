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

export type AnamneseField = (typeof ANAMNESE_FIELD_KEYS)[number]

export type CanonicalAnamneseData = Record<AnamneseField, string | null>
export type AnamneseFormData = Partial<Record<AnamneseField, string>>

export const ANAMNESE_FIELDS = new Set<string>(ANAMNESE_FIELD_KEYS)

type SanitizeOptions = {
  ignoreUnknownFields?: boolean
  fillMissingFields?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isAnamneseField(key: string): key is AnamneseField {
  return ANAMNESE_FIELDS.has(key)
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

export type SanitizedAnamnesePayload =
  | { data: Partial<CanonicalAnamneseData>; ignoredKeys: string[] }
  | { error: typeof INVALID_ANAMNESE_ERROR }

export function sanitizeAnamnesePayload(
  payload: unknown,
  options?: SanitizeOptions
): SanitizedAnamnesePayload {
  if (!isRecord(payload)) {
    return { error: INVALID_ANAMNESE_ERROR }
  }

  const ignoreUnknownFields = options?.ignoreUnknownFields ?? false
  const fillMissingFields = options?.fillMissingFields ?? false
  const data: Partial<CanonicalAnamneseData> = fillMissingFields ? createCanonicalAnamneseData() : {}
  const ignoredKeys: string[] = []

  for (const [key, value] of Object.entries(payload)) {
    if (!isAnamneseField(key)) {
      if (ignoreUnknownFields) {
        ignoredKeys.push(key)
        continue
      }
      return { error: INVALID_ANAMNESE_ERROR }
    }

    const normalized = normalizeValue(value)
    if ('error' in normalized) {
      return { error: INVALID_ANAMNESE_ERROR }
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

  return { data, ignoredKeys }
}

export type NormalizedAnamneseRecord =
  | { data: CanonicalAnamneseData; changed: boolean; ignoredKeys: string[] }
  | { error: typeof INVALID_ANAMNESE_ERROR }

export function normalizeAnamneseRecord(record: unknown): NormalizedAnamneseRecord {
  if (record === null || record === undefined) {
    return { data: createCanonicalAnamneseData(), changed: false, ignoredKeys: [] }
  }

  if (!isRecord(record)) {
    return { error: INVALID_ANAMNESE_ERROR }
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
      return { error: INVALID_ANAMNESE_ERROR }
    }

    data[field] = normalized.value

    if (rawValue === undefined || normalized.value !== rawValue) {
      changed = true
    }
  }

  return { data, changed, ignoredKeys }
}

export function extractCanonicalAnamneseData(source: unknown): CanonicalAnamneseData | null {
  if (!isRecord(source)) {
    return null
  }

  const data = createCanonicalAnamneseData()
  for (const field of ANAMNESE_FIELD_KEYS) {
    const value = source[field]
    data[field] = typeof value === 'string' ? value : null
  }

  return data
}
