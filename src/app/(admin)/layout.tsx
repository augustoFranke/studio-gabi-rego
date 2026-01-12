import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Separator } from "@/components/ui/separator"
import { ErrorBoundary } from "@/components/error-boundary"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/meus-dados")
  }

  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  return (
    <ErrorBoundary>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AdminSidebar />
        <main className="flex-1 overflow-auto">
          <header className="flex h-14 items-center gap-4 border-b bg-card/50 backdrop-blur-sm px-6 sticky top-0 z-10">
            <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-primary transition-colors" />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex-1" />
          </header>
          <div className="p-6">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </ErrorBoundary>
  )
}
