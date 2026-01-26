'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function toggleMembroStatus(id: string, currentStatus: string) {
  try {
    const newStatus = currentStatus === 'ATIVO' ? 'INATIVO' : 'ATIVO'

    await prisma.membro.update({
      where: { id },
      data: { status: newStatus }
    })

    revalidatePath('/membros')
    return { success: true }
  } catch (error) {
    console.error('Erro ao alterar status do membro:', error)
    return { success: false, error: 'Falha ao alterar status' }
  }
}

export async function deleteMembro(id: string) {
  try {
    const membro = await prisma.membro.findUnique({
      where: { id },
      select: { usuarioId: true }
    })

    if (!membro) {
      return { success: false, error: 'Membro não encontrado' }
    }

    // Delete the Usuario - this cascades to delete Membro and all related data
    await prisma.usuario.delete({
      where: { id: membro.usuarioId }
    })

    revalidatePath('/membros')
    return { success: true }
  } catch (error) {
    console.error('Erro ao excluir membro:', error)
    return { success: false, error: 'Falha ao excluir membro' }
  }
}
