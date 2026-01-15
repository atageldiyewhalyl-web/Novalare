# FX Matching Flow Diagram 📊

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    VENDOR STATEMENT                             │
│  Invoice: PAC-1000 | Amount: 705.57 USD | Date: 2025-01-01    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AP LEDGER                                 │
│  Ref: PAC-1000 | Amount: 649.12 EUR | Date: 2025-01-01        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               STAGE 4: INTELLIGENT FX MATCHING                  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     ┌────────────────┐             ┌────────────────┐
     │  SAME CURRENCY │             │ DIFFERENT      │
     │  (EUR = EUR)   │             │ CURRENCIES     │
     │                │             │ (USD ≠ EUR)    │
     └────────────────┘             └────────────────┘
              │                               │
              ▼                               ▼
     ┌────────────────┐             ┌────────────────┐
     │  FALLBACK TO   │             │  FX MATCHING   │
     │  TOLERANCE     │             │  LOGIC         │
     │  MATCHING      │             │  (NEW)         │
     └────────────────┘             └────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  1. Calculate Implied    │
                              │     Rate: 649.12/705.57  │
                              │     = 0.9200             │
                              └──────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  2. Validate Rate        │
                              │     0.85 ≤ 0.92 ≤ 1.10  │
                              │     ✅ REALISTIC         │
                              └──────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  3. Score Match          │
                              │     Invoice: +45         │
                              │     Vendor: +25          │
                              │     Date: +15            │
                              │     Rate: +15            │
                              │     = 100 points         │
                              └──────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  4. Check Threshold      │
                              │     100 ≥ 60 ✅          │
                              │     → ACCEPT MATCH       │
                              └──────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  5. Create Match Record  │
                              │     type: fx_adjusted    │
                              │     confidence: 100%     │
                              │     status: auto_approved│
                              │     fx_rate: 0.9200      │
                              │     fx_direction: USD→EUR│
                              └──────────────────────────┘
```

---

## Decision Tree

```
START: Unmatched vendor transaction + AP entry
│
├─ Are currencies different?
│  │
│  ├─ NO (EUR = EUR)
│  │  └─ Use traditional tolerance matching (±2% or ±€5)
│  │
│  └─ YES (USD ≠ EUR)
│     │
│     └─ Calculate implied FX rate
│        │
│        ├─ Rate = |AP amount| / |Vendor amount|
│        │  Example: 649.12 / 705.57 = 0.9200
│        │
│        └─ Is rate realistic?
│           │
│           ├─ NO (outside bounds)
│           │  └─ REJECT (score = 0)
│           │     └─ Log: "FX rate unrealistic"
│           │
│           └─ YES (within bounds)
│              │
│              └─ Score the match (max 100 points)
│                 │
│                 ├─ Invoice numbers match?
│                 │  ├─ YES → +45 points
│                 │  └─ NO → +0 points
│                 │
│                 ├─ Vendor names match?
│                 │  ├─ High similarity (>0.8) → +25 points
│                 │  ├─ Partial (>0.6) → +15 points
│                 │  └─ No match → +0 points
│                 │
│                 ├─ Date proximity?
│                 │  ├─ ≤3 days → +15 points
│                 │  ├─ ≤7 days → +10 points
│                 │  ├─ ≤14 days → +5 points
│                 │  └─ >14 days → +0 points
│                 │
│                 └─ FX rate realistic?
│                    └─ YES → +15 points
│
│                 TOTAL SCORE = ?
│                 │
│                 ├─ Score ≥ 80 → HIGH CONFIDENCE
│                 │  └─ Status: auto_approved
│                 │
│                 ├─ Score 60-79 → MEDIUM CONFIDENCE
│                 │  └─ Status: review_recommended
│                 │
│                 └─ Score < 60 → LOW CONFIDENCE
│                    └─ REJECT (don't create match)
```

---

## Example: Pacific Logistics Match

```
┌──────────────────────────────────────────────────────────────────┐
│                      INPUT DATA                                  │
├──────────────────────────────────────────────────────────────────┤
│ Vendor Statement:                                                │
│   Invoice: PAC-1000                                              │
│   Amount: 705.57 USD                                             │
│   Date: 2025-01-01                                               │
│   Vendor: Pacific Logistics Co.                                  │
├──────────────────────────────────────────────────────────────────┤
│ AP Ledger:                                                       │
│   Reference: PAC-1000                                            │
│   Amount: 649.12 EUR                                             │
│   Date: 2025-01-01                                               │
│   Vendor: Pacific Logistics Co.                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    STEP 1: FX DETECTION                          │
├──────────────────────────────────────────────────────────────────┤
│ isFXScenario('USD', 'EUR')                                       │
│ → true ✅ (currencies differ)                                    │
│                                                                  │
│ Decision: Use FX matching logic                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                STEP 2: CALCULATE IMPLIED RATE                    │
├──────────────────────────────────────────────────────────────────┤
│ getImpliedFXRate(705.57, 649.12, 'USD', 'EUR')                  │
│                                                                  │
│ Calculation:                                                     │
│   rate = |649.12| / |705.57|                                    │
│   rate = 0.9200                                                  │
│                                                                  │
│ Direction: USD→EUR                                               │
│                                                                  │
│ Result:                                                          │
│   { rate: 0.9200, direction: "USD→EUR" }                        │
│                                                                  │
│ Interpretation: 1 USD = 0.92 EUR                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                 STEP 3: VALIDATE RATE                            │
├──────────────────────────────────────────────────────────────────┤
│ isFXRateRealistic(0.9200, 'USD→EUR')                            │
│                                                                  │
│ Bounds for USD→EUR: { min: 0.85, max: 1.10 }                   │
│                                                                  │
│ Check: 0.85 ≤ 0.9200 ≤ 1.10                                     │
│ → true ✅ (rate is realistic)                                   │
│                                                                  │
│ Decision: Continue with scoring                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  STEP 4: SCORE THE MATCH                         │
├──────────────────────────────────────────────────────────────────┤
│ scoreFXMatch(vendor, ap, 0.9200, 'USD→EUR')                     │
│                                                                  │
│ FACTOR 1: Invoice/Reference Match                               │
│   Vendor refs: ['PAC-1000']                                      │
│   AP refs: ['PAC-1000']                                          │
│   Match: YES ✅                                                  │
│   Score: +45 points                                              │
│                                                                  │
│ FACTOR 2: Vendor Name Match                                     │
│   Vendor: 'Pacific Logistics Co.'                               │
│   AP: 'Pacific Logistics Co.'                                   │
│   Similarity: 1.0 (exact match)                                 │
│   Score: +25 points                                              │
│                                                                  │
│ FACTOR 3: Date Proximity                                        │
│   Vendor date: 2025-01-01                                        │
│   AP date: 2025-01-01                                            │
│   Difference: 0 days                                             │
│   Score: +15 points                                              │
│                                                                  │
│ FACTOR 4: FX Rate Realistic                                     │
│   Rate: 0.9200                                                   │
│   Within bounds: YES ✅                                          │
│   Score: +15 points                                              │
│                                                                  │
│ ═══════════════════════════════════════════════════════════════  │
│ TOTAL SCORE: 100 / 100                                          │
│ CONFIDENCE: HIGH (≥80)                                          │
│ ═══════════════════════════════════════════════════════════════  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                 STEP 5: CREATE MATCH RECORD                      │
├──────────────────────────────────────────────────────────────────┤
│ {                                                                │
│   vendor_transaction: { ... },                                  │
│   ap_entries: [{ ... }],                                        │
│   match_confidence: 100,                                         │
│   match_type: 'fx_adjusted_match',                              │
│   match_status: 'auto_approved',                                │
│   match_flags: [                                                 │
│     'FX conversion: USD→EUR',                                   │
│     'Rate: 0.9200'                                              │
│   ],                                                             │
│   explanation: 'FX Transaction Match: Invoice match: PAC-1000,  │
│                 Vendor match: Pacific Logistics Co., Date match │
│                 (≤3 days), FX rate realistic: 0.9200 USD→EUR.  │
│                 This is a valid match - amounts differ due to   │
│                 currency conversion.',                           │
│   fx_rate: 0.9200,                                              │
│   fx_direction: 'USD→EUR'                                       │
│ }                                                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND DISPLAY                              │
├──────────────────────────────────────────────────────────────────┤
│ Match Table Row:                                                 │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Date       │ Vendor               │ Amount  │ Type │ Conf │  │
│ ├────────────────────────────────────────────────────────────┤  │
│ │ 2025-01-01 │ Pacific Logistics Co.│ $705.57 │🟣FX  │ 100% │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ Expanded Details:                                                │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 📈 FX Transaction Match: USD→EUR                          │  │
│ │ Implied rate: 0.9200 • This is a valid match - amounts   │  │
│ │ differ due to currency conversion.                        │  │
│ ├────────────────────────────────────────────────────────────┤  │
│ │ Matched Ledger Entry:                                      │  │
│ │ ┌──────────────────────────────────────────────────────┐  │  │
│ │ │ Pacific Logistics Co.                       €649.12  │  │  │
│ │ │ 2025-01-01 • Vendor: Pacific Logistics • Inv: PAC-1000│ │  │
│ │ └──────────────────────────────────────────────────────┘  │  │
│ └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Rejection Example: Unrealistic Rate

```
┌──────────────────────────────────────────────────────────────────┐
│                      INPUT DATA                                  │
├──────────────────────────────────────────────────────────────────┤
│ Vendor: XYZ Inc | Invoice: INV-999 | Amount: 1000.00 USD       │
│ AP: XYZ Inc | Ref: INV-999 | Amount: 250.00 EUR                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: FX Detection → YES (USD ≠ EUR)                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: Calculate Implied Rate                                  │
│   rate = 250.00 / 1000.00 = 0.2500                             │
│   direction = USD→EUR                                           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: Validate Rate                                            │
│   Bounds: 0.85 ≤ rate ≤ 1.10                                   │
│   Check: 0.85 ≤ 0.2500 ≤ 1.10                                  │
│   → false ❌ (rate is UNREALISTIC)                              │
│                                                                  │
│   HARD REJECT!                                                   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ RESULT: Match Rejected                                           │
│   score: 0                                                       │
│   type: 'fx_rate_unrealistic'                                   │
│   explanation: 'FX rate 0.2500 USD→EUR is unrealistic.         │
│                 Possible data error or wrong match.'            │
│                                                                  │
│ NOT ADDED TO MATCHES LIST                                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Comparison: Before vs After

### Before FX Matching
```
Vendor: $705.57 USD  ─┐
                       ├─── COMPARE AMOUNTS ───> 8% variance
AP: €649.12 EUR      ─┘                          ↓
                                            REJECT ❌
                                            (False Negative)
```

### After FX Matching
```
Vendor: $705.57 USD  ─┐
                       ├─── DETECT FX ───> USD ≠ EUR
AP: €649.12 EUR      ─┘        ↓
                          CALC RATE: 0.92
                               ↓
                          VALIDATE: 0.85-1.10 ✅
                               ↓
                          SCORE: 100 points
                               ↓
                          ACCEPT ✅
                          (Correct Match)
```

---

## Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                  AP RECONCILIATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Stage 1: Exact 1-to-1 Matching                                │
│  │  └─ Date + Amount + Vendor                                  │
│  │                                                              │
│  Stage 2: One-to-Many Matching                                 │
│  │  └─ 1 Vendor Txn → 2-5 AP Entries                          │
│  │                                                              │
│  Stage 3: Many-to-One Matching                                 │
│  │  └─ 2-5 Vendor Txns → 1 AP Entry                           │
│  │                                                              │
│  Stage 4: FX Matching (NEW) ◄──── INTEGRATION POINT            │
│  │  ├─ Check if FX scenario                                    │
│  │  ├─ Calculate implied rate                                  │
│  │  ├─ Validate rate                                           │
│  │  ├─ Score match                                             │
│  │  └─ Accept if score ≥ 60                                   │
│  │                                                              │
│  Result: Matched Pairs + Unmatched Items                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Formulas

### Implied Rate Calculation
```
rate = |AP Amount| / |Vendor Amount|

Example:
  AP: 649.12 EUR
  Vendor: 705.57 USD
  rate = 649.12 / 705.57 = 0.9200
  
Interpretation: 1 USD = 0.92 EUR
```

### Rate Validation
```
valid = (rate >= bounds.min) AND (rate <= bounds.max)

Example (USD→EUR):
  bounds = { min: 0.85, max: 1.10 }
  rate = 0.9200
  valid = (0.9200 >= 0.85) AND (0.9200 <= 1.10)
  valid = true ✅
```

### Confidence Score
```
score = invoice_score + vendor_score + date_score + rate_score

Example:
  invoice_score = 45  (PAC-1000 matches)
  vendor_score = 25   (Pacific Logistics matches)
  date_score = 15     (same date)
  rate_score = 15     (rate realistic)
  
  score = 45 + 25 + 15 + 15 = 100
  
Threshold:
  score ≥ 80 → HIGH confidence (auto-approved)
  score ≥ 60 → MEDIUM confidence (review)
  score < 60 → LOW confidence (rejected)
```

---

**Status:** ✅ Implementation Complete

This flow diagram documents the complete FX matching logic from detection through display.
