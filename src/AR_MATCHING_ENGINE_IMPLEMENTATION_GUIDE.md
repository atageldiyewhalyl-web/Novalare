# AR Reconciliation Matching Engine Enhancement Guide

**Project:** Novalare - AR Reconciliation Matching Engine Upgrade  
**Date:** January 2, 2026  
**Status:** Implementation Ready  
**Target:** Increase match rate from 37% → 75-90%

---

## 📊 Current State Analysis

### Current AR Matching Engine (`/supabase/functions/server/ar-rec-routes.tsx`)
- **Line Range:** 763-1063
- **Current Phases:**
  1. ✅ **Exact Matching** (Invoice # + Amount) - WORKS
  2. ✅ **Amount-Only Matching** - WORKS (limited)
  3. ✅ **Customer Name Fuzzy Matching** - WORKS (basic)
- **Current Results:**
  - Total matched pairs: 10
  - All matches are "exact" type (100%)
  - FX matches: 0
  - Aggregated matches: 0
  - **Match rate: 37%**

### What's Missing (Critical Gaps)
1. ❌ **No FX (Foreign Exchange) matching** - All currency mismatches are rejected
2. ❌ **No aggregation logic** - Cannot handle 1:N or N:1 scenarios
3. ❌ **No subset-sum algorithm** - Cannot find combinations that sum to target
4. ❌ **No currency normalization** - USD invoices vs EUR payments fail
5. ❌ **No weighted scoring system** - Binary pass/fail only
6. ❌ **No match classification pipeline** - Only "exact" type exists

---

## 🎯 Implementation Strategy

### **Phase-Based Approach:** Extract → Adapt → Integrate
- ✅ **Copy proven algorithms** from AP Rec (tested, production-grade)
- ✅ **Adapt for AR semantics** (vendor→customer, bill→invoice)
- ✅ **Add AR-specific enhancements** (customer payment patterns)
- ⏱️ **Estimated Time:** 90 minutes total

---

## 📁 Reference Files (Source of Truth)

### **AP Rec Matching Engine** (Primary Reference)
- **File:** `/supabase/functions/server/ap-rec-routes.tsx`
- **Critical Sections:**
  - Lines 1779-1815: `findMatchingCombinations()` - Subset-sum algorithm
  - Lines 1817-2076: FX matching helpers (rate bounds, validation, scoring)
  - Lines 2290-2330: Vendor name normalization and fuzzy matching
  - Lines 2356-2900: 4-stage matching pipeline (exact, 1:N, N:1, FX)

### **Bank Rec Matching Engine** (Secondary Reference)
- **File:** `/supabase/functions/server/bank-rec-routes.tsx`
- **Critical Sections:**
  - Lines 1296-1496: Matching philosophy and helper functions
  - Lines 1348-1450: Date matching, tolerance calculation, amount validation

### **Current AR Rec** (Target to Enhance)
- **File:** `/supabase/functions/server/ar-rec-routes.tsx`
- **Lines to Replace:** 763-1063 (current 3-phase basic matching)

---

## 🚀 Implementation Phases

---

## **PHASE 1: Utility Functions Extraction** (15 min)

### Objective
Extract universal, reusable functions from AP Rec that work across all reconciliation types.

### Actions

#### 1.1 Extract Subset-Sum Algorithm
**Source:** `/supabase/functions/server/ap-rec-routes.tsx` (Lines 1779-1815)

**Function to Copy:**
```typescript
function findMatchingCombinations(
  entries: any[],
  targetAmount: number,
  tolerance: number,
  maxSize: number = 5,
  useSubsetSum: boolean = true
): any[][]
```

**Purpose:**
- Finds combinations of 2-5 entries that sum to target amount ± tolerance
- Handles 1:N matching (1 payment → N invoices)
- Handles N:1 matching (N payments → 1 invoice)
- Uses optimized subset-sum for large datasets (>10 entries)

**Adaptations for AR:**
- ✅ No changes needed - amount logic is universal
- Test with AR invoice/payment data

---

#### 1.2 Extract FX Rate Bounds and Validation
**Source:** `/supabase/functions/server/ap-rec-routes.tsx` (Lines 1838-1914)

**Constants/Functions to Copy:**
```typescript
// FX Rate Realistic Bounds
const FX_RATE_BOUNDS: Record<string, { min: number; max: number }> = {
  'USD→EUR': { min: 0.85, max: 1.10 },
  'EUR→USD': { min: 0.90, max: 1.18 },
  // ... 20+ currency pairs
};

function isFXScenario(currency1: string, currency2: string): boolean
function getImpliedFXRate(amount1: number, amount2: number, curr1: string, curr2: string): { rate: number; direction: string }
function isFXRateRealistic(rate: number, direction: string): boolean
```

**Purpose:**
- Detects when invoice currency ≠ payment currency
- Calculates implied FX rate from two amounts
- Validates rate against realistic bounds (prevents false positives)

**Adaptations for AR:**
- Change variable names:
  - `vendorAmount` → `invoiceAmount`
  - `apAmount` → `paymentAmount`
  - `vendorCurrency` → `invoiceCurrency`
  - `apCurrency` → `paymentCurrency`

---

#### 1.3 Extract Tolerance Calculation
**Source:** `/supabase/functions/server/bank-rec-routes.tsx` (Lines 1397-1423)

**Function to Copy:**
```typescript
function calculateTolerance(amount: number, scenario: 'exact' | 'multi' = 'exact'): number
```

**Purpose:**
- Dynamic tolerance based on amount size
- Strict for multi-entry matches (prevents false positives)
- Lenient for exact matches (handles rounding, fees)

**Logic:**
- Small amounts (<$50): ±$2
- Medium amounts ($50-$1000): ±$5
- Large amounts (>$1000): 0.5% tolerance
- Multi-entry: Tighter (0.5%-0.1% to prevent contamination)

**Adaptations for AR:**
- ✅ No changes needed - universal logic

---

#### 1.4 Extract Customer/Vendor Name Normalization
**Source:** `/supabase/functions/server/ap-rec-routes.tsx` (Lines 2290-2330)

**Functions to Copy:**
```typescript
function normalizeCustomerName(name: string): string {
  // Remove: GmbH, Co., Ltd., Inc., AG, LLC, etc.
  // Normalize: unicode (ä→a, ö→o)
  // Clean: dots, dashes, parentheses
}

function customerNamesMatch(name1: string, name2: string): boolean {
  // Exact after normalization
  // One contains other
  // 2+ matching key words
}

function calculateCustomerSimilarity(name1: string, name2: string): number {
  // Returns 0-1 similarity score
  // Used for weighted scoring
}
```

**Purpose:**
- Fuzzy matching for customer names across invoice and payment
- Handles variations: "AlphaSupply Co." vs "AlphaSupply"

**Adaptations for AR:**
- Rename `vendor` → `customer` throughout
- Keep all normalization rules (apply to both vendors and customers)

---

#### 1.5 Extract Invoice/Reference Extraction
**Source:** Already exists in AR Rec (Lines 783-805) ✅

**Current Function:**
```typescript
function extractInvoiceNumber(description: string): string[]
```

**Enhancement Needed:**
- Add patterns from AP Rec's `extractInvoiceReferences()`
- Support more formats: "REF-123", "Order #456", "PO789"

---

#### 1.6 Extract Date Comparison
**Source:** `/supabase/functions/server/bank-rec-routes.tsx` (Lines 1348-1395)

**Function to Copy:**
```typescript
function datesMatch(date1: string, date2: string, daysThreshold = 2): boolean
function calculateDateDifference(date1: string, date2: string): number
```

**Purpose:**
- Handles multiple date formats (ISO, US, European, Excel serial)
- Returns difference in days (for scoring)

**Adaptations for AR:**
- ✅ No changes needed - universal date logic

---

### **PHASE 1 Deliverable:**
A set of 8-10 utility functions ready to use in AR matching engine.

---

## **PHASE 2: FX Matching Implementation** (30 min)

### Objective
Enable AR engine to match invoices in one currency with payments in another (e.g., USD invoice → EUR payment).

### Current Problem
From assessment:
> **FX matches: 0**  
> Every invoice in USD with payment in EUR is automatically discarded as mismatch.

### Actions

#### 2.1 Implement FX Scoring Function
**Source:** `/supabase/functions/server/ap-rec-routes.tsx` (Lines 1916-2052)

**Function to Adapt:**
```typescript
function scoreFXMatch(
  invoice: any,        // Changed from 'vendor'
  payment: any,        // Changed from 'ap'
  impliedRate: number,
  fxDirection: string
): {
  score: number;
  type: string;
  matchType: string;
  fxRate: number;
  fxDirection: string;
  confidence: string;
  explanation: string;
}
```

**Scoring Breakdown (100 points total):**
1. **Invoice/Reference Match (45 points)** - Critical for FX
   - Extract invoice # from payment description
   - Match against invoice.invoice_number
   - Exact match = 45 points
   - No refs available = neutral (0 penalty)

2. **Customer Name Match (25 points)** - REQUIRED for FX
   - Fuzzy match: invoice.customer vs payment.description
   - >80% similarity = 25 points
   - >60% similarity = 15 points
   - <60% similarity = **HARD REJECT** (return score: 0)
   - **Rationale:** Prevents matching "Client A USD invoice" with "Client B EUR payment"

3. **Date Proximity (15 points)** - FX can have lag
   - ≤3 days = 15 points
   - ≤7 days = 10 points
   - ≤14 days = 5 points
   - >14 days = 0 points

4. **FX Rate Realistic (15 points)** - Must pass
   - Check rate against `FX_RATE_BOUNDS`
   - Realistic = 15 points
   - Unrealistic = **HARD REJECT** (return score: 0)
   - **Example:** USD 1,000 → EUR 850 = rate 0.85 (valid for USD→EUR: 0.85-1.10)

5. **Amount Correlation (bonus, flexible)**
   - Not strictly required but adds confidence
   - Helps when customer name is ambiguous

**Minimum Threshold:** 55 points
- Ensures customer match (15+) + date match (15+) + FX valid (15+) + some invoice/amount correlation
- Prevents false positives

**Adaptations for AR:**
- Variable renames:
  - `vendor` → `invoice`
  - `ap` → `payment`
  - `vendorName` → `invoice.customer`
  - `apVendorName` → Extract customer from `payment.description`
- Logic: ✅ No changes to scoring weights

---

#### 2.2 Integrate FX Matching into Reconciliation Pipeline
**Location:** `/supabase/functions/server/ar-rec-routes.tsx` (After Phase 3, before final results)

**New Phase to Add:**
```typescript
// ============================================================================
// PHASE 4: INTELLIGENT FX MATCHING
// ============================================================================
console.log('💱 Phase 4: FX currency conversion matching...');

const fxMatches: any[] = [];
const stillUnmatchedPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
const stillUnmatchedInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

for (const payment of stillUnmatchedPayments) {
  for (const invoice of stillUnmatchedInvoices) {
    const paymentCurrency = payment.currency || 'EUR';
    const invoiceCurrency = invoice.currency || 'EUR';
    
    // Only process FX scenarios (different currencies)
    if (!isFXScenario(paymentCurrency, invoiceCurrency)) continue;
    
    // Calculate implied FX rate
    const { rate, direction } = getImpliedFXRate(
      invoice.amount,
      payment.amount,
      invoiceCurrency,
      paymentCurrency
    );
    
    // Score this FX match
    const fxMatch = scoreFXMatch(invoice, payment, rate, direction);
    
    // Accept if score >= 55 (requires customer match + date/FX validation)
    if (fxMatch.score >= 55) {
      fxMatches.push({
        payment,
        invoice,
        match_type: 'fx',
        confidence: Math.round(fxMatch.score),
        match_reason: fxMatch.explanation,
        fx_rate: rate,
        fx_direction: direction
      });
      
      // Mark as matched
      matchedPaymentIndices.add(bankInflows.indexOf(payment));
      matchedInvoiceIndices.add(arInvoices.indexOf(invoice));
      break; // Move to next payment
    }
  }
}

console.log(`✅ Phase 4 complete: ${fxMatches.length} FX matches found`);
```

**Expected Impact:**
- Should match all 4 FX invoices from sample dataset
- Match rate: 37% → ~52% (+15%)

---

### **PHASE 2 Deliverable:**
Working FX matching that correctly identifies USD invoices paid in EUR.

---

## **PHASE 3: Aggregation Logic (1:N and N:1)** (30 min)

### Objective
Enable matching of:
- **1:N (One-to-Many):** 1 payment → 2-3 invoices (batch payment)
- **N:1 (Many-to-One):** 2-3 payments → 1 invoice (partial payments)

### Current Problem
From assessment:
> Cases like:  
> Invoice: €3,600  
> Payments: €1,800 + €1,800  
> are treated as **two unrelated transactions**, instead of valid reconciliation.

### Actions

#### 3.1 Implement 1:N Matching (One Payment → Many Invoices)
**Source:** `/supabase/functions/server/ap-rec-routes.tsx` (Lines 2447-2519)

**Logic:**
```typescript
// ============================================================================
// PHASE 5: ONE-TO-MANY MATCHING (1 Payment → N Invoices)
// ============================================================================
console.log('🔀 Phase 5: One-to-many matching (batch payments)...');

const oneToManyMatches: any[] = [];
const remainingPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
const remainingInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

for (const payment of remainingPayments) {
  // Find combinations of 2-5 invoices that sum to payment amount
  const tolerance = calculateTolerance(payment.amount, 'multi');
  const combos = findMatchingCombinations(remainingInvoices, Math.abs(payment.amount), tolerance, 5);
  
  for (const combo of combos) {
    // CRITICAL: Check customer consistency
    // All invoices in combo must be from same customer (or very similar)
    const customers = combo.map(inv => inv.customer || '');
    const allSameCustomer = customers.every(c => customerNamesMatch(c, customers[0]));
    
    if (!allSameCustomer) {
      console.log('❌ Rejected combo: Mixed customers');
      continue; // Skip - customer contamination
    }
    
    // Check date proximity (all invoices within ±14 days of payment)
    const allDatesClose = combo.every(inv => 
      Math.abs(calculateDateDifference(payment.date, inv.date)) <= 14
    );
    
    if (!allDatesClose) continue;
    
    // MATCH FOUND
    oneToManyMatches.push({
      payment,
      invoices: combo,
      match_type: 'one_to_many',
      confidence: 90,
      match_reason: `Batch payment for ${combo.length} invoices (${combo.map(inv => inv.invoice_number).join(', ')})`
    });
    
    // Mark all as matched
    matchedPaymentIndices.add(bankInflows.indexOf(payment));
    combo.forEach(inv => matchedInvoiceIndices.add(arInvoices.indexOf(inv)));
    break; // Move to next payment
  }
}

console.log(`✅ Phase 5 complete: ${oneToManyMatches.length} one-to-many matches found`);
```

**Safeguards:**
- ✅ **Customer consistency check** - Prevents matching invoices from different customers
- ✅ **Date window** (±14 days) - Prevents matching old + new invoices
- ✅ **Tight tolerance** (0.5%-0.1%) - From `calculateTolerance(..., 'multi')`
- ✅ **Max 5 invoices per combo** - Prevents combinatorial explosion

---

#### 3.2 Implement N:1 Matching (Many Payments → One Invoice)
**Source:** `/supabase/functions/server/ap-rec-routes.tsx` (Lines 2593-2756)

**Logic:**
```typescript
// ============================================================================
// PHASE 6: MANY-TO-ONE MATCHING (N Payments → 1 Invoice)
// ============================================================================
console.log('🔁 Phase 6: Many-to-one matching (partial payments)...');

const manyToOneMatches: any[] = [];
const finalRemainingPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
const finalRemainingInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

for (const invoice of finalRemainingInvoices) {
  // Find combinations of 2-5 payments that sum to invoice amount
  const tolerance = calculateTolerance(invoice.amount, 'multi');
  const combos = findMatchingCombinations(finalRemainingPayments, Math.abs(invoice.amount), tolerance, 5);
  
  for (const combo of combos) {
    // CRITICAL: Check customer consistency
    // All payments must mention same customer (fuzzy match with invoice.customer)
    const allMatchCustomer = combo.every(pmt => {
      const similarity = calculateCustomerSimilarity(pmt.description, invoice.customer);
      return similarity >= 0.6; // 60% threshold
    });
    
    if (!allMatchCustomer) {
      console.log('❌ Rejected combo: Customer mismatch');
      continue;
    }
    
    // Check date proximity (all payments within ±30 days of invoice)
    // Wider window than 1:N because partial payments can be spread out
    const allDatesClose = combo.every(pmt => 
      Math.abs(calculateDateDifference(pmt.date, invoice.date)) <= 30
    );
    
    if (!allDatesClose) continue;
    
    // MATCH FOUND
    manyToOneMatches.push({
      payments: combo,
      invoice,
      match_type: 'many_to_one',
      confidence: 88,
      match_reason: `Invoice paid in ${combo.length} partial payments`
    });
    
    // Mark all as matched
    combo.forEach(pmt => matchedPaymentIndices.add(bankInflows.indexOf(pmt)));
    matchedInvoiceIndices.add(arInvoices.indexOf(invoice));
    break; // Move to next invoice
  }
}

console.log(`✅ Phase 6 complete: ${manyToOneMatches.length} many-to-one matches found`);
```

**Safeguards:**
- ✅ **Customer similarity check** (60%+ threshold) - Each payment must mention customer
- ✅ **Wider date window** (±30 days) - Partial payments can span time
- ✅ **Tight tolerance** - Prevents false combos
- ✅ **Max 5 payments per combo** - Limits complexity

---

### **PHASE 3 Deliverable:**
- 1:N and N:1 matching working for batch payments and partial payments
- Match rate: 52% → ~75% (+23%)

---

## **PHASE 4: Match Classification & Scoring Enhancement** (15 min)

### Objective
Replace binary pass/fail logic with weighted confidence scoring for each match type.

### Actions

#### 4.1 Update Match Type Taxonomy
**Current Types:**
- `exact` (invoice # + amount)
- `amount` (amount only)
- `customer_name` (fuzzy name)

**New Types to Add:**
- `fx` - FX transaction match (different currencies)
- `one_to_many` - Batch payment
- `many_to_one` - Partial payments
- `customer_amount` - Customer + amount (existing "amount" type renamed)

---

#### 4.2 Implement Dynamic Confidence Calculation
**Source:** `/supabase/functions/server/ap-rec-routes.tsx` (Lines 2380-2430)

**Logic for Each Match Type:**

**Exact Match (100%):**
- Invoice # match + Amount match (±0.01) + Same currency

**FX Match (Dynamic: 55-100):**
- Scored by `scoreFXMatch()` function
- Components: Invoice ref (45) + Customer (25) + Date (15) + FX validation (15)

**One-to-Many (90-95):**
- Base: 90
- +5 if all invoices have matching references in payment description

**Many-to-One (85-90):**
- Base: 85
- +5 if invoice # found in all payment descriptions

**Amount-Only (70-85):**
- Base: 70
- +15 if unique amount (no other invoices with same amount)
- -5 per day difference beyond 7 days (min: 60)

**Customer Name (60-80):**
- Base: fuzzyMatch() score * 100
- Requires: name similarity ≥60% AND amount similarity ≥80%

---

#### 4.3 Add Match Explanation
**Purpose:** Help users understand why items matched

**Format:**
```typescript
{
  match_reason: "FX Transaction Match: Invoice INV-001, Customer match (90%), Date match (≤3 days), FX rate 0.92 USD→EUR realistic. This is a valid match - amounts differ due to currency conversion.",
  confidence: 87
}
```

---

### **PHASE 4 Deliverable:**
Clear match classification with confidence scores and explanations.

---

## **PHASE 5: Integration & Testing** (15 min)

### Objective
Replace current 3-phase basic matching with new 6-phase advanced matching engine.

### Actions

#### 5.1 Update `/supabase/functions/server/ar-rec-routes.tsx`

**Replace Lines 763-1063 with:**
```typescript
// ============================================================================
// NOVALARE AR RECONCILIATION MATCHING ENGINE V2.0
// ============================================================================
//
// MATCHING FUNNEL (6 STAGES):
//
// 1️⃣ EXACT MATCH (Confidence: 100%) - Invoice # + Amount + Same Currency
// 2️⃣ AMOUNT-ONLY MATCH (Confidence: 70-85%) - Unique amount matching
// 3️⃣ CUSTOMER NAME FUZZY MATCH (Confidence: 60-80%) - Fuzzy customer + amount
// 4️⃣ INTELLIGENT FX MATCHING (Confidence: 55-100%) - Currency conversion detection
// 5️⃣ ONE-TO-MANY (Confidence: 90-95%) - 1 Payment → N Invoices (batch)
// 6️⃣ MANY-TO-ONE (Confidence: 85-90%) - N Payments → 1 Invoice (partial)
//
// KEY IMPROVEMENTS:
// ✅ FX normalization with realistic rate bounds (20+ currency pairs)
// ✅ Subset-sum algorithm for aggregation (1:N, N:1)
// ✅ Customer fuzzy matching with vendor contamination prevention
// ✅ Dynamic confidence scoring (5 factors)
// ✅ Match type classification with explanations
//
// SAFEGUARDS:
// 🔒 Customer consistency checks (prevents cross-customer contamination)
// 🔒 FX vendor matching required (>60% similarity)
// 🔒 FX rate validation (explicit bounds, no generic fallback)
// 🔒 Tight multi-entry tolerance (0.5%-0.1% to prevent false positives)
// 🔒 Date windowing (exact: ±7d, batch: ±14d, partial: ±30d)
//
// ============================================================================

// PHASE 1: Exact matching (existing - ✅ keep as-is)
// Lines 765-848

// PHASE 2: Amount-only matching (existing - ✅ keep with minor tweaks)
// Lines 850-921

// PHASE 3: Customer name fuzzy matching (existing - ✅ keep as-is)
// Lines 924-1003

// PHASE 4: FX matching (NEW - add here)
// See PHASE 2 implementation above

// PHASE 5: One-to-many matching (NEW - add here)
// See PHASE 3.1 implementation above

// PHASE 6: Many-to-one matching (NEW - add here)
// See PHASE 3.2 implementation above

// PHASE 7: Compile results (existing - ✅ update to include new match types)
// Lines 1005-1086
```

---

#### 5.2 Update Result Compilation
**Lines 1009-1086:** Update to include new match types

**Changes:**
```typescript
const allMatches = [
  ...exactMatches,
  ...amountMatches,
  ...fuzzyMatches,
  ...fxMatches,          // NEW
  ...oneToManyMatches,   // NEW
  ...manyToOneMatches    // NEW
];
```

**Update Stats:**
```typescript
const stats = {
  total_payments: bankInflows.length,
  total_invoices: arInvoices.length,
  matched_pairs: allMatches.length,
  exact_matches: exactMatches.length,
  amount_matches: amountMatches.length,
  customer_matches: fuzzyMatches.length,
  fx_matches: fxMatches.length,                    // NEW
  one_to_many_matches: oneToManyMatches.length,    // NEW
  many_to_one_matches: manyToOneMatches.length,    // NEW
  unmatched_payments: finalUnmatchedPayments.length,
  unmatched_invoices: finalUnmatchedInvoices.length,
  match_rate: `${matchRate}%`
};
```

---

#### 5.3 Test with Sample Dataset
**Expected Results (from assessment):**
- **Before:** 10 matches (37% rate)
- **After:** 22-24 matches (75-90% rate)

**Breakdown:**
- Exact: 10 (unchanged)
- FX: 4 (USD invoices → EUR payments)
- One-to-many: 3 (batch payments for Client C)
- Many-to-one: 2-3 (partial payments)
- Amount/Customer: 3-5 (improved with better scoring)

---

### **PHASE 5 Deliverable:**
Fully integrated matching engine with test results showing 75-90% match rate.

---

## 📋 Implementation Checklist

### Pre-Implementation
- [ ] Read AP Rec matching engine (`/supabase/functions/server/ap-rec-routes.tsx`)
- [ ] Read Bank Rec matching engine (`/supabase/functions/server/bank-rec-routes.tsx`)
- [ ] Read current AR Rec matching logic (lines 763-1063)
- [ ] Understand assessment findings (37% → 75-90% target)

### Phase 1: Utilities (15 min)
- [ ] Extract `findMatchingCombinations()` (subset-sum)
- [ ] Extract FX rate bounds + validation functions
- [ ] Extract `calculateTolerance()` (dynamic amount tolerance)
- [ ] Extract customer name normalization + fuzzy matching
- [ ] Extract date comparison helpers
- [ ] Test each function independently with sample data

### Phase 2: FX Matching (30 min)
- [ ] Implement `scoreFXMatch()` function (adapt from AP Rec)
- [ ] Add Phase 4 (FX matching loop) to reconciliation pipeline
- [ ] Test with USD invoice → EUR payment scenario
- [ ] Verify: FX matches > 0, no false positives

### Phase 3: Aggregation (30 min)
- [ ] Implement Phase 5 (one-to-many: 1 payment → N invoices)
- [ ] Implement Phase 6 (many-to-one: N payments → 1 invoice)
- [ ] Add customer consistency checks (prevent contamination)
- [ ] Add date windowing (±14d for batch, ±30d for partial)
- [ ] Test with batch payment scenario (€3,600 → €1,800 + €1,800)

### Phase 4: Classification (15 min)
- [ ] Update match type taxonomy (`fx`, `one_to_many`, `many_to_one`)
- [ ] Implement dynamic confidence scoring for each type
- [ ] Add match explanations (why items matched)
- [ ] Update result structure to include new fields

### Phase 5: Integration (15 min)
- [ ] Replace lines 763-1063 in `/supabase/functions/server/ar-rec-routes.tsx`
- [ ] Update result compilation to include all 6 match types
- [ ] Update stats object with new match counts
- [ ] Test full reconciliation with sample dataset
- [ ] Verify: Match rate 75-90%, no false positives

### Post-Implementation
- [ ] Run reconciliation on sample dataset
- [ ] Compare results: Before (37%) vs After (target: 75-90%)
- [ ] Export results to Excel (verify all match types display correctly)
- [ ] Document any edge cases or issues found
- [ ] Update user-facing documentation if needed

---

## 🎯 Success Metrics

### Quantitative Targets
- **Match Rate:** 37% → 75-90% ✅
- **FX Matches:** 0 → 4+ ✅
- **Aggregated Matches:** 0 → 5-8 ✅
- **False Positive Rate:** <1% (critical - deterministic matching only)

### Qualitative Indicators
- ✅ Users can reconcile multi-currency AR statements
- ✅ Users can handle batch payments (common in AR)
- ✅ Users can handle partial payments (common in AR)
- ✅ Confidence scores help users prioritize review
- ✅ Match explanations are clear and actionable

---

## ⚠️ Critical Safeguards (DO NOT SKIP)

### 1. Customer Consistency Checks
**Why:** Prevents matching invoices from different customers
**Where:** All aggregation logic (1:N, N:1)
**Implementation:**
```typescript
const allSameCustomer = combo.every(item => 
  customerNamesMatch(item.customer, combo[0].customer)
);
if (!allSameCustomer) continue; // REJECT
```

### 2. FX Vendor Matching Requirement
**Why:** Prevents "USD Client A" matching "EUR Client B" just because amounts align
**Where:** `scoreFXMatch()` function
**Implementation:**
```typescript
if (customerSimilarity < 0.6) {
  return { score: 0, ... }; // HARD REJECT
}
```

### 3. FX Rate Bounds Validation
**Why:** Prevents unrealistic FX rates (e.g., 1 USD = 10 EUR)
**Where:** `isFXRateRealistic()` function
**Implementation:**
```typescript
if (!FX_RATE_BOUNDS[direction]) {
  return false; // Unknown pair - REJECT
}
if (rate < bounds.min || rate > bounds.max) {
  return false; // Unrealistic - REJECT
}
```

### 4. Tight Multi-Entry Tolerance
**Why:** Prevents false combos (e.g., 3 unrelated invoices coincidentally summing to payment)
**Where:** `calculateTolerance(..., 'multi')`
**Implementation:**
```typescript
// Multi-entry: 0.5%-0.1% tolerance (10x stricter than exact matches)
if (absAmount < 100) return 0.50;
if (absAmount < 1000) return 1.00;
```

### 5. Date Windowing
**Why:** Prevents matching old + new items
**Where:** All matching phases
**Implementation:**
```typescript
// Exact/FX: ±7 days
// One-to-many (batch): ±14 days
// Many-to-one (partial): ±30 days (wider for payment plans)
```

---

## 🐛 Known Edge Cases & Solutions

### Edge Case 1: Multiple Invoices with Same Amount
**Problem:** €1,000 payment, 3 invoices all for €1,000
**Solution:** Use date proximity as tiebreaker (closest date wins)
**Status:** ✅ Already implemented in Phase 2 (lines 884-917)

### Edge Case 2: Partial Payment + Overpayment
**Problem:** €1,000 invoice, payments: €600, €450 (total €1,050)
**Solution:** Match €600 + €400 (if another €400 payment exists), leave €450 unmatched
**Status:** ⚠️ **NOT** handled - subset-sum finds best fit, may need manual review

### Edge Case 3: FX + Aggregation Combined
**Problem:** USD invoice batch paid in single EUR payment
**Solution:** Phase order handles this - FX runs before aggregation
**Status:** ✅ Should work (test needed)

### Edge Case 4: Customer Name Variations
**Problem:** "ABC Corp." in invoice, "ABC Corporation" in payment
**Solution:** `normalizeCustomerName()` removes suffixes, fuzzy match handles rest
**Status:** ✅ Already implemented in utility functions

### Edge Case 5: Zero/Negative Amounts
**Problem:** Credit notes, refunds (negative amounts)
**Solution:** Use `Math.abs()` for amount comparison (already in `amountsMatch()`)
**Status:** ✅ Already implemented in Bank/AP Rec

---

## 📊 Expected Performance Improvements

### Sample Dataset Analysis (from Assessment)
| Metric                    | Before | After (Expected) |
|---------------------------|--------|------------------|
| Total Invoices            | 25     | 25               |
| Total Payments            | 27     | 27               |
| **Matched Pairs**         | **10** | **22-24**        |
| Exact Matches             | 10     | 10               |
| FX Matches                | 0      | 4                |
| Aggregated Matches        | 0      | 8                |
| Customer/Amount Matches   | 0      | 0-2              |
| **Match Rate**            | **37%**| **75-90%**       |
| Unmatched Invoices        | 15     | 1-3              |
| Unmatched Payments        | 17     | 3-5              |

### Financial Impact
| Metric                    | Before     | After (Expected) |
|---------------------------|------------|------------------|
| Total Invoice Amount      | €41,446.92 | €41,446.92       |
| **Matched Invoice Amount**| **€20,701.37** | **€36,000-38,000** |
| **Match Rate (Financial)**| **50%**    | **87-92%**       |

---

## 🚀 Post-Implementation Enhancements (Future)

### Optional: Phase 7 - AI Fuzzy Matching
**When:** Only if match rate <70% after Phases 1-6
**What:** Use GPT-4o for ambiguous cases (no invoice #, no clear customer)
**Risk:** High false positive rate (disabled in Bank Rec for this reason)
**Recommendation:** ⚠️ Manual review is safer than AI guessing

### Optional: Multi-Currency Aggregation
**Scenario:** 1 EUR payment → 2 USD invoices (FX + aggregation combined)
**Complexity:** High (need to normalize currencies before summing)
**Recommendation:** Implement only if users request this specific scenario

### Optional: Payment Plan Detection
**Scenario:** €10,000 invoice → 10x €1,000 monthly payments
**Complexity:** Requires time-series pattern detection
**Recommendation:** Current N:1 matching (max 5 payments) handles most cases

---

## 📝 Notes for Future Maintainers

### Why These Specific Thresholds?
- **FX minimum score: 55** - Requires customer match (15+) + date (15+) + FX validation (15+) + some invoice/amount (10+)
- **Customer similarity: 60%** - Balance between recall (find matches) and precision (avoid false positives)
- **Date windows: 7/14/30 days** - Exact=strict, Batch=medium, Partial=loose (payment plans span time)
- **Multi-entry tolerance: 0.5%-0.1%** - Learned from AP Rec "vendor contamination" issues

### Why Deterministic > AI?
- **Bank Rec disabled AI** (Phase 4) due to false positives (€228 "Unknown" → €486 "Chevron" at 75%)
- **AP Rec uses deterministic only** - 75-85% match rate with 0% false positive rate
- **AR Rec should follow same pattern** - Better to miss 10% than create 1% false positives

### Why Copy from AP Rec (not Bank Rec)?
- **AP Rec has FX logic** - Bank Rec doesn't (single currency)
- **AP Rec has aggregation** - Bank Rec has basic 1:N/N:1 without subset-sum
- **AP Rec is newest** - Most refined logic (fixed "vendor contamination" Dec 31, 2025)
- **AR ≈ AP semantically** - Both match invoices/bills (AR: receive, AP: pay)

---

## ✅ Definition of Done

This implementation is **COMPLETE** when:
1. ✅ All 6 phases implemented and tested
2. ✅ Match rate on sample dataset: 75-90%
3. ✅ FX matches: >0 (should be 4+)
4. ✅ Aggregated matches: >0 (should be 8+)
5. ✅ No false positives (manual spot-check of matches)
6. ✅ Confidence scores and explanations display correctly in UI
7. ✅ Excel export includes all new match types
8. ✅ No errors in browser console or server logs
9. ✅ Code follows existing patterns (consistent with AP/Bank Rec)
10. ✅ Performance: Reconciliation completes in <5 seconds for 100 txns

---

## 🎬 Ready to Implement?

**Estimated Total Time:** 90 minutes  
**Risk Level:** Low (copying proven code, deterministic logic only)  
**Rollback Plan:** Revert lines 763-1063 to original  

**First Step:** Begin with PHASE 1 (Utility Functions Extraction)

---

**Document Version:** 1.0  
**Last Updated:** January 2, 2026  
**Author:** AI Assistant (based on Novalare codebase analysis)
