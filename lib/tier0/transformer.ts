/**
 * Lightweight local summarization (zero dependencies, zero API cost).
 *
 * Previously this module used `@xenova/transformers` (Flan-T5 via ONNX/WASM),
 * which pulled in `sharp` and a chain of vulnerable transitive dependencies
 * (protobufjs / onnx-proto / onnxruntime-web) and could crash the server when
 * its native binaries were unavailable. It has been replaced with a fast
 * extractive summarizer that runs purely in JS on the server's CPU.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by',
  'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
  'on', 'off', 'over', 'under', 'again', 'further', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'of', 'this',
  'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they',
  'them', 'his', 'her', 'their', 'my', 'your', 'our', 'so', 'than', 'too', 'very',
  'can', 'will', 'just', 'not', 'no', 'as', 'me', 'am',
]);

/** Split text into sentences, keeping only meaningful ones. */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

/** Build a word-frequency map, ignoring stop words. */
function wordFrequencies(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  const words = text.toLowerCase().match(/\b[a-z0-9']+\b/g) ?? [];
  for (const w of words) {
    if (w.length < 3 || STOP_WORDS.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return freq;
}

/**
 * Perform extractive summarization locally.
 * Scores each sentence by the frequency of its (non-stop) words and returns the
 * top sentences in their original order, trimmed to roughly `maxLength` words.
 * Costs zero API credits and happens purely on the server's CPU.
 */
export async function summarizeLocally(text: string, maxLength: number = 200): Promise<string> {
  try {
    const cleaned = text.trim();
    if (cleaned.length === 0) return '';

    const sentences = splitSentences(cleaned);
    // Short enough already — nothing to compress.
    if (sentences.length <= 2) return cleaned;

    const freq = wordFrequencies(cleaned);

    // Score sentences by average word importance (length-normalized so long
    // sentences don't automatically win).
    const scored = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().match(/\b[a-z0-9']+\b/g) ?? [];
      let score = 0;
      let counted = 0;
      for (const w of words) {
        if (w.length < 3 || STOP_WORDS.has(w)) continue;
        score += freq.get(w) ?? 0;
        counted++;
      }
      return { sentence, index, score: counted > 0 ? score / counted : 0 };
    });

    // Pick sentences by score until we reach the target word budget.
    const budget = Math.max(1, Math.round(maxLength * 0.75));
    const ranked = [...scored].sort((a, b) => b.score - a.score);

    const chosen: typeof scored = [];
    let wordCount = 0;
    for (const s of ranked) {
      const len = s.sentence.split(/\s+/).length;
      if (wordCount + len > budget && chosen.length > 0) continue;
      chosen.push(s);
      wordCount += len;
      if (wordCount >= budget) break;
    }

    // Restore original reading order.
    chosen.sort((a, b) => a.index - b.index);
    const summary = chosen.map((s) => s.sentence).join(' ').trim();

    return summary.length > 0 ? summary : cleaned;
  } catch (error) {
    console.error('Local summarization failed:', error);
    return text;
  }
}
