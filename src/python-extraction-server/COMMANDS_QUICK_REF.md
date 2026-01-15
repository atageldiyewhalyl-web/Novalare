# 🚀 Quick Command Reference

## Start Server
```bash
cd python-extraction-server
python3 app.py
```

---

## Run Full Test Suite
```bash
chmod +x test_enhanced_ai.sh
./test_enhanced_ai.sh
```

---

## Manual Testing Commands

### 1. Discover Layout (AI)
```bash
curl -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  | python3 -m json.tool > /tmp/schema.json
```

### 2. View Discovered Schema
```bash
cat /tmp/schema.json | jq '.'
```

### 3. View Specific Fields

**Bank Name:**
```bash
cat /tmp/schema.json | jq '.layout_schema.bank_name'
```

**Confidence Score:**
```bash
cat /tmp/schema.json | jq '.layout_schema.confidence_score'
```

**Visual Landmarks:**
```bash
cat /tmp/schema.json | jq '.layout_schema.visual_landmarks'
```

**Column Positions:**
```bash
cat /tmp/schema.json | jq '.layout_schema.columns'
```

**Multi-Line Detection:**
```bash
cat /tmp/schema.json | jq '.layout_schema.multi_line_enabled'
cat /tmp/schema.json | jq '.layout_schema.multi_line_detection'
```

**Sample Transactions:**
```bash
cat /tmp/schema.json | jq '.layout_schema.sample_transactions'
```

### 4. Extract Transactions with Schema
```bash
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  -F "schema=$(cat /tmp/schema.json | jq -c '.layout_schema')" \
  | python3 -m json.tool > /tmp/extraction.json
```

### 5. View Extraction Results

**Transaction Count:**
```bash
cat /tmp/extraction.json | jq '.count'
```

**All Transactions:**
```bash
cat /tmp/extraction.json | jq '.transactions'
```

**First 3 Transactions:**
```bash
cat /tmp/extraction.json | jq '.transactions[:3]'
```

---

## Quick Health Checks

### Check Server Status
```bash
curl http://127.0.0.1:8000/health
```

### Check OpenAI API Key
```bash
echo $OPENAI_API_KEY | head -c 20
```

### View Server Logs (Real-time)
```bash
# Server logs print to terminal where python3 app.py is running
# Look for:
# - "🤖 AI discovered layout: ..."
# - "🔍 Visual landmarks detected: ..."
# - "📝 Multi-line transactions detected: ..."
```

---

## Debugging Commands

### Check AI Raw Response
```bash
# Look in server logs for:
# "🔍 Raw AI response (first 800 chars):"
```

### Verify Column Ranges
```bash
cat /tmp/schema.json | jq '.layout_schema.columns.amount'
# Expected for Capital One:
# {
#   "x_min": 413,
#   "x_max": 510,
#   "note": "Includes + or - prefix and $ sign"
# }
```

### Check for Errors
```bash
cat /tmp/schema.json | jq '.error'
cat /tmp/extraction.json | jq '.error'
```

### View All Sample Amounts
```bash
cat /tmp/schema.json | jq '.layout_schema.sample_transactions[].amount'
# Should show complete amounts like "+$750.00"
# NOT partial like "+" or "750"
```

---

## Performance Testing

### Time the AI Discovery
```bash
time curl -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  -o /dev/null -s
```

### Time the Full Extraction
```bash
time curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  -F "schema=$(cat /tmp/schema.json | jq -c '.layout_schema')" \
  -o /dev/null -s
```

---

## Comparison Commands

### Compare Before vs After
```bash
# Before (heuristic only):
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  -F "auto_discover=false" \
  | jq '.count'

# After (AI enhanced):
./test_enhanced_ai.sh | grep "Transactions Extracted"
```

---

## One-Liners

### Quick Transaction Count
```bash
curl -s -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  -F "auto_discover=true" | jq '.count'
```

### Quick Confidence Check
```bash
curl -s -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  | jq '.layout_schema.confidence_score'
```

### Quick Multi-Line Check
```bash
curl -s -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  | jq '.layout_schema.multi_line_enabled'
```

### Quick Headers Check
```bash
curl -s -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  | jq '.layout_schema.visual_landmarks.headers_found'
```

---

## Results Summary (Single Command)
```bash
echo "=== AI DISCOVERY RESULTS ==="
echo "Bank: $(cat /tmp/schema.json | jq -r '.layout_schema.bank_name')"
echo "Confidence: $(cat /tmp/schema.json | jq -r '.layout_schema.confidence_score')"
echo "Multi-line: $(cat /tmp/schema.json | jq -r '.layout_schema.multi_line_enabled')"
echo "Headers: $(cat /tmp/schema.json | jq -r '.layout_schema.visual_landmarks.headers_found')"
echo ""
echo "=== EXTRACTION RESULTS ==="
echo "Transactions: $(cat /tmp/extraction.json | jq -r '.count')"
echo "First amount: $(cat /tmp/extraction.json | jq -r '.transactions[0].amount')"
echo "First balance: $(cat /tmp/extraction.json | jq -r '.transactions[0].balance')"
```

---

## Clean Up
```bash
rm /tmp/schema.json /tmp/extraction.json /tmp/ai_discovery_response.json /tmp/extraction_response.json
```

---

## Test Different PDFs

### Chase Statement
```bash
curl -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/path/to/chase_statement.pdf" \
  | jq '.layout_schema.bank_name'
```

### Deutsche Bank Statement
```bash
curl -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/path/to/deutsche_bank_statement.pdf" \
  | jq '.layout_schema.statement_model'
# Should return "soll_haben"
```

---

## Emergency Reset

### Kill Server
```bash
lsof -ti:8000 | xargs kill -9
```

### Restart Server
```bash
cd python-extraction-server
python3 app.py
```

### Clear Cache
```bash
# If we implement caching in Phase 2:
rm -rf templates/ai_learned/*.json
```
