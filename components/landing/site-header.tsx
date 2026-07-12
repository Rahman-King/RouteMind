import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="anim-fade sticky top-0 z-40 w-full [--delay:0.05s]">
      <div className="glass mx-auto mt-3 flex h-14 max-w-6xl items-center justify-between rounded-full px-4 sm:px-6">
        <Logo href="/" />
        <nav className="flex items-center gap-2">
          <Button
            variant="hero"
            nativeButton={false}
            className="press group rounded-full px-4 transition-shadow hover:shadow-glow-sm"
            render={<Link href="/chat" />}
          >
            Get started
            <ArrowRight
              data-icon="inline-end"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Button>
        </nav>
      </div>
    </header>
  )
}
