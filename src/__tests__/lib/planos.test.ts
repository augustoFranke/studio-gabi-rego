import { describe, expect, it } from "vitest"
import { formatPlanoDuration } from "@/lib/planos"

describe("formatPlanoDuration", () => {
  it("returns 'mês' for 30 days", () => {
    expect(formatPlanoDuration(30)).toBe("mês")
  })

  it("returns 'trimestre' for 90 days", () => {
    expect(formatPlanoDuration(90)).toBe("trimestre")
  })

  it("returns 'semestre' for 180 days", () => {
    expect(formatPlanoDuration(180)).toBe("semestre")
  })

  it("returns 'ano' for any other duration", () => {
    expect(formatPlanoDuration(365)).toBe("ano")
  })

  it("returns 'ano' for unlisted durations like 45 days", () => {
    expect(formatPlanoDuration(45)).toBe("ano")
  })
})
