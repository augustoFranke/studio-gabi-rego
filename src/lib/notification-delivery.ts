import { prisma } from '@/lib/prisma'
import { Prisma, StatusEntregaNotificacao } from '@prisma/client'

const deliverySelect = {
  id: true,
  enviada: true,
  statusEntrega: true,
  tentativasEntrega: true,
} satisfies Prisma.NotificacaoSelect

export type DeliveryNotificationRecord = Prisma.NotificacaoGetPayload<{
  select: typeof deliverySelect
}>

type FindExistingNotificationParams = {
  dedupeKey: string
  legacyWhere: Prisma.NotificacaoWhereInput
}

type CreateOrRefreshNotificationParams = {
  existing: DeliveryNotificationRecord | null
  dedupeKey: string
  data: Prisma.NotificacaoUncheckedCreateInput
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Erro ao entregar notificacao'
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 240)
}

export async function findExistingNotification({
  dedupeKey,
  legacyWhere,
}: FindExistingNotificationParams) {
  return prisma.notificacao.findFirst({
    where: {
      OR: [
        { chaveDedupe: dedupeKey },
        legacyWhere,
      ],
    },
    select: deliverySelect,
  })
}

export function isNotificationDelivered(notification: DeliveryNotificationRecord | null) {
  return Boolean(
    notification &&
      (notification.enviada || notification.statusEntrega === StatusEntregaNotificacao.ENVIADA)
  )
}

export async function createOrRefreshNotification({
  existing,
  dedupeKey,
  data,
}: CreateOrRefreshNotificationParams) {
  if (existing) {
    if (existing.statusEntrega === StatusEntregaNotificacao.PROCESSANDO) {
      return existing
    }

    return prisma.notificacao.update({
      where: { id: existing.id },
      data: {
        ...data,
        chaveDedupe: dedupeKey,
        enviada: false,
        statusEntrega: StatusEntregaNotificacao.PENDENTE,
        ultimoErro: null,
      },
      select: deliverySelect,
    })
  }

  return prisma.notificacao.create({
    data: {
      ...data,
      chaveDedupe: dedupeKey,
    },
    select: deliverySelect,
  })
}

export async function claimNotificationForDelivery(notification: DeliveryNotificationRecord) {
  const claimed = await prisma.notificacao.updateMany({
    where: {
      id: notification.id,
      enviada: false,
      statusEntrega: {
        in: [StatusEntregaNotificacao.PENDENTE, StatusEntregaNotificacao.FALHA],
      },
    },
    data: {
      statusEntrega: StatusEntregaNotificacao.PROCESSANDO,
      ultimaTentativaEm: new Date(),
      ultimoErro: null,
    },
  })

  if (claimed.count !== 1) {
    return null
  }

  return {
    ...notification,
    statusEntrega: StatusEntregaNotificacao.PROCESSANDO,
  }
}

export async function markNotificationDelivered(notification: DeliveryNotificationRecord) {
  return prisma.notificacao.update({
    where: { id: notification.id },
    data: {
      enviada: true,
      enviadaEm: new Date(),
      statusEntrega: StatusEntregaNotificacao.ENVIADA,
      tentativasEntrega: { increment: 1 },
      ultimaTentativaEm: new Date(),
      ultimoErro: null,
    },
    select: deliverySelect,
  })
}

export async function markNotificationFailed(
  notification: DeliveryNotificationRecord,
  error: unknown
) {
  return prisma.notificacao.update({
    where: { id: notification.id },
    data: {
      enviada: false,
      statusEntrega: StatusEntregaNotificacao.FALHA,
      tentativasEntrega: { increment: 1 },
      ultimaTentativaEm: new Date(),
      ultimoErro: getErrorMessage(error),
    },
    select: deliverySelect,
  })
}
