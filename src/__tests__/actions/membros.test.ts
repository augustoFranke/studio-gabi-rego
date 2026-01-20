import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toggleMembroStatus, deleteMembro, enviarLembreteBoasVindas } from '@/app/actions/membros'
import { prisma } from '@/lib/prisma'

// Mocks
vi.mock('@/lib/prisma', () => ({
  prisma: {
    membro: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    usuario: {
      delete: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/evolution', () => ({
  enviarMensagemWhatsApp: vi.fn(),
  templates: {
    boasVindas: (nome: string) => `Olá ${nome}`,
  },
}))

describe('Membros Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('toggleMembroStatus', () => {
    it('should toggle status from ATIVO to INATIVO', async () => {
      const mockId = '123'
      const currentStatus = 'ATIVO'

      const result = await toggleMembroStatus(mockId, currentStatus)

      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: mockId },
        data: { status: 'INATIVO' },
      })
      expect(result).toEqual({ success: true })
    })

    it('should toggle status from INATIVO to ATIVO', async () => {
      const mockId = '123'
      const currentStatus = 'INATIVO'

      const result = await toggleMembroStatus(mockId, currentStatus)

      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: mockId },
        data: { status: 'ATIVO' },
      })
      expect(result).toEqual({ success: true })
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(prisma.membro.update).mockRejectedValueOnce(new Error('DB Error'))
      const result = await toggleMembroStatus('123', 'ATIVO')
      expect(result).toEqual({ success: false, error: 'Falha ao alterar status' })
      consoleSpy.mockRestore()
    })
  })

  describe('deleteMembro', () => {
    it('should delete usuario associated with membro', async () => {
      const mockMembroId = 'membro-123'
      const mockUsuarioId = 'user-123'

      vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce({
        usuarioId: mockUsuarioId,
      } as any)

      const result = await deleteMembro(mockMembroId)

      expect(prisma.membro.findUnique).toHaveBeenCalledWith({
        where: { id: mockMembroId },
        select: { usuarioId: true },
      })
      expect(prisma.usuario.delete).toHaveBeenCalledWith({
        where: { id: mockUsuarioId },
      })
      expect(result).toEqual({ success: true })
    })

    it('should return error if membro not found', async () => {
      vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce(null)
      const result = await deleteMembro('non-existent')
      expect(result).toEqual({ success: false, error: 'Membro não encontrado' })
    })

    it('should handle db errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.mocked(prisma.membro.findUnique).mockRejectedValueOnce(new Error('DB Error'))
        const result = await deleteMembro('123')
        expect(result).toEqual({ success: false, error: 'Falha ao excluir membro' })
        consoleSpy.mockRestore()
    })
  })
})
