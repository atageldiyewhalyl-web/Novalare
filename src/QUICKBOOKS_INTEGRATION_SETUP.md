# QuickBooks Online Integration - Setup Guide

## 🎯 Overview

We've implemented the **foundational infrastructure** for connecting Novalare to QuickBooks Online (QBO). This is Phase 1 of the integration, focused on **OAuth authentication, token management, and initial data sync (pull-only)**.

---

## ✅ What's Been Built

### 1. **Backend API Routes** (`/supabase/functions/server/accounting-integration-routes.tsx`)

- **OAuth Flow**:
  - `GET /accounting/qbo/auth-url` - Generate QBO authorization URL
  - `POST /accounting/qbo/callback` - Handle OAuth callback and exchange code for tokens
  
- **Connection Management**:
  - `GET /accounting/connections` - List all connected accounting systems
  - `DELETE /accounting/connections/:connectionId` - Disconnect a system
  
- **Data Sync (Pull-Only)**:
  - `POST /accounting/sync/:connectionId/company-info` - Pull company metadata
  - `POST /accounting/sync/:connectionId/accounts` - Pull chart of accounts
  - `POST /accounting/sync/:connectionId/gl-report` - Pull General Ledger report for bank reconciliation
  - `GET /accounting/:connectionId/accounts` - Get synced accounts

- **Token Management**:
  - Automatic token refresh when expired (< 5 minutes remaining)
  - AES-256 encryption for access/refresh tokens
  - Secure storage in KV store

### 2. **Frontend Components**

- **`/components/devportal/AccountingIntegrations.tsx`**:
  - "Connect QuickBooks" button with OAuth popup flow
  - Connected systems dashboard
  - Sync status tracking
  - Disconnect functionality
  
- **`/pages/QBOCallback.tsx`**:
  - OAuth callback handler
  - Sends OAuth data to parent window via `postMessage`
  
- **Settings Integration**:
  - New "Accounting Integrations" tab in Settings
  - Integrated with existing Settings component

### 3. **Data Model**

Stored in KV store with these patterns:

```typescript
// Connection records
qbo_connection:{connectionId} → QBOConnection
xero_connection:{connectionId} → XeroConnection

// Firm associations
firm:{firmId}:qbo_connection:{realmId} → connectionId
firm:{firmId}:accounting_connections → Connection[]

// Sync state
sync_state:{connectionId} → SyncState

// Synced data
connection:{connectionId}:company_info → CompanyInfo
connection:{connectionId}:accounts → ChartOfAccount[]
connection:{connectionId}:gl:{accountId}:{dateRange} → GLReport
```

---

## 🔧 Setup Instructions

### Step 1: Create QuickBooks App in Intuit Developer Portal

1. Go to [Intuit Developer Portal](https://developer.intuit.com/)
2. Sign in or create an account
3. Click **"Create an app"**
4. Select **"QuickBooks Online Accounting"** API
5. Fill in app details:
   - **App Name**: Novalare
   - **App Description**: Bank-agnostic PDF extraction and reconciliation platform for accounting firms
   - **Redirect URI**: `https://YOUR_DOMAIN.com/qbo-callback` (or `http://localhost:5173/qbo-callback` for dev)
6. Save your **Client ID** and **Client Secret**

### Step 2: Create Sandbox Companies for Testing

1. In Intuit Developer Portal, go to **"Sandbox"** tab
2. Click **"Add Sandbox"**
3. Choose **QuickBooks Online Plus** or **Advanced**
4. Select your country/region
5. The sandbox company will be created (can take a few minutes)
6. You can create multiple sandbox companies to test multi-client scenarios

### Step 3: Configure Supabase Environment Variables

Add these secrets to your Supabase Edge Functions:

```bash
# Go to: Supabase Dashboard → Project Settings → Edge Functions → Manage secrets

QBO_CLIENT_ID=your_client_id_from_intuit
QBO_CLIENT_SECRET=your_client_secret_from_intuit
QBO_REDIRECT_URI=https://YOUR_DOMAIN.com/qbo-callback
```

**For local development:**
```bash
QBO_REDIRECT_URI=http://localhost:5173/qbo-callback
```

### Step 4: Test the OAuth Flow

1. **Navigate to Settings** → **Accounting Integrations**
2. Click **"Connect QuickBooks"**
3. A popup will open with Intuit's OAuth consent screen
4. Sign in with your Intuit Developer account
5. Select the sandbox company to connect
6. Authorize the connection
7. The popup will close and you'll see the connected company in Novalare

### Step 5: Test Data Sync

1. After connecting, the system will automatically:
   - Sync company information
   - Sync chart of accounts
2. Check the sync status badges (should show green checkmarks)
3. Click the refresh button to manually trigger a sync
4. Check the browser console for detailed sync logs

---

## 🔍 How It Works

### OAuth Flow (Multi-Tenant Pattern)

```
User clicks "Connect QuickBooks"
       ↓
Frontend requests auth URL from backend
       ↓
Backend generates state parameter and stores {firmId, userId}
       ↓
Frontend opens popup with Intuit OAuth URL
       ↓
User authorizes in Intuit
       ↓
Intuit redirects to /qbo-callback with code + realmId + state
       ↓
Callback page sends data to parent window via postMessage
       ↓
Parent window calls backend /qbo/callback endpoint
       ↓
Backend exchanges code for access/refresh tokens
       ↓
Backend encrypts tokens and stores connection
       ↓
Backend fetches company info from QuickBooks
       ↓
Connection created! Ready to sync data.
```

### Token Refresh (Automatic)

- QBO access tokens expire after **60 minutes**
- Before each API call, we check if token expires in < 5 minutes
- If so, we automatically refresh using the refresh token
- Refresh tokens are **rolling** (100 days with extension on use)
- All tokens are **AES-256 encrypted** before storage

### General Ledger Sync (The Key to Bank Matching)

When you call `POST /accounting/sync/:connectionId/gl-report`:

```json
{
  "account_id": "123",  // QuickBooks account ID (e.g., "Checking - Deutsche Bank")
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

**Returns:**
```json
{
  "entries": [
    {
      "date": "2024-01-05",
      "transaction_type": "Bill Payment",
      "num": "1234",
      "name": "Vendor ABC",
      "memo": "Invoice #5678",
      "amount": -250.00,  // ← This is the bank account side only!
      "balance": 5750.00
    }
  ]
}
```

**Why this solves the double-entry problem:**
- QuickBooks GL Report filtered to a specific account returns **only entries that hit that account**
- You get the "bank's view" - one line per transaction
- No need to group journal entries manually
- Perfect 1:1 matching with bank statement lines

---

## 📊 What's Next: Recommended Implementation Order

### ✅ **Phase 1: Completed**
- OAuth authentication
- Token encryption & refresh
- Initial sync (Company Info, Accounts, GL)
- Frontend UI for connections

### 🚧 **Phase 2: Bank Reconciliation Integration** (Next Step)

1. **Add "Use QuickBooks Data" button to Bank Reconciliation**:
   - When user uploads bank statement, show connected QBO companies
   - Let them select which QB company's ledger to match against
   - Load GL report for the selected bank account
   
2. **Modify matching logic**:
   ```typescript
   // Instead of manually uploaded ledger CSV:
   const ledgerEntries = await fetchQBOGeneralLedger(connectionId, accountId, startDate, endDate);
   
   // Then run existing matching logic:
   const matches = performExactBankMatching(bankTransactions, ledgerEntries);
   ```

3. **Display QB account metadata**:
   - Show account name, number, current balance
   - Let user select from dropdown of bank accounts

### 📝 **Phase 3: Journal Entry Push** (After Bank Rec)

1. **Create unmatched transactions as Journal Entries**:
   ```typescript
   POST https://quickbooks.api.intuit.com/v3/company/{realmId}/journalentry
   ```
   
2. **Add pre-flight validation**:
   - Verify account exists
   - Check amounts balance
   - Validate date format
   
3. **Add "Push to QuickBooks" button** in Journal Entries workflow
4. **Show audit trail** of pushed entries

### 🔄 **Phase 4: Incremental Sync (CDC)**

1. Use QuickBooks Change Data Capture:
   ```typescript
   GET /v3/cdc?entities=Account,JournalEntry&changedSince=2024-03-20T10:00:00
   ```
   
2. Store `last_cdc_timestamp` in sync state
3. Run incremental sync every 15-30 minutes
4. Update changed accounts/entries

### 📲 **Phase 5: Webhooks (Real-Time)**

1. Configure webhooks in Intuit Developer Portal
2. Create webhook endpoint in Novalare backend
3. Listen for events:
   - Invoice paid → trigger notification
   - Account modified → trigger sync
   - New transaction → update GL cache

### 🏢 **Phase 6: Xero Integration**

1. Implement same pattern for Xero OAuth
2. Create `XeroAdapter` interface
3. Map Xero's API to common data model
4. Xero's API is generally simpler than QuickBooks

---

## 🔐 Security Considerations

### ✅ Implemented:
- **Token Encryption**: All access/refresh tokens encrypted with AES-256
- **HTTPS Only**: All API calls use HTTPS
- **State Parameter**: Prevents CSRF attacks in OAuth flow
- **Row-Level Security**: Connections scoped to firm_id
- **No Token Logging**: Tokens never appear in console logs

### ⚠️ Limitations (Due to KV Store):
- **Encryption key derived from service role key** (not ideal for production)
- **No per-tenant encryption keys** (would need separate key management)

### 🎯 Production Recommendations:
1. Use **Supabase Vault** or **AWS KMS** for encryption keys
2. Implement **per-tenant encryption keys**
3. Add **webhook signature verification**
4. Enable **audit logging** for all data pushes

---

## 🐛 Troubleshooting

### OAuth Popup Blocked
- **Solution**: Allow popups for your domain in browser settings
- **Alternative**: Use redirect flow instead of popup (requires different UX)

### "Invalid OAuth state"
- **Cause**: State parameter mismatch or expired
- **Solution**: Clear sessionStorage and try again
- **Prevention**: Implement state expiration (e.g., 10 minutes)

### Token Refresh Fails
- **Cause**: Refresh token expired or revoked
- **Solution**: User must reconnect QuickBooks
- **UI**: Show "Reconnect" button when sync_status = 'error'

### Company Info Sync Fails
- **Check**: Ensure QBO_CLIENT_ID, QBO_CLIENT_SECRET are set
- **Check**: Access token is valid and not expired
- **Check**: User has permissions in QuickBooks company

### GL Report Returns Empty
- **Cause**: No transactions for that account in date range
- **Solution**: Expand date range or select different account
- **Check**: Account ID is correct (use synced accounts list)

---

## 📚 Resources

- [QuickBooks Online API Documentation](https://developer.intuit.com/app/developer/qbo/docs)
- [OAuth 2.0 Setup Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [Change Data Capture (CDC)](https://developer.intuit.com/app/developer/qbo/docs/develop/explore-the-quickbooks-online-api/change-data-capture)
- [General Ledger Report](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/report-entities/generalledger)
- [Webhooks Documentation](https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks)

---

## 🎉 Summary

You now have a **production-ready foundation** for QuickBooks integration! The hardest parts are done:
- ✅ OAuth flow with multi-tenant support
- ✅ Secure token management
- ✅ Initial data sync
- ✅ General Ledger pull (solves the double-entry matching problem)

**Next immediate step**: Add "Use QuickBooks" button to Bank Reconciliation workflow and load GL data instead of requiring manual CSV upload.

This will provide **immediate value** to users and validate the integration before adding write operations (journal entry push).
