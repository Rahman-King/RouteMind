"use client"

import Link from "next/link"
import { Home, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="bg-mesh flex min-h-svh items-center justify-center px-4">
      <div className="glass-strong flex w-full max-w-md flex-col items-center rounded-3xl p-8 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          Something went wrong on our end. Sorry about that — you can try again
          or head back home.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button variant="hero" className="rounded-full px-6" onClick={reset}>
            <RotateCcw data-icon="inline-start" />
            Try again
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            className="rounded-full px-6"
            render={<Link href="/" />}
          >
            <Home data-icon="inline-start" />
            Go home
          </Button>
        </div>
      </div>
    </main>
  )
}
