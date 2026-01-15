# 🏗️ Template Architecture - Scalable Bank Support

## Overview

The extraction API now uses a **modular template system** that scales to 100+ banks and supports user-learned templates (Tier 3).

---

## Directory Structure

```
python-extraction-server/
├── app.py                         # Main Flask API (cleaner, ~1200 lines)
├── template_loader.py             # Template management system
├── templates/
│   ├── built_in/                  # Official bank templates
│   │   ├── capital_one.json
│   │   ├── chase.json
│   │   ├── deutsche_bank.json
│   │   ├── bank_of_america.json  # ← Add new banks here
│   │   └── wells_fargo.json
│   └── user_learned/              # User-contributed templates (Tier 3)
│       ├── README.md
│       └── my_credit_union.json   # ← Saved when user trains system
└── test_loader.sh                 # Test template loading
```

---

## Template Format

Each bank is defined as a JSON file:

```json
{
  "bank_key": "capital_one",
  "bank_name": "Capital One",
  "version": "1.1",
  "created_by": "system",
  "last_updated": "2024-12-22",
  "description": "Capital One 360 Checking - Apr 1 date format",
  
  "statement_model": "running_balance",
  "currency": "USD",
  
  "columns": {
    "date": {
      "x_min": 70,
      "x_max": 105,
      "note": "Month name format: 'Apr 1', 'Jan 15'"
    },
    "description": {
      "x_min": 125,
      "x_max": 500,
      "note": "Full transaction description"
    },
    "amount": {
      "x_min": 510,
      "x_max": 580,
      "note": "Signed amounts: +$3,000.00 or -$2,000.00"
    },
    "balance": {
      "x_min": 640,
      "x_max": 710,
      "note": "Running balance after transaction"
    }
  },
  
  "transaction_start_markers": ["DATE", "DESCRIPTION"],
  "date_format": "MMM D",
  "has_balance_column": true,
  "multiline_descriptions": false,
  
  "detection_keywords": [
    "capital one",
    "capitalone"
  ],
  
  "notes": [
    "Fixed 2024-12-22: Moved amount column from 660px to 510px",
    "Added support for month name dates"
  ]
}
```

---

## How It Works

### 1. **Template Loading (Startup)**

```python
# In app.py
from template_loader import load_all_templates

BANK_TEMPLATES = load_all_templates()
```

**What happens:**
1. Scans `/templates/built_in/*.json`
2. Scans `/templates/user_learned/*.json`
3. Validates each template (required fields, column definitions)
4. User-learned templates **override** built-in if same `bank_key`
5. Returns dictionary: `{bank_key: template_data}`

**Output:**
```
📂 Loading bank templates...
  ✅ Loaded built-in: Capital One (capital_one)
  ✅ Loaded built-in: Chase (chase)
  ✅ Loaded built-in: Deutsche Bank (deutsche_bank)
✅ Loaded 3 built-in templates + 0 user-learned templates
📋 Available banks: capital_one, chase, deutsche_bank
```

---

### 2. **Bank Detection (Per PDF)**

```python
# In app.py
bank_key = detect_bank_from_pdf(pdf_path)
```

**What happens:**
1. Extracts first page text
2. Checks **user-learned templates first** (higher priority)
3. Then checks built-in templates
4. Matches against `detection_keywords`
5. Returns `bank_key` or `None`

**Priority:**
1. 🥇 User-learned templates
2. 🥈 Built-in templates
3. 🥉 Fallback to Chase baseline

---

### 3. **Template Usage (Extraction)**

```python
template = BANK_TEMPLATES.get(bank_key)
columns = template['columns']

# Extract data using column positions
date = extract_text_in_range(row, columns['date']['x_min'], columns['date']['x_max'])
amount = extract_text_in_range(row, columns['amount']['x_min'], columns['amount']['x_max'])
```

---

## Adding New Banks

### Method 1: Create JSON File Manually

1. Create `/templates/built_in/bank_name.json`
2. Define columns using `/diagnose-columns` endpoint
3. Restart server → Template auto-loads!

### Method 2: Use Diagnostic Tool

```bash
# 1. Diagnose the PDF
curl -X POST http://127.0.0.1:8000/diagnose-columns \
  -F "file=@statement.pdf" \
  | python3 -m json.tool > diagnosis.json

# 2. Review diagnosis.json to find x-coordinates
# 3. Create template with correct positions
# 4. Save to /templates/built_in/bank_name.json
```

### Method 3: Tier 3 Manual Mapping (Future)

1. User uploads unknown bank statement
2. User clicks 2-3 sample transactions
3. System learns column positions
4. **Saves to `/templates/user_learned/`**
5. Next upload → Uses learned template instantly!

---

## API Endpoints

### **GET /templates**
List all available templates

**Response:**
```json
{
  "success": true,
  "count": 3,
  "templates": [
    {
      "bank_key": "capital_one",
      "bank_name": "Capital One",
      "source": "built-in",
      "version": "1.1",
      "currency": "USD",
      "statement_model": "running_balance"
    },
    {
      "bank_key": "chase",
      "bank_name": "Chase",
      "source": "built-in",
      "version": "1.0",
      "currency": "USD",
      "statement_model": "running_balance"
    }
  ]
}
```

### **GET /templates/{bank_key}**
Get detailed template information

**Example:** `GET /templates/capital_one`

**Response:**
```json
{
  "success": true,
  "template": {
    "bank_key": "capital_one",
    "bank_name": "Capital One",
    "columns": {
      "date": {"x_min": 70, "x_max": 105},
      "amount": {"x_min": 510, "x_max": 580}
    },
    "detection_keywords": ["capital one"]
  }
}
```

---

## Benefits

### ✅ **Scalability**
- Add new banks by dropping in JSON file
- No code changes needed
- Scales to 100+ banks easily

### ✅ **Maintainability**
- Each bank isolated in separate file
- Version control per bank
- Easy to update individual templates

### ✅ **User Templates (Tier 3)**
- Users teach system new banks
- Templates saved automatically
- Shared across team/organization

### ✅ **Clean Code**
- `app.py` reduced from 1700+ to ~1200 lines
- Template logic separated
- Single responsibility principle

### ✅ **Priority System**
- User templates override built-in
- Organization-specific customizations
- A/B testing capabilities

---

## Testing

### **Test Template Loader**

```bash
cd python-extraction-server
python3 template_loader.py
```

**Expected output:**
```
======================================================================
TESTING TEMPLATE LOADER
======================================================================
📂 Loading bank templates...
  ✅ Loaded built-in: Capital One (capital_one)
  ✅ Loaded built-in: Chase (chase)
  ✅ Loaded built-in: Deutsche Bank (deutsche_bank)
✅ Loaded 3 built-in templates + 0 user-learned templates

📋 Available Templates:

  🏦 Capital One
     Key: capital_one
     Source: built-in
     Version: 1.1
     Model: running_balance
     Currency: USD

  🏦 Chase
     Key: chase
     Source: built-in
     Version: 1.0
     Model: running_balance
     Currency: USD
```

### **Test Template API**

```bash
# List all templates
curl http://127.0.0.1:8000/templates | python3 -m json.tool

# Get specific template
curl http://127.0.0.1:8000/templates/capital_one | python3 -m json.tool
```

---

## Next Steps

### **Immediate (v3.1)**
1. ✅ Capital One template working
2. ⏳ Test Chase template (already defined)
3. ⏳ Add Bank of America template
4. ⏳ Add Wells Fargo template

### **Short-term (v3.2)**
1. ⏳ Add 10 most popular US banks
2. ⏳ Add 5 most popular European banks
3. ⏳ Template marketplace (community contributions)

### **Long-term (v4.0 - Tier 3)**
1. ⏳ Manual mapping UI
2. ⏳ Auto-save user templates
3. ⏳ Template sharing/export
4. ⏳ Template versioning system

---

## Migration Guide

**Old way (hardcoded in app.py):**
```python
BANK_TEMPLATES = {
    "capital_one": {...},  # 15 lines each
    "chase": {...},        # x20 banks = 300 lines!
}
```

**New way (JSON files):**
```bash
templates/built_in/capital_one.json  # 50 lines
templates/built_in/chase.json        # 50 lines
# Add 100 more banks = just add files!
```

**Benefits:**
- ✅ Cleaner code
- ✅ Git history per bank
- ✅ User contributions via PR
- ✅ No restart needed (hot-reload possible)

---

**🚀 Architecture is now scalable to 100+ banks!**
