import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AlunoSidebar } from "@/components/aluno-sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggleSimple } from "@/components/theme-toggle"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AlunoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Se for admin tentando acessar área de membro sem parâmetro de membroId, 
  // pode ser ok, mas geralmente membros tem sua própria rota.
  // Aqui garantimos que só quem tem role MEMBRO ou ADMIN pode entrar.
  if (session.user.role !== "MEMBRO" && session.user.role !== "ADMIN") {
    redirect("/login")
  }

  return (
    <SidebarProvider>
      <AlunoSidebar />
      <main className="flex-1 overflow-auto">
        <header className="flex h-14 items-center gap-4 border-b bg-card/50 backdrop-blur-sm px-4 sm:px-6 sticky top-0 z-10">
          <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-primary transition-colors" />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1" />
          <ThemeToggleSimple />
        </header>
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
