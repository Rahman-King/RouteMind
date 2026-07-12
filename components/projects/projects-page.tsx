"use client"

import * as React from "react"
import { Clock, FolderTree, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ACCENT_GRADIENT } from "@/lib/types"
import { timeAgo } from "@/lib/format"
import { useApp } from "@/components/app-provider"
import { NewProjectDialog } from "@/components/projects/new-project-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function ProjectsPage() {
  const { ready, projects, deleteProject } = useApp()
  const [open, setOpen] = React.useState(false)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1 text-muted-foreground">
            Organize your work into focused, colorful workspaces.
          </p>
        </div>
        <Button
          variant="hero"
          className="rounded-full"
          onClick={() => setOpen(true)}
        >
          <Plus data-icon="inline-start" />
          New project
        </Button>
      </div>

      <div className="mt-8">
        {!ready ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-7 text-brand-violet" />
          </div>
        ) : projects.length === 0 ? (
          <div className="glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
            <div className="bg-gradient-brand mb-5 flex size-14 items-center justify-center rounded-2xl text-white shadow-glow-sm">
              <FolderTree className="size-7" />
            </div>
            <h2 className="font-display text-lg font-semibold">
              No projects yet
            </h2>
            <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
              Create your first project to keep related work together.
            </p>
            <Button
              variant="hero"
              className="mt-6 rounded-full"
              onClick={() => setOpen(true)}
            >
              <Plus data-icon="inline-start" />
              New project
            </Button>
          </div>
        ) : (
          <div className="stagger-in grid grid-cols-1 gap-5 sm:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="glass lift group relative overflow-hidden rounded-3xl p-6 hover:shadow-glow-sm"
              >
                <div
                  aria-hidden
                  className={cn(
                    "bg-gradient-to-br pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-2xl",
                    ACCENT_GRADIENT[project.accent],
                  )}
                />
                <div className="relative flex items-start justify-between">
                  <div
                    className={cn(
                      "bg-gradient-to-br flex size-11 items-center justify-center rounded-2xl text-white shadow-glow-sm",
                      ACCENT_GRADIENT[project.accent],
                    )}
                  >
                    <FolderTree className="size-5" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete project"
                    className="rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                    onClick={() => {
                      deleteProject(project.id)
                      toast.success("Project deleted")
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <h3 className="relative mt-4 font-display text-lg font-semibold">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {project.description}
                  </p>
                )}
                <div className="relative mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {timeAgo(project.createdAt)} ago
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
