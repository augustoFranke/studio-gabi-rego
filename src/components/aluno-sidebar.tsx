"use client"

import {
  Calendar,
  DollarSign,
  Dumbbell,
  Home,
  User,
} from "lucide-react"
import { AppSidebar, type AppSidebarItem } from "@/components/app-sidebar"

const menuItems: AppSidebarItem[] = [
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
  {
    title: "Pagamentos",
    url: "/pagamentos",
    icon: DollarSign,
  },
  {
    title: "Meu Perfil",
    url: "/meu-perfil",
    icon: User,
  },
]

export function AlunoSidebar() {
  return (
    <AppSidebar
      groupLabel="Minha Área"
      menuItems={menuItems}
      accountName="Aluno"
      accountRole="Perfil"
      avatarFallback="AL"
      deferAccountMenuUntilMounted
    />
  )
}
