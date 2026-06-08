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

describe("rateLimitByIp", () => {
  it("allows requests below the configured bucket limit", async () => {
    process.env.NODE_ENV = "production"

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(
      new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.10" } }),
      "auth:test",
      { maxRequests: 2 }
    )

    expect(response).toEqual({ success: true })
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
