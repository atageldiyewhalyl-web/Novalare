# QuickBooks 403 Error Troubleshooting Guide

## Problem: 403 "ApplicationAuthorizationFailed" error persisting for 4+ minutes

When QuickBooks OAuth returns a 403 error that persists beyond the normal 30-60 second propagation delay, it indicates a **fundamental authorization mismatch**, not just a timing issue.

---

## Root Causes (in order of likelihood)

### 1. **Sandbox vs Production Environment Mismatch** ⚠️ MOST COMMON

**The Issue:**
- QuickBooks Sandbox apps can ONLY access Sandbox test companies
- QuickBooks Production apps can ONLY access Production (real) companies
- If you connect to the wrong type, you'll get persistent 403 errors

**How to Check:**
```bash
# Check your QuickBooks app environment in Intuit Developer Portal:
# https://developer.intuit.com/app/developer/myapps

# 1. Go to your app
# 2. Look at the "Keys & credentials" tab
# 3. Check if you're using:
#    - Sandbox keys (for test companies)
#    - Production keys (for real companies)
```

**Solution:**
1. **If using Sandbox keys:** Connect to a Sandbox test company
   - Create one at: https://developer.intuit.com/app/developer/sandbox
   - Use "Sandbox Company" option during OAuth

2. **If using Production keys:** Connect to your actual QuickBooks company
   - Your real QuickBooks Online account
   - Use "Real Company" option during OAuth

3. **Update environment variables to match:**
   ```bash
   # For Sandbox:
   QBO_CLIENT_ID=your_sandbox_client_id
   QBO_CLIENT_SECRET=your_sandbox_client_secret
   
   # For Production:
   QBO_CLIENT_ID=your_production_client_id
   QBO_CLIENT_SECRET=your_production_client_secret
   ```

---

### 2. **API Endpoint Mismatch**

**The Issue:**
- Using production API endpoint with sandbox credentials (or vice versa)

**Current API Endpoint:**
```typescript
// In your code:
https://quickbooks.api.intuit.com  // ← This is PRODUCTION
```

**Solution:**
If using Sandbox, change to:
```typescript
// For Sandbox companies:
https://sandbox-quickbooks.api.intuit.com

// For Production companies (current):
https://quickbooks.api.intuit.com
```

---

### 3. **OAuth Scopes Missing or Incorrect**

**Current Scope:**
```typescript
scope: 'com.intuit.quickbooks.accounting'  // ✅ This is correct
```

**Verify in Intuit Developer Portal:**
1. Go to your app settings
2. Check "Scope" section
3. Ensure "Accounting" is checked

---

### 4. **Redirect URI Mismatch**

**The Issue:**
- Redirect URI in your code doesn't EXACTLY match what's registered in QuickBooks

**How to Check:**
```bash
# 1. Check your environment variable:
echo $QBO_REDIRECT_URI

# 2. Compare with Intuit Developer Portal:
# Go to: Keys & credentials > Redirect URIs

# They must match EXACTLY (including http vs https, port, trailing slash)
```

**Common Mismatches:**
```bash
# ❌ Wrong:
http://localhost:3000/callback
https://yourdomain.com/callback

# ✅ Correct (must match exactly):
http://localhost:3000/accounting/qbo/callback
```

---

### 5. **App Not Published/Enabled**

**For Production Apps:**
1. Go to Intuit Developer Portal
2. Your app must be "Published" for production use
3. Check app status - it should be "Active"

---

## Quick Diagnostic Steps

### Step 1: Verify Your Environment
```bash
# Check which keys you're using:
echo $QBO_CLIENT_ID
echo $QBO_REDIRECT_URI

# Compare with Intuit Developer Portal:
# 1. If keys start with "AB..." = Production
# 2. If keys start with "Q0..." = Sandbox (usually)
```

### Step 2: Test with Correct Company Type
- **Sandbox keys** → Use "Test Drive" or Sandbox company
- **Production keys** → Use your real QuickBooks Online account

### Step 3: Check API Endpoint
- Open `/supabase/functions/server/accounting-integration-routes.tsx`
- Search for `quickbooks.api.intuit.com`
- If using Sandbox, change to `sandbox-quickbooks.api.intuit.com`

### Step 4: Verify Redirect URI
```bash
# Your QBO_REDIRECT_URI should be:
http://localhost:54321/functions/v1/make-server-53c2e113/accounting/qbo/callback

# Or for deployed:
https://[your-project-id].supabase.co/functions/v1/make-server-53c2e113/accounting/qbo/callback
```

---

## How to Fix (Step-by-Step)

### Option A: Switch to Sandbox (Recommended for Testing)

1. **Get Sandbox Credentials:**
   - Go to: https://developer.intuit.com/app/developer/myapps
   - Click your app → "Keys & credentials"
   - Copy "Sandbox" Client ID and Secret

2. **Update Environment Variables:**
   ```bash
   # In Supabase Dashboard or local .env:
   QBO_CLIENT_ID=your_sandbox_client_id
   QBO_CLIENT_SECRET=your_sandbox_client_secret
   QBO_REDIRECT_URI=http://localhost:54321/functions/v1/make-server-53c2e113/accounting/qbo/callback
   ```

3. **Change API Endpoint:**
   - Edit `/supabase/functions/server/accounting-integration-routes.tsx`
   - Replace ALL instances of:
     ```typescript
     https://quickbooks.api.intuit.com
     ```
     with:
     ```typescript
     https://sandbox-quickbooks.api.intuit.com
     ```

4. **Create Sandbox Company:**
   - Go to: https://developer.intuit.com/app/developer/sandbox
   - Create a test company
   - Connect to this company during OAuth

### Option B: Switch to Production

1. **Verify Production Keys:**
   - Go to: https://developer.intuit.com/app/developer/myapps
   - Click your app → "Keys & credentials"
   - Copy "Production" Client ID and Secret

2. **Publish Your App:**
   - In Intuit Developer Portal
   - Click "Publish" button
   - Wait for approval (can take a few days)

3. **Update Environment Variables:**
   ```bash
   QBO_CLIENT_ID=your_production_client_id
   QBO_CLIENT_SECRET=your_production_client_secret
   QBO_REDIRECT_URI=http://localhost:54321/functions/v1/make-server-53c2e113/accounting/qbo/callback
   ```

4. **Connect Real Company:**
   - Use your actual QuickBooks Online account
   - Connect during OAuth

---

## Testing After Fix

1. **Delete existing "Unknown Company" connection**
2. **Try connecting again**
3. **Wait 30-60 seconds**
4. **Click "Refresh Name"**
5. **Should now fetch company name successfully**

---

## Still Getting 403?

If you still get 403 errors after following these steps:

1. **Check Console Logs:**
   - Look for the troubleshooting messages in the backend logs
   - They'll tell you the specific realm ID and error details

2. **Verify Token:**
   - Check if token is expired: Look at `token_expires_at` in logs
   - Should be in the future

3. **Test with QuickBooks API Explorer:**
   - Go to: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/companyinfo
   - Test the CompanyInfo endpoint with your credentials
   - This will confirm if the issue is with QuickBooks or your code

4. **Contact QuickBooks Support:**
   - If none of the above works, there might be an issue with your app setup
   - Contact Intuit Developer Support

---

## Summary Checklist

- [ ] Check if using Sandbox or Production keys
- [ ] Verify API endpoint matches environment (sandbox vs production)
- [ ] Confirm OAuth scopes include "com.intuit.quickbooks.accounting"
- [ ] Verify redirect URI matches exactly in Intuit Developer Portal
- [ ] Ensure connecting to correct company type (Sandbox test company vs real company)
- [ ] Check if app is published (for production)
- [ ] Test after 60+ seconds to rule out propagation delay

---

**Most likely solution:** You're using **Sandbox credentials but connecting to a Production company** (or vice versa). Switch to match!
