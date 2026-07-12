"use client"

import Image from "next/image"
import { Sparkles, BarChart3, Mail, Database, Code } from "lucide-react"

const suggestions = [
  {
    text: "Summarize this quarter's product metrics",
    icon: BarChart3,
  },
  {
    text: "Write a launch email for a new feature",
    icon: Mail,
  },
  {
    text: "Explain vector databases simply",
    icon: Database,
  },
  {
    text: "Refactor my authentication flow",
    icon: Code,
  },
]

export function ChatEmptyState({
  name,
  onPick,
}: {
  name: string
  onPick: (value: string) => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <div className="glass mb-6 flex size-16 items-center justify-center rounded-3xl shadow-glow-sm animate-glow-pulse">
        <Image
          src="/routemind-logo.png"
          alt="RouteMind logo"
          width={40}
          height={40}
          priority
        />
      </div>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl anim-blur [--delay:0.1s]">
        Hello, <span className="text-gradient-brand">{name}</span>
      </h1>
      <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground anim-rise [--delay:0.2s]">
        What should we route today? Ask anything and I&apos;ll pick the cheapest
        capable model.
      </p>

      <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 stagger-in">
        {suggestions.map(({ text, icon: Icon }, i) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="glass group flex items-start gap-3 rounded-2xl p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2"
            style={{ animationDelay: `${0.1 + i * 0.05}s` }}
          >
            <span className="bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Icon className="size-4 text-brand-violet" aria-hidden="true" />
            </span>
            <span className="text-sm leading-relaxed">{text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
