export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. Validate runtime configuration before serving traffic
    const { validateRuntimeConfig } = await import(
      "@/lib/runtime-config"
    )
    const { logInfo, logError, logWarn } = await import(
      "@/lib/observability/logger"
    )
    const {
      RUNTIME_CONFIG_VALID,
      RUNTIME_CONFIG_INVALID,
      RUNTIME_CONFIG_DEGRADED,
    } = await import("@/lib/observability/events")

    const result = validateRuntimeConfig()

    if (!result.ok) {
      // Log the failure before throwing so it's visible in deployment logs
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

    // 2. Register shutdown handlers
    const { registerShutdownHandlers } = await import("@/lib/shutdown")
    registerShutdownHandlers()
  }
}
