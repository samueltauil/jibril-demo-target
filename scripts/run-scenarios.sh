#!/bin/bash
# run-scenarios.sh — Start the demo target and trigger all attack scenarios.
#
# Usage:
#   ./scripts/run-scenarios.sh                          # Default: localhost:8080
#   TARGET_URL=http://host:8080 ./scripts/run-scenarios.sh

set -e

TARGET_URL="${TARGET_URL:-http://localhost:8080}"
AGENT_URL="${AGENT_URL:-http://localhost:3000}"

echo "============================================================"
echo "  Jibril Demo Target — Scenario Runner"
echo "============================================================"
echo "  Target:  ${TARGET_URL}"
echo "  Agent:   ${AGENT_URL}"
echo ""

# Wait for demo target to be healthy
echo "Waiting for demo target..."
for i in $(seq 1 30); do
  if curl -sf "${TARGET_URL}/health" > /dev/null 2>&1; then
    echo "  Demo target is healthy."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "  ERROR: Demo target not reachable at ${TARGET_URL}/health"
    exit 1
  fi
  sleep 1
done

echo ""

# Trigger all scenarios
echo "Triggering all scenarios..."
echo ""

response=$(curl -sf -X POST "${TARGET_URL}/scenario/all" 2>&1)
echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"

echo ""
echo "============================================================"
echo "  Scenarios complete! Checking agent for detected chains..."
echo "============================================================"
echo ""

# Give Jibril a moment to process and forward events
sleep 3

# Check agent health
if curl -sf "${AGENT_URL}/health" > /dev/null 2>&1; then
  echo "Agent health:"
  curl -sf "${AGENT_URL}/health" | python3 -m json.tool 2>/dev/null || curl -sf "${AGENT_URL}/health"
  echo ""

  echo "Detected chains:"
  curl -sf "${AGENT_URL}/chains" | python3 -m json.tool 2>/dev/null || curl -sf "${AGENT_URL}/chains"
else
  echo "Agent not reachable at ${AGENT_URL}/health"
  echo "If the agent is running on Azure, set AGENT_URL and check directly:"
  echo "  curl -s \${AGENT_URL}/chains | jq ."
fi

echo ""
echo "Done."
