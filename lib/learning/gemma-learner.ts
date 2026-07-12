/**
 * QwenLearner — Pipeline C: Adaptive Learning
 * -----------------------------------------------
 * Receives ONLY anonymised RoutingMetadata after each request.
 * Never sees prompt text, response text, files, or any user content.
 *
 * After every LEARNING_WINDOW interactions, asks Qwen to analyse routing
 * patterns and produce personalised recommendations stored in memory.
 *
 * Disable: set QWEN_LEARNING_ENABLED=false in .env.local
 */

const LEARNING_ENABLED = process.env.QWEN_LEARNING_ENABLED !== 'false'
const LEARNING_WINDOW  = parseInt(process.env.QWEN_LEARNING_WINDOW || '10', 10)

// ── Anonymised metadata shape — NO user content ever passes through ───────
export interface RoutingMetadata {
  requestId: string          // UUID only — no user content
  selectedTier: 1 | 2
  intent: string             // e.g. "coding", "summarization", "general"
  complexityScore: number    // 0-100
  latencyMs: number
  costUSD: number
  cacheHit: boolean
  timestamp: number
}

export interface LearningRecommendation {
  dominantWorkflow: string       // e.g. "coding", "writing", "research"
  userPreference: string         // "speed" | "quality" | "cost" | "privacy"
  suggestedThresholdAdjustment: number  // delta to apply to confidence threshold
  suggestedRoutingMode: string   // e.g. "economy", "quality", "balanced"
  explanation: string
  generatedAt: number
}

// ── Compact analysis prompt ───────────────────────────────────────────────
function buildAnalysisPrompt(window: RoutingMetadata[]): string {
  const summary = window.map(m =>
    `tier=${m.selectedTier} intent=${m.intent} complexity=${m.complexityScore} latency=${m.latencyMs}ms cost=$${m.costUSD.toFixed(5)} cache=${m.cacheHit}`
  ).join('\n')

  return `Analyse these ${window.length} anonymised routing events and return ONLY JSON.
No user content is present — only routing statistics.

Events:
${summary}

Return JSON:
{"workflow":"dominant_type","preference":"speed|quality|cost|privacy","threshold_delta":-5_to_5,"mode":"economy|balanced|quality","explain":"max 15 words"}`
}

function parseRecommendation(raw: string): LearningRecommendation | null {
  try {
    const match = raw.match(/\{[\s\S]*?\}/)
    if (!match) return null
    const p = JSON.parse(match[0])
    return {
      dominantWorkflow: p.workflow || 'general',
      userPreference: p.preference || 'balanced',
      suggestedThresholdAdjustment: Math.min(5, Math.max(-5, Number(p.threshold_delta) || 0)),
      suggestedRoutingMode: p.mode || 'balanced',
      explanation: p.explain || '',
      generatedAt: Date.now(),
    }
  } catch {
    return null
  }
}

// ── QwenLearner class ────────────────────────────────────────────────────
export class QwenLearner {
  private window: RoutingMetadata[] = []
  private latestRecommendation: LearningRecommendation | null = null
  private totalRecorded = 0

  /**
   * Record one anonymised routing event.
   * Analysis runs automatically after LEARNING_WINDOW events.
   * Fire-and-forget — never blocks the request pipeline.
   */
  record(metadata: RoutingMetadata): void {
    if (!LEARNING_ENABLED) return

    this.window.push(metadata)
    this.totalRecorded++

    // Keep window bounded
    if (this.window.length > LEARNING_WINDOW * 3) {
      this.window = this.window.slice(-LEARNING_WINDOW * 2)
    }

    // Trigger analysis asynchronously after each window
    if (this.totalRecorded % LEARNING_WINDOW === 0) {
      this.runAnalysis().catch(() => {/* silent — never block request pipeline */})
    }
  }

  /**
   * Run Qwen analysis on current window (async, non-blocking).
   */
  private async runAnalysis(): Promise<void> {
    const snapshot = [...this.window.slice(-LEARNING_WINDOW)]
    if (snapshot.length < 3) return  // not enough data yet

    try {
      const { fireworks } = await import('@ai-sdk/fireworks')
      const { generateText } = await import('ai')
      const { getModelByTier } = await import('../models/registry')

      const controller = new AbortController()
      const timeoutId  = setTimeout(() => controller.abort(), 5000)

      const routerModel = getModelByTier(1).id
      const result = await generateText({
        model: fireworks(routerModel),
        system: 'You are a routing analytics assistant. Analyse routing metadata only. Output ONLY JSON.',
        prompt: buildAnalysisPrompt(snapshot),
        temperature: 0.2,
        maxTokens: 150,
        abortSignal: controller.signal,
      })

      clearTimeout(timeoutId)
      const text = result.text
      const rec = parseRecommendation(text)

      if (rec) {
        this.latestRecommendation = rec
        console.log(`[QwenLearner] Analysis complete after ${this.totalRecorded} requests:`, rec.explanation)
      }
    } catch {
      // Silent — learning failure never affects routing
    }
  }

  /**
   * Get the latest recommendations (for analytics page).
   */
  getRecommendations(): LearningRecommendation | null {
    return this.latestRecommendation
  }

  /**
   * Get raw stats for debugging.
   */
  getStats(): { totalRecorded: number; windowSize: number; hasRecommendation: boolean } {
    return {
      totalRecorded: this.totalRecorded,
      windowSize: this.window.length,
      hasRecommendation: this.latestRecommendation !== null,
    }
  }
}

// Singleton
export const qwenLearner = new QwenLearner()
