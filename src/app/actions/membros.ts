'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logError, safeErrorData } from '@/lib/observability/logger'
import {
  MEMBRO_DEACTIVATE_FAILED,
  MEMBRO_STATUS_TOGGLE_FAILED,
} from '@/lib/observability/events'

export async function toggleMembroStatus(id: string, currentStatus: string) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized' }
    }

    const newStatus = currentStatus === 'ATIVO' ? 'INATIVO' : 'ATIVO'

    await prisma.membro.update({
      where: { id },
      data: { status: newStatus }
    })

    revalidatePath('/alunos')
    return { success: true, message: 'Status alterado com sucesso' }
  } catch (error) {
    logError(MEMBRO_STATUS_TOGGLE_FAILED, { membroId: id, ...safeErrorData(error) })
    return { success: false, message: 'Falha ao alterar status' }
  }
}

export async function deleteMembro(id: string) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized' }
    }

    await prisma.membro.update({
      where: { id },
      data: { status: 'INATIVO' },
    })

    revalidatePath('/alunos')
    return { success: true, message: 'Aluno inativado com sucesso' }
  } catch (error) {
    logError(MEMBRO_DEACTIVATE_FAILED, { membroId: id, action: 'deleteMembro', ...safeErrorData(error) })
    return { success: false, message: 'Falha ao inativar aluno' }
  }
}

export async function deactivateMembro(id: string) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return { success: false, message: 'Unauthorized' }
    }

    await prisma.membro.update({
      where: { id },
      data: { status: 'INATIVO' },
    })

    revalidatePath('/alunos')
    return { success: true, message: 'Aluno inativado com sucesso' }
  } catch (error) {
    logError(MEMBRO_DEACTIVATE_FAILED, { membroId: id, action: 'deactivateMembro', ...safeErrorData(error) })
    return { success: false, message: 'Falha ao desativar membro' }
  }
}
