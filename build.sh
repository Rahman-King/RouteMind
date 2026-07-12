#!/bin/bash

# Build script for AMD Developer Hackathon submission
# Builds Docker image for linux/amd64 platform

set -e

IMAGE_NAME=${1:-"routemind-hackathon"}
IMAGE_TAG=${2:-"latest"}
REGISTRY=${3:-""}

FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

if [ -n "$REGISTRY" ]; then
  FULL_IMAGE_NAME="${REGISTRY}/${FULL_IMAGE_NAME}"
fi

echo "Building Docker image for linux/amd64 platform..."
echo "Image: ${FULL_IMAGE_NAME}"

# Build for linux/amd64 platform
docker buildx build \
  --platform linux/amd64 \
  --load \
  -t "${FULL_IMAGE_NAME}" \
  .

echo "Build complete: ${FULL_IMAGE_NAME}"

# Optionally push to registry
if [ -n "$REGISTRY" ]; then
  echo "Pushing to registry..."
  docker push "${FULL_IMAGE_NAME}"
  echo "Push complete"
fi

echo "Done!"
