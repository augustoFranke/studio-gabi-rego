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
  it("allows requests in production after removing the external limiter", async () => {
    process.env.NODE_ENV = "production"

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(new Request("http://localhost"), "auth:test")

    expect(response).toEqual({ success: true })
  })

  it("allows requests in development", async () => {
    process.env.NODE_ENV = "development"

    const { rateLimitByIp } = await import("@/lib/rate-limit")
    const response = await rateLimitByIp(new Request("http://localhost"), "auth:test")

    expect(response).toEqual({ success: true })
  })
})
