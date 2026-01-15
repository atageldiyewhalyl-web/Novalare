# 🏠 Localhost Testing for QuickBooks OAuth - Complete Guide

## 🎯 Quick Navigation

**Just want to test? Start here:**
1. **[Quick Start Guide](./QUICK_START_LOCALHOST_QB.md)** ⚡ - 3 steps to get started
2. Run the setup script:
   - **Mac/Linux**: `chmod +x setup-localhost.sh && ./setup-localhost.sh`
   - **Windows**: `setup-localhost.bat`

**Want to understand how it works?**
- **[OAuth Flow Diagram](./QB_OAUTH_FLOW_LOCALHOST.md)** 📊 - Visual step-by-step
- **[Detailed Guide](./LOCALHOST_QB_TESTING_GUIDE.md)** 📖 - Full documentation

**Everything done?**
- **[Setup Complete Summary](./LOCALHOST_TESTING_COMPLETE.md)** ✅ - What's configured and next steps

---

## 📁 Files in This Setup

| File | Purpose | When to Use |
|------|---------|-------------|
| `QUICK_START_LOCALHOST_QB.md` | 3-step quick start | Getting started fast |
| `QB_OAUTH_FLOW_LOCALHOST.md` | Visual flow diagram | Understanding OAuth flow |
| `LOCALHOST_QB_TESTING_GUIDE.md` | Comprehensive guide | Troubleshooting & debugging |
| `LOCALHOST_TESTING_COMPLETE.md` | Setup summary | Reference after setup |
| `setup-localhost.sh` | Auto-setup script (Mac/Linux) | Automated configuration |
| `setup-localhost.bat` | Auto-setup script (Windows) | Automated configuration |
| `supabase/functions/server/.env.local.example` | Environment variables template | Manual configuration |

---

## ⚡ Fastest Way to Get Started

### 1. Run the Setup Script

**Mac/Linux:**
```bash
chmod +x setup-localhost.sh
./setup-localhost.sh
```

**Windows:**
```cmd
setup-localhost.bat
```

The script will:
- Create `.env.local` from template
- Prompt for your credentials
- Save configuration automatically

### 2. Update QuickBooks Developer Portal

1. Go to https://developer.intuit.com/app/developer/myapps
2. Select your app → **Keys & credentials**
3. Under **Redirect URIs**, add:
   ```
   http://localhost:5173/qbo-callback
   ```
4. Click **Save**

### 3. Start Testing

```bash
npm run dev
```

Then:
1. Go to http://localhost:5173
2. Login to your dev account
3. Navigate to **Settings → Accounting Integrations**
4. Click **Connect QuickBooks**
5. Authorize and watch it work! 🎉

---

## 🏗️ How It Works (Technical Summary)

### The Bridge Pattern

Your app uses a clever **React component bridge** to solve the OAuth authentication challenge:

```
┌─────────────┐
│ QuickBooks  │ Redirects to React route (no auth required)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   React     │ Adds authentication header
│  /qbo-      │ (publicAnonKey)
│  callback   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Edge     │ Processes OAuth callback
│  Function   │ Exchanges code for tokens
└─────────────┘
```

**Why this works:**
- ✅ QuickBooks can redirect to React routes (they're public)
- ✅ React component can access Supabase credentials
- ✅ React forwards to Edge Function WITH authentication
- ✅ Edge Function processes securely

**Why direct approaches fail:**
- ❌ QuickBooks → Edge Function directly = 401 (no auth header)
- ❌ Using API keys in URL = Security risk
- ❌ Static HTML page = Can't access secrets securely

### Key Files

**Frontend (already exists ✅):**
- `/pages/QBOCallback.tsx` - React bridge component
- `/components/devportal/AccountingIntegrations.tsx` - Connect button
- `/App.tsx` - Route definition

**Backend (already exists ✅):**
- `/supabase/functions/server/accounting-integration-routes.tsx` - OAuth logic

**You only need to configure:**
- QuickBooks redirect URI → `http://localhost:5173/qbo-callback`
- Environment variable `QBO_REDIRECT_URI` → `http://localhost:5173/qbo-callback`

---

## 🔧 Configuration Options

### Option A: Use Production Edge Functions (Easier)

**Good for**: Quick testing without running local Edge Functions

**Steps:**
1. Update `QBO_REDIRECT_URI` in Supabase Dashboard → Edge Functions → Secrets
2. Set to: `http://localhost:5173/qbo-callback`
3. Run your frontend: `npm run dev`
4. Test OAuth flow

**Remember**: Change `QBO_REDIRECT_URI` back to production URL when done!

### Option B: Run Edge Functions Locally (Advanced)

**Good for**: Testing Edge Function code changes before deploying

**Steps:**
1. Install Supabase CLI: `npm install -g supabase`
2. Create `.env.local` in `/supabase/functions/server/`
3. Run: `supabase functions serve --env-file ./server/.env.local`
4. Update frontend to use `http://localhost:54321/functions/v1/`

---

## ✅ Pre-Flight Checklist

Before testing, make sure you have:

**QuickBooks Setup:**
- [ ] QuickBooks app created at developer.intuit.com
- [ ] `QBO_CLIENT_ID` and `QBO_CLIENT_SECRET` obtained
- [ ] Redirect URI added: `http://localhost:5173/qbo-callback`

**Environment:**
- [ ] `.env.local` created (or production secrets updated)
- [ ] `QBO_REDIRECT_URI` set to localhost
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] `OPENAI_API_KEY` configured

**App:**
- [ ] Dev server ready to run
- [ ] Test account exists in your app
- [ ] Browser allows popups for localhost

---

## 🧪 Testing Flow

```
1. User clicks "Connect QuickBooks"
   ↓
2. Popup opens with QuickBooks login
   ↓
3. User authorizes app
   ↓
4. QB redirects to: http://localhost:5173/qbo-callback?code=XXX&realmId=XXX&state=XXX
   ↓
5. React component shows: "Connecting to QuickBooks..."
   ↓
6. React forwards to Edge Function (with auth)
   ↓
7. Edge Function exchanges code for tokens
   ↓
8. Tokens encrypted and saved to KV store
   ↓
9. Company info fetched from QuickBooks
   ↓
10. Success message sent to parent window
    ↓
11. Popup closes automatically
    ↓
12. UI updates with connected company
    ↓
✅ Done!
```

---

## 🐛 Common Issues

### "401 Unauthorized"
- **Problem**: Missing/invalid `publicAnonKey`
- **Fix**: Check `/utils/supabase/info.tsx`

### "redirect_uri_mismatch"
- **Problem**: QB redirect URI doesn't match env variable
- **Fix**: Ensure EXACT match: `http://localhost:5173/qbo-callback`
  - No trailing slash
  - Include `http://` protocol
  - Exact port number

### "Invalid OAuth state"
- **Problem**: State expired (10-minute timeout)
- **Fix**: Try the flow again from start

### "Popup blocked"
- **Problem**: Browser security settings
- **Fix**: Allow popups for `localhost:5173`

### Connection saves but doesn't show
- **Problem**: Frontend not refreshing
- **Fix**: Check console for postMessage, verify event listener

---

## 🔍 Debugging Tips

### Frontend Console (F12)
Look for:
- `📥 QBO callback received` - Callback reached React
- `🔄 Exchanging tokens...` - Forwarding to Edge Function
- `✅ QuickBooks connected!` - Success

### Supabase Dashboard
- Go to: Edge Functions → Logs
- Filter: `make-server-53c2e113`
- Look for: `/accounting/qbo/callback` requests

### Network Tab (F12)
- Watch request to `/accounting/qbo/callback`
- Check response (should be HTML with `<script>`)
- Verify status code (should be 200)

---

## 📖 Documentation Index

### Getting Started
- **[Quick Start](./QUICK_START_LOCALHOST_QB.md)** - Start here
- **[Setup Scripts](#-fastest-way-to-get-started)** - Automated setup

### Understanding
- **[OAuth Flow Diagram](./QB_OAUTH_FLOW_LOCALHOST.md)** - Visual guide
- **[Architecture Docs](./ACCOUNTING_INTEGRATION_ARCHITECTURE.md)** - System design

### Reference
- **[Complete Guide](./LOCALHOST_QB_TESTING_GUIDE.md)** - Full documentation
- **[Setup Summary](./LOCALHOST_TESTING_COMPLETE.md)** - What's configured
- **[Environment Variables](./supabase/functions/server/.env.local.example)** - Config template

---

## 🚀 Next Steps After Testing

Once OAuth works on localhost:

1. **Test full flow:**
   - [ ] Connect QuickBooks company
   - [ ] Disconnect company
   - [ ] Reconnect (should work with existing credentials)
   - [ ] Connect second company (multi-tenant test)

2. **Test data sync:**
   - [ ] Fetch Chart of Accounts
   - [ ] Verify accounts appear in UI
   - [ ] Check account details match QB

3. **Test journal entries:**
   - [ ] Complete a bank reconciliation
   - [ ] Convert unmatched transactions
   - [ ] Push journal entries to QuickBooks
   - [ ] Verify in QuickBooks web app

4. **Test token management:**
   - [ ] Wait 1 hour (token expires)
   - [ ] Verify auto-refresh works
   - [ ] Check new tokens are saved

5. **Deploy to production:**
   - [ ] Change `QBO_REDIRECT_URI` back to production URL
   - [ ] Update QB redirect URI to production domain
   - [ ] Deploy and test on production

---

## 📝 Pro Tips

1. **Keep both redirect URIs** in QuickBooks Developer Portal (localhost + production). Switch by changing env variable only.

2. **Use QuickBooks Sandbox** for testing:
   - Free test companies
   - Won't affect real accounting data
   - Sign up at: https://developer.intuit.com/app/developer/sandbox

3. **Check Edge Function logs** frequently - they have extensive debugging output

4. **Use browser console** - frontend has detailed logging too

5. **Test token refresh** before deploying - it's critical for long-term reliability

---

## 🆘 Need Help?

1. Check the **[Troubleshooting section](#-common-issues)** above
2. Review **[OAuth Flow Diagram](./QB_OAUTH_FLOW_LOCALHOST.md)** to understand the process
3. Read **[Complete Guide](./LOCALHOST_QB_TESTING_GUIDE.md)** for detailed debugging
4. Check **Supabase Edge Function logs** for backend errors
5. Check **browser console** for frontend errors

---

## 🎉 You're Ready!

Your QuickBooks OAuth integration is configured and ready to test on localhost. The code is already in place - you just need to:

✅ Configure QuickBooks Developer Portal
✅ Set environment variables  
✅ Run the app
✅ Test the flow

**Start with**: [Quick Start Guide](./QUICK_START_LOCALHOST_QB.md) or run `./setup-localhost.sh` (Mac/Linux) or `setup-localhost.bat` (Windows)

Happy testing! 🚀

---

*Last updated: December 2024*
