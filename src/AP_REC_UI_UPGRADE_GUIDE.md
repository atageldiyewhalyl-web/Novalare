# AP Reconciliation UI Upgrade Guide
## Copy Bank Reconciliation Design to AP Reconciliation

**Goal:** Make AP Rec look exactly like Bank Rec with colored badges, status indicators, and many-to-one dropdown displays.

---

## 🎨 Design Elements to Copy

### 1. Match Type Badges (Colored)
- **exact** → Purple (`bg-violet-50 text-violet-700 border-violet-200`)
- **Tolerance** → Green (`bg-green-50 text-green-700 border-green-200`)
- **2:1, 3:1, etc.** → Orange/Amber (`bg-amber-50 text-amber-700 border-amber-200`)
- **FX** → Blue (`bg-blue-50 text-blue-700 border-blue-200`)

### 2. Status Badges (Next to Confidence)
- **Review Required** → Red (`bg-red-50 text-red-700 border-red-200`)
- **Review** → Yellow (`bg-yellow-50 text-yellow-700 border-yellow-200`)  
- **✓** → Green checkmark (`bg-green-50 text-green-700 border-green-200`)

### 3. Many-to-One Display
- Show "X Combined Transactions" in description column
- Bullet list of individual transaction descriptions
- Show sum amount + breakdown of individual amounts

---

## 📝 Step-by-Step Implementation

### STEP 1: Update Interface (Line ~57)

**File:** `/components/devportal/workflows/APReconciliation.tsx`

**Find:**
```typescript
interface MatchedPair {
  vendor_transaction: VendorTransaction;
  ap_entries: APLedgerEntry[];
  match_confidence: number;
  match_type: string;
  explanation?: string;
}
```

**Replace with:**
```typescript
interface MatchedPair {
  vendor_transaction: VendorTransaction;
  ap_entries: APLedgerEntry[];
  match_confidence: number;
  match_type: string;
  explanation?: string;
  match_status?: 'auto_approved' | 'review_recommended' | 'manual_review_required';
  match_flags?: any;
  additional_vendor_transactions?: VendorTransaction[];
}
```

---

### STEP 2: Update Description Column (Line ~1495-1497)

**Find:**
```tsx
<td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white' : 'py-4 px-6 text-sm text-gray-900'}>
  {match.vendor_transaction.description}
</td>
```

**Replace with:**
```tsx
<td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white' : 'py-4 px-6 text-sm text-gray-900'}>
  {/* Show grouped description for many-to-one */}
  {match.match_type === 'many_to_one' && match.additional_vendor_transactions && match.additional_vendor_transactions.length > 0 ? (
    <div>
      <span className="font-medium">{match.additional_vendor_transactions.length + 1} Combined Transactions</span>
      <div className="text-xs text-gray-500 mt-1">
        <div>• {match.vendor_transaction.description?.substring(0, 40) || 'Unknown'}</div>
        {match.additional_vendor_transactions.map((vt, i) => (
          <div key={i}>• {vt.description?.substring(0, 40) || 'Unknown'}</div>
        ))}
      </div>
    </div>
  ) : (
    match.vendor_transaction.description
  )}
</td>
```

---

### STEP 3: Update Amount Column (Line ~1498-1500)

**Find:**
```tsx
<td className={`py-4 px-6 text-sm font-medium ${match.vendor_transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
  €{formatCurrency(Math.abs(match.vendor_transaction.amount))}
</td>
```

**Replace with:**
```tsx
<td className={`py-4 px-6 text-sm font-medium ${match.vendor_transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
  {/* Show sum for many-to-one */}
  {match.match_type === 'many_to_one' && match.additional_vendor_transactions && match.additional_vendor_transactions.length > 0 ? (
    <div>
      <div className={(
        match.additional_vendor_transactions.reduce((sum, vt) => sum + vt.amount, match.vendor_transaction.amount)
      ) >= 0 ? 'text-green-600' : 'text-red-600'}>
        €{Math.abs(match.additional_vendor_transactions.reduce((sum, vt) => sum + vt.amount, match.vendor_transaction.amount)).toFixed(2)}
      </div>
      <div className="text-xs font-normal mt-1">
        <div className={match.vendor_transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
          €{Math.abs(match.vendor_transaction.amount).toFixed(2)}
        </div>
        {match.additional_vendor_transactions.map((vt, i) => (
          <div key={i} className={vt.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
            €{Math.abs(vt.amount).toFixed(2)}
          </div>
        ))}
      </div>
    </div>
  ) : (
    <span className={match.vendor_transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
      €{Math.abs(match.vendor_transaction.amount).toFixed(2)}
    </span>
  )}
</td>
```

---

### STEP 4: Update Type Badge (Line ~1501-1512)

**Find:**
```tsx
<td className="py-4 px-6">
  <Badge 
    variant="outline" 
    className={theme === 'premium-dark' ? 'bg-white/[0.05] text-white border-white/10' : 'bg-gray-50 text-gray-600 border-gray-200'}
  >
    {match.match_type === 'exact_match' ? 'exact' 
      : match.match_type === 'deterministic_multi' ? '1:many'
      : match.match_type === 'ai_fuzzy_multi' ? 'AI multi'
      : match.match_type === 'ai_fuzzy' ? 'AI'
      : match.match_type}
  </Badge>
</td>
```

**Replace with:**
```tsx
<td className="py-4 px-6">
  <Badge 
    variant="outline" 
    className={
      match.match_type === 'exact_match' 
        ? 'bg-violet-50 text-violet-700 border-violet-200' 
        : match.match_type === 'one_to_many'
        ? 'bg-green-50 text-green-700 border-green-200'
        : match.match_type === 'many_to_one'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : match.match_type === 'fx_tolerance'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'
    }
  >
    {match.match_type === 'exact_match' ? 'exact' 
      : match.match_type === 'one_to_many' ? '1:many'
      : match.match_type === 'many_to_one' ? `${(match.additional_vendor_transactions?.length || 0) + 1}:1`
      : match.match_type === 'fx_tolerance' ? 'Tolerance'
      : match.match_type}
  </Badge>
</td>
```

---

### STEP 5: Update Confidence Column with Status Badges (Line ~1513-1515)

**Find:**
```tsx
<td className="py-4 px-6 text-sm text-gray-600">
  {match.match_confidence}%
</td>
```

**Replace with:**
```tsx
<td className="py-4 px-6">
  <div className="flex items-center gap-2">
    <span className="text-sm text-gray-600">
      {typeof match.match_confidence === 'number' ? Math.round(match.match_confidence) : match.match_confidence}%
    </span>
    {/* Status badge */}
    {match.match_status === 'manual_review_required' && (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
        Review Required
      </Badge>
    )}
    {match.match_status === 'review_recommended' && (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
        Review
      </Badge>
    )}
    {match.match_status === 'auto_approved' && (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        ✓
      </Badge>
    )}
  </div>
</td>
```

---

## ✅ Expected Result

After making these changes, your AP Reconciliation will have:

1. ✅ **Purple "exact" badges** - Just like Bank Rec
2. ✅ **Green "Tolerance" badges** - Matching Bank Rec style
3. ✅ **Orange "2:1, 3:1" badges** - For many-to-one matches
4. ✅ **"Review Required" red badges** - For low confidence matches
5. ✅ **"Review" yellow badges** - For medium confidence matches
6. ✅ **Green "✓" badges** - For auto-approved matches
7. ✅ **Many-to-one dropdown displays** - "X Combined Transactions" with bullet lists
8. ✅ **Amount breakdowns** - Total + individual amounts for grouped matches

---

## 🎨 Color Reference (Copy from Bank Rec)

```tsx
// Match Type Colors
exact_match: 'bg-violet-50 text-violet-700 border-violet-200'     // Purple
one_to_many: 'bg-green-50 text-green-700 border-green-200'        // Green  
many_to_one: 'bg-amber-50 text-amber-700 border-amber-200'        // Orange/Amber
fx_tolerance: 'bg-blue-50 text-blue-700 border-blue-200'          // Blue

// Status Colors
manual_review_required: 'bg-red-50 text-red-700 border-red-200'   // Red
review_recommended: 'bg-yellow-50 text-yellow-700 border-yellow-200' // Yellow
auto_approved: 'bg-green-50 text-green-700 border-green-200'      // Green
```

---

## 📸 Visual Reference

Look at your screenshot:
- **Line 1 (Hicks Hardware):** Purple "exact" badge + "100%" + Green "✓"
- **Line 7 (Unknown Merchant):** Green "Tolerance" badge + "35%" + Red "Review Required"
- **Line 10 (2 Combined Transactions):** Orange "2:1" badge + "44%" + Red "Review Required"

This is exactly what AP Rec should look like!

---

## 🚀 Testing

After making changes, test with:
1. Run AP reconciliation with sample data
2. Check that match_status field is populated from backend
3. Verify many-to-one matches show "X Combined Transactions"
4. Confirm badge colors match Bank Rec
5. Verify status badges appear next to confidence percentages

The backend already populates `match_status`, `match_flags`, and `additional_vendor_transactions` from Phase 2 & 3.1 upgrades!
