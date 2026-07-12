# ── RouteMind Production Container ─────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Copy application code and Modelfile
COPY . .

# Create necessary directories
RUN mkdir -p /output /input

# Runtime environment variables (will be injected by harness)
ENV FIREWORKS_API_KEY=""
ENV FIREWORKS_BASE_URL=""
ENV ALLOWED_MODELS=""
ENV OLLAMA_BASE_URL="http://host.docker.internal:11434"
ENV OLLAMA_ROUTER="true"
ENV OLLAMA_ROUTER_TIMEOUT_MS="1500"

# Run task processing script on startup
CMD ["npm", "run", "run-tasks"]
