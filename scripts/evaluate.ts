#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

interface Task {
  task_id: string
  prompt: string
}

interface Result {
  task_id: string
  answer: string
}

// Read environment variables
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY
const FIREWORKS_BASE_URL = process.env.FIREWORKS_BASE_URL
const ALLOWED_MODELS = process.env.ALLOWED_MODELS?.split(',') || []

if (!FIREWORKS_API_KEY) {
  console.error('FIREWORKS_API_KEY environment variable is required')
  process.exit(1)
}

if (!FIREWORKS_BASE_URL) {
  console.error('FIREWORKS_BASE_URL environment variable is required')
  process.exit(1)
}

if (ALLOWED_MODELS.length === 0) {
  console.error('ALLOWED_MODELS environment variable is required')
  process.exit(1)
}

console.log('Configuration:')
console.log(`  FIREWORKS_BASE_URL: ${FIREWORKS_BASE_URL}`)
console.log(`  ALLOWED_MODELS: ${ALLOWED_MODELS.join(', ')}`)

// Read tasks from input file
// Use local paths for development, Docker paths for production
const INPUT_PATH = process.env.INPUT_PATH || '/input/tasks.json'
const OUTPUT_PATH = process.env.OUTPUT_PATH || '/output/results.json'

if (!fs.existsSync(INPUT_PATH)) {
  console.error(`Input file not found: ${INPUT_PATH}`)
  console.error('For local testing, set INPUT_PATH environment variable')
  process.exit(1)
}

let tasks: Task[]
try {
  const tasksContent = fs.readFileSync(INPUT_PATH, 'utf-8')
  tasks = JSON.parse(tasksContent)
  console.log(`Loaded ${tasks.length} tasks from ${INPUT_PATH}`)
} catch (error) {
  console.error(`Failed to parse tasks.json: ${error}`)
  process.exit(1)
}

// Ensure output directory exists
const OUTPUT_DIR = path.dirname(OUTPUT_PATH)
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// Process each task
async function processTask(task: Task): Promise<Result> {
  console.log(`Processing task: ${task.task_id}`)
  
  // Determine task category
  const category = categorizeTask(task.prompt)
  console.log(`  Category: ${category}`)
  
  // Check if we can use local inference (free)
  if (shouldUseLocalInference(category, task.prompt)) {
    console.log(`  Using local inference (free)`)
    const answer = localInference(category, task.prompt)
    return {
      task_id: task.task_id,
      answer
    }
  }
  
  // Otherwise, use Fireworks API (paid)
  const model = selectModel(category, ALLOWED_MODELS)
  console.log(`  Using API with model: ${model}`)
  
  const answer = await callFireworksAPI(task.prompt, model, category)
  
  return {
    task_id: task.task_id,
    answer
  }
}

function categorizeTask(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase()
  
  // Regex-based pre-routing for code tasks (highest priority)
  const codePatterns = /\b(def |class |function |return |import |from |const |let |var |if \(|for \(|while \()/i
  if (codePatterns.test(prompt)) {
    return lowerPrompt.includes('bug') || lowerPrompt.includes('debug') || lowerPrompt.includes('fix') 
      ? 'code-debugging' 
      : 'code-generation'
  }
  
  // Keyword-based pre-routing for math tasks
  const mathKeywords = ['calculate', 'percent', 'percentage', 'solve', 'equation', 'math', 'multiply', 'divide', 'add', 'subtract']
  if (mathKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    return 'mathematical-reasoning'
  }
  
  // Standard categorization for other tasks
  if (lowerPrompt.includes('summarize') || lowerPrompt.includes('summarise')) {
    return 'text-summarisation'
  }
  if (lowerPrompt.includes('sentiment') || lowerPrompt.includes('classify')) {
    return 'sentiment-classification'
  }
  if (lowerPrompt.includes('entity') || lowerPrompt.includes('extract')) {
    return 'named-entity-recognition'
  }
  if (lowerPrompt.includes('debug') || lowerPrompt.includes('bug') || lowerPrompt.includes('fix')) {
    return 'code-debugging'
  }
  if (lowerPrompt.includes('write') || lowerPrompt.includes('function') || lowerPrompt.includes('implement')) {
    return 'code-generation'
  }
  if (lowerPrompt.includes('if') || lowerPrompt.includes('who') || lowerPrompt.includes('which') || lowerPrompt.includes('owns')) {
    return 'logical-deductive-reasoning'
  }
  
  return 'factual-knowledge'
}

function selectModel(category: string, allowedModels: string[]): string {
  // Use the smallest model from ALLOWED_MODELS for efficiency
  // Sort by model name length as a heuristic (smaller names often = smaller models)
  // In production, you'd sort by parameter count
  const sortedModels = [...allowedModels].sort((a, b) => a.length - b.length)
  return sortedModels[0]
}

function shouldUseLocalInference(category: string, prompt: string): boolean {
  // Rule-based local inference for tasks that can be handled without API
  // This avoids API calls (zero token cost) for simple tasks
  
  if (category === 'sentiment-classification') {
    // Always use local inference for sentiment (keyword-based)
    return true
  }
  
  if (category === 'named-entity-recognition') {
    // Use local inference for simple NER with clear entity patterns
    const lowerPrompt = prompt.toLowerCase()
    // Check for common entity patterns
    const hasPerson = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(prompt)
    const hasOrg = /\b[A-Z][a-z]+ (AI|Inc|Corp|LLC|Ltd|Company)\b/.test(prompt)
    const hasLocation = /\b[A-Z][a-z]+ (City|Berlin|London|Paris|NYC|LA)\b/.test(prompt)
    const hasDate = /\b(January|February|March|April|May|June|July|August|September|October|November|December|last|this|next)\b/i.test(lowerPrompt)
    
    // If we have clear entity patterns, use local inference
    return hasPerson || hasOrg || hasLocation || hasDate
  }
  
  if (category === 'text-summarisation') {
    // Use local inference for very short texts (< 100 words)
    const wordCount = prompt.split(/\s+/).length
    return wordCount < 100
  }
  
  // For other categories, use API
  return false
}

function localInference(category: string, prompt: string): string {
  // Simple rule-based inference for tasks that don't need API
  if (category === 'sentiment-classification') {
    const lowerPrompt = prompt.toLowerCase()
    const positiveWords = ['great', 'good', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'awesome', 'perfect']
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'horrible', 'disappointing', 'sucks']
    
    const positiveCount = positiveWords.filter(word => lowerPrompt.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerPrompt.includes(word)).length
    
    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }
  
  if (category === 'named-entity-recognition') {
    // Simple regex-based NER
    const entities: {text: string, type: string}[] = []
    
    // Extract persons (Name Name pattern)
    const personMatches = prompt.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g)
    if (personMatches) {
      personMatches.forEach(match => {
        if (!entities.find(e => e.text === match)) {
          entities.push({text: match, type: 'PERSON'})
        }
      })
    }
    
    // Extract organizations
    const orgMatches = prompt.match(/\b[A-Z][a-z]+ (?:AI|Inc|Corp|LLC|Ltd|Company|Technologies|Systems)\b/g)
    if (orgMatches) {
      orgMatches.forEach(match => {
        if (!entities.find(e => e.text === match)) {
          entities.push({text: match, type: 'ORGANIZATION'})
        }
      })
    }
    
    // Extract locations
    const locationMatches = prompt.match(/\b(?:Berlin|London|Paris|NYC|LA|New York|San Francisco|Tokyo|Singapore)\b/g)
    if (locationMatches) {
      locationMatches.forEach(match => {
        if (!entities.find(e => e.text === match)) {
          entities.push({text: match, type: 'LOCATION'})
        }
      })
    }
    
    // Extract dates
    const dateMatches = prompt.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|last|this|next) (?:\d+)?\b/gi)
    if (dateMatches) {
      dateMatches.forEach(match => {
        if (!entities.find(e => e.text === match)) {
          entities.push({text: match, type: 'DATE'})
        }
      })
    }
    
    return JSON.stringify(entities)
  }
  
  if (category === 'text-summarisation') {
    // Simple extractive summarization for short texts
    // Extract the actual text to summarize (remove instruction part)
    const textMatch = prompt.match(/(?:summarize|summarise|following|text)[:\s]+(.+)/i)
    const textToSummarize = textMatch ? textMatch[1].trim() : prompt
    
    const sentences = textToSummarize.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length === 0) return textToSummarize
    if (sentences.length === 1) return sentences[0].trim()
    // Return first sentence as summary for short texts
    return sentences[0].trim() + '.'
  }
  
  return 'Local inference not implemented for this category'
}

function getSystemPrompt(category: string): string {
  // Direct prompts - get straight to the answer without verbose analysis
  const prompts: Record<string, string> = {
    'factual-knowledge': 'Answer the question directly and completely.',
    'mathematical-reasoning': 'Calculate the answer. Show your work briefly, then give the final number.',
    'sentiment-classification': 'Classify as positive, negative, or neutral with brief explanation.',
    'text-summarisation': 'Provide one clear, complete summary sentence.',
    'named-entity-recognition': 'Extract all entities as JSON with types.',
    'code-debugging': 'State the bug clearly, then provide the fixed code.',
    'logical-deductive-reasoning': 'Solve the puzzle step by step, then state the final answer clearly.',
    'code-generation': 'Write the complete, correct function.'
  }
  return prompts[category] || 'Answer the question directly and completely.'
}

function getMaxTokens(category: string): number {
  // High token limits to ensure complete outputs without any cutoff
  const tokens: Record<string, number> = {
    'factual-knowledge': 300,
    'mathematical-reasoning': 350,
    'sentiment-classification': 100,
    'text-summarisation': 200,
    'named-entity-recognition': 400,
    'code-debugging': 500,
    'logical-deductive-reasoning': 350,
    'code-generation': 600
  }
  return tokens[category] || 300
}

async function callFireworksAPI(prompt: string, model: string, category: string): Promise<string> {
  const response = await fetch(`${FIREWORKS_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIREWORKS_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(category)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: getMaxTokens(category),
      temperature: 0.3, // Balanced temperature for quality and consistency
      top_p: 0.9, // Higher top_p for more natural, complete outputs
      frequency_penalty: 0, // No penalty for repetition
      presence_penalty: 0 // No penalty for new topics
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`API Error Details: ${errorText}`)
    throw new Error(`API call failed: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.choices[0].message.content
}

// Process all tasks
async function main() {
  const results: Result[] = []
  
  for (const task of tasks) {
    try {
      const result = await processTask(task)
      results.push(result)
    } catch (error) {
      console.error(`Failed to process task ${task.task_id}: ${error}`)
      // Still include a result even if it failed
      results.push({
        task_id: task.task_id,
        answer: `Error: ${error}`
      })
    }
  }
  
  // Write results to output file
  try {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))
    console.log(`Results written to ${OUTPUT_PATH}`)
  } catch (error) {
    console.error(`Failed to write results: ${error}`)
    process.exit(1)
  }
  
  console.log('Evaluation complete')
  process.exit(0)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
