# 🚀 Quick Test Guide - Enhanced AI

## ⚡ Fast Test (30 seconds)

```bash
cd python-extraction-server

# Make sure server is running
python3 app.py

# In another terminal:
chmod +x test_enhanced_ai.sh
./test_enhanced_ai.sh
```

## 📊 What to Look For

### ✅ Success Indicators:
- ✅ AI returns schema with `visual_landmarks`
- ✅ `confidence_score` > 80
- ✅ `multi_line_enabled: true` for Capital One
- ✅ Sample transactions have complete amounts ("+$750.00" not just "+")
- ✅ Column positions include helpful notes
- ✅ **30+ transactions extracted** (was 5 before)

### ⚠️ Warnings:
- ⚠️ Confidence score < 70
- ⚠️ Missing visual landmarks
- ⚠️ Sample transactions look incomplete
- ⚠️ Still extracting < 15 transactions

### ❌ Failures:
- ❌ AI returns error
- ❌ No sample_transactions in schema
- ❌ Extraction returns 0 transactions
- ❌ Column ranges look wrong (e.g., x_min > x_max)

---

## 🔍 Manual Testing

### Test Capital One Statement:
```bash
# Step 1: Discover layout
curl -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  | python3 -m json.tool > /tmp/schema.json

# Check the schema
cat /tmp/schema.json | jq '.layout_schema'

# Step 2: Extract with schema
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  -F "schema=$(cat /tmp/schema.json | jq -c '.layout_schema')" \
  | python3 -m json.tool | jq '.count'
```

---

## 📋 Expected Schema Structure

Your AI should return something like this:

```json
{
  "success": true,
  "layout_schema": {
    "bank_name": "Capital One",
    "statement_model": "running_balance",
    "currency": "USD",
    
    "visual_landmarks": {
      "header_row_y": 142,
      "headers_found": ["DATE", "TRANSACTION DETAILS", "AMOUNT", "BALANCE"],
      "date_header_x": 70,
      "description_header_x": 110,
      "amount_header_x": 415,
      "balance_header_x": 515
    },
    
    "columns": {
      "date": {
        "x_min": 70,
        "x_max": 105,
        "note": "Day of month only (1-31)"
      },
      "description": {
        "x_min": 110,
        "x_max": 405,
        "note": "Includes multi-line continuations"
      },
      "amount": {
        "x_min": 413,
        "x_max": 510,
        "note": "Includes + or - prefix and $ sign"
      },
      "balance": {
        "x_min": 511,
        "x_max": 580,
        "note": "Running balance with $ and comma"
      }
    },
    
    "multi_line_enabled": true,
    "multi_line_detection": {
      "rule": "Lines without date are continuations of previous description",
      "indentation_x": 110,
      "description_continues_at_x": 110
    },
    
    "sample_transactions": [
      {
        "date": "1",
        "date_x": 70,
        "description": "Zelle money received from BATYR ATAYEV",
        "amount": "+$750.00",
        "amount_x": 415,
        "balance": "$190,582.04",
        "balance_x": 515
      },
      {
        "date": "2",
        "date_x": 70,
        "description": "Deposit from Capital One Bank",
        "amount": "+$2,000.00",
        "amount_x": 415,
        "balance": "$192,582.04",
        "balance_x": 515,
        "multi_line": true
      }
    ],
    
    "confidence_score": 95,
    "notes": "Statement uses day-of-month dates. Some descriptions span multiple lines."
  },
  "cache_key": "capital_one_a3f8e2c9",
  "message": "Layout discovered for Capital One - cache this schema for future extractions"
}
```

---

## 🐛 Troubleshooting

### Problem: AI still extracting only 5 transactions

**Possible causes:**
1. Column ranges still wrong
2. Multi-line detection not working
3. Footer detection too aggressive

**Debug:**
```bash
# Check what the AI actually discovered
cat /tmp/schema.json | jq '.layout_schema.columns'

# Compare to expected:
# amount: x_min=413, x_max=510
# balance: x_min=511, x_max=580

# Look at sample transactions
cat /tmp/schema.json | jq '.layout_schema.sample_transactions'
```

### Problem: AI returns low confidence score

**Meaning:** AI is unsure about the schema

**Actions:**
1. Check if visual landmarks were found
2. Look at the notes field for warnings
3. Verify sample transactions have complete data

### Problem: No visual landmarks in schema

**Meaning:** AI couldn't find column headers

**Actions:**
1. Check if PDF has a header row
2. Verify headers are visible in the image
3. May need to adjust image resolution (currently 150 DPI)

---

## 📈 Benchmark Results

| Bank | Before | After | Target |
|------|--------|-------|--------|
| Capital One | 5 | **?** | 30+ |
| Chase | 11 | **?** | 30+ |
| Deutsche Bank | Works | **?** | Maintain |

Run the test and fill in the "After" column!

---

## 🎯 Success Criteria

Phase 1 is successful if:
- ✅ Capital One extracts **25+ transactions** (vs 5 before)
- ✅ AI returns `visual_landmarks` field
- ✅ AI detects `multi_line_enabled: true`
- ✅ Sample transactions look complete
- ✅ Confidence score > 80

If any of these fail, we may need to:
- Add more examples to the prompt
- Adjust column width guidelines
- Improve validation logic
- Try two-step AI process (Phase 2)

---

## 💬 What to Report

After running the test, share:

1. **Transaction count**: How many did it extract?
2. **Visual landmarks**: Were they detected?
3. **Multi-line detection**: Enabled or not?
4. **Confidence score**: What did AI report?
5. **Sample transactions**: Do they look correct?
6. **Column positions**: Do they match our expectations?

```bash
# Quick summary command
echo "Transactions: $(cat /tmp/extraction_response.json | jq '.count')"
echo "Confidence: $(cat /tmp/schema.json | jq '.layout_schema.confidence_score')"
echo "Multi-line: $(cat /tmp/schema.json | jq '.layout_schema.multi_line_enabled')"
echo "Visual landmarks found: $(cat /tmp/schema.json | jq '.layout_schema.visual_landmarks.headers_found')"
```

---

## Next Steps

After testing Phase 1:
- ✅ If **success** → Move to Phase 2 (two-step AI + validation)
- ⚠️ If **partial** → Tweak prompt, add more examples
- ❌ If **failure** → Debug AI response, check logs
