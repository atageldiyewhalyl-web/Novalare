#!/bin/bash

# Capital One Template Test Script
# Usage: ./test-capital-one.sh /path/to/capital-one-statement.pdf

if [ -z "$1" ]; then
    echo "❌ Error: Please provide path to Capital One PDF"
    echo "Usage: ./test-capital-one.sh /path/to/capital-one-statement.pdf"
    exit 1
fi

PDF_PATH="$1"

if [ ! -f "$PDF_PATH" ]; then
    echo "❌ Error: File not found: $PDF_PATH"
    exit 1
fi

echo "🔍 Testing Capital One Template"
echo "================================"
echo ""

# Step 1: Diagnose columns
echo "📊 Step 1: Diagnosing PDF structure..."
echo ""
curl -s -X POST http://127.0.0.1:8000/diagnose-columns \
  -F "file=@$PDF_PATH" \
  | jq -r '
    if .success then
      "✅ Bank Detected: " + (.detected_bank // "none") + "\n" +
      "📍 Transaction start row: " + (.transaction_start_row | tostring) + "\n" +
      "\n🔍 First 5 transaction rows:\n" +
      (
        .rows[0:5] | map(
          "  Row " + (.row_num | tostring) + ": " + .full_text
        ) | join("\n")
      )
    else
      "❌ Error: " + .error
    end
  '

echo ""
echo "================================"
echo ""

# Step 2: Extract transactions
echo "📤 Step 2: Extracting transactions..."
echo ""
RESULT=$(curl -s -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@$PDF_PATH")

echo "$RESULT" | jq -r '
    if .success then
      "✅ Extraction successful!\n" +
      "📊 Total transactions: " + (.total | tostring) + "\n" +
      "\n💰 First 3 transactions:\n" +
      (
        .transactions[0:3] | map(
          "  " + .date + " | " + .description[0:40] + "... | $" + (.amount | tostring) + " | Balance: $" + (.balance | tostring)
        ) | join("\n")
      )
    else
      "❌ Extraction failed: " + .error
    end
  '

echo ""
echo "================================"
echo ""
echo "💡 Next steps:"
echo "   1. If total = 0, run: open /test-capital-one-diagnosis.html"
echo "   2. Check actual x-coordinates of amount and balance fields"
echo "   3. Update template in python-extraction-server/app.py (lines 37-52)"
echo ""
