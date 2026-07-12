"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  FolderTree,
  History,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { useApp } from "@/components/app-provider"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/lib/format"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const nav = [
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "History", href: "/history", icon: History },
  { label: "Projects", href: "/projects", icon: FolderTree },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const { user, chats, createChat, deleteChat, signOut } = useApp()

  const handleNewChat = () => {
    const id = createChat()
    router.push(`/chat?c=${id}`)
  }

  const handleSignOut = () => {
    signOut()
    toast.success("Signed out")
    router.replace("/")
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3">
        <div className="flex h-8 items-center justify-center px-1 group-data-[collapsible=icon]:px-0 group-data-[state=expanded]:justify-start">
          {collapsed ? <Logo iconOnly href="/chat" /> : <Logo href="/chat" />}
        </div>
        <Button
          variant="hero"
          className="press h-10 w-full justify-center rounded-xl transition-shadow hover:shadow-glow-sm group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 [&>svg]:transition-transform hover:[&>svg]:rotate-90"
          onClick={handleNewChat}
        >
          <Plus data-icon={collapsed ? undefined : "inline-start"} />
          <span className="group-data-[collapsible=icon]:hidden">New chat</span>
        </Button>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                      className="group/nav transition-all duration-200 hover:translate-x-0.5 [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:scale-110 data-[active=true]:[&>svg]:text-brand-violet"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && chats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Recent chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.map((chat) => {
                  const active = pathname === "/chat"
                  return (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        isActive={false}
                        render={<Link href={`/chat?c=${chat.id}`} />}
                      >
                        <MessageSquare />
                        <span>{chat.title || "New chat"}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        showOnHover
                        aria-label="Delete chat"
                        className="hover:bg-destructive/15 hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault()
                          deleteChat(chat.id)
                          toast.success("Chat deleted")
                        }}
                      >
                        <Trash2 />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2.5 rounded-xl p-1.5 group-data-[collapsible=icon]:p-0">
          <Avatar>
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback className="bg-gradient-brand text-xs font-semibold text-white">
              {initials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium leading-tight">
              {user?.name}
            </p>
            <p className="truncate text-xs leading-tight text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            className="group-data-[collapsible=icon]:hidden"
            onClick={handleSignOut}
          >
            <LogOut />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
