'use server'

import { prisma } from '@/lib/prisma'
import { requireAdminAction } from '@/lib/security/server-action-auth'
import { revalidatePath } from 'next/cache'

export async function toggleMembroStatus(id: string, currentStatus: string) {
  try {
    const authz = await requireAdminAction({ action: 'toggleMembroStatus', resourceId: id })
    if (!authz.allowed) {
      return { success: false, message: authz.message }
    }

    const newStatus = currentStatus === 'ATIVO' ? 'INATIVO' : 'ATIVO'

    await prisma.membro.update({
      where: { id },
      data: { status: newStatus }
    })

    revalidatePath('/membros')
    return { success: true, message: 'Status alterado com sucesso' }
  } catch (error) {
    console.error('Erro ao alterar status do membro:', error)
    return { success: false, message: 'Falha ao alterar status' }
  }
}

export async function deleteMembro(id: string) {
  try {
    const authz = await requireAdminAction({ action: 'deleteMembro', resourceId: id })
    if (!authz.allowed) {
      return { success: false, message: authz.message }
    }

    const membro = await prisma.membro.findUnique({
      where: { id },
      select: { usuarioId: true }
    })

    if (!membro) {
      return { success: false, message: 'Membro não encontrado' }
    }

    // Delete the Usuario - this cascades to delete Membro and all related data
    await prisma.usuario.delete({
      where: { id: membro.usuarioId }
    })

    revalidatePath('/membros')
    return { success: true, message: 'Membro excluído com sucesso' }
  } catch (error) {
    console.error('Erro ao excluir membro:', error)
    return { success: false, message: 'Falha ao excluir membro' }
  }
}

export async function deactivateMembro(id: string) {
  try {
    const authz = await requireAdminAction({ action: 'deactivateMembro', resourceId: id })
    if (!authz.allowed) {
      return { success: false, message: authz.message }
    }

    await prisma.membro.update({
      where: { id },
      data: { status: 'PENDENTE' },
    })

    revalidatePath('/alunos')
    return { success: true, message: 'Membro desativado com sucesso' }
  } catch (error) {
    console.error('Erro ao desativar membro:', error)
    return { success: false, message: 'Falha ao desativar membro' }
  }
}
