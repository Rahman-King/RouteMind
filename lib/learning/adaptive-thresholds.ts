/**
 * Adaptive Threshold Learning
 * Dynamically adjusts routing thresholds based on performance
 */

export interface ThresholdConfig {
  complexityThreshold: number
  confidenceThreshold: number
  economyThreshold: number
  latencyThreshold: number
}

export interface ThresholdMetrics {
  routingAccuracy: number
  userSatisfaction: number
  costEfficiency: number
  latencyPerformance: number
}

class AdaptiveThresholdLearning {
  private thresholds: ThresholdConfig = {
    complexityThreshold: 50,
    confidenceThreshold: 70,
    economyThreshold: 60,
    latencyThreshold: 1000,
  }

  private metrics: ThresholdMetrics = {
    routingAccuracy: 0.8,
    userSatisfaction: 0.75,
    costEfficiency: 0.7,
    latencyPerformance: 0.8,
  }

  private history: Array<{ thresholds: ThresholdConfig; metrics: ThresholdMetrics; timestamp: number }> = []
  private maxHistory = 100

  /**
   * Update metrics based on recent performance
   */
  updateMetrics(newMetrics: Partial<ThresholdMetrics>): void {
    this.metrics = { ...this.metrics, ...newMetrics }
    this.adjustThresholds()
    this.recordHistory()
  }

  /**
   * Adjust thresholds based on metrics
   */
  private adjustThresholds(): void {
    const { routingAccuracy, userSatisfaction, costEfficiency, latencyPerformance } = this.metrics

    // Adjust complexity threshold based on routing accuracy
    if (routingAccuracy < 0.7) {
      // Lower threshold to be more conservative
      this.thresholds.complexityThreshold = Math.max(30, this.thresholds.complexityThreshold - 5)
    } else if (routingAccuracy > 0.9) {
      // Raise threshold to be more aggressive
      this.thresholds.complexityThreshold = Math.min(70, this.thresholds.complexityThreshold + 5)
    }

    // Adjust confidence threshold based on user satisfaction
    if (userSatisfaction < 0.7) {
      this.thresholds.confidenceThreshold = Math.max(60, this.thresholds.confidenceThreshold - 5)
    } else if (userSatisfaction > 0.85) {
      this.thresholds.confidenceThreshold = Math.min(85, this.thresholds.confidenceThreshold + 5)
    }

    // Adjust economy threshold based on cost efficiency
    if (costEfficiency < 0.6) {
      this.thresholds.economyThreshold = Math.max(40, this.thresholds.economyThreshold - 5)
    } else if (costEfficiency > 0.8) {
      this.thresholds.economyThreshold = Math.min(80, this.thresholds.economyThreshold + 5)
    }

    // Adjust latency threshold based on latency performance
    if (latencyPerformance < 0.7) {
      this.thresholds.latencyThreshold = Math.max(500, this.thresholds.latencyThreshold - 100)
    } else if (latencyPerformance > 0.85) {
      this.thresholds.latencyThreshold = Math.min(2000, this.thresholds.latencyThreshold + 100)
    }
  }

  /**
   * Record threshold history
   */
  private recordHistory(): void {
    this.history.push({
      thresholds: { ...this.thresholds },
      metrics: { ...this.metrics },
      timestamp: Date.now(),
    })

    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }

  /**
   * Get current thresholds
   */
  getThresholds(): ThresholdConfig {
    return { ...this.thresholds }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ThresholdMetrics {
    return { ...this.metrics }
  }

  /**
   * Check if complexity meets threshold
   */
  meetsComplexityThreshold(complexity: number): boolean {
    return complexity >= this.thresholds.complexityThreshold
  }

  /**
   * Check if confidence meets threshold
   */
  meetsConfidenceThreshold(confidence: number): boolean {
    return confidence >= this.thresholds.confidenceThreshold
  }

  /**
   * Check if economy score meets threshold
   */
  meetsEconomyThreshold(economyScore: number): boolean {
    return economyScore >= this.thresholds.economyThreshold
  }

  /**
   * Check if latency meets threshold
   */
  meetsLatencyThreshold(latency: number): boolean {
    return latency <= this.thresholds.latencyThreshold
  }

  /**
   * Manually set thresholds
   */
  setThresholds(thresholds: Partial<ThresholdConfig>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
    this.recordHistory()
  }

  /**
   * Reset thresholds to defaults
   */
  resetThresholds(): void {
    this.thresholds = {
      complexityThreshold: 50,
      confidenceThreshold: 70,
      economyThreshold: 60,
      latencyThreshold: 1000,
    }
    this.recordHistory()
  }

  /**
   * Get threshold history
   */
  getHistory(limit?: number): Array<{ thresholds: ThresholdConfig; metrics: ThresholdMetrics; timestamp: number }> {
    if (limit) {
      return this.history.slice(-limit)
    }
    return [...this.history]
  }

  /**
   * Analyze threshold trends
   */
  analyzeTrends(): {
    complexityTrend: 'increasing' | 'decreasing' | 'stable'
    confidenceTrend: 'increasing' | 'decreasing' | 'stable'
    economyTrend: 'increasing' | 'decreasing' | 'stable'
    latencyTrend: 'increasing' | 'decreasing' | 'stable'
  } {
    if (this.history.length < 10) {
      return {
        complexityTrend: 'stable',
        confidenceTrend: 'stable',
        economyTrend: 'stable',
        latencyTrend: 'stable',
      }
    }

    const recent = this.history.slice(-10)
    const calculateTrend = (key: keyof ThresholdConfig): 'increasing' | 'decreasing' | 'stable' => {
      const values = recent.map(h => h.thresholds[key])
      const first = values[0]
      const last = values[values.length - 1]
      const diff = last - first
      
      if (Math.abs(diff) < 5) return 'stable'
      return diff > 0 ? 'increasing' : 'decreasing'
    }

    return {
      complexityTrend: calculateTrend('complexityThreshold'),
      confidenceTrend: calculateTrend('confidenceThreshold'),
      economyTrend: calculateTrend('economyThreshold'),
      latencyTrend: calculateTrend('latencyThreshold'),
    }
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = []
  }
}

// Singleton instance
export const adaptiveThresholdLearning = new AdaptiveThresholdLearning()
