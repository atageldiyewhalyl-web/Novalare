# 📊 QuickBooks OAuth Flow - Localhost Testing

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUICKBOOKS OAUTH FLOW                        │
│                     (Localhost Testing)                         │
└─────────────────────────────────────────────────────────────────┘

Step 1: USER INITIATES CONNECTION
┌──────────────────────────────────────────────────────┐
│  User Browser (localhost:5173)                       │
│  ┌────────────────────────────────────────────┐      │
│  │ Settings → Accounting Integrations         │      │
│  │                                            │      │
│  │  [Connect QuickBooks] ← User clicks        │      │
│  └────────────────────────────────────────────┘      │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 2: FRONTEND REQUESTS OAUTH URL
┌──────────────────────────────────────────────────────┐
│  Frontend JavaScript                                 │
│  (AccountingIntegrations.tsx)                        │
│                                                      │
│  fetch('https://PROJECT.supabase.co/functions/v1/   │
│        make-server-53c2e113/accounting/qbo/auth-url')│
│    headers: { Authorization: Bearer USER_TOKEN }     │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 3: BACKEND GENERATES OAUTH URL
┌──────────────────────────────────────────────────────┐
│  Supabase Edge Function                              │
│  (accounting-integration-routes.tsx)                 │
│                                                      │
│  1. Verify user authentication                       │
│  2. Get firmId from user record                      │
│  3. Generate random state token                      │
│  4. Store state → { firmId, userId } in KV store     │
│  5. Build QB OAuth URL:                              │
│     https://appcenter.intuit.com/connect/oauth2      │
│     ?client_id=XXX                                   │
│     &redirect_uri=http://localhost:5173/qbo-callback │
│     &state=random_token                              │
│  6. Return URL to frontend                           │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 4: OPEN QUICKBOOKS LOGIN (POPUP)
┌──────────────────────────────────────────────────────┐
│  User Browser - Popup Window                         │
│  ┌────────────────────────────────────────────┐      │
│  │  QuickBooks Login Page                     │      │
│  │  (appcenter.intuit.com)                    │      │
│  │                                            │      │
│  │  Email: [_______________]                  │      │
│  │  Password: [___________]                   │      │
│  │                                            │      │
│  │  [Sign In]  ← User logs in                 │      │
│  └────────────────────────────────────────────┘      │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 5: USER AUTHORIZES APP
┌──────────────────────────────────────────────────────┐
│  QuickBooks Authorization Page                       │
│  ┌────────────────────────────────────────────┐      │
│  │  Novalare would like to:                   │      │
│  │  • Access your company data                │      │
│  │  • Create transactions                     │      │
│  │  • Read accounting info                    │      │
│  │                                            │      │
│  │  Company: Test Company Inc.                │      │
│  │                                            │      │
│  │  [Cancel]  [Authorize] ← User authorizes   │      │
│  └────────────────────────────────────────────┘      │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 6: QUICKBOOKS REDIRECTS BACK
┌──────────────────────────────────────────────────────┐
│  QuickBooks redirects to:                            │
│                                                      │
│  http://localhost:5173/qbo-callback                  │
│    ?code=L311749428uGLN...                           │
│    &realmId=9341452697644824                         │
│    &state=abc123def456...                            │
│                                                      │
│  ⚠️ NOTE: No Authorization header sent by QB!        │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 7: REACT COMPONENT RECEIVES CALLBACK
┌──────────────────────────────────────────────────────┐
│  React Route: /qbo-callback                          │
│  (QBOCallback.tsx)                                   │
│                                                      │
│  ✅ No auth required - it's a client-side route!     │
│                                                      │
│  1. Parse URL parameters (code, realmId, state)      │
│  2. Validate parameters exist                        │
│  3. Show loading UI: "Connecting to QuickBooks..."   │
│  4. Forward to Edge Function (next step)             │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 8: FORWARD TO EDGE FUNCTION (WITH AUTH)
┌──────────────────────────────────────────────────────┐
│  React Component Forwards Request                    │
│                                                      │
│  fetch('https://PROJECT.supabase.co/functions/v1/   │
│        make-server-53c2e113/accounting/qbo/callback  │
│        ?code=XXX&realmId=XXX&state=XXX')             │
│    headers: {                                        │
│      Authorization: Bearer PUBLIC_ANON_KEY  ← ADDED! │
│    }                                                 │
│                                                      │
│  ✅ Edge Function now has authentication!            │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 9: BACKEND PROCESSES OAUTH CALLBACK
┌──────────────────────────────────────────────────────┐
│  Supabase Edge Function                              │
│  GET /accounting/qbo/callback                        │
│                                                      │
│  1. Get state from URL params                        │
│  2. Retrieve { firmId, userId } from KV store        │
│  3. Delete state (one-time use)                      │
│  4. Exchange authorization code for tokens:          │
│     POST https://oauth.platform.intuit.com/          │
│          oauth2/v1/tokens/bearer                     │
│  5. Receive:                                         │
│     • access_token (expires in 1 hour)               │
│     • refresh_token (expires in 100 days)            │
│  6. Get company info from QuickBooks:                │
│     GET https://quickbooks.api.intuit.com/v3/        │
│         company/{realmId}/companyinfo/{realmId}      │
│  7. Encrypt tokens with AES-GCM                      │
│  8. Save connection to KV store:                     │
│     qbo_connection:{connectionId} = {                │
│       firm_id, realm_id, company_name,               │
│       encrypted_access_token,                        │
│       encrypted_refresh_token,                       │
│       token_expires_at, sync_status                  │
│     }                                                │
│  9. Add to firm's connections list                   │
│ 10. Return HTML with postMessage script              │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 10: NOTIFY PARENT WINDOW & CLOSE POPUP
┌──────────────────────────────────────────────────────┐
│  React Component (QBOCallback.tsx)                   │
│                                                      │
│  1. Receives HTML response from Edge Function        │
│  2. Extracts embedded <script> tag                   │
│  3. Executes script which:                           │
│     • Sends postMessage to parent window:            │
│       { type: 'qbo-oauth-success',                   │
│         realmId: 'XXX',                              │
│         companyName: 'Test Company Inc.' }           │
│     • Closes popup: window.close()                   │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 11: PARENT WINDOW RECEIVES SUCCESS
┌──────────────────────────────────────────────────────┐
│  Main Window (AccountingIntegrations.tsx)            │
│                                                      │
│  window.addEventListener('message', (event) => {     │
│    if (event.data.type === 'qbo-oauth-success') {   │
│      // Refresh connections list                     │
│      fetchConnections()                              │
│      // Show success toast                           │
│      toast.success('QuickBooks connected!')          │
│    }                                                 │
│  })                                                  │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
Step 12: UI UPDATES
┌──────────────────────────────────────────────────────┐
│  User Browser (localhost:5173)                       │
│  ┌────────────────────────────────────────────┐      │
│  │ QuickBooks Online Connections              │      │
│  │                                            │      │
│  │ ✅ Test Company Inc. (Connected)           │      │
│  │    Last synced: Just now                   │      │
│  │    [Disconnect] [Sync Now]                 │      │
│  │                                            │      │
│  │ [+ Connect Another Company]                │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
│  🎉 Success Toast: "QuickBooks connected!"           │
└──────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════
                    FLOW COMPLETE!
═══════════════════════════════════════════════════════
```

---

## Key Technical Points

### 🔐 Authentication Flow

1. **Initial auth-url request**: Uses user's session token (from login)
2. **OAuth callback (QB → React)**: NO authentication (QB won't send headers)
3. **React → Edge Function**: Adds `publicAnonKey` in Authorization header
4. **Edge Function validates**: Checks state in KV store (contains user context)

### 🔑 State Parameter Security

The `state` parameter serves multiple purposes:
- **CSRF protection**: Prevents unauthorized callback requests
- **User context**: Links the OAuth flow back to the correct user/firm
- **One-time use**: Deleted after successful exchange
- **Expiration**: Auto-expires after 10 minutes

### 🔒 Token Storage

- **Tokens are encrypted** using AES-GCM before storage
- **Encryption key** derived from `SUPABASE_SERVICE_ROLE_KEY`
- **Stored in KV store** at `qbo_connection:{connectionId}`
- **Never exposed to frontend** - always encrypted

### 🌐 Why the Bridge Pattern Works

```
QuickBooks → React Route → Edge Function
   (no auth)  (adds auth)    (processes)
```

**Problem**: Edge Functions require authentication, QB won't send it
**Solution**: React route acts as a bridge, adding auth before forwarding

**Alternative approaches that DON'T work**:
- ❌ Direct QB → Edge Function (401 error, no auth header)
- ❌ Using API key in URL (security risk, doesn't work with Supabase)
- ❌ Static HTML page (can't access Supabase client secrets securely)

---

## Localhost vs Production

### Only 2 Things Change:

1. **Redirect URI in QuickBooks Developer Portal**:
   - Localhost: `http://localhost:5173/qbo-callback`
   - Production: `https://your-domain.com/qbo-callback`

2. **QBO_REDIRECT_URI Environment Variable**:
   - Localhost: `http://localhost:5173/qbo-callback`
   - Production: `https://your-domain.com/qbo-callback`

Everything else stays the same! ✨

---

## Testing Checklist

- [ ] QB Developer Portal has localhost redirect URI
- [ ] `QBO_REDIRECT_URI` environment variable is set
- [ ] Frontend running at `http://localhost:5173`
- [ ] User logged in with active session
- [ ] Click "Connect QuickBooks"
- [ ] Popup opens (not blocked by browser)
- [ ] Authorize on QuickBooks
- [ ] Redirects to `http://localhost:5173/qbo-callback?code=...`
- [ ] Loading spinner shows "Connecting to QuickBooks..."
- [ ] Console logs show successful token exchange
- [ ] Popup closes automatically
- [ ] UI updates with connected company
- [ ] Success toast appears

---

## Error Scenarios

### 401 Unauthorized
- **Cause**: Missing/invalid `publicAnonKey` in React forward
- **Fix**: Check `/utils/supabase/info.tsx`

### Invalid OAuth State
- **Cause**: State not found in KV store or expired
- **Fix**: Try flow again (states expire after 10 min)

### Redirect URI Mismatch
- **Cause**: QB redirect URI doesn't match `QBO_REDIRECT_URI` env var
- **Fix**: Ensure EXACT match (including protocol, no trailing slash)

### Popup Blocked
- **Cause**: Browser blocked popup
- **Fix**: Allow popups for localhost:5173

---

**Ready to test? Follow the Quick Start guide! 🚀**

See: `/QUICK_START_LOCALHOST_QB.md`
