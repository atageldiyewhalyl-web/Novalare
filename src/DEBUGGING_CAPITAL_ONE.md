# Debugging Capital One - What to Check

## Current Status
✅ **AI validation code added** (v4.0)
❌ **Capital One still returns 0 transactions**

---

## What We Need to See

### 1. **Check Python Server Logs**

When you run the extraction, the Python server terminal should show:

```bash
⚠️  Heuristic extraction returned 0 transactions
🚀 ENTERING AI LAYOUT DISCOVERY
🤖 Automatically discovering layout with AI...
🔑 OpenAI API key found: sk-...
🤖 Calling GPT-4 Vision for layout discovery...
✅ GPT-4 Vision responded successfully
🤖 AI discovered layout: Capital One
📋 Statement model: running_balance

# THIS IS THE KEY PART - DID AI VALIDATE?
✅ AI validation PASSED:
   Sample 1: date='Apr 01', amount='+$2,000.00', balance='$190,582.04'
   Sample 2: date='Apr 02', amount='-$2,000.00', balance='$188,582.04'

# OR DID IT FAIL?
⚠️  AI validation FAILED: Amount looks incomplete: '+'
   Sample transaction: {'date': 'Apr', 'amount': '+', 'balance': None}
ValueError: AI extracted incomplete amount: '+' - schema validation failed
```

---

## Possible Scenarios

### Scenario A: AI Validation Passed, But Extraction Failed
**Logs show:**
```
✅ AI validation PASSED:
   Sample 1: date='Apr 01', amount='+$2,000.00'
🔄 Re-extracting with AI-discovered schema...
📊 Extraction completed: 0 transactions found  ❌
```

**This means:**
- AI can extract sample data correctly
- But when we use those column positions for full extraction, it fails
- **Root cause**: Column positions are correct for first few rows, but statement has inconsistent layout

**Solution**: Need to check if Capital One has:
- Multi-line transactions
- Different column positions after page 1
- Section headers that break the layout

---

### Scenario B: AI Validation Failed
**Logs show:**
```
⚠️  AI validation FAILED: Amount looks incomplete: '+'
ValueError: AI extracted incomplete amount: '+' - schema validation failed
❌ AI discovery failed: AI extracted incomplete amount: '+' - schema validation failed
```

**This means:**
- AI cannot extract complete transactions
- Validation correctly caught the failure
- **Root cause**: GPT-4 Vision cannot read the PDF layout

**Solution**: 
1. Check if Capital One PDF has images instead of text
2. Try different resolution (150 → 300 DPI)
3. Fallback to manual column mapping

---

### Scenario C: OpenAI API Error
**Logs show:**
```
❌ OpenAI API error: ...
```

**This means:**
- API call failed completely
- **Root cause**: API key, rate limit, or network issue

**Solution**: Check OpenAI API status and credentials

---

## Next Steps

### Step 1: Restart Server & Test
```bash
# Terminal 1: Start server
cd python-extraction-server
python app.py

# Terminal 2: Test Capital One
bash test-capital-one.sh
```

### Step 2: Check Server Logs

Look for the key section:
```
✅ AI validation PASSED:
   Sample 1: date='...', amount='...'
```

OR

```
⚠️  AI validation FAILED: ...
```

### Step 3: Share Logs

Copy the **entire AI discovery section** from the server logs and share it. We need to see:
- What AI returned in `sample_transactions`
- Whether validation passed or failed
- How many transactions were extracted after re-extraction

---

## Expected AI Response (Good Case)

If AI works correctly, it should return:

```json
{
  "bank_name": "Capital One",
  "statement_model": "running_balance",
  "currency": "USD",
  "sample_transactions": [
    {
      "date": "Apr 01",
      "date_x": 45,
      "description": "Zelle received from BATYR ATAYEV",
      "amount": "+$2,000.00",
      "amount_x": 385,
      "balance": "$190,582.04",
      "balance_x": 495
    },
    {
      "date": "Apr 02",
      "date_x": 45,
      "description": "Zelle sent to...",
      "amount": "-$2,000.00",
      "amount_x": 385,
      "balance": "$188,582.04",
      "balance_x": 495
    }
  ],
  "columns": {
    "date": {"x_min": 40, "x_max": 110},
    "description": {"x_min": 120, "x_max": 360},
    "amount": {"x_min": 380, "x_max": 450},
    "balance": {"x_min": 490, "x_max": 560}
  },
  "has_balance_column": true
}
```

**Key checks:**
- ✅ `sample_transactions` has 2-3 real transactions
- ✅ `amount` is complete (e.g., "+$2,000.00", not just "+")
- ✅ `date` is complete (e.g., "Apr 01", not just "Apr")
- ✅ `columns` match the sample transaction X positions

---

## If AI Validation Fails

We'll need to implement **Plan B**:

### Option 1: Increase Image Resolution
```python
# Try 300 DPI instead of 150
page_image = page.to_image(resolution=300)
```

### Option 2: Manual Column Mapping UI
Ask user to click on:
- One date
- One amount
- One balance

Then calculate column positions from those clicks.

### Option 3: Use Heuristic Column Detection
For Capital One specifically, hardcode column positions if we find a pattern.

---

## Test Command

```bash
# Make script executable
chmod +x test-capital-one.sh

# Run test
./test-capital-one.sh
```

**Then immediately check the Python server terminal** to see the detailed logs!

---

## What I Added (v4.0)

1. **AI Validation** (lines 1105-1136):
   - Checks if `sample_transactions` exists
   - Validates `amount` is complete (not just "+")
   - Validates `date` is complete (not just "Apr")
   - Prints clear pass/fail message

2. **Debug Logging** (lines 1485-1497):
   - Prints full AI schema response
   - Shows extraction count
   - Full error tracebacks

3. **Better Error Handling** (lines 1499-1505):
   - Catches validation errors
   - Prints detailed error messages
   - Doesn't crash, returns empty result

---

## Success Criteria

**v4.0 succeeds if:**
1. AI validation clearly shows pass/fail
2. If validation fails, we get actionable error message
3. If validation passes but extraction fails, we know it's a layout issue, not AI issue

**Then we can proceed to Plan B** based on which specific failure mode we see.

---

## Status: Ready to Test

**Action Required:**
1. Restart Python server
2. Run `./test-capital-one.sh`
3. **Share the Python server logs** (the terminal where you ran `python app.py`)

That will tell us exactly why Capital One is failing.
