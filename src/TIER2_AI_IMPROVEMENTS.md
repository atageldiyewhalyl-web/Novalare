# Tier 2: AI Discovery Improvements

## Problem with Current AI Prompt

**Lines 1089-1093 in app.py:**
```python
"columns": {
    "date": {"x_min": 40, "x_max": 110},
    "description": {"x_min": 120, "x_max": 360},
    "amount": {"x_min": 380, "x_max": 450},    # ← HARDCODED!
    "balance": {"x_min": 490, "x_max": 560}    # ← HARDCODED!
}
```

**This BIASES GPT-4 Vision!** It sees these example positions and returns similar positions, even when they're wrong for Capital One (which has amount at x=680, balance at x=820).

---

## Solution: 3 Improvements

### **Improvement 1: Remove Hardcoded Positions from Prompt**

**OLD (Lines 1064-1086):**
```python
{
  "date": "Apr 01",
  "date_x": 45,          # ← Hardcoded example
  "amount": "+$2,000.00",
  "amount_x": 385,       # ← Hardcoded example!
  "balance": "$190,582.04",
  "balance_x": 495       # ← Hardcoded example!
}
```

**NEW:**
```python
# No hardcoded positions in prompt!
# Let AI discover positions freely
```

### **Improvement 2: Add Retry Logic with Different Prompts**

**Attempt 1:** General prompt (current)
**Attempt 2:** If fails, ask AI to describe what it sees first, THEN extract
**Attempt 3:** If still fails, use OCR-style extraction (extract all text, then find patterns)

### **Improvement 3: Validate AI Response**

**Current validation (Lines 1178-1200):** Check if sample transactions look real
**NEW validation:** Also check if column positions make sense:
- Date column should be leftmost (x < 150)
- Amount/Balance should be rightmost (x > 300)
- Description should be in the middle
- Column widths should be reasonable (not negative, not > 1000px)

---

## Implementation Plan

### **Step 1: Fix the Prompt (30 min)**

Remove hardcoded positions from lines 1064-1094.

New prompt structure:
```
"Look at this bank statement and extract 3 real transactions.
For each field (date, description, amount, balance), tell me:
1. The exact text you see
2. The pixel position where you found it

Don't guess - only report what you actually see in the image."
```

### **Step 2: Add Retry Logic (20 min)**

```python
def discover_layout_with_ai(image_path, sample_rows, attempt=1, max_attempts=3):
    try:
        # Try AI discovery
        schema = call_gpt4_vision(image_path, prompt_version=attempt)
        
        # Validate response
        if validate_schema(schema):
            return schema
        else:
            raise ValueError("Schema validation failed")
    
    except Exception as e:
        if attempt < max_attempts:
            print(f"⚠️  Attempt {attempt} failed, retrying...")
            return discover_layout_with_ai(image_path, sample_rows, attempt+1, max_attempts)
        else:
            raise ValueError(f"AI failed after {max_attempts} attempts")
```

### **Step 3: Add Schema Validation (15 min)**

```python
def validate_schema(schema):
    """Validate AI-discovered schema makes sense"""
    
    # Check required fields exist
    if 'columns' not in schema or 'sample_transactions' not in schema:
        return False
    
    # Check column positions are reasonable
    cols = schema['columns']
    
    # Date should be leftmost
    if cols['date']['x_min'] > 200:
        print(f"⚠️  Date column too far right: {cols['date']['x_min']}")
        return False
    
    # Amount should be right of description
    if cols['amount']['x_min'] < cols['description']['x_max']:
        print(f"⚠️  Amount column overlaps description")
        return False
    
    # Check sample transactions have real data
    samples = schema['sample_transactions']
    if len(samples) < 2:
        return False
    
    for sample in samples:
        # Check amount is not just "+" or "-"
        amount = str(sample.get('amount', ''))
        if len(amount) < 3 or amount in ['+', '-', 'None']:
            print(f"⚠️  Sample amount incomplete: '{amount}'")
            return False
    
    return True
```

---

## Testing Strategy

### **Test 1: Capital One (Currently Failing)**
```bash
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@statement-capital-one.pdf" \
  -F "auto_discover=true"
```

**Expected after fix:**
- AI discovers amount at x=680 (not x=385)
- AI discovers balance at x=820 (not x=495)
- Extracts 30+ transactions (not 0)

### **Test 2: Deutsche Bank (Currently Working)**
```bash
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@statement-deutsche-bank.pdf" \
  -F "auto_discover=true"
```

**Expected:** Still works (regression test)

### **Test 3: Unknown Bank**
```bash
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@statement-unknown-bank.pdf" \
  -F "auto_discover=true"
```

**Expected:**
- Attempt 1: Try discovery
- If fails, attempt 2: Different prompt
- If fails, attempt 3: Final attempt
- If still fails → Fallback to Tier 3 (user mapping)

---

## Success Criteria

✅ Capital One extracts 30+ transactions
✅ Deutsche Bank still works (100% accuracy)
✅ Chase still works (27 transactions)
✅ Unknown banks get 2-3 retry attempts before failing
✅ AI costs stay under $0.05 per statement (3 attempts max)

---

## If This Still Doesn't Fix Capital One

**Then we know:** GPT-4 Vision fundamentally can't read Capital One's layout reliably.

**Next step:** Implement Tier 3 (user mapping) and skip AI entirely for Capital One.

**Long-term:** Hardcode Capital One template and move on (like we did for Chase).
