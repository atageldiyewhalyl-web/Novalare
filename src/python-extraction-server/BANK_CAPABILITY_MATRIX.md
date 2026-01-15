# Bank Capability Matrix (Statement Model Framework)

## Overview

Different banks use different **accounting presentation models** in their statements. Our extraction system must adapt to each model while maintaining consistent output semantics.

This document formalizes the **bank capability profile** system.

---

## Statement Models

### Model A: Running Balance (`running_balance`)

**Used by**: Chase, Bank of America, Capital One, Wells Fargo, most US banks

**Structure**:
```
Date       | Description          | Amount   | Balance
-----------|---------------------|----------|----------
10/15/2025 | Amazon Purchase     | -50.00   | 1,450.00
10/16/2025 | Salary Deposit      | 2,000.00 | 3,450.00
10/17/2025 | Rent Payment        | -1,200.00| 2,250.00
```

**Characteristics**:
- ✅ Per-row running balance
- ✅ Single amount column (positive = credit, negative = debit)
- ✅ Balance continuity validation possible
- ✅ US date format (MM/DD/YYYY)
- ✅ Decimal point for cents (1,234.56)

**Schema**:
```json
{
  "statement_model": "running_balance",
  "has_balance_column": true,
  "columns": {
    "date": {"x_min": 40, "x_max": 110},
    "description": {"x_min": 120, "x_max": 360},
    "amount": {"x_min": 370, "x_max": 450},
    "balance": {"x_min": 460, "x_max": 540}
  },
  "date_format": "MM/DD/YYYY",
  "currency_format": "1234.56"
}
```

**Validation Strategy**:
```python
for i in range(1, len(transactions)):
    expected_balance = prev_transaction['balance'] + curr_transaction['amount']
    if abs(expected_balance - curr_transaction['balance']) > 0.02:
        raise BalanceContinuityError()
```

---

### Model B: Soll/Haben (`soll_haben`)

**Used by**: Deutsche Bank, Sparkasse, Commerzbank, Postbank, most German banks

**Structure**:
```
Buchung    | Valuta     | Vorgang                  | Soll    | Haben
-----------|------------|--------------------------|---------|--------
20.10.2025 | 20.10.2025 | Kartenzahlung Amazon     | 50,00   | -
21.10.2025 | 21.10.2025 | Gehalt                   | -       | 2.000,00
22.10.2025 | 22.10.2025 | Miete                    | 1.200,00| -

Neuer Saldo: EUR 2.250,00
```

**Characteristics**:
- ❌ NO per-row balance
- ✅ Separate Soll (debit) and Haben (credit) columns
- ✅ Statement-level balance only ("Neuer Saldo", "Alter Saldo")
- ✅ European date format (DD.MM.YYYY)
- ✅ Comma for decimal (1.234,56)

**Schema**:
```json
{
  "statement_model": "soll_haben",
  "has_balance_column": false,
  "columns": {
    "date": {"x_min": 40, "x_max": 110},
    "description": {"x_min": 120, "x_max": 360},
    "soll": {"x_min": 370, "x_max": 450},
    "haben": {"x_min": 460, "x_max": 540}
  },
  "statement_balance_markers": ["Neuer Saldo", "Alter Saldo"],
  "date_format": "DD.MM.YYYY",
  "currency_format": "1.234,56"
}
```

**Validation Strategy**:
```python
# Skip per-row balance continuity
# Instead: validate statement-level balance
total_change = sum(t['amount'] for t in transactions)
expected_ending = starting_balance + total_change

if abs(expected_ending - ending_balance) > 0.02:
    raise StatementBalanceMismatchError()
```

---

### Model C: Debit/Credit with Balance (`debit_credit`)

**Used by**: Some UK banks, Australian banks, hybrid formats

**Structure**:
```
Date       | Description    | Debit    | Credit   | Balance
-----------|---------------|----------|----------|----------
15/10/2025 | Amazon        | 50.00    |          | 1,450.00
16/10/2025 | Salary        |          | 2,000.00 | 3,450.00
17/10/2025 | Rent          | 1,200.00 |          | 2,250.00
```

**Characteristics**:
- ✅ Per-row running balance
- ✅ Separate debit/credit columns
- ✅ Balance continuity validation possible
- ✅ Mixed date formats (DD/MM/YYYY or DD-MM-YYYY)

**Schema**:
```json
{
  "statement_model": "debit_credit",
  "has_balance_column": true,
  "columns": {
    "date": {"x_min": 40, "x_max": 110},
    "description": {"x_min": 120, "x_max": 360},
    "debit": {"x_min": 370, "x_max": 450},
    "credit": {"x_min": 460, "x_max": 530},
    "balance": {"x_min": 540, "x_max": 620}
  },
  "date_format": "DD/MM/YYYY"
}
```

**Validation Strategy**:
```python
# Combine debit/credit into amount
amount = -debit if debit else credit

# Then validate balance continuity
expected_balance = prev_transaction['balance'] + amount
if abs(expected_balance - curr_transaction['balance']) > 0.02:
    raise BalanceContinuityError()
```

---

## Bank Capability Profile

Each bank gets a **capability profile** that defines its extraction requirements.

### Profile Structure

```python
@dataclass
class BankCapabilityProfile:
    bank_name: str
    statement_model: Literal['running_balance', 'soll_haben', 'debit_credit']
    has_balance_column: bool
    date_format: str  # MM/DD/YYYY, DD.MM.YYYY, DD/MM/YYYY
    currency_format: str  # 1234.56, 1.234,56, 1,234.56
    currency: str  # USD, EUR, GBP
    
    # Column detection
    column_schema: Dict[str, Dict[str, int]]
    transaction_markers: List[str]
    statement_balance_markers: Optional[List[str]]
    
    # Validation rules
    supports_balance_continuity: bool
    supports_statement_balance: bool
    min_confidence_threshold: int
```

### Example Profiles

#### Chase Bank
```python
CHASE_PROFILE = BankCapabilityProfile(
    bank_name='Chase',
    statement_model='running_balance',
    has_balance_column=True,
    date_format='MM/DD/YYYY',
    currency_format='1234.56',
    currency='USD',
    column_schema={
        'date': {'x_min': 40, 'x_max': 110},
        'description': {'x_min': 120, 'x_max': 360},
        'amount': {'x_min': 370, 'x_max': 450},
        'balance': {'x_min': 460, 'x_max': 540}
    },
    transaction_markers=['TRANSACTION DETAILS', 'Date Description'],
    statement_balance_markers=['Ending Balance'],
    supports_balance_continuity=True,
    supports_statement_balance=True,
    min_confidence_threshold=90
)
```

#### Deutsche Bank
```python
DEUTSCHE_BANK_PROFILE = BankCapabilityProfile(
    bank_name='Deutsche Bank',
    statement_model='soll_haben',
    has_balance_column=False,
    date_format='DD.MM.YYYY',
    currency_format='1.234,56',
    currency='EUR',
    column_schema={
        'date': {'x_min': 40, 'x_max': 110},
        'description': {'x_min': 120, 'x_max': 360},
        'soll': {'x_min': 370, 'x_max': 450},
        'haben': {'x_min': 460, 'x_max': 540}
    },
    transaction_markers=['Buchung', 'Valuta'],
    statement_balance_markers=['Neuer Saldo', 'Alter Saldo'],
    supports_balance_continuity=False,
    supports_statement_balance=True,
    min_confidence_threshold=85
)
```

---

## Output Schema Specification

### Transaction Object

```typescript
interface Transaction {
  date: string;  // ISO 8601 (YYYY-MM-DD)
  description: string;
  amount: number;  // Signed (negative = debit, positive = credit)
  balance: number | null;  // null for soll_haben model
  confidence: 'high' | 'medium' | 'low';
  
  // Optional metadata
  transaction_type?: 'debit' | 'credit';
  category?: string;
  original_currency?: string;
}
```

### Statement Metadata

```typescript
interface StatementMetadata {
  bank_name: string;
  statement_model: 'running_balance' | 'soll_haben' | 'debit_credit';
  statement_period: {
    start_date: string;
    end_date: string;
  };
  starting_balance?: number;
  ending_balance?: number;
  currency: string;
  account_number?: string;
}
```

### Validation Results

```typescript
interface ValidationResults {
  confidence_score: number;  // 0-100
  status: 'high_confidence' | 'needs_review' | 'failed';
  
  // Model-specific validation
  balance_continuity?: {
    checked: boolean;
    errors: number;
    issues: Array<BalanceContinuityIssue>;
  };
  
  statement_balance?: {
    checked: boolean;
    calculated_change: number;
    expected_change: number;
    matches: boolean;
  };
  
  // Universal validation
  date_monotonicity: {
    errors: number;
    issues: Array<DateOrderIssue>;
  };
  
  amount_sanity: {
    suspicious_count: number;
    issues: Array<AmountIssue>;
  };
}
```

---

## Extraction Flow by Model

### Running Balance Model

```
1. Heuristic extraction attempt
   ↓
2. If failed: AI discovery
   ↓
3. Extract: date, description, amount, balance
   ↓
4. Validate: balance continuity
   ↓
5. Output: transactions with balance field populated
```

### Soll/Haben Model

```
1. Heuristic extraction attempt (will fail)
   ↓
2. AI discovery (detects soll_haben)
   ↓
3. Extract: date, description, soll, haben
   ↓
4. Calculate: amount = -soll OR +haben
   ↓
5. Set: balance = null
   ↓
6. Extract: statement-level balance ("Neuer Saldo")
   ↓
7. Validate: sum(amounts) = ending - starting
   ↓
8. Output: transactions with balance = null
```

---

## Confidence Scoring

### High Confidence (90-100)

**Running Balance**:
- ✅ All transactions have balance
- ✅ Balance continuity validated
- ✅ 0 date errors
- ✅ 0 suspicious amounts

**Soll/Haben**:
- ✅ All transactions have amount (from soll or haben)
- ✅ Statement balance extracted
- ✅ Statement balance reconciles
- ✅ 0 date errors

### Medium Confidence (70-89)

**Running Balance**:
- ⚠️ Some transactions missing balance
- ⚠️ Minor balance continuity errors (<3)
- ✅ Dates correct

**Soll/Haben**:
- ⚠️ Statement balance not found
- ✅ All amounts present
- ✅ Dates correct

### Needs Review (<70)

- ❌ Multiple validation errors
- ❌ Missing critical fields
- ❌ Date/amount sanity failures

---

## API Response Format

```json
{
  "success": true,
  "extraction_method": "ai_guided" | "heuristic",
  "statement_metadata": {
    "bank_name": "Deutsche Bank",
    "statement_model": "soll_haben",
    "currency": "EUR",
    "ending_balance": 8.15
  },
  "transactions": [
    {
      "date": "2025-10-20",
      "description": "Kartenzahlung Amazon",
      "amount": -50.00,
      "balance": null,
      "confidence": "medium"
    }
  ],
  "summary": {
    "total_transactions": 14,
    "total_debits": -266.47,
    "total_credits": 61.34,
    "net_change": -205.13
  },
  "validation": {
    "confidence_score": 95,
    "status": "high_confidence",
    "balance_continuity": null,
    "statement_balance": {
      "checked": true,
      "matches": true
    }
  }
}
```

---

## Future Extensions

### Model D: Multi-Currency

Support for statements with multiple currencies:
```
Date | Description | Amount | Currency | Balance EUR
```

### Model E: Investment Accounts

Support for brokerage statements:
```
Date | Symbol | Shares | Price | Value | Balance
```

### Model F: Credit Cards

Support for credit card statements:
```
Date | Description | Purchases | Payments | New Balance
```

---

## Implementation Checklist

- [x] Running balance model (Chase)
- [x] Soll/Haben model (Deutsche Bank)
- [x] AI layout discovery
- [x] Model-aware validation
- [x] Null balance for soll_haben
- [ ] Statement-level balance extraction
- [ ] Bank capability profile registry
- [ ] Schema persistence/caching
- [ ] Debit/Credit model
- [ ] Multi-currency support

---

## Status

**Current Version**: v3.2
**Supported Models**: 2/6 (running_balance, soll_haben)
**Production Status**: ✅ Ready for Chase and Deutsche Bank
