export type AccentColor = "blue" | "violet" | "pink" | "cyan"

export type UserProfile = {
  id: string
  name: string
  email: string
  profession?: string
  avatarUrl?: string
  bio?: string
}

export type Preferences = {
  emailNotifications: boolean
  compactMode: boolean
  showRoutingDetails: boolean
}

export type AiStatus = {
  model: string
  routingDecision: string
  rationale?: string
  tokensIn: number
  tokensOut: number
  cost: number
  latencyMs: number
  confidence: number
  memory: string
  // Enhanced routing metrics
  selectedTier?: number
  skippedTiers?: number[]
  economyScore?: number
  estimatedSavings?: {
    tokens: number
    cost: number
    latency: number
  }
  intent?: string
  complexity?: number
  cacheHit?: boolean
  compressionSavings?: {
    tokens: number
    percentage: number
  }
  // Optimization telemetry
  maxOutputTokens?: number
  temperature?: number
  outputCapped?: boolean
  // Speculative draft / accuracy gate telemetry
  draftConfidence?: number
  draftAccepted?: boolean
  draftReusedAsSeed?: boolean
}

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt?: number
  status?: AiStatus
}

export type Chat = {
  id: string
  title: string
  createdAt: number
  messages: ChatMessage[]
}

export type Project = {
  id: string
  name: string
  description?: string
  accent: AccentColor
  createdAt: number
}

export const ACCENT_GRADIENT: Record<AccentColor, string> = {
  blue: "from-[oklch(0.62_0.19_258)] to-[oklch(0.72_0.14_205)]",
  violet: "from-[oklch(0.58_0.24_295)] to-[oklch(0.62_0.19_258)]",
  pink: "from-[oklch(0.68_0.22_350)] to-[oklch(0.58_0.24_295)]",
  cyan: "from-[oklch(0.72_0.14_205)] to-[oklch(0.62_0.19_258)]",
}
