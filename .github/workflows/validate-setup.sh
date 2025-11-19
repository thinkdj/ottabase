#!/bin/bash

# Cloudflare Setup Validation Script
# This script validates that your local environment is ready for Cloudflare deployment
# Usage: ./validate-setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cloudflare Setup Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check command exists
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed"
        return 0
    else
        echo -e "${RED}✗${NC} $1 is not installed"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Check Node.js
echo -e "${YELLOW}Checking Node.js installation...${NC}"
if check_command node; then
    NODE_VERSION=$(node --version)
    echo "  Version: $NODE_VERSION"
    # Check if version is >= 18
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}  ⚠ Warning: Node.js 18+ is recommended (current: $NODE_VERSION)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# Check pnpm
echo -e "${YELLOW}Checking pnpm installation...${NC}"
if check_command pnpm; then
    PNPM_VERSION=$(pnpm --version)
    echo "  Version: $PNPM_VERSION"
fi
echo ""

# Check wrangler
echo -e "${YELLOW}Checking Wrangler installation...${NC}"
if check_command wrangler; then
    WRANGLER_VERSION=$(wrangler --version)
    echo "  Version: $WRANGLER_VERSION"
else
    echo -e "${YELLOW}  ℹ Install with: npm install -g wrangler${NC}"
fi
echo ""

# Check jq (used in setup scripts)
echo -e "${YELLOW}Checking jq installation...${NC}"
if check_command jq; then
    JQ_VERSION=$(jq --version)
    echo "  Version: $JQ_VERSION"
else
    echo -e "${YELLOW}  ℹ Install with: apt-get install jq (Ubuntu) or brew install jq (Mac)${NC}"
fi
echo ""

# Check repository structure
echo -e "${YELLOW}Checking repository structure...${NC}"
check_file "package.json"
check_file "pnpm-workspace.yaml"
check_file "turbo.json"
check_file "apps/ottabase-template-app/package.json"
check_file "apps/ottabase-template-app/wrangler.jsonc"
check_file ".github/workflows/deploy-cloudflare.yml"
echo ""

# Check if dependencies are installed
echo -e "${YELLOW}Checking dependencies...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules exists"
else
    echo -e "${YELLOW}⚠${NC} node_modules not found - run: pnpm install"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check if Prisma client is generated
echo -e "${YELLOW}Checking Prisma client...${NC}"
if [ -d "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client" ] || \
   [ -d "node_modules/@prisma/client" ]; then
    echo -e "${GREEN}✓${NC} Prisma client is generated"
else
    echo -e "${YELLOW}⚠${NC} Prisma client not generated - run: cd packages/db && npx prisma generate"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check Cloudflare authentication (only if wrangler is installed)
if command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}Checking Cloudflare authentication...${NC}"
    if wrangler whoami &> /dev/null; then
        ACCOUNT_EMAIL=$(wrangler whoami 2>&1 | grep "email:" | awk '{print $2}')
        echo -e "${GREEN}✓${NC} Authenticated with Cloudflare"
        echo "  Email: $ACCOUNT_EMAIL"
    else
        echo -e "${YELLOW}⚠${NC} Not authenticated with Cloudflare"
        echo -e "${YELLOW}  ℹ Run: wrangler login${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    echo ""
fi

# Check wrangler.jsonc configuration
echo -e "${YELLOW}Checking wrangler.jsonc configuration...${NC}"
cd apps/ottabase-template-app
if [ -f "wrangler.jsonc" ]; then
    # Check for placeholder IDs
    if grep -q "YOUR_D1_DATABASE_ID" wrangler.jsonc; then
        echo -e "${YELLOW}⚠${NC} D1 database ID is not set (still has placeholder)"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓${NC} D1 database ID is configured"
    fi
    
    if grep -q "YOUR_KV_NAMESPACE_ID" wrangler.jsonc; then
        echo -e "${YELLOW}⚠${NC} KV namespace ID is not set (still has placeholder)"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓${NC} KV namespace ID is configured"
    fi
fi
cd ../..
echo ""

# Check GitHub secrets (only if gh CLI is installed and repo is accessible)
if command -v gh &> /dev/null; then
    echo -e "${YELLOW}Checking GitHub secrets...${NC}"
    if gh auth status &> /dev/null; then
        # Check if secrets are set
        if gh secret list 2>&1 | grep -q "CLOUDFLARE_API_TOKEN"; then
            echo -e "${GREEN}✓${NC} CLOUDFLARE_API_TOKEN is set"
        else
            echo -e "${YELLOW}⚠${NC} CLOUDFLARE_API_TOKEN is not set"
            echo -e "${YELLOW}  ℹ Add it in: Settings → Secrets → Actions${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
        
        if gh secret list 2>&1 | grep -q "CLOUDFLARE_ACCOUNT_ID"; then
            echo -e "${GREEN}✓${NC} CLOUDFLARE_ACCOUNT_ID is set"
        else
            echo -e "${YELLOW}⚠${NC} CLOUDFLARE_ACCOUNT_ID is not set"
            echo -e "${YELLOW}  ℹ Add it in: Settings → Secrets → Actions${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "${YELLOW}⚠${NC} Not authenticated with GitHub CLI"
        echo -e "${YELLOW}  ℹ Cannot check GitHub secrets - verify manually${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    echo ""
fi

# Build validation
echo -e "${YELLOW}Checking build status...${NC}"
if [ -d "packages/db/dist" ] && [ -d "packages/scripts/dist" ]; then
    echo -e "${GREEN}✓${NC} Packages appear to be built"
else
    echo -e "${YELLOW}⚠${NC} Packages may not be built"
    echo -e "${YELLOW}  ℹ Run: pnpm build:packages${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo -e "${GREEN}Your environment is ready for Cloudflare deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Set up GitHub secrets (if not done)"
    echo "  2. Push to main branch"
    echo "  3. Watch GitHub Actions deploy your app"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo -e "${YELLOW}Your environment is mostly ready, but some optional setup is missing.${NC}"
    echo ""
    echo "Review the warnings above and:"
    echo "  - Install missing optional tools"
    echo "  - Set up GitHub secrets"
    echo "  - Build packages if needed"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo -e "${RED}Please fix the errors above before deploying.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Install Node.js: https://nodejs.org/"
    echo "  - Install pnpm: npm install -g pnpm"
    echo "  - Install dependencies: pnpm install"
    echo "  - Check that you're in the repository root"
    exit 1
fi
