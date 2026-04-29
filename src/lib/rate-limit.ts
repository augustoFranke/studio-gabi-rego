import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { logError, logWarn } from "@/lib/observability/logger"
import {
  getRateLimitConfig,
  isDevelopmentRuntime,
  isProductionRuntime,
  isTestRuntime,
} from "@/lib/runtime-config"

const rateLimitConfig = getRateLimitConfig()

const rateLimiter = rateLimitConfig.url && rateLimitConfig.token
  ? new Ratelimit({
      redis: new Redis({
        url: rateLimitConfig.url,
        token: rateLimitConfig.token,
      }),
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
  if (isTestRuntime()) {
    return { success: true }
  }

  if (!rateLimiter) {
    if (isProductionRuntime()) {
      logError("rate_limit_unavailable", {
        message:
          "CRITICAL: Rate limiter unavailable in production. Denying request. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      })
      return { success: false, error: "Rate limit unavailable" }
    }

    if (isDevelopmentRuntime()) {
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

export async function rateLimitByKey(request: Request, keyPrefix: string, key: string) {
  const ip = getRequestIp(request)
  const normalizedKey = key.trim().toLowerCase().slice(0, 128) || "unknown"
  return rateLimitByIp(request, `${keyPrefix}:${normalizedKey}:${ip}`)
}
