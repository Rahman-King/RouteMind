/**
 * Self-Learning Systems Entry Point
 * Exports all learning components
 */

import { reflectionEngine } from './reflection'
import { knowledgeBase } from './knowledge-base'
import { adaptiveThresholdLearning } from './adaptive-thresholds'
import { qwenLearner } from './gemma-learner'

export { reflectionEngine, type ReflectionData, type ReflectionInsight } from './reflection'
export { knowledgeBase, type KnowledgeEntry, type RuleEntry } from './knowledge-base'
export { adaptiveThresholdLearning, type ThresholdConfig, type ThresholdMetrics } from './adaptive-thresholds'
export { qwenLearner, type RoutingMetadata, type LearningRecommendation } from './gemma-learner'

/**
 * Learning Engine Coordinator
 * Coordinates all learning components
 */
export class LearningEngine {
  /**
   * Record a complete learning event
   */
  recordLearningEvent(data: {
    requestId: string
    prompt: string
    selectedTier: number
    actualTokens: number
    actualCost: number
    actualLatency: number
    predictedTokens: number
    predictedCost: number
    predictedLatency: number
    userSatisfaction?: number
    success: boolean
    intent: string
  }): void {
    // Record reflection
    reflectionEngine.recordReflection({
      requestId: data.requestId,
      prompt: data.prompt,
      selectedTier: data.selectedTier,
      actualTokens: data.actualTokens,
      actualCost: data.actualCost,
      actualLatency: data.actualLatency,
      predictedTokens: data.predictedTokens,
      predictedCost: data.predictedCost,
      predictedLatency: data.predictedLatency,
      userSatisfaction: data.userSatisfaction,
      timestamp: Date.now(),
    })

    // Update knowledge base
    const pattern = this.extractPattern(data.prompt)
    knowledgeBase.upsertKnowledge({
      id: this.generateKnowledgeId(pattern, data.intent),
      pattern,
      intent: data.intent,
      recommendedTier: data.selectedTier,
      confidence: data.success ? 0.8 : 0.2,
      successRate: data.success ? 1 : 0,
      lastUpdated: Date.now(),
      usageCount: 1,
    })

    knowledgeBase.updateSuccessRate(
      this.generateKnowledgeId(pattern, data.intent),
      data.success
    )

    // Update adaptive thresholds
    adaptiveThresholdLearning.updateMetrics({
      routingAccuracy: data.success ? 0.9 : 0.5,
      userSatisfaction: (data.userSatisfaction || 3) / 5,
      costEfficiency: data.predictedCost > 0 ? data.actualCost / data.predictedCost : 1,
      latencyPerformance: data.predictedLatency > 0 ? data.actualLatency / data.predictedLatency : 1,
    })
  }

  /**
   * Extract pattern from prompt
   */
  private extractPattern(prompt: string): string {
    // Simple pattern extraction - first few words
    const words = prompt.toLowerCase().split(' ').slice(0, 5)
    return words.join(' ')
  }

  /**
   * Generate knowledge ID
   */
  private generateKnowledgeId(pattern: string, intent: string): string {
    return `${intent}:${pattern}`.replace(/\s+/g, '_')
  }

  /**
   * Get learning insights
   */
  getInsights(): {
    reflections: any
    knowledge: any
    thresholds: any
    recommendations: string[]
    qwenRecommendation: ReturnType<typeof qwenLearner.getRecommendations>
    qwenStats: ReturnType<typeof qwenLearner.getStats>
  } {
    return {
      reflections: reflectionEngine.getStats(),
      knowledge: knowledgeBase.getStats(),
      thresholds: adaptiveThresholdLearning.getThresholds(),
      recommendations: [
        ...reflectionEngine.getRecommendations(),
        ...this.generateKnowledgeRecommendations(),
      ],
      qwenRecommendation: qwenLearner.getRecommendations(),
      qwenStats: qwenLearner.getStats(),
    }
  }

  /**
   * Generate knowledge-based recommendations
   */
  private generateKnowledgeRecommendations(): string[] {
    const stats = knowledgeBase.getStats()
    const recommendations: string[] = []

    if (stats.avgSuccessRate < 0.7) {
      recommendations.push('Overall knowledge base success rate is low. Consider reviewing learned patterns.')
    }

    if (stats.topPatterns.length > 0) {
      const topPattern = stats.topPatterns[0]
      recommendations.push(`Most common pattern: "${topPattern.pattern}" (${topPattern.usageCount} uses)`)
    }

    return recommendations
  }

  /**
   * Clear all learning data
   */
  clear(): void {
    reflectionEngine.clear()
    knowledgeBase.clear()
    adaptiveThresholdLearning.clearHistory()
  }
}

// Singleton instance
export const learningEngine = new LearningEngine()
