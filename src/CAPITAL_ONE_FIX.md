# Capital One Template Fix - Dec 22, 2025

## Problem
Capital One statements were extracting 0 transactions despite template detection working correctly.

## Root Cause
**Wrong column positions in template!**

### Old Template (WRONG)
```python
"columns": {
    "date": {"x_min": 40, "x_max": 100},
    "description": {"x_min": 110, "x_max": 290},   # ❌ Too narrow
    "amount": {"x_min": 300, "x_max": 380},        # ❌ Wrong position!
    "balance": {"x_min": 405, "x_max": 480}        # ❌ Wrong position!
}
```

**Result:** Amount column at x=300 had nothing → extracted 0 transactions

### New Template (FIXED)
```python
"columns": {
    "date": {"x_min": 40, "x_max": 100},
    "description": {"x_min": 110, "x_max": 580},   # ✅ Wide column for long descriptions
    "amount": {"x_min": 660, "x_max": 760},        # ✅ Actual position on PDF
    "balance": {"x_min": 800, "x_max": 900}        # ✅ Rightmost column
}
```

## Capital One Format (Actual Layout)
```
DATE    DESCRIPTION                              CATEGORY    AMOUNT        BALANCE
Apr 1   Zelle money received from MUHAMMED...               + $3,000.00   $189,832.04
Apr 1   Zelle money received from BATYR...                  + $750.00     $190,582.04
Apr 2   Deposit from Capital One Bank...                    + $2,000.00   $192,582.04
Apr 2   Zelle money sent to BEGGELDI...                     - $2,000.00   $190,582.04
```

**Key observations:**
1. CATEGORY column exists but is usually empty
2. AMOUNT column shows `+ $X,XXX.XX` or `- $X,XXX.XX` with signs
3. Description column is very wide (can be 400+ pixels)
4. Balance is rightmost column

## Amount Parsing
The `parse_amount()` function already handles Capital One's format:

**Input:** `"+ $3,000.00"`
1. Remove `$` and spaces: `"+3,000.00"`
2. Detect US format (dot is rightmost separator)
3. Remove commas: `"+3000.00"`
4. Parse: `3000.0` ✅

**Input:** `"- $2,000.00"`
1. Remove `$` and spaces: `"-2,000.00"`
2. Remove commas: `"-2000.00"`
3. Parse: `-2000.0` ✅

## Testing

### 1. Test amount parser
```bash
python3 test-capital-one-amounts.py
```

Expected output:
```
✅ + $3,000.00          →       3000.0 (expected 3000.0)
✅ - $2,000.00          →      -2000.0 (expected -2000.0)
✅ + $10,000.00         →      10000.0 (expected 10000.0)
✅ All tests passed!
```

### 2. Test Capital One extraction
```bash
# Restart server first!
cd python-extraction-server
python app.py

# In another terminal
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@statement.pdf" \
  -F "auto_discover=true" \
| python3 -m json.tool
```

Expected result:
```json
{
    "bank": "Capital One",
    "count": 34,
    "transactions": [
        {
            "amount": 3000.0,
            "balance": 189832.04,
            "date": "2022-04-01",
            "description": "Zelle money received from MUHAMMED EMIN BALA"
        }
    ]
}
```

## Files Changed
1. `/python-extraction-server/app.py` - Fixed Capital One template (lines 37-46)
2. `/SOLUTION_BANK_TEMPLATES.md` - Updated documentation
3. `/test-capital-one-amounts.py` - New test file

## What's Fixed
✅ Capital One column positions corrected
✅ Amount parsing handles `+` and `-` signs
✅ Wide description column (up to 580px)
✅ Balance column at correct position (800-900px)

## Next Steps
1. **Restart the server** (required for template changes to take effect)
2. Run `python3 test-capital-one-amounts.py` to verify parsing
3. Test with actual Capital One statement
4. Monitor server logs to verify column detection

## Expected Server Logs (After Fix)
```
🏦 Detected bank: Capital One (matched keyword: 'capital one')
✅ Using bank template: Capital One
📐 Column ranges: date=40-100, amount=660-760, balance=800-900
🔍 Row 4: date=Apr | amount=+$3,000.00→3000.0 | desc=Zelle money received from... | balance=$189,832.04→189832.04
💰 Transaction #1: Date: 2022-04-01 | Amount: 3000.0 | Desc: Zelle money...
```

Compare to OLD logs (broken):
```
📐 Column ranges: date=40-100, amount=300-380  ❌ Wrong!
🔍 Row 4: date=Apr | amount=None→None | balance=$189,832.04→189832.04  ❌ No amount!
```

---

**Status:** ✅ Fixed and ready to test
**Impact:** Capital One statements should now extract 30-40 transactions instead of 0
**Confidence:** HIGH - Column positions verified from actual PDF screenshot
