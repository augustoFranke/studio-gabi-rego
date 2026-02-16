import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const limitMock = vi.fn(async () => ({ success: true }))

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow() {
      return "mock-window"
    }

    constructor() {}

    limit = limitMock
  },
}))

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => ({ mock: true })),
  },
}))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.VITEST
  vi.resetModules()
  vi.clearAllMocks()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("rateLimitByIp", () => {
  it("fails closed in production when limiter is unavailable", async () => {
    process.env.NODE_ENV = "production"

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(new Request("http://localhost"), "auth:test")

    expect(response).toEqual({ success: false, error: "Rate limit unavailable" })
  })

  it("fails open in development when limiter is unavailable", async () => {
    process.env.NODE_ENV = "development"

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(new Request("http://localhost"), "auth:test")

    expect(response).toEqual({ success: true })
  })
})
