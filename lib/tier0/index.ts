/**
 * Tier 0 Local Intelligence Entry Point
 * Exports all Tier 0 components for deterministic processing
 */

export { exactCache, semanticCache, sessionCache } from './cache'
export { ruleEngine } from './rule-engine'
export { promptNormalizer, duplicateDetector } from './normalization'

/**
 * Tier 0 processing pipeline
 * Handles deterministic processing before LLM inference
 */
export async function processTier0(prompt: string, sessionId?: string) {
  const { exactCache, semanticCache, sessionCache, ruleEngine, promptNormalizer, duplicateDetector } = await import('./index')
  
  // Normalize prompt
  const normalized = promptNormalizer.normalize(prompt)
  const fingerprint = promptNormalizer.fingerprint(prompt)
  
  // Check duplicate request detector
  if (duplicateDetector.isRecentDuplicate(prompt)) {
    const cachedResponse = exactCache.get(normalized)
    if (cachedResponse) {
      exactCache.recordHit()
      return {
        handled: true,
        source: 'duplicate_detector',
        response: cachedResponse,
      }
    }
  }

  // Check exact cache
  const exactMatch = exactCache.get(normalized)
  if (exactMatch) {
    exactCache.recordHit()
    return {
      handled: true,
      source: 'exact_cache',
      response: exactMatch,
    }
  }
  exactCache.recordMiss()
  
  // Check session cache if session ID provided
  if (sessionId) {
    const sessionMatch = sessionCache.get(sessionId, fingerprint)
    if (sessionMatch) {
      return {
        handled: true,
        source: 'session_cache',
        response: sessionMatch,
      }
    }
  }
  
  // Check rule engine
  const ruleResult = ruleEngine.canHandle(prompt)
  if (ruleResult.canHandle) {
    const response = typeof ruleResult.result === 'string' 
      ? ruleResult.result 
      : JSON.stringify(ruleResult.result)
    
    // Cache the result
    exactCache.set(normalized, response)
    if (sessionId) {
      sessionCache.set(sessionId, fingerprint, response)
    }
    
    // Only record as duplicate if successfully handled
    duplicateDetector.recordPrompt(prompt)
    
    return {
      handled: true,
      source: 'rule_engine',
      rule: ruleResult.rule,
      response,
    }
  }
  
  // Not handled by Tier 0 - do NOT record as duplicate
  // (Only record successfully handled prompts to avoid false positives)
  
  return {
    handled: false,
    normalized,
    fingerprint,
    category: promptNormalizer.detectCategory(prompt),
  }
}
