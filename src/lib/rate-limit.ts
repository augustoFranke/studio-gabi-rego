import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { getRateLimitRedisConfig, isProductionRuntime, isTestRuntime } from "@/lib/runtime-config"
import { logWarn } from "@/lib/observability/logger"
import { RATE_LIMIT_BACKEND_ERROR } from "@/lib/observability/events"

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX_REQUESTS = 10
const MAX_BUCKETS = 10_000

type RateLimitOptions = {
  maxRequests?: number
  windowMs?: number
}

type RateLimitResult = { success: true } | { success: false; retryAfter: number }

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

function getClientIp(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("fly-client-ip")?.trim() ||
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

function rateLimitInMemory(
  bucketKey: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()

  pruneExpiredBuckets(now)

  const bucket = buckets.get(bucketKey)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs })
    return { success: true }
  }

  bucket.count += 1

  if (bucket.count > maxRequests) {
    return {
      success: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  return { success: true }
}

function rateLimitUnavailable(): RateLimitResult {
  return { success: false, retryAfter: 60 }
}

function shouldFailClosed() {
  return isProductionRuntime() && !isTestRuntime()
}

// ---------------------------------------------------------------------------
// Redis backend (Upstash)
// ---------------------------------------------------------------------------

let redisClient: Redis | null | undefined
const rateLimiters = new Map<string, Ratelimit>()

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient
  }

  const { url, token } = getRateLimitRedisConfig()

  if (!url || !token || isTestRuntime()) {
    redisClient = null
    return redisClient
  }

  redisClient = new Redis({ url, token })
  return redisClient
}

export function isRateLimitConfigured() {
  return getRedisClient() !== null
}

function getRatelimiter(redis: Redis, maxRequests: number, windowMs: number): Ratelimit {
  const cacheKey = `${maxRequests}:${windowMs}`
  const cached = rateLimiters.get(cacheKey)
  if (cached) {
    return cached
  }

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
  })
  rateLimiters.set(cacheKey, ratelimit)
  return ratelimit
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
): Promise<RateLimitResult> {
  void request
  const normalizedKey = key.trim().toLowerCase().slice(0, 128) || "unknown"
  const bucketKey = `${keyPrefix}:${normalizedKey}`
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS

  const redis = getRedisClient()

  if (redis) {
    try {
      const ratelimit = getRatelimiter(redis, maxRequests, windowMs)
      const result = await ratelimit.limit(bucketKey)

      if (!result.success) {
        return {
          success: false,
          retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
        }
      }

      return { success: true }
    } catch (error) {
      logWarn(RATE_LIMIT_BACKEND_ERROR, {
        keyPrefix,
        errorMessage: error instanceof Error ? error.message : String(error),
      })

      if (shouldFailClosed()) {
        return rateLimitUnavailable()
      }
    }
  } else if (shouldFailClosed()) {
    logWarn(RATE_LIMIT_BACKEND_ERROR, {
      keyPrefix,
      errorMessage: "Redis rate limit backend is not configured",
    })
    return rateLimitUnavailable()
  }

  return rateLimitInMemory(bucketKey, maxRequests, windowMs)
}
