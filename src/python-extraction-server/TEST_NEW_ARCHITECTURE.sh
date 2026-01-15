#!/bin/bash

# Test New Template Architecture

echo "======================================================================="
echo "🧪 TESTING NEW TEMPLATE ARCHITECTURE"
echo "======================================================================="

cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Test Template Loader"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
python3 template_loader.py

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Check Template Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📁 Built-in templates:"
ls -lh templates/built_in/*.json 2>/dev/null || echo "  ⚠️  No built-in templates found"

echo ""
echo "📁 User-learned templates:"
ls -lh templates/user_learned/*.json 2>/dev/null || echo "  ✅ Empty (expected for new install)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Validate Template JSON"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for template in templates/built_in/*.json; do
    if [ -f "$template" ]; then
        echo ""
        echo "🔍 Validating $(basename $template)..."
        python3 -m json.tool "$template" > /dev/null && echo "  ✅ Valid JSON" || echo "  ❌ Invalid JSON"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Start Server (Background)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill existing server
pkill -f "python.*app.py" 2>/dev/null
sleep 1

# Start server in background
python3 app.py > /tmp/extraction-server.log 2>&1 &
SERVER_PID=$!

echo "🚀 Server starting (PID: $SERVER_PID)..."
echo "📄 Logs: tail -f /tmp/extraction-server.log"

# Wait for server to start
sleep 3

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server running on http://127.0.0.1:8000"
else
    echo "❌ Server failed to start!"
    echo "📄 Check logs: cat /tmp/extraction-server.log"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Test API Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🧪 GET /templates (list all templates)..."
curl -s http://127.0.0.1:8000/templates | python3 -m json.tool

echo ""
echo "🧪 GET /templates/capital_one (get specific template)..."
curl -s http://127.0.0.1:8000/templates/capital_one | python3 -m json.tool | head -20
echo "  ... (truncated)"

echo ""
echo "🧪 GET /health (health check)..."
curl -s http://127.0.0.1:8000/health | python3 -m json.tool

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ARCHITECTURE TEST COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📊 Summary:"
echo "  • Server PID: $SERVER_PID"
echo "  • Logs: /tmp/extraction-server.log"
echo "  • Templates: templates/built_in/"
echo ""
echo "🔧 Next Steps:"
echo "  1. Test Capital One extraction with real PDF"
echo "  2. Add more bank templates to templates/built_in/"
echo "  3. Implement Tier 3 user mapping (saves to user_learned/)"
echo ""
echo "🛑 To stop server: kill $SERVER_PID"
echo ""
