export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [
      { validateRuntimeConfig },
      { logInfo, logError, logWarn },
      {
        RUNTIME_CONFIG_VALID,
        RUNTIME_CONFIG_INVALID,
        RUNTIME_CONFIG_DEGRADED,
      },
    ] = await Promise.all([
      import("@/lib/runtime-config"),
      import("@/lib/observability/logger"),
      import("@/lib/observability/events"),
    ])

    const result = validateRuntimeConfig()

    if (!result.ok) {
      logError(RUNTIME_CONFIG_INVALID, { errors: result.errors })

      throw new Error(
        `[runtime-config] Critical configuration is missing or invalid:\n${result.errors.join("\n")}`
      )
    }

    if (result.warnings.length > 0) {
      logWarn(RUNTIME_CONFIG_DEGRADED, { warnings: result.warnings })
    } else {
      logInfo(RUNTIME_CONFIG_VALID, {})
    }

    const { registerShutdownHandlers } = await import("@/lib/shutdown")
    registerShutdownHandlers()
  }
}
