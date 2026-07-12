/**
 * Tier 0 Prompt Normalization & Fingerprinting
 * Normalizes prompts for consistent caching and duplicate detection
 */

class PromptNormalizer {
  /**
   * Normalize prompt for consistent processing
   */
  normalize(prompt: string): string {
    return prompt
      .trim()
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters that don't affect meaning
      .replace(/[\u2000-\u200F\uFEFF]/g, '')
      // Normalize quotes
      .replace(/[""''`]/g, '"')
      // Normalize dashes
      .replace(/[-–—]/g, '-')
      // Remove multiple punctuation
      .replace(/([.!?])\1+/g, '$1')
  }

  /**
   * BPE Shrinking (Token Compression Heuristics)
   * Safely strips common English articles and punctuation from non-code strings
   */
  bpeShrink(text: string): string {
    // Basic detection of code blocks (preserve them)
    if (text.includes('```') || text.includes('function') || text.includes('const ')) {
      return text;
    }
    return text
      // Remove common articles when they don't add semantic value to a router
      .replace(/\b(a|an|the|of)\b/gi, '')
      // Remove excessive punctuation that models ignore anyway
      .replace(/[;,]/g, ' ')
      // Clean up whitespace again
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Prompt Canonicalization
   * Alphabetically sorts lists and parameters inside the query to increase cache hit rates
   * Example: "Convert [z, a] to string" -> "Convert [a, z] to string"
   */
  canonicalize(prompt: string): string {
    let canonical = prompt;
    // Match arrays like [foo, bar, baz]
    const arrayRegex = /\[(.*?)\]/g;
    canonical = canonical.replace(arrayRegex, (match, contents) => {
      // Don't mess with complex structures
      if (contents.includes('{') || contents.includes('[')) return match;
      const sorted = contents.split(',').map((s: string) => s.trim()).sort().join(', ');
      return `[${sorted}]`;
    });

    // Match generic comma-separated lists if they are explicitly delineated, but array regex is safest.
    return canonical;
  }

  /**
   * Create fingerprint for duplicate detection
   */
  fingerprint(prompt: string): string {
    const normalized = this.normalize(prompt.toLowerCase())
    // Remove common stop words for semantic fingerprinting
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
      'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this',
      'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose',
      'where', 'when', 'why', 'how', 'there', 'here', 'please', 'thanks'
    ])
    
    const words = normalized.split(' ').filter(word => !stopWords.has(word))
    return words.join(' ')
  }

  /**
   * Detect duplicates using fingerprinting
   */
  isDuplicate(prompt1: string, prompt2: string, threshold: number = 0.9): boolean {
    const fp1 = this.fingerprint(prompt1)
    const fp2 = this.fingerprint(prompt2)
    
    if (fp1 === fp2) return true
    
    // Calculate similarity
    const similarity = this.calculateSimilarity(fp1, fp2)
    return similarity >= threshold
  }

  /**
   * Calculate similarity between two fingerprints
   */
  private calculateSimilarity(fp1: string, fp2: string): number {
    const words1 = fp1.split(' ')
    const words2 = fp2.split(' ')
    
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    return intersection.size / union.size
  }

  /**
   * Extract key terms for semantic analysis
   */
  extractKeyTerms(prompt: string): string[] {
    const normalized = this.normalize(prompt.toLowerCase())
    const words = normalized.split(' ')
    
    // Filter out short words and common patterns
    return words.filter(word => 
      word.length > 2 && 
      !/^\d+$/.test(word) &&
      !/^[.,!?;:]+$/.test(word)
    )
  }

  /**
   * Detect prompt category
   */
  detectCategory(prompt: string): string {
    const normalized = this.normalize(prompt.toLowerCase())
    
    const categories = {
      coding: /\b(code|function|class|variable|debug|refactor|api|endpoint|database|sql|query|algorithm|data structure)\b/i,
      math: /\b(calculate|compute|solve|equation|formula|math|arithmetic|percentage|fraction|decimal)\b/i,
      writing: /\b(write|essay|article|blog|story|poem|content|draft|edit|proofread)\b/i,
      analysis: /\b(analyze|analyze|compare|contrast|evaluate|assess|review|critique|examine)\b/i,
      explanation: /\b(explain|what is|how does|why does|describe|define|clarify)\b/i,
      translation: /\b(translate|convert|language|english|spanish|french|german)\b/i,
      debugging: /\b(bug|error|issue|problem|fix|patch|debug|troubleshoot)\b/i,
      creative: /\b(create|generate|design|imagine|brainstorm|idea|concept)\b/i,
    }
    
    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(normalized)) {
        return category
      }
    }
    
    return 'general'
  }
}

class DuplicateDetector {
  private recentPrompts = new Map<string, number>()
  private maxRecent = 1000
  private duplicateWindow = 5000 // 5 seconds (reduced from 1 minute to reduce false positives)

  /**
   * Check if prompt is a recent duplicate
   */
  isRecentDuplicate(prompt: string): boolean {
    const fingerprint = this.createExactFingerprint(prompt) // Use exact fingerprint instead of semantic
    const timestamp = this.recentPrompts.get(fingerprint)
    
    if (!timestamp) return false
    
    const age = Date.now() - timestamp
    return age < this.duplicateWindow
  }

  /**
   * Record prompt for duplicate detection
   */
  recordPrompt(prompt: string): void {
    const fingerprint = this.createExactFingerprint(prompt)
    this.recentPrompts.set(fingerprint, Date.now())
    this.evictIfNeeded()
  }

  /**
   * Create exact fingerprint for duplicate detection (not semantic)
   */
  private createExactFingerprint(prompt: string): string {
    // Use exact normalized prompt instead of semantic fingerprint
    const normalizer = new PromptNormalizer()
    return normalizer.normalize(prompt)
  }

  /**
   * Evict old entries
   */
  private evictIfNeeded(): void {
    if (this.recentPrompts.size > this.maxRecent) {
      const now = Date.now()
      for (const [fingerprint, timestamp] of this.recentPrompts.entries()) {
        if (now - timestamp > this.duplicateWindow) {
          this.recentPrompts.delete(fingerprint)
        }
      }
    }
  }

  /**
   * Clear old entries
   */
  clear(): void {
    this.recentPrompts.clear()
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      size: this.recentPrompts.size,
      maxRecent: this.maxRecent,
      duplicateWindow: this.duplicateWindow,
    }
  }
}

// Singleton instances
export const promptNormalizer = new PromptNormalizer()
export const duplicateDetector = new DuplicateDetector()
