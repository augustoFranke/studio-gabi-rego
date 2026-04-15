import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { logError, logWarn } from "@/lib/observability/logger"

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

const rateLimiter = UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "1 m"),
    })
  : null

export function isRateLimitConfigured() {
  return Boolean(rateLimiter)
}

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  return "unknown"
}

export async function rateLimitByIp(request: Request, keyPrefix: string) {
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return { success: true }
  }

  if (!rateLimiter) {
    if (process.env.NODE_ENV === "production") {
      logError("rate_limit_unavailable", {
        message:
          "CRITICAL: Rate limiter unavailable in production. Denying request. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      })
      return { success: false, error: "Rate limit unavailable" }
    }

    if (process.env.NODE_ENV === "development") {
      logWarn("rate_limit_unavailable", {
        message:
          "WARNING: Rate limiter unavailable in development. Allowing request (fail-open). Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      })
    }

    return { success: true }
  }

  const ip = getRequestIp(request)
  return rateLimiter.limit(`${keyPrefix}:${ip}`)
}
