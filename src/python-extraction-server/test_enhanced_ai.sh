#!/bin/bash

echo "=========================================="
echo "🧪 Testing Enhanced AI Layout Discovery"
echo "=========================================="
echo ""

# Disable proxies to avoid conflicts
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
echo "🚫 Proxies disabled for testing"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if server is running
if ! curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Server not running on port 8000${NC}"
    echo "Please start the server first:"
    echo "  cd python-extraction-server"
    echo "  python3 app.py"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Test file
PDF_FILE="/Users/halyl.atageldiyev/Downloads/statement (5).pdf"

if [ ! -f "$PDF_FILE" ]; then
    echo -e "${RED}❌ Test PDF not found: $PDF_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}📄 Testing with Capital One statement${NC}"
echo ""

echo "=========================================="
echo "STEP 1: AI Layout Discovery"
echo "=========================================="
echo ""

# Call discover-layout endpoint
echo "🤖 Calling /discover-layout endpoint..."
RESPONSE=$(curl -s -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@$PDF_FILE")

# Save full response
echo "$RESPONSE" > /tmp/ai_discovery_response.json

# Check if successful
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ AI Discovery succeeded!${NC}"
    echo ""
    
    # Extract and display schema
    echo "📋 Discovered Schema:"
    echo "$RESPONSE" | jq '.layout_schema' > /tmp/schema.json
    
    # Display key information
    echo ""
    echo "Bank: $(echo "$RESPONSE" | jq -r '.layout_schema.bank_name')"
    echo "Model: $(echo "$RESPONSE" | jq -r '.layout_schema.statement_model')"
    echo "Currency: $(echo "$RESPONSE" | jq -r '.layout_schema.currency')"
    echo "Confidence: $(echo "$RESPONSE" | jq -r '.layout_schema.confidence_score // "N/A"')"
    echo ""
    
    # Visual landmarks
    if echo "$RESPONSE" | jq -e '.layout_schema.visual_landmarks' > /dev/null 2>&1; then
        echo "🔍 Visual Landmarks:"
        echo "$RESPONSE" | jq '.layout_schema.visual_landmarks'
        echo ""
    fi
    
    # Column positions
    echo "📐 Column Positions:"
    echo "$RESPONSE" | jq '.layout_schema.columns'
    echo ""
    
    # Multi-line detection
    MULTILINE=$(echo "$RESPONSE" | jq -r '.layout_schema.multi_line_enabled')
    if [ "$MULTILINE" = "true" ]; then
        echo "📝 Multi-line Enabled: YES"
        echo "$RESPONSE" | jq '.layout_schema.multi_line_detection'
        echo ""
    else
        echo "📝 Multi-line Enabled: NO"
        echo ""
    fi
    
    # Sample transactions
    echo "💰 Sample Transactions Extracted:"
    echo "$RESPONSE" | jq '.layout_schema.sample_transactions'
    echo ""
    
    # Notes
    NOTES=$(echo "$RESPONSE" | jq -r '.layout_schema.notes // "None"')
    echo "📌 AI Notes: $NOTES"
    echo ""
    
    echo "=========================================="
    echo "STEP 2: Extract Transactions with AI Schema"
    echo "=========================================="
    echo ""
    
    # Extract schema and pass to extract-with-schema
    SCHEMA=$(echo "$RESPONSE" | jq -c '.layout_schema')
    
    echo "🔧 Extracting transactions using discovered schema..."
    EXTRACT_RESPONSE=$(curl -s -X POST http://127.0.0.1:8000/extract-with-schema \
      -F "file=@$PDF_FILE" \
      -F "schema=$SCHEMA" \
      -F "auto_discover=false")
    
    echo "$EXTRACT_RESPONSE" > /tmp/extraction_response.json
    
    # Count transactions
    TRANSACTION_COUNT=$(echo "$EXTRACT_RESPONSE" | jq '.count // 0')
    
    echo ""
    echo "=========================================="
    echo "RESULTS"
    echo "=========================================="
    echo ""
    echo "📊 Transactions Extracted: $TRANSACTION_COUNT"
    echo ""
    
    if [ "$TRANSACTION_COUNT" -gt 20 ]; then
        echo -e "${GREEN}✅ SUCCESS! Extracted $TRANSACTION_COUNT transactions${NC}"
        echo ""
        echo "First 3 transactions:"
        echo "$EXTRACT_RESPONSE" | jq '.transactions[:3]'
    elif [ "$TRANSACTION_COUNT" -gt 10 ]; then
        echo -e "${BLUE}⚠️  Partial success: $TRANSACTION_COUNT transactions${NC}"
        echo "Expected 30+, but this is better than heuristic baseline (5)"
        echo ""
        echo "Transactions:"
        echo "$EXTRACT_RESPONSE" | jq '.transactions'
    else
        echo -e "${RED}❌ Still low extraction: $TRANSACTION_COUNT transactions${NC}"
        echo "Need to investigate AI schema quality"
        echo ""
        echo "Transactions:"
        echo "$EXTRACT_RESPONSE" | jq '.transactions'
    fi
    
else
    echo -e "${RED}❌ AI Discovery failed${NC}"
    echo "$RESPONSE" | jq '.'
fi

echo ""
echo "=========================================="
echo "📁 Full responses saved to:"
echo "  /tmp/ai_discovery_response.json"
echo "  /tmp/schema.json"
echo "  /tmp/extraction_response.json"
echo "=========================================="
