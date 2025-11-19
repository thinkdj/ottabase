#!/bin/bash

# Cloudflare Resources Setup Script
# This script creates all required Cloudflare resources for the ottabase-template-app
# Usage: ./setup-cloudflare-resources.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Cloudflare Resources Setup Script${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler is not installed${NC}"
    echo "Please install wrangler first: npm install -g wrangler"
    exit 1
fi

# Check authentication
echo -e "${YELLOW}Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with Cloudflare${NC}"
    echo "Please run: wrangler login"
    exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

# Navigate to the app directory
cd "$(dirname "$0")/../../apps/ottabase-template-app"

echo -e "${YELLOW}Creating Cloudflare resources...${NC}"
echo ""

# Create D1 database
echo -e "${YELLOW}Setting up D1 database...${NC}"
DB_INFO=$(wrangler d1 list --json 2>/dev/null | jq -r '.[] | select(.name=="ottabase-db") | .uuid' || echo "")
if [ -z "$DB_INFO" ]; then
    echo "Creating D1 database: ottabase-db"
    DB_CREATE_OUTPUT=$(wrangler d1 create ottabase-db --json)
    DB_ID=$(echo "$DB_CREATE_OUTPUT" | jq -r '.uuid')
    echo -e "${GREEN}✓ D1 database created with ID: $DB_ID${NC}"
else
    echo -e "${GREEN}✓ D1 database already exists with ID: $DB_INFO${NC}"
    DB_ID="$DB_INFO"
fi
echo ""

# Create R2 buckets
echo -e "${YELLOW}Setting up R2 buckets...${NC}"
R2_PROD=$(wrangler r2 bucket list --json 2>/dev/null | jq -r '.[] | select(.name=="ottabase-bucket") | .name' || echo "")
if [ -z "$R2_PROD" ]; then
    echo "Creating R2 bucket: ottabase-bucket"
    wrangler r2 bucket create ottabase-bucket
    echo -e "${GREEN}✓ R2 bucket created: ottabase-bucket${NC}"
else
    echo -e "${GREEN}✓ R2 bucket already exists: ottabase-bucket${NC}"
fi

R2_PREVIEW=$(wrangler r2 bucket list --json 2>/dev/null | jq -r '.[] | select(.name=="ottabase-bucket-preview") | .name' || echo "")
if [ -z "$R2_PREVIEW" ]; then
    echo "Creating R2 preview bucket: ottabase-bucket-preview"
    wrangler r2 bucket create ottabase-bucket-preview
    echo -e "${GREEN}✓ R2 preview bucket created: ottabase-bucket-preview${NC}"
else
    echo -e "${GREEN}✓ R2 preview bucket already exists: ottabase-bucket-preview${NC}"
fi
echo ""

# Create KV namespaces
echo -e "${YELLOW}Setting up KV namespaces...${NC}"
KV_INFO=$(wrangler kv:namespace list --json 2>/dev/null | jq -r '.[] | select(.title=="ottabase-template-app-MY_KV") | .id' || echo "")
if [ -z "$KV_INFO" ]; then
    echo "Creating KV namespace: MY_KV"
    KV_CREATE_OUTPUT=$(wrangler kv:namespace create MY_KV --json)
    KV_ID=$(echo "$KV_CREATE_OUTPUT" | jq -r '.id')
    echo -e "${GREEN}✓ KV namespace created with ID: $KV_ID${NC}"
else
    echo -e "${GREEN}✓ KV namespace already exists with ID: $KV_INFO${NC}"
    KV_ID="$KV_INFO"
fi

KV_PREVIEW_INFO=$(wrangler kv:namespace list --json 2>/dev/null | jq -r '.[] | select(.title=="ottabase-template-app-MY_KV_preview") | .id' || echo "")
if [ -z "$KV_PREVIEW_INFO" ]; then
    echo "Creating KV preview namespace: MY_KV"
    KV_PREVIEW_CREATE_OUTPUT=$(wrangler kv:namespace create MY_KV --preview --json)
    KV_PREVIEW_ID=$(echo "$KV_PREVIEW_CREATE_OUTPUT" | jq -r '.id')
    echo -e "${GREEN}✓ KV preview namespace created with ID: $KV_PREVIEW_ID${NC}"
else
    echo -e "${GREEN}✓ KV preview namespace already exists with ID: $KV_PREVIEW_INFO${NC}"
    KV_PREVIEW_ID="$KV_PREVIEW_INFO"
fi
echo ""

# Create Queue
echo -e "${YELLOW}Setting up Queue...${NC}"
QUEUE_INFO=$(wrangler queues list --json 2>/dev/null | jq -r '.[] | select(.queue_name=="ottabase-queue") | .queue_name' || echo "")
if [ -z "$QUEUE_INFO" ]; then
    echo "Creating Queue: ottabase-queue"
    wrangler queues create ottabase-queue
    echo -e "${GREEN}✓ Queue created: ottabase-queue${NC}"
else
    echo -e "${GREEN}✓ Queue already exists: ottabase-queue${NC}"
fi
echo ""

# Update wrangler.jsonc
echo -e "${YELLOW}Updating wrangler.jsonc with resource IDs...${NC}"

# Create a backup
cp wrangler.jsonc wrangler.jsonc.backup

# Update the IDs using jq
cat wrangler.jsonc | jq --arg db_id "$DB_ID" \
  --arg kv_id "$KV_ID" \
  --arg kv_preview_id "$KV_PREVIEW_ID" \
  '.d1_databases[0].database_id = $db_id |
   .kv_namespaces[0].id = $kv_id |
   .kv_namespaces[0].preview_id = $kv_preview_id' > wrangler.jsonc.tmp

mv wrangler.jsonc.tmp wrangler.jsonc
echo -e "${GREEN}✓ wrangler.jsonc updated${NC}"
echo ""

# Summary
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Setup Complete! 🚀${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Resources created:"
echo "  • D1 Database: ottabase-db ($DB_ID)"
echo "  • R2 Bucket: ottabase-bucket"
echo "  • R2 Preview Bucket: ottabase-bucket-preview"
echo "  • KV Namespace: MY_KV ($KV_ID)"
echo "  • KV Preview Namespace: MY_KV ($KV_PREVIEW_ID)"
echo "  • Queue: ottabase-queue"
echo ""
echo "Next steps:"
echo "  1. Review the updated wrangler.jsonc"
echo "  2. Build your app: pnpm build"
echo "  3. Deploy: pnpm deploy"
echo ""
echo "A backup of your original wrangler.jsonc has been saved to wrangler.jsonc.backup"
