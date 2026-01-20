import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/membros/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mocks
vi.mock('@/lib/prisma', () => ({
  prisma: {
    membro: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    usuario: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}))

vi.mock('@/lib/api', () => ({
  withApiAuth: vi.fn((handler) => handler({ user: { role: 'ADMIN' } })),
}))

vi.mock('bcryptjs', () => ({
  hash: vi.fn((pwd) => Promise.resolve(`hashed_${pwd}`)),
}))

vi.mock('@/lib/validators', () => ({
  validarCPF: vi.fn(() => true),
  validarEmail: vi.fn(() => true),
}))

describe('Membros API - POST /api/membros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/membros', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('should create a new member successfully', async () => {
    const validBody = {
      nome: 'John Doe',
      email: 'john@example.com',
      cpf: '123.456.789-00',
      senha: 'password123',
    }

    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null) // Email check
    vi.mocked(prisma.membro.findUnique).mockResolvedValue(null) // CPF check
    vi.mocked(prisma.usuario.create).mockResolvedValue({ id: 'user-123' } as any)
    vi.mocked(prisma.membro.create).mockResolvedValue({
      id: 'membro-123',
      usuarioId: 'user-123',
      status: 'ATIVO',
    } as any)

    const req = createRequest(validBody)
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(prisma.usuario.create).toHaveBeenCalled()
    expect(prisma.membro.create).toHaveBeenCalled()
    expect(json.id).toBe('membro-123')
  })

  it('should return error if email already exists', async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: 'existing' } as any)
    
    const req = createRequest({ email: 'exists@example.com' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('email já está cadastrado')
  })

  it('should return error if CPF already exists', async () => {
     vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null)
     vi.mocked(prisma.membro.findUnique).mockResolvedValue({ id: 'existing' } as any)

     const req = createRequest({ cpf: '123.456.789-00', email: 'new@example.com' })
     const res = await POST(req)
     const json = await res.json()

     expect(res.status).toBe(400)
     expect(json.error).toContain('CPF já está cadastrado')
  })
})