"use client"

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
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  Dumbbell,
  ChevronUp,
  LogOut,
  User,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ThemeToggleSimple } from "@/components/theme-toggle"

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Membros",
    url: "/membros",
    icon: Users,
  },
  {
    title: "Agenda",
    url: "/agenda",
    icon: Calendar,
  },
  {
    title: "Financeiro",
    url: "/financeiro",
    icon: DollarSign,
  },
  {
    title: "Treinos",
    url: "/treinos",
    icon: Dumbbell,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md overflow-hidden p-2">
              <Image
                src="/logo.svg"
                alt="Gabi Studio"
                width={56}
                height={56}
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
            Menu Principal
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full hover:bg-sidebar-accent">
                  <Avatar className="h-7 w-7 border-2 border-primary/20">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">AD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 text-left">
                    <span className="text-sm font-medium">Administrador</span>
                    <span className="text-xs text-muted-foreground">Admin</span>
                  </div>
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4 text-primary" />
                  <span>Minha Conta</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
