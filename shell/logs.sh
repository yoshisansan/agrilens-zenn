#!/bin/bash

# AgriLens Cloud Run Logs Script
# Usage: ./logs.sh

set -e  # Exit on any error

# Get script directory and change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

printf "${BLUE}📋 AgriLens Cloud Run Logs${NC}\n"
echo "=================================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Using default values (no .env file found)"
    PROJECT_ID=""
    REGION="asia-northeast1"
    SERVICE_NAME="agrilens"
else
    # Load environment variables from .env file
    set -a  # automatically export all variables
    source .env
    set +a  # disable automatic export
    PROJECT_ID=${GOOGLE_PROJECT_ID}
    REGION=${REGION:-"asia-northeast1"}
    SERVICE_NAME=${SERVICE_NAME:-"agrilens"}
fi

printf "${GREEN}📊 Streaming logs for: $SERVICE_NAME${NC}\n"
echo "   Region: $REGION"
echo "   Press Ctrl+C to stop"
echo ""

# Set project if available
if [ ! -z "$PROJECT_ID" ]; then
    gcloud config set project $PROJECT_ID
fi

# Stream logs
gcloud run logs tail $SERVICE_NAME --region=$REGION