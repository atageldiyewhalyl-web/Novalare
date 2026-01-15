#!/bin/bash

# ============================================================================
# QuickBooks OAuth - Localhost Testing Setup Script
# ============================================================================
#
# This script helps you configure your environment for localhost testing
#
# Usage: ./setup-localhost.sh
#
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  QuickBooks OAuth - Localhost Testing Setup               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env.local.example exists
if [ ! -f "supabase/functions/server/.env.local.example" ]; then
    echo -e "${RED}❌ Error: .env.local.example not found${NC}"
    echo "   Expected at: supabase/functions/server/.env.local.example"
    exit 1
fi

# Check if .env.local already exists
if [ -f "supabase/functions/server/.env.local" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env.local already exists${NC}"
    read -p "   Overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}ℹ️  Keeping existing .env.local${NC}"
        echo ""
        echo "To manually edit, run:"
        echo "  nano supabase/functions/server/.env.local"
        echo ""
        exit 0
    fi
fi

# Copy the example file
echo -e "${BLUE}📄 Creating .env.local from template...${NC}"
cp supabase/functions/server/.env.local.example supabase/functions/server/.env.local

echo -e "${GREEN}✅ Created .env.local${NC}"
echo ""

# Prompt for required values
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Let's fill in your configuration values${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Press ENTER to skip optional fields"
echo ""

# Supabase Configuration
echo -e "${BLUE}━━━ Supabase Configuration ━━━${NC}"
echo "Get these from: Supabase Dashboard → Settings → API"
echo ""

read -p "SUPABASE_URL: " SUPABASE_URL
read -p "SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
read -p "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
echo ""

# QuickBooks Configuration
echo -e "${BLUE}━━━ QuickBooks Configuration ━━━${NC}"
echo "Get these from: https://developer.intuit.com/app/developer/myapps"
echo ""

read -p "QBO_CLIENT_ID: " QBO_CLIENT_ID
read -p "QBO_CLIENT_SECRET: " QBO_CLIENT_SECRET
echo ""
echo "Using redirect URI: http://localhost:5173/qbo-callback"
QBO_REDIRECT_URI="http://localhost:5173/qbo-callback"
echo ""

# OpenAI Configuration
echo -e "${BLUE}━━━ OpenAI Configuration ━━━${NC}"
echo "Get from: https://platform.openai.com/api-keys"
echo ""

read -p "OPENAI_API_KEY: " OPENAI_API_KEY
echo ""

# Update the file
echo -e "${BLUE}💾 Saving configuration...${NC}"

sed -i.bak \
    -e "s|SUPABASE_URL=.*|SUPABASE_URL=${SUPABASE_URL}|" \
    -e "s|SUPABASE_ANON_KEY=.*|SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}|" \
    -e "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}|" \
    -e "s|QBO_REDIRECT_URI=.*|QBO_REDIRECT_URI=${QBO_REDIRECT_URI}|" \
    -e "s|QBO_CLIENT_ID=.*|QBO_CLIENT_ID=${QBO_CLIENT_ID}|" \
    -e "s|QBO_CLIENT_SECRET=.*|QBO_CLIENT_SECRET=${QBO_CLIENT_SECRET}|" \
    -e "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=${OPENAI_API_KEY}|" \
    supabase/functions/server/.env.local

# Remove backup file
rm -f supabase/functions/server/.env.local.bak

echo -e "${GREEN}✅ Configuration saved!${NC}"
echo ""

# Show next steps
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✨ Setup Complete! Next Steps:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}1. Update QuickBooks Developer Portal:${NC}"
echo "   • Go to: https://developer.intuit.com/app/developer/myapps"
echo "   • Select your app → Keys & credentials"
echo "   • Add Redirect URI: http://localhost:5173/qbo-callback"
echo ""
echo -e "${BLUE}2. Update QBO_REDIRECT_URI in Supabase (if using production Edge Functions):${NC}"
echo "   • Go to: Supabase Dashboard → Settings → Edge Functions → Secrets"
echo "   • Update QBO_REDIRECT_URI to: http://localhost:5173/qbo-callback"
echo "   • Remember to change back after testing!"
echo ""
echo -e "${BLUE}3. Start your development server:${NC}"
echo "   ${GREEN}npm run dev${NC}"
echo ""
echo -e "${BLUE}4. Test the OAuth flow:${NC}"
echo "   • Go to: http://localhost:5173"
echo "   • Navigate to: Settings → Accounting Integrations"
echo "   • Click: Connect QuickBooks"
echo ""
echo -e "${GREEN}📖 For more help, see:${NC}"
echo "   • /QUICK_START_LOCALHOST_QB.md"
echo "   • /QB_OAUTH_FLOW_LOCALHOST.md"
echo ""
echo -e "${GREEN}🎉 Happy testing!${NC}"
echo ""
