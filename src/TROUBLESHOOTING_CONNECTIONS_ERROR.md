# Troubleshooting: "Failed to load connections" Error

## Issue
When visiting Settings → Accounting Integrations, you see:
```
Error loading connections: Error: Failed to load connections
```

## Root Cause Analysis

The error happens in the `loadConnections()` function in `AccountingIntegrations.tsx`. Here are the possible causes:

### 1. **User Not Found in KV Store** ⭐ MOST LIKELY
The backend tries to get `user:${userId}` from KV store, but it doesn't exist or doesn't have a `firm_id`.

**How to check:**
1. Open browser console
2. Look for these logs:
   - ✅ `User authenticated: <user_id>`
   - ❌ `User record not found in KV store for user <user_id>`
   - ❌ `User <user_id> has no firm_id`

**How to fix:**
The user needs to complete the signup process properly. Check if the user was created via the `/auth/signup` flow.

### 2. **Access Token Missing or Invalid**
The `access_token` in localStorage is missing or expired.

**How to check:**
1. Open browser console
2. Run: `console.log(localStorage.getItem('access_token'))`
3. If null or undefined → token missing
4. If exists → check backend logs for auth errors

**How to fix:**
- Log out and log back in
- Clear localStorage and re-authenticate

### 3. **Backend Route Not Mounted**
The accounting integration routes are not properly mounted in the server.

**How to check:**
Look at Supabase Edge Functions logs for:
- `📋 Fetching accounting connections for firm <firm_id>` ← Good
- `404 Not Found` ← Bad (route not mounted)

**How to fix:**
Check that `/supabase/functions/server/index.tsx` has:
```typescript
import accountingIntegrationRoutes from "./accounting-integration-routes.tsx";
app.route('/make-server-53c2e113', accountingIntegrationRoutes);
```

## Quick Debugging Steps

### Step 1: Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Look for these messages:
   - `📡 Loading accounting connections...`
   - `❌ Failed to load connections: 401 {...}`
   - `✅ Connections loaded: 0`

### Step 2: Check Network Tab
1. Open DevTools → Network tab
2. Look for request to: `/make-server-53c2e113/accounting/connections`
3. Check:
   - Status: Should be 200 (if 401 → auth issue, if 404 → route not mounted)
   - Response: Should be `{ "connections": [] }`
   - Request Headers: Should have `Authorization: Bearer <token>`

### Step 3: Check Supabase Logs
1. Go to Supabase Dashboard
2. Navigate to Edge Functions → Logs
3. Look for:
   - `✅ User authenticated: <user_id>`
   - `✅ User <user_id> belongs to firm <firm_id>`
   - `📋 Fetching accounting connections for firm <firm_id>`
   - `❌ User record not found` ← Problem!

## Solutions

### Solution 1: Ensure User Exists in KV Store
Run this in your backend or via API:

```typescript
// Check if user exists
const userId = '<your_user_id>';
const user = await kv.get(`user:${userId}`);
console.log('User record:', user);

// If user doesn't exist or has no firm_id, you need to:
// 1. Complete signup process properly
// 2. Or manually create user record (dev only)
```

### Solution 2: Re-authenticate
1. Log out of Novalare
2. Clear browser localStorage: `localStorage.clear()`
3. Log back in via `/login`
4. This will refresh the access token

### Solution 3: Check User Was Created Properly
When you signed up, did you:
1. Complete email verification?
2. See the "Account activated" message?

If not, the user record wasn't created in KV store.

**To fix:**
- Go through signup flow again
- Make sure to verify email
- Complete `/auth/complete-verification` step

## Expected Flow

### Successful Connection Load (Empty)
```
Browser Console:
  📡 Loading accounting connections...
  ✅ Connections loaded: 0

Backend Logs:
  ✅ User authenticated: abc-123-def
  ✅ User abc-123-def belongs to firm xyz-456-ghi
  📋 Fetching accounting connections for firm xyz-456-ghi

Response:
  { "connections": [] }
```

### Auth Error (Most Common)
```
Browser Console:
  📡 Loading accounting connections...
  ❌ Failed to load connections: 401 { error: "User record not found" }
  Session expired. Please log in again.

Backend Logs:
  ✅ User authenticated: abc-123-def
  ❌ User record not found in KV store for user abc-123-def

Response:
  401 { "error": "User record not found. Please complete signup process." }
```

## Testing the Fix

After applying one of the solutions:

1. **Reload the page**
2. **Go to Settings → Accounting Integrations**
3. **Expected result:**
   - No error toast
   - Page loads successfully
   - Shows "Connect Accounting System" card
   - No connected systems yet (that's normal!)

## Still Not Working?

### Get Detailed Logs

Add this to the beginning of `loadConnections()` in `AccountingIntegrations.tsx`:

```typescript
const loadConnections = async () => {
  console.log('=== DEBUG: loadConnections START ===');
  console.log('Token exists:', !!localStorage.getItem('access_token'));
  console.log('Token preview:', localStorage.getItem('access_token')?.substring(0, 20));
  console.log('ProjectId:', projectId);
  
  try {
    // ... rest of code
  }
}
```

Then check the console output and share the logs.

### Manual Test

Test the endpoint directly:

```bash
# Get your access token from localStorage
TOKEN="<your_access_token>"

# Test the endpoint
curl -X GET \
  "https://<project_id>.supabase.co/functions/v1/make-server-53c2e113/accounting/connections" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
# { "connections": [] }

# If error:
# { "error": "User record not found. Please complete signup process." }
```

## Common Pitfalls

1. ❌ **Assuming user exists** - The user might not have completed signup
2. ❌ **Not checking firm_id** - User exists but has no firm_id
3. ❌ **Expired token** - Token in localStorage is old
4. ❌ **Wrong environment** - Using local token with production backend (or vice versa)

## Success Checklist

Before you can use Accounting Integrations, verify:

- ✅ User is logged in
- ✅ `access_token` exists in localStorage
- ✅ User record exists in KV store (`user:${userId}`)
- ✅ User has a `firm_id`
- ✅ Firm record exists in KV store (`firm:${firmId}`)
- ✅ Backend routes are mounted
- ✅ Supabase Edge Functions are deployed

Once all these are true, the page should load without errors!

---

## Quick Fix Commands

```typescript
// In browser console:

// 1. Check if logged in
console.log('Token:', localStorage.getItem('access_token') ? 'EXISTS' : 'MISSING');

// 2. Check current user (if AuthContext is available)
// Look for user object in React DevTools

// 3. Clear and re-auth
localStorage.clear();
window.location.href = '/login';
```

If you're still stuck, share:
1. Browser console logs
2. Network tab response
3. Supabase Edge Function logs
