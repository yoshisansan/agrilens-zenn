#!/bin/bash

# AgriLens Cloud Run Deployment Script
# Usage: ./deploy.sh

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

printf "${BLUE}🚀 AgriLens Cloud Run Deployment Script${NC}\n"
echo "=================================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    printf "${RED}❌ Error: .env file not found${NC}\n"
    printf "${YELLOW}💡 Please create .env file based on .env.example${NC}\n"
    echo "   cp .env.example .env"
    echo "   # Then edit .env with your actual values"
    exit 1
fi

# Load environment variables from .env file
printf "${BLUE}📋 Loading environment variables from .env...${NC}\n"
set -a  # automatically export all variables
source .env
set +a  # disable automatic export

# Check required environment variables
required_vars=("GOOGLE_PROJECT_ID" "GOOGLE_CLIENT_EMAIL" "GOOGLE_PRIVATE_KEY" "GEMINI_API_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    printf "${RED}❌ Error: Missing required environment variables:${NC}\n"
    for var in "${missing_vars[@]}"; do
        printf "   ${RED}- $var${NC}\n"
    done
    printf "${YELLOW}💡 Please set these variables in your .env file${NC}\n"
    exit 1
fi

# Set default values
PROJECT_ID=${GOOGLE_PROJECT_ID}
REGION=${REGION:-"asia-northeast1"}
SERVICE_NAME=${SERVICE_NAME:-"agrilens"}

printf "${GREEN}✅ Environment variables loaded successfully${NC}\n"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service Name: $SERVICE_NAME"
echo ""

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    printf "${RED}❌ Error: gcloud CLI is not installed${NC}\n"
    printf "${YELLOW}💡 Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install${NC}\n"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    printf "${RED}❌ Error: Not authenticated with gcloud${NC}\n"
    printf "${YELLOW}💡 Please run: gcloud auth login${NC}\n"
    exit 1
fi

# Set the project
printf "${BLUE}🔧 Setting project to $PROJECT_ID...${NC}\n"
gcloud config set project $PROJECT_ID

# Check billing status
printf "${BLUE}💳 Checking billing status...${NC}\n"
BILLING_ENABLED=$(gcloud billing projects describe $PROJECT_ID --format="value(billingEnabled)" 2>/dev/null || echo "false")

if [ "$BILLING_ENABLED" != "True" ]; then
    printf "${RED}❌ Error: Billing is not enabled for this project${NC}\n"
    printf "${YELLOW}💡 Please enable billing for your project:${NC}\n"
    echo "   1. Go to: https://console.cloud.google.com/billing"
    echo "   2. Create or select a billing account"
    echo "   3. Link it to your project: $PROJECT_ID"
    echo "   4. Run this script again"
    exit 1
fi

printf "${GREEN}✅ Billing is enabled${NC}\n"

# Enable required APIs
printf "${BLUE}🔌 Enabling required APIs...${NC}\n"
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Deploy to Cloud Run
printf "${BLUE}🚢 Deploying to Cloud Run...${NC}\n"
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production \
    --set-env-vars GOOGLE_PROJECT_ID="$GOOGLE_PROJECT_ID" \
    --set-env-vars GOOGLE_CLIENT_EMAIL="$GOOGLE_CLIENT_EMAIL" \
    --set-env-vars GOOGLE_PRIVATE_KEY="$GOOGLE_PRIVATE_KEY" \
    --set-env-vars GEMINI_API_KEY="$GEMINI_API_KEY" \
    --set-env-vars SESSION_SECRET="$SESSION_SECRET" \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo ""
printf "${GREEN}🎉 Deployment completed successfully!${NC}\n"
echo "=================================================="
printf "${BLUE}📱 Service URL: ${GREEN}$SERVICE_URL${NC}\n"
printf "${BLUE}🌍 Public Access: ${GREEN}Enabled${NC}\n"
printf "${BLUE}📊 Monitoring: ${GREEN}https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME${NC}\n"
echo ""
printf "${YELLOW}💡 Next steps:${NC}\n"
echo "   1. Test your application: $SERVICE_URL"
echo "   2. Monitor logs: gcloud run logs tail $SERVICE_NAME --region=$REGION"
echo "   3. Update HOST environment variable if using OAuth:"
echo "      HOST=$(echo $SERVICE_URL | sed 's|https://||')"
echo ""
printf "${GREEN}✅ AgriLens is now live and ready for demo!${NC}\n"