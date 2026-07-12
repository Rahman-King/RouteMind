/**
 * Circuit Breaker
 * Prevents cascading failures by stopping requests to failing services
 */

export interface CircuitBreakerConfig {
  failureThreshold: number
  successThreshold: number
  timeout: number
  resetTimeout: number
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerState {
  state: CircuitState
  failures: number
  successes: number
  lastFailureTime?: number
}

class CircuitBreaker {
  private state = CircuitState.CLOSED
  private failures = 0
  private successes = 0
  private lastFailureTime?: number
  private config: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    resetTimeout: 60000,
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, config?: Partial<CircuitBreakerConfig>): Promise<T> {
    const finalConfig = { ...this.config, ...config }
    this.config = finalConfig

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN
      } else {
        throw new Error('Circuit breaker is OPEN - requests blocked')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED
        this.successes = 0
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    this.successes = 0

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false
    return Date.now() - this.lastFailureTime > this.config.resetTimeout
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED
    this.failures = 0
    this.successes = 0
    this.lastFailureTime = undefined
  }

  /**
   * Force open the circuit
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN
    this.lastFailureTime = Date.now()
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreaker()
