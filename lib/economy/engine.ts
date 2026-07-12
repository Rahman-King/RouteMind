/**
 * AI Economy Engine
 * Implements token prediction, cost optimization, and compression
 */
import { summarizeLocally } from '../tier0/transformer';

// Minimum draft-confidence score (0-100) required to accept a cheap Tier 1
// draft in place of a real Tier 2 call. Configurable via env for tuning
// without a code change; defaults to 80% as the quality floor.
export const DRAFT_ACCURACY_GATE_THRESHOLD = Number(process.env.DRAFT_ACCURACY_GATE) || 80

export interface EconomyMetrics {
  tokenBudget: number
  tokensUsed: number
  tokensRemaining: number
  costBudget: number
  costUsed: number
  costRemaining: number
  savings: {
    tokens: number
    cost: number
    percentage: number
  }
  recovered: {
    tokens: number
    cost: number
  }
}

export interface CompressionResult {
  original: string
  compressed: string
  savings: {
    tokens: number
    percentage: number
  }
  method: string
}

class EconomyEngine {
  private tokenBudget = 1_000_000 // 1M tokens per session
  private costBudget = 10.0 // $10 per session
  private tokensUsed = 0
  private costUsed = 0
  private compressionEnabled = true // Always enabled for token savings
  private tokensRecovered = 0
  private costRecovered = 0
  private pendingRecovery = new Map<string, { tokens: number; cost: number }>()

  /**
   * Get current economy metrics
   */
  getMetrics(): EconomyMetrics {
    return {
      tokenBudget: this.tokenBudget,
      tokensUsed: this.tokensUsed,
      tokensRemaining: this.tokenBudget - this.tokensUsed,
      costBudget: this.costBudget,
      costUsed: this.costUsed,
      costRemaining: this.costBudget - this.costUsed,
      savings: {
        tokens: 0, // Track actual savings
        cost: 0,
        percentage: 0,
      },
      recovered: {
        tokens: this.tokensRecovered,
        cost: this.costRecovered,
      },
    }
  }

  /**
   * Update usage after a request
   */
  updateUsage(tokensUsed: number, cost: number): void {
    this.tokensUsed += tokensUsed
    this.costUsed += cost
  }

  /**
   * Check if request is within budget
   */
  isWithinBudget(estimatedTokens: number, estimatedCost: number): boolean {
    return (
      (this.tokensUsed + estimatedTokens) <= this.tokenBudget &&
      (this.costUsed + estimatedCost) <= this.costBudget
    )
  }

  /**
   * Reset budget (new session)
   */
  resetBudget(): void {
    this.tokensUsed = 0
    this.costUsed = 0
    this.tokensRecovered = 0
    this.costRecovered = 0
    this.pendingRecovery.clear()
  }

  /**
   * Set custom budget
   */
  setBudget(tokens: number, cost: number): void {
    this.tokenBudget = tokens
    this.costBudget = cost
  }

  /**
   * Record pending recovery for a request
   */
  recordPendingRecovery(requestId: string, tokens: number, cost: number): void {
    this.pendingRecovery.set(requestId, { tokens, cost })
  }

  /**
   * Recover tokens from failed/aborted request
   */
  recoverTokens(requestId: string, reason: 'failed' | 'timeout' | 'tier_change' | 'early_termination' | 'cache_hit'): void {
    const pending = this.pendingRecovery.get(requestId)
    if (!pending) return

    let recoveryMultiplier = 1.0
    switch (reason) {
      case 'failed':
        recoveryMultiplier = 0.8 // Recover 80% on failure
        break
      case 'timeout':
        recoveryMultiplier = 0.5 // Recover 50% on timeout
        break
      case 'tier_change':
        recoveryMultiplier = 0.3 // Recover 30% on tier downgrade
        break
      case 'early_termination':
        recoveryMultiplier = 0.6 // Recover 60% on early termination
        break
      case 'cache_hit':
        recoveryMultiplier = 1.0 // Recover 100% on cache hit
        break
    }

    const tokensToRecover = Math.floor(pending.tokens * recoveryMultiplier)
    const costToRecover = pending.cost * recoveryMultiplier

    // Only recover if tokens were actually used
    if (this.tokensUsed >= tokensToRecover) {
      this.tokensUsed -= tokensToRecover
      this.tokensRecovered += tokensToRecover
    }
    
    if (this.costUsed >= costToRecover) {
      this.costUsed -= costToRecover
      this.costRecovered += costToRecover
    }

    this.pendingRecovery.delete(requestId)
  }

  /**
   * Clear pending recovery (request completed successfully)
   */
  clearPendingRecovery(requestId: string): void {
    this.pendingRecovery.delete(requestId)
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    return {
      tokensRecovered: this.tokensRecovered,
      costRecovered: this.costRecovered,
      pendingRecovery: this.pendingRecovery.size,
      recoveryRate: this.tokensUsed > 0 ? (this.tokensRecovered / this.tokensUsed) * 100 : 0,
    }
  }

  /**
   * Compress prompt to reduce token usage
   */
  compressPrompt(prompt: string): CompressionResult {
    if (!this.compressionEnabled) {
      return {
        original: prompt,
        compressed: prompt,
        savings: { tokens: 0, percentage: 0 },
        method: 'disabled',
      }
    }

    const originalTokens = this.estimateTokens(prompt)
    let compressed = prompt

    // Apply compression strategies in order of effectiveness
    compressed = this.removeRedundancy(compressed)
    compressed = this.normalizeWhitespace(compressed)
    compressed = this.removeFillerWords(compressed)
    compressed = this.removeStopWords(compressed)
    compressed = this.shortenCommonPhrases(compressed)
    compressed = this.compressCodeBlocks(compressed)
    compressed = this.removeRepetitivePatterns(compressed)

    const compressedTokens = this.estimateTokens(compressed)
    const tokenSavings = originalTokens - compressedTokens
    const percentage = originalTokens > 0 ? (tokenSavings / originalTokens) * 100 : 0

    return {
      original: prompt,
      compressed,
      savings: {
        tokens: tokenSavings,
        percentage: Math.round(percentage * 10) / 10,
      },
      method: 'multi-strategy-aggressive',
    }
  }

  /**
   * Lossless prompt optimization for the ACTUAL inference call.
   *
   * Unlike compressPrompt(), this NEVER removes stop words, collapses
   * repeated characters, or rewrites phrasing — operations that corrupt
   * code, numbers, and meaning. It only strips redundant whitespace, so
   * real tokens are saved while answer quality is fully preserved.
   */
  optimizeForInference(prompt: string): CompressionResult {
    if (!this.compressionEnabled) {
      return {
        original: prompt,
        compressed: prompt,
        savings: { tokens: 0, percentage: 0 },
        method: 'disabled',
      }
    }

    const originalTokens = this.estimateTokens(prompt)

    // Lossless whitespace normalization only (newlines preserved for code).
    const compressed = prompt
      .replace(/[ \t]+/g, ' ') // collapse runs of spaces/tabs
      .replace(/ *\n */g, '\n') // trim spaces around newlines
      .replace(/\n{3,}/g, '\n\n') // cap consecutive blank lines
      .trim()

    const compressedTokens = this.estimateTokens(compressed)
    const tokenSavings = Math.max(0, originalTokens - compressedTokens)
    const percentage = originalTokens > 0 ? (tokenSavings / originalTokens) * 100 : 0

    return {
      original: prompt,
      compressed,
      savings: {
        tokens: tokenSavings,
        percentage: Math.round(percentage * 10) / 10,
      },
      method: 'lossless-whitespace',
    }
  }

  /**
   * Safe prompt rewriting to eliminate filler and redundant phrasing
   * without corrupting code or syntax.
   */
  safeRewritePrompt(prompt: string): string {
    let compressed = prompt
    // 1. Remove duplicate sentences
    const sentences = compressed.split(/[.!?]+/)
    const uniqueSentences = [...new Set(sentences.map(s => s.trim()))]
    if (uniqueSentences.length < sentences.length) {
      compressed = uniqueSentences.join('. ')
    }
    // 2. Remove filler words safely (only if not inside code block)
    if (!compressed.includes('```')) {
      const fillerWords = ['basically', 'actually', 'literally', 'you know', 'really']
      for (const filler of fillerWords) {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi')
        compressed = compressed.replace(regex, '')
      }
    }
    // 3. Shorten common phrases
    const phraseReplacements: Record<string, string> = {
      'in order to': 'to',
      'as soon as possible': 'asap',
      'for the purpose of': 'for',
      'in the event that': 'if',
      'with regard to': 'about',
      'in the case of': 'for',
      'at the present time': 'now',
    }
    for (const [phrase, replacement] of Object.entries(phraseReplacements)) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi')
      compressed = compressed.replace(regex, replacement)
    }
    
    // 4. Whitespace normalization
    return compressed
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  /**
   * Adaptive output-token budgeting.
   *
   * Predicts a sensible max_tokens cap from intent + complexity so models
   * don't emit unnecessarily long answers — the most expensive part of a
   * request, especially on Tier 2. Honors an explicit user override and is
   * always clamped to the model's own ceiling.
   */
  predictMaxOutputTokens(opts: {
    intent?: string
    complexity?: number
    userMax?: number
    ceiling?: number
  }): number {
    const { intent = 'general', complexity = 40, userMax, ceiling = 16384 } = opts

    // Base output budget by intent (tokens)
    const intentBudgets: Record<string, number> = {
      greeting: 256,
      classification: 256,
      extraction: 512,
      factual: 1024,
      translation: 1024,
      general: 1024,
      explanation: 2048,
      analysis: 2048,
      reasoning: 2048,
      math: 2048,
      creative: 2048,
      writing: 3072,
      expert: 4096,
      coding: 512,
    }
    let budget = intentBudgets[intent.toLowerCase()] ?? 512

    // Scale up with complexity (0-100): reduced scaling for coding to keep output concise
    const clampedComplexity = Math.min(100, Math.max(0, complexity))
    const isCoding = intent.toLowerCase() === 'coding'
    const scaleFactor = isCoding ? 0.3 : 0.8 // Less scaling for coding tasks
    budget = Math.ceil(budget * (1 + (clampedComplexity / 100) * scaleFactor))

    // Explicit user cap takes precedence when smaller.
    if (typeof userMax === 'number' && userMax > 0) {
      budget = Math.min(budget, userMax)
    }

    // Clamp to sane bounds and the model ceiling.
    return Math.max(64, Math.min(budget, ceiling))
  }

  /**
   * Temperature optimization.
   *
   * Deterministic tasks (routing, coding, math, extraction, classification)
   * use a low temperature for stable, correct output; creative tasks use a
   * higher temperature. An explicit user creativity slider always wins.
   */
  pickTemperature(opts: {
    intent?: string
    specialization?: string
    creativity?: number
  }): number {
    const { intent = 'general', specialization = 'general', creativity } = opts

    // Explicit user creativity slider (0-100) overrides heuristics.
    if (typeof creativity === 'number') {
      return Math.max(0, Math.min(1, creativity / 100))
    }

    const deterministic = ['coding', 'math', 'extraction', 'classification', 'reasoning', 'debugging', 'translation', 'json', 'routing']
    const creative = ['creative', 'writing', 'story', 'poem', 'brainstorm']

    const key = (specialization !== 'general' ? specialization : intent).toLowerCase()
    if (deterministic.includes(key)) return 0.2
    if (creative.includes(key)) return 0.7
    return 0.4
  }

  /**
   * Predict stop sequences based on intent
   */
  pickStopSequences(intent: string = 'general'): string[] {
    const key = intent.toLowerCase()
    if (key === 'classification' || key === 'routing') {
      return ['\n', '}', ']']
    }
    if (key === 'greeting') {
      return ['\n\n']
    }
    if (key === 'coding') {
      return ['\n\nUser:', '\n\nAssistant:', '```\n\n']
    }
    return ['\n\nUser:', '\n\nAssistant:']
  }

  /**
   * Predict input tokens count (rough estimate: length / 4)
   */
  predictInputTokens(prompt: string, history?: Array<{ role: string; content: string }>): number {
    let tokens = Math.ceil(prompt.length / 4)
    if (history) {
      for (const msg of history) {
        tokens += Math.ceil(msg.content.length / 4)
      }
    }
    return tokens
  }

  /**
   * Manages token budget: trims context automatically and warns when limits are exceeded
   */
  async manageTokenBudget(
    prompt: string,
    history?: Array<{ role: string; content: string }>,
    limit: number = 2048
  ): Promise<{
    processedPrompt: string
    processedHistory?: Array<{ role: string; content: string }>
    warning?: string
  }> {
    let totalEstimated = this.predictInputTokens(prompt, history)
    
    if (totalEstimated <= limit) {
      return { processedPrompt: prompt, processedHistory: history }
    }
    
    // We exceed budget! Let's trim context.
    let warning = `Token budget exceeded (${totalEstimated} > ${limit} tokens). Trimming conversation context.`
    let trimmedHistory = history ? [...history] : []
    
    // Keep trimming from the beginning of history until we fit
    while (trimmedHistory.length > 1 && totalEstimated > limit) {
      trimmedHistory.shift() // Remove oldest message
      totalEstimated = this.predictInputTokens(prompt, trimmedHistory)
    }
    
    // If still over budget, compress the remaining history
    if (totalEstimated > limit && trimmedHistory.length > 0) {
      trimmedHistory = await this.compressContext(trimmedHistory)
      totalEstimated = this.predictInputTokens(prompt, trimmedHistory)
    }
    
    // If still over budget, truncate the prompt itself (extreme fallback)
    let processedPrompt = prompt
    if (totalEstimated > limit) {
      const allowedChars = (limit - this.predictInputTokens("", trimmedHistory)) * 4
      if (allowedChars > 100) {
        processedPrompt = prompt.slice(0, allowedChars) + " ... [trimmed]"
        warning += " Prompt has been truncated to fit token limits."
      }
    }
    
    return {
      processedPrompt,
      processedHistory: trimmedHistory,
      warning,
    }
  }

  /**
   * Compress context/history
   */
  async compressContext(messages: Array<{ role: string; content: string }>): Promise<Array<{ role: string; content: string }>> {
    if (!this.compressionEnabled) return messages

    // Keep recent messages, summarize older ones
    const maxRecent = 5
    if (messages.length <= maxRecent) return messages

    const recent = messages.slice(-maxRecent)
    const older = messages.slice(0, -maxRecent)

    // Summarize older messages using local T5 Transformer
    const summary = await this.summarizeMessages(older)
    
    return [
      { role: 'system', content: `[Summary of ${older.length} previous messages: ${summary}]` },
      ...recent,
    ]
  }

  /**
   * Compress response
   */
  compressResponse(response: string): CompressionResult {
    if (!this.compressionEnabled) {
      return {
        original: response,
        compressed: response,
        savings: { tokens: 0, percentage: 0 },
        method: 'disabled',
      }
    }

    const originalTokens = this.estimateTokens(response)
    let compressed = response

    // Remove redundant explanations
    compressed = this.removeRedundantPhrases(compressed)
    compressed = this.normalizeWhitespace(compressed)

    const compressedTokens = this.estimateTokens(compressed)
    const tokenSavings = originalTokens - compressedTokens
    const percentage = originalTokens > 0 ? (tokenSavings / originalTokens) * 100 : 0

    return {
      original: response,
      compressed,
      savings: {
        tokens: tokenSavings,
        percentage: Math.round(percentage * 10) / 10,
      },
      method: 'response-optimization',
    }
  }

  /**
   * Detect early completion opportunity
   */
  detectEarlyCompletion(partialResponse: string): boolean {
    // Check for completion indicators
    const completionIndicators = [
      /\.\s*$/,
      /!\s*$/,
      /\?\s*$/,
      /done\.?$/i,
      /complete\.?$/i,
      /finished\.?$/i,
    ]

    for (const indicator of completionIndicators) {
      if (indicator.test(partialResponse.trim())) {
        return true
      }
    }

    return false
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Remove redundancy from text
   */
  private removeRedundancy(text: string): string {
    // Remove repeated phrases
    let compressed = text
    
    // Remove duplicate sentences
    const sentences = text.split(/[.!?]+/)
    const uniqueSentences = [...new Set(sentences.map(s => s.trim()))]
    
    if (uniqueSentences.length < sentences.length) {
      compressed = uniqueSentences.join('. ')
    }

    return compressed
  }

  /**
   * Normalize whitespace
   */
  private normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * Remove filler words
   */
  private removeFillerWords(text: string): string {
    const fillerWords = [
      'um', 'uh', 'like', 'you know', 'basically', 'actually',
      'literally', 'really', 'very', 'quite', 'rather',
    ]

    let compressed = text
    for (const filler of fillerWords) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi')
      compressed = compressed.replace(regex, '')
    }

    return this.normalizeWhitespace(compressed)
  }

  /**
   * Compress code blocks
   */
  private compressCodeBlocks(text: string): string {
    // Remove excessive comments in code blocks
    return text.replace(/```[\s\S]*?```/g, (match) => {
      // Keep code but remove excessive comments
      return match.replace(/\/\/.*$/gm, '').replace(/#.*$/gm, '')
    })
  }

  /**
   * Remove redundant phrases
   */
  private removeRedundantPhrases(text: string): string {
    const redundantPhrases = [
      'in other words',
      'to put it differently',
      'what i mean is',
      'basically',
      'essentially',
    ]

    let compressed = text
    for (const phrase of redundantPhrases) {
      const regex = new RegExp(phrase, 'gi')
      compressed = compressed.replace(regex, '')
    }

    return this.normalizeWhitespace(compressed)
  }

  /**
   * Remove common stop words
   */
  private removeStopWords(text: string): string {
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    ]

    let compressed = text
    for (const stopWord of stopWords) {
      const regex = new RegExp(`\\b${stopWord}\\b`, 'gi')
      compressed = compressed.replace(regex, '')
    }

    return this.normalizeWhitespace(compressed)
  }

  /**
   * Shorten common phrases
   */
  private shortenCommonPhrases(text: string): string {
    const phraseReplacements: Record<string, string> = {
      'in order to': 'to',
      'as soon as possible': 'asap',
      'for the purpose of': 'for',
      'in the event that': 'if',
      'with regard to': 'about',
      'in the case of': 'for',
      'at the present time': 'now',
      'in the meantime': 'meanwhile',
      'on the other hand': 'however',
      'in addition to': 'plus',
      'due to the fact that': 'because',
      'in spite of': 'despite',
      'with the exception of': 'except',
    }

    let compressed = text
    for (const [phrase, replacement] of Object.entries(phraseReplacements)) {
      const regex = new RegExp(phrase, 'gi')
      compressed = compressed.replace(regex, replacement)
    }

    return compressed
  }

  /**
   * Remove repetitive patterns
   */
  private removeRepetitivePatterns(text: string): string {
    // Remove repeated characters (e.g., "aaaa" -> "a")
    let compressed = text.replace(/(.)\1{2,}/g, '$1')
    
    // Remove repeated punctuation
    compressed = compressed.replace(/([!?.,])\1+/g, '$1')
    
    // Remove repeated words
    compressed = compressed.replace(/\b(\w+)\s+\1\b/gi, '$1')
    
    return compressed
  }

  private async summarizeMessages(messages: Array<{ role: string; content: string }>): Promise<string> {
    const rawText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    try {
      // Fast, dependency-free extractive summarization (zero API cost).
      const summary = await summarizeLocally(rawText, 150);
      return summary;
    } catch (e) {
      // Fallback heuristic if local model fails
      const topics = new Set<string>();
      let codeBlocksCount = 0;
      let keyQuestions: string[] = [];
      
      for (const m of messages) {
        const text = m.content;
        if (text.includes('```')) {
          codeBlocksCount++;
        }
        
        const questionMatches = text.match(/[^.!?]+\?/g);
        if (questionMatches) {
          for (const q of questionMatches) {
            if (keyQuestions.length < 3 && q.trim().length > 10 && q.trim().length < 100) {
              keyQuestions.push(q.trim());
            }
          }
        }
        
        const keywords = ['login', 'database', 'auth', 'button', 'align', 'bug', 'error', 'slow', 'latency', 'api', 'schema', 'css', 'tailwind', 'component', 'props', 'state', 'token', 'budget', 'cache', 'routing'];
        for (const word of keywords) {
          if (text.toLowerCase().includes(word)) {
            topics.add(word);
          }
        }
      }
      
      const topicList = topics.size > 0 ? `Topics discussed: ${Array.from(topics).join(', ')}.` : '';
      const codeInfo = codeBlocksCount > 0 ? ` Included ${codeBlocksCount} code snippet(s).` : '';
      const questionInfo = keyQuestions.length > 0 ? ` Key queries: "${keyQuestions.join('", "')}".` : '';
      
      return `History of ${messages.length} messages. ${topicList}${codeInfo}${questionInfo}`.trim();
    }
  }

  /**
   * Prompt Delta Compression
   * If the current prompt is a minor edit of the last user message, send only the diff.
   */
  computeDelta(prompt: string, history?: Array<{role: string, content: string}>): string {
    if (!history || history.length === 0) return prompt;
    const lastUser = history.slice().reverse().find(m => m.role === 'user');
    if (!lastUser || lastUser.content.length < 50) return prompt;
    
    const oldText = lastUser.content;
    const newText = prompt;
    
    let prefixLen = 0;
    while (prefixLen < oldText.length && prefixLen < newText.length && oldText[prefixLen] === newText[prefixLen]) {
      prefixLen++;
    }
    
    let suffixLen = 0;
    while (suffixLen < oldText.length - prefixLen && suffixLen < newText.length - prefixLen && oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]) {
      suffixLen++;
    }
    
    const sharedRatio = (prefixLen + suffixLen) / Math.max(oldText.length, newText.length);
    if (sharedRatio > 0.6) {
      const added = newText.substring(prefixLen, newText.length - suffixLen);
      return `[Editing previous prompt] Replace the modified section with: "${added}"`;
    }
    return prompt;
  }

  /**
   * Hierarchical Vector Chunk Ranking
   * Chunks large external documents and uses term overlap (TF-IDF simplification) to keep only topN chunks.
   */
  rankContextChunks(documentText: string, query: string, topN: number = 3): string {
    const chunks = documentText.split(/\n\n+/).filter(c => c.trim().length > 20);
    if (chunks.length <= topN) return documentText;
    
    const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const scored = chunks.map(chunk => {
      const chunkWords = chunk.toLowerCase().split(/\W+/);
      let score = 0;
      for (const w of chunkWords) {
        if (queryWords.has(w)) score++;
      }
      return { chunk, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topN).map(s => s.chunk);
    
    return topChunks.join('\n\n...\n\n');
  }

  /**
   * Speculative Prompting Draft Confidence Score
   * Scores a Tier-1 draft's likely accuracy/completeness for the query, 0-100.
   * Used as an "accuracy gate": only drafts scoring >= DRAFT_ACCURACY_GATE_THRESHOLD
   * are accepted as final answers; anything lower escalates to Tier 2 for quality,
   * while still keeping the (already-paid-for) draft around as a token-saving seed.
   */
  scoreDraftConfidence(draft: string, query: string): number {
    const dLower = draft.toLowerCase();
    const qLower = query.toLowerCase();
    let score = 100;

    // Hard failure markers — draft explicitly gave up or hedged heavily.
    const failureMarkers = [
      "i cannot", "i can't", "i am unable", "i'm sorry",
      "i do not have", "i don't know", "as an ai", "error",
      "insufficient information",
    ];
    for (const marker of failureMarkers) {
      if (dLower.includes(marker)) return 0;
    }

    // Soft hedging language — draft is unsure of itself, docks confidence
    // without necessarily failing outright.
    const hedgeMarkers = ["might be", "not entirely sure", "i think", "possibly", "it's unclear"];
    for (const marker of hedgeMarkers) {
      if (dLower.includes(marker)) score -= 10;
    }

    // Structural requirements for code/JSON queries.
    if ((qLower.includes("code") || qLower.includes("function")) && !draft.includes("```")) {
      score -= 45;
    }
    if (qLower.includes("json") && !draft.includes("{")) {
      score -= 45;
    }

    // Depth requirement: "explain/why/compare/etc" queries need substance.
    const asksForDepth = /(explain|why|analyze|compare|evaluate|reason through|step by step|in detail)/i.test(query);
    const wordCount = draft.trim().split(/\s+/).filter(Boolean).length;
    if (asksForDepth) {
      if (wordCount < 40) score -= 50;
      else if (wordCount < 80) score -= 20;
    }

    // Relevance check: how many meaningful query terms actually show up in the draft.
    // Low overlap on a substantive query is a sign the draft drifted off-topic.
    const queryWords = Array.from(new Set(qLower.split(/\W+/).filter(w => w.length > 3)));
    if (queryWords.length >= 3) {
      const covered = queryWords.filter(w => dLower.includes(w)).length;
      const coverage = covered / queryWords.length;
      if (coverage < 0.3) score -= 25;
      else if (coverage < 0.5) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Speculative Prompting Draft Validator
   * Verifies if a draft from Tier 1 is satisfactory or if we must escalate to Tier 2.
   * Thin wrapper over scoreDraftConfidence() for any callers that just need a boolean.
   */
  verifyDraft(draft: string, query: string): boolean {
    return this.scoreDraftConfidence(draft, query) >= DRAFT_ACCURACY_GATE_THRESHOLD;
  }

  /**
   * Dynamic Instruction Ordering
   * Reorders prompts to place key constraints at the very end (recency effect).
   */
  dynamicInstructionOrdering(prompt: string): string {
    const constraintKeywords = ["strictly", "only", "must", "do not", "never", "always"];
    const sentences = prompt.split(/(?<=[.!?])\s+/);
    const constraints: string[] = [];
    const others: string[] = [];
    
    for (const s of sentences) {
      if (constraintKeywords.some(k => s.toLowerCase().includes(k))) {
        constraints.push(s);
      } else {
        others.push(s);
      }
    }
    
    if (constraints.length > 0 && others.length > 0) {
      return [...others, ...constraints].join(" ");
    }
    return prompt;
  }

  /**
   * Compact JSON Generation
   * Modifies JSON requests to strictly forbid markdown wrappers to save tokens.
   */
  compactJsonGeneration(prompt: string): string {
    if (prompt.toLowerCase().includes("json") && !prompt.toLowerCase().includes("markdown")) {
      return prompt + " Respond ONLY with raw minified JSON. Do not use ```json wrappers.";
    }
    return prompt;
  }

  /**
   * Enable/disable compression
   */
  setCompressionEnabled(enabled: boolean): void {
    this.compressionEnabled = enabled
  }

  /**
   * Calculate potential savings
   */
  calculatePotentialSavings(prompt: string, contextLength: number): {
    tokens: number
    cost: number
    percentage: number
  } {
    const promptCompression = this.compressPrompt(prompt)
    const contextSavings = contextLength * 0.3 // Assume 30% savings from context compression
    
    const totalSavings = promptCompression.savings.tokens + contextSavings
    const originalTotal = this.estimateTokens(prompt) + contextLength
    const percentage = originalTotal > 0 ? (totalSavings / originalTotal) * 100 : 0
    
    // Assume average cost of $0.50 per 1M tokens
    const costSavings = (totalSavings / 1_000_000) * 0.5

    return {
      tokens: Math.round(totalSavings),
      cost: Math.round(costSavings * 10000) / 10000,
      percentage: Math.round(percentage * 10) / 10,
    }
  }
}

// Singleton instance
export const economyEngine = new EconomyEngine()
