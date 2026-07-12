"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/components/app-provider"
import { AppSidebar } from "@/components/workspace/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Spinner } from "@/components/ui/spinner"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { ready } = useApp()

  if (!ready) {
    return (
      <main className="bg-mesh flex min-h-svh items-center justify-center">
        <Spinner className="size-8 text-brand-violet" />
      </main>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-mesh">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-2 px-4">
          <SidebarTrigger className="rounded-full" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
