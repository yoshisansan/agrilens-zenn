#!/bin/bash

# AgriLens Cloud Run Update Script
# Usage: ./update.sh

set -e  # Exit on any error

# Get script directory and change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

printf "${BLUE}🔄 AgriLens Cloud Run Update Script${NC}\n"
echo "=================================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    printf "${RED}❌ Error: .env file not found${NC}\n"
    printf "${YELLOW}💡 Please create .env file based on .env.example${NC}\n"
    exit 1
fi

# Load environment variables from .env file
printf "${BLUE}📋 Loading environment variables from .env...${NC}\n"
set -a  # automatically export all variables
source .env
set +a  # disable automatic export

# Set default values
PROJECT_ID=${GOOGLE_PROJECT_ID}
REGION=${REGION:-"asia-northeast1"}
SERVICE_NAME=${SERVICE_NAME:-"agrilens"}

printf "${GREEN}✅ Configuration loaded${NC}\n"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service Name: $SERVICE_NAME"
echo ""

# Set the project
gcloud config set project $PROJECT_ID

# Deploy updated version
printf "${BLUE}🚢 Updating Cloud Run service...${NC}\n"
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo ""
printf "${GREEN}🎉 Update completed successfully!${NC}\n"
echo "=================================================="
printf "${BLUE}📱 Service URL: ${GREEN}$SERVICE_URL${NC}\n"
printf "${BLUE}📊 Monitoring: ${GREEN}https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME${NC}\n"
echo ""
printf "${GREEN}✅ AgriLens has been updated!${NC}\n"