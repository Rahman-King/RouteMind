/**
 * Model Registry
 * Centralized model configuration for all tiers — all via Fireworks API
 * Tier 1: minimax-m3 via Fireworks ($0.15/M)
 * Tier 2: kimi-k2p6 via Fireworks ($0.50/M)
 */

export interface ModelConfig {
  id: string
  label: string
  tier: 1 | 2
  provider: 'fireworks' | 'ollama'
  purpose: string
  inPerM: number // USD per 1M input tokens (0 for local)
  outPerM: number // USD per 1M output tokens (0 for local)
  estimatedLatency: number // Base latency in ms
  maxTokens: number
  capabilities: string[]
  specialization?: 'general' | 'coding' | 'math' | 'reasoning' | 'creative'
}

// Router model configuration (SEPARATE from tier models)
// Executes BEFORE any tier selection for intelligent routing decisions
export const ROUTER_MODEL: ModelConfig = {
  id: "qwen-router",
  label: "qwen-router (Router)",
  tier: 2,
  provider: 'ollama',
  purpose: "Intent Classification, Complexity Estimation, Routing Decision (EXECUTES BEFORE TIER SELECTION). Custom Ollama model built from qwen2.5:0.5b, tuned for JSON-only routing.",
  inPerM: 0,
  outPerM: 0,
  estimatedLatency: 800,
  maxTokens: 4096,
  capabilities: ["routing", "classification", "prediction", "analysis"],
  specialization: 'reasoning',
}

export const MODEL_REGISTRY: Record<1 | 2, ModelConfig[]> = {
  // Tier 1: minimax-m3 via Fireworks — general cloud inference
  1: [
    {
      id: "accounts/fireworks/models/minimax-m3",
      label: "Minimax M3",
      tier: 1,
      provider: 'fireworks',
      purpose: "General-purpose inference: Chat, Summarization, Translation, Extraction, Classification, Lightweight reasoning",
      inPerM: 0.15,
      outPerM: 0.15,
      estimatedLatency: 600,
      maxTokens: 8192,
      capabilities: ["chat", "summarization", "translation", "extraction", "classification", "lightweight-reasoning"],
      specialization: 'general',
    },
  ],
  // Tier 2: kimi-k2p6 via Fireworks — heavy reasoning
  2: [
    {
      id: "accounts/fireworks/models/kimi-k2p6",
      label: "Kimi K2P6",
      tier: 2,
      provider: 'fireworks',
      purpose: "Higher-quality reasoning: Complex coding, expert analysis, deep multi-step reasoning",
      inPerM: 0.50,
      outPerM: 1.50,
      estimatedLatency: 1200,
      maxTokens: 16384,
      capabilities: ["reasoning", "coding", "analysis", "complex-tasks"],
      specialization: 'general',
    },
  ],
}

/**
 * Get active model registry dynamically mapping ALLOWED_MODELS to avoid violations
 */
export function getActiveRegistry(): Record<1 | 2, ModelConfig[]> {
  const allowed = typeof process !== 'undefined' && process.env.ALLOWED_MODELS
    ? process.env.ALLOWED_MODELS.split(',').map(m => m.trim()).filter(Boolean)
    : []
  if (allowed.length === 0) return MODEL_REGISTRY

  // Dynamic mapping
  const t1Id = allowed.find(m => m.includes('minimax') || m.includes('m3')) || allowed[0]
  const t2Id = allowed.find(m => m.includes('kimi')) || allowed[Math.min(1, allowed.length - 1)]

  return {
    1: [{ ...MODEL_REGISTRY[1][0], id: t1Id, provider: 'fireworks' }],
    2: [{ ...MODEL_REGISTRY[2][0], id: t2Id, provider: 'fireworks' }],
  }
}

/**
 * Get model configuration by tier (returns first model)
 */
export function getModelByTier(tier: 1 | 2): ModelConfig {
  return getActiveRegistry()[tier][0]
}

/**
 * Get all models for a tier
 */
export function getModelsByTier(tier: 1 | 2): ModelConfig[] {
  return getActiveRegistry()[tier]
}

/**
 * Get best model for tier based on specialization
 */
export function getBestModelForTier(tier: 1 | 2, specialization?: 'general' | 'coding' | 'math' | 'reasoning' | 'creative'): ModelConfig {
  const models = getActiveRegistry()[tier]
  if (!specialization) {
    return models[0]
  }
  const specializedModel = models.find(m => m.specialization === specialization)
  if (specializedModel) {
    return specializedModel
  }
  return models.reduce((cheapest, model) =>
    (model.inPerM + model.outPerM) < (cheapest.inPerM + cheapest.outPerM) ? model : cheapest
  )
}

/**
 * Get model configuration by ID
 */
export function getModelById(id: string): ModelConfig | undefined {
  return Object.values(getActiveRegistry()).flat().find(model => model.id === id)
}

/**
 * Get all models
 */
export function getAllModels(): ModelConfig[] {
  return Object.values(getActiveRegistry()).flat()
}

/**
 * Validate model ID is from registry
 */
export function isValidModelId(id: string): boolean {
  return Object.values(getActiveRegistry()).flat().some(model => model.id === id)
}

/**
 * Calculate estimated cost for tokens
 */
export function estimateCost(tier: 1 | 2, inputTokens: number, outputTokens: number, specialization?: 'general' | 'coding' | 'math' | 'reasoning' | 'creative'): number {
  const model = getBestModelForTier(tier, specialization)
  const inputCost = (inputTokens / 1_000_000) * model.inPerM
  const outputCost = (outputTokens / 1_000_000) * model.outPerM
  return inputCost + outputCost
}

/**
 * Calculate estimated latency
 */
export function estimateLatency(tier: 1 | 2, totalTokens: number, specialization?: 'general' | 'coding' | 'math' | 'reasoning' | 'creative'): number {
  const model = getBestModelForTier(tier, specialization)
  const tokenLatency = (totalTokens / 1000) * 100
  return model.estimatedLatency + tokenLatency
}
