/**
 * Reflection Engine
 * Analyzes routing decisions and outcomes to improve future routing
 */

export interface ReflectionData {
  requestId: string
  prompt: string
  selectedTier: number
  actualTokens: number
  actualCost: number
  actualLatency: number
  predictedTokens: number
  predictedCost: number
  predictedLatency: number
  userSatisfaction?: number // 1-5 scale
  timestamp: number
}

export interface ReflectionInsight {
  category: 'accuracy' | 'efficiency' | 'latency' | 'cost'
  insight: string
  confidence: number
  recommendation: string
}

class ReflectionEngine {
  private reflections = new Map<string, ReflectionData>()
  private insights: ReflectionInsight[] = []
  private maxReflections = 1000

  /**
   * Record a routing decision and its outcome
   */
  recordReflection(data: ReflectionData): void {
    this.reflections.set(data.requestId, data)
    this.evictIfNeeded()
    this.generateInsights(data)
  }

  /**
   * Generate insights from reflection data
   */
  private generateInsights(data: ReflectionData): void {
    const insights: ReflectionInsight[] = []

    // Accuracy insights
    const tokenAccuracy = 1 - Math.abs(data.actualTokens - data.predictedTokens) / data.predictedTokens
    if (tokenAccuracy < 0.8) {
      insights.push({
        category: 'accuracy',
        insight: `Token prediction was inaccurate (${Math.round(tokenAccuracy * 100)}% accuracy)`,
        confidence: 0.8,
        recommendation: 'Adjust token prediction model for this tier',
      })
    }

    // Efficiency insights
    const costAccuracy = 1 - Math.abs(data.actualCost - data.predictedCost) / data.predictedCost
    if (costAccuracy < 0.7) {
      insights.push({
        category: 'efficiency',
        insight: `Cost prediction deviated significantly (${Math.round(costAccuracy * 100)}% accuracy)`,
        confidence: 0.7,
        recommendation: 'Update cost estimation parameters',
      })
    }

    // Latency insights
    const latencyAccuracy = 1 - Math.abs(data.actualLatency - data.predictedLatency) / data.predictedLatency
    if (latencyAccuracy < 0.6) {
      insights.push({
        category: 'latency',
        insight: `Latency prediction was off by ${Math.round(Math.abs(data.actualLatency - data.predictedLatency))}ms`,
        confidence: 0.6,
        recommendation: 'Recalibrate latency estimation for this tier',
      })
    }

    // Cost optimization insights
    if (data.actualCost > data.predictedCost * 1.5) {
      insights.push({
        category: 'cost',
        insight: `Actual cost was ${Math.round((data.actualCost / data.predictedCost - 1) * 100)}% higher than predicted`,
        confidence: 0.9,
        recommendation: 'Consider lower tier for similar requests',
      })
    }

    // Add insights to collection
    this.insights.push(...insights)
    this.limitInsights()
  }

  /**
   * Get recent insights
   */
  getRecentInsights(limit: number = 10): ReflectionInsight[] {
    return this.insights.slice(-limit)
  }

  /**
   * Get insights by category
   */
  getInsightsByCategory(category: ReflectionInsight['category']): ReflectionInsight[] {
    return this.insights.filter(insight => insight.category === category)
  }

  /**
   * Analyze patterns in reflections
   */
  analyzePatterns(): {
    avgTokenAccuracy: number
    avgCostAccuracy: number
    avgLatencyAccuracy: number
    tierPerformance: Record<number, { avgAccuracy: number; count: number }>
  } {
    const reflections = Array.from(this.reflections.values())
    
    if (reflections.length === 0) {
      return {
        avgTokenAccuracy: 0,
        avgCostAccuracy: 0,
        avgLatencyAccuracy: 0,
        tierPerformance: {},
      }
    }

    const tokenAccuracies = reflections.map(r => 
      1 - Math.abs(r.actualTokens - r.predictedTokens) / r.predictedTokens
    )
    const costAccuracies = reflections.map(r =>
      1 - Math.abs(r.actualCost - r.predictedCost) / r.predictedCost
    )
    const latencyAccuracies = reflections.map(r =>
      1 - Math.abs(r.actualLatency - r.predictedLatency) / r.predictedLatency
    )

    // Tier performance
    const tierPerformance: Record<number, { avgAccuracy: number; count: number }> = {}
    for (const reflection of reflections) {
      if (!tierPerformance[reflection.selectedTier]) {
        tierPerformance[reflection.selectedTier] = { avgAccuracy: 0, count: 0 }
      }
      
      const accuracy = (tokenAccuracies[reflections.indexOf(reflection)] +
                       costAccuracies[reflections.indexOf(reflection)] +
                       latencyAccuracies[reflections.indexOf(reflection)]) / 3
      
      tierPerformance[reflection.selectedTier].avgAccuracy += accuracy
      tierPerformance[reflection.selectedTier].count++
    }

    // Calculate averages
    for (const tier in tierPerformance) {
      tierPerformance[tier].avgAccuracy /= tierPerformance[tier].count
    }

    return {
      avgTokenAccuracy: tokenAccuracies.reduce((a, b) => a + b, 0) / tokenAccuracies.length,
      avgCostAccuracy: costAccuracies.reduce((a, b) => a + b, 0) / costAccuracies.length,
      avgLatencyAccuracy: latencyAccuracies.reduce((a, b) => a + b, 0) / latencyAccuracies.length,
      tierPerformance,
    }
  }

  /**
   * Get recommendations based on insights
   */
  getRecommendations(): string[] {
    const patterns = this.analyzePatterns()
    const recommendations: string[] = []

    // Tier-specific recommendations
    for (const [tier, performance] of Object.entries(patterns.tierPerformance)) {
      if (performance.avgAccuracy < 0.7) {
        recommendations.push(`Tier ${tier} prediction accuracy is low (${Math.round(performance.avgAccuracy * 100)}%). Consider recalibration.`)
      }
    }

    // Overall recommendations
    if (patterns.avgTokenAccuracy < 0.8) {
      recommendations.push('Token prediction model needs adjustment.')
    }
    if (patterns.avgCostAccuracy < 0.7) {
      recommendations.push('Cost estimation parameters should be updated.')
    }
    if (patterns.avgLatencyAccuracy < 0.6) {
      recommendations.push('Latency estimation is inaccurate and needs recalibration.')
    }

    return recommendations
  }

  /**
   * Evict old reflections
   */
  private evictIfNeeded(): void {
    if (this.reflections.size > this.maxReflections) {
      const oldestKey = this.reflections.keys().next().value
      if (oldestKey) {
        this.reflections.delete(oldestKey)
      }
    }
  }

  /**
   * Limit insights to prevent memory bloat
   */
  private limitInsights(): void {
    if (this.insights.length > 500) {
      this.insights = this.insights.slice(-500)
    }
  }

  /**
   * Clear all reflections
   */
  clear(): void {
    this.reflections.clear()
    this.insights = []
  }

  /**
   * Get reflection statistics
   */
  getStats() {
    return {
      totalReflections: this.reflections.size,
      totalInsights: this.insights.length,
      patterns: this.analyzePatterns(),
    }
  }
}

// Singleton instance
export const reflectionEngine = new ReflectionEngine()
