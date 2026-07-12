"use client"

// AI Controls component for routing configuration
import * as React from "react"
import { ChevronDown, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

type RoutingMode = "automatic" | "manual"
type ForceTier = "auto" | "tier0" | "tier1" | "tier2"
type TaskMode = "auto" | "coding" | "math" | "writing" | "learning" | "web" | "document" | "analysis" | "chat"

export interface RoutingConfig {
  mode: RoutingMode
  forceTier: ForceTier
  taskMode: TaskMode
  reasoning: number
  creativity: number
  maxOutput: number
}

interface AIControlsProps {
  config: RoutingConfig
  onConfigChange: (config: RoutingConfig) => void
}

export const AIControls = React.memo(function AIControls({ config, onConfigChange }: AIControlsProps) {
  const [open, setOpen] = React.useState(true)

  const taskModes = [
    { id: "auto", emoji: "✨", label: "Auto" },
    { id: "coding", emoji: "💻", label: "Code" },
    { id: "math", emoji: "🧮", label: "Math" },
    { id: "writing", emoji: "📝", label: "Write" },
    { id: "learning", emoji: "🎓", label: "Learn" },
    { id: "web", emoji: "🌐", label: "Web" },
    { id: "document", emoji: "📄", label: "Doc" },
    { id: "analysis", emoji: "📊", label: "Analyze" },
    { id: "chat", emoji: "💬", label: "Chat" },
  ]

  const resetDefaults = () => {
    onConfigChange({
      mode: "automatic",
      forceTier: "auto",
      taskMode: "auto",
      reasoning: 50,
      creativity: 50,
      maxOutput: 2000,
    })
  }

  const getSummary = () => {
    const modeText = config.mode === "automatic" ? "Automatic routing" : "Manual routing"
    const tierText = config.forceTier === "auto" ? "✨ Auto detect" : `Tier ${config.forceTier.replace("tier", "")}`
    const taskText = config.taskMode === "auto" ? "Auto" : taskModes.find(t => t.id === config.taskMode)?.label || "Auto"
    const reasoningText = config.reasoning < 33 ? "Fast" : config.reasoning < 66 ? "Medium" : "Maximum"
    return `${modeText} · ${tierText} · ${taskText} · ${reasoningText}`
  }

  return (
    <div className="glass rounded-2xl">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="relative flex size-2.5 shrink-0">
          <span className="bg-gradient-brand absolute inline-flex size-full animate-ping rounded-full opacity-60" />
          <span className="bg-gradient-brand relative inline-flex size-2.5 rounded-full" />
        </span>
        <span className="text-sm font-medium">AI Controls</span>
        <span className="truncate text-sm text-muted-foreground">
          · {getSummary()}
        </span>
        <ChevronDown
          className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border/60 px-3.5 py-3.5 space-y-4">
          {/* Routing Mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Routing mode</label>
            <div className="flex gap-1">
              {(["automatic", "manual"] as RoutingMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onConfigChange({ ...config, mode })}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    config.mode === mode
                      ? "bg-gradient-brand text-white shadow-lg shadow-brand/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Force Tier */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Force tier</label>
            <div className="flex gap-1">
              {(["auto", "tier0", "tier1", "tier2"] as ForceTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => onConfigChange({ ...config, forceTier: tier })}
                  disabled={config.mode === "automatic"}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                    config.forceTier === tier
                      ? "bg-gradient-brand text-white shadow-lg shadow-brand/20"
                      : config.mode === "automatic"
                      ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tier === "auto" ? "Auto" : tier.replace("tier", "T")}
                </button>
              ))}
            </div>
          </div>

          {/* Task Mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Task mode</label>
            <div className="grid grid-cols-3 gap-2">
              {taskModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onConfigChange({ ...config, taskMode: mode.id as TaskMode })}
                  className={`group relative flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 transition-all duration-300 ${
                    config.taskMode === mode.id
                      ? "bg-gradient-to-br from-violet-500/20 to-purple-600/20 text-violet-700 dark:text-violet-300 shadow-lg shadow-violet-500/20 border border-violet-500/30 scale-105"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:scale-102 border border-transparent hover:border-border/50"
                  }`}
                >
                  <span className={`text-2xl transition-transform duration-300 ${
                    config.taskMode === mode.id ? "scale-110" : "group-hover:scale-110"
                  }`}>{mode.emoji}</span>
                  <span className="text-[11px] font-medium">{mode.label}</span>
                  {config.taskMode === mode.id && (
                    <span className="absolute -top-1 -right-1 flex size-3">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400 opacity-75" />
                      <span className="relative inline-flex size-3 rounded-full bg-violet-500" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Reasoning Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Reasoning</label>
              <span className="text-xs text-muted-foreground">
                {config.reasoning < 33 ? "Fast" : config.reasoning < 66 ? "Balanced" : "Maximum"}
              </span>
            </div>
            <Slider
              value={[config.reasoning]}
              onValueChange={([value]) => onConfigChange({ ...config, reasoning: value })}
              min={0}
              max={100}
              step={1}
              className="cursor-pointer"
            />
          </div>

          {/* Creativity vs Precision Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Creativity vs precision</label>
              <span className="text-xs text-muted-foreground">
                {config.creativity < 33 ? "Precise" : config.creativity < 66 ? "Balanced" : "Creative"}
              </span>
            </div>
            <Slider
              value={[config.creativity]}
              onValueChange={([value]) => onConfigChange({ ...config, creativity: value })}
              min={0}
              max={100}
              step={1}
              className="cursor-pointer"
            />
          </div>

          {/* Max Output Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Max output</label>
              <span className="text-xs text-muted-foreground">{config.maxOutput} tokens</span>
            </div>
            <Slider
              value={[config.maxOutput]}
              onValueChange={([value]) => onConfigChange({ ...config, maxOutput: value })}
              min={256}
              max={8192}
              step={256}
              className="cursor-pointer"
            />
          </div>

          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={resetDefaults}
            className="w-full gap-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Reset to defaults
          </Button>
        </div>
      )}
    </div>
  )
})
