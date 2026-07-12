/**
 * Fireworks Tier 1 Client
 * All inference routes through the Fireworks API using Minimax M3 models.
 */

import { fireworks } from "@ai-sdk/fireworks"
import { generateText, streamText } from "ai"

// Model used for Tier 1 tasks (cheap, fast, deployed on Fireworks)
const TIER1_MODEL_ID = process.env.FIREWORKS_TIER1_MODEL || "accounts/fireworks/models/minimax-m3"
const TIER1_TIMEOUT_MS = 30_000

export interface FireworksResult {
  text: string
  modelId: string
  inputTokens: number
  outputTokens: number
  durationMs: number
}

/** Tier 1 is always available (cloud API). */
export async function isFireworksAvailable(): Promise<boolean> {
  return true
}

/**
 * Run Tier 1 inference via Fireworks API.
 * Returns null only on network/auth errors — caller should escalate to Tier 2.
 */
export async function runFireworksInference(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<FireworksResult | null> {
  const started = Date.now()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIER1_TIMEOUT_MS)

    const system = messages.find(m => m.role === 'system')?.content
    const userMessages = messages.filter(m => m.role !== 'system')
    const prompt = userMessages.map(m => m.content).join('\n')

    const result = await generateText({
      model: fireworks(TIER1_MODEL_ID),
      system,
      prompt,
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 1024,
      abortSignal: controller.signal,
    })

    clearTimeout(timeoutId)

    return {
      text: result.text,
      modelId: TIER1_MODEL_ID,
      inputTokens: (result.usage as any)?.promptTokens ?? 0,
      outputTokens: (result.usage as any)?.completionTokens ?? 0,
      durationMs: Date.now() - started,
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[Tier1/Fireworks] Timed out — escalating to Tier 2')
    } else {
      console.warn('[Tier1/Fireworks] Unavailable:', err?.message ?? err)
    }
    return null
  }
}

/**
 * Streaming variant — yields text chunks via ReadableStream.
 */
export async function* runFireworksStream(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: { temperature?: number; maxTokens?: number } = {},
): AsyncGenerator<string, void, unknown> {
  try {
    const system = messages.find(m => m.role === 'system')?.content
    const userMessages = messages.filter(m => m.role !== 'system')
    const prompt = userMessages.map(m => m.content).join('\n')

    const { textStream } = streamText({
      model: fireworks(TIER1_MODEL_ID),
      system,
      prompt,
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 1024,
    })

    for await (const chunk of textStream) {
      yield chunk
    }
  } catch (err: any) {
    console.warn('[Tier1/Fireworks] Stream error:', err?.message ?? err)
  }
}
