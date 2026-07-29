#!/usr/bin/env bash
# Run all manual tests
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

BASE_URL=${BASE_URL:-http://localhost:3000}
OUTPUT_DIR="$SCRIPT_DIR/output"
mkdir -p "$OUTPUT_DIR"
LOG_FILE="$OUTPUT_DIR/run-$(date +%Y%m%d-%H%M%S).log"

echo "=== REST endpoints ===" | tee "$LOG_FILE"
for f in rest/*.sh; do
  echo "--- $f ---" | tee -a "$LOG_FILE"
  BASE_URL=$BASE_URL sh "$f" 2>&1 | tee -a "$LOG_FILE"
done

echo "" | tee -a "$LOG_FILE"
echo "=== tRPC endpoints ===" | tee -a "$LOG_FILE"
for f in trpc/*.sh; do
  echo "--- $f ---" | tee -a "$LOG_FILE"
  BASE_URL=$BASE_URL sh "$f" 2>&1 | tee -a "$LOG_FILE"
done

echo "" | tee -a "$LOG_FILE"
echo "Output logged to: $LOG_FILE" | tee -a "$LOG_FILE"
