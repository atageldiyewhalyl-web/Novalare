# 🏠 QuickBooks OAuth Localhost Testing Guide

## Overview

This guide will help you test QuickBooks Online (QBO) integration on localhost (`http://localhost:5173`) instead of deploying to production.

## Current Architecture

Your app uses a **React callback bridge** approach:
1. **User clicks "Connect QuickBooks"** → Frontend calls `/accounting/qbo/auth-url`
2. **Backend generates OAuth URL** → Contains state parameter with firmId + userId
3. **User authorizes on QuickBooks** → QB redirects to your callback URL
4. **React route receives callback** → `/qbo-callback` (React component, no auth required)
5. **React forwards to Edge Function** → With `publicAnonKey` in Authorization header
6. **Backend processes** → Exchanges code for tokens, saves connection

## Why This Works

- **React routes don't require authentication** (they're client-side)
- **Edge Functions require authentication** (they need Authorization header)
- **QuickBooks won't send auth headers** in the redirect
- **Solution**: React component acts as a bridge, adding auth before calling Edge Function

---

## 🔧 Localhost Setup - Step by Step

### Step 1: Update QuickBooks Developer Portal

1. Go to https://developer.intuit.com/app/developer/myapps
2. Select your app
3. Click **Keys & credentials**
4. Under **Redirect URIs**, ADD (don't replace the production one):
   ```
   http://localhost:5173/qbo-callback
   ```
5. Click **Save**

### Step 2: Update Local Environment Variables

You need to update `QBO_REDIRECT_URI` to point to localhost. Since these are Supabase Edge Function secrets, you have two options:

#### Option A: Use Supabase CLI (Recommended for localhost testing)

1. Install Supabase CLI if you haven't:
   ```bash
   npm install -g supabase
   ```

2. Create a `.env.local` file in `/supabase/functions/server/`:
   ```bash
   # QuickBooks OAuth Config - LOCALHOST
   QBO_REDIRECT_URI=http://localhost:5173/qbo-callback
   QBO_CLIENT_ID=your_client_id_from_quickbooks
   QBO_CLIENT_SECRET=your_client_secret_from_quickbooks
   ```

3. Run Supabase functions locally:
   ```bash
   supabase functions serve
   ```

#### Option B: Temporarily Update Production Secrets (NOT recommended)

⚠️ **Warning**: This will affect your production deployment!

1. Go to Supabase Dashboard → Your Project → Settings → Edge Functions → Secrets
2. Update `QBO_REDIRECT_URI` to `http://localhost:5173/qbo-callback`
3. Redeploy the Edge Function
4. **Remember to change it back** when done testing!

### Step 3: Run Your App Locally

1. Start your development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. Your app should now be running at `http://localhost:5173`

### Step 4: Test the OAuth Flow

1. Navigate to Settings → Accounting Integrations (or wherever you have the Connect QuickBooks button)
2. Click **Connect QuickBooks**
3. You should be redirected to QuickBooks login
4. After authorizing, QuickBooks will redirect to `http://localhost:5173/qbo-callback`
5. Watch the console logs to see the flow:
   ```
   📥 QBO callback received
   🔄 Forwarding to Edge Function with authentication
   ✅ QuickBooks connected successfully!
   ```

---

## 🔍 Debugging

### Enable Detailed Logging

The current implementation already has extensive logging. Open your browser console and look for:

- `📥 QBO callback received` - React component received the callback
- `🔄 Exchanging tokens with QuickBooks...` - Forwarding to Edge Function
- `✅ QuickBooks connected successfully!` - Success!

### Common Issues

#### 1. "401 Unauthorized" when calling Edge Function

**Cause**: Missing or invalid `publicAnonKey`

**Solution**: Verify that `/utils/supabase/info.tsx` has correct values:
```typescript
export const projectId = 'your-project-id';
export const publicAnonKey = 'your-anon-key';
```

#### 2. "Invalid or expired OAuth state"

**Cause**: State parameter mismatch or expired (states expire after 10 minutes)

**Solution**: 
- Try the flow again from the beginning
- Check that cookies are enabled
- Verify KV store is working

#### 3. "Popup was blocked"

**Cause**: Browser blocked the QuickBooks popup

**Solution**: 
- Allow popups for localhost:5173
- Or use redirect mode (modify AccountingIntegrations component)

#### 4. "Missing required OAuth parameters"

**Cause**: QuickBooks didn't send code, realmId, or state

**Solution**:
- Verify redirect URI in QB developer portal EXACTLY matches `http://localhost:5173/qbo-callback`
- Check QB app credentials are correct
- Look at the full URL in console logs

---

## 📁 Relevant Files

### Frontend

- **`/pages/QBOCallback.tsx`** - React component that receives OAuth callback and forwards to Edge Function
- **`/components/devportal/AccountingIntegrations.tsx`** - Contains "Connect QuickBooks" button and logic
- **`/App.tsx`** - Route definition for `/qbo-callback`
- **`/utils/supabase/info.tsx`** - Contains `projectId` and `publicAnonKey`

### Backend

- **`/supabase/functions/server/accounting-integration-routes.tsx`** - OAuth routes:
  - `GET /accounting/qbo/auth-url` - Generates OAuth URL
  - `GET /accounting/qbo/callback` - Processes OAuth callback
- **`/supabase/functions/server/index.tsx`** - Mounts the accounting routes

### Environment Variables

Required in Supabase Edge Functions:
```
QBO_REDIRECT_URI=http://localhost:5173/qbo-callback  (for localhost)
QBO_CLIENT_ID=your_quickbooks_client_id
QBO_CLIENT_SECRET=your_quickbooks_client_secret
```

---

## 🚀 Switching Between Localhost and Production

### For Localhost Testing

1. QB Developer Portal redirect URI: `http://localhost:5173/qbo-callback`
2. Environment variable: `QBO_REDIRECT_URI=http://localhost:5173/qbo-callback`

### For Production

1. QB Developer Portal redirect URI: `https://your-app-domain.com/qbo-callback`
2. Environment variable: `QBO_REDIRECT_URI=https://your-app-domain.com/qbo-callback`

**Pro Tip**: Add BOTH redirect URIs in the QuickBooks Developer Portal. This way you can switch just by changing the environment variable!

---

## 🧪 Testing Checklist

- [ ] QuickBooks Developer Portal has `http://localhost:5173/qbo-callback` in Redirect URIs
- [ ] `QBO_REDIRECT_URI` environment variable is set to `http://localhost:5173/qbo-callback`
- [ ] Dev server is running at `http://localhost:5173`
- [ ] Browser allows popups for localhost:5173
- [ ] Console shows "Connect QuickBooks" button click
- [ ] OAuth URL is generated successfully
- [ ] QuickBooks authorization page loads
- [ ] After authorization, redirects back to localhost
- [ ] Console shows "QBO callback received"
- [ ] Edge Function processes callback successfully
- [ ] Success message appears in UI

---

## 🆘 Still Having Issues?

### Check Edge Function Logs

1. Go to Supabase Dashboard → Your Project → Edge Functions → Logs
2. Look for recent requests to `/accounting/qbo/callback`
3. Check for error messages

### Check Frontend Console

Look for error messages in browser console (F12)

### Verify Callback URL

When QuickBooks redirects back, check the URL in browser address bar. It should look like:
```
http://localhost:5173/qbo-callback?code=XXXXX&realmId=XXXXX&state=XXXXX
```

If any parameter is missing, there's an issue with the QB OAuth setup.

---

## 📝 Notes

- The current implementation uses a **popup window** for OAuth. QuickBooks opens in a popup, and after authorization, it closes automatically.
- The popup communicates with the parent window using `window.postMessage`
- State parameters are stored in the KV store and expire after 10 minutes
- OAuth tokens are encrypted using AES-GCM before being stored
- Connections are firm-scoped (each accounting firm can connect multiple QB companies)

---

## Next Steps After Testing

Once you've verified the OAuth flow works on localhost:

1. Test disconnecting a connection
2. Test token refresh (tokens expire after 1 hour)
3. Test syncing data from QuickBooks
4. Test creating journal entries in QuickBooks
5. Test the complete reconciliation → journal entry → QB push workflow

Happy testing! 🎉
