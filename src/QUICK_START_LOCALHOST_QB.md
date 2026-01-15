# 🚀 Quick Start: Test QuickBooks OAuth on Localhost

## TL;DR - 3 Steps to Test Locally

### 1️⃣ Update QuickBooks Developer Portal (ONE TIME)

Go to https://developer.intuit.com/app/developer/myapps → Your App → Keys & credentials:

**Add this Redirect URI** (keep your production one too):
```
http://localhost:5173/qbo-callback
```

### 2️⃣ Create Local Environment File

```bash
# Copy the example file
cp supabase/functions/server/.env.local.example supabase/functions/server/.env.local

# Edit it and add your credentials:
# - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# - QBO_CLIENT_ID, QBO_CLIENT_SECRET
# - QBO_REDIRECT_URI=http://localhost:5173/qbo-callback
# - OPENAI_API_KEY
```

### 3️⃣ Run Your App

```bash
# Terminal 1: Start the frontend
npm run dev
# or
yarn dev

# Your app is now at http://localhost:5173
```

**Note**: The current setup uses your **production** Supabase Edge Functions. The QBO callback will be handled by the deployed Edge Function. To test with local Edge Functions, see the advanced setup below.

---

## ✅ Test the OAuth Flow

1. Go to http://localhost:5173
2. Login to your dev account
3. Navigate to: **Settings → Accounting Integrations** (or `/devportal?tab=settings`)
4. Click **Connect QuickBooks**
5. Authorize on QuickBooks
6. Watch it redirect back and connect! 🎉

---

## 🔧 Advanced: Run Edge Functions Locally (Optional)

If you want to test changes to the Edge Function code without deploying:

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Link Your Project

```bash
supabase login
supabase link --project-ref your-project-ref
```

### Step 3: Serve Functions Locally

```bash
cd supabase/functions
supabase functions serve --env-file ./server/.env.local
```

This will start a local Edge Function server at: `http://localhost:54321/functions/v1/`

### Step 4: Update Frontend to Use Local Functions

Edit `/utils/supabase/info.tsx` temporarily:

```typescript
// For local testing
export const projectId = 'localhost:54321';  // Changed
export const publicAnonKey = 'your-anon-key-here';  // Same
```

**OR** create a separate config for development:

```typescript
export const isDev = import.meta.env.DEV;
export const projectId = isDev 
  ? 'localhost:54321' 
  : 'your-production-project-id';
```

### Step 5: Update URLs in AccountingIntegrations.tsx

The component currently calls:
```
https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/...
```

For local testing, this becomes:
```
http://localhost:54321/functions/v1/make-server-53c2e113/...
```

---

## 🐛 Troubleshooting

### "Cannot find module .env.local"

That's normal! The `.env.local` file is only used by Supabase CLI when running functions locally. For the deployed Edge Functions, secrets are managed through the Supabase Dashboard.

### "401 Unauthorized"

- Check that `publicAnonKey` in `/utils/supabase/info.tsx` is correct
- Verify you're logged in (have an active session)

### "Invalid OAuth state"

- State tokens expire after 10 minutes
- Try the full flow again from clicking "Connect QuickBooks"

### QuickBooks shows "redirect_uri mismatch"

- Verify EXACTLY: `http://localhost:5173/qbo-callback` is in QB Developer Portal
- Check for trailing slashes (should NOT have one)
- Make sure it's using `http://` not `https://` for localhost

### Connection succeeds but doesn't show in UI

- Check browser console for errors
- Verify the KV store is saving the connection
- Check Edge Function logs in Supabase Dashboard

---

## 📋 Checklist for First-Time Setup

- [ ] QuickBooks app created at developer.intuit.com
- [ ] Localhost redirect URI added: `http://localhost:5173/qbo-callback`
- [ ] `.env.local` file created in `/supabase/functions/server/`
- [ ] All required environment variables filled in
- [ ] Dev server running at `http://localhost:5173`
- [ ] Logged into a test account in your app
- [ ] Browser allows popups for localhost

---

## 🎯 What Should Happen

1. **Click "Connect QuickBooks"** → Popup opens with QuickBooks login
2. **Authorize** → QuickBooks redirects to `http://localhost:5173/qbo-callback?code=XXX&realmId=XXX&state=XXX`
3. **React component loads** → Shows "Connecting to QuickBooks..." spinner
4. **Forwards to Edge Function** → With authentication header
5. **Edge Function processes** → Exchanges code for tokens, saves to KV store
6. **Popup closes** → Parent window receives success message
7. **UI updates** → Shows connected QuickBooks company

---

## 🔄 Production vs Localhost Comparison

| Aspect | Production | Localhost |
|--------|------------|-----------|
| **Redirect URI** | `https://your-domain.com/qbo-callback` | `http://localhost:5173/qbo-callback` |
| **Frontend URL** | `https://your-domain.com` | `http://localhost:5173` |
| **Edge Functions** | `https://project.supabase.co/functions/v1/` | Same (or localhost with Supabase CLI) |
| **Environment Variables** | Supabase Dashboard → Edge Functions → Secrets | `.env.local` file (if running locally) |
| **QuickBooks App Mode** | Production mode | Development/Sandbox mode |

---

## 📝 Pro Tips

1. **Keep both redirect URIs** in QuickBooks Developer Portal - you can switch between environments just by changing the env variable

2. **Use QuickBooks Sandbox** for testing:
   - Sign up for a free test company at https://developer.intuit.com/app/developer/sandbox
   - Use sandbox credentials to test without affecting real data

3. **Check Edge Function logs** in Supabase Dashboard for backend debugging

4. **Use browser console** (F12) for frontend debugging - extensive logging is already in place

5. **Test token refresh** - QB tokens expire after 1 hour, refresh tokens last 100 days

---

## 🆘 Need Help?

Check the detailed guide: `/LOCALHOST_QB_TESTING_GUIDE.md`

Or review the architecture: `/ACCOUNTING_INTEGRATION_ARCHITECTURE.md`

---

**Ready to test? Let's go! 🚀**
