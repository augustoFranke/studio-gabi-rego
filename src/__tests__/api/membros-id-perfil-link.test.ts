import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/membros/[id]/perfil-link/route'

const { sessionRef, withApiAuthMock, createPerfilTokenForMembroMock } = vi.hoisted(() => {
  const { createSessionRef, mockWithApiAuth } = globalThis.__testUtils
  const sessionRef = createSessionRef({ user: { role: 'ADMIN' } })
  return {
    sessionRef,
    withApiAuthMock: mockWithApiAuth(sessionRef).withApiAuth,
    createPerfilTokenForMembroMock: vi.fn(),
  }
})

vi.mock('@/lib/api', () => ({
  withApiAuth: withApiAuthMock,
}))

vi.mock('@/services/perfil.service', () => ({
  createPerfilTokenForMembro: createPerfilTokenForMembroMock,
}))

describe('Membros Perfil Link API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.current = { user: { role: 'ADMIN' } }
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('returns 404 when membro not found', async () => {
    createPerfilTokenForMembroMock.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost:3000/api/membros/m-1/perfil-link', {
      method: 'POST',
    })
    const res = await POST(req, params('m-1'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toContain('Membro não encontrado')
  })

  it('generates a profile link and stores token', async () => {
    createPerfilTokenForMembroMock.mockResolvedValueOnce({
      token: 'token-abc',
      tokenExpiry: new Date('2026-04-02T12:00:00Z'),
    })

    const req = new NextRequest('http://localhost:3000/api/membros/m-1/perfil-link', {
      method: 'POST',
    })
    const res = await POST(req, params('m-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(createPerfilTokenForMembroMock).toHaveBeenCalledWith('m-1')
    expect(json.link).toContain('/completar-perfil?token=token-abc')
    expect(json.expiresAt).toBeTruthy()
  })
})
