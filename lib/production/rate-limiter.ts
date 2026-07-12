/**
 * Rate Limiter
 * Implements token bucket algorithm for rate limiting
 */

export interface RateLimitConfig {
  requestsPerSecond: number
  burstSize: number
}

export interface RateLimitResult {
  allowed: boolean
  remainingRequests: number
  resetTime: number
}

class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastUpdate: number }>()
  private defaultConfig: RateLimitConfig = {
    requestsPerSecond: 10,
    burstSize: 20,
  }

  /**
   * Check if request is allowed
   */
  check(identifier: string, config?: Partial<RateLimitConfig>): RateLimitResult {
    const finalConfig = { ...this.defaultConfig, ...config }
    const now = Date.now()
    const bucket = this.buckets.get(identifier)

    if (!bucket) {
      this.buckets.set(identifier, {
        tokens: finalConfig.burstSize - 1,
        lastUpdate: now,
      })
      return {
        allowed: true,
        remainingRequests: finalConfig.burstSize - 1,
        resetTime: now + 1000,
      }
    }

    // Refill tokens based on time elapsed
    const timePassed = (now - bucket.lastUpdate) / 1000
    const tokensToAdd = Math.floor(timePassed * finalConfig.requestsPerSecond)
    bucket.tokens = Math.min(
      finalConfig.burstSize,
      bucket.tokens + tokensToAdd
    )
    bucket.lastUpdate = now

    // Check if request is allowed
    if (bucket.tokens >= 1) {
      bucket.tokens--
      return {
        allowed: true,
        remainingRequests: bucket.tokens,
        resetTime: now + 1000,
      }
    }

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: now + Math.ceil((1 - bucket.tokens) / finalConfig.requestsPerSecond) * 1000,
    }
  }

  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.buckets.delete(identifier)
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.buckets.clear()
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeBuckets: this.buckets.size,
      defaultConfig: this.defaultConfig,
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()
