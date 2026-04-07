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
  return error instanceof Error ? error.message : 'Erro ao entregar notificacao'
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
    return prisma.notificacao.update({
      where: { id: existing.id },
      data: {
        ...data,
        chaveDedupe: dedupeKey,
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

export async function markNotificationDelivered(notification: DeliveryNotificationRecord) {
  return prisma.notificacao.update({
    where: { id: notification.id },
    data: {
      enviada: true,
      enviadaEm: new Date(),
      statusEntrega: StatusEntregaNotificacao.ENVIADA,
      tentativasEntrega: notification.tentativasEntrega + 1,
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
      tentativasEntrega: notification.tentativasEntrega + 1,
      ultimaTentativaEm: new Date(),
      ultimoErro: getErrorMessage(error),
    },
    select: deliverySelect,
  })
}
