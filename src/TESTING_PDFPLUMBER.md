# 🧪 Testing pdfplumber Bank Statement Extractor

## 🎯 Goal
Test if pdfplumber can extract transactions from bank statement PDFs with 100% accuracy (no random text, just clean transactions).

## 🚀 Quick Start (3 commands)

```bash
# 1. Check if everything is installed
cd supabase/functions/server
python3 check_setup.py

# 2. Install pdfplumber (if needed)
pip3 install pdfplumber

# 3. Test with your bank statement
python3 test_pdfplumber.py ~/Downloads/your_statement.pdf
```

## 📊 What You'll See

### ✅ **SUCCESS - Clean Extraction**
```
✅ Extracted 1,247 transactions!

#    Date         Description                                Amount      Balance
1    2024-04-17   Online Transfer From Sav ...0386            $30.00      $105.36
2    2024-04-17   Zelle Payment To Chrissy                   -$53.00       $52.36
3    2024-04-17   Planet Fit Club Fees                       -$16.58       $35.78
```
**This is PERFECT!** ✨ Only real transactions, no junk!

### ❌ **FAILURE - Random Text**
```
✅ Extracted 234 transactions!

#    Date         Description                                Amount      Balance
1    2024-04-17   An overdraft occurs when you do not...      $0.00       $105.36
2    2024-04-17   appeared. Be prepared to give us...        -$53.00       $52.36
3    2024-04-17   Just "Transaction" (not a real...)         -$16.58       $35.78
```
**This is BROKEN!** ❌ Extracting headers/terms, not transactions.

## 🔍 What to Check

### 1. **Transaction Count**
- Count rows in PDF manually (ballpark)
- Does extracted count match?
- ✅ 1,200 transactions expected → 1,247 extracted ≈ GOOD
- ❌ 1,200 transactions expected → 47 extracted = BAD

### 2. **Description Quality**
- ✅ "Zelle Payment To Chrissy" = Real transaction
- ✅ "Planet Fit Club Fees" = Real transaction
- ❌ "An overdraft occurs when..." = Random text
- ❌ "Transaction" = Header, not description

### 3. **Amounts**
- ✅ $30.00, -$53.00, -$16.58 = Reasonable amounts
- ❌ $0.00 for everything = Something's wrong
- ✅ Check a few against PDF manually

### 4. **Balance Validation**
- ✅ "Balance validation PASSED! ✨" = PERFECT
- ❌ "Balance mismatch: $5,432.10" = Something wrong

### 5. **Date Format**
- ✅ 2024-04-17 (YYYY-MM-DD) = Correct
- ❌ "04/17" only = Missing year
- ❌ "Transaction Date" = Extracted header

## 📁 Test Files

The scripts are located in: `supabase/functions/server/`

```
supabase/functions/server/
├── extract_bank_table.py      ← Main extraction script
├── test_pdfplumber.py         ← Test runner (use this!)
├── check_setup.py             ← Verify installation
├── requirements.txt           ← Dependencies
├── LOCAL_TESTING.md           ← Detailed guide
└── README_EXTRACTION.md       ← All extraction methods
```

## 🎯 Decision Tree

```
Test pdfplumber extraction
├─ ✅ Works perfectly (clean transactions, correct amounts)
│  └─ 🚀 DEPLOY to server with Python support
│     ├─ AWS EC2 with Python
│     ├─ Google Cloud Run (Python runtime)
│     ├─ DigitalOcean Droplet
│     └─ Your own VPS
│
└─ ❌ Doesn't work (random text, wrong amounts)
   └─ 💡 Use cloud-based extraction instead
      ├─ Google Document AI (recommended, $0.015 per statement)
      └─ OpenAI GPT-4 Vision ($0.10 per statement)
```

## 💻 Installation

### macOS
```bash
# Install Python (if not installed)
brew install python3

# Install pdfplumber
pip3 install pdfplumber
```

### Ubuntu/Debian
```bash
# Install Python
sudo apt-get update
sudo apt-get install python3 python3-pip

# Install pdfplumber
pip3 install pdfplumber
```

### Windows
```bash
# Install Python from python.org
# Then:
pip install pdfplumber
```

## 🧪 Test Commands

```bash
cd supabase/functions/server

# 1. Verify setup
python3 check_setup.py

# 2. Test with your bank statement
python3 test_pdfplumber.py ~/Downloads/chase_statement.pdf

# 3. Check the JSON output
cat ~/Downloads/chase_statement_extracted.json | python3 -m json.tool | head -50
```

## 📊 Example Output

### **Good Extraction** ✅
```json
{
  "success": true,
  "transactions": [
    {
      "date": "2024-04-17",
      "description": "Online Transfer From Sav ...0386 Transaction#: 2444249040404",
      "amount": 30.0,
      "balance": 105.36
    },
    {
      "date": "2024-04-17",
      "description": "Zelle Payment To Chrissy Chris Jpm99B551Fbg",
      "amount": -53.0,
      "balance": 52.36
    },
    {
      "date": "2024-04-17",
      "description": "Planet Fit Club Fees PPD ID: 1710602737",
      "amount": -16.58,
      "balance": 35.78
    }
  ],
  "count": 1247
}
```

### **Bad Extraction** ❌
```json
{
  "success": true,
  "transactions": [
    {
      "date": "2024-04-17",
      "description": "An overdraft occurs when you do not have enough...",
      "amount": 0.0,
      "balance": null
    }
  ],
  "count": 23
}
```

## 🎉 Success Criteria

pdfplumber is **READY FOR PRODUCTION** if:

- ✅ Extracts **ALL** transactions (count matches PDF)
- ✅ **NO** random text (headers, terms, explanations)
- ✅ **Correct** amounts (verify against PDF)
- ✅ **Valid** dates (YYYY-MM-DD format)
- ✅ **Balance validation passes** (if balances present)
- ✅ **Faster** than AI methods (<2 seconds)
- ✅ **FREE** (no API costs)

If **ANY** criterion fails → Use Google Document AI or OpenAI instead.

## 🚀 Next Steps After Testing

### If pdfplumber works:
1. ✅ You've proven it's the best solution!
2. 📋 Document which bank formats work
3. 🚀 Deploy to a server with Python:
   ```bash
   # On your server:
   pip3 install -r requirements.txt
   
   # Deploy these files:
   - extract_bank_table.py
   - requirements.txt
   - bank-rec-heuristic.tsx
   ```
4. 🔧 Update extraction method default to "heuristic"

### If pdfplumber doesn't work:
1. ❌ No worries, cloud methods work great!
2. 💡 Keep using Google Document AI (recommended)
3. 🔧 Remove "heuristic" option from UI
4. 📊 Results will still be excellent!

## 📝 Report Your Results

After testing, please share:

1. **Bank name**: Chase, BofA, Wells Fargo, etc.
2. **Pages**: How many pages in the PDF?
3. **Transactions**: How many were extracted?
4. **Quality**: ✅ Clean or ❌ Random text?
5. **Balance validation**: ✅ Passed or ❌ Failed?
6. **Speed**: How long did it take?

This helps determine if pdfplumber is production-ready! 🎯

---

**Ready to test?** Run: `python3 test_pdfplumber.py <your_pdf>`
