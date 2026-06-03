"use client"

import { useSyncExternalStore } from "react"
import type { LucideIcon } from "lucide-react"
import { ChevronUp, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
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

export type AppSidebarItem = {
  title: string
  url: string
  icon: LucideIcon
}

type AppSidebarProps = {
  groupLabel: string
  menuItems: AppSidebarItem[]
  accountName: string
  accountRole: string
  avatarFallback: string
  deferAccountMenuUntilMounted?: boolean
}

type AccountProps = Pick<AppSidebarProps, "accountName" | "accountRole" | "avatarFallback">

function AccountButton({
  accountName,
  accountRole,
  avatarFallback,
}: AccountProps) {
  return (
    <SidebarMenuButton className="w-full hover:bg-sidebar-accent">
      <Avatar className="size-7 border-2 border-primary/20">
        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
          {avatarFallback}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col flex-1 text-left">
        <span className="text-sm font-medium">{accountName}</span>
        <span className="text-xs text-muted-foreground">{accountRole}</span>
      </div>
      <ChevronUp className="size-4 text-muted-foreground" />
    </SidebarMenuButton>
  )
}

function SidebarNavigation({
  groupLabel,
  menuItems,
  pathname,
}: Pick<AppSidebarProps, "groupLabel" | "menuItems"> & { pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
        {groupLabel}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {menuItems.map((item) => {
            const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={isActive ? "bg-sidebar-accent text-primary font-medium" : ""}
                >
                  <Link href={item.url}>
                    <item.icon className={`size-4 ${isActive ? "text-primary" : ""}`} />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function AccountMenu({
  canRenderAccountMenu,
  ...accountProps
}: AccountProps & { canRenderAccountMenu: boolean }) {
  if (!canRenderAccountMenu) {
    return <AccountButton {...accountProps} />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AccountButton {...accountProps} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        className="w-[--radix-popper-anchor-width]"
      >
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 size-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppSidebar({
  groupLabel,
  menuItems,
  accountName,
  accountRole,
  avatarFallback,
  deferAccountMenuUntilMounted = false,
}: AppSidebarProps) {
  const pathname = usePathname()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const canRenderAccountMenu = !deferAccountMenuUntilMounted || mounted

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-center">
          <Image
            src="/logo.svg"
            alt="Studio Gabi Rego"
            width={72}
            height={72}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarNavigation
          groupLabel={groupLabel}
          menuItems={menuItems}
          pathname={pathname}
        />
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu
              accountName={accountName}
              accountRole={accountRole}
              avatarFallback={avatarFallback}
              canRenderAccountMenu={canRenderAccountMenu}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
