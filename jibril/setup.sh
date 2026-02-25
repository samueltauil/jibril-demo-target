#!/bin/bash
# setup.sh — Install Jibril configuration for the demo target.
#
# Usage:
#   sudo ./jibril/setup.sh
#
# This copies the config and private alchemies to /etc/jibril/,
# where Jibril expects to find them.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JIBRIL_CONFIG_DIR="/etc/jibril"
ALCHEMIES_DIR="${JIBRIL_CONFIG_DIR}/alchemies/private"

echo "Installing Jibril configuration for demo target..."

# Create directories
mkdir -p "${ALCHEMIES_DIR}"

# Copy main config
cp "${SCRIPT_DIR}/config.yaml" "${JIBRIL_CONFIG_DIR}/config.yaml"
echo "  Copied config.yaml → ${JIBRIL_CONFIG_DIR}/config.yaml"

# Copy private alchemies
for alchemy in "${SCRIPT_DIR}/alchemies/"*.yaml; do
  if [ -f "$alchemy" ]; then
    cp "$alchemy" "${ALCHEMIES_DIR}/"
    echo "  Copied $(basename "$alchemy") → ${ALCHEMIES_DIR}/"
  fi
done

echo ""
echo "Done! Start Jibril with:"
echo "  sudo AGENT_URL=https://your-agent.azurecontainerapps.io jibril --config ${JIBRIL_CONFIG_DIR}/config.yaml"
echo ""
echo "For local testing:"
echo "  sudo AGENT_URL=http://localhost:3000 jibril --config ${JIBRIL_CONFIG_DIR}/config.yaml"
