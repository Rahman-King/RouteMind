"use client"

import * as React from "react"
import {
  BrainCircuit,
  ChevronDown,
  Coins,
  Compass,
  Cpu,
  DollarSign,
  Gauge,
  Timer,
} from "lucide-react"
import type { AiStatus } from "@/lib/types"
import { currency } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

function Row({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof Compass
  tone: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted",
          tone,
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

export function AiStatusPanel({
  status,
  defaultOpen = false,
}: {
  status: AiStatus
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="glass w-full rounded-2xl"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <span className="relative flex size-2.5 shrink-0">
          <span className="bg-gradient-brand absolute inline-flex size-full animate-ping rounded-full opacity-60" />
          <span className="bg-gradient-brand relative inline-flex size-2.5 rounded-full" />
        </span>
        <span className="text-sm font-medium">AI Status</span>
        <span className="truncate text-sm text-muted-foreground">
          · {status.model}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="border-t border-border/60 px-3.5 py-3.5">
          {status.rationale && (
            <p className="mb-3.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              {status.rationale}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Row
              icon={Compass}
              tone="text-brand-violet"
              label="Routing decision"
              value={status.routingDecision}
            />
            <Row
              icon={Cpu}
              tone="text-brand-blue"
              label="Model used"
              value={status.model}
            />
            <Row
              icon={Coins}
              tone="text-brand-cyan"
              label="Token usage"
              value={`${status.tokensIn} in · ${status.tokensOut} out`}
            />
            <Row
              icon={DollarSign}
              tone="text-brand-pink"
              label="Cost"
              value={currency(status.cost)}
            />
            <Row
              icon={Timer}
              tone="text-brand-blue"
              label="Latency"
              value={`${status.latencyMs} ms`}
            />
            <Row
              icon={Gauge}
              tone="text-brand-violet"
              label="Confidence"
              value={`${status.confidence}%`}
            />
            <Row
              icon={BrainCircuit}
              tone="text-brand-cyan"
              label="Memory"
              value={status.memory}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
