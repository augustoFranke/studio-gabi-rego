"use client"

import { useSyncExternalStore } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Calendar,
  Dumbbell,
  ChevronUp,
  LogOut,
  Home,
} from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"

const menuItems = [
  {
    title: "Início",
    url: "/inicio",
    icon: Home,
  },
  {
    title: "Minha Agenda",
    url: "/minha-agenda",
    icon: Calendar,
  },
  {
    title: "Meu Treino",
    url: "/meu-treino",
    icon: Dumbbell,
  },
]

export function AlunoSidebar() {
  const pathname = usePathname()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-center">
          <Image
            src="/logo.svg"
            alt="Gabi Rêgo Studio"
            width={72}
            height={72}
          />
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
            Minha Área
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = pathname === item.url || pathname.startsWith(item.url + "/")
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={isActive ? "bg-sidebar-accent text-primary font-medium" : ""}
                    >
                      <Link href={item.url}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full hover:bg-sidebar-accent">
                    <Avatar className="h-7 w-7 border-2 border-primary/20">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">AL</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 text-left">
                      <span className="text-sm font-medium">Aluno</span>
                      <span className="text-xs text-muted-foreground">Perfil</span>
                    </div>
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width]"
                >
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton className="w-full hover:bg-sidebar-accent">
                <Avatar className="h-7 w-7 border-2 border-primary/20">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">AL</AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 text-left">
                  <span className="text-sm font-medium">Aluno</span>
                  <span className="text-xs text-muted-foreground">Perfil</span>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
