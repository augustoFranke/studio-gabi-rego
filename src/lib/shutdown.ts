import { prisma } from "@/lib/prisma"

const globalForShutdown = globalThis as typeof globalThis & {
  handlersRegistered?: boolean
}

let isShuttingDown = false

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`[Shutdown] Already shutting down, ignoring ${signal}`)
    return
  }

  isShuttingDown = true
  console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`)

  try {
    await prisma.$disconnect()
    console.log("[Shutdown] Database connection closed")
  } catch (error) {
    console.error("[Shutdown] Error during cleanup:", error)
  }

  console.log("[Shutdown] Graceful shutdown complete")
  process.exit(0)
}

export function registerShutdownHandlers() {
  if (globalForShutdown.handlersRegistered) {
    return
  }

  if (typeof window !== "undefined") {
    return
  }

  globalForShutdown.handlersRegistered = true

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))

  process.on("uncaughtException", (error) => {
    console.error("[Shutdown] Uncaught exception:", error)
    gracefulShutdown("uncaughtException")
  })

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Shutdown] Unhandled rejection at:", promise, "reason:", reason)
  })

  console.log("[Shutdown] Graceful shutdown handlers registered")
}
