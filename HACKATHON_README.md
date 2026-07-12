# RouteMind - AMD Developer Hackathon Submission

## Track 1: General-Purpose AI Agent

This submission implements an intelligent AI agent that routes tasks to appropriate Fireworks AI models based on task categorization, optimizing for both accuracy and token efficiency.

## Architecture

### Task Categorization
The agent categorizes incoming tasks into 8 categories:
1. Factual knowledge
2. Mathematical reasoning
3. Sentiment classification
4. Text summarisation
5. Named entity recognition
6. Code debugging
7. Logical/deductive reasoning
8. Code generation

### Token Optimization (Maximum Efficiency)
- **Hierarchical routing (Tier 0 vs API)**: Local inference for simple tasks (free), API for complex (paid)
  - **Tier 0 (Local - Rule-based)**: Zero token cost
    - Sentiment classification: Keyword-based analysis (always local)
    - Named entity recognition: Regex-based extraction for clear patterns
    - Text summarisation: Extractive summarization for short texts (<100 words)
  - **API Tiers**: Fireworks API with smallest available model
    - Factual knowledge, mathematical reasoning, code tasks, logical puzzles
- **Pre-routing optimization**: Regex and keyword-based routing before model selection
  - Code tasks: Regex patterns (`def `, `class `, `function `, etc.) for immediate code routing
  - Math tasks: Keyword detection (`calculate`, `percent`, `solve`, etc.)
- **Ultra-minimal system prompts**: Category-specific, no conversational filler
  - Factual knowledge: "Answer directly. No intro."
  - Mathematical reasoning: "Number only."
  - Sentiment classification: "One word: positive/negative/neutral"
  - Text summarisation: "One sentence only."
  - Named entity recognition: "JSON array only."
  - Code debugging: "Code only."
  - Logical/deductive reasoning: "Name only."
  - Code generation: "Code only."
- **Aggressive max_tokens**: Category-specific limits (30-200 tokens)
  - Sentiment classification: 30 tokens
  - Factual knowledge: 50 tokens
  - Text summarisation: 50 tokens
  - Mathematical reasoning: 80 tokens
  - Logical/deductive reasoning: 80 tokens
  - Named entity recognition: 100 tokens
  - Code debugging: 150 tokens
  - Code generation: 200 tokens
- **Zero temperature**: 0.0 for deterministic, concise output
- **Low top_p**: 0.1 for focused output
- **Smallest model selection**: Sorts ALLOWED_MODELS by name length (heuristic for parameter count)

## Environment Variables

The harness injects these at runtime:
- `FIREWORKS_API_KEY`: Provided by harness
- `FIREWORKS_BASE_URL`: Base URL for all Fireworks API calls
- `ALLOWED_MODELS`: Comma-separated list of permitted model IDs

## Local Testing

### Prerequisites
- Docker installed
- Fireworks API key

### Test with Practice Tasks

1. Create `.env` file:
```bash
FIREWORKS_API_KEY=your_api_key_here
FIREWORKS_BASE_URL=https://api.fireworks.ai
ALLOWED_MODELS=accounts/fireworks/models/gpt-oss-120b,accounts/fireworks/models/glm-5p1,accounts/fireworks/models/kimi-k2p6
```

2. Run evaluation:
```bash
# Build the image
./build.sh routemind-hackathon latest

# Run with practice tasks
docker run --rm \
  -v $(pwd)/input:/input \
  -v $(pwd)/output:/output \
  --env-file .env \
  routemind-hackathon:latest
```

3. Check results:
```bash
cat output/results.json
```

## Building for Submission

### Build for linux/amd64
```bash
./build.sh routemind-hackathon latest your-registry.com
```

### Manual build (if build.sh fails)
```bash
docker buildx build \
  --platform linux/amd64 \
  -t routemind-hackathon:latest \
  .
```

### Push to registry
```bash
docker push your-registry.com/routemind-hackathon:latest
```

## Compliance Checklist

- ✅ Reads FIREWORKS_API_KEY from environment
- ✅ Reads FIREWORKS_BASE_URL from environment
- ✅ Reads ALLOWED_MODELS from environment
- ✅ All API calls go through FIREWORKS_BASE_URL
- ✅ Reads tasks from /input/tasks.json
- ✅ Writes results to /output/results.json
- ✅ Exits with code 0 on success
- ✅ Exits with non-zero on failure
- ✅ linux/amd64 platform build
- ✅ No hardcoded model IDs
- ✅ No hardcoded answers
- ✅ Token efficiency optimizations
- ✅ Handles all 8 capability categories

## Token Efficiency Strategy

1. **Hierarchical Routing**: Tier 0 (local rule-based) for simple tasks, API for complex
2. **Pre-routing**: Regex/keyword-based routing before model selection to avoid unnecessary API calls
3. **System Prompts**: Ultra-minimal, category-specific with no conversational filler
4. **Max Tokens**: Aggressive category-specific limits (30-200 tokens)
5. **Temperature**: 0.0 for maximum determinism and conciseness
6. **Top_p**: 0.1 for focused output
7. **Model Selection**: Smallest model from ALLOWED_MODELS (sorted by name length heuristic)

## Tier 0: Local Inference (Rule-Based)

**Current Implementation:**
- **Sentiment Classification**: Keyword-based analysis (positive/negative word counting)
- **Named Entity Recognition**: Regex-based extraction for PERSON, ORGANIZATION, LOCATION, DATE
- **Text Summarization**: Extractive summarization for texts <100 words

**Benefits:**
- Zero API cost (free tokens)
- Instant response time
- No memory overhead (pure JavaScript/TypeScript)
- Fits within 4GB RAM constraint easily

**Limitations:**
- Pattern-based (not semantic understanding)
- Limited to clear, structured inputs
- May need API fallback for complex cases

**Current API Reduction:**
- Practice tasks: 3/8 use local inference (37.5% reduction)
- Categories with local support: sentiment, NER, short summarization

## Expected Performance

- **Accuracy**: High - uses appropriate models for each category with optimized prompts
- **Token Efficiency**: Maximum optimization through single-word prompts and aggressive limits
- **Runtime**: Well under 10-minute limit for typical task sets
- **Memory**: Lightweight, fits within 4GB RAM constraint
- **Image Size**: Minimal Alpine-based container, well under 10GB limit

## Troubleshooting

### PULL_ERROR
- Ensure image is public
- Verify linux/amd64 manifest exists

### RUNTIME_ERROR
- Check container logs: `docker logs <container_id>`
- Verify environment variables are set

### TIMEOUT
- Check for infinite loops
- Verify API calls are completing

### MODEL_VIOLATION
- Ensure ALLOWED_MODELS is read from environment
- Don't hardcode model IDs

## Contact

For questions about this submission, refer to the AMD Developer Hackathon documentation.
