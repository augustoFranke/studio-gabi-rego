import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { validarCPF, validarEmail } from '@/lib/validators'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'

type NormalizedRow = {
  nome?: string
  email?: string
  cpf?: string
  telefone?: string
  dataNascimento?: string
  planoId?: string
  planoNome?: string
  rg?: string
  endereco?: string
  senha?: string
  status?: string
}

type ImportError = { row: number; message: string }
type CreatedRow = { nome: string; email: string; cpf: string; senhaTemporaria?: string }

const HEADER_MAP: Record<string, keyof NormalizedRow> = {
  nome: 'nome',
  name: 'nome',
  fullname: 'nome',
  email: 'email',
  e_mail: 'email',
  cpf: 'cpf',
  documento: 'cpf',
  telefone: 'telefone',
  celular: 'telefone',
  phone: 'telefone',
  telefone1: 'telefone',
  data_nascimento: 'dataNascimento',
  data_de_nascimento: 'dataNascimento',
  birthdate: 'dataNascimento',
  nascimento: 'dataNascimento',
  data: 'dataNascimento',
  aniversario: 'dataNascimento',
  plano: 'planoNome',
  plano_nome: 'planoNome',
  planoid: 'planoId',
  plano_id: 'planoId',
  plano_codigo: 'planoId',
  rg: 'rg',
  endereco: 'endereco',
  endereco_completo: 'endereco',
  address: 'endereco',
  senha: 'senha',
  password: 'senha',
  status: 'status',
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function parseCSV(content: string): NormalizedRow[] {
  const cleaned = content.replace(/^\uFEFF/, '').trim()
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (!lines.length) {
    return []
  }

  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = splitCSVLine(lines[0], delimiter).map((header) => normalizeKey(header))

  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line, delimiter)
    const row: NormalizedRow = {}

    headers.forEach((header, index) => {
      const mappedKey = HEADER_MAP[header]
      if (mappedKey) {
        row[mappedKey] = values[index]?.trim()
      }
    })

    return row
  })
}

function parseDate(value?: string): Date | null {
  if (!value) return null

  const raw = value.trim()
  if (!raw) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const date = new Date(raw)
    return isNaN(date.getTime()) ? null : date
  }

  const numeric = raw.replace(/[^0-9/ -]/g, '')

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(numeric) || /^\d{2}-\d{2}-\d{4}$/.test(numeric)) {
    const parts = numeric.includes('/') ? numeric.split('/') : numeric.split('-')
    const [day, month, year] = parts.map((part) => parseInt(part, 10))
    const date = new Date(year, month - 1, day)
    return isNaN(date.getTime()) ? null : date
  }

  const fallback = new Date(raw)
  return isNaN(fallback.getTime()) ? null : fallback
}

function generatePassword(): string {
  return randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
}

function normalizeStatus(status?: string): 'ATIVO' | 'INATIVO' | 'PENDENTE' {
  const normalized = status?.trim().toUpperCase()
  if (normalized === 'INATIVO' || normalized === 'PENDENTE') {
    return normalized
  }
  return 'ATIVO'
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Envie um arquivo CSV válido.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const content = buffer.toString('utf-8')
  const rows = parseCSV(content)

  if (!rows.length) {
    return NextResponse.json({ error: 'O arquivo CSV está vazio ou sem linhas válidas.' }, { status: 400 })
  }

  const planos = await prisma.plano.findMany()
  const planoById = new Map(planos.map((plano) => [plano.id, plano]))
  const planoByName = new Map(planos.map((plano) => [plano.nome.toLowerCase(), plano]))

  const errors: ImportError[] = []
  const created: CreatedRow[] = []
  let skippedCount = 0

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const rowNumber = index + 2 // +1 for zero-index, +1 for header line

    const nome = row.nome?.trim()
    const email = row.email?.trim()
    const cpfRaw = row.cpf?.replace(/\D/g, '')
    const telefoneRaw = row.telefone?.replace(/\D/g, '')
    const dataNascimento = parseDate(row.dataNascimento)
    const planoNome = row.planoNome?.trim()
    const planoIdRaw = row.planoId?.trim()
    const rg = row.rg?.trim()
    const endereco = row.endereco?.trim()

    const missingFields: string[] = []
    if (!nome) missingFields.push('nome')
    if (!email) missingFields.push('email')
    if (!cpfRaw) missingFields.push('cpf')
    if (!telefoneRaw) missingFields.push('telefone')
    if (!row.dataNascimento) missingFields.push('data_nascimento')

    if (missingFields.length) {
      errors.push({ row: rowNumber, message: `Campos obrigatórios ausentes: ${missingFields.join(', ')}` })
      skippedCount++
      continue
    }

    if (!validarEmail(email!)) {
      errors.push({ row: rowNumber, message: 'Email inválido' })
      skippedCount++
      continue
    }

    if (!validarCPF(cpfRaw!)) {
      errors.push({ row: rowNumber, message: 'CPF inválido' })
      skippedCount++
      continue
    }

    if (!dataNascimento) {
      errors.push({ row: rowNumber, message: 'Data de nascimento inválida' })
      skippedCount++
      continue
    }

    if (!telefoneRaw || telefoneRaw.length < 10) {
      errors.push({ row: rowNumber, message: 'Telefone incompleto' })
      skippedCount++
      continue
    }

    const membroExistente = await prisma.membro.findUnique({ where: { cpf: cpfRaw } })
    if (membroExistente) {
      errors.push({ row: rowNumber, message: 'CPF já cadastrado' })
      skippedCount++
      continue
    }

    const emailExistente = await prisma.usuario.findUnique({ where: { email } })
    if (emailExistente) {
      errors.push({ row: rowNumber, message: 'Email já cadastrado' })
      skippedCount++
      continue
    }

    let planoId: string | undefined
    if (planoIdRaw && planoById.has(planoIdRaw)) {
      planoId = planoIdRaw
    } else if (planoNome) {
      const matched = planoByName.get(planoNome.toLowerCase())
      if (matched) {
        planoId = matched.id
      }
    }

    const senhaTemporaria = row.senha?.trim() || generatePassword()
    const senhaHash = await hash(senhaTemporaria, 12)
    const status = normalizeStatus(row.status)

    try {
      await prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
          data: {
            nome: nome!,
            email: email!,
            senha: senhaHash,
            role: 'MEMBRO',
          },
        })

        await tx.membro.create({
          data: {
            usuarioId: usuario.id,
            cpf: cpfRaw!,
            rg,
            telefone: telefoneRaw!,
            dataNascimento,
            endereco,
            planoId,
            status,
          },
        })
      })

      created.push({ nome: nome!, email: email!, cpf: cpfRaw!, senhaTemporaria: row.senha?.trim() ? undefined : senhaTemporaria })
    } catch (error) {
      console.error('Erro ao importar membro', error)
      errors.push({ row: rowNumber, message: 'Erro interno ao salvar o membro' })
      skippedCount++
    }
  }

  return NextResponse.json({
    createdCount: created.length,
    skippedCount,
    errors,
    created,
  })
}

