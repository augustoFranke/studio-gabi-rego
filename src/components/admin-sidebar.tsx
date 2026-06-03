"use client"

import {
  Calendar,
  DollarSign,
  Dumbbell,
  LayoutDashboard,
  Users,
} from "lucide-react"
import { AppSidebar, type AppSidebarItem } from "@/components/app-sidebar"

const menuItems: AppSidebarItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Alunos",
    url: "/alunos",
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
  return (
    <AppSidebar
      groupLabel="Menu Principal"
      menuItems={menuItems}
      accountName="Administrador"
      accountRole="Admin"
      avatarFallback="AD"
    />
  )
}
