# QuickBooks OAuth Setup Guide

## ⚠️ CRITICAL ISSUE: OAuth Callback 401 Error

### Problem
You're getting `{"code":401,"message":"Missing authorization header"}` when accessing:
- `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/health`
- `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/qbo/callback`

### Root Cause
**Supabase Edge Functions require authentication by default.** Even though our Hono application doesn't require app-level auth for these routes, Supabase's infrastructure layer checks for an Authorization header BEFORE the request reaches our Hono app.

### The OAuth Callback Dilemma
When QuickBooks redirects users back to your callback URL after authorization, **QuickBooks' servers won't send your Supabase auth token**. This creates a chicken-and-egg problem:
- ❌ You can't require auth (QuickBooks won't send it)
- ❌ But Supabase Edge Functions require auth by default

## ✅ SOLUTION: Use an HTML Bridge Page

Since we can't bypass Supabase's authentication at the Edge Function level, we use an **React callback page** hosted on your frontend that:
1. Receives the OAuth callback from QuickBooks (no auth needed - it's a regular app route)
2. Forwards the callback to your Edge Function WITH the proper authentication

### Implementation

**Step 1: The callback page is already created** at `/pages/QBOCallback.tsx` with route `/qbo-callback`

**Step 2: Find your app's URL**

Since you're testing in Figma Make, you need to find your app's deployed URL:

1. In your browser, navigate to your running app (not the Figma editor)
2. Open DevTools (F12 or right-click → Inspect)
3. Go to Console tab
4. Type: `window.location.origin`
5. Press Enter
6. Copy that URL (example: `https://abc123.figma.site`)

**Step 3: Update your QBO_REDIRECT_URI environment variable**

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

For Figma Make testing:
```
QBO_REDIRECT_URI=https://[YOUR_FIGMA_SITE]/qbo-callback
```

For production (later):
```
QBO_REDIRECT_URI=https://app.novalare.com/qbo-callback
```

**Step 4: Update QuickBooks Developer Portal**

1. Go to https://developer.intuit.com/
2. Navigate to your app → Keys & Credentials
3. Add the Redirect URI (use the same URL as Step 3):
   ```
   https://[YOUR_FIGMA_SITE]/qbo-callback
   ```
4. Save changes