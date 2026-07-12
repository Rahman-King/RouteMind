import Link from "next/link"
import { Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="bg-mesh flex min-h-svh items-center justify-center px-4">
      <div className="glass-strong flex w-full max-w-md flex-col items-center rounded-3xl p-8 text-center shadow-soft">
        <p className="text-gradient-brand font-display text-6xl font-bold tracking-tight sm:text-7xl">
          404
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Button
          variant="hero"
          nativeButton={false}
          className="mt-7 rounded-full px-6"
          render={<Link href="/" />}
        >
          <Home data-icon="inline-start" />
          Go home
        </Button>
      </div>
    </main>
  )
}
