import { logInfo, logError, safeErrorData } from '@/lib/observability/logger'
import {
  PROVIDER_SEND_ATTEMPTED,
  PROVIDER_SEND_OK,
  PROVIDER_SEND_FAILED,
} from '@/lib/observability/events'
import {
  getEvolutionConfig,
  getWhatsappCountryCodeConfig,
} from '@/lib/runtime-config'
import { fetchWithTimeout } from '@/lib/http'

const PROVIDER = 'evolution'

function getCountryCode(defaultCode = '55') {
  return getWhatsappCountryCodeConfig(defaultCode)
}

export function isEvolutionConfigured(): boolean {
  const { url, key, instance } = getEvolutionConfig()
  return Boolean(url && key && instance)
}

export function formatWhatsappNumber(
  telefone: string,
  countryCode: string = getCountryCode()
): string | null {
  if (!telefone) return null
  const digits = telefone.replace(/\D/g, '')
  if (!digits) return null

  const localLength = 10
  const mobileLength = 11
  const expectedLengths = [countryCode.length + localLength, countryCode.length + mobileLength]

  if (digits.startsWith(countryCode) && expectedLengths.includes(digits.length)) {
    return digits
  }

  if (digits.length === localLength || digits.length === mobileLength) {
    return `${countryCode}${digits}`
  }

  return null
}

type SendWhatsappTextParams = {
  to: string
  text: string
}

export async function sendWhatsappText({ to, text }: SendWhatsappTextParams) {
  const { url, key, instance } = getEvolutionConfig()
  if (!url || !key || !instance) {
    throw new Error('Evolution API not configured')
  }

  logInfo(PROVIDER_SEND_ATTEMPTED, { provider: PROVIDER, recipientLength: to.length })

  const baseUrl = url.replace(/\/$/, '')

  try {
    const response = await fetchWithTimeout(`${baseUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        number: to,
        text,
      }),
      timeoutMs: 10_000,
    })

    if (!response.ok) {
      logError(PROVIDER_SEND_FAILED, {
        provider: PROVIDER,
        statusCode: response.status,
      })
      throw new Error(`Evolution API error (${response.status})`)
    }

    logInfo(PROVIDER_SEND_OK, { provider: PROVIDER })
    return
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith('Evolution API error'))) {
      logError(PROVIDER_SEND_FAILED, {
        provider: PROVIDER,
        ...safeErrorData(error),
      })
    }
    throw error
  }
}
