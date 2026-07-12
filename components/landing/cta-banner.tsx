import Link from "next/link"
import { ArrowRight, BrainCircuit, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/reveal"

export function CtaBanner() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28" aria-labelledby="cta-heading">
      <Reveal className="bg-gradient-brand-full relative overflow-hidden rounded-4xl px-8 py-14 text-white shadow-glow sm:px-14 sm:py-20 hover:shadow-glow-sm transition-shadow duration-500">
        {/* Animated shimmer */}
        <div
          aria-hidden
          className="animate-shimmer pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-white/20 blur-xl"
        />
        {/* Faint, gently floating brain icon */}
        <BrainCircuit
          aria-hidden
          className="animate-float-slow pointer-events-none absolute -top-6 -right-6 size-48 text-white/10"
        />
        {/* Additional floating icons */}
        <Sparkles
          aria-hidden
          className="animate-float pointer-events-none absolute top-10 left-10 size-20 text-white/5"
        />
        <Zap
          aria-hidden
          className="animate-float-slow pointer-events-none absolute bottom-10 right-20 size-24 text-white/5"
          style={{ animationDelay: '2s' }}
        />

        <div className="relative max-w-xl">
          <h2 id="cta-heading" className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Ready to route smarter?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/85 text-pretty">
            Create your free account and step into the future of AI workspaces.
          </p>
          <Button
            variant="glass"
            nativeButton={false}
            className="press group mt-8 h-11 rounded-full px-6 text-base text-white hover:bg-white/15 hover:text-white hover:shadow-glow-sm transition-all duration-300"
            render={<Link href="/chat" />}
          >
            Get started
            <ArrowRight
              data-icon="inline-end"
              className="transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
