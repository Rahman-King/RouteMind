/**
 * Tier 0 Rule Engine
 * Implements deterministic processing without LLM inference
 * Handles arithmetic, validation, and utility functions
 */

class RuleEngine {
  /**
   * Arithmetic operations with BODMAS/PEMDAS support
   */
  evaluateArithmetic(expression: string): number | null {
    try {
      // Safe evaluation of mathematical expressions
      const sanitized = expression.replace(/[^0-9+\-*/().%]/g, '')
      if (sanitized !== expression) {
        return null // Contains invalid characters
      }
      
      // Use Function constructor for safe evaluation
      const result = new Function(`return ${sanitized}`)()
      return typeof result === 'number' && !isNaN(result) ? result : null
    } catch {
      return null
    }
  }

  /**
   * Unit conversion
   */
  convertUnits(value: number, from: string, to: string): number | null {
    const conversions: Record<string, Record<string, number>> = {
      length: {
        m: 1,
        km: 0.001,
        cm: 100,
        mm: 1000,
        ft: 3.28084,
        in: 39.3701,
        mi: 0.000621371,
      },
      weight: {
        kg: 1,
        g: 1000,
        mg: 1000000,
        lb: 2.20462,
        oz: 35.274,
      },
      temperature: {
        celsius: 1,
        fahrenheit: 1,
        kelvin: 1,
      },
    }

    // Handle temperature conversion separately
    if (from === 'celsius' && to === 'fahrenheit') {
      return (value * 9/5) + 32
    }
    if (from === 'fahrenheit' && to === 'celsius') {
      return (value - 32) * 5/9
    }
    if (from === 'celsius' && to === 'kelvin') {
      return value + 273.15
    }
    if (from === 'kelvin' && to === 'celsius') {
      return value - 273.15
    }

    // Standard unit conversion
    for (const category of Object.values(conversions)) {
      if (from in category && to in category) {
        const baseValue = value / category[from]
        return baseValue * category[to]
      }
    }

    return null
  }

  /**
   * Date calculations
   */
  calculateDate(operation: string, date: Date, value: number): Date | null {
    const result = new Date(date)
    
    switch (operation) {
      case 'add_days':
        result.setDate(result.getDate() + value)
        break
      case 'subtract_days':
        result.setDate(result.getDate() - value)
        break
      case 'add_months':
        result.setMonth(result.getMonth() + value)
        break
      case 'subtract_months':
        result.setMonth(result.getMonth() - value)
        break
      case 'add_years':
        result.setFullYear(result.getFullYear() + value)
        break
      case 'subtract_years':
        result.setFullYear(result.getFullYear() - value)
        break
      default:
        return null
    }
    
    return result
  }

  /**
   * JSON validation
   */
  validateJSON(jsonString: string): { valid: boolean; error?: string; parsed?: any } {
    try {
      const parsed = JSON.parse(jsonString)
      return { valid: true, parsed }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid JSON',
      }
    }
  }

  /**
   * Markdown utilities
   */
  stripMarkdown(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/>\s/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim()
  }

  /**
   * Regex utilities
   */
  testRegex(pattern: string, text: string): boolean {
    try {
      const regex = new RegExp(pattern, 'gi')
      return regex.test(text)
    } catch {
      return false
    }
  }

  extractRegex(pattern: string, text: string): string[] {
    try {
      const regex = new RegExp(pattern, 'gi')
      const matches = text.match(regex)
      return matches || []
    } catch {
      return []
    }
  }

  /**
   * Email validation
   */
  isValidEmail(email: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(email)
  }

  /**
   * URL validation
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Phone number validation (basic)
   */
  isValidPhone(phone: string): boolean {
    const pattern = /^\+?[\d\s-()]{10,}$/
    return pattern.test(phone)
  }

  /**
   * String operations
   */
  countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
  }

  countCharacters(text: string, includeSpaces: boolean = true): number {
    return includeSpaces ? text.length : text.replace(/\s/g, '').length
  }

  truncateText(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - suffix.length) + suffix
  }

  /**
   * Number utilities
   */
  formatNumber(num: number, decimals: number = 2): string {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  roundTo(num: number, decimals: number): number {
    const factor = Math.pow(10, decimals)
    return Math.round(num * factor) / factor
  }

  /**
   * Array utilities
   */
  sum(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0)
  }

  average(numbers: number[]): number {
    return numbers.length > 0 ? this.sum(numbers) / numbers.length : 0
  }

  median(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
  }

  /**
   * Check if a request can be handled by rule engine
   */
  // Determine if a prompt can be handled by Tier 0
  canHandle(prompt: string): { canHandle: boolean; result?: any; rule?: string } {
    const lowerPrompt = prompt.toLowerCase();

    // ---------- Greetings (Tier 0) ----------
    const greetings = [
      'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
      'how are you', 'how are you doing', "what's up", 'sup', 'greetings',
      'hola', 'bonjour', 'namaste', 'salaam', 'konnichiwa'
    ];
    if (greetings.some(greeting => lowerPrompt.includes(greeting) || lowerPrompt === greeting)) {
      const responses = [
        'Hello! How can I help you today?',
        'Hi there! What can I do for you?',
        "Hey! I'm here to assist you.",
        'Good to see you! How can I help?',
        "Hello! I'm RouteMind, your AI assistant. What would you like to know?"
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      return { canHandle: true, result: randomResponse, rule: 'greeting' };
    }

    // ---------- Arithmetic (Tier 1) ----------
    // Tier 0 does NOT handle arithmetic; let it fall through to Tier 1 (Minimax M3) for all calculations.
    // Returning false signals the router to use the higher tier.
    return { canHandle: false };
  }
}

// Singleton instance
export const ruleEngine = new RuleEngine()
