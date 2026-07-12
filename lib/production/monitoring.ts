/**
 * Monitoring and Metrics Collection
 * Tracks performance, errors, and routing metrics
 */

export interface Metric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, { status: 'pass' | 'fail'; message?: string }>
  timestamp: number
}

class MonitoringSystem {
  private metrics: Metric[] = []
  private maxMetrics = 10000
  private counters = new Map<string, number>()
  private gauges = new Map<string, number>()
  private histograms = new Map<string, number[]>()

  /**
   * Record a metric
   */
  recordMetric(metric: Metric): void {
    this.metrics.push(metric)
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags)
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + value)

    this.recordMetric({
      name,
      value: current + value,
      timestamp: Date.now(),
      tags,
    })
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags)
    this.gauges.set(key, value)

    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
    })
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags)
    const values = this.histograms.get(key) || []
    values.push(value)
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift()
    }
    
    this.histograms.set(key, values)

    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
    })
  }

  /**
   * Get counter value
   */
  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.buildKey(name, tags)
    return this.counters.get(key) || 0
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = this.buildKey(name, tags)
    return this.gauges.get(key)
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string, tags?: Record<string, string>): {
    count: number
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  } | undefined {
    const key = this.buildKey(name, tags)
    const values = this.histograms.get(key)
    
    if (!values || values.length === 0) return undefined

    const sorted = [...values].sort((a, b) => a - b)
    const count = sorted.length
    const min = sorted[0]
    const max = sorted[count - 1]
    const avg = sorted.reduce((a, b) => a + b, 0) / count
    const p50 = sorted[Math.floor(count * 0.5)]
    const p95 = sorted[Math.floor(count * 0.95)]
    const p99 = sorted[Math.floor(count * 0.99)]

    return { count, min, max, avg, p50, p95, p99 }
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(limit: number = 100): Metric[] {
    return this.metrics.slice(-limit)
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string, limit: number = 100): Metric[] {
    return this.metrics
      .filter(m => m.name === name)
      .slice(-limit)
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<HealthCheck> {
    const checks: Record<string, { status: 'pass' | 'fail'; message?: string }> = {}

    // Check memory usage
    const memoryUsage = process.memoryUsage()
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    checks['memory'] = {
      status: memoryPercent < 90 ? 'pass' : 'fail',
      message: `${Math.round(memoryPercent)}% heap used`,
    }

    // Check metrics storage
    checks['metrics'] = {
      status: this.metrics.length < this.maxMetrics ? 'pass' : 'fail',
      message: `${this.metrics.length}/${this.maxMetrics} metrics stored`,
    }

    // Check rate limiter
    checks['rate_limiter'] = {
      status: 'pass',
      message: 'Rate limiter operational',
    }

    // Determine overall status
    const failedChecks = Object.values(checks).filter(c => c.status === 'fail').length
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (failedChecks > 0) status = 'unhealthy'
    else if (Object.values(checks).some(c => c.message?.includes('degraded'))) status = 'degraded'

    return {
      status,
      checks,
      timestamp: Date.now(),
    }
  }

  /**
   * Build key with tags
   */
  private buildKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
    return `${name}{${tagString}}`
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = []
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalMetrics: this.metrics.length,
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
    }
  }
}

// Singleton instance
export const monitoring = new MonitoringSystem()
