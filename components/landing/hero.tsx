import Link from "next/link"
import { ArrowRight, Sparkles, Zap, BrainCircuit, Cpu, Network, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-heading">
      {/* Enhanced gradient overlay with multiple layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
        style={{
          backgroundImage: "url(/hero-gradient.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 30%, black 40%, transparent 80%)",
        }}
      />
      
      {/* Secondary gradient mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-30"
        style={{
          background: "radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 40% 80%, rgba(249, 115, 22, 0.1) 0%, transparent 50%)",
        }}
      />

      {/* Enhanced floating aurora orbs with more movement */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-orb absolute -top-10 left-[8%] size-64 rounded-full bg-brand-blue/30 blur-3xl" />
        <div className="animate-orb-slow absolute top-10 right-[10%] size-72 rounded-full bg-brand-violet/30 blur-3xl" />
        <div className="animate-orb-slow absolute bottom-[-8%] left-1/2 size-72 -translate-x-1/2 rounded-full bg-brand-orange/25 blur-3xl [animation-delay:3s]" />
        <div className="animate-orb absolute top-1/4 left-1/4 size-48 rounded-full bg-brand-cyan/20 blur-2xl [animation-delay:1s]" />
        <div className="animate-orb-slow absolute bottom-1/4 right-1/4 size-56 rounded-full bg-brand-pink/20 blur-2xl [animation-delay:2s]" />
      </div>

      {/* More floating icons with varied animations */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Zap className="animate-float absolute top-20 right-[20%] size-12 text-brand-violet/30" />
        <BrainCircuit className="animate-float-slow absolute bottom-32 left-[15%] size-16 text-brand-blue/30" style={{ animationDelay: '1.5s' }} />
        <Sparkles className="animate-float absolute top-40 left-[25%] size-10 text-brand-orange/30" style={{ animationDelay: '0.5s' }} />
        <Cpu className="animate-float-slow absolute top-32 right-[30%] size-14 text-brand-cyan/25" style={{ animationDelay: '2s' }} />
        <Network className="animate-float absolute bottom-40 left-[30%] size-12 text-brand-pink/25" style={{ animationDelay: '1s' }} />
        <TrendingUp className="animate-float-slow absolute top-1/2 right-[15%] size-10 text-brand-violet/25" style={{ animationDelay: '2.5s' }} />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <div className="anim-pop glass mb-8 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium [--delay:0.05s] hover:shadow-glow-sm transition-shadow duration-300 border border-brand-violet/20">
          <Sparkles className="size-4 text-brand-violet animate-glow-pulse" aria-hidden="true" />
          <span className="bg-gradient-to-r from-brand-violet to-brand-cyan bg-clip-text text-transparent font-semibold">AI-Powered Intelligence</span>
        </div>

        <h1 id="hero-heading" className="anim-blur font-display text-5xl font-bold tracking-tight text-balance sm:text-6xl lg:text-8xl [--delay:0.15s]">
          One workspace.
          <br />
          <span className="text-gradient-brand">Every model, routed.</span>
        </h1>

        <p className="anim-rise mt-8 max-w-2xl text-xl leading-relaxed text-muted-foreground text-pretty [--delay:0.3s]">
          RouteMind intelligently analyzes each prompt and routes it to the optimal AI model. 
          Watch the decision-making process in real-time with complete transparency. 
          Chat, analyze, and optimize your AI workflow in one stunning interface.
        </p>

        {/* Feature pills */}
        <div className="anim-rise mt-8 flex flex-wrap items-center justify-center gap-3 [--delay:0.35s]">
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground">
            <Zap className="size-4 text-brand-violet" />
            <span>Smart Routing</span>
          </div>
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground">
            <BrainCircuit className="size-4 text-brand-blue" />
            <span>Multi-Model Support</span>
          </div>
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground">
            <TrendingUp className="size-4 text-brand-cyan" />
            <span>Cost Optimization</span>
          </div>
        </div>

        <div className="anim-rise mt-10 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row [--delay:0.42s]">
          <Button
            variant="hero"
            nativeButton={false}
            className="press group h-12 w-full rounded-full px-8 text-lg transition-all hover:scale-105 hover:shadow-glow sm:w-auto"
            render={<Link href="/chat" />}
          >
            Get Started Free
            <ArrowRight data-icon="inline-end" className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Button>
          <Button
            variant="glass"
            nativeButton={false}
            className="press h-12 w-full rounded-full px-8 text-lg sm:w-auto hover:shadow-glow-sm transition-all duration-300 hover:scale-105"
            render={<Link href="/chat" />}
          >
            View Demo
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="anim-rise mt-12 flex items-center gap-6 text-sm text-muted-foreground [--delay:0.5s]">
          <div className="flex items-center gap-2">
            <div className="flex size-2 rounded-full bg-green-500 animate-pulse" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-2 rounded-full bg-brand-violet" />
            <span>Free tier available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-2 rounded-full bg-brand-blue" />
            <span>Enterprise ready</span>
          </div>
        </div>
      </div>
    </section>
  )
}
