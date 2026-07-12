/**
 * Tier 0 Cache Systems
 * Implements exact, semantic, and session caching to avoid unnecessary LLM calls
 */

interface CacheEntry {
  response: string
  timestamp: number
  accessCount: number
  expirationScore: number
}

interface SemanticCacheEntry extends CacheEntry {
  embedding?: number[]
  similarity: number
}

class ExactCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize = 1000
  private ttl = 3600000 // 1 hour

  set(key: string, response: string): void {
    const fingerprint = this.fingerprint(key)
    this.cache.set(fingerprint, {
      response,
      timestamp: Date.now(),
      accessCount: 0,
      expirationScore: 100,
    })
    this.evictIfNeeded()
  }

  get(key: string): string | null {
    const fingerprint = this.fingerprint(key)
    const entry = this.cache.get(fingerprint)
    
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(fingerprint)
      return null
    }
    
    entry.accessCount++
    entry.expirationScore = Math.min(entry.expirationScore + 15, 500)
    return entry.response
  }

  private fingerprint(text: string): string {
    // Simple hash for exact matching
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  private evictIfNeeded(): void {
    if (this.cache.size > this.maxSize) {
      // Evict based on Cache Expiration Scoring (time decay + popularity)
      let worstKey: string | null = null
      let lowestScore = Infinity
      const now = Date.now()
      
      for (const [key, entry] of this.cache.entries()) {
        const ageHours = (now - entry.timestamp) / 3600000
        const decayedScore = entry.expirationScore / Math.max(1, ageHours)
        if (decayedScore < lowestScore) {
          lowestScore = decayedScore
          worstKey = key
        }
      }
      
      if (worstKey) {
        this.cache.delete(worstKey)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate(),
    }
  }

  private hits = 0
  private misses = 0

  private calculateHitRate(): number {
    const total = this.hits + this.misses
    return total > 0 ? this.hits / total : 0
  }

  recordHit(): void {
    this.hits++
  }

  recordMiss(): void {
    this.misses++
  }
}

class SemanticCache {
  private cache = new Map<string, SemanticCacheEntry>()
  private maxSize = 500
  private ttl = 7200000 // 2 hours
  private similarityThreshold = 0.85

  set(key: string, response: string, embedding?: number[]): void {
    const fingerprint = this.fingerprint(key)
    this.cache.set(fingerprint, {
      response,
      timestamp: Date.now(),
      accessCount: 0,
      expirationScore: 100,
      embedding,
      similarity: 1.0,
    })
    this.evictIfNeeded()
  }

  get(key: string, embedding?: number[]): string | null {
    const fingerprint = this.fingerprint(key)
    const entry = this.cache.get(fingerprint)
    
    if (entry) {
      if (Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(fingerprint)
        return null
      }
      entry.accessCount++
      entry.expirationScore = Math.min(entry.expirationScore + 20, 1000)
      return entry.response
    }
    
    // Try semantic similarity if embedding provided
    if (embedding) {
      const similar = this.findSimilar(embedding)
      if (similar) return similar
    }
    
    // Fallback to local similarity search
    const localSimilar = this.findSimilarLocal(key)
    if (localSimilar) return localSimilar
    
    return null
  }

  private findSimilar(embedding: number[]): string | null {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.embedding && this.cosineSimilarity(embedding, entry.embedding) > this.similarityThreshold) {
        entry.accessCount++
        entry.expirationScore = Math.min(entry.expirationScore + 20, 1000)
        return entry.response
      }
    }
    return null
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  private calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2))
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2))
    
    if (words1.size === 0 || words2.size === 0) return 0
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }

  private findSimilarLocal(key: string): string | null {
    for (const [cacheKey, entry] of this.cache.entries()) {
      if (this.calculateJaccardSimilarity(key, cacheKey) >= 0.88) {
        entry.accessCount++
        entry.expirationScore = Math.min(entry.expirationScore + 20, 1000)
        return entry.response
      }
    }
    return null
  }

  private fingerprint(text: string): string {
    return text.toLowerCase().trim()
  }

  private evictIfNeeded(): void {
    if (this.cache.size > this.maxSize) {
      let worstKey: string | null = null
      let lowestScore = Infinity
      const now = Date.now()
      
      for (const [key, entry] of this.cache.entries()) {
        const ageHours = (now - entry.timestamp) / 3600000
        const decayedScore = entry.expirationScore / Math.max(1, ageHours)
        if (decayedScore < lowestScore) {
          lowestScore = decayedScore
          worstKey = key
        }
      }
      
      if (worstKey) {
        this.cache.delete(worstKey)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

class SessionCache {
  private sessions = new Map<string, Map<string, CacheEntry>>()
  private sessionTTL = 1800000 // 30 minutes
  private maxSessions = 100

  set(sessionId: string, key: string, response: string): void {
    let session = this.sessions.get(sessionId)
    if (!session) {
      session = new Map()
      this.sessions.set(sessionId, session)
      this.evictIfNeeded()
    }
    
    session.set(key, {
      response,
      timestamp: Date.now(),
      accessCount: 0,
    })
  }

  get(sessionId: string, key: string): string | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    
    const entry = session.get(key)
    if (!entry) return null
    
    if (Date.now() - entry.timestamp > this.sessionTTL) {
      session.delete(key)
      if (session.size === 0) {
        this.sessions.delete(sessionId)
      }
      return null
    }
    
    entry.accessCount++
    return entry.response
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  private evictIfNeeded(): void {
    if (this.sessions.size > this.maxSessions) {
      const firstKey = this.sessions.keys().next().value
      if (firstKey) {
        this.sessions.delete(firstKey)
      }
    }
  }

  clear(): void {
    this.sessions.clear()
  }
}

// Singleton instances
export const exactCache = new ExactCache()
export const semanticCache = new SemanticCache()
export const sessionCache = new SessionCache()
