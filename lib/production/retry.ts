/**
 * Retry Logic with Exponential Backoff
 * Handles transient failures with intelligent retry strategy
 */

export interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDelay: number
}

class RetryHandler {
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.defaultConfig, ...config }
    let attempts = 0
    let totalDelay = 0
    let lastError: Error | undefined

    while (attempts <= finalConfig.maxRetries) {
      attempts++

      try {
        const data = await fn()
        return {
          success: true,
          data,
          attempts,
          totalDelay,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on certain errors
        if (this.shouldNotRetry(lastError)) {
          return {
            success: false,
            error: lastError,
            attempts,
            totalDelay,
          }
        }

        // Don't delay after last attempt
        if (attempts <= finalConfig.maxRetries) {
          const delay = this.calculateDelay(attempts, finalConfig)
          totalDelay += delay
          await this.sleep(delay)
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalDelay,
    }
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1)
    delay = Math.min(delay, config.maxDelay)

    // Add jitter to avoid thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }

    return Math.round(delay)
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: Error): boolean {
    const nonRetryablePatterns = [
      'authentication',
      'authorization',
      'forbidden',
      'invalid',
      'malformed',
    ]

    const message = error.message.toLowerCase()
    // Only retry on specific non-retryable errors, but allow retry on "not found" in error messages
    // (could be temporary model availability issue)
    return nonRetryablePatterns.some(pattern => message.includes(pattern))
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton instance
export const retryHandler = new RetryHandler()
