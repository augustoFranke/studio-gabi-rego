export function safeJsonParse(value: string): { ok: true; data: unknown } | { ok: false } {
  try {
    return { ok: true, data: JSON.parse(value) as unknown }
  } catch {
    return { ok: false }
  }
}
