#!/bin/bash

# 🚀 Supabase Edge Function Deployment Script
# This script deploys your Edge Function to Supabase

set -e  # Exit on any error

echo "🚀 Novalare - Supabase Edge Function Deployment"
echo "================================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed!"
    echo ""
    echo "📦 Install it using one of these methods:"
    echo ""
    echo "Mac/Linux (Homebrew):"
    echo "  brew install supabase/tap/supabase"
    echo ""
    echo "Windows (Scoop):"
    echo "  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git"
    echo "  scoop install supabase"
    echo ""
    echo "Or download from: https://github.com/supabase/cli/releases"
    exit 1
fi

echo "✅ Supabase CLI is installed"
echo ""

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "🔐 You need to login to Supabase first"
    echo ""
    supabase login
    echo ""
fi

echo "✅ Authenticated with Supabase"
echo ""

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "🔗 Project not linked yet"
    echo ""
    echo "Please enter your Supabase Project Reference ID:"
    echo "(Find it in: Supabase Dashboard → Settings → General → Reference ID)"
    echo ""
    read -p "Project Ref ID: " PROJECT_REF
    echo ""
    
    supabase link --project-ref "$PROJECT_REF"
    echo ""
fi

echo "✅ Project is linked"
echo ""

# Deploy the edge function
echo "📦 Deploying make-server-53c2e113 function..."
echo ""

supabase functions deploy make-server-53c2e113

echo ""
echo "================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "================================================"
echo ""
echo "🔍 Verify deployment:"
echo ""
echo "1. Check function status:"
echo "   supabase functions list"
echo ""
echo "2. Test health endpoint:"
echo "   curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/health"
echo ""
echo "3. View logs:"
echo "   supabase functions logs make-server-53c2e113"
echo ""
echo "4. Refresh your app and check if errors are gone!"
echo ""
