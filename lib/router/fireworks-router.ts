/**
 * @deprecated FireworksRouter is NO LONGER USED in the hot path.
 * It has been replaced by QwenRouter (lib/router/gemma-router.ts) which
 * uses Qwen2.5:0.5b via Ollama for intelligent routing decisions.
 *
 * This file is kept for reference only.
 * Do NOT import fireworksRouter in new code.
 */

import { fireworks } from "@ai-sdk/fireworks"
import { generateText } from "ai"
import { ROUTER_MODEL } from "../models/registry"

export interface RouterDecision {
  intent: string
  complexity: number // 0-100 scale
  confidence: number // 0-100 scale
  predictedTokens: {
    input: number
    output: number
    total: number
  }
  predictedCost: number
  predictedLatency: number
  economyScore: number // 0-100 scale
  selectedTier: 1 | 2
  skippedTiers: number[]
  explanation: string
  reasoning: string
}

export interface RouterConfig {
  model: string
  maxTokens: number
  temperature: number
}

const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  model: ROUTER_MODEL.id,
  maxTokens: 512,
  temperature: 0.3,
}

class FireworksRouter {
  private config: RouterConfig

  constructor(config?: Partial<RouterConfig>) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config }
  }

  /**
   * Make routing decision using Fireworks model
   */
  async route(prompt: string, context?: {
    category?: string
    previousTiers?: number[]
    userPreferences?: any
  }): Promise<RouterDecision> {
    const systemPrompt = this.buildSystemPrompt()
    const userPrompt = this.buildUserPrompt(prompt, context)

    try {
      const result = await generateText({
        model: fireworks(this.config.model),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: this.config.temperature,
        // Bound the router's own output — it only emits a small JSON object,
        // so a tight cap keeps routing fast and cheap.
        maxOutputTokens: this.config.maxTokens,
      })

      console.log("[v0] router raw finishReason:", result.finishReason, "outTokens:", result.usage?.outputTokens, "text:", result.text?.slice(0, 400))
      // Parse the structured response
      const decision = this.parseRouterResponse(result.text, prompt)
      return decision
    } catch (error) {
      console.error('Router error:', error)
      // Fallback to simple routing
      return this.fallbackRouting(prompt, context)
    }
  }

  /**
   * Build system prompt for router
   */
  private buildSystemPrompt(): string {
    return `You are RouteMind Router. Decide which tier a request needs:
- Tier 1: Simple tasks (greetings, factual lookup, short summaries, simple Q&A). Complexity 0-30.
- Tier 2: Complex tasks (coding, expert analysis, deep multi-step reasoning, math, translation, extraction). Complexity 25-100.
Return ONLY JSON with these exact keys:
{
  "i": "intent",
  "c": complexity (0-100),
  "f": confidence (0-100),
  "t": {"in": predicted_input_tokens, "out": predicted_output_tokens, "tot": total_tokens},
  "c_": predicted_cost,
  "l": predicted_latency_ms,
  "e": economy_score (0-100),
  "s": selected_tier (1 or 2),
  "x": "explanation (max 5 words)",
  "r": "reasoning (max 5 words)"
}`
  }

  /**
   * Build user prompt for router
   */
  private buildUserPrompt(prompt: string, context?: any): string {
    let userPrompt = `Request: "${prompt}"\n\n`
    
    if (context?.category) {
      userPrompt += `Detected Category: ${context.category}\n`
    }
    
    if (context?.previousTiers && context.previousTiers.length > 0) {
      userPrompt += `Previously tried tiers: ${context.previousTiers.join(', ')}\n`
    }
    
    userPrompt += `\nAnalyze this request and return routing decision as JSON.`
    
    return userPrompt
  }

  /**
   * Parse router response into structured decision
   */
  private parseRouterResponse(response: string, originalPrompt: string): RouterDecision {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const raw = JSON.parse(jsonMatch[0])
      
      // Map short keys to original keys
      const parsed: any = {
        intent: raw.i || 'general',
        complexity: raw.c !== undefined ? raw.c : 50,
        confidence: raw.f !== undefined ? raw.f : 80,
        selectedTier: raw.s || 1,
        explanation: raw.x || '',
        reasoning: raw.r || '',
      }

      if (raw.t) {
        parsed.predictedTokens = {
          input: raw.t.in || 0,
          output: raw.t.out || 0,
          total: raw.t.tot || 0
        }
      }
      
      if (raw.c_) parsed.predictedCost = raw.c_
      if (raw.l) parsed.predictedLatency = raw.l
      if (raw.e) parsed.economyScore = raw.e
      
      // Ensure values are in correct ranges
      parsed.complexity = Math.min(100, Math.max(0, parsed.complexity))
      parsed.confidence = Math.min(100, Math.max(0, parsed.confidence))
      parsed.selectedTier = Math.min(2, Math.max(1, parsed.selectedTier)) as 1 | 2
      
      // Calculate skipped tiers
      const skippedTiers = []
      for (let i = 1; i < parsed.selectedTier; i++) {
        skippedTiers.push(i)
      }
      parsed.skippedTiers = skippedTiers

      // Ensure predicted tokens has defaults
      if (!parsed.predictedTokens) {
        parsed.predictedTokens = this.estimateTokens(originalPrompt, parsed.selectedTier)
      }

      // Ensure predicted cost and latency
      if (!parsed.predictedCost) {
        parsed.predictedCost = this.estimateCost(parsed.predictedTokens.total, parsed.selectedTier)
      }
      if (!parsed.predictedLatency) {
        parsed.predictedLatency = this.estimateLatency(parsed.predictedTokens.total, parsed.selectedTier)
      }

      // Calculate economy score if not provided
      if (!parsed.economyScore) {
        parsed.economyScore = this.calculateEconomyScore(parsed)
      }

      return parsed as RouterDecision
    } catch (error) {
      console.error('Failed to parse router response:', error)
      return this.fallbackRouting(originalPrompt)
    }
  }

  /**
   * Fallback routing when LLM router fails
   */
  private fallbackRouting(prompt: string, context?: any): RouterDecision {
    const lowerPrompt = prompt.toLowerCase()
    const length = prompt.length
    
    let selectedTier: 1 | 2 = 1
    let intent = 'general'
    let complexity = 20
    let confidence = 70

    // Simple heuristic routing
    if (/(code|function|bug|api|typescript|python|sql|regex|compile|debug|complex|difficult|challenging|expert|advanced|sophisticated)/.test(lowerPrompt)) {
      selectedTier = 2
      intent = 'coding'
      complexity = 75
      confidence = 85
    } else if (/(explain|why|analyze|strategy|architecture|reason|compare|plan|design)/.test(lowerPrompt) || length > 220) {
      selectedTier = 2
      intent = 'reasoning'
      complexity = 45
      confidence = 80
    }

    const predictedTokens = this.estimateTokens(prompt, selectedTier)
    const predictedCost = this.estimateCost(predictedTokens.total, selectedTier)
    const predictedLatency = this.estimateLatency(predictedTokens.total, selectedTier)
    const skippedTiers = Array.from({ length: selectedTier - 1 }, (_, i) => i + 1)
    
    const decision: RouterDecision = {
      intent,
      complexity,
      confidence,
      predictedTokens,
      predictedCost,
      predictedLatency,
      economyScore: this.calculateEconomyScore({ predictedTokens, predictedCost, predictedLatency, selectedTier }),
      selectedTier,
      skippedTiers,
      explanation: this.generateExplanation(selectedTier, intent, complexity),
      reasoning: 'Fallback routing due to LLM router failure',
    }

    return decision
  }

  /**
   * Estimate token usage based on prompt and tier
   */
  private estimateTokens(prompt: string, tier: number): { input: number; output: number; total: number } {
    const inputTokens = Math.ceil(prompt.length / 4) // Rough estimate
    
    // Output tokens increase with tier complexity
    const outputMultipliers = { 1: 1.5, 2: 2.5 }
    const outputTokens = Math.ceil(inputTokens * outputMultipliers[tier as keyof typeof outputMultipliers])
    
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    }
  }

  /**
   * Estimate cost based on tokens and tier
   */
  private estimateCost(totalTokens: number, tier: number): number {
    // Cost per 1M tokens by tier (approximate Fireworks pricing)
    const costPerMillion = { 1: 0.15, 2: 0.50 }
    const costPerToken = costPerMillion[tier as keyof typeof costPerMillion] / 1_000_000
    return totalTokens * costPerToken
  }

  /**
   * Estimate latency based on tokens and tier
   */
  private estimateLatency(totalTokens: number, tier: number): number {
    // Base latency by tier (ms)
    const baseLatency = { 1: 500, 2: 1000 }
    const tokenFactor = totalTokens / 1000 * 100 // 100ms per 1000 tokens
    
    return baseLatency[tier as keyof typeof baseLatency] + tokenFactor
  }

  /**
   * Calculate economy score (higher is better)
   */
  private calculateEconomyScore(decision: any): number {
    // Economy score balances cost, latency, and tier efficiency
    const { predictedCost, predictedLatency, selectedTier } = decision
    
    // Lower cost and latency = higher score
    const costScore = Math.max(0, 100 - (predictedCost * 1000)) // Normalize cost
    const latencyScore = Math.max(0, 100 - (predictedLatency / 50)) // Normalize latency
    
    // Tier efficiency (lower tier is more economical)
    const tierScore = (5 - selectedTier) * 20
    
    return Math.round((costScore + latencyScore + tierScore) / 3)
  }

  /**
   * Generate explanation for routing decision
   */
  private generateExplanation(tier: number, intent: string, complexity: number): string {
    const tierNames = {
      1: 'Fast Tier',
      2: 'Reasoning Tier',
    }
    
    return `Selected ${tierNames[tier as keyof typeof tierNames]} for ${intent} task with complexity score ${complexity}/100.`
  }
}

// Singleton instance
export const fireworksRouter = new FireworksRouter()
