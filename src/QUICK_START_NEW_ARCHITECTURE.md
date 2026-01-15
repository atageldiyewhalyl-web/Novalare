# 🚀 Quick Start - New Template Architecture

## TL;DR

Your extraction API now uses **modular JSON templates** instead of hardcoded Python dictionaries. This makes it scalable to 100+ banks and ready for Tier 3 user-learned templates!

---

## What You Need to Know

### **1. Templates are now separate JSON files**

```bash
templates/
├── built_in/
│   ├── capital_one.json    # ✅ Fixed column positions
│   ├── chase.json          # ✅ Verified working
│   └── deutsche_bank.json  # ✅ Soll/Haben model
└── user_learned/
    └── (empty - ready for Tier 3)
```

### **2. Add new banks by creating JSON files**

No more editing `app.py`! Just create a JSON file:

```bash
# Copy an existing template
cp templates/built_in/chase.json templates/built_in/wells_fargo.json

# Edit the columns
vim templates/built_in/wells_fargo.json

# Restart server → Auto-loads!
```

### **3. User templates override built-in**

```
Priority:
1. 🥇 templates/user_learned/*.json (highest)
2. 🥈 templates/built_in/*.json
3. 🥉 AI discovery (creates user template)
```

---

## Testing (3 Commands)

### **1. Test Template Loader**

```bash
cd python-extraction-server
python3 template_loader.py
```

**Expected:**
```
📂 Loading bank templates...
  ✅ Loaded built-in: Capital One (capital_one)
  ✅ Loaded built-in: Chase (chase)
  ✅ Loaded built-in: Deutsche Bank (deutsche_bank)
✅ Loaded 3 built-in templates + 0 user-learned templates
```

---

### **2. Start Server**

```bash
pkill -f "python.*app.py"  # Kill old server
cd python-extraction-server
python3 app.py
```

**Expected:**
```
📂 Loading bank templates...
  ✅ Loaded built-in: Capital One (capital_one)
  ✅ Loaded built-in: Chase (chase)
  ✅ Loaded built-in: Deutsche Bank (deutsche_bank)
 * Running on http://127.0.0.1:8000
```

---

### **3. Test Capital One Extraction**

```bash
curl -X POST http://127.0.0.1:8000/extract-with-schema \
  -F "file=@/Users/halyl.atageldiyev/Downloads/statement (5).pdf" \
  -F "auto_discover=false" \
| python3 -m json.tool
```

**Expected:**
```json
{
  "success": true,
  "bank": "Capital One",
  "count": 30,  // ← Should be 30+ (not 3!)
  "transactions": [
    {
      "date": "2022-04-01",
      "description": "Zelle money received from MUHAMMED EMIN BALA",
      "amount": 3000.0,
      "balance": 189832.04
    },
    // ... 29 more transactions
  ]
}
```

---

## New API Endpoints

### **GET /templates**

List all available templates:

```bash
curl http://127.0.0.1:8000/templates | python3 -m json.tool
```

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
      "version": "1.1"
    }
  ]
}
```

---

### **GET /templates/{bank_key}**

Get specific template details:

```bash
curl http://127.0.0.1:8000/templates/capital_one | python3 -m json.tool
```

---

## Adding New Banks

### **Method 1: Use Diagnostic Tool**

```bash
# 1. Find column positions
curl -X POST http://127.0.0.1:8000/diagnose-columns \
  -F "file=@bank_of_america_statement.pdf" \
  | python3 -m json.tool > diagnosis.json

# 2. Create template with correct x-coordinates
cat > templates/built_in/bank_of_america.json << 'EOF'
{
  "bank_key": "bank_of_america",
  "bank_name": "Bank of America",
  "columns": {
    "date": {"x_min": 40, "x_max": 100},
    "description": {"x_min": 110, "x_max": 400},
    "amount": {"x_min": 410, "x_max": 480},
    "balance": {"x_min": 490, "x_max": 560}
  },
  "detection_keywords": ["bank of america", "bofa"]
}
EOF

# 3. Restart server
pkill -f "python.*app.py" && python3 app.py
```

---

### **Method 2: Copy Existing Template**

```bash
# Copy Chase template
cp templates/built_in/chase.json templates/built_in/wells_fargo.json

# Edit with correct positions
vim templates/built_in/wells_fargo.json

# Restart server
pkill -f "python.*app.py" && python3 app.py
```

---

## Tier 3 Preview (Coming Soon)

When user uploads unknown bank:

```
1. User uploads PDF → No template found
2. System shows: "Click on 2-3 sample transactions"
3. User clicks → System learns column positions
4. System saves to templates/user_learned/my_bank.json
5. Future uploads → Uses saved template instantly!
```

**Template saved automatically:**
```json
{
  "bank_key": "my_credit_union",
  "bank_name": "My Local Credit Union",
  "created_by": "user",
  "user_id": "user_12345",
  "learned_from_file": "statement_2024_12.pdf",
  "columns": {...}
}
```

---

## Documentation

| File | Description |
|------|-------------|
| `/python-extraction-server/TEMPLATE_ARCHITECTURE.md` | Complete architecture guide |
| `/python-extraction-server/ARCHITECTURE_DIAGRAM.txt` | Visual diagrams |
| `/ARCHITECTURE_MIGRATION_COMPLETE.md` | Migration summary |
| `/templates/user_learned/README.md` | Tier 3 documentation |

---

## What Changed in Code

### **Before:**

```python
# In app.py (1700 lines)
BANK_TEMPLATES = {
    "capital_one": {
        "columns": {...},
        # ... 15 lines
    },
    "chase": {...},
    # ... 300 lines of templates
}
```

### **After:**

```python
# In app.py (1200 lines)
from template_loader import load_all_templates

BANK_TEMPLATES = load_all_templates()  # ← One line!
```

**Result:**
- 500 lines removed from `app.py`
- Templates in separate JSON files
- Scales to 100+ banks
- Ready for Tier 3

---

## Success Checklist

Test these to verify migration worked:

- [ ] `python3 template_loader.py` shows 3 templates loaded
- [ ] Server starts without errors
- [ ] `GET /templates` returns 3 templates
- [ ] Capital One extraction returns 30+ transactions (not 3)
- [ ] Chase extraction still works (27 transactions)
- [ ] Template files exist in `/templates/built_in/`

---

## Next Steps

1. ✅ **Test Capital One** - Verify fix worked (30+ transactions)
2. ⏳ **Add Bank of America** - Create template JSON
3. ⏳ **Add Wells Fargo** - Create template JSON
4. ⏳ **Fix AI prompt** - Remove hardcoded columns (200, 300, 500)
5. ⏳ **Implement Tier 3** - User mapping → Auto-save templates

---

## Support

**If templates don't load:**
```bash
# Check for JSON syntax errors
python3 -m json.tool templates/built_in/capital_one.json
```

**If extraction fails:**
```bash
# Use diagnostic tool
curl -X POST http://127.0.0.1:8000/diagnose-columns \
  -F "file=@statement.pdf" \
  | python3 -m json.tool
```

**If server won't start:**
```bash
# Check logs
tail -f /tmp/extraction-server.log
```

---

**🚀 READY TO SCALE TO 100+ BANKS!**

Test Capital One extraction now and let me know if you get 30+ transactions! 🎉
