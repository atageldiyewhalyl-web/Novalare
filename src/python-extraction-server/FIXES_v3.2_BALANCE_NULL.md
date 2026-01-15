# FIX v3.2: Null Balance for Soll/Haben Model

## Problem

After v3.1, Deutsche Bank extraction was **semantically correct** but still outputting **misleading balance values**:

```json
{
  "amount": -23.5,
  "balance": -23.5,  ❌ This is NOT a running balance!
}
```

This was confusing because:
- Deutsche Bank has **no per-row running balance**
- Balance appears only once at statement end ("Neuer Saldo: +8,15")
- The `-23.5` is the **Soll amount**, not a balance

**Impact**: Downstream consumers might misinterpret the data as having balance continuity when it doesn't.

---

## Solution

Set `balance = null` for all transactions in `soll_haben` model.

### Code Change (Lines 885-895)

**Before**:
```python
current_transaction = {
    'date': parsed_date,
    'description': description_field or '',
    'amount': parsed_amount,
    'balance': parsed_balance,  # ❌ Wrong for soll_haben
    'confidence': 'high' if parsed_balance else 'medium'
}
```

**After**:
```python
# For soll_haben model: balance is always None (no per-row balance)
# For running_balance model: use parsed_balance
final_balance = None if columns.get('statement_model') == 'soll_haben' else parsed_balance

current_transaction = {
    'date': parsed_date,
    'description': description_field or '',
    'amount': parsed_amount,
    'balance': final_balance,  # ✅ Null for soll_haben
    'confidence': 'high' if final_balance is not None else 'medium'
}
```

### Also Fixed Multi-line Continuation (Lines 896-905)

Prevent balance updates during description continuation for soll_haben:

```python
# Check if this might actually have a balance we missed
# BUT: only for running_balance model (not soll_haben)
if columns.get('statement_model') != 'soll_haben':
    if not current_transaction['balance'] and balance_field:
        current_transaction['balance'] = parse_amount(balance_field)
        current_transaction['confidence'] = 'high'
```

---

## Expected Output (v3.2)

### Deutsche Bank (Soll/Haben Model)

```json
{
  "method": "ai_guided",
  "bank": "Deutsche Bank",
  "transactions": [
    {
      "date": "2025-10-20",
      "description": "Kartenzahlung SmashBurger//Mannheim/DE",
      "amount": -23.5,
      "balance": null,  ✅ Correct!
      "confidence": "medium"
    },
    {
      "date": "2025-10-29",
      "description": "SEPA Lastschrift-Rückgabe AOKBaden-Wuerttemberg",
      "amount": 61.33,
      "balance": null,  ✅ Correct!
      "confidence": "medium"
    }
  ],
  "validation": {
    "confidence_score": 100,
    "balance_errors": 0,
    "status": "high_confidence"
  }
}
```

### Chase (Running Balance Model)

```json
{
  "method": "heuristic",
  "bank": "Unknown (Chase baseline)",
  "transactions": [
    {
      "date": "2025-10-15",
      "description": "Amazon Purchase",
      "amount": -50.00,
      "balance": 1450.00,  ✅ Has balance (running_balance model)
      "confidence": "high"
    }
  ]
}
```

---

## Why This Matters

### 1. Data Contract Clarity

Consumers can now reliably check:
```javascript
if (transaction.balance !== null) {
  // This statement has per-row running balance
  // Validate continuity
} else {
  // This statement is soll_haben
  // Use statement-level balance instead
}
```

### 2. Prevents Misinterpretation

Before:
```
"balance": -23.5
```
→ Looks like account balance is negative €23.50 ❌

After:
```
"balance": null
```
→ Clear signal: no per-row balance available ✅

### 3. Aligns with Accounting Standards

**Deutsche Bank statements don't have running balance**.
Our API shouldn't pretend they do.

---

## Validation Impact

**Before (v3.1)**:
```json
"confidence": "high"  // ❌ Based on fake balance
```

**After (v3.2)**:
```json
"confidence": "medium"  // ✅ Correctly reflects no balance validation
```

This is **more honest** - we can't validate balance continuity for soll_haben.

---

## Next Steps

### 1. Add Statement-Level Balance Extraction

Extract "Neuer Saldo" as metadata:
```json
{
  "statement_metadata": {
    "ending_balance": 8.15,
    "currency": "EUR"
  },
  "transactions": [...]
}
```

### 2. Add Statement-Level Validation

For soll_haben:
```python
if statement_model == 'soll_haben':
    # Validate: sum(amounts) = ending_balance - starting_balance
    calculated_change = sum(t['amount'] for t in transactions)
    expected_change = ending_balance - starting_balance
    
    if abs(calculated_change - expected_change) > 0.02:
        issues.append({
            'type': 'statement_balance_mismatch',
            'calculated': calculated_change,
            'expected': expected_change
        })
```

### 3. Add Confidence Tiers

```python
if statement_model == 'running_balance' and all(t['balance'] for t in transactions):
    confidence_tier = 'high'  # Full continuity validation
elif statement_model == 'soll_haben' and statement_balance_validated:
    confidence_tier = 'high'  # Statement-level validation
else:
    confidence_tier = 'medium'  # Amount/date validation only
```

---

## Files Modified

- `app.py` (line 885-895): Set balance = null for soll_haben
- `app.py` (line 896-905): Skip balance updates for soll_haben in multi-line continuation

**Total Changes**: ~10 lines

**Backward Compatibility**: ✅ Chase/running_balance model unchanged

---

## Acceptance Test

```bash
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@deutsche_bank.pdf" \
  -F "auto_discover=true" \
| jq '.transactions[0].balance'
```

**Expected**: `null`

**Before v3.2**: `-23.5` (misleading)

---

## Summary

**v3.1**: Correct extraction, wrong balance semantics
**v3.2**: Correct extraction, correct balance semantics

This is the final polish needed before production deployment.

**Status**: ✅ Production-ready for both Chase and Deutsche Bank
