"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Bell, LayoutGrid, LogOut, Moon, Palette, Route, User, Camera, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import type { Preferences } from "@/lib/types"
import { initials } from "@/lib/format"
import { useApp } from "@/components/app-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="glass rounded-3xl p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-brand-violet">
          <Icon className="size-4" />
        </span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const router = useRouter()
  const { user, preferences, updateProfile, setPreference, signOut } = useApp()
  const { resolvedTheme, setTheme } = useTheme()

  const [name, setName] = React.useState(user?.name ?? "")
  const [avatarUrl, setAvatarUrl] = React.useState(user?.avatarUrl ?? "")
  const [bio, setBio] = React.useState(user?.bio ?? "")
  const [saving, setSaving] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  const avatarInputRef = React.useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ name, avatarUrl, bio })
    setSaving(false)
    toast.success("Changes saved")
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploadingAvatar(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setAvatarUrl(data.url)
        toast.success('Avatar uploaded successfully')
      } else {
        toast.error(data.error || 'Failed to upload avatar')
      }
    } catch (error) {
      toast.error('Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ''
      }
    }
  }

  const handleSignOut = () => {
    signOut()
    toast.success("Signed out")
    router.replace("/")
  }

  const togglePref = (key: keyof Preferences, value: boolean) => {
    setPreference(key, value)
    toast.success("Preference saved")
  }

  const isDark = resolvedTheme === "dark"

  const prefRows = [
    {
      icon: Moon,
      title: "Dark mode",
      helper: "Switch between light and dark themes.",
      checked: isDark,
      onChange: (v: boolean) => {
        setTheme(v ? "dark" : "light")
        toast.success("Preference saved")
      },
    },
    {
      icon: Bell,
      title: "Email notifications",
      helper: "Get product updates by email.",
      checked: preferences.emailNotifications,
      onChange: (v: boolean) => togglePref("emailNotifications", v),
    },
    {
      icon: LayoutGrid,
      title: "Compact mode",
      helper: "Denser layout across the workspace.",
      checked: preferences.compactMode,
      onChange: (v: boolean) => togglePref("compactMode", v),
    },
    {
      icon: Route,
      title: "Show routing details",
      helper: "Always expand the AI status panel.",
      checked: preferences.showRoutingDetails,
      onChange: (v: boolean) => togglePref("showRoutingDetails", v),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your profile and preferences.
        </p>
      </div>

      <div className="stagger-in mt-8 flex flex-col gap-6">
        <Section icon={User} title="Profile">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar size="lg" className="size-16">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
                <AvatarFallback className="bg-gradient-brand text-lg font-semibold text-white">
                  {initials(name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                aria-label="Upload avatar"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute -bottom-1 -right-1 size-7 rounded-full bg-background border shadow-sm hover:bg-muted"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Upload avatar"
              >
                {uploadingAvatar ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : avatarUrl ? (
                  <Camera className="size-3.5" />
                ) : (
                  <Camera className="size-3.5" />
                )}
              </Button>
            </div>
            <div className="flex-1">
              <Field>
                <FieldLabel htmlFor="avatar">Avatar URL</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="avatar"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://…"
                    className="flex-1"
                  />
                  {avatarUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAvatarUrl("")}
                      aria-label="Remove avatar"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </Field>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="name">Display name</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={user?.email ?? ""} disabled />
            </Field>
          </div>

          <div className="mt-4">
            <Field>
              <FieldLabel htmlFor="bio">Bio</FieldLabel>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us a little about yourself…"
                rows={3}
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              variant="hero"
              className="rounded-full"
              disabled={saving}
              onClick={handleSave}
            >
              {saving && <Spinner data-icon="inline-start" />}
              Save changes
            </Button>
          </div>
        </Section>

        <Section icon={Palette} title="Preferences">
          <div className="divide-y divide-border/60">
            {prefRows.map((row) => (
              <div
                key={row.title}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-muted text-brand-violet">
                    <row.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{row.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.helper}
                    </p>
                  </div>
                </div>
                <Switch checked={row.checked} onCheckedChange={row.onChange} />
              </div>
            ))}
          </div>
        </Section>

        <Section icon={LogOut} title="Account">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={handleSignOut}
          >
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        </Section>
      </div>
    </div>
  )
}
