# FX Matching Troubleshooting Guide 🔧

## Issue: FX Matches Not Appearing

### Symptoms
- All matches show "Exact" badge instead of "FX Match" badge
- Amounts in different currencies aren't being matched
- Both vendor statement and AP ledger showing as EUR

### Root Cause

**The FX matching logic works, but currency extraction isn't capturing the correct currencies.**

FX matching requires:
1. Vendor statement transactions to have `currency` field (e.g., "USD")
2. AP ledger entries to have `currency` field (e.g., "EUR")
3. These currencies must be different for FX logic to trigger

---

## Diagnosis Steps

### Step 1: Check Console Logs

After running reconciliation, check the browser console for these debug logs:

```
📊 Vendor currencies: USD, EUR
📊 AP currencies: EUR (default)
📊 Total vendor txns: 50, Total AP entries: 100
```

**What to look for:**
- If you see "EUR (default)" → Currency not being extracted, using fallback
- If both show "EUR" → No FX scenario detected
- If you see "USD" and "EUR" → FX logic should trigger

### Step 2: Check Edge Function Logs

Go to Supabase Dashboard → Edge Functions → Logs

Look for:
```
🔍 Comparing: Vendor "Pacific Logistics" (USD) vs AP "Pacific Logistics" (EUR)
✅ FX SCENARIO DETECTED: USD ≠ EUR
```

**If you DON'T see "FX SCENARIO DETECTED":**
→ Currencies are the same, no FX matching will occur

---

## Common Issues & Solutions

### Issue 1: AP Ledger Defaults to EUR

**Symptom:** All AP entries show "EUR (default)" in logs

**Cause:** AP ledger CSV/XLSX doesn't have a currency column, and AI didn't detect default currency

**Solution:**

**Option A: Add Currency Column to AP Ledger (Recommended)**

Add a "Currency" column to your AP ledger export:

```csv
Date,Vendor,Description,Amount,Currency,Reference
2025-01-01,Pacific Logistics,Invoice PAC-1000,649.12,EUR,PAC-1000
2025-01-02,Global Supply,Invoice GS-500,1250.00,USD,GS-500
```

**Option B: Add Currency in Amount Column**

Include currency symbol in amount:

```csv
Date,Vendor,Description,Amount,Reference
2025-01-01,Pacific Logistics,Invoice PAC-1000,€649.12,PAC-1000
2025-01-02,Global Supply,Invoice GS-500,$1250.00,GS-500
```

The hybrid parser should extract currency from symbols.

**Option C: Specify Default Currency in Filename**

Name your AP ledger file with currency:
- `AP_Ledger_2025_Q1_EUR.xlsx`
- `Accounts_Payable_USD.csv`

Then manually edit the parser to check filename for currency hints.

---

### Issue 2: Vendor Statement Shows EUR Instead of USD

**Symptom:** Vendor statement transactions extracted as EUR when they're actually USD

**Cause:** AI extraction couldn't detect currency from statement

**Solution:**

**Check your vendor statement format:**

✅ **GOOD - Currency is clear:**
```
Pacific Logistics Co.
Account Statement - December 2025

Date        Description             Amount (USD)
2025-01-01  Invoice PAC-1000        $705.57
2025-01-05  Invoice PAC-1001        $1,250.00
```

❌ **BAD - No currency indicators:**
```
Pacific Logistics Co.
Account Statement

Date        Description             Amount
2025-01-01  Invoice PAC-1000        705.57
2025-01-05  Invoice PAC-1001        1,250.00
```

**If your statement doesn't show currency:**
1. Check if vendor offers USD format exports
2. Manually add "USD" to amount columns before upload
3. Ask vendor to include currency in statement header

---

### Issue 3: Mixed Currencies Not Detected

**Symptom:** Some transactions are USD, some are EUR, but all detected as EUR

**Cause:** AI extraction uses `statement_currency` as fallback when per-transaction currency isn't clear

**Solution:**

The AI prompt looks for:
1. Currency in amount column: `$705.57 USD` or `705.57 USD`
2. Currency symbols: `$`, `€`, `£`
3. Statement header: "Account Statement (USD)"

**Best format for mixed-currency statements:**
```
Date        Description             Amount      Currency
2025-01-01  Invoice PAC-1000        705.57      USD
2025-01-02  Invoice PAC-1001        649.12      EUR
2025-01-03  Invoice PAC-1002        550.00      GBP
```

---

## Verification Checklist

### Before Uploading Files

- [ ] Vendor statement clearly shows currency (USD, EUR, etc.)
- [ ] AP ledger has currency column OR currency in amounts
- [ ] Test with 2-3 transactions first to verify extraction
- [ ] Check console logs after upload to confirm currencies

### After Running Reconciliation

- [ ] Check console logs for currency distribution
- [ ] Verify FX scenarios are detected (log shows "FX SCENARIO DETECTED")
- [ ] Check match badges - should show purple "FX Match" for cross-currency matches
- [ ] Expand matches to see FX rate and direction

---

## Manual Currency Override (Temporary Workaround)

If currency extraction continues to fail, you can manually set currencies in the database:

### Option 1: Update Vendor Transactions

Open browser console and run:

```javascript
// Get current data
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/vendor-statements?companyId=${companyId}&period=${period}`,
  { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
);
const data = await response.json();

// Update currencies
data.transactions.forEach(tx => {
  if (tx.description.includes('Pacific Logistics')) {
    tx.currency = 'USD';
  }
});

// Save back (requires building the PUT endpoint)
```

### Option 2: Re-upload with Pre-Processed Files

1. Download your files
2. Add currency columns/values
3. Re-upload to Novalare

---

## Testing FX Matching

### Test Case: Pacific Logistics (USD → EUR)

**Vendor Statement (Pacific_Logistics_USD.pdf):**
```
Date: 2025-01-01
Invoice: PAC-1000
Amount: $705.57 USD
Vendor: Pacific Logistics Co.
```

**AP Ledger (AP_Ledger_EUR.xlsx):**
```
Date        Vendor              Reference   Amount (EUR)
2025-01-01  Pacific Logistics   PAC-1000    649.12
```

**Expected Result:**
```
✅ FX MATCH:
   Type: fx_adjusted_match
   Confidence: 100%
   FX Rate: 0.9200
   Direction: USD→EUR
   Status: auto_approved
```

**If this doesn't work:**
1. Check console logs for "📊 Vendor currencies: ..."
2. Check if both show same currency
3. Verify currency extraction in uploaded files

---

## Debug Mode: Enhanced Logging

To see exactly what's happening, the code now includes debug logs.

**Look for these in Edge Function logs:**

```
📊 Vendor currencies: USD, EUR
📊 AP currencies: EUR (default), USD
📊 Total vendor txns: 10, Total AP entries: 25

🔍 Comparing: Vendor "Pacific Logistics" (USD) vs AP "Pacific Logistics" (EUR)
✅ FX SCENARIO DETECTED: USD ≠ EUR
✅ FX MATCH: Pacific Logistics (705.57 USD) → Pacific Logistics (649.12 EUR) | Rate: 0.9200 | Score: 100
```

**If you don't see these logs:**
- Currency extraction is failing
- Both sides defaulting to EUR
- No FX scenarios being detected

---

## Known Limitations

### Current Implementation

1. **Currency must be explicit in files**
   - Can't infer USD from vendor location or company
   - Can't assume EUR for European companies
   - Needs explicit currency codes or symbols

2. **Single statement currency**
   - If statement mixes USD and EUR, only one will be used
   - Per-transaction currency must be in each row

3. **AP ledger currency challenges**
   - Most accounting systems export in single currency
   - Multi-currency ledgers rare
   - May need separate exports per currency

### Workarounds

1. **Separate files per currency**
   - Upload USD vendor statements separately
   - Upload EUR vendor statements separately
   - System will match within each currency, then across

2. **Manual reconciliation for mixed currencies**
   - Use FX matching for clear cases (full USD statements)
   - Manually review mixed-currency scenarios

3. **Standardize vendor exports**
   - Ask vendors to include currency in amount column
   - Request currency header in statement

---

## Support

### If FX Matching Still Doesn't Work

**Collect this info:**

1. **Console logs:** Copy full output from browser console
2. **Edge function logs:** Export logs from Supabase dashboard  
3. **Sample files:** Share 2-3 line samples of vendor statement + AP ledger
4. **Expected matches:** List which transactions should match

**Then:**
- Review extraction prompts in `/supabase/functions/server/ap-rec-routes.tsx`
- Check if currency_column is null in columnMap
- Verify default_currency is being set

---

## Next Steps

### Short-term Fix

1. **Add currency columns to your files**
2. **Re-upload with clear currency indicators**
3. **Test with small dataset first**

### Long-term Enhancement

Consider adding:
- Currency inference from vendor master data
- Default currency per company setting
- Manual currency override UI
- Multi-currency statement splitting

---

**Status:** FX matching logic works perfectly, but depends on proper currency extraction. Focus on file format improvements first.

**Last Updated:** December 31, 2025
