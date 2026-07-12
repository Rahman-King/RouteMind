import { fireworks } from "@ai-sdk/fireworks"
import { generateText, streamText } from "ai"
import type { AiStatus } from "@/lib/types"

// Import RouteMind components
import { processTier0, exactCache, semanticCache, sessionCache } from "@/lib/tier0"
import { qwenRouter } from "@/lib/router/gemma-router"  // 🆕 Replaces FireworksRouter — routing is now FREE
import { qwenLearner } from "@/lib/learning/gemma-learner"  // 🆕 Adaptive learning pipeline
import { economyEngine, DRAFT_ACCURACY_GATE_THRESHOLD } from "@/lib/economy/engine"
import { routingDecisionEngine } from "@/lib/routing/decision-engine"
import { getModelByTier, getBestModelForTier, getModelById, estimateCost, estimateLatency } from "@/lib/models/registry"
import { learningEngine } from "@/lib/learning"
import { retryHandler, rateLimiter, monitoring, circuitBreaker } from "@/lib/production"
export const runtime = "nodejs"
export const maxDuration = 60

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Fetch embeddings from Fireworks API
async function getEmbedding(text: string): Promise<number[] | undefined> {
  if (!process.env.FIREWORKS_API_KEY) return undefined
  try {
    const response = await fetch("https://api.fireworks.ai/inference/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FIREWORKS_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "nomic-ai/nomic-embed-text-v1.5",
        input: [text]
      })
    })
    if (!response.ok) return undefined
    const data = await response.json()
    return data.data[0].embedding
  } catch (e) {
    console.error("Embedding generation failed:", e)
    return undefined
  }
}

export async function POST(req: Request) {
  const requestId = generateRequestId()
  const startTime = Date.now()

  // Monitor request start
  monitoring.incrementCounter('requests.total', 1)
  monitoring.recordHistogram('request.size', req.headers.get('content-length') ? parseInt(req.headers.get('content-length')!) : 0)

  if (!process.env.FIREWORKS_API_KEY) {
    monitoring.incrementCounter('errors.missing_api_key', 1)
    return Response.json(
      { error: "FIREWORKS_API_KEY is not set. Add it in Project Settings → Vars." },
      { status: 500 },
    )
  }

  let prompt = ""
  let sessionId: string | undefined
  let rawMessages: any[] = []
  let routingConfig: {
    mode?: string
    forceTier?: string
    taskMode?: string
    reasoning?: number
    creativity?: number
    maxOutput?: number
  } = {}
  try {
    const body = await req.json()
    prompt = typeof body?.prompt === "string" ? body.prompt : ""
    sessionId = typeof body?.sessionId === "string" ? body.sessionId : undefined
    rawMessages = Array.isArray(body?.messages) ? body.messages : []
    routingConfig = body?.routingConfig || {}
  } catch {
    monitoring.incrementCounter('errors.invalid_request', 1)
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }

  // Token Budget Manager: predicts tokens, enforces budgets, trims context automatically
  const budgetResult = await economyEngine.manageTokenBudget(prompt, rawMessages, 2048)
  const processedPrompt = budgetResult.processedPrompt
  const processedHistory = budgetResult.processedHistory || []
  const budgetWarning = budgetResult.warning

  // Automatic Prompt Rewriter: removes filler and redundancy safely
  let rewrittenPrompt = economyEngine.safeRewritePrompt(processedPrompt)

  // BPE Shrinking & Canonicalization
  const { promptNormalizer } = await import('@/lib/tier0/normalization')
  rewrittenPrompt = promptNormalizer.bpeShrink(rewrittenPrompt)
  rewrittenPrompt = promptNormalizer.canonicalize(rewrittenPrompt)
  
  // Prompt Delta Compression
  rewrittenPrompt = economyEngine.computeDelta(rewrittenPrompt, rawMessages)

  // Zero-Cost Heuristics: Instruction Ordering and JSON compaction
  rewrittenPrompt = economyEngine.dynamicInstructionOrdering(rewrittenPrompt)
  rewrittenPrompt = economyEngine.compactJsonGeneration(rewrittenPrompt)

  if (!prompt.trim()) {
    monitoring.incrementCounter('errors.empty_prompt', 1)
    return Response.json({ error: "Prompt is required." }, { status: 400 })
  }

  // Rate limiting check
  const rateLimitResult = rateLimiter.check(sessionId || 'anonymous')
  if (!rateLimitResult.allowed) {
    monitoring.incrementCounter('errors.rate_limited', 1)
    return Response.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    )
  }

  // Tier 0: Local Intelligence Processing
  const tier0Result = await processTier0(prompt, sessionId)
  if (tier0Result.handled) {
    monitoring.incrementCounter('tier0.hits', 1)
    monitoring.recordHistogram('tier0.latency', Date.now() - startTime)
    
    // Recover tokens on cache hit
    if (tier0Result.source?.includes('cache')) {
      economyEngine.recoverTokens(requestId, 'cache_hit')
    }
    
    const status: AiStatus = {
      model: 'Tier 0 Local Intelligence',
      routingDecision: 'Handled by deterministic processing',
      rationale: tier0Result.source === 'rule_engine' ? `Rule: ${tier0Result.rule}` : (tier0Result.source || 'Tier 0 processing'),
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      latencyMs: Date.now() - startTime,
      confidence: 100,
      memory: 'No LLM inference needed',
      cacheHit: tier0Result.source?.includes('cache') || false,
      selectedTier: 0,
      skippedTiers: [],
    }

    return Response.json({ text: tier0Result.response, status })
  }
  monitoring.incrementCounter('tier0.misses', 1)

  // Lossless prompt optimization for the inference call.
  const compressionResult = economyEngine.optimizeForInference(rewrittenPrompt)
  const compressedPrompt = compressionResult.compressed

  // Manual routing override
  let selectedTier: 1 | 2
  let routingReasoning: string
  let routerDecision: any
  let routingDecision: any
  let specialization: 'general' | 'coding' | 'math' | 'reasoning' | 'creative' = 'general'
  let embedding: number[] | undefined

  // Detect coding tasks
  const codingKeywords = ['code', 'function', 'class', 'bug', 'debug', 'api', 'typescript', 'python', 'javascript', 'react', 'component', 'algorithm', 'data structure']
  const isCodingTask = codingKeywords.some(keyword => prompt.toLowerCase().includes(keyword))

  // Detect math tasks
  const mathKeywords = ['calculate', 'solve', 'equation', 'math', 'algebra', 'calculus', 'geometry', 'statistics']
  const isMathTask = mathKeywords.some(keyword => prompt.toLowerCase().includes(keyword))

  // Detect creative tasks
  const creativeKeywords = ['write', 'story', 'poem', 'creative', 'imagine', 'design', 'art', 'narrative']
  const isCreativeTask = creativeKeywords.some(keyword => prompt.toLowerCase().includes(keyword))

  if (routingConfig.mode === 'manual' && routingConfig.forceTier && routingConfig.forceTier !== 'auto') {
    // Manual tier selection
    const tierMap: Record<string, 1 | 2> = {
      'tier1': 1,
      'tier2': 2,
    }
    selectedTier = tierMap[routingConfig.forceTier] || 2
    routingReasoning = `Manual override: Tier ${selectedTier} selected by user`
    
    // Determine specialization based on task mode or content
    if (routingConfig.taskMode === 'coding' || isCodingTask) {
      specialization = 'coding'
    } else if (routingConfig.taskMode === 'math' || isMathTask) {
      specialization = 'reasoning'
    } else if (routingConfig.taskMode === 'writing' || isCreativeTask) {
      specialization = 'creative'
    }
    
    // Still get router decision for metrics via Qwen (free — local)
    try {
      routerDecision = await qwenRouter.route(compressedPrompt, {
        category: tier0Result.category,
      })
    } catch (error) {
      routerDecision = {
        intent: routingConfig.taskMode || 'general',
        complexity: 50,
        confidence: 80,
        predictedTokens: { total: 1000 },
        predictedCost: 0.01,
        predictedLatency: 1000,
        explanation: routingReasoning,
      }
    }
    // Create a mock routingDecision for consistency
    routingDecision = {
      selectedTier,
      reasoning: routingReasoning,
      factors: { economyScore: 50 },
      skippedTiers: [],
      estimatedSavings: { tokens: 0, cost: 0, latency: 0 },
    }
  } else if (routingConfig.taskMode === 'coding') {
    // Explicit coding task mode (user-selected) - use Tier 2 for coding
    selectedTier = 2
    specialization = 'coding'
    routingReasoning = 'Coding task mode selected - routed to Tier 2 for code generation'
    
    try {
      routerDecision = await qwenRouter.route(compressedPrompt, {
        category: 'coding',
      })
    } catch (error) {
      routerDecision = {
        intent: 'coding',
        complexity: 75,
        confidence: 85,
        predictedTokens: { total: 1500 },
        predictedCost: 0.02,
        predictedLatency: 1500,
        explanation: routingReasoning,
      }
    }
    routingDecision = {
      selectedTier,
      reasoning: routingReasoning,
      factors: { economyScore: 60 },
      skippedTiers: [1],
      estimatedSavings: { tokens: 500, cost: 0.01, latency: 500 },
    }
  } else {
    // Automatic routing: Parallel routing analysis & Semantic cache check
    const [embeddingResult, routerDecisionResult] = await Promise.all([
      getEmbedding(rewrittenPrompt),
      // QwenRouter: Ollama local model call — now runs locally
      (async () => {
        try {
          const decision = await qwenRouter.route(compressedPrompt, {
            category: tier0Result.category,
          })
          monitoring.incrementCounter('router.success', 1)
          return decision
        } catch (error) {
          monitoring.incrementCounter('router.errors', 1)
          // qwenRouter already falls back internally; re-route as safety net
          return await qwenRouter.route(compressedPrompt)
        }
      })(),
    ])

    const tierOneAvailable = true // Fireworks cloud API is always available
    embedding = embeddingResult
    routerDecision = routerDecisionResult

    // Check semantic cache
    const semanticMatch = semanticCache.get(rewrittenPrompt, embedding)
    if (semanticMatch) {
      monitoring.incrementCounter('tier0.hits', 1)
      monitoring.recordHistogram('tier0.latency', Date.now() - startTime)
      
      // Recover tokens on cache hit
      economyEngine.recoverTokens(requestId, 'cache_hit')
      
      const status: AiStatus = {
        model: 'Semantic Cache Match',
        routingDecision: 'Bypassed LLM inference via semantic similarity matching',
        rationale: 'A highly similar query was found in semantic cache.',
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
        latencyMs: Date.now() - startTime,
        confidence: 100,
        memory: 'No LLM inference needed',
        cacheHit: true,
        selectedTier: 0,
        skippedTiers: [],
      }

      // Record in duplicate detector
      const { duplicateDetector } = await import('@/lib/tier0')
      duplicateDetector.recordPrompt(prompt)

      return Response.json({ text: semanticMatch, status })
    }

    // Routing Decision Engine: Multi-factor scoring
    routingDecision = await routingDecisionEngine.decide(routerDecision, {
      sessionId,
      tierOneAvailable,
      budgetConstraints: {
        tokens: economyEngine.getMetrics().tokensRemaining,
        cost: economyEngine.getMetrics().costRemaining,
      },
    })

    selectedTier = routingDecision.selectedTier
    routingReasoning = routingDecision.reasoning
    
    // Determine specialization for Tier 2 (top tier)
    if (selectedTier === 2) {
      if (isCodingTask) {
        specialization = 'coding'
      } else if (isMathTask) {
        specialization = 'reasoning'
      } else if (isCreativeTask) {
        specialization = 'creative'
      }
    }

    const tierNames: Record<number, string> = {
      1: 'Minimax M3 Tier (Fireworks)',
      2: 'Kimi K2P6 Tier (Fireworks)',
    }
    routerDecision.explanation = `Selected ${tierNames[selectedTier] ?? `Tier ${selectedTier}`} for ${routerDecision.intent} intent with complexity ${routerDecision.complexity}/100.`
  }

  const modelConfig = getBestModelForTier(selectedTier, specialization)

  // Adaptive output budgeting + temperature (token / cost / latency optimization).
  const maxOutputTokens = economyEngine.predictMaxOutputTokens({
    intent: routerDecision.intent,
    complexity: routerDecision.complexity,
    userMax: routingConfig.maxOutput,
    ceiling: modelConfig.maxTokens,
  })
  const temperature = economyEngine.pickTemperature({
    intent: routerDecision.intent,
    specialization,
    creativity: routingConfig.creativity,
  })

  // Construct conversation messages history (Dynamic Context Injection)
  const coreMessages = [
    ...processedHistory.map((m: any) => ({
      role: m.role,
      content: m.content
    })),
    { role: "user", content: compressedPrompt }
  ]

  // Record pending recovery for this request
  const estimatedTokens = routerDecision.predictedTokens.total
  const estimatedCost = routerDecision.predictedCost
  economyEngine.recordPendingRecovery(requestId, estimatedTokens, estimatedCost)

  let finalModelId = modelConfig.id

  // ── Tier 1: Fireworks Minimax M3 inference ──────────────────────────
  if (selectedTier === 1) {
    monitoring.incrementCounter('tier1.fireworks.attempts', 1)
    try {
      const inferenceStart = Date.now()
      const systemPrompt = `You are RouteMind, a helpful, concise assistant. Answer clearly and directly. Always respond in English. IMPORTANT: You have a strict output limit of approximately ${Math.floor(maxOutputTokens * 0.75)} words. Be extremely concise - remove filler words, unnecessary explanations, and redundant phrases. For code: provide only the essential code with minimal comments. Gracefully finish your thought before hitting this limit. Do not trail off mid-sentence.`
      
      const result = await generateText({
        model: fireworks(finalModelId),
        system: systemPrompt,
        messages: coreMessages as any,
        maxTokens: maxOutputTokens + 256,
        temperature,
      })
      
      const latencyMs = Date.now() - inferenceStart
      const tokensIn = result.usage.promptTokens ?? Math.ceil(compressedPrompt.length / 4)
      const tokensOut = result.usage.completionTokens ?? Math.ceil(result.text.length / 4)
      const actualCost = estimateCost(1, tokensIn, tokensOut)

      // Apply response compression for additional token savings
      const compression = economyEngine.compressResponse(result.text)
      const finalText = compression.compressed
      const compressedTokensOut = Math.ceil(finalText.length / 4)

      monitoring.incrementCounter('tier1.fireworks.hits', 1)
      monitoring.recordHistogram('tier1.fireworks.latency', latencyMs)

      economyEngine.updateUsage(tokensIn + compressedTokensOut, actualCost)
      economyEngine.clearPendingRecovery(requestId)

      // Cache the compressed result
      const { exactCache: ec, sessionCache: sc, semanticCache: smC } = await import('@/lib/tier0')
      ec.set(tier0Result.normalized || compressedPrompt, finalText)
      if (sessionId) sc.set(sessionId, tier0Result.fingerprint || compressedPrompt, finalText)
      smC.set(tier0Result.normalized || compressedPrompt, finalText, embedding)

      const status: AiStatus = {
        model: modelConfig.label,
        routingDecision: routingDecision?.reasoning || 'Routed to Tier 1 Fireworks model',
        rationale: routerDecision.explanation,
        tokensIn,
        tokensOut: compressedTokensOut,
        cost: actualCost,
        latencyMs,
        confidence: routerDecision.confidence,
        memory: budgetWarning || 'No prior memory needed',
        selectedTier: 1,
        skippedTiers: routingDecision?.skippedTiers || [],
        economyScore: routingDecision?.factors?.economyScore,
        estimatedSavings: routingDecision?.estimatedSavings,
        intent: routerDecision.intent,
        complexity: routerDecision.complexity,
        cacheHit: false,
        compressionSavings: compression.savings,
        maxOutputTokens,
        temperature,
      }

      // Fire-and-forget: adaptive learning
      qwenLearner.record({
        requestId,
        selectedTier: 1,
        intent: routerDecision.intent,
        complexityScore: routerDecision.complexity,
        latencyMs,
        costUSD: actualCost,
        cacheHit: false,
        timestamp: Date.now(),
      })

      return Response.json({ text: finalText, status })
    } catch (err: any) {
      console.warn('[Tier 1] Fireworks failed, escalating to Tier 2', err?.message ?? err)
      monitoring.incrementCounter('tier1.fireworks.escalations', 1)
      selectedTier = 2
      finalModelId = getModelByTier(2).id
    }
  }

  // ── Circuit breaker: Fireworks cloud inference (Tier 2) ─────────
  let draftSeedText: string | undefined
  let draftConfidenceScore: number | undefined
  try {
    const inferenceResult = await circuitBreaker.execute(async () => {
      // Speculative Prompting Validator (Try Tier 1 draft first for Tier 2 tasks)
      // Only attempt this shortcut for moderate complexity — very complex tasks
      // (deep reasoning, coding, multi-step analysis) skip straight to Tier 2,
      // since a cheap draft is unlikely to genuinely satisfy them and the
      // verification check below is too lenient to catch subtle shortfalls.
      const SPECULATIVE_DRAFT_COMPLEXITY_CEILING = 65
      if (selectedTier === 2 && routerDecision.complexity < SPECULATIVE_DRAFT_COMPLEXITY_CEILING) {
        const draftModel = getModelByTier(1)
        try {
          const draftResponse = await generateText({
            model: fireworks(draftModel.id),
            system: `You are RouteMind. Draft a concise initial response. IMPORTANT: You have a strict output limit of approximately ${Math.floor(Math.min(maxOutputTokens, 256) * 0.75)} words. Be extremely concise - remove filler words, unnecessary explanations, and redundant phrases. For code: provide only the essential code with minimal comments. You must summarize your answer and gracefully finish your thought before hitting this limit. Do not trail off.`,
            messages: coreMessages as any,
            maxTokens: Math.min(maxOutputTokens, 256) + 128, // Physical buffer for graceful stop
            temperature: 0.2,
          })

          // Accuracy gate: only accept the cheap draft outright if it scores
          // at/above the configured confidence threshold (default 80%).
          const confidence = economyEngine.scoreDraftConfidence(draftResponse.text, compressedPrompt)
          draftConfidenceScore = confidence

          if (confidence >= DRAFT_ACCURACY_GATE_THRESHOLD) {
            // Draft cleared the accuracy gate! No need to run Tier 2.
            finalModelId = draftModel.id
            selectedTier = 1
            return {
              text: draftResponse.text,
              usage: {
                inputTokens: draftResponse.usage.promptTokens,
                outputTokens: draftResponse.usage.completionTokens
              },
              finishReason: 'stop'
            }
          }

          // Draft didn't clear the gate — don't throw it away. As long as it's
          // not a total miss (score >= 40), keep it as a refinement seed so the
          // Tier 2 model can correct/extend it instead of writing a full answer
          // from scratch. This is the main token-saving lever for escalated
          // requests: Tier 2 typically needs far fewer output tokens to fix and
          // deepen an existing draft than to generate an equivalent answer cold.
          if (confidence >= 40) {
            draftSeedText = draftResponse.text
          }
        } catch (e) {
          // Speculative failure, proceed to Tier 2 silently
        }
      }

      // If we have a usable draft seed, fold it into the Tier 2 context and
      // trim the output budget accordingly — Tier 2 is reviewing/extending,
      // not authoring from a blank page.
      let tier2MaxOutputTokens = maxOutputTokens
      let tier2Messages = coreMessages
      if (draftSeedText) {
        tier2MaxOutputTokens = Math.max(200, Math.round(maxOutputTokens * 0.7))
        tier2Messages = [
          ...coreMessages,
          {
            role: "assistant",
            content: draftSeedText,
          },
          {
            role: "user",
            content: "Review your draft above. Correct any inaccuracies, fill in missing depth or steps, and tighten anything unclear. Reply with the improved final answer only — don't restate that you're revising it.",
          },
        ] as any
      }

      // Retry logic for model inference with intelligent model-level fallback
      const retryResult = await retryHandler.execute(async () => {
        const inferenceStart = Date.now()
        let resultText = ""
        let usage = { inputTokens: 0, outputTokens: 0 }
        let finishReason = 'stop'

        try {
          // Stream completion internally to support early abortion and token savings
          const resultStream = await streamText({
            model: fireworks(finalModelId),
            system: `You are RouteMind, a helpful, concise assistant. Answer clearly and directly, without filler or repetition. Always respond in English. IMPORTANT: You have a strict output limit of approximately ${Math.floor(tier2MaxOutputTokens * 0.75)} words. Be extremely concise - remove filler words, unnecessary explanations, and redundant phrases. For code: provide only the essential code with minimal comments. You must summarize your answer and gracefully finish your thought before hitting this limit. Do not trail off mid-sentence.`,
            messages: tier2Messages as any,
            maxTokens: tier2MaxOutputTokens + 256, // Physical buffer for graceful stop
            temperature,
            stopSequences: economyEngine.pickStopSequences(routerDecision.intent),
          })

          const reader = resultStream.textStream.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              resultText += value

              // Detect early completion opportunity to cut off model and save credits
              if (resultText.length > 150 && economyEngine.detectEarlyCompletion(resultText)) {
                finishReason = 'length' // Mark as length capped
                await reader.cancel()
                break
              }
            }
          } finally {
            reader.releaseLock()
          }

          let rawUsage
          try {
            rawUsage = await resultStream.usage
          } catch {
            rawUsage = {
              inputTokens: Math.ceil(compressedPrompt.length / 4),
              outputTokens: Math.ceil(resultText.length / 4)
            }
          }

          usage = {
            inputTokens: rawUsage.inputTokens || Math.ceil(compressedPrompt.length / 4),
            outputTokens: rawUsage.outputTokens || Math.ceil(resultText.length / 4)
          }

          monitoring.recordHistogram('inference.latency', Date.now() - inferenceStart)
          return { text: resultText, usage, finishReason }
        } catch (error) {
          // If Tier 2 fails, retry with Tier 1 (minimax) fallback
          if (selectedTier === 2 && finalModelId !== getModelByTier(1).id) {
            console.warn(`Tier 2 model failed. Retrying with Tier 1 fallback: ${getModelByTier(1).id}`)
            finalModelId = getModelByTier(1).id
          }
          throw error
        }
      })
      
      if (!retryResult.success) {
        // Recover tokens on retry failure
        economyEngine.recoverTokens(requestId, 'failed')
        throw retryResult.error
      }
      
      return retryResult.data
    })

    if (!inferenceResult) {
      economyEngine.recoverTokens(requestId, 'failed')
      throw new Error('Inference result is undefined')
    }

    const latencyMs = Date.now() - startTime
    const tokensIn = inferenceResult.usage.inputTokens ?? 0
    const tokensOut = inferenceResult.usage.outputTokens ?? 0
    
    // Apply response compression for additional token savings
    const compression = economyEngine.compressResponse(inferenceResult.text)
    const finalText = compression.compressed
    const compressedTokensOut = Math.ceil(finalText.length / 4)
    
    // Calculate cost based on the ACTUAL model used (accounting for fallback)
    const finalModelConfig = getModelById(finalModelId) || modelConfig
    const actualCost = estimateCost(
      finalModelConfig.tier,
      tokensIn,
      compressedTokensOut,
      finalModelConfig.specialization
    )

    // Check for early termination
    if (inferenceResult.finishReason !== 'stop') {
      economyEngine.recoverTokens(requestId, 'early_termination')
    } else {
      // Clear pending recovery on successful completion
      economyEngine.clearPendingRecovery(requestId)
    }

    // Update economy engine with compressed token count
    economyEngine.updateUsage(tokensIn + compressedTokensOut, actualCost)

    // Record learning event
    learningEngine.recordLearningEvent({
      requestId,
      prompt: compressedPrompt,
      selectedTier,
      actualTokens: tokensIn + tokensOut,
      actualCost,
      actualLatency: latencyMs,
      predictedTokens: routerDecision.predictedTokens.total,
      predictedCost: routerDecision.predictedCost,
      predictedLatency: routerDecision.predictedLatency,
      success: inferenceResult.finishReason === 'stop',
      intent: routerDecision.intent,
    })

    // Update routing decision engine with success/failure
    routingDecisionEngine.updateHistoricalSuccess(
      routerDecision.intent,
      inferenceResult.finishReason === 'stop',
      sessionId
    )
    routingDecisionEngine.updateCacheHitRate(
      routerDecision.intent,
      tier0Result.handled,
      sessionId
    )

    // Cache the compressed result in exact cache, session cache, and semantic cache
    const { exactCache, sessionCache, semanticCache } = await import('@/lib/tier0')
    exactCache.set(tier0Result.normalized || compressedPrompt, finalText)
    if (sessionId) {
      sessionCache.set(sessionId, tier0Result.fingerprint || compressedPrompt, finalText)
    }
    // Set in semantic cache with its embedding
    semanticCache.set(tier0Result.normalized || compressedPrompt, finalText, embedding)

    // Build enhanced status
    const status: AiStatus = {
      model: finalModelConfig.label,
      routingDecision: routingDecision.reasoning + (finalModelId !== modelConfig.id ? " (Tier 2 failed, fell back to Tier 1 minimax)" : ""),
      rationale: routerDecision.explanation,
      tokensIn,
      tokensOut: compressedTokensOut,
      cost: actualCost,
      latencyMs,
      confidence: routerDecision.confidence,
      memory: budgetWarning || 'No prior memory needed',
      selectedTier,
      skippedTiers: routingDecision.skippedTiers,
      economyScore: routingDecision.factors.economyScore,
      estimatedSavings: routingDecision.estimatedSavings,
      intent: routerDecision.intent,
      complexity: routerDecision.complexity,
      cacheHit: false,
      compressionSavings: compression.savings,
      maxOutputTokens,
      temperature,
      draftConfidence: draftConfidenceScore,
      draftAccepted: selectedTier === 1 && draftConfidenceScore !== undefined && draftConfidenceScore >= DRAFT_ACCURACY_GATE_THRESHOLD,
      draftReusedAsSeed: Boolean(draftSeedText),
    }

    monitoring.incrementCounter('requests.success', 1)
    monitoring.recordHistogram('request.latency', latencyMs)
    monitoring.recordHistogram('request.cost', actualCost)

    return Response.json({ text: finalText, status })
  } catch (err) {
    // Recover tokens on error
    economyEngine.recoverTokens(requestId, 'failed')
    
    monitoring.incrementCounter('requests.failed', 1)
    const message = err instanceof Error ? err.message : "Model request failed."
    
    // Record learning event for failure
    learningEngine.recordLearningEvent({
      requestId,
      prompt: compressedPrompt,
      selectedTier,
      actualTokens: 0,
      actualCost: 0,
      actualLatency: Date.now() - startTime,
      predictedTokens: routerDecision.predictedTokens.total,
      predictedCost: routerDecision.predictedCost,
      predictedLatency: routerDecision.predictedLatency,
      success: false,
      intent: routerDecision.intent,
    })

    return Response.json({ error: message }, { status: 502 })
  }
}
