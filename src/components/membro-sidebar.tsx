"use client"

import { useState, useEffect } from "react"
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
  User,
  Calendar,
  Dumbbell,
  ChevronUp,
  LogOut,
  Home,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ThemeToggleSimple } from "@/components/theme-toggle"

const menuItems = [
  {
    title: "Início",
    url: "/inicio",
    icon: Home,
  },
  {
    title: "Meus Dados",
    url: "/meus-dados",
    icon: User,
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

export function MembroSidebar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch with Radix UI dropdown
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md overflow-hidden p-2">
              <Image 
                src="/logo.svg" 
                alt="Gabi Studio" 
                width={44} 
                height={44} 
                className="brightness-0 invert"
              />
            </div>
            <span className="font-semibold text-lg tracking-tight">Gabi Studio</span>
          </div>
          <ThemeToggleSimple />
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
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">MB</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 text-left">
                      <span className="text-sm font-medium">Membro</span>
                      <span className="text-xs text-muted-foreground">Aluno</span>
                    </div>
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width]"
                >
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton className="w-full hover:bg-sidebar-accent">
                <Avatar className="h-7 w-7 border-2 border-primary/20">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">MB</AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 text-left">
                  <span className="text-sm font-medium">Membro</span>
                  <span className="text-xs text-muted-foreground">Aluno</span>
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
