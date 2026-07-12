"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/components/app-provider"
import { SiteHeader } from "@/components/landing/site-header"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { CtaBanner } from "@/components/landing/cta-banner"
import { SiteFooter } from "@/components/landing/site-footer"

export function LandingPage() {
  const { hydrated, user } = useApp()
  const router = useRouter()

  React.useEffect(() => {
    if (hydrated && user) {
      router.replace("/chat")
    }
  }, [hydrated, user, router])

  return (
    <div className="bg-mesh flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <CtaBanner />
      </main>
      <SiteFooter />
    </div>
  )
}
