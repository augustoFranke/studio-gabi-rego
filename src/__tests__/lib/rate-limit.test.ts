import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  delete process.env.VITEST
  vi.resetModules()
  vi.clearAllMocks()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("isRateLimitConfigured", () => {
  it("returns false when Upstash env vars are absent", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { isRateLimitConfigured } = await import("@/lib/rate-limit")

    expect(isRateLimitConfigured()).toBe(false)
  })
})

describe("rate-limit Redis backend", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token"
  })

  it("maps a Redis-backed block to { success: false, retryAfter }", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false, reset: Date.now() + 30_000 })

    vi.doMock("@/lib/runtime-config", async () => {
      const actual = await vi.importActual<typeof import("@/lib/runtime-config")>(
        "@/lib/runtime-config"
      )
      return {
        ...actual,
        isTestRuntime: () => false,
      }
    })
    vi.doMock("@upstash/redis", () => ({
      Redis: class {},
    }))
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: Object.assign(
        class {
          limit = limit
        },
        { slidingWindow: vi.fn() }
      ),
    }))

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(
      new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.20" } }),
      "auth:test"
    )

    expect(response.success).toBe(false)
    expect(response).toEqual({ success: false, retryAfter: expect.any(Number) })
    if (!response.success) {
      expect(response.retryAfter).toBeGreaterThanOrEqual(29)
      expect(response.retryAfter).toBeLessThanOrEqual(31)
    }
  })

  it("fails closed in production when the Redis call throws", async () => {
    process.env.NODE_ENV = "production"
    const limit = vi.fn().mockRejectedValue(new Error("network error"))

    vi.doMock("@/lib/runtime-config", async () => {
      const actual = await vi.importActual<typeof import("@/lib/runtime-config")>(
        "@/lib/runtime-config"
      )
      return {
        ...actual,
        isTestRuntime: () => false,
      }
    })
    vi.doMock("@upstash/redis", () => ({
      Redis: class {},
    }))
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: Object.assign(
        class {
          limit = limit
        },
        { slidingWindow: vi.fn() }
      ),
    }))

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(
      new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.21" } }),
      "auth:test"
    )

    expect(response).toEqual({ success: false, retryAfter: 60 })
  })
})

describe("rateLimitByIp", () => {
  it("allows requests below the configured bucket limit", async () => {
    process.env.NODE_ENV = "development"

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(
      new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.10" } }),
      "auth:test",
      { maxRequests: 2 }
    )

    expect(response).toEqual({ success: true })
  })

  it("fails closed in production when Redis is not configured", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(
      new Request("http://localhost", { headers: { "x-vercel-forwarded-for": "192.0.2.10" } }),
      "auth:test",
      { maxRequests: 2 }
    )

    expect(response).toEqual({ success: false, retryAfter: 60 })
  })

  it("blocks requests over the configured bucket limit", async () => {
    process.env.NODE_ENV = "development"

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.0.2.11" },
    })

    await rateLimitByIp(request, "auth:test", { maxRequests: 1, windowMs: 60_000 })
    const response = await rateLimitByIp(request, "auth:test", {
      maxRequests: 1,
      windowMs: 60_000,
    })

    expect(response.success).toBe(false)
    expect(response).toEqual({ success: false, retryAfter: expect.any(Number) })
  })
})
