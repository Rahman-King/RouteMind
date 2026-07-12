# RouteMind - Intelligent AI Routing System

A multi-tier AI routing system that uses Qwen via Ollama for intelligent request classification and routing.

## Features

- **Intelligent Routing**: Uses Qwen2.5:0.5b via Ollama for smart request classification (local, 3GB RAM)
- **Multi-Tier Architecture**: 
  - Tier 1: Minimax M3 (Fireworks) - Simple tasks, $0.15/M
  - Tier 2: Kimi K2P6 (Fireworks) - General reasoning, $0.50/M
- **Cost Optimization**: Token budget management, prompt compression, semantic caching
- **Local Router**: Qwen2.5:0.5b model runs locally via Ollama for zero-cost routing decisions
- **Docker Support**: Containerized deployment with Fireworks API integration

## Prerequisites

- Node.js 20+
- Fireworks API Key ([Get one here](https://fireworks.ai/))
- Ollama with Qwen2.5:0.5b model ([Install Ollama](https://ollama.com/))
- Docker (for containerized deployment)

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env and add your Fireworks API key
# FIREWORKS_API_KEY=your_actual_api_key_here

# Pull and build the Qwen router model with Ollama
ollama pull qwen2.5:0.5b
ollama create qwen-router -f Modelfile
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Using Docker directly

```bash
# Build Docker image
docker build -t routemind .

# Run container with environment variables
docker run -d \
  -p 3000:3000 \
  -e FIREWORKS_API_KEY=your_api_key_here \
  -e OLLAMA_ROUTER=true \
  routemind

# Or use env file
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  routemind
```

## Environment Variables

- `FIREWORKS_API_KEY`: Your Fireworks API key (required)
- `OLLAMA_ROUTER`: Enable/disable AI routing (default: true)
- `OLLAMA_ROUTER_TIMEOUT_MS`: Router timeout in milliseconds (default: 1500)
- `OLLAMA_BASE_URL`: Ollama server URL (default: http://localhost:11434)

## Architecture

### Routing Flow

1. **Tier 0**: Local processing (rule engine, exact cache, semantic cache)
2. **Qwen Router**: Classifies request using Qwen2.5:0.5b via Ollama (local)
3. **Decision Engine**: Multi-factor scoring for optimal tier selection
4. **Tier Selection**: Routes to appropriate tier based on complexity and cost
5. **Inference**: Executes request using selected Fireworks model
6. **Learning**: Records metrics for adaptive optimization

### Key Components

- `lib/router/gemma-router.ts`: Qwen-powered routing intelligence (local via Ollama)
- `lib/router/deterministic-fallback.ts`: Heuristic fallback routing
- `lib/tier1/fireworks-client.ts`: Fireworks API client for Tier 1
- `lib/models/registry.ts`: Model configuration and selection
- `lib/economy/engine.ts`: Token budget and cost optimization
- `app/api/chat/route.ts`: Main API endpoint

## API Usage

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing",
    "sessionId": "user123"
  }'
```

## License

MIT
