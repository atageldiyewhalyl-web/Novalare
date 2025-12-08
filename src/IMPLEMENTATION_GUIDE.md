# Hybrid Exact Matching + AI Batch Processing Implementation Guide

## Overview
This document explains how the hybrid reconciliation system works for both Bank Rec and AP Rec endpoints.

## Architecture

### 3-Phase Processing:

**Phase 1: Exact Matching** (Deterministic, Fast, Free)
- Match based on exact criteria
- Bank Rec: Same amount (±0.01) + date within 3 days
- AP Rec: Same invoice number + amount (±0.01)
- Results → `exact_matches` array

**Phase 2: AI Batch Processing** (Complex scenarios, Intelligent, API costs)
- Process remaining unmatched items in batches of 50
- Handles: Fuzzy matching, grouping (one-to-many, many-to-one), FX conversions, timing differences
- Results → `ai_matches` array

**Phase 3: Response Aggregation**
- Combine results from both phases
- Separate response format shows which matches were exact vs AI

## Bank Reconciliation Implementation

```typescript
// After normalizing bankTransactions and ledgerEntries:

// PHASE 1: Exact Matching
const { exactMatches, unmatchedBank, unmatchedLedger } = 
  performExactBankMatching(bankTransactions, ledgerEntries);

// PHASE 2: AI Batch Processing (only if needed)
if (unmatchedBank.length === 0) {
  // All matched exactly, no AI needed!
  return combinedResults(exactMatches, [], unmatchedLedger);
}

const BATCH_SIZE = 50;
const bankBatches = batchArray(unmatchedBank, BATCH_SIZE);
let allAIMatches = [];
let allAIUnmatchedBank = [];

for (const bankBatch of bankBatches) {
  const prompt = createBatchPrompt(bankBatch, unmatchedLedger);
  const aiResult = await callOpenAI(prompt);
  
  allAIMatches.push(...aiResult.matched_pairs);
  allAIUnmatchedBank.push(...aiResult.unmatched_bank);
}

// PHASE 3: Combine and return
return {
  summary: {
    exact_matched_count: exactMatches.length,
    ai_matched_count: allAIMatches.length,
    ...
  },
  exact_matches: exactMatches,
  ai_matches: allAIMatches,
  unmatched_bank: allAIUnmatchedBank,
  unmatched_ledger: unmatchedLedger
};
```

## AP Reconciliation Implementation

```typescript
// After parsing vendorInvoices and apEntries:

// PHASE 1: Exact Matching
const { exactMatches, amountMismatches, unmatchedVendor, unmatchedInternal } = 
  performExactAPMatching(vendorInvoices, apEntries);

// PHASE 2: AI Batch Processing (for unmatched items)
if (unmatchedVendor.length === 0 && unmatchedInternal.length === 0) {
  return combinedResults(exactMatches, amountMismatches, [], []);
}

const BATCH_SIZE = 50;
const vendorBatches = batchArray(unmatchedVendor, BATCH_SIZE);
let allMissingInvoices = [];
let allInternalOnly = [];

for (const vendorBatch of vendorBatches) {
  const prompt = createAPBatchPrompt(vendorBatch, unmatchedInternal);
  const aiResult = await callOpenAI(prompt);
  
  allMissingInvoices.push(...aiResult.missing_invoices);
  allInternalOnly.push(...aiResult.internal_only_invoices);
}

// PHASE 3: Combine and return
return {
  summary: {
    exact_matched_count: exactMatches.length,
    amount_mismatches_count: amountMismatches.length,
    ...
  },
  exact_matches: exactMatches,
  amount_mismatches: amountMismatches,
  missing_invoices: allMissingInvoices,
  internal_only_invoices: allInternalOnly
};
```

## Key Benefits

1. **Performance**: Exact matches are instant (no AI calls)
2. **Cost Optimization**: AI only processes what exact matching can't handle
3. **Batch Efficiency**: 50-transaction batches prevent token overflow
4. **Transparency**: Users see which matches were exact vs AI-inferred
5. **Scalability**: Can process thousands of transactions efficiently

## Example Scenario

**Input:**
- 100 bank transactions
- 90 ledger entries

**Phase 1 Results:**
- 70 exact matches found
- 30 bank transactions still unmatched
- 20 ledger entries still unmatched

**Phase 2 Batching:**
- Batch 1: 30 unmatch bank transactions → AI processes all in one call (under 50 limit)

**Phase 2 Results:**
- 18 AI matches (fuzzy, grouped, FX, timing)
- 12 truly unmatched (fees, interest, unknown)

**Final Output:**
```json
{
  "summary": {
    "exact_matched_count": 70,
    "ai_matched_count": 18,
    "unmatched_bank_count": 12,
    "unmatched_ledger_count": 2
  },
  "exact_matches": [70 items],
  "ai_matches": [18 items],
  "unmatched_bank": [12 items],
  "unmatched_ledger": [2 items]
}
```

## Implementation Status

✅ Helper functions created:
- `performExactBankMatching()`
- `performExactAPMatching()`
- `batchArray()`

⏳ To implement:
1. Update `/analyze-bank-rec` endpoint to use 3-phase approach
2. Update `/reconcile-ap` endpoint to use 3-phase approach
3. Update AI prompts to reference correct batch variables
4. Update response format to separate exact_matches vs ai_matches

## Next Steps

The core implementation requires updating the existing endpoint code to:
1. Call exact matching helper first
2. Batch remaining unmatched items
3. Loop through batches, calling AI for each
4. Accumulate AI results
5. Return combined response with separated exact/AI matches
