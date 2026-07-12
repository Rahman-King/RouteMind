import { Logo } from "@/components/logo"

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <Logo size="sm" href="/" />
        <p>© {new Date().getFullYear()} RouteMind. All rights reserved.</p>
      </div>
    </footer>
  )
}
