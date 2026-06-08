const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX_REQUESTS = 10
const MAX_BUCKETS = 10_000

type RateLimitOptions = {
  maxRequests?: number
  windowMs?: number
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  )
}

function pruneExpiredBuckets(now = Date.now()) {
  if (buckets.size < MAX_BUCKETS) {
    return
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function isRateLimitConfigured() {
  return true
}

export async function rateLimitByIp(
  request: Request,
  keyPrefix: string,
  options?: RateLimitOptions
) {
  return rateLimitByKey(request, keyPrefix, getClientIp(request), options)
}

export async function rateLimitByKey(
  request: Request,
  keyPrefix: string,
  key: string,
  options?: RateLimitOptions
) {
  void request
  const normalizedKey = key.trim().toLowerCase().slice(0, 128) || "unknown"
  const bucketKey = `${keyPrefix}:${normalizedKey}`
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS
  const now = Date.now()

  pruneExpiredBuckets(now)

  const bucket = buckets.get(bucketKey)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs })
    return { success: true as const }
  }

  bucket.count += 1

  if (bucket.count > maxRequests) {
    return {
      success: false as const,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  return { success: true as const }
}
