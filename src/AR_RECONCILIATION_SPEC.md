# AR Reconciliation (Cash Application) - Technical Specification

**Last Updated:** December 31, 2025  
**Status:** Planning / Not Yet Implemented  
**Related Modules:** Bank Reconciliation (completed), AP Reconciliation (completed)

---

## 1. What is AR Reconciliation For?

### **Purpose:**
AR Reconciliation (Cash Application method) answers the critical business question:

> **"Did our customers actually pay the invoices we sent them?"**

### **Business Problem It Solves:**
- Accountants have **open invoices** (AR ledger entries) showing money customers owe
- They have **bank deposits** showing money that actually arrived
- They need to **match them together** to know:
  - Which invoices are paid
  - Which invoices remain unpaid
  - Which bank deposits are unidentified (mystery money)

### **Key Difference from AP Reconciliation:**
- **AP Reconciliation**: "Did WE pay our vendors?" (outflows, vendor statements)
- **AR Reconciliation**: "Did CUSTOMERS pay us?" (inflows, bank statements)

---

## 2. How Does It Work?

### **High-Level Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User already uploaded bank statements (for Bank Rec)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Novalare extracts INFLOWS from bank statements           │
│    (amount > 0 or transaction_type = 'CREDIT')              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. User connects AR ledger (QuickBooks/Xero or CSV upload)  │
│    Contains: Invoice #, Customer, Amount, Date, Status      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Matching Engine compares:                                │
│    - Bank inflows (actual payments received)                │
│    - AR ledger entries (invoices owed)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Output:                                                   │
│    ✅ Matched: Bank deposit → Invoice                       │
│    ⚠️  Unmatched Inflows: Mystery money received            │
│    ❌ Unmatched Invoices: Unpaid invoices                   │
└─────────────────────────────────────────────────────────────┘
```

### **Data Sources:**

| Source | What It Contains | Where It Comes From |
|--------|------------------|---------------------|
| **Bank Inflows** | Customer payments that hit the bank | Bank statements (already uploaded for Bank Rec) |
| **AR Ledger** | Open/unpaid invoices | QuickBooks, Xero, or CSV upload |

### **Key Insight:**
**NO additional data uploads required.** Bank data is already in the system from Bank Reconciliation.

---

## 3. Implementation Plan

### **Phase 1: Data Layer (Backend)**
1. Create AR ledger upload endpoint
   - Accept CSV format (Invoice #, Customer, Date, Amount, Currency, Status)
   - Accept QuickBooks/Xero API integration (future)
   - Store in KV store: `ar_ledger_{companyId}_{period}`

2. Create bank inflow extraction function
   - Query existing bank transactions: `bank_transactions_{companyId}_{period}`
   - Filter: `WHERE amount > 0 OR transaction_type = 'CREDIT'`
   - Return: Date, Description, Amount, Currency, Reference

3. Store reconciliation configuration
   - Key: `ar_rec_config_{companyId}`
   - Contains: Period selection, AR ledger source, matching rules

### **Phase 2: Matching Engine**
Location: `/supabase/functions/server/ar-rec-routes.tsx`

Key function: `runARReconciliation(companyId, period)`

**Matching Algorithm** (see section 4 below)

### **Phase 3: Frontend UI**
Location: `/components/devportal/workflows/ARReconciliation.tsx`

**UI Components:**
1. Period selector (same as Bank/AP rec)
2. AR ledger upload section
3. "Run Reconciliation" button
4. Results display:
   - Summary statistics card
   - Matched pairs table
   - Unmatched inflows table
   - Unmatched invoices table
5. Export to Excel (ExcelJS formatted)

### **Phase 4: Review & Approval Workflow**
Location: `/components/devportal/workflows/ARRecReview.tsx`

- Manual matching interface for unmatched items
- Apply payment to invoice
- Split payments across multiple invoices
- Mark invoice as "Paid outside bank" or "Write-off"

---

## 4. Matching Engine Design

### **Reference Prior Work:**

| Feature | Bank Rec | AP Rec | AR Rec (New) |
|---------|----------|--------|--------------|
| **Primary match** | Exact amount | Exact amount + vendor | Exact amount + customer |
| **Fuzzy matching** | Description | Vendor name (Levenshtein) | Customer name (Levenshtein) |
| **Date tolerance** | ±5 days | ±7 days | ±14 days (customers pay late!) |
| **FX normalization** | ✅ Yes | ✅ Yes | ✅ Yes (same logic) |
| **Subset-sum** | N/A | ✅ Yes (multiple invoices) | ✅ Yes (partial payments) |
| **Weighted scoring** | N/A | ✅ Yes (0-95 points) | ✅ Yes (0-95 points) |

### **AR Matching Engine Scoring System:**

```typescript
interface ARMatchScore {
  total: number;        // 0-95 points
  breakdown: {
    amount: number;     // 0-40 points
    customer: number;   // 0-30 points
    date: number;       // 0-15 points
    reference: number;  // 0-10 points
  };
  match_type: 'exact' | 'partial' | 'multi_invoice' | 'fuzzy';
  confidence: number;   // total score as percentage
}
```

### **Matching Rules (Priority Order):**

#### **Rule 1: Exact Match (95 points)**
- Bank inflow amount === Invoice amount (±0.01 for rounding)
- Customer name match (Levenshtein distance ≤ 2)
- Date within ±14 days
- **Example:** €1,000.00 from "ABC Ltd" → Invoice #101 for €1,000.00 to "ABC Limited"

#### **Rule 2: Reference Match (90 points)**
- Bank description contains invoice number ("INV-101", "#101", "Ref:101")
- Amount matches exactly
- **Example:** "+€1,000 Ref:INV-101" → Invoice #101

#### **Rule 3: Partial Payment (75-85 points)**
- Bank inflow < Invoice amount
- Customer name matches
- Remaining balance tracked
- **Example:** €500 from "XYZ Co" → Invoice #102 for €1,000 (50% paid)

#### **Rule 4: Multi-Invoice Payment (70-85 points)**
- Bank inflow = SUM of multiple invoices (subset-sum algorithm)
- Same customer
- All invoices within date range
- **Example:** €1,500 from "ABC Ltd" → Invoice #101 (€1,000) + Invoice #103 (€500)

#### **Rule 5: Fuzzy Match (60-70 points)**
- Amount matches exactly
- Customer name similarity > 70% (Levenshtein)
- Date within ±21 days (extended window)
- **Example:** "A.B.C. Corporation" → "ABC Corp Ltd"

#### **Rule 6: No Match (<60 points)**
- Show as unmatched
- Require manual review

### **FX Normalization (Reuse AP Logic):**
```typescript
// From AP rec engine - REUSE THIS
function normalizeCurrency(amount: number, currency: string, baseCurrency: string): number {
  // Use exchange rates from bank statement extraction
  // Handle JPY special case (no decimal places)
  // Return normalized amount in base currency
}
```

### **Subset-Sum Algorithm (Reuse AP Logic):**
```typescript
// From AP rec engine - REUSE THIS
function findInvoiceCombinations(bankAmount: number, invoices: Invoice[]): Invoice[][] {
  // Dynamic programming approach
  // Find all combinations of invoices that sum to bank amount
  // Limit: Max 5 invoices per combination (performance)
}
```

---

## 5. Data Flow: Pulling Bank Inflows

### **Where Bank Data Currently Lives:**

**Bank Reconciliation Flow:**
1. User uploads bank statement PDF → `/upload-bank-statement`
2. Backend extracts transactions → Stored in KV: `bank_transactions_{companyId}_{period}`
3. Bank rec uses ALL transactions (inflows + outflows)

**AR Reconciliation Flow (Reuse):**
1. Query existing bank transactions: `bank_transactions_{companyId}_{period}`
2. Filter for **inflows only**:
   ```typescript
   const bankInflows = allTransactions.filter(txn => 
     txn.amount > 0 || 
     txn.transaction_type === 'CREDIT' ||
     txn.transaction_type === 'DEPOSIT'
   );
   ```
3. Use filtered inflows for AR matching

### **Data Structure:**

**Bank Transaction (from KV store):**
```typescript
interface BankTransaction {
  date: string;               // "2025-01-15"
  description: string;        // "Payment from ABC Ltd Ref:INV-101"
  amount: number;             // 1000.00
  transaction_type: string;   // "CREDIT" | "DEBIT"
  currency: string;           // "EUR"
  balance: number;            // Running balance
  reference?: string;         // Optional reference number
}
```

**AR Ledger Entry (to be stored):**
```typescript
interface ARLedgerEntry {
  invoice_number: string;     // "INV-101"
  customer: string;           // "ABC Ltd"
  date: string;               // "2025-01-10"
  amount: number;             // 1000.00
  currency: string;           // "EUR"
  status: string;             // "Open" | "Paid" | "Overdue"
  due_date?: string;          // "2025-02-10"
  description?: string;       // "Consulting services"
}
```

**Matched Pair Output:**
```typescript
interface ARMatchedPair {
  bank_transaction: BankTransaction;
  ar_entries: ARLedgerEntry[];        // Can be multiple invoices
  match_type: 'exact' | 'partial' | 'multi_invoice' | 'fuzzy';
  match_score: ARMatchScore;
  match_confidence: number;           // 0-100%
  explanation: string;                // Human-readable explanation
  amount_applied: number;             // How much of bank inflow was applied
  remaining_balance?: number;         // For partial payments
}
```

---

## 6. Key Differences from AP Reconciliation

### **Conceptual Differences:**

| Aspect | AP Reconciliation | AR Reconciliation |
|--------|-------------------|-------------------|
| **Direction** | Money OUT (we pay vendors) | Money IN (customers pay us) |
| **External source** | Vendor statements (PDF upload) | Bank inflows (reuse existing) |
| **Internal source** | AP ledger | AR ledger |
| **Timing** | We control when we pay | Customers control when they pay (longer delays!) |
| **Matching complexity** | Vendor name + amount | Customer name + invoice ref + amount |
| **Date tolerance** | ±7 days | ±14 days (customers are slower) |

### **Implementation Differences:**

| Component | AP Rec (Existing) | AR Rec (New) |
|-----------|-------------------|--------------|
| **Upload endpoint** | `/upload-vendor-statement` | **NO UPLOAD** (reuse bank data) |
| **Extraction** | Extract vendor transactions from PDF | Filter bank transactions for inflows |
| **Matching engine** | `/supabase/functions/server/ap-rec-routes.tsx` | `/supabase/functions/server/ar-rec-routes.tsx` (NEW) |
| **Frontend** | `/components/devportal/workflows/APReconciliation.tsx` | `/components/devportal/workflows/ARReconciliation.tsx` (NEW) |
| **Export format** | ExcelJS with AP labels | ExcelJS with AR labels (customer, invoice, payment) |

### **Code Reuse Opportunities:**

✅ **Can Reuse:**
- FX normalization logic
- Subset-sum algorithm for multi-invoice matching
- Weighted scoring system (0-95 points)
- Fuzzy string matching (Levenshtein distance)
- ExcelJS export formatting structure
- Summary statistics calculation
- React Query caching patterns

❌ **Cannot Reuse (AR-specific):**
- Data source (bank inflows vs vendor statements)
- Customer name matching (different from vendor matching)
- Invoice reference extraction (unique to AR)
- Longer date tolerance (customers pay slower)
- Partial payment tracking (more common in AR)

---

## 7. Backend Implementation Details

### **File Structure:**
```
/supabase/functions/server/
  ├── ar-rec-routes.tsx          (NEW - main AR reconciliation engine)
  ├── ar-rec-matching.tsx        (NEW - matching algorithm)
  ├── ar-rec-utils.tsx           (NEW - AR-specific utilities)
  ├── ap-rec-routes.tsx          (EXISTING - reference for structure)
  └── bank-rec-routes.tsx        (EXISTING - bank data source)
```

### **API Endpoints:**

#### **1. Upload AR Ledger**
```
POST /make-server-53c2e113/ar-rec/upload-ledger
Body: { companyId, period, ledgerData[] }
Response: { success, recordCount }
```

#### **2. Run AR Reconciliation**
```
POST /make-server-53c2e113/ar-rec/reconcile
Body: { companyId, period }
Response: { 
  summary: { total_invoices, total_inflows, matched, unmatched },
  matched_pairs: [],
  unmatched_inflows: [],
  unmatched_invoices: []
}
```

#### **3. Get AR Reconciliation Results**
```
GET /make-server-53c2e113/ar-rec/reconciliation?companyId=X&period=Y
Response: { reconciliation: { ... } }
```

#### **4. Manual Match**
```
POST /make-server-53c2e113/ar-rec/manual-match
Body: { companyId, period, inflowId, invoiceIds[] }
Response: { success, updatedReconciliation }
```

### **KV Store Keys:**

| Key | Value | Purpose |
|-----|-------|---------|
| `ar_ledger_{companyId}_{period}` | ARLedgerEntry[] | AR ledger data |
| `ar_reconciliation_{companyId}_{period}` | ReconciliationResult | Matching results |
| `ar_rec_config_{companyId}` | Config | User preferences |
| `bank_transactions_{companyId}_{period}` | BankTransaction[] | **EXISTING** - reuse for inflows |

---

## 8. Frontend Implementation Details

### **File Structure:**
```
/components/devportal/workflows/
  ├── ARReconciliation.tsx       (NEW - main AR rec page)
  ├── ARRecReview.tsx            (NEW - review/approval page)
  ├── ARRecExport.tsx            (NEW - Excel export)
  ├── APReconciliation.tsx       (EXISTING - reference for UI structure)
  └── BankReconciliation.tsx     (EXISTING - reference for UI patterns)
```

### **UI Components:**

#### **ARReconciliation.tsx Structure:**
1. **Period Selector** (reuse from AP/Bank)
2. **AR Ledger Upload Section**
   - CSV upload button
   - QuickBooks/Xero connect button (future)
   - Preview uploaded data
3. **Bank Inflows Preview**
   - Auto-load from existing bank data
   - Show count: "23 customer payments found"
   - No upload needed (just display)
4. **Run Reconciliation Button**
5. **Summary Statistics Card**
   - Total invoices
   - Total bank inflows
   - Match rate %
   - Total matched amount
   - Outstanding balance
6. **Results Tabs**
   - Matched (green)
   - Unmatched Inflows (yellow - mystery money)
   - Unmatched Invoices (red - unpaid)
7. **Export to Excel Button**

#### **ARRecReview.tsx Structure:**
1. **Manual Matching Interface**
   - Drag & drop invoice to payment
   - Split payment across multiple invoices
   - Apply partial payment
2. **Actions**
   - Mark as "Paid Outside Bank"
   - Mark as "Write-off"
   - Mark as "Payment Pending"
3. **Approval Workflow**
   - Review suggested matches
   - Approve/reject
   - Add notes

### **React Query Integration:**
```typescript
// Fetch AR reconciliation results
const { data: reconciliationResult } = useQuery({
  queryKey: ['ar-reconciliation', companyId, selectedPeriod],
  queryFn: () => fetchARReconciliation(companyId, selectedPeriod),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Fetch bank inflows (reuse existing bank data)
const { data: bankInflows } = useQuery({
  queryKey: ['bank-inflows', companyId, selectedPeriod],
  queryFn: () => fetchBankInflows(companyId, selectedPeriod),
  staleTime: 10 * 60 * 1000, // 10 minutes (bank data rarely changes)
});
```

---

## 9. Excel Export Format

**File name:** `AR_Reconciliation_{CompanyName}_{Period}_{Date}.xlsx`

### **Sheet 1: Summary**
- Novalare logo (top left)
- "AR RECONCILIATION SUMMARY" header (#65D3FD blue)
- Company info, period, report date
- Statistics: Total invoices, total inflows, match rate
- Financial summary: Total billed, total received, outstanding balance

### **Sheet 2: Matched Payments**
Columns:
- Bank Date | Bank Description | Bank Amount
- Invoice # | Customer | Invoice Date | Invoice Amount
- Match Type | Confidence | Explanation

### **Sheet 3: Unmatched Inflows**
Columns:
- Bank Date | Description | Amount | Suggested Customer | Suggested Action

### **Sheet 4: Unmatched Invoices (Unpaid)**
Columns:
- Invoice # | Customer | Invoice Date | Amount | Days Overdue | Status

**Formatting:**
- Same ExcelJS styling as AP rec (reuse code)
- Color-coded tabs: Green (matched), Yellow (unmatched inflows), Red (unpaid)
- Currency symbols based on company base currency
- Bold headers, frozen header rows

---

## 10. Currency Handling

### **Reuse AP Rec FX Logic:**

```typescript
// From APReconciliation.tsx - REUSE THIS
const getCurrencySymbol = () => {
  const curr = reconciliationResult?.base_currency || 'EUR';
  const symbols: { [key: string]: string } = {
    USD: '$', GBP: '£', EUR: '€', JPY: '¥', CNY: '¥',
    AUD: 'A$', CAD: 'C$', CHF: 'CHF', SEK: 'kr', NOK: 'kr',
    DKK: 'kr', PLN: 'zł', CZK: 'Kč', HUF: 'Ft', RON: 'lei',
    BGN: 'лв', HRK: 'kn', RUB: '₽', TRY: '₺', INR: '₹', BRL: 'R$'
  };
  return symbols[curr] || curr + ' ';
};
```

### **FX Normalization:**
- If invoice is in EUR and bank inflow is in USD → normalize to base currency
- Use exchange rates from bank statement extraction (already available)
- Handle JPY special case (no decimal places)

---

## 11. Edge Cases to Handle

### **Case 1: Partial Payments**
**Scenario:** Customer pays €500 for a €1,000 invoice
**Solution:**
- Match as "partial payment"
- Track remaining balance (€500)
- Allow second payment to match same invoice
- Update invoice status: "Partially Paid"

### **Case 2: Overpayment**
**Scenario:** Customer pays €1,100 for a €1,000 invoice
**Solution:**
- Match invoice fully
- Create "Customer Credit" entry for €100
- Allow credit to be applied to future invoices

### **Case 3: Multi-Invoice Payment**
**Scenario:** Customer pays €2,500 covering 3 invoices (€1,000 + €800 + €700)
**Solution:**
- Use subset-sum algorithm
- Match all 3 invoices to single payment
- Display in UI with expandable row

### **Case 4: Payment Before Invoice**
**Scenario:** Bank inflow on Jan 5, invoice dated Jan 10
**Solution:**
- Allow negative date tolerance (payment can come first)
- Match if customer name + amount align
- Flag for review: "Early payment - verify invoice"

### **Case 5: Customer Name Variations**
**Scenario:** Invoice: "ABC Corporation Ltd", Bank: "A.B.C. Corp"
**Solution:**
- Levenshtein distance fuzzy matching
- Remove common suffixes (Ltd, Inc, Corp, LLC)
- Normalize: Remove dots, spaces, lowercase comparison

### **Case 6: Reference Number Extraction**
**Scenario:** Bank description: "Payment ABC Ltd Ref:INV-101 Thank you"
**Solution:**
- Regex patterns: `/INV-?\d+/`, `/#\d+/`, `/Ref:[\w-]+/`
- Extract invoice number
- Boost match score if reference matches

### **Case 7: Bank Fees Deducted**
**Scenario:** Invoice €1,000, bank inflow €985 (€15 bank fee)
**Solution:**
- Allow tolerance threshold (±2% or ±€20)
- Match as "exact with fees"
- Flag difference amount for review

---

## 12. Success Metrics

### **KPIs to Track:**
- **Match Rate**: % of invoices matched to payments
- **Auto-Match Rate**: % matched without manual intervention
- **Time Saved**: Minutes saved vs manual cash application
- **Accuracy**: % of correct matches (user feedback)

### **Expected Performance:**
- **Auto-match rate**: 70-80% (vs AP rec: 60-70%, vs Bank rec: 85-90%)
- **Match rate**: 90%+ (after manual review)
- **Processing time**: <5 seconds for 500 transactions

---

## 13. Future Enhancements

### **Phase 2 (Post-MVP):**
1. **QuickBooks/Xero API Integration**
   - Auto-fetch AR ledger (no CSV upload)
   - Auto-sync invoice status back to QB/Xero

2. **Aging Report Integration**
   - Show 30/60/90 day aging
   - Highlight overdue invoices

3. **Customer Portal**
   - Customers can view their invoices
   - Self-serve payment matching

4. **Automated Reminders**
   - Email customers for unpaid invoices
   - Based on AR rec results

5. **Cash Flow Forecasting**
   - Predict future payments based on historical patterns
   - Show expected collection dates

6. **Machine Learning Enhancements**
   - Learn from manual matches
   - Improve fuzzy matching over time
   - Predict customer payment behavior

### **Phase 3 (Advanced):**
1. **Multi-Currency AR** (if not in MVP)
2. **Dispute Management** (mark invoice as disputed)
3. **Dunning Letters** (automated collections)
4. **Payment Plans** (split invoice into installments)

---

## 14. Testing Checklist

### **Unit Tests:**
- [ ] FX normalization (EUR/USD/JPY/GBP)
- [ ] Fuzzy customer name matching
- [ ] Subset-sum algorithm (multi-invoice)
- [ ] Partial payment logic
- [ ] Reference number extraction
- [ ] Date tolerance calculation

### **Integration Tests:**
- [ ] Bank inflow extraction from existing data
- [ ] AR ledger upload (CSV)
- [ ] Full reconciliation flow
- [ ] Manual match override
- [ ] Excel export generation

### **E2E Tests:**
- [ ] Upload AR ledger → Run rec → Export Excel
- [ ] Manual match → Re-run rec → Verify update
- [ ] Multiple periods → Switch between them

### **Edge Case Tests:**
- [ ] Partial payment → Second payment → Full match
- [ ] Overpayment → Credit balance
- [ ] Multi-invoice payment (3+ invoices)
- [ ] Payment before invoice (negative date)
- [ ] Zero-amount invoice (credit memo)
- [ ] Duplicate invoice numbers

---

## 15. Open Questions / Decisions Needed

### **Question 1: How to handle AR ledger source?**
- **Option A**: CSV upload only (MVP)
- **Option B**: QuickBooks/Xero API integration (later)
- **Decision**: Start with CSV, add API later

### **Question 2: Should we support "unapply" payment?**
- **Scenario**: User matched payment to wrong invoice
- **Solution**: Add "Unapply" button to undo match
- **Decision**: YES - include in MVP

### **Question 3: How to handle customer credits?**
- **Scenario**: Customer has overpaid or returned goods
- **Solution**: Support negative AR entries (credit memos)
- **Decision**: TBD

### **Question 4: Should we auto-apply small differences?**
- **Example**: Invoice €1,000.00, Payment €999.95
- **Solution**: Auto-match if difference < €1 or < 1%
- **Decision**: TBD (user preference setting?)

### **Question 5: How to handle bank inflows that are NOT customer payments?**
- **Examples**: Loan deposits, interest income, refunds
- **Solution**: Allow user to mark inflow as "Not AR-related"
- **Decision**: TBD

---

## 16. Implementation Timeline Estimate

### **Phase 1: Backend Core (3-5 days)**
- AR ledger upload endpoint
- Bank inflow extraction
- Matching engine (basic exact match)
- KV storage

### **Phase 2: Matching Engine Advanced (3-4 days)**
- Fuzzy matching
- Subset-sum (multi-invoice)
- Partial payments
- Weighted scoring

### **Phase 3: Frontend UI (4-5 days)**
- AR ledger upload UI
- Results display
- Summary statistics
- Manual matching interface

### **Phase 4: Excel Export (1-2 days)**
- ExcelJS formatting
- AR-specific sheets
- Currency handling

### **Phase 5: Testing & Polish (2-3 days)**
- Edge case testing
- Bug fixes
- Performance optimization

**Total Estimate: 13-19 days**

---

## 17. Dependencies

### **Must Have Before Starting:**
- ✅ Bank reconciliation (completed - provides bank data)
- ✅ AP reconciliation (completed - reference for matching engine)
- ✅ Company management (completed - provides companyId)
- ✅ Period selection (completed - reuse from AP/Bank)

### **External Libraries:**
- ✅ ExcelJS (already in use for AP export)
- ✅ React Query (already in use)
- ✅ Levenshtein distance (already in use for AP vendor matching)

### **No Additional Dependencies Needed!**

---

## 18. Code References

### **Files to Reference:**
```
✅ Matching Logic:
   /supabase/functions/server/ap-rec-routes.tsx
   - Line ~200-500: runAPReconciliation() function
   - Subset-sum algorithm
   - FX normalization
   - Weighted scoring

✅ Frontend Structure:
   /components/devportal/workflows/APReconciliation.tsx
   - Period selector pattern
   - Summary statistics display
   - Results tables
   - Export button

✅ Excel Export:
   /components/devportal/workflows/APRecExport.tsx
   - ExcelJS formatting
   - Novalare branding
   - Currency formatting
   - Color-coded tabs

✅ Bank Data Access:
   /supabase/functions/server/bank-rec-routes.tsx
   - Bank transaction structure
   - KV key naming pattern
```

---

## 19. Final Notes

### **Why This Is Better Than Competitors:**
1. **No duplicate uploads**: Reuses bank data already in system
2. **Fast**: Processes 500+ transactions in <5 seconds
3. **Smart**: Multi-invoice matching, partial payments, fuzzy names
4. **Beautiful exports**: Branded Excel reports
5. **Zero learning curve**: Same UI as AP/Bank rec

### **Key Differentiator:**
> "Upload your bank statements once. Get Bank, AP, AND AR reconciliation automatically."

No competitor does this. They all require separate uploads.

---

**END OF AR RECONCILIATION SPECIFICATION**

*This document will be updated as implementation progresses.*
