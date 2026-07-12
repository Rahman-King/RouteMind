/**
 * QwenRouter — Ollama-powered routing intelligence
 * -------------------------------------------------------
 * Uses "qwen-router" via Ollama to classify every request
 * and select the appropriate response tier (1 / 2).
 *
 * "qwen-router" is a custom Ollama model built FROM
 * qwen2.5:0.5b via a local Modelfile, tuned specifically
 * for JSON-only routing decisions (small context, low output,
 * greedy decoding). Build it with:
 *   ollama create qwen-router -f Modelfile
 *
 * Hard timeout: 4 s.  Falls back to deterministicFallback() silently.
 * Enable live routing: set OLLAMA_ROUTER=true in .env
 *
 * IMPORTANT: This module NEVER generates user-facing responses.
 *            Output is always a compact JSON object only.
 */

import type { RouterDecision } from './deterministic-fallback'
import { deterministicFallback, estimateTokens, estimateCost, estimateLatency, calculateEconomyScore } from './deterministic-fallback'

import { ollama } from "ai-sdk-ollama"
import { generateText } from "ai"

// Custom Ollama model (built from qwen2.5:0.5b) — the routing model
const ROUTER_MODEL_ID = "qwen-router"
const ROUTER_TIMEOUT  = parseInt(process.env.OLLAMA_ROUTER_TIMEOUT_MS || '1500', 10)
// Enabled by default — set OLLAMA_ROUTER=false to use only deterministic fallback
const ROUTER_ENABLED  = process.env.OLLAMA_ROUTER !== 'false'

// ── System prompt ──────────────────────────────────────────────────────────
// NOTE: "qwen-router"'s Modelfile now outputs plain text "tier 1" or "tier 2"
// for speed. Parameters: temperature 0.1 / num_ctx 2048 / num_predict 1024 /
// top_k 1 / top_p 1 (greedy decoding). We intentionally do NOT send a duplicate
// `system` prompt at call time below — two different system prompts (Modelfile
// vs. runtime) can conflict. This constant is kept only as documentation of the
// old JSON schema for deterministic fallback reference.
const ROUTER_SYSTEM_PROMPT = `You are RouteMind Router. Analyse the request and output ONLY valid JSON, nothing else.

Tiers:
1 = MiniMax cloud (general chat, summarisation, rewriting, translation, extraction, simple Q&A, factual lookup). complexity 0-50.
2 = Kimi cloud (complex reasoning, multi-step math, long-context, multi-doc analysis, coding, algorithms, data-structures, debugging, refactoring). complexity 45-100

JSON schema (no extra keys, no prose):
{"i":"intent","c":complexity_0_100,"f":confidence_0_100,"s":tier_1_or_2,"r":"reason max 8 words"}`

// ── User prompt — also as compact as possible ─────────────────────────────
function buildUserPrompt(prompt: string, category?: string): string {
  const snippet = prompt.length > 150 ? prompt.slice(0, 150) + '…' : prompt
  let p = `Request: "${snippet}"`
  if (category) p += `\nHint: ${category}`
  return p
}

// ── Parse Qwen's simplified response ───────────────────────────────────────
// Now outputs plain text "tier 1" or "tier 2" instead of JSON
function parseQwenResponse(raw: string, originalPrompt: string): RouterDecision {
  const normalized = raw.toLowerCase().trim()
  let selectedTier: 1 | 2 = 1
  let intent = 'general'
  let complexity = 30
  let confidence = 75

  if (normalized.includes('tier 2') || normalized.includes('tier2')) {
    selectedTier = 2
    intent = 'complex'
    complexity = 70
    confidence = 85
  } else if (normalized.includes('tier 1') || normalized.includes('tier1')) {
    selectedTier = 1
    intent = 'general'
    complexity = 25
    confidence = 80
  } else {
    // Fallback if output doesn't match expected format
    console.warn('[QwenRouter] Unexpected output format, defaulting to Tier 1')
  }

  const predictedTokens  = estimateTokens(originalPrompt, selectedTier)
  const predictedCost    = estimateCost(predictedTokens.total, selectedTier)
  const predictedLatency = estimateLatency(predictedTokens.total, selectedTier)
  const skippedTiers     = Array.from({ length: selectedTier - 1 }, (_, i) => i + 1)

  return {
    intent,
    complexity,
    confidence,
    predictedTokens,
    predictedCost,
    predictedLatency,
    economyScore: calculateEconomyScore(predictedCost, predictedLatency, selectedTier),
    selectedTier,
    skippedTiers,
    explanation: `qwen-router (Ollama) → Tier ${selectedTier}`,
    reasoning: `Direct tier selection from qwen-router`,
  }
}

// ── Main export ───────────────────────────────────────────────────────────
export class QwenRouter {
  /**
   * Classify the prompt and return a RouterDecision.
   * Falls back to deterministicFallback() if Qwen is unavailable or disabled.
   */
  async route(
    prompt: string,
    context?: { category?: string; previousTiers?: number[] },
  ): Promise<RouterDecision> {
    if (!ROUTER_ENABLED) {
      return deterministicFallback(prompt, context?.category)
    }

    try {
      const controller = new AbortController()
      const timeoutId  = setTimeout(() => controller.abort(), ROUTER_TIMEOUT)

      // No `system` override here — qwen-router's Modelfile already bakes in
      // the routing system prompt. temperature/maxOutputTokens match the
      // Modelfile's PARAMETER directives (temperature 0.1, num_predict 1024) so
      // decoding behavior stays consistent between the Modelfile and the call.
      const result = await generateText({
        model: ollama(ROUTER_MODEL_ID, {
          baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
        }),
        prompt: buildUserPrompt(prompt, context?.category),
        temperature: 0.1,
        maxOutputTokens: 1024,
        abortSignal: controller.signal,
      })

      clearTimeout(timeoutId)
      const text = result.text

      console.log('[QwenRouter] Raw response:', text)

      if (!text.trim()) {
        console.warn('[QwenRouter] Empty response — falling back to heuristics')
        return deterministicFallback(prompt, context?.category)
      }

      const decision = parseQwenResponse(text, prompt)
      console.log(`[QwenRouter] → Tier ${decision.selectedTier} | intent: ${decision.intent} | complexity: ${decision.complexity} | confidence: ${decision.confidence}`)
      return decision

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn('[QwenRouter] Timed out — falling back to heuristics')
      } else {
        console.warn('[QwenRouter] Error:', err?.message ?? err)
      }
      return deterministicFallback(prompt, context?.category)
    }
  }
}

// Singleton — shared across all requests
export const qwenRouter = new QwenRouter()

// Re-export RouterDecision so callers don't need two imports
export type { RouterDecision }
