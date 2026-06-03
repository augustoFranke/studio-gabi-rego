"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

const subscribeMounted = () => () => {}
const getMountedSnapshot = () => true
const getServerMountedSnapshot = () => false

export function ThemeToggleSimple() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getServerMountedSnapshot
  )

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8">
        <Sun className="size-4 text-primary" />
      </Button>
    )
  }

  const currentTheme = resolvedTheme ?? "light"

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
    >
      {currentTheme === "dark" ? (
        <Sun className="size-4 text-primary transition-transform hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-primary transition-transform hover:-rotate-12" />
      )}
      <span className="sr-only">Alternar tema</span>
    </Button>
  )
}
