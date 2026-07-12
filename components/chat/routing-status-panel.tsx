"use client"

import * as React from "react"
import { ChevronDown, Cpu, Coins, Timer, Gauge, BrainCircuit, Compass, TrendingUp, CheckCircle2, XCircle } from "lucide-react"
import type { AiStatus } from "@/lib/types"

interface RoutingStatusPanelProps {
  status?: AiStatus
  defaultOpen?: boolean
}

export const RoutingStatusPanel = React.memo(function RoutingStatusPanel({ status, defaultOpen = false }: RoutingStatusPanelProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  const tierColors = {
    0: "bg-emerald-500 shadow-emerald-500/50",
    1: "bg-blue-500 shadow-blue-500/50",
    2: "bg-violet-500 shadow-violet-500/50",
  }

  const tierLabels = {
    0: "T0",
    1: "T1",
    2: "T2",
  }

  const activeTier = status?.selectedTier ?? 1
  const skippedTiers = status?.skippedTiers ?? []

  return (
    <div className="glass rounded-2xl">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="relative flex size-2.5 shrink-0">
          <span className="bg-green-500 absolute inline-flex size-full animate-ping rounded-full opacity-75" />
          <span className="bg-green-500 relative inline-flex size-2.5 rounded-full" />
        </span>
        <span className="text-sm font-medium">AI Status</span>
        <span className="ml-auto text-xs text-muted-foreground">live</span>
        <ChevronDown
          className={`ml-2 size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border/60 px-3.5 py-3.5 space-y-4">
          {/* Tier Decision Stepper */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tier decision</label>
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((tier) => {
                const isActive = tier === activeTier
                const isSkipped = skippedTiers.includes(tier)
                const isPassed = tier < activeTier && !isSkipped

                return (
                  <React.Fragment key={tier}>
                    <div
                      className={`
                        relative flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all
                        ${isActive 
                          ? `${tierColors[tier as keyof typeof tierColors]} scale-110 shadow-lg text-white` 
                          : isSkipped
                          ? "bg-muted/30 text-muted-foreground/40 scale-90"
                          : isPassed
                          ? "bg-muted/60 text-muted-foreground/60 scale-95"
                          : "bg-muted/40 text-muted-foreground/50 scale-90"
                        }
                      `}
                    >
                      {isActive && (
                        <span className="absolute inset-0 animate-pulse rounded-lg bg-white/20" />
                      )}
                      {tierLabels[tier as keyof typeof tierLabels]}
                    </div>
                    {tier < 2 && (
                      <div className={`h-0.5 flex-1 rounded ${isPassed ? 'bg-gradient-brand' : 'bg-muted/30'}`} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1.5">
            {status?.intent && (
              <span className="rounded-full bg-brand-violet/10 px-2 py-0.5 text-xs font-medium text-brand-violet">
                {status.intent}
              </span>
            )}
            {status?.complexity !== undefined && (
              <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue flex items-center gap-1">
                <BrainCircuit className="size-3" />
                {status.complexity}/100
              </span>
            )}
            {skippedTiers.length > 0 && (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-500 flex items-center gap-1">
                <TrendingUp className="size-3" />
                ↑ escalated
              </span>
            )}
            {status?.cacheHit && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500 flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                cache hit
              </span>
            )}
          </div>

          {/* Meters */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Metrics</label>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Prompt complexity</span>
                  <span className="font-medium">{status?.complexity ?? 0}/100</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-brand transition-all duration-500"
                    style={{ width: `${status?.complexity ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Routing score</span>
                  <span className="font-medium">{status?.economyScore ?? 0}/100</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-brand transition-all duration-500"
                    style={{ width: `${status?.economyScore ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Context window</span>
                  <span className="font-medium">{Math.round(((status?.tokensIn ?? 0) + (status?.tokensOut ?? 0)) / 4096 * 100)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-brand transition-all duration-500"
                    style={{ width: `${Math.min(100, ((status?.tokensIn ?? 0) + (status?.tokensOut ?? 0)) / 4096 * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pre-flight predictions */}
          {status?.estimatedSavings && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Estimated savings</label>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-xs text-muted-foreground">Tokens</div>
                  <div className="text-sm font-semibold text-brand-violet">
                    {status.estimatedSavings.tokens}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-xs text-muted-foreground">Cost</div>
                  <div className="text-sm font-semibold text-brand-pink">
                    ${status.estimatedSavings.cost.toFixed(4)}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-xs text-muted-foreground">Latency</div>
                  <div className="text-sm font-semibold text-brand-blue">
                    {status.estimatedSavings.latency}ms
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stat rows */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Cpu className="size-3.5 text-brand-blue" />
                Model
              </span>
              <span className="font-medium">{status?.model ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Coins className="size-3.5 text-brand-pink" />
                Actual cost
              </span>
              <span className="font-medium">${status?.cost?.toFixed(6) ?? "0.000000"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="size-3.5 text-brand-blue" />
                Latency
              </span>
              <span className="font-medium">{status?.latencyMs ?? 0}ms</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {status?.cacheHit ? (
                  <CheckCircle2 className="size-3.5 text-green-500" />
                ) : (
                  <XCircle className="size-3.5 text-muted-foreground" />
                )}
                Cache
              </span>
              <span className={`font-medium ${status?.cacheHit ? 'text-green-500' : 'text-muted-foreground'}`}>
                {status?.cacheHit ? 'Hit' : 'Miss'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Gauge className="size-3.5 text-brand-violet" />
                Confidence
              </span>
              <span className="font-medium">{status?.confidence ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BrainCircuit className="size-3.5 text-brand-cyan" />
                Memory
              </span>
              <span className="font-medium">{status?.memory ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Compass className="size-3.5 text-brand-violet" />
                Tokens
              </span>
              <span className="font-medium">
                {status?.tokensIn ?? 0} in · {status?.tokensOut ?? 0} out
              </span>
            </div>
          </div>

          {/* Compression savings */}
          {status?.compressionSavings && status.compressionSavings.tokens > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Compression savings</span>
              <span className="font-medium text-green-500">
                {status.compressionSavings.tokens} tokens ({status.compressionSavings.percentage.toFixed(1)}%)
              </span>
            </div>
          )}

          {/* Routing explanation */}
          {status?.rationale && (
            <div className="rounded-lg bg-muted/50 p-3">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Routing explanation
              </label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {status.rationale}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
