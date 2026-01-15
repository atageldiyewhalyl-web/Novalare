# Accounting Integration Architecture

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NOVALARE SAAS                               │
│                    (Multi-Tenant Accounting Firms)                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Firm A      │          │  Firm B      │          │  Firm C      │
│  (5 clients) │          │  (12 clients)│          │  (3 clients) │
└──────────────┘          └──────────────┘          └──────────────┘
        │                           │                           │
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌─────────────────────┐        ┌─────────────────────┐
        │  QuickBooks Online  │        │       Xero          │
        │                     │        │   (Coming Soon)     │
        │  • Client 1 (QBO)   │        │                     │
        │  • Client 2 (QBO)   │        │  • Client A (Xero)  │
        │  • Client 3 (QBO)   │        │  • Client B (Xero)  │
        └─────────────────────┘        └─────────────────────┘
```

---

## 📦 Data Model

### Firm → Connections → Accounting Systems

```
Firm: ABC Accounting
  │
  ├─ User: john@abc.com (Owner)
  ├─ User: jane@abc.com (Team Member)
  │
  └─ Accounting Connections:
      │
      ├─ Connection 1:
      │   • Type: QuickBooks
      │   • Company: "XYZ Corp"
      │   • Realm ID: abc123
      │   • Status: Active
      │   • Synced: Company Info ✓, Accounts ✓, GL ✓
      │
      ├─ Connection 2:
      │   • Type: QuickBooks
      │   • Company: "Tech Startup Ltd"
      │   • Realm ID: def456
      │   • Status: Active
      │   • Synced: Company Info ✓, Accounts ✓
      │
      └─ Connection 3:
          • Type: Xero
          • Company: "Design Agency"
          • Tenant ID: xyz789
          • Status: Error (Token expired)
```

---

## 🔐 OAuth 2.0 Flow (Per-Client Connection)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OAUTH FLOW SEQUENCE                             │
└─────────────────────────────────────────────────────────────────────────┘

Novalare UI                Backend               QuickBooks OAuth      QB Company
──────────────────────────────────────────────────────────────────────────────
    │                         │                         │                  │
    │  1. Click "Connect QB"  │                         │                  │
    ├────────────────────────>│                         │                  │
    │                         │                         │                  │
    │                         │  2. Generate state      │                  │
    │                         │     Store {firmId}      │                  │
    │                         │                         │                  │
    │  3. Return auth URL     │                         │                  │
    │<────────────────────────┤                         │                  │
    │                         │                         │                  │
    │  4. Open popup          │                         │                  │
    ├──────────────────────────────────────────────────>│                  │
    │                         │                         │                  │
    │                         │                     5. User signs in       │
    │                         │                         ├─────────────────>│
    │                         │                         │                  │
    │                         │                     6. User selects company│
    │                         │                         │<─────────────────┤
    │                         │                         │                  │
    │                         │                     7. User authorizes     │
    │                         │                         │                  │
    │  8. Redirect to callback                          │                  │
    │    with code + realmId  │                         │                  │
    │<──────────────────────────────────────────────────┤                  │
    │                         │                         │                  │
    │  9. Send to parent      │                         │                  │
    │     via postMessage     │                         │                  │
    │                         │                         │                  │
    │  10. Call backend       │                         │                  │
    │      /qbo/callback      │                         │                  │
    ├────────────────────────>│                         │                  │
    │                         │                         │                  │
    │                         │  11. Exchange code      │                  │
    │                         │      for tokens         │                  │
    │                         ├────────────────────────>│                  │
    │                         │                         │                  │
    │                         │  12. Return tokens      │                  │
    │                         │      (access + refresh) │                  │
    │                         │<────────────────────────┤                  │
    │                         │                         │                  │
    │                         │  13. Fetch company info │                  │
    │                         ├──────────────────────────────────────────>│
    │                         │                         │                  │
    │                         │  14. Return company name│                  │
    │                         │<──────────────────────────────────────────┤
    │                         │                         │                  │
    │                         │  15. Encrypt tokens     │                  │
    │                         │      Store connection   │                  │
    │                         │                         │                  │
    │  16. Connection success │                         │                  │
    │<────────────────────────┤                         │                  │
    │                         │                         │                  │
    │  17. Auto-trigger sync  │                         │                  │
    ├────────────────────────>│                         │                  │
    │                         │                         │                  │
```

---

## 🔄 Token Management (Automatic Refresh)

```
┌─────────────────────────────────────────────────────────────────┐
│                     TOKEN LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────┘

Initial Connection
─────────────────────────────────────────────────────────────────
OAuth Exchange
    ↓
Access Token:  Valid for 60 minutes
Refresh Token: Valid for 100 days (rolling)
    ↓
Encrypted with AES-256
    ↓
Stored in KV Store:
  • encrypted_access_token
  • encrypted_refresh_token
  • token_expires_at


Before Each API Call
─────────────────────────────────────────────────────────────────
Check: Does token expire in < 5 minutes?
    │
    ├─ NO  → Use existing token
    │          ↓
    │       Make API call
    │
    └─ YES → Refresh token
               ↓
          POST /oauth2/v1/tokens/bearer
            grant_type=refresh_token
            refresh_token={encrypted_refresh_token}
               ↓
          Receive new tokens
               ↓
          Encrypt new tokens
               ↓
          Update connection record
               ↓
          Make API call with new token


Token Refresh Failure
─────────────────────────────────────────────────────────────────
Refresh fails (401/403)
    ↓
Mark connection as "error"
    ↓
Set error_message: "Token refresh failed - please reconnect"
    ↓
Notify user in UI
    ↓
User clicks "Reconnect"
    ↓
Start OAuth flow again
```

---

## 📊 Data Sync Architecture

### Phase 1: Initial Sync (Pull-Only)

```
┌───────────────────────────────────────────────────────────────────┐
│                    INITIAL SYNC WORKFLOW                          │
└───────────────────────────────────────────────────────────────────┘

1. Connection Established
         ↓
2. Sync Company Info
    GET /v3/company/{realmId}/companyinfo/{realmId}
         ↓
    Store: connection:{id}:company_info
         ↓
    Mark: sync_state.company_info_synced = true
         ↓
3. Sync Chart of Accounts
    GET /v3/company/{realmId}/query?query=SELECT * FROM Account
         ↓
    Transform to Novalare format
         ↓
    Store: connection:{id}:accounts → ChartOfAccount[]
         ↓
    Mark: sync_state.accounts_synced = true
         ↓
4. (Optional) Sync Vendors/Customers
    GET /v3/company/{realmId}/query?query=SELECT * FROM Vendor
    GET /v3/company/{realmId}/query?query=SELECT * FROM Customer
         ↓
    Store: connection:{id}:vendors
           connection:{id}:customers
         ↓
    Mark: sync_state.vendors_synced = true
           sync_state.customers_synced = true
         ↓
5. Ready for GL Reports (On-Demand)
    User triggers bank reconciliation
         ↓
    POST /accounting/sync/{id}/gl-report
    {
      account_id: "33",
      start_date: "2024-03-01",
      end_date: "2024-03-31"
    }
         ↓
    GET /v3/reports/GeneralLedger?account=33&start_date=...
         ↓
    Transform and store: connection:{id}:gl:{account}:{dateRange}
```

### Phase 2: Incremental Sync (CDC - Future)

```
Every 15-30 minutes:
    ↓
Check last_cdc_timestamp
    ↓
GET /v3/cdc?entities=Account,JournalEntry&changedSince={timestamp}
    ↓
Receive only changed entities since last sync
    ↓
Update stored records
    ↓
Update last_cdc_timestamp
```

---

## 🗄️ Storage Pattern (KV Store)

```
Key Pattern                                  Value Type
──────────────────────────────────────────────────────────────────────

qbo_connection:{connectionId}             → QBOConnection
                                             {
                                               id: uuid,
                                               firm_id: uuid,
                                               realm_id: string,
                                               company_name: string,
                                               encrypted_access_token: string,
                                               encrypted_refresh_token: string,
                                               token_expires_at: timestamp,
                                               sync_status: 'active' | 'error',
                                               last_synced_at: timestamp
                                             }

firm:{firmId}:qbo_connection:{realmId}   → connectionId (lookup)

firm:{firmId}:accounting_connections     → Connection[]
                                             [
                                               {
                                                 id: connectionId,
                                                 type: 'quickbooks',
                                                 realm_id: string,
                                                 company_name: string,
                                                 connected_at: timestamp
                                               }
                                             ]

sync_state:{connectionId}                → SyncState
                                             {
                                               connection_id: uuid,
                                               last_cdc_timestamp: timestamp,
                                               company_info_synced: boolean,
                                               accounts_synced: boolean,
                                               vendors_synced: boolean,
                                               customers_synced: boolean,
                                               gl_last_sync_date: timestamp
                                             }

connection:{connectionId}:company_info   → CompanyInfo
                                             {
                                               company_name: string,
                                               legal_name: string,
                                               country: string,
                                               fiscal_year_start: number
                                             }

connection:{connectionId}:accounts       → ChartOfAccount[]
                                             [
                                               {
                                                 id: uuid,
                                                 qbo_id: string,
                                                 name: string,
                                                 type: string,
                                                 account_number: string,
                                                 balance: number,
                                                 is_active: boolean
                                               }
                                             ]

connection:{connectionId}:gl:{accountId}:{dateRange} → GLReport
                                             {
                                               account_id: string,
                                               start_date: date,
                                               end_date: date,
                                               entries: [
                                                 {
                                                   date: date,
                                                   description: string,
                                                   amount: number,
                                                   balance: number,
                                                   transaction_type: string
                                                 }
                                               ],
                                               synced_at: timestamp
                                             }
```

---

## 🔒 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────┘

1. OAUTH STATE PARAMETER (CSRF Prevention)
   ─────────────────────────────────────────────────────────────
   Generate random UUID on auth start
        ↓
   Store: qbo_oauth_state:{state} → {firmId, userId, timestamp}
        ↓
   Verify state on callback
        ↓
   Delete state after use (one-time use)


2. TOKEN ENCRYPTION (AES-256-GCM)
   ─────────────────────────────────────────────────────────────
   Derive encryption key from SUPABASE_SERVICE_ROLE_KEY
        ↓
   Generate random 12-byte IV per encryption
        ↓
   Encrypt: AES-GCM-256(token, key, iv)
        ↓
   Store: base64(iv + encrypted_data)
        ↓
   Decrypt: Extract IV, decrypt with key


3. ROW-LEVEL SECURITY (Firm Isolation)
   ─────────────────────────────────────────────────────────────
   Every connection has firm_id
        ↓
   getUserFromToken() validates:
     • Valid JWT token
     • User exists
     • User belongs to firm
        ↓
   All queries check: connection.firm_id === user.firm_id


4. HTTPS ONLY
   ─────────────────────────────────────────────────────────────
   All API calls over TLS 1.2+
   QuickBooks API: https://quickbooks.api.intuit.com
   OAuth: https://oauth.platform.intuit.com
   Novalare: https://{project}.supabase.co


5. NO TOKEN LOGGING
   ─────────────────────────────────────────────────────────────
   Tokens never appear in console.log
   Tokens never stored in localStorage (except encrypted)
   Tokens never sent to frontend (only connection metadata)


6. SHORT-LIVED ACCESS TOKENS
   ─────────────────────────────────────────────────────────────
   Access tokens: 60 minutes max
   Auto-refresh before expiry
   Refresh tokens: 100 days (rolling on use)
```

---

## 🎯 API Endpoints Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCOUNTING INTEGRATION API                   │
└─────────────────────────────────────────────────────────────────┘

OAUTH & CONNECTION MANAGEMENT
──────────────────────────────────────────────────────────────────
GET    /accounting/qbo/auth-url
       → Generate QuickBooks OAuth URL
       → Returns: { authUrl, state }

POST   /accounting/qbo/callback
       → Exchange OAuth code for tokens
       → Body: { code, realmId, state }
       → Returns: { connection: { id, company_name, type } }

GET    /accounting/connections
       → List all connections for firm
       → Returns: { connections: Connection[] }

DELETE /accounting/connections/:connectionId
       → Disconnect accounting system
       → Returns: { success: true }


DATA SYNC (PULL-ONLY)
──────────────────────────────────────────────────────────────────
POST   /accounting/sync/:connectionId/company-info
       → Pull company metadata from QuickBooks
       → Returns: { company_info: { company_name, country } }

POST   /accounting/sync/:connectionId/accounts
       → Pull chart of accounts
       → Returns: { accounts_count, accounts: Account[] }

POST   /accounting/sync/:connectionId/gl-report
       → Pull General Ledger report for specific account
       → Body: { account_id, start_date, end_date }
       → Returns: { entries_count, entries: GLEntry[] }

GET    /accounting/:connectionId/accounts
       → Get synced chart of accounts
       → Returns: { accounts: Account[] }


FUTURE: DATA PUSH (WRITE OPERATIONS)
──────────────────────────────────────────────────────────────────
POST   /accounting/push/:connectionId/journal-entry
       → Create journal entry in QuickBooks
       → Body: { date, lines: [], memo }
       → Returns: { qbo_id, success }

POST   /accounting/push/:connectionId/bill
       → Create bill in QuickBooks
       → Body: { vendor_id, date, line_items, amount }
       → Returns: { qbo_id, success }
```

---

## 🧩 Integration Points with Existing Workflows

### Bank Reconciliation
```
Current Flow:
  1. Upload bank statement CSV
  2. Upload ledger CSV (manual)      ← PAIN POINT
  3. Match transactions
  4. Review discrepancies

New Flow:
  1. Upload bank statement CSV
  2. Select QuickBooks connection    ← AUTOMATED
  3. Select bank account from dropdown
  4. Auto-fetch GL report
  5. Match transactions
  6. Review discrepancies
```

### Journal Entries (Future)
```
Current Flow:
  1. Create journal entry manually
  2. Export to CSV
  3. Import into QuickBooks manually  ← PAIN POINT

New Flow:
  1. Create journal entry in Novalare
  2. AI suggests accounts
  3. User approves
  4. Click "Push to QuickBooks"       ← AUTOMATED
  5. Entry created in QB instantly
```

### Month-End Close (Future)
```
Current Flow:
  1. Pull trial balance from QB (manual)
  2. Upload to Novalare
  3. AI suggests adjustments
  4. Create adjusting entries manually
  5. Re-export to QB

New Flow:
  1. Connect to QuickBooks
  2. Auto-pull trial balance
  3. AI suggests adjustments
  4. User approves
  5. Push adjusting entries to QB automatically
  6. Refresh trial balance in real-time
```

---

## 📈 Scalability Considerations

### Current Architecture (KV Store)
```
Pros:
  ✅ Simple key-value storage
  ✅ Fast lookups by key
  ✅ No schema migrations needed
  ✅ Works for MVP and small scale

Cons:
  ⚠️ No relational queries (e.g., "all connections for firm")
  ⚠️ No complex filtering/sorting
  ⚠️ No atomic transactions across multiple keys
  ⚠️ Manual indexing via prefix patterns

Limits:
  • ~1,000 firms
  • ~50 connections per firm
  • ~10,000 total connections
```

### Future: Migration to Postgres
```
When to migrate:
  • > 1,000 firms
  • Need complex reporting (e.g., "all firms with QB connections")
  • Need foreign key constraints
  • Need full-text search on company names

Migration strategy:
  1. Create Postgres tables:
     - accounting_connections
     - sync_states
     - synced_accounts
     - gl_reports

  2. Keep KV store for cache:
     - GL reports (temporary, per reconciliation)
     - OAuth states (temporary, < 10 min lifetime)

  3. Use Postgres for:
     - Connection metadata
     - Sync state
     - Chart of accounts
     - Audit logs
```

---

## 🔮 Roadmap

```
✅ PHASE 1: FOUNDATION (COMPLETED)
   • OAuth flow
   • Token management
   • Initial sync (company, accounts, GL)
   • Frontend UI

🚧 PHASE 2: BANK RECONCILIATION (NEXT)
   • "Use QuickBooks" button in bank rec
   • Account selector dropdown
   • Auto-fetch GL report
   • Integrate with matching logic

📝 PHASE 3: JOURNAL ENTRY PUSH
   • Create JE endpoint
   • Pre-flight validation
   • Audit trail
   • "Push to QB" button

🔄 PHASE 4: INCREMENTAL SYNC
   • Implement CDC (Change Data Capture)
   • Scheduled background jobs
   • Real-time updates

📲 PHASE 5: WEBHOOKS
   • Receive QB notifications
   • Auto-trigger syncs
   • Real-time balance updates

🏢 PHASE 6: XERO INTEGRATION
   • OAuth for Xero
   • Common adapter interface
   • Parallel QB + Xero support

📊 PHASE 7: ADVANCED FEATURES
   • Bill creation
   • Invoice creation
   • Payment matching
   • Multi-currency support
```

---

This architecture provides a **solid, scalable foundation** for connecting Novalare to accounting systems while maintaining security, performance, and multi-tenant isolation! 🚀
