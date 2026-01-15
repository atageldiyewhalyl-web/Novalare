# Capital One Template Fix - Instructions

## 🎯 Goal
Find the EXACT x-coordinates where Capital One places amount and balance data, then update the template.

---

## 🚀 Step 1: Start Python Server

```bash
cd python-extraction-server
python app.py
```

**Expected output:**
```
✅ Running on http://127.0.0.1:8000
```

---

## 🔍 Step 2: Use Diagnostic Tool

### Option A: Use HTML Tool (Easier)

1. Open `/test-capital-one-diagnosis.html` in your browser
2. Click "Choose File" and select your Capital One PDF
3. Click "Diagnose Column Positions"
4. Look at the output - it will show you:
   - Current template column positions
   - Actual x-coordinates of every word in the PDF
   - Highlighted words that fall in the expected amount/balance ranges

### Option B: Use cURL (Command Line)

```bash
curl -X POST http://127.0.0.1:8000/diagnose-columns \
  -F "file=@/path/to/capital-one-statement.pdf" \
  | json_pp
```

---

## 📊 Step 3: Analyze the Output

Look for transaction rows like:
```
"Apr 01 Zelle received from BATYR ATAYEV +$2,000.00 $190,582.04"
```

**Find these fields and note their x0 values:**

1. **Date** (e.g., "Apr 01") → Should be around x=40-100
2. **Description** (e.g., "Zelle received...") → Should start around x=110
3. **Amount** (e.g., "+$2,000.00") → **THIS IS WHAT WE NEED TO FIND!**
4. **Balance** (e.g., "$190,582.04") → **THIS IS WHAT WE NEED TO FIND!**

---

## 🔧 Step 4: Update Template

Based on what you find, update the Capital One template in `/python-extraction-server/app.py`:

**Current template (lines 37-52):**
```python
"capital_one": {
    "bank_name": "Capital One",
    "statement_model": "running_balance",
    "currency": "USD",
    "columns": {
        "date": {"x_min": 40, "x_max": 100},
        "description": {"x_min": 110, "x_max": 580},
        "amount": {"x_min": 660, "x_max": 760},        # ← UPDATE THESE
        "balance": {"x_min": 800, "x_max": 900}        # ← UPDATE THESE
    },
    "transaction_start_markers": ["Date Description", "TRANSACTION DETAILS"],
    "date_format": "MMM DD",  # "Apr 01"
    "has_balance_column": True,
    "multiline_descriptions": False,
    "detection_keywords": ["capital one", "capitalone"]
},
```

**Update rules:**
- `x_min` = leftmost x-coordinate where the field starts
- `x_max` = rightmost x-coordinate where the field ends
- Description `x_max` should be just BEFORE amount `x_min` (leave a small gap)

**Example:** If you see:
- Amount at x=680 to x=750
- Balance at x=820 to x=890

Update to:
```python
"description": {"x_min": 110, "x_max": 660},  # End just before amount
"amount": {"x_min": 680, "x_max": 750},       # Actual amount position
"balance": {"x_min": 820, "x_max": 890}       # Actual balance position
```

---

## ✅ Step 5: Test the Fix

After updating the template, test extraction:

```bash
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@/path/to/capital-one-statement.pdf" \
  | json_pp
```

**Expected result:**
```json
{
  "success": true,
  "transactions": [
    {
      "date": "2024-04-01",
      "description": "Zelle received from BATYR ATAYEV",
      "amount": 2000.0,
      "balance": 190582.04
    },
    ...
  ],
  "total": 30  # ← Should see 30+ transactions!
}
```

---

## 🐛 Common Issues

### Issue 1: Still Getting 0 Transactions

**Possible causes:**
1. Template not being detected (check logs for "Detected bank: Capital One")
2. Transaction start markers are wrong
3. Date format parser not recognizing Capital One dates

**Debug:**
```bash
# Check if bank is detected
curl -X POST http://127.0.0.1:8000/debug \
  -F "file=@/path/to/capital-one-statement.pdf"
```

### Issue 2: Amounts/Balances Still in Description

**Cause:** Description `x_max` is too large, overlapping with amount column.

**Fix:** Set description `x_max` to be 10-20px BEFORE amount `x_min`.

### Issue 3: Missing Transactions

**Cause:** Transaction start markers not found.

**Fix:** Update `transaction_start_markers` to match exact text in PDF.

---

## 🎯 What to Send Me

Once you run the diagnostic tool, send me:

1. **Sample row output** showing where amount and balance actually are
2. **Any errors** you see in the logs
3. **Number of transactions extracted** after the fix

Then I can help fine-tune the template or fix any other issues!
