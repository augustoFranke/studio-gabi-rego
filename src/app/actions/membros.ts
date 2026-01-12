'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { enviarMensagemWhatsApp, templates } from '@/lib/evolution'

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

export async function enviarLembreteBoasVindas(id: string) {
  try {
    const membro = await prisma.membro.findUnique({
      where: { id },
      include: { usuario: true }
    })

    if (!membro) return { error: 'Membro não encontrado' }

    const result = await enviarMensagemWhatsApp({
      telefone: membro.telefone,
      mensagem: templates.boasVindas(membro.usuario.nome)
    })

    if (result.success) {
      return { success: true }
    } else {
      return { error: result.error || 'Erro ao enviar WhatsApp' }
    }
  } catch (error) {
    console.error('Erro ao enviar lembrete:', error)
    return { error: 'Falha ao enviar lembrete' }
  }
}

