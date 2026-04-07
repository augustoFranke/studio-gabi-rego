function getEvolutionConfig() {
  return {
    url: process.env.EVOLUTION_API_URL,
    key: process.env.EVOLUTION_API_KEY,
    instance: process.env.EVOLUTION_INSTANCE,
  }
}

function getCountryCode(defaultCode = '55') {
  return process.env.WHATSAPP_COUNTRY_CODE || defaultCode
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

  const baseUrl = url.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
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
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    const message = errorText ? `Evolution API error: ${errorText}` : 'Evolution API error'
    throw new Error(message)
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}
