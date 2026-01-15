# Testing Deutsche Bank Extraction (v3.1)

## Quick Test

```bash
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@/path/to/deutsche_bank_statement.pdf" \
  -F "auto_discover=true" \
| python3 -m json.tool
```

---

## What to Look For

### 1. AI Discovery Phase ✅

Console should show:
```
🚀 ENTERING AI LAYOUT DISCOVERY
🤖 Automatically discovering layout with AI...
✅ GPT-4 Vision responded successfully
🤖 AI discovered layout: Deutsche Bank
📋 Statement model: soll_haben  ← CRITICAL!
```

**✅ PASS if**: `"statement_model": "soll_haben"`
**❌ FAIL if**: `"statement_model": "running_balance"` (wrong model detected)

---

### 2. Column Detection ✅

Console should show:
```
🤖 Using AI layout schema: Deutsche Bank
📋 Statement model: soll_haben
📐 Column ranges: date=40-110, soll=370-450, haben=460-540
```

**✅ PASS if**: Shows `soll` and `haben` columns (NOT `amount` and `balance`)
**❌ FAIL if**: Shows `amount` and `balance` (Chase model used incorrectly)

---

### 3. Transaction Extraction ✅

Console should show:
```
🔍 Row 20: date=20.10. | soll=-23,50 | haben=None | amount=-23.5 | desc=Kartenzahlung...
🔍 Row 29: date=21.10. | soll=None | haben=2.000,00 | amount=2000.0 | desc=SEPA Überweisung...
```

**✅ PASS if**: 
- Soll values → negative amounts
- Haben values → positive amounts
- No balance column shown

**❌ FAIL if**: Shows `balance` values (should be null for soll_haben)

---

### 4. JSON Output Validation ✅

Expected structure:
```json
{
  "success": true,
  "method": "ai_guided",
  "bank": "Deutsche Bank",
  "auto_discovered": true,
  "statement_model": "soll_haben",  ← Should be present
  "transactions": [
    {
      "date": "2025-10-20",
      "description": "Kartenzahlung Verwendungszweck/Kundenreferenz SmashBurger//Mannheim/DE",
      "amount": -23.5,     ✅ Negative from Soll
      "balance": null,     ✅ Null (no per-row balance)
      "confidence": "medium"
    },
    {
      "date": "2025-10-21",
      "description": "SEPA Echtzeitüberweisung Gehalt",
      "amount": 2000.0,    ✅ Positive from Haben
      "balance": null,
      "confidence": "medium"
    }
  ],
  "validation": {
    "confidence_score": 90,
    "status": "high_confidence",
    "balance_errors": 0,   ✅ Should be 0 (validation skipped)
    "date_errors": 0,
    "issues": []
  }
}
```

---

## Common Issues & Fixes

### Issue 1: AI detects "running_balance" instead of "soll_haben"

**Symptom**: 
```json
"statement_model": "running_balance",
"columns": {
  "amount": {"x_min": 370},
  "balance": {"x_min": 460}  ← WRONG
}
```

**Cause**: AI didn't recognize Soll/Haben headers

**Fix**: Check if column headers are visible in first page. May need to add "Soll" and "Haben" to transaction_start_markers.

---

### Issue 2: Amounts are all NULL

**Symptom**:
```json
{"amount": null, "balance": null}
```

**Console shows**:
```
🔍 Row 20: date=20.10. | soll=None | haben=None | amount=None
```

**Cause**: Column ranges are wrong (AI misidentified column positions)

**Fix**: Check word coordinates in debug output. Soll/Haben might be at different X positions.

**Debug**:
```bash
curl -X POST http://127.0.0.1:8000/debug \
  -F "file=@deutsche_bank_statement.pdf"
```

Look for actual X positions of Soll/Haben values.

---

### Issue 3: All amounts are positive (or all negative)

**Symptom**:
```json
{"amount": 23.5}  ← Should be -23.5 (Soll is debit)
```

**Cause**: Soll/Haben polarity logic not applied

**Fix**: Check lines 755-781 in `app.py`:
```python
if soll_amount:
    amount_field = f"-{abs(soll_amount)}"  # Force negative
elif haben_amount:
    amount_field = f"+{abs(haben_amount)}"  # Force positive
```

---

### Issue 4: Balance continuity errors still showing

**Symptom**:
```json
"validation": {
  "balance_errors": 10,
  "issues": [
    {"type": "balance_continuity", "row": 1, ...}
  ]
}
```

**Cause**: Validation is still checking balance continuity for soll_haben model

**Fix**: Ensure `layout_schema` is passed to `validate_transactions()`:
```python
validation = validate_transactions(transactions, layout_schema)  # line 1443
```

And validation skips continuity check:
```python
if statement_model == 'running_balance':
    # Only check balance continuity for Chase-style statements
```

---

## Acceptance Criteria

### ✅ EXTRACTION ACCURACY

All 14 transactions extracted with:
- ✅ Correct dates (2025-10-20, 2025-10-21, etc.)
- ✅ Full descriptions (multi-line merged correctly)
- ✅ Correct signed amounts:
  - Soll (Kartenzahlung) → negative
  - Haben (Gehalt) → positive
- ✅ Balance = null for all transactions

### ✅ VALIDATION ACCURACY

- ✅ Confidence score: 85-95% (high)
- ✅ Status: "high_confidence"
- ✅ Balance errors: 0 (continuity check skipped)
- ✅ Date errors: 0
- ✅ No false positive validation errors

### ✅ FINANCIAL ACCURACY

Manual verification:
1. Sum all amounts: Should equal net change
2. All Soll values should be negative
3. All Haben values should be positive
4. No amounts should be flipped or missing

**Formula**: `sum(amounts) = Neuer Saldo - Alter Saldo`

---

## Test Matrix

| Bank           | Model         | Expected Result                          |
|----------------|---------------|------------------------------------------|
| Chase          | running_balance | Heuristic works, no AI needed          |
| Deutsche Bank  | soll_haben     | AI discovers, Soll/Haben extracted      |
| Sparkasse      | soll_haben     | AI discovers, same as Deutsche Bank     |
| Capital One    | running_balance | AI discovers, running balance extracted |
| Bank of America| running_balance | AI discovers or heuristic works        |

---

## Next Steps After Passing

1. **Deploy to Railway**:
   ```bash
   git add app.py FIXES_v3.1_SOLL_HABEN.md
   git commit -m "feat: Add Deutsche Bank Soll/Haben support (v3.1)"
   git push railway main
   ```

2. **Test Capital One**: Verify Chase-style detection still works

3. **Add Statement Balance Extraction**: Extract "Neuer Saldo" as metadata

4. **Implement Balance Reconciliation**: `sum(amounts) + beginning = ending`

---

## Debugging Commands

### View raw AI response:
Add to `discover_layout_with_ai()` before parsing:
```python
print(f"🔍 RAW AI RESPONSE:\n{result}")
```

### Test AI discovery only (no extraction):
Temporarily comment out re-extraction at line 1429:
```python
# transactions = extract_transactions_with_schema(tmp_path, layout_schema)
transactions = []
```

### Force AI discovery even if heuristic works:
Change line 1386:
```python
if len(transactions) == 0 or auto_discover:  # Always trigger if auto_discover=true
```

---

## Success Criteria Summary

**v3.1 is production-ready when**:
- ✅ Deutsche Bank extracts with 100% accuracy (all amounts, dates, descriptions correct)
- ✅ No balance continuity errors (validation correctly skipped)
- ✅ Chase statements still work (backward compatibility)
- ✅ Capital One triggers AI and extracts correctly
- ✅ Confidence scores above 85% for both models

**THIS IS THE FINAL MILESTONE BEFORE PRODUCTION** 🚀
