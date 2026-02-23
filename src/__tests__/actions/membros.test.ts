import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toggleMembroStatus, deleteMembro, deactivateMembro } from '@/app/actions/membros'
import { prisma } from '@/lib/prisma'
import type { Membro } from '@prisma/client'
import { auth } from '@/lib/auth'

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

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Membros Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    } as Awaited<ReturnType<typeof auth>>)
  })

  describe('toggleMembroStatus', () => {
    it('should toggle status from ATIVO to INATIVO', async () => {
      const { revalidatePath } = await import('next/cache')
      const mockId = '123'
      const currentStatus = 'ATIVO'

      const result = await toggleMembroStatus(mockId, currentStatus)

      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: mockId },
        data: { status: 'INATIVO' },
      })
      expect(revalidatePath).toHaveBeenCalledWith('/alunos')
      expect(result).toEqual({ success: true, message: 'Status alterado com sucesso' })
    })

    it('should toggle status from INATIVO to ATIVO', async () => {
      const { revalidatePath } = await import('next/cache')
      const mockId = '123'
      const currentStatus = 'INATIVO'

      const result = await toggleMembroStatus(mockId, currentStatus)

      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: mockId },
        data: { status: 'ATIVO' },
      })
      expect(revalidatePath).toHaveBeenCalledWith('/alunos')
      expect(result).toEqual({ success: true, message: 'Status alterado com sucesso' })
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(prisma.membro.update).mockRejectedValueOnce(new Error('DB Error'))
      const result = await toggleMembroStatus('123', 'ATIVO')
      expect(result).toEqual({ success: false, message: 'Falha ao alterar status' })
      consoleSpy.mockRestore()
    })

    it('should reject non-admin users with generic unauthorized message', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'membro-1', role: 'MEMBRO' },
      } as Awaited<ReturnType<typeof auth>>)

      const result = await toggleMembroStatus('123', 'ATIVO')

      expect(result).toEqual({ success: false, message: 'Unauthorized' })
      expect(prisma.membro.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteMembro', () => {
    it('should delete usuario associated with membro', async () => {
      const { revalidatePath } = await import('next/cache')
      const mockMembroId = 'membro-123'
      const mockUsuarioId = 'user-123'

      vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce({
        usuarioId: mockUsuarioId,
      } as Pick<Membro, 'usuarioId'>)

      const result = await deleteMembro(mockMembroId)

      expect(prisma.membro.findUnique).toHaveBeenCalledWith({
        where: { id: mockMembroId },
        select: { usuarioId: true },
      })
      expect(prisma.usuario.delete).toHaveBeenCalledWith({
        where: { id: mockUsuarioId },
      })
      expect(revalidatePath).toHaveBeenCalledWith('/alunos')
      expect(result).toEqual({ success: true, message: 'Membro excluído com sucesso' })
    })

    it('should return error if membro not found', async () => {
      vi.mocked(prisma.membro.findUnique).mockResolvedValueOnce(null)
      const result = await deleteMembro('non-existent')
      expect(result).toEqual({ success: false, message: 'Membro não encontrado' })
    })

    it('should handle db errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.mocked(prisma.membro.findUnique).mockRejectedValueOnce(new Error('DB Error'))
        const result = await deleteMembro('123')
        expect(result).toEqual({ success: false, message: 'Falha ao excluir membro' })
        consoleSpy.mockRestore()
    })

    it('should reject missing session with generic unauthorized message', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      const result = await deleteMembro('123')

      expect(result).toEqual({ success: false, message: 'Unauthorized' })
      expect(prisma.membro.findUnique).not.toHaveBeenCalled()
      expect(prisma.usuario.delete).not.toHaveBeenCalled()
    })
  })

  describe('deactivateMembro', () => {
    it('should set status to PENDENTE and revalidate /alunos', async () => {
      const { revalidatePath } = await import('next/cache')

      const result = await deactivateMembro('m-1')

      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: 'PENDENTE' },
      })
      expect(revalidatePath).toHaveBeenCalledWith('/alunos')
      expect(result).toEqual({ success: true, message: 'Membro desativado com sucesso' })
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(prisma.membro.update).mockRejectedValueOnce(new Error('DB Error'))

      const result = await deactivateMembro('m-1')

      expect(result).toEqual({ success: false, message: 'Falha ao desativar membro' })
      consoleSpy.mockRestore()
    })

    it('should reject non-admin users with generic unauthorized message', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'membro-1', role: 'MEMBRO' },
      } as Awaited<ReturnType<typeof auth>>)

      const result = await deactivateMembro('m-1')

      expect(result).toEqual({ success: false, message: 'Unauthorized' })
      expect(prisma.membro.update).not.toHaveBeenCalled()
    })
  })
})
