#!/usr/bin/env bash
# ==============================================================================
# Release Check Against Docker Image
# Purpose: Build the project image, boot it with the project .env, and run the
#          release-check scripts (test-endpoints.sh, endpoint-regression-test.sh)
#          twice each against the container.
# Usage: bash release-check-scripts/release-check-docker.sh [ENV_FILE]
# Env:   IMAGE_NAME (default: json-api-server-with-dashboard-ui)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASE_DIR="${PROJECT_DIR}/release-check-scripts"

IMAGE_NAME="${IMAGE_NAME:-json-api-server-with-dashboard-ui}"
ENV_FILE="${1:-${PROJECT_DIR}/.env}"
CONTAINER_NAME="release-check-$$"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
  echo -e "${YELLOW}[CLEANUP]${NC} Removing container ${CONTAINER_NAME}..."
  docker stop "${CONTAINER_NAME}" 2>/dev/null || true
  docker rm "${CONTAINER_NAME}" 2>/dev/null || true
}
trap cleanup EXIT

if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}[ERROR]${NC} Docker daemon is not running or not accessible." >&2
  exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo -e "${RED}[ERROR]${NC} Env file not found: ${ENV_FILE}" >&2
  exit 1
fi
if [ ! -f "${RELEASE_DIR}/test-endpoints.sh" ] || [ ! -f "${RELEASE_DIR}/endpoint-regression-test.sh" ]; then
  echo -e "${RED}[ERROR]${NC} Release check scripts not found in ${RELEASE_DIR}" >&2
  exit 1
fi

echo -e "${CYAN}=== Step 1/3: Building image ${IMAGE_NAME} ===${NC}"
docker build -t "${IMAGE_NAME}" "${PROJECT_DIR}"

echo -e "${CYAN}=== Step 2/3: Starting server from image ${IMAGE_NAME} ===${NC}"
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p 127.0.0.1::3000 \
  -v "${ENV_FILE}:/app/.env:ro" \
  "${IMAGE_NAME}" >/dev/null

HOST_PORT="$(docker port "${CONTAINER_NAME}" 3000 2>/dev/null | head -n1 | sed 's/.*://')"
if [ -z "${HOST_PORT}" ]; then
  echo -e "${RED}[ERROR]${NC} Could not determine the assigned host port." >&2
  docker logs "${CONTAINER_NAME}"
  exit 1
fi
BASE_URL="http://127.0.0.1:${HOST_PORT}"
echo "  Container listening on ${BASE_URL}"

echo "  Waiting for health endpoint..."
READY=0
for i in $(seq 1 60); do
  if curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then
    READY=1
    echo -e "${GREEN}  Container healthy after ${i}s${NC}"
    break
  fi
  sleep 1
done
if [ "${READY}" -ne 1 ]; then
  echo -e "${RED}[ERROR]${NC} Container did not become healthy within 60 seconds." >&2
  echo "=== Container logs ==="
  docker logs "${CONTAINER_NAME}"
  exit 1
fi

echo -e "${CYAN}=== Step 3/3: Running release-check scripts (2x each) ===${NC}"
RUN_FAILURES=0
for run in 1 2; do
  echo -e "\n${CYAN}---- Run ${run}/2: test-endpoints.sh ----${NC}"
  if ! bash "${RELEASE_DIR}/test-endpoints.sh" "${BASE_URL}"; then
    echo -e "${RED}  FAILED: test-endpoints.sh (run ${run})${NC}"
    RUN_FAILURES=$((RUN_FAILURES + 1))
  fi

  echo -e "\n${CYAN}---- Run ${run}/2: endpoint-regression-test.sh ----${NC}"
  if ! BASE_URL="${BASE_URL}" bash "${RELEASE_DIR}/endpoint-regression-test.sh"; then
    echo -e "${RED}  FAILED: endpoint-regression-test.sh (run ${run})${NC}"
    RUN_FAILURES=$((RUN_FAILURES + 1))
  fi
done

echo
if [ "${RUN_FAILURES}" -eq 0 ]; then
  echo -e "${GREEN}==============================================================${NC}"
  echo -e "${GREEN} SUCCESS: All release checks passed against ${IMAGE_NAME}. ${NC}"
  echo -e "${GREEN}==============================================================${NC}"
  exit 0
else
  echo -e "${RED}==============================================================${NC}"
  echo -e "${RED} FAILURE: ${RUN_FAILURES} script run(s) reported failures. ${NC}"
  echo -e "${RED}==============================================================${NC}"
  exit 1
fi
