/**
 * Cost Savings Comparison
 * Compares RouteMind routing costs against traditional single-model routers
 */

export interface CostComparison {
  routeMindCost: number
  traditionalCost: number
  savings: number
  savingsPercentage: number
  routingEfficiency: number
}

export interface RouterComparison {
  name: string
  model: string
  costPer1M: number
  avgLatency: number
}

// Traditional router configurations (single model approach)
const TRADITIONAL_ROUTERS: RouterComparison[] = [
  {
    name: 'GPT-4o (OpenAI)',
    model: 'gpt-4o',
    costPer1M: 5.00, // Average input/output
    avgLatency: 2500,
  },
  {
    name: 'Claude 3.5 Sonnet (Anthropic)',
    model: 'claude-3-5-sonnet',
    costPer1M: 3.00,
    avgLatency: 2000,
  },
  {
    name: 'Gemini 1.5 Pro (Google)',
    model: 'gemini-1.5-pro',
    costPer1M: 2.50,
    avgLatency: 1800,
  },
  {
    name: 'Llama 3.1 405B (Together)',
    model: 'llama-3.1-405b',
    costPer1M: 1.50,
    avgLatency: 3000,
  },
]

// RouteMind tier costs (weighted average based on usage distribution)
const ROUTEMIND_TIERS = {
  tier0: { costPer1M: 0, avgLatency: 10, usageWeight: 0.25 }, // 25% handled by Tier 0 (free, instant)
  tier1: { costPer1M: 0.15, avgLatency: 600, usageWeight: 0.45 }, // 45% to Tier 1
  tier2: { costPer1M: 1.00, avgLatency: 1000, usageWeight: 0.30 }, // 30% to Tier 2
}

/**
 * Calculate RouteMind weighted average cost
 */
function calculateRouteMindAverage(): { costPer1M: number; avgLatency: number } {
  let totalCost = 0
  let totalLatency = 0
  let totalWeight = 0

  for (const tier of Object.values(ROUTEMIND_TIERS)) {
    totalCost += tier.costPer1M * tier.usageWeight
    totalLatency += tier.avgLatency * tier.usageWeight
    totalWeight += tier.usageWeight
  }

  return {
    costPer1M: totalCost / totalWeight,
    avgLatency: totalLatency / totalWeight,
  }
}

/**
 * Compare RouteMind against a traditional router
 */
export function compareWithTraditional(router: RouterComparison, tokens: number = 1_000_000): CostComparison {
  const routeMindAvg = calculateRouteMindAverage()
  
  const routeMindCost = (tokens / 1_000_000) * routeMindAvg.costPer1M
  const traditionalCost = (tokens / 1_000_000) * router.costPer1M
  
  const savings = traditionalCost - routeMindCost
  const savingsPercentage = (savings / traditionalCost) * 100
  
  const routingEfficiency = (router.avgLatency / routeMindAvg.avgLatency) * 100

  return {
    routeMindCost,
    traditionalCost,
    savings,
    savingsPercentage,
    routingEfficiency,
  }
}

/**
 * Get comprehensive cost comparison report
 */
export function getCostComparisonReport(tokens: number = 1_000_000): {
  routeMind: { costPer1M: number; avgLatency: number }
  comparisons: Array<{ router: RouterComparison; comparison: CostComparison }>
  summary: {
    avgSavingsPercentage: number
    bestSavings: { router: string; percentage: number }
    avgLatencyImprovement: number
  }
} {
  const routeMindAvg = calculateRouteMindAverage()
  
  const comparisons = TRADITIONAL_ROUTERS.map(router => ({
    router,
    comparison: compareWithTraditional(router, tokens),
  }))

  const avgSavingsPercentage = comparisons.reduce(
    (sum, { comparison }) => sum + comparison.savingsPercentage,
    0
  ) / comparisons.length

  const bestSavings = comparisons.reduce(
    (best, { router, comparison }) =>
      comparison.savingsPercentage > best.percentage
        ? { router: router.name, percentage: comparison.savingsPercentage }
        : best,
    { router: '', percentage: 0 }
  )

  const avgLatencyImprovement = comparisons.reduce(
    (sum, { comparison }) => sum + comparison.routingEfficiency,
    0
  ) / comparisons.length

  return {
    routeMind: routeMindAvg,
    comparisons,
    summary: {
      avgSavingsPercentage,
      bestSavings,
      avgLatencyImprovement,
    },
  }
}

/**
 * Calculate cost savings for a specific request
 */
export function calculateRequestSavings(
  inputTokens: number,
  outputTokens: number,
  selectedTier: number,
  wouldUseTraditionalCost: number
): CostComparison {
  const tierCosts = {
    0: 0,
    1: 0.15,
    2: 1.00,
  }

  const costPer1M = tierCosts[selectedTier as keyof typeof tierCosts]
  const routeMindCost = ((inputTokens + outputTokens) / 1_000_000) * costPer1M
  
  const savings = wouldUseTraditionalCost - routeMindCost
  const savingsPercentage = wouldUseTraditionalCost > 0 
    ? (savings / wouldUseTraditionalCost) * 100 
    : 0

  return {
    routeMindCost,
    traditionalCost: wouldUseTraditionalCost,
    savings,
    savingsPercentage,
    routingEfficiency: 100, // Request-level efficiency
  }
}
