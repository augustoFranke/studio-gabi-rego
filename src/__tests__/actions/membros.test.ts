import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toggleMembroStatus, deleteMembro, deactivateMembro } from '@/app/actions/membros'
import { prisma } from '@/lib/prisma'
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
    it('should inactivate member without deleting associated usuario', async () => {
      const { revalidatePath } = await import('next/cache')
      const mockMembroId = 'membro-123'

      const result = await deleteMembro(mockMembroId)

      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: mockMembroId },
        data: { status: 'INATIVO' },
      })
      expect(prisma.usuario.delete).not.toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith('/alunos')
      expect(result).toEqual({ success: true, message: 'Aluno inativado com sucesso' })
    })

    it('should handle db errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.mocked(prisma.membro.update).mockRejectedValueOnce(new Error('DB Error'))
        const result = await deleteMembro('123')
        expect(result).toEqual({ success: false, message: 'Falha ao inativar aluno' })
        consoleSpy.mockRestore()
    })

    it('should reject missing session with generic unauthorized message', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      const result = await deleteMembro('123')

      expect(result).toEqual({ success: false, message: 'Unauthorized' })
      expect(prisma.membro.findUnique).not.toHaveBeenCalled()
      expect(prisma.membro.update).not.toHaveBeenCalled()
      expect(prisma.usuario.delete).not.toHaveBeenCalled()
    })
  })

  describe('deactivateMembro', () => {
    it('should set status to INATIVO and revalidate /alunos', async () => {
      const { revalidatePath } = await import('next/cache')

      const result = await deactivateMembro('m-1')

      expect(prisma.membro.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { status: 'INATIVO' },
      })
      expect(revalidatePath).toHaveBeenCalledWith('/alunos')
      expect(result).toEqual({ success: true, message: 'Aluno inativado com sucesso' })
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
