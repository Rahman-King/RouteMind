import * as fs from "fs"
import * as path from "path"
import { fireworks } from "@ai-sdk/fireworks"
import { generateText } from "ai"
import { getBestModelForTier } from "../lib/models/registry"
import { economyEngine } from "../lib/economy/engine"

interface Task {
  task_id: string
  prompt: string
}

interface Result {
  task_id: string
  answer: string
}

async function main() {
  console.log("=== AMD HACKATHON TASK RUNNER STARTING ===")
  console.log("FIREWORKS_BASE_URL:", process.env.FIREWORKS_BASE_URL)
  console.log("ALLOWED_MODELS:", process.env.ALLOWED_MODELS)

  // 1. Resolve input path
  let inputPath = "/input/tasks.json"
  if (!fs.existsSync(inputPath)) {
    console.log(`Input file not found at ${inputPath}. Falling back to local practice-tasks.json...`)
    inputPath = path.join(__dirname, "../practice-tasks.json")
  }

  if (!fs.existsSync(inputPath)) {
    // If local practice tasks don't exist, create a dummy set for testing
    console.log("Local practice-tasks.json not found. Creating a dummy file...")
    const dummyTasks: Task[] = [
      { task_id: "practice-01", prompt: "What is the capital of Australia, and what body of water is it near?" },
      { task_id: "practice-02", prompt: "A store has 240 items. It sells 15% on Monday and 60 more on Tuesday. How many items remain?" },
      { task_id: "practice-03", prompt: "Classify the sentiment of this review: The battery life is great, but the screen scratches too easily." }
    ]
    fs.writeFileSync(inputPath, JSON.stringify(dummyTasks, null, 2))
  }

  // 2. Read tasks
  const rawData = fs.readFileSync(inputPath, "utf-8")
  const tasks: Task[] = JSON.parse(rawData)
  console.log(`Successfully loaded ${tasks.length} tasks.`)

  const results: Result[] = []

  // 3. Process each task
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    console.log(`\n[${i + 1}/${tasks.length}] Processing Task ID: ${task.task_id}`)
    console.log(`Prompt: "${task.prompt.slice(0, 80)}${task.prompt.length > 80 ? "..." : ""}"`)

    try {
      const prompt = task.prompt
      const lowerPrompt = prompt.toLowerCase()

      // Detect Task Category — ORDER MATTERS: more specific patterns first
      let category = "general"
      let promptSuffix = ""
      let maxTokens = 512
      // Force Tier 2 for quality; Tier 1 reserved only for trivially simple tasks
      let forceTier: 1 | 2 = 2

      if (/(summarise|summarize|summary|condense|in one sentence|in exactly one)/i.test(lowerPrompt)) {
        category = "summarization"
        // Check for specific format requirements
        if (/exactly two sentences/i.test(lowerPrompt)) {
          promptSuffix = "\n\nIMPORTANT: Your answer must be EXACTLY two sentences. No more, no less."
        } else if (/exactly three bullet points.*15 words/i.test(lowerPrompt)) {
          promptSuffix = "\n\nIMPORTANT: Your answer must be EXACTLY three bullet points. Each bullet point must be NO LONGER than 15 words. Format as: - point1\n- point2\n- point3"
        } else {
          promptSuffix = "\n\nAdhere to the requested format and length constraint EXACTLY."
        }
        maxTokens = 300
        forceTier = 2
      } else if (/(extract|named entities|entity|person|org|location|date)/i.test(lowerPrompt)) {
        category = "ner"
        promptSuffix = "\n\nExtract ALL named entities and label each as PERSON, ORGANIZATION, LOCATION, or DATE. Format as: Entity (LABEL). Do not miss any entities."
        maxTokens = 400
        forceTier = 2
      } else if (/(sentiment|classify the sentiment|positive|negative|neutral|review)/i.test(lowerPrompt)) {
        category = "sentiment"
        promptSuffix = "\n\nClassify the sentiment as Positive, Negative, or Neutral. Then provide a one-sentence reason. Format: [Sentiment] - [Reason]"
        maxTokens = 256
        forceTier = 2
      } else if (/(calculate|how many|remain|sells|store|percent|ratio|arithmetic|\d+\s*%)/i.test(lowerPrompt)) {
        category = "math"
        promptSuffix = "\n\nWork through this step-by-step and state the final numerical answer clearly."
        maxTokens = 512
        forceTier = 2
      } else if (/(write a|function that|python function|return the|implement)/i.test(lowerPrompt)) {
        category = "codegen"
        promptSuffix = "\n\nProvide a clean, correct Python function implementation."
        maxTokens = 1024
        forceTier = 2
      } else if (/(bug|has a bug|find and fix|return.*max|return.*min)/i.test(lowerPrompt)) {
        category = "debug"
        promptSuffix = "\n\nIdentify the bug and provide the corrected implementation."
        maxTokens = 512
        forceTier = 2
      } else if (/(puzzle|logic|deduce|clue|friends|who owns|who has|constraint)/i.test(lowerPrompt)) {
        category = "reasoning"
        promptSuffix = "\n\nReason through this step-by-step using the given constraints and state the final answer."
        maxTokens = 512
        forceTier = 2
      } else if (/(capital of|what is the|explain|define|describe)/i.test(lowerPrompt)) {
        category = "factual"
        promptSuffix = ""
        maxTokens = 300
        forceTier = 2
      }

      // Use original prompt without compression to ensure accuracy
      const finalPrompt = prompt + promptSuffix

      console.log(`- Category detected: ${category} | Force Tier: ${forceTier}`)
      console.log(`- Prompt length: ${finalPrompt.length} chars`)

      // Use deterministic routing (no LLM router call needed — saves tokens!)
      const modelConfig = getBestModelForTier(forceTier)
      console.log(`  Selected Model: ${modelConfig.label} (ID: ${modelConfig.id})`)

      // Run inference
      const systemPrompt = `You are a highly capable AI assistant. Answer accurately and concisely. Always respond in English.`
      
      const resultObj = await generateText({
        model: fireworks(modelConfig.id),
        system: systemPrompt,
        prompt: finalPrompt,
        temperature: category === "codegen" ? 0.1 : 0.2,
        maxTokens: maxTokens
      })

      const answer = resultObj.text.trim()
      console.log(`- Completed. Answer preview: "${answer.slice(0, 100)}${answer.length > 100 ? "..." : ""}"`)

      results.push({
        task_id: task.task_id,
        answer: answer
      })
    } catch (error: any) {
      console.error(`- Failed to process task ${task.task_id}:`, error)
      // Fallback response to avoid crash and secure partial credit
      results.push({
        task_id: task.task_id,
        answer: `An error occurred while processing this prompt. Details: ${error?.message ?? error}`
      })
    }
  }

  // 4. Resolve output path
  let outputPath = "/output/results.json"
  try {
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
    console.log(`\n=== SUCCESS: Results written to ${outputPath} ===`)
  } catch (err) {
    outputPath = path.join(__dirname, "../results.json")
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
    console.log(`\n=== SUCCESS: Results written locally to ${outputPath} ===`)
  }
  process.exit(0)
}

main().catch(err => {
  console.error("Fatal Runner Error:", err)
  process.exit(1)
})
