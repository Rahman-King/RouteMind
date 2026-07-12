import type { AiStatus, ChatMessage } from "@/lib/types"

export type AssistantResult = {
  text: string
  status: AiStatus
}

export type RoutingConfig = {
  mode?: string
  forceTier?: string
  taskMode?: string
  reasoning?: number
  creativity?: number
  maxOutput?: number
}

// Calls the server route, which routes the prompt to a real Fireworks model
// and returns the generated text plus the ACTUAL token usage, cost and latency.
export async function generateAssistant(
  prompt: string,
  messages?: ChatMessage[],
  routingConfig?: RoutingConfig
): Promise<AssistantResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, messages, routingConfig }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? `Request failed with status ${res.status}`)
  }

  return (await res.json()) as AssistantResult
}
