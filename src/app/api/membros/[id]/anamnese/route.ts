import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'

const ANAMNESE_FIELDS = new Set([
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

function sanitizeAnamnesePayload(payload: Record<string, unknown>) {
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

interface Params {
  params: Promise<{
    id: string
  }>
}

// GET /api/membros/[id]/anamnese - Obter anamnese do membro
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  return withApiAuth(async () => {
    const { id } = await params

    const membro = await prisma.membro.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            nome: true,
          },
        },
        anamnese: true,
      },
    })

    if (!membro) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }

    // Use actual sexo field from database, fall back to heuristic if not set
    const sexo = membro.sexo
      ? (membro.sexo === 'FEMININO' ? 'Feminino' : 'Masculino')
      : determineSexo(membro)

    return NextResponse.json({
      member: {
        id: membro.id,
        nome: membro.usuario.nome,
        sexo,
      },
      anamnese: membro.anamnese,
    })
  }, { requiredRole: 'ADMIN' })
}

// POST /api/membros/[id]/anamnese - Salvar anamnese do membro
export async function POST(
  request: NextRequest,
  { params }: Params
) {
  return withApiAuth(async () => {
    const { id } = await params
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const sanitized = sanitizeAnamnesePayload(body as Record<string, unknown>)
    if ('error' in sanitized || Object.keys(sanitized.data).length === 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const membro = await prisma.membro.findUnique({
      where: { id },
    })

    if (!membro) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }

    // Upsert anamnese
    const anamnese = await prisma.anamnese.upsert({
      where: { membroId: id },
      create: {
        membroId: id,
        ...sanitized.data,
      },
      update: sanitized.data,
    })

    return NextResponse.json(anamnese)
  }, { requiredRole: 'ADMIN' })
}

// Module-level Set for O(1) lookups instead of O(n) array.includes()
const FEMALE_NAMES = new Set([
  'maria', 'ana', 'julia', 'gabriela', 'fernanda', 'amanda', 'bruna', 'camila', 'carla', 'claudia', 'cristina',
  'daniela', 'elaine', 'fabiana', 'juliana', 'larissa', 'leticia', 'luciana', 'marcia', 'patricia', 'priscila',
  'renata', 'sandra', 'tatiana', 'vanessa', 'adriana', 'aline', 'beatriz', 'bianca', 'carolina', 'debora',
  'denise', 'eduarda', 'eliana', 'elisabete', 'flavia', 'franciele', 'gisele', 'helena', 'isabela', 'jessica',
  'joana', 'jussara', 'karen', 'karina', 'lais', 'lilian', 'livia', 'luana', 'lucia', 'luciane', 'luiza',
  'mara', 'marcela', 'mariana', 'marina', 'marta', 'michele', 'milena', 'monica', 'natalia', 'paula',
  'rafaela', 'raquel', 'regina', 'roberta', 'rosana', 'sabrina', 'samantha', 'simone', 'solange', 'sonia',
  'suzana', 'tais', 'thais', 'vera', 'vivian', 'viviane',
])

const FEMALE_ENDINGS = ['a', 'e', 'ia', 'ana', 'ine', 'ene']

// Helper function to determine gender
// Fallback heuristic when sexo is not set.
function determineSexo(membro: { usuario: { nome: string | null } }): "Masculino" | "Feminino" {
  const nome = membro.usuario.nome?.toLowerCase().trim()

  if (!nome) {
    return "Masculino"
  }

  const firstName = nome.split(' ')[0]

  if (FEMALE_NAMES.has(firstName)) {
    return "Feminino"
  }

  // Check name endings
  for (const ending of FEMALE_ENDINGS) {
    if (firstName.endsWith(ending) && !firstName.endsWith('o')) {
      return "Feminino"
    }
  }

  return "Masculino"
}
