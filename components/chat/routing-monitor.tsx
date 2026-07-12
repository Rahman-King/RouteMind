"use client"

import * as React from "react"
import { PanelRightClose, PanelRightOpen, Zap, Settings, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AIControls, type RoutingConfig } from "./ai-controls"
import { RoutingStatusPanel } from "./routing-status-panel"
import type { AiStatus } from "@/lib/types"

export type { RoutingConfig }

interface RoutingMonitorProps {
  status?: AiStatus
  onConfigChange?: (config: RoutingConfig) => void
  onOpenChange?: (open: boolean) => void
}

export const RoutingMonitor = React.memo(function RoutingMonitor({ status, onConfigChange, onOpenChange }: RoutingMonitorProps) {
  const [open, setOpen] = React.useState(true)

  React.useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])
  const [routingConfig, setRoutingConfig] = React.useState<RoutingConfig>({
    mode: "automatic",
    forceTier: "auto",
    taskMode: "auto",
    reasoning: 50,
    creativity: 50,
    maxOutput: 2000,
  })

  const handleConfigChange = (newConfig: RoutingConfig) => {
    setRoutingConfig(newConfig)
    onConfigChange?.(newConfig)
  }

  if (!open) {
    return (
      <div className="flex items-center w-12 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="h-full w-12 rounded-l-xl rounded-r-none border-l border-t border-b border-border/60 bg-muted/50 hover:bg-muted transition-all duration-300 hover:shadow-glow-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          aria-label="Open routing monitor"
        >
          <PanelRightOpen className="size-5 transition-transform duration-200 hover:scale-110" />
        </Button>
      </div>
    )
  }

  return (
    <div className="w-80 border-l border-border/60 bg-background/95 backdrop-blur-sm flex-shrink-0 flex flex-col h-full transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-gradient-brand-soft">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-brand-violet/10">
            <Zap className="size-4 text-brand-violet animate-glow-pulse" />
          </div>
          <h2 className="text-sm font-semibold">Routing Monitor</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(false)}
          className="h-8 w-8 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring/50"
          aria-label="Close routing monitor"
        >
          <PanelRightClose className="size-4 transition-transform duration-200 hover:rotate-90" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AIControls config={routingConfig} onConfigChange={handleConfigChange} />
        <RoutingStatusPanel status={status} defaultOpen={true} />
      </div>
    </div>
  )
})
