export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import to avoid Edge Runtime errors
    const { registerShutdownHandlers } = await import("@/lib/shutdown")
    registerShutdownHandlers()
  }
}

