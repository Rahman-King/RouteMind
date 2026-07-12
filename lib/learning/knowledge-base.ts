/**
 * Knowledge Base
 * Stores routing intelligence and learned patterns
 */

export interface KnowledgeEntry {
  id: string
  pattern: string
  intent: string
  recommendedTier: number
  confidence: number
  successRate: number
  lastUpdated: number
  usageCount: number
}

export interface RuleEntry {
  id: string
  condition: string
  action: string
  priority: number
  enabled: boolean
  createdAt: number
}

class KnowledgeBase {
  private knowledge = new Map<string, KnowledgeEntry>()
  private rules = new Map<string, RuleEntry>()
  private maxKnowledge = 5000
  private maxRules = 100

  /**
   * Add or update knowledge entry
   */
  upsertKnowledge(entry: KnowledgeEntry): void {
    const existing = this.knowledge.get(entry.id)
    
    if (existing) {
      // Update existing entry
      entry.usageCount = existing.usageCount + 1
      entry.lastUpdated = Date.now()
    } else {
      // New entry
      entry.usageCount = 1
      entry.lastUpdated = Date.now()
    }
    
    this.knowledge.set(entry.id, entry)
    this.evictKnowledgeIfNeeded()
  }

  /**
   * Get knowledge entry by pattern
   */
  getKnowledge(pattern: string): KnowledgeEntry | undefined {
    return this.knowledge.get(pattern)
  }

  /**
   * Find knowledge by intent
   */
  findByIntent(intent: string): KnowledgeEntry[] {
    return Array.from(this.knowledge.values()).filter(
      entry => entry.intent === intent
    )
  }

  /**
   * Get recommended tier for pattern
   */
  getRecommendedTier(pattern: string): number | null {
    const entry = this.knowledge.get(pattern)
    return entry ? entry.recommendedTier : null
  }

  /**
   * Add or update rule
   */
  upsertRule(rule: RuleEntry): void {
    this.rules.set(rule.id, rule)
    this.evictRulesIfNeeded()
  }

  /**
   * Get rule by ID
   */
  getRule(id: string): RuleEntry | undefined {
    return this.rules.get(id)
  }

  /**
   * Get all enabled rules
   */
  getEnabledRules(): RuleEntry[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * Apply rules to pattern
   */
  applyRules(pattern: string): string[] {
    const rules = this.getEnabledRules()
    const actions: string[] = []

    for (const rule of rules) {
      if (this.matchesCondition(pattern, rule.condition)) {
        actions.push(rule.action)
      }
    }

    return actions
  }

  /**
   * Check if pattern matches condition
   */
  private matchesCondition(pattern: string, condition: string): boolean {
    try {
      // Simple pattern matching
      const regex = new RegExp(condition, 'i')
      return regex.test(pattern)
    } catch {
      // If regex fails, do simple string comparison
      return pattern.toLowerCase().includes(condition.toLowerCase())
    }
  }

  /**
   * Update success rate for knowledge entry
   */
  updateSuccessRate(id: string, success: boolean): void {
    const entry = this.knowledge.get(id)
    if (!entry) return

    const currentRate = entry.successRate
    const newRate = currentRate * 0.9 + (success ? 0.1 : 0)
    entry.successRate = Math.min(1, Math.max(0, newRate))
    entry.lastUpdated = Date.now()
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalKnowledge: this.knowledge.size,
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      avgSuccessRate: this.calculateAverageSuccessRate(),
      topPatterns: this.getTopPatterns(5),
    }
  }

  /**
   * Calculate average success rate
   */
  private calculateAverageSuccessRate(): number {
    const entries = Array.from(this.knowledge.values())
    if (entries.length === 0) return 0

    const total = entries.reduce((sum, entry) => sum + entry.successRate, 0)
    return total / entries.length
  }

  /**
   * Get most used patterns
   */
  private getTopPatterns(limit: number): Array<{ pattern: string; usageCount: number }> {
    const entries = Array.from(this.knowledge.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)

    return entries.map(entry => ({
      pattern: entry.pattern,
      usageCount: entry.usageCount,
    }))
  }

  /**
   * Evict old knowledge entries
   */
  private evictKnowledgeIfNeeded(): void {
    if (this.knowledge.size > this.maxKnowledge) {
      // Remove least recently used
      let oldestKey: string | null = null
      let oldestTime = Infinity

      for (const [key, entry] of this.knowledge.entries()) {
        if (entry.lastUpdated < oldestTime) {
          oldestTime = entry.lastUpdated
          oldestKey = key
        }
      }

      if (oldestKey) {
        this.knowledge.delete(oldestKey)
      }
    }
  }

  /**
   * Evict old rules
   */
  private evictRulesIfNeeded(): void {
    if (this.rules.size > this.maxRules) {
      // Remove lowest priority rules
      const sorted = Array.from(this.rules.entries())
        .sort((a, b) => a[1].priority - b[1].priority)

      if (sorted.length > 0) {
        this.rules.delete(sorted[0][0])
      }
    }
  }

  /**
   * Clear all knowledge
   */
  clear(): void {
    this.knowledge.clear()
    this.rules.clear()
  }

  /**
   * Export knowledge as JSON
   */
  exportKnowledge(): string {
    const data = {
      knowledge: Array.from(this.knowledge.entries()),
      rules: Array.from(this.rules.entries()),
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import knowledge from JSON
   */
  importKnowledge(json: string): boolean {
    try {
      const data = JSON.parse(json)
      
      if (data.knowledge) {
        for (const [id, entry] of data.knowledge) {
          this.knowledge.set(id, entry as KnowledgeEntry)
        }
      }
      
      if (data.rules) {
        for (const [id, rule] of data.rules) {
          this.rules.set(id, rule as RuleEntry)
        }
      }
      
      return true
    } catch {
      return false
    }
  }
}

// Singleton instance
export const knowledgeBase = new KnowledgeBase()
