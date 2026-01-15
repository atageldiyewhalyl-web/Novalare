# 🧪 Local Testing Guide for pdfplumber Extraction

This guide will help you test the pdfplumber bank statement extractor on your local machine.

## 📋 Prerequisites

1. **Python 3.7+** installed
   ```bash
   python3 --version
   # Should show: Python 3.7.x or higher
   ```

2. **pip** (Python package installer)
   ```bash
   pip3 --version
   ```

## 🚀 Quick Start (5 minutes)

### Step 1: Install pdfplumber

```bash
# Option A: Install directly
pip3 install pdfplumber

# Option B: Install from requirements file
cd /path/to/your/project/supabase/functions/server
pip3 install -r requirements.txt
```

### Step 2: Test with your bank statement

```bash
cd /path/to/your/project/supabase/functions/server

# Run the test script with your PDF
python3 test_pdfplumber.py ~/Downloads/your_bank_statement.pdf
```

### Expected Output:

```
================================================================================
            PDF BANK STATEMENT EXTRACTOR TEST
================================================================================

✅ pdfplumber is installed (version: 0.11.0)
✅ Found PDF: /Users/you/Downloads/chase_statement.pdf
ℹ️  File size: 0.45 MB

================================================================================
                        RUNNING EXTRACTION
================================================================================

📄 Processing 31 pages...

📃 Page 1:
  ✅ Found 1 tables

  📊 Table 1 (45 rows):
    Row 0: ['Date', 'Description', 'Amount', 'Balance']
    Row 1: ['04/17', 'Online Transfer From Sav ...0386', '30.00', '105.36']
    Row 2: ['04/17', 'Zelle Payment To Chrissy', '-53.00', '52.36']
  
  ✅ Header found at row 0
     Headers: ['Date', 'Description', 'Amount', 'Balance']
     Column map: {'date': 0, 'description': 1, 'amount': 2, 'balance': 3}
  
  ✅ Extracted 43 transactions from this table

... (more pages) ...

✅ TOTAL: 1,247 transactions extracted

================================================================================
                        EXTRACTION RESULTS
================================================================================

✅ Extracted 1,247 transactions!

First 10 transactions:

#    Date         Description                                        Amount      Balance
--------------------------------------------------------------------------------------------
1    2024-04-17   Online Transfer From Sav ...0386                    $30.00      $105.36
2    2024-04-17   Zelle Payment To Chrissy Chris Jpm99B551Fbg        -$53.00       $52.36
3    2024-04-17   Planet Fit Club Fees PPD ID: 1710602737            -$16.58       $35.78
...

================================================================================
                             SUMMARY
================================================================================

Total transactions: 1,247
Total debits:  -$45,678.23
Total credits: $52,341.89
Net change:    $6,663.66

Balance validation:
Starting balance: $2,500.00
Ending balance:   $9,163.66
Calculated:       $9,163.66
✅ Balance validation PASSED! ✨

✅ Saved results to: /Users/you/Downloads/chase_statement_extracted.json

================================================================================
                          TEST COMPLETE
================================================================================

✅ pdfplumber extraction works! 🎉
ℹ️  If the results look good, you can deploy to a server with Python support.
```

## 📊 What to Look For

### ✅ **Good Signs:**
- Extracted transaction count matches your statement
- Dates are parsed correctly (YYYY-MM-DD format)
- Descriptions are clean (no random text like "An overdraft occurs...")
- Amounts are correct (match the PDF)
- Balance validation passes

### ❌ **Bad Signs:**
- Extracting random text/headers/terms instead of transactions
- Wrong amounts or dates
- Missing transactions
- Balance validation fails

## 🔍 Troubleshooting

### Issue: "No tables found"
**Cause:** PDF doesn't have a table structure, or it's an image-based PDF  
**Solution:** Use OpenAI GPT-4 Vision extraction instead

### Issue: "Wrong amounts extracted"
**Cause:** Unusual table format (e.g., debit/credit columns, no borders)  
**Solution:** Check the debug output - pdfplumber shows what it detected

### Issue: "pdfplumber not installed"
**Solution:**
```bash
pip3 install pdfplumber
# OR
pip3 install --user pdfplumber
```

### Issue: Permission denied
**Solution:**
```bash
chmod +x test_pdfplumber.py
```

## 🎯 Next Steps

### If extraction works perfectly:
1. ✅ You've proven pdfplumber is the best solution!
2. 🚀 Deploy to a server with Python support:
   - AWS EC2 with Python
   - Google Cloud Run with Python runtime
   - DigitalOcean Droplet
   - Heroku with Python buildpack
   - Your own VPS

3. 📦 Include in deployment:
   - `extract_bank_table.py`
   - `requirements.txt`
   - Install: `pip3 install -r requirements.txt`

### If extraction has issues:
1. Share the debug output (pdfplumber shows what tables it found)
2. We can tweak the table detection settings
3. Or fall back to Google Document AI / OpenAI

## 💡 Pro Tips

1. **Test with multiple bank formats:**
   - Chase, Bank of America, Wells Fargo, etc.
   - Each bank has slightly different formats
   - pdfplumber usually handles them all!

2. **Check the JSON output:**
   - The script saves `*_extracted.json`
   - This is exactly what the API will return
   - Perfect for debugging!

3. **Compare with the PDF:**
   - Open the PDF side-by-side
   - Verify first/last transactions match
   - Check a few random ones in the middle

## 📝 Example Test Files

Try these test cases:

```bash
# Test with your actual bank statement
python3 test_pdfplumber.py ~/Downloads/chase_april_2024.pdf

# Test with a large statement (1000+ transactions)
python3 test_pdfplumber.py ~/Downloads/annual_statement.pdf

# Test with different banks
python3 test_pdfplumber.py ~/Downloads/bofa_statement.pdf
python3 test_pdfplumber.py ~/Downloads/wells_fargo.pdf
```

## 🎉 Success Criteria

**pdfplumber is ready for production if:**
- ✅ Extracts 100% of transactions correctly
- ✅ Handles your specific bank's format
- ✅ Running balance validation passes
- ✅ No random text/headers/terms in results
- ✅ Faster than AI methods (typically <2 seconds)

Then deploy with confidence! 🚀

---

**Questions?** The script provides detailed debug output. Check the console logs!
