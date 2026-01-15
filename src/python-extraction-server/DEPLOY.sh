#!/bin/bash

# 🚀 Deploy Python API to Render
# This script commits and pushes the updated app.py to trigger Render deployment

echo "🚀 Deploying Python API fixes to Render..."
echo ""

# Check if we're in the right directory
if [ ! -f "app.py" ]; then
    echo "❌ Error: app.py not found. Make sure you're in python-extraction-server directory"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "⚠️  Git repository not initialized in this directory"
    echo "   Looking for parent git repository..."
    cd ..
fi

# Stage the changes
echo "📝 Staging changes..."
git add python-extraction-server/app.py

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "⚠️  No changes to commit - app.py is already up to date"
    echo ""
    echo "Possible issues:"
    echo "1. Changes were already committed"
    echo "2. You need to push to remote: git push origin main"
    echo "3. Render needs manual redeployment"
    exit 0
fi

# Commit the changes
echo "💾 Committing changes..."
git commit -m "Fix: Handle OpenAI content policy refusals with business context

- Added detection for OpenAI refusal messages
- Added business context explaining legitimate accounting use
- Added system message for professional software context
- Better error messages when OpenAI refuses to process"

# Push to remote
echo "📤 Pushing to remote repository..."
echo ""
echo "Current branch: $(git branch --show-current)"
echo "Remote: $(git remote get-url origin 2>/dev/null || echo 'No remote configured')"
echo ""

read -p "Push to origin/main? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main
    echo ""
    echo "✅ Pushed to remote!"
    echo ""
    echo "🔄 Render will now auto-deploy (takes 2-3 minutes)"
    echo ""
    echo "Monitor deployment at: https://dashboard.render.com"
    echo "Check logs after deployment and try uploading again"
else
    echo ""
    echo "⚠️  Changes committed locally but not pushed"
    echo "Run 'git push origin main' when ready to deploy"
fi

echo ""
echo "📊 Next steps:"
echo "1. Wait 2-3 minutes for Render to deploy"
echo "2. Upload a PDF in the UI"
echo "3. Check Render logs for:"
echo "   ✅ 'You are an AI assistant for professional accounting software'"
echo "   ✅ JSON response with bank layout"
echo "   OR"
echo "   ❌ 'OpenAI content policy refusal' with clear instructions"
echo ""
