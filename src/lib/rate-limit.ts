export function isRateLimitConfigured() {
  return false
}

export async function rateLimitByIp(request: Request, keyPrefix: string) {
  void request
  void keyPrefix
  return { success: true }
}

export async function rateLimitByKey(request: Request, keyPrefix: string, key: string) {
  const normalizedKey = key.trim().toLowerCase().slice(0, 128) || "unknown"
  return rateLimitByIp(request, `${keyPrefix}:${normalizedKey}`)
}
