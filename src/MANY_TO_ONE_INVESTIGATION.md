# Many-to-One Match Investigation

## Issue Reported
A many-to-one match was created with a large amount discrepancy:
- **Vendor transaction (visible)**: €399.72
- **AP Ledger**: €572.24
- **Difference**: €172.52 (30% gap!)
- **Badge**: Shows "2:1" indicating 2 vendor transactions

## Problem
The UI was only showing the PRIMARY vendor transaction, not the additional ones. This made it look like the match was incorrect.

## Root Cause
1. **Backend**: The `runAPReconciliation()` function correctly stores additional vendor transactions in `match.additional_vendor_transactions`
2. **UI**: The frontend was NOT displaying these additional transactions
3. **Result**: Users couldn't see why the match was created

## Investigation Steps

### 1. Check if Additional Transactions Exist
- ✅ Backend stores them in `additional_vendor_transactions: combo.slice(1)` (line 2523, 2593)
- ✅ Badge correctly shows count: `${(match.additional_vendor_transactions?.length || 0) + 1}:1`
- ❌ UI doesn't display them

### 2. Verify Matching Logic
The many-to-one matching uses:
- `findMatchingCombinations()` - subset-sum algorithm
- Tolerance for €572.24: **€1.00** (strict multi-entry tolerance)
- Accepts combos where `Math.abs(sum - targetAmount) <= tolerance`

**This means:** The match should ONLY exist if the sum of vendor transactions equals €572.24 ± €1.00

### 3. Possible Scenarios
**Scenario A:** There IS a second vendor transaction (~€172.52) that brings the total to ~€572.24
- ✅ This would be a VALID match
- ✅ But the UI needs to show it

**Scenario B:** The tolerance logic is broken and accepted an invalid match
- ❌ This would be a BUG in the subset-sum algorithm
- ⚠️ Needs verification via debug logs

## Solution Implemented

### 1. UI Enhancement - Display All Vendor Transactions
Added a new section in the expanded match details that shows:
- Primary vendor transaction (blue background)
- All additional vendor transactions (blue background)
- **Combined total** (dark blue background)

This gives users full transparency into many-to-one matches.

### 2. Debug Logging
Added comprehensive logging for many-to-one matches:
```typescript
console.log(`✅ MANY-TO-ONE MATCH: ${combo.length} vendor txns (Total: €${vendorTotal}) → 1 AP (€${apAmount})`);
console.log(`   Vendor txns: ${combo.map(v => v.description + v.amount).join(', ')}`);
console.log(`   AP: "${ap.description}" (€${ap.amount})`);
```

This will help us verify:
- How many vendor transactions are being combined
- The total amount of vendor transactions
- Whether the match is mathematically valid

## Next Steps

### To Verify the Match is Valid:
1. Run reconciliation with the same data
2. Check the server logs for many-to-one matches
3. Look for the log entry that shows this specific match
4. Verify that the vendor total equals €572.24 ± €1.00

### Expected Outcome:
```
✅ MANY-TO-ONE MATCH (Pass 1): 2 vendor txns (Total: €572.24) → 1 AP (€572.24)
   Vendor txns: "Professional services / supplies" (€399.72), "Office supplies purchase" (€172.52)
   AP: "Consolidated Invoice" (€572.24)
```

If the total DOESN'T match, then there's a bug in `findMatchingCombinations()`.

## Files Modified
1. `/components/devportal/workflows/APReconciliation.tsx`
   - Added many-to-one vendor transaction display (lines ~1577-1624)
   - Shows primary, additional, and combined total

2. `/supabase/functions/server/ap-rec-routes.tsx`
   - Added debug logging for many-to-one matches (Pass 1: ~2514, Pass 2: ~2583)

## Testing Instructions
1. Upload the vendor statement and AP ledger that created this match
2. Run reconciliation
3. Check the server logs for `✅ MANY-TO-ONE MATCH`
4. Verify the vendor total matches the AP amount
5. Expand the match in the UI
6. Verify ALL vendor transactions are now visible

## Status
- ✅ UI enhancement complete
- ✅ Debug logging added
- ⏳ Awaiting verification from server logs
- 📋 May need to adjust tolerance if matches are too loose

## Version
- Phase: 3.1.2 Many-to-One Investigation
- Date: 2025-12-31
- Status: 🔍 Under Investigation
