/**
 * Routing Decision Engine
 * Multi-factor scoring for intelligent tier selection
 */

import type { RouterDecision } from '../router/gemma-router'
import { economyEngine } from '../economy/engine'

export interface DecisionFactors {
  intent: string
  complexity: number
  confidence: number
  tokenCost: number
  monetaryCost: number
  latency: number
  historicalSuccess: number
  cacheProbability: number
  economyScore: number
}

export interface RoutingDecision {
  selectedTier: 1 | 2
  factors: DecisionFactors
  scores: {
    tier1: number
    tier2: number
  }
  reasoning: string
  skippedTiers: number[]
  estimatedSavings: {
    tokens: number
    cost: number
    latency: number
  }
}

class RoutingDecisionEngine {
  private historicalData = new Map<string, { success: number; total: number }>()
  private cacheHitRates = new Map<string, number>()

  /**
   * Make routing decision based on multiple factors
   */
  async decide(
    routerDecision: RouterDecision,
    context?: {
      userId?: string
      sessionId?: string
      previousTiers?: number[]
      budgetConstraints?: { tokens: number; cost: number }
      tierOneAvailable?: boolean  // always true (Fireworks cloud API)
    }
  ): Promise<RoutingDecision> {
    const factors = this.calculateFactors(routerDecision, context)
    const scores = this.calculateScores(factors, context)
    const selectedTier = this.selectTier(scores, factors, context)
    
    const skippedTiers = this.determineSkippedTiers(selectedTier, context)
    const estimatedSavings = this.calculateEstimatedSavings(selectedTier, factors, scores)

    return {
      selectedTier,
      factors,
      scores,
      reasoning: this.generateReasoning(selectedTier, factors, scores),
      skippedTiers,
      estimatedSavings,
    }
  }

  /**
   * Calculate decision factors
   */
  private calculateFactors(
    routerDecision: RouterDecision,
    context?: any
  ): DecisionFactors {
    return {
      intent: routerDecision.intent,
      complexity: routerDecision.complexity,
      confidence: routerDecision.confidence,
      tokenCost: routerDecision.predictedTokens.total,
      monetaryCost: routerDecision.predictedCost,
      latency: routerDecision.predictedLatency,
      historicalSuccess: this.getHistoricalSuccess(routerDecision.intent, context?.userId),
      cacheProbability: this.getCacheProbability(routerDecision.intent, context?.sessionId),
      economyScore: routerDecision.economyScore,
    }
  }

  /**
   * Calculate scores for each tier
   */
  private calculateScores(
    factors: DecisionFactors,
    context?: any
  ): { tier1: number; tier2: number } {
    const scores = {
      tier1: this.calculateTierScore(1, factors, context),
      tier2: this.calculateTierScore(2, factors, context),
    }

    return scores
  }

  /**
   * Calculate score for a specific tier
   */
  private calculateTierScore(
    tier: number,
    factors: DecisionFactors,
    context?: any
  ): number {
    let score = 0

    // Complexity match is the primary routing signal (2-tier system)
    const complexityMatch = this.calculateComplexityMatch(tier, factors.complexity)
    score += complexityMatch * 60

    // Economy bias: Tier 1 is cheaper, so give it a modest cost-saving bonus.
    // Scaled for a 2-tier system so it never overrides a strong complexity match.
    const economyBonus = (2 - tier) * 5
    score += economyBonus

    // Historical success
    score += factors.historicalSuccess * 20

    // Cache probability
    score += factors.cacheProbability * 15

    // Budget constraints
    if (context?.budgetConstraints) {
      const budgetFit = this.calculateBudgetFit(tier, factors, context.budgetConstraints)
      score += budgetFit * 25
    }

    // Latency preference: Tier 1 is faster
    const latencyScore = (2 - tier) * 3
    score += latencyScore

    return Math.min(100, Math.max(0, score))
  }

  /**
   * Calculate how well a tier matches complexity
   */
  private calculateComplexityMatch(tier: number, complexity: number): number {
    // Tier 1 (minimax-m3/Fireworks): general tasks 0-50
    // Tier 2 (kimi-k2p6): complex tasks 45-100
    const tierComplexityRanges: Record<number, [number, number]> = {
      1: [0, 50],
      2: [45, 100],
    }

    const range = tierComplexityRanges[tier]
    if (!range) return 0
    const [min, max] = range
    
    if (complexity >= min && complexity <= max) {
      // For Tier 1, give extra bonus for very low complexity
      if (tier === 1 && complexity < 25) {
        return 1.2 // Strong preference for Tier 1 on simple tasks
      }
      return 1.0
    }
    
    // Calculate distance from range with tier-specific penalties
    const distance = complexity < min ? min - complexity : complexity - max
    const penaltyFactor = tier === 1 ? 30 : 40 // Less penalty for Tier 1 being slightly off
    return Math.max(0, 1 - distance / penaltyFactor)
  }

  /**
   * Calculate budget fit
   */
  private calculateBudgetFit(
    tier: number,
    factors: DecisionFactors,
    constraints: { tokens: number; cost: number }
  ): number {
    const tierCosts = {
      1: { tokens: 100, cost: 0.01 },
      2: { tokens: 500, cost: 0.05 },
    }

    const tierCost = tierCosts[tier as keyof typeof tierCosts]
    
    const tokenFit = factors.tokenCost <= constraints.tokens ? 1 : 0
    const costFit = factors.monetaryCost <= constraints.cost ? 1 : 0
    
    return (tokenFit + costFit) / 2
  }

  /**
   * Select best tier based on scores
   */
  private selectTier(
    scores: { tier1: number; tier2: number },
    factors: DecisionFactors,
    context?: any
  ): 1 | 2 {
    const tierScores: Array<{ tier: 1 | 2; score: number }> = [
      { tier: 1, score: scores.tier1 },
      { tier: 2, score: scores.tier2 },
    ]

    // Sort by score (descending)
    tierScores.sort((a, b) => b.score - a.score)

    // Check budget constraints
    if (context?.budgetConstraints) {
      for (const { tier } of tierScores) {
        if (economyEngine.isWithinBudget(
          factors.tokenCost * (tier / 3),
          factors.monetaryCost * (tier / 3)
        )) {
          return tier
        }
      }
    }

    // Return highest scoring tier
    return tierScores[0].tier
  }

  /**
   * Determine which tiers were skipped
   */
  private determineSkippedTiers(
    selectedTier: number,
    context?: any
  ): number[] {
    const skipped: number[] = []
    
    for (let i = 1; i < selectedTier; i++) {
      // Skip if previously tried and failed
      if (context?.previousTiers?.includes(i)) {
        continue
      }
      skipped.push(i)
    }

    return skipped
  }

  /**
   * Calculate estimated savings
   */
  private calculateEstimatedSavings(
    selectedTier: number,
    factors: DecisionFactors,
    scores: { tier1: number; tier2: number }
  ): { tokens: number; cost: number; latency: number } {
    // Compare with highest paid tier (Tier 2)
    const topTierTokens = factors.tokenCost * (2 / Math.max(selectedTier, 1))
    const topTierCost = factors.monetaryCost * (2 / Math.max(selectedTier, 1))
    const topTierLatency = factors.latency * (2 / Math.max(selectedTier, 1))

    return {
      tokens: Math.round(topTierTokens - factors.tokenCost),
      cost: Math.round((topTierCost - factors.monetaryCost) * 10000) / 10000,
      latency: Math.round(topTierLatency - factors.latency),
    }
  }

  /**
   * Generate reasoning for decision
   */
  private generateReasoning(
    selectedTier: number,
    factors: DecisionFactors,
    scores: { tier1: number; tier2: number }
  ): string {
    const tierNames: Record<number, string> = {
      1: 'Minimax M3 Tier (Fireworks)',
      2: 'Kimi K2P6 Tier (Fireworks)',
    }

    const reasons = [
      `Selected ${tierNames[selectedTier] ?? `Tier ${selectedTier}`} based on multi-factor analysis.`,
      `Complexity score: ${factors.complexity}/100, confidence: ${factors.confidence}%`,
      `Economy score: ${factors.economyScore}/100, historical success: ${Math.round(factors.historicalSuccess * 100)}%`,
    ]

    if (factors.cacheProbability > 0.5) {
      reasons.push(`High cache probability (${Math.round(factors.cacheProbability * 100)}%) influenced decision.`)
    }

    return reasons.join(' ')
  }

  /**
   * Get historical success rate for intent
   */
  private getHistoricalSuccess(intent: string, userId?: string): number {
    const key = userId ? `${userId}:${intent}` : intent
    const data = this.historicalData.get(key)
    
    if (!data || data.total === 0) return 0.5 // Default to 50%
    
    return data.success / data.total
  }

  /**
   * Update historical success data
   */
  updateHistoricalSuccess(
    intent: string,
    success: boolean,
    userId?: string
  ): void {
    const key = userId ? `${userId}:${intent}` : intent
    const data = this.historicalData.get(key) || { success: 0, total: 0 }
    
    data.total++
    if (success) data.success++
    
    this.historicalData.set(key, data)
  }

  /**
   * Get cache probability for intent
   */
  private getCacheProbability(intent: string, sessionId?: string): number {
    const key = sessionId ? `${sessionId}:${intent}` : intent
    return this.cacheHitRates.get(key) ?? 0
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(intent: string, hit: boolean, sessionId?: string): void {
    const key = sessionId ? `${sessionId}:${intent}` : intent
    const currentRate = this.cacheHitRates.get(key) ?? 0
    
    // Simple moving average
    const newRate = currentRate * 0.9 + (hit ? 0.1 : 0)
    this.cacheHitRates.set(key, newRate)
  }

  /**
   * Clear historical data
   */
  clearHistoricalData(): void {
    this.historicalData.clear()
    this.cacheHitRates.clear()
  }
}

// Singleton instance
export const routingDecisionEngine = new RoutingDecisionEngine()
