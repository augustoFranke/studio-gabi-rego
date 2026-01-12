import { prisma } from "@/lib/prisma"

const globalForShutdown = globalThis as unknown as {
  handlersRegistered: boolean | undefined
}

let isShuttingDown = false

/**
 * Graceful shutdown handler
 * Ensures database connections are properly closed on process termination
 */
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`[Shutdown] Already shutting down, ignoring ${signal}`)
    return
  }

  isShuttingDown = true
  console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`)

  try {
    // Disconnect Prisma
    await prisma.$disconnect()
    console.log("[Shutdown] Database connection closed")
  } catch (error) {
    console.error("[Shutdown] Error during cleanup:", error)
  }

  console.log("[Shutdown] Graceful shutdown complete")
  process.exit(0)
}

/**
 * Register shutdown handlers for graceful process termination
 * Should only be called once on server startup
 */
export function registerShutdownHandlers() {
  // Prevent duplicate registration using global variable
  if (globalForShutdown.handlersRegistered) {
    return
  }

  // Only register on server-side
  if (typeof window !== "undefined") {
    return
  }

  globalForShutdown.handlersRegistered = true

  // Handle common termination signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("[Shutdown] Uncaught exception:", error)
    gracefulShutdown("uncaughtException")
  })

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Shutdown] Unhandled rejection at:", promise, "reason:", reason)
  })

  console.log("[Shutdown] Graceful shutdown handlers registered")
}

