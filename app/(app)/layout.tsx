import type React from "react"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WorkspaceShell>{children}</WorkspaceShell>
}
