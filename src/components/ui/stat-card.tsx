import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Tone drives both the icon chip and the value, so a metric that means
// "something is wrong" cannot end up wearing the same colour as a healthy one.
export type StatCardTone = "default" | "success" | "warning" | "destructive"

const TONE_STYLES: Record<StatCardTone, { card: string; chip: string; icon: string; value: string }> = {
  default: {
    card: "hover:shadow-primary/5 border-primary/10",
    chip: "bg-primary/10 group-hover:bg-primary/15",
    icon: "text-primary",
    value: "",
  },
  success: {
    card: "hover:shadow-success/5 border-success/10",
    chip: "bg-success/10 group-hover:bg-success/15",
    icon: "text-success",
    value: "text-success",
  },
  warning: {
    card: "hover:shadow-warning/5 border-warning/10",
    chip: "bg-warning/10 group-hover:bg-warning/15",
    icon: "text-warning",
    value: "text-warning",
  },
  destructive: {
    card: "hover:shadow-destructive/5 border-destructive/10",
    chip: "bg-destructive/10 group-hover:bg-destructive/15",
    icon: "text-destructive",
    value: "text-destructive",
  },
}

export function StatCard({
  title,
  value,
  description,
  icon,
  tone = "default",
  progress,
  isLoading = false,
}: {
  title: string
  value: ReactNode
  description?: string
  /** Rendered inside the tinted chip; tone controls its colour. */
  icon: React.ComponentType<{ className?: string }>
  tone?: StatCardTone
  progress?: number
  isLoading?: boolean
}) {
  const styles = TONE_STYLES[tone]
  const Icon = icon

  return (
    <Card className={cn("group transition-shadow hover:shadow-md", styles.card)}>
      <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div
          className={cn(
            "size-9 rounded-lg flex items-center justify-center transition-colors",
            styles.chip
          )}
        >
          <Icon className={cn("size-4", styles.icon)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", styles.value)}>
          {isLoading ? <Skeleton className="h-8 w-16" /> : value}
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        {typeof progress === "number" ? (
          <div className="flex items-center pt-1">
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
