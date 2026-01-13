import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api'

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

    // Determine gender based on name or other criteria
    // For now, we'll need to add a sexo field to the member or use other heuristics
    const sexo = determineSexo(membro)

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
    const body = await request.json()

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
        ...body,
      },
      update: body,
    })

    return NextResponse.json(anamnese)
  }, { requiredRole: 'ADMIN' })
}

// Helper function to determine gender
// This could be improved by adding a sexo field to the Membro model
function determineSexo(membro: any): "Masculino" | "Feminino" {
  const nome = membro.usuario.nome.toLowerCase()

  // Common female name endings in Portuguese
  const femaleEndings = ['a', 'e', 'ia', 'ana', 'ine', 'ene']
  const maleEndings = ['o', 'os', 'on', 'or', 'er', 'son']

  // Common female names
  const femaleNames = ['maria', 'ana', 'julia', 'gabriela', 'fernanda', 'amanda', 'bruna', 'camila', 'carla', 'claudia', 'cristina', 'daniela', 'elaine', 'fabiana', 'juliana', 'larissa', 'leticia', 'luciana', 'marcia', 'patricia', 'priscila', 'renata', 'sandra', 'tatiana', 'vanessa', 'adriana', 'aline', 'beatriz', 'bianca', 'carolina', 'debora', 'denise', 'eduarda', 'eliana', 'elisabete', 'flavia', 'franciele', 'gisele', 'helena', 'isabela', 'jessica', 'joana', 'jussara', 'karen', 'karina', 'lais', 'lilian', 'livia', 'luana', 'lucia', 'luciane', 'luiza', 'mara', 'marcela', 'mariana', 'marina', 'marta', 'michele', 'milena', 'monica', 'natalia', 'paula', 'rafaela', 'raquel', 'regina', 'roberta', 'rosana', 'sabrina', 'samantha', 'simone', 'solange', 'sonia', 'suzana', 'tais', 'thais', 'vera', 'vivian', 'viviane']

  const firstName = nome.split(' ')[0]

  if (femaleNames.includes(firstName)) {
    return "Feminino"
  }

  // Check name endings
  for (const ending of femaleEndings) {
    if (firstName.endsWith(ending) && !firstName.endsWith('o')) {
      return "Feminino"
    }
  }

  return "Masculino"
}
