"use client"

import * as React from "react"
import { toast } from "sonner"
import type { AccentColor } from "@/lib/types"
import { ACCENT_GRADIENT } from "@/lib/types"
import { useApp } from "@/components/app-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const accents: { value: AccentColor; label: string }[] = [
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
  { value: "pink", label: "Pink" },
  { value: "cyan", label: "Cyan" },
]

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { createProject } = useApp()
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [accent, setAccent] = React.useState<AccentColor>("violet")
  const [saving, setSaving] = React.useState(false)

  const reset = () => {
    setName("")
    setDescription("")
    setAccent("violet")
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    createProject(name.trim(), description.trim(), accent)
    setSaving(false)
    toast.success("Project created")
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New project</DialogTitle>
          <DialogDescription>
            Keep related work together in a focused workspace.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="project-name">Name</FieldLabel>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Growth marketing"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="project-desc">Description</FieldLabel>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              rows={3}
            />
          </Field>
          <Field>
            <FieldLabel>Accent color</FieldLabel>
            <div className="flex items-center gap-3">
              {accents.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  aria-label={a.label}
                  onClick={() => setAccent(a.value)}
                  className={cn(
                    "bg-gradient-to-br size-9 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                    ACCENT_GRADIENT[a.value],
                    accent === a.value
                      ? "ring-brand-violet scale-110"
                      : "ring-transparent",
                  )}
                />
              ))}
            </div>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="hero"
            className="rounded-full"
            disabled={!name.trim() || saving}
            onClick={handleCreate}
          >
            {saving && <Spinner data-icon="inline-start" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
