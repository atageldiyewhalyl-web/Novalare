# ✅ Localhost Testing Setup - COMPLETE

## What We Just Set Up

Your QuickBooks OAuth integration is **already configured to work on localhost** with minimal changes needed! 🎉

---

## 📁 New Files Created

1. **`/QUICK_START_LOCALHOST_QB.md`** ⚡
   - Quick 3-step setup guide
   - Perfect for getting started fast
   - Includes troubleshooting checklist

2. **`/LOCALHOST_QB_TESTING_GUIDE.md`** 📖
   - Comprehensive setup guide
   - Architecture explanation
   - Advanced debugging tips

3. **`/QB_OAUTH_FLOW_LOCALHOST.md`** 📊
   - Visual flow diagram
   - Step-by-step breakdown
   - Security explanation

4. **`/supabase/functions/server/.env.local.example`** ⚙️
   - Template for local environment variables
   - All required and optional variables documented
   - Copy-paste ready

5. **`/.gitignore`** 🔒
   - Prevents committing sensitive files
   - Protects `.env.local` files
   - Standard best practices

---

## 🚀 How to Start Testing NOW

### **Option 1: Quick Start (Recommended)**

```bash
# 1. Read this first:
cat QUICK_START_LOCALHOST_QB.md

# 2. Set up environment variables:
cp supabase/functions/server/.env.local.example supabase/functions/server/.env.local
# Edit .env.local and add your credentials

# 3. Update QuickBooks Developer Portal:
# Add: http://localhost:5173/qbo-callback to Redirect URIs

# 4. Run your app:
npm run dev

# 5. Test OAuth:
# Go to http://localhost:5173 → Settings → Connect QuickBooks
```

### **Option 2: Full Understanding**

Read in this order:
1. `/QUICK_START_LOCALHOST_QB.md` - Get started
2. `/QB_OAUTH_FLOW_LOCALHOST.md` - Understand the flow
3. `/LOCALHOST_QB_TESTING_GUIDE.md` - Deep dive

---

## ✨ What Makes This Setup Work

### The Bridge Pattern

Your current implementation uses a **React callback bridge**:

```
QuickBooks OAuth Redirect
    ↓
React Route (/qbo-callback)
    ↓ (adds authentication)
Edge Function (/accounting/qbo/callback)
    ↓
Success!
```

**Why it works:**
- QuickBooks redirects to a **React route** (no auth required)
- React component **forwards to Edge Function** WITH authentication
- Edge Function processes OAuth callback with proper security

### Files Involved

**Frontend:**
- `/pages/QBOCallback.tsx` - React bridge component ✅ Already exists
- `/components/devportal/AccountingIntegrations.tsx` - Connect button ✅ Already exists
- `/App.tsx` - Route for `/qbo-callback` ✅ Already exists

**Backend:**
- `/supabase/functions/server/accounting-integration-routes.tsx` - OAuth logic ✅ Already exists

**Config:**
- Environment variable: `QBO_REDIRECT_URI` - Need to set to localhost
- QuickBooks Developer Portal: Add localhost redirect URI

---

## 🔧 What You Need to Configure

### 1. QuickBooks Developer Portal (ONE TIME)

Go to: https://developer.intuit.com/app/developer/myapps

**Add this Redirect URI** (keep production one too):
```
http://localhost:5173/qbo-callback
```

### 2. Environment Variables

**Current Setup** (Production):
- You're using Supabase Dashboard → Edge Functions → Secrets
- `QBO_REDIRECT_URI` is set to production URL

**For Localhost Testing**:

You have 2 options:

#### Option A: Use Production Edge Functions (Easier)
- Temporarily change `QBO_REDIRECT_URI` in Supabase Dashboard to `http://localhost:5173/qbo-callback`
- Your localhost frontend will call the production Edge Function
- **Remember to change back when done!**

#### Option B: Run Edge Functions Locally (Advanced)
- Install Supabase CLI: `npm install -g supabase`
- Create `.env.local` file (see `.env.local.example`)
- Run: `supabase functions serve --env-file ./server/.env.local`
- Edge Functions will run at `http://localhost:54321/functions/v1/`

---

## 📋 Pre-Flight Checklist

Before you start testing, verify:

- [ ] QuickBooks app exists at developer.intuit.com
- [ ] You have `QBO_CLIENT_ID` and `QBO_CLIENT_SECRET`
- [ ] Localhost redirect URI added to QB app: `http://localhost:5173/qbo-callback`
- [ ] Environment variables configured (Option A or B above)
- [ ] Dev server ready to start
- [ ] Test account exists in your app
- [ ] Browser allows popups for localhost

---

## 🧪 Testing Steps

1. **Start Dev Server**
   ```bash
   npm run dev
   ```

2. **Login**
   - Go to `http://localhost:5173`
   - Login to your test account

3. **Navigate to Integrations**
   - Settings → Accounting Integrations
   - Or directly: `http://localhost:5173/devportal?tab=settings`

4. **Connect QuickBooks**
   - Click "Connect QuickBooks" button
   - Popup opens with QuickBooks login
   - Authorize the app
   - Popup closes automatically
   - Check UI for connected company ✅

5. **Verify Connection**
   - Company name should appear
   - Status: "Connected"
   - Options: Disconnect, Sync Now

---

## 🐛 Common Issues & Fixes

### "401 Unauthorized"
**Cause**: Missing authentication header
**Fix**: Verify `publicAnonKey` in `/utils/supabase/info.tsx`

### "redirect_uri_mismatch"
**Cause**: QB redirect URI doesn't match env variable
**Fix**: Ensure EXACTLY `http://localhost:5173/qbo-callback` in BOTH:
- QuickBooks Developer Portal Redirect URIs
- `QBO_REDIRECT_URI` environment variable

### "Invalid OAuth state"
**Cause**: State expired (10-minute timeout)
**Fix**: Try the flow again from the start

### Popup Blocked
**Cause**: Browser security settings
**Fix**: Allow popups for `localhost:5173`

### Connection Saves But Doesn't Show
**Cause**: Frontend not refreshing connections list
**Fix**: Check browser console, verify postMessage is received

---

## 🔍 Debugging Tools

### Frontend Console (F12)
Look for these log messages:
- `📥 QBO callback received` - Callback hit React component
- `🔄 Exchanging tokens with QuickBooks...` - Forwarding to Edge Function
- `✅ QuickBooks connected successfully!` - Success!

### Supabase Dashboard
- Go to: Project → Edge Functions → Logs
- Filter by: `make-server-53c2e113`
- Look for: `/accounting/qbo/callback` requests

### Network Tab (F12)
- Watch for request to `/accounting/qbo/callback`
- Should return HTML with `<script>` tag
- Check response status (should be 200)

---

## 🎯 What's Already Working

✅ **Frontend OAuth initiation** - "Connect QuickBooks" button
✅ **Backend OAuth URL generation** - `/accounting/qbo/auth-url` endpoint
✅ **React callback bridge** - `/qbo-callback` route
✅ **Edge Function callback handler** - `/accounting/qbo/callback` endpoint
✅ **Token encryption** - AES-GCM encryption for secure storage
✅ **Connection storage** - KV store integration
✅ **UI updates** - postMessage communication
✅ **Multi-tenant support** - Firm-scoped connections

---

## 🔄 Localhost ⇄ Production Switching

### To Switch to Localhost:
1. Update `QBO_REDIRECT_URI` → `http://localhost:5173/qbo-callback`
2. Ensure QB Developer Portal has localhost redirect URI
3. Run dev server: `npm run dev`

### To Switch Back to Production:
1. Update `QBO_REDIRECT_URI` → `https://your-domain.com/qbo-callback`
2. Redeploy Edge Functions (if changed)
3. Test on production domain

**Pro Tip**: Keep BOTH redirect URIs in QuickBooks Developer Portal permanently. Then you only need to change the environment variable!

---

## 📚 Additional Resources

### Architecture Docs
- `/ACCOUNTING_INTEGRATION_ARCHITECTURE.md` - Complete system design
- `/QUICKBOOKS_INTEGRATION_SETUP.md` - Original setup guide

### QuickBooks Resources
- [QuickBooks OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [API Explorer](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
- [Sandbox Testing](https://developer.intuit.com/app/developer/sandbox)

### Supabase Resources
- [Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Local Development](https://supabase.com/docs/guides/functions/local-development)

---

## 🎉 Next Steps After Testing

Once OAuth is working:

1. **Test Token Refresh**
   - Tokens expire after 1 hour
   - Refresh tokens last 100 days
   - Verify auto-refresh works

2. **Test Data Sync**
   - Fetch Chart of Accounts from QuickBooks
   - Verify data appears in UI

3. **Test Journal Entry Creation**
   - Complete a reconciliation
   - Convert unmatched transactions to journal entries
   - Push to QuickBooks

4. **Test Disconnection**
   - Click "Disconnect" button
   - Verify tokens are removed
   - Verify UI updates

5. **Test Multiple Companies**
   - Connect a second QB company to same firm
   - Verify firm can switch between companies

---

## 🚨 Important Reminders

⚠️ **Security**:
- Never commit `.env.local` files to git (already in .gitignore)
- Don't share QB client secrets publicly
- Use QuickBooks Sandbox for testing, not real company data

⚠️ **Environment Variables**:
- Production secrets are in Supabase Dashboard → Edge Functions → Secrets
- Local secrets are in `/supabase/functions/server/.env.local` (if using CLI)
- Don't mix them up!

⚠️ **Redirect URI**:
- Must EXACTLY match between QB Developer Portal and env variable
- Include protocol (`http://` or `https://`)
- No trailing slash
- Case-sensitive

---

## ✅ You're All Set!

Your QuickBooks OAuth integration is ready to test on localhost. The code is already in place, you just need to:

1. Configure QuickBooks Developer Portal
2. Set environment variables
3. Run the app
4. Test the flow

**Start here**: `/QUICK_START_LOCALHOST_QB.md`

Happy testing! 🚀

---

## 📞 Need Help?

If you run into issues:

1. Check the troubleshooting section in `/QUICK_START_LOCALHOST_QB.md`
2. Review the flow diagram in `/QB_OAUTH_FLOW_LOCALHOST.md`
3. Enable console logging and check for error messages
4. Verify Edge Function logs in Supabase Dashboard

Good luck! You got this! 💪
