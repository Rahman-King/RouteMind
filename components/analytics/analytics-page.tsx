"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { Coins, DollarSign, Gauge, MessageSquare, Timer } from "lucide-react"
import type { AiStatus } from "@/lib/types"
import { compactNumber, currency } from "@/lib/format"
import { useApp } from "@/components/app-provider"
import { AnimatedCounter } from "@/components/motion/animated-counter"
import { Reveal } from "@/components/motion/reveal"
import { Spinner } from "@/components/ui/spinner"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const PIE_COLORS = [
  "var(--brand-violet)",
  "var(--brand-blue)",
  "var(--brand-pink)",
  "var(--brand-cyan)",
  "var(--chart-5)",
]

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_MS = 86_400_000

function StatCard({
  icon: Icon,
  tone,
  value,
  format,
  suffix,
  label,
}: {
  icon: typeof Coins
  tone: string
  value: number
  format?: (n: number) => string
  suffix?: string
  label: string
}) {
  return (
    <div className="glass lift group rounded-3xl p-5">
      <div
        className={cn(
          "mb-4 flex size-11 items-center justify-center rounded-2xl bg-muted transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
          tone,
        )}
      >
        <Icon className="size-5" />
      </div>
      <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
        <AnimatedCounter value={value} format={format} />
        {suffix}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function AnalyticsPage() {
  const { ready, chats } = useApp()

  // Real assistant responses with their routing status and actual timestamp.
  const records = React.useMemo(
    () =>
      chats
        .flatMap((c) => c.messages)
        .filter((m) => Boolean(m.status))
        .map((m) => ({
          status: m.status as AiStatus,
          createdAt: m.createdAt ?? Date.now(),
        })),
    [chats],
  )

  const statuses = React.useMemo<AiStatus[]>(() => records.map((r) => r.status), [records])

  const data = React.useMemo(() => {
    const totalTokens = statuses.reduce(
      (sum, s) => sum + s.tokensIn + s.tokensOut,
      0,
    )
    const totalCost = statuses.reduce((sum, s) => sum + s.cost, 0)
    const avgLatency = statuses.length
      ? Math.round(
          statuses.reduce((sum, s) => sum + s.latencyMs, 0) / statuses.length,
        )
      : 0
    const avgConfidence = statuses.length
      ? Math.round(
          statuses.reduce((sum, s) => sum + s.confidence, 0) / statuses.length,
        )
      : 0

    const avgTokensPerRequest = statuses.length ? Math.round(totalTokens / statuses.length) : 0
    const avgPromptSize = statuses.length ? Math.round(statuses.reduce((sum, s) => sum + s.tokensIn, 0) / statuses.length) : 0
    const avgResponseSize = statuses.length ? Math.round(statuses.reduce((sum, s) => sum + s.tokensOut, 0) / statuses.length) : 0
    const avgCostPerRequest = statuses.length ? (totalCost / statuses.length) : 0

    // Cache hit calculation
    const cacheHits = statuses.filter(s => s.cacheHit || s.selectedTier === 0).length
    const cacheHitRate = statuses.length ? Math.round((cacheHits / statuses.length) * 100) : 0

    // Escalation calculation
    const escalationRate = statuses.length ? Math.round((statuses.filter(s => s.selectedTier === 2).length / statuses.length) * 100) : 0

    // Savings calculations
    const totalSavingsRouting = statuses.reduce((sum, s) => sum + (s.estimatedSavings?.cost || 0), 0)
    const totalSavingsCaching = statuses.reduce((sum, s) => {
      if (s.cacheHit || s.selectedTier === 0) {
        return sum + 0.0002 // Estimate $0.0002 saved per cache lookup hit
      }
      return sum
    }, 0)
    const totalSavingsSummarization = statuses.reduce((sum, s) => {
      if (s.compressionSavings && s.compressionSavings.tokens > 0) {
        return sum + (s.compressionSavings.tokens / 1_000_000) * 0.15 // minimax-m3 rate
      }
      return sum
    }, 0)

    const totalSavings = totalSavingsRouting + totalSavingsCaching + totalSavingsSummarization

    // Real credit and token usage grouped by the actual day each response was generated
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const week = Array.from({ length: 7 }, (_, i) => {
      const dayStart = todayStart.getTime() - (6 - i) * DAY_MS
      const dayEnd = dayStart + DAY_MS
      const dayRecords = records.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd)
      
      const tokens = dayRecords.reduce((sum, r) => sum + r.status.tokensIn + r.status.tokensOut, 0)
      const cost = dayRecords.reduce((sum, r) => sum + r.status.cost, 0)
      
      return {
        day: DAY_LABELS[new Date(dayStart).getDay()],
        tokens: Math.round((tokens / 1000) * 10) / 10,
        cost: Math.round(cost * 100000) / 100000,
      }
    })

    // Model distribution + avg latency by model.
    const byModel = new Map<string, { count: number; latency: number; cost: number }>()
    for (const s of statuses) {
      const cur = byModel.get(s.model) ?? { count: 0, latency: 0, cost: 0 }
      cur.count += 1
      cur.latency += s.latencyMs
      cur.cost += s.cost
      byModel.set(s.model, cur)
    }
    const distribution = [...byModel.entries()].map(([name, v], i) => ({
      name,
      value: v.count,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }))
    const latencyByModel = [...byModel.entries()].map(([name, v]) => ({
      model: name,
      latency: Math.round(v.latency / v.count),
    }))
    const costByModel = [...byModel.entries()].map(([name, v]) => ({
      model: name,
      totalCost: v.cost,
      avgCost: v.cost / v.count,
      count: v.count,
      avgLatency: Math.round(v.latency / v.count),
    }))

    return {
      totalTokens,
      totalCost,
      avgLatency,
      avgConfidence,
      avgTokensPerRequest,
      avgPromptSize,
      avgResponseSize,
      avgCostPerRequest,
      cacheHitRate,
      escalationRate,
      totalSavingsRouting,
      totalSavingsCaching,
      totalSavingsSummarization,
      totalSavings,
      week,
      distribution,
      latencyByModel,
      costByModel,
    }
  }, [statuses, records])

  const areaConfig: ChartConfig = {
    tokens: { label: "Tokens (K)", color: "var(--brand-violet)" },
    cost: { label: "Cost ($)", color: "var(--brand-pink)" },
  }
  const barConfig: ChartConfig = {
    latency: { label: "Latency (ms)", color: "var(--brand-pink)" },
  }
  const comparisonConfig: ChartConfig = {
    cost: { label: "Total Cost ($)", color: "var(--brand-blue)" },
  }
  const pieConfig: ChartConfig = Object.fromEntries(
    data.distribution.map((d) => [d.name, { label: d.name, color: d.fill }]),
  )

  if (!ready) {
    return (
      <div className="flex h-[60svh] items-center justify-center">
        <Spinner className="size-7 text-brand-violet" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Analytics
        </h1>
        <p className="mt-1 text-muted-foreground">
          Usage, cost and performance across your routed conversations.
        </p>
      </div>

      {statuses.length === 0 ? (
        <div className="glass mt-8 flex flex-col items-center rounded-3xl px-6 py-16 text-center">
          <div className="bg-gradient-brand mb-5 flex size-14 items-center justify-center rounded-2xl text-white shadow-glow-sm">
            <MessageSquare className="size-7" />
          </div>
          <h2 className="font-display text-lg font-semibold">No usage yet</h2>
          <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
            Start a chat and your token usage, cost and routing performance will
            appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="stagger-in mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={Coins}
              tone="text-brand-violet"
              value={data.totalTokens}
              format={compactNumber}
              label="Total tokens"
            />
            <StatCard
              icon={DollarSign}
              tone="text-brand-pink"
              value={data.totalCost}
              format={currency}
              label="Total credit cost"
            />
            <StatCard
              icon={Timer}
              tone="text-brand-blue"
              value={data.avgLatency}
              suffix=" ms"
              label="Avg request latency"
            />
            <StatCard
              icon={Coins}
              tone="text-brand-violet"
              value={data.avgTokensPerRequest}
              format={compactNumber}
              label="Avg tokens / request"
            />
            <StatCard
              icon={MessageSquare}
              tone="text-brand-blue"
              value={data.avgPromptSize}
              format={compactNumber}
              label="Avg prompt tokens"
            />
            <StatCard
              icon={MessageSquare}
              tone="text-brand-pink"
              value={data.avgResponseSize}
              format={compactNumber}
              label="Avg response tokens"
            />
            <StatCard
              icon={DollarSign}
              tone="text-brand-pink"
              value={data.avgCostPerRequest}
              format={currency}
              label="Avg cost / request"
            />
            <StatCard
              icon={Gauge}
              tone="text-brand-cyan"
              value={data.cacheHitRate}
              suffix="%"
              label="Cache hit rate (T0)"
            />
            <StatCard
              icon={Gauge}
              tone="text-brand-blue"
              value={data.escalationRate}
              suffix="%"
              label="Escalation rate (T2)"
            />
            <StatCard
              icon={Gauge}
              tone="text-brand-pink"
              value={100 - data.escalationRate}
              suffix="%"
              label="Savings routing rate (T0 + T1)"
            />
            <StatCard
              icon={Gauge}
              tone="text-brand-cyan"
              value={data.avgConfidence}
              suffix="%"
              label="Avg router confidence"
            />
          </div>

          {/* Credit Savings Section */}
          <div className="mt-8">
            <h2 className="font-display text-lg font-bold tracking-tight mb-4">RouteMind Optimization Savings</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="glass rounded-3xl p-5 border border-green-500/20 bg-green-500/5">
                <p className="text-sm text-green-500 font-medium">Total Credit Saved</p>
                <p className="font-display text-2xl font-bold tracking-tight mt-2 text-green-500">${data.totalSavings.toFixed(5)}</p>
                <p className="text-xs text-muted-foreground mt-1">Saved from caches and routing</p>
              </div>
              <div className="glass rounded-3xl p-5">
                <p className="text-sm text-muted-foreground">Routing Savings (T1 vs T2)</p>
                <p className="font-display text-xl font-bold mt-2 text-brand-violet">${data.totalSavingsRouting.toFixed(5)}</p>
                <p className="text-xs text-muted-foreground mt-1">Bypassed expensive T2 model</p>
              </div>
              <div className="glass rounded-3xl p-5">
                <p className="text-sm text-muted-foreground">Caching Savings (T0 hits)</p>
                <p className="font-display text-xl font-bold mt-2 text-brand-pink">${data.totalSavingsCaching.toFixed(5)}</p>
                <p className="text-xs text-muted-foreground mt-1">Bypassed LLM inference completely</p>
              </div>
              <div className="glass rounded-3xl p-5">
                <p className="text-sm text-muted-foreground">Summarization Savings</p>
                <p className="font-display text-xl font-bold mt-2 text-brand-blue">${data.totalSavingsSummarization.toFixed(5)}</p>
                <p className="text-xs text-muted-foreground mt-1">Saved from prompt context compression</p>
              </div>
            </div>
          </div>

          {/* Optimized vs Unoptimized Comparison Chart */}
          <Reveal delay={0.05} className="mt-8 glass rounded-3xl p-5">
            <h3 className="font-display text-base font-semibold">
              Actual Cost vs. Unoptimized Cost
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Visualizing the financial impact of RouteMind's token and routing optimizations.
            </p>
            <ChartContainer config={comparisonConfig} className="h-40 w-full max-w-2xl mx-auto">
              <BarChart
                data={[
                  { name: 'Without RouteMind', cost: data.totalCost + data.totalSavings, fill: 'var(--brand-pink)' },
                  { name: 'With RouteMind', cost: data.totalCost, fill: 'var(--brand-cyan)' },
                ]}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                  {
                    [
                      { name: 'Without RouteMind', cost: data.totalCost + data.totalSavings, fill: 'var(--brand-pink)' },
                      { name: 'With RouteMind', cost: data.totalCost, fill: 'var(--brand-cyan)' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ChartContainer>
          </Reveal>

          {/* Charts Row */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Reveal className="glass rounded-3xl p-5 lg:col-span-2">
              <h3 className="font-display text-base font-semibold">
                Daily token & credit usage trend (Last 7 days)
              </h3>
              <ChartContainer config={areaConfig} className="mt-4 h-64 w-full">
                <AreaChart data={data.week} margin={{ left: 4, right: 4 }}>
                  <defs>
                    <linearGradient id="fillTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--brand-violet)"
                        stopOpacity={0.7}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--brand-violet)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--brand-pink)"
                        stopOpacity={0.7}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--brand-pink)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="tokens"
                    type="natural"
                    stroke="var(--brand-violet)"
                    strokeWidth={2}
                    fill="url(#fillTokens)"
                    name="Tokens (K)"
                  />
                  <Area
                    dataKey="cost"
                    type="natural"
                    stroke="var(--brand-pink)"
                    strokeWidth={2}
                    fill="url(#fillCost)"
                    name="Cost ($)"
                  />
                </AreaChart>
              </ChartContainer>
            </Reveal>

            <Reveal delay={0.1} className="glass rounded-3xl p-5">
              <h3 className="font-display text-base font-semibold">
                Model distribution
              </h3>
              <ChartContainer
                config={pieConfig}
                className="mx-auto mt-4 aspect-square h-52"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={data.distribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    strokeWidth={2}
                  >
                    {data.distribution.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="mt-2 flex flex-col gap-2">
                {data.distribution.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="text-muted-foreground text-xs">{d.name}</span>
                    </span>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Model Cost & Latency Performance Table */}
            <Reveal delay={0.15} className="glass rounded-3xl p-5 lg:col-span-3">
              <h3 className="font-display text-base font-semibold mb-4">
                Model Cost & Latency Performance Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground text-xs font-semibold">
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3">Total Requests</th>
                      <th className="py-2.5 px-3">Avg Latency</th>
                      <th className="py-2.5 px-3">Avg Cost</th>
                      <th className="py-2.5 px-3">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.costByModel.map((row) => (
                      <tr key={row.model} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-brand-violet">{row.model}</td>
                        <td className="py-2.5 px-3">{row.count}</td>
                        <td className="py-2.5 px-3">{row.avgLatency} ms</td>
                        <td className="py-2.5 px-3">${row.avgCost.toFixed(5)}</td>
                        <td className="py-2.5 px-3 font-semibold text-brand-pink">${row.totalCost.toFixed(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>

            <Reveal delay={0.2} className="glass rounded-3xl p-5 lg:col-span-3">
              <h3 className="font-display text-base font-semibold">
                Average latency by model (ms)
              </h3>
              <ChartContainer config={barConfig} className="mt-4 h-64 w-full">
                <BarChart data={data.latencyByModel} margin={{ left: 4, right: 4 }}>
                  <defs>
                    <linearGradient id="fillLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-pink)" />
                      <stop offset="100%" stopColor="var(--brand-blue)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="model"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="latency"
                    fill="url(#fillLatency)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </Reveal>
          </div>
        </>
      )}
    </div>
  )
}
