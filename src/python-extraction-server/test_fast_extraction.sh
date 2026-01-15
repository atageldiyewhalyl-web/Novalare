#!/bin/bash

# Test script for the new fast GPT-4 mini extraction endpoint

echo "🚀 Testing Fast GPT-4 Mini Extraction"
echo "======================================"
echo ""

# Check if PDF file is provided
if [ -z "$1" ]; then
    echo "❌ Error: No PDF file provided"
    echo "Usage: ./test_fast_extraction.sh <path_to_pdf>"
    echo "Example: ./test_fast_extraction.sh ~/Downloads/bank_statement.pdf"
    exit 1
fi

PDF_FILE="$1"

if [ ! -f "$PDF_FILE" ]; then
    echo "❌ Error: File not found: $PDF_FILE"
    exit 1
fi

echo "📄 PDF File: $PDF_FILE"
echo "🔗 Testing endpoint: http://localhost:8000/extract-fast"
echo ""

# Test the fast endpoint
echo "⏱️  Starting extraction..."
START_TIME=$(date +%s)

curl -X POST \
  http://localhost:8000/extract-fast \
  -F "file=@$PDF_FILE" \
  -H "Accept: application/json" \
  -w "\n\n⏱️  HTTP Request Time: %{time_total}s\n" \
  | python3 -m json.tool

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo ""
echo "✅ Total time: ${TOTAL_TIME}s"
echo ""
echo "💡 Compare with old method:"
echo "   Old (GPT-4o): 40+ seconds"
echo "   New (GPT-4 mini): ${TOTAL_TIME}s"
echo "   Speedup: ~$((40 / TOTAL_TIME))x faster"
