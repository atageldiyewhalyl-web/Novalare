# ✅ YOUR PRE-TEST CHECKLIST (Copy & Check Off!)

## Before You Click "Connect QuickBooks"

---

### 1. ✅ QuickBooks Developer Portal Setup

- [ ] I logged into: https://developer.intuit.com/app/developer/myapps
- [ ] I selected my QuickBooks app
- [ ] I clicked "Keys & credentials"
- [ ] I added this redirect URI: `http://localhost:3000/qbo-callback`
- [ ] I clicked "Save"
- [ ] I can see it in the redirect URIs list

**⚠️ MUST BE EXACTLY**: `http://localhost:3000/qbo-callback`
- No trailing slash
- Port is 3000 (not 5173!)
- Using `http://` not `https://`

---

### 2. ✅ Supabase Edge Function Secret Update

Since you're using **production Supabase Edge Functions**, you need to update the redirect URI:

- [ ] I went to: https://supabase.com/dashboard
- [ ] I selected my project
- [ ] I went to: Settings → Edge Functions → Secrets
- [ ] I found `QBO_REDIRECT_URI` in the list
- [ ] I clicked "Edit"
- [ ] I changed it to: `http://localhost:3000/qbo-callback`
- [ ] I clicked "Save"
- [ ] ⚠️ **I NOTED TO CHANGE THIS BACK** to production URL after testing

**Current value should be**: `http://localhost:3000/qbo-callback`

---

### 3. ✅ App is Running

- [ ] I ran: `npm run dev` (or `yarn dev`)
- [ ] Terminal shows: "Local: http://localhost:3000/"
- [ ] I opened: http://localhost:3000 in my browser
- [ ] App loaded successfully
- [ ] No errors in terminal

---

### 4. ✅ I'm Logged In

- [ ] I'm logged into my Novalare account
- [ ] I can see the dashboard
- [ ] My name/email appears in top-right corner
- [ ] Session is active (not expired)

---

### 5. ✅ Browser Settings

- [ ] Popups are ALLOWED for localhost:3000
- [ ] No aggressive ad blockers running
- [ ] Developer Console (F12) is open to watch logs
- [ ] I'm using a modern browser (Chrome, Edge, Firefox, Safari)

---

### 6. ✅ QuickBooks Login Ready

- [ ] I have my QuickBooks credentials handy:
  - User ID: ___________________________
  - Password: ___________________________
- [ ] OR I have QuickBooks Sandbox test account ready
- [ ] I know which company I want to connect

---

## 🚀 NOW YOU'RE READY TO TEST!

### Navigation Path:

```
http://localhost:3000/dashboard
    ↓
Left Sidebar → ⚙️ Settings & Billing
    ↓
Top Tabs → Integrations
    ↓
QuickBooks Card → 🔗 Connect QuickBooks
    ↓
🎉 MAGIC HAPPENS!
```

---

## 📋 During Testing - Watch For:

### ✅ Good Signs:
- [ ] Popup opened (not blocked)
- [ ] QuickBooks login page loaded
- [ ] After login, authorization page appeared
- [ ] After authorize, URL changed to: `http://localhost:3000/qbo-callback?code=...`
- [ ] Loading spinner appeared: "Connecting to QuickBooks..."
- [ ] Console shows: "📥 QBO callback received"
- [ ] Console shows: "✅ QuickBooks connected successfully!"
- [ ] Popup closed automatically
- [ ] Success toast/notification appeared
- [ ] Company name now shows in integrations list

### ❌ Bad Signs (And Quick Fixes):

**Popup blocked:**
- Fix: Click popup blocker icon in address bar → Allow

**"redirect_uri_mismatch":**
- Fix: Double-check Step 1 above

**"401 Unauthorized":**
- Fix: Refresh page, log in again

**"Invalid OAuth state":**
- Fix: Wait 1 minute, try entire flow again

---

## 🐛 Console Commands to Debug

If something goes wrong, open console (F12) and type:

```javascript
// Check if you're logged in
localStorage.getItem('supabase.auth.token')

// Check projectId
import('./utils/supabase/info').then(m => console.log(m.projectId))

// Check publicAnonKey exists
import('./utils/supabase/info').then(m => console.log(m.publicAnonKey ? 'Key exists' : 'Missing!'))
```

---

## 📊 Success Metrics

After successful connection, you should see:

```
╔═══════════════════════════════════════════╗
║  Accounting Integrations                  ║
║  ─────────────────────────────────────    ║
║                                           ║
║  ✅ QuickBooks Online                     ║
║  ────────────────────                     ║
║  Company: [Your Company Name]             ║
║  Realm ID: 462081636...                   ║
║  Connected: Just now                      ║
║  Status: Active ✓                         ║
║                                           ║
║  [ 🔄 Sync Now ]  [ 🗑️ Disconnect ]       ║
╚═══════════════════════════════════════════╝
```

---

## 🎯 After Successful Connection

Test these features:

- [ ] Click "Sync Now" → Should fetch Chart of Accounts
- [ ] Check Edge Function logs in Supabase Dashboard
- [ ] Click "Disconnect" → Connection should be removed
- [ ] Click "Connect QuickBooks" again → Should reconnect successfully
- [ ] Try connecting a second company (if you have multiple)

---

## 📝 Notes Section

**Test Date**: ________________

**QuickBooks Company Used**: ________________

**Any Issues**: 
___________________________________________
___________________________________________
___________________________________________

**Working Features**:
- [ ] OAuth connection
- [ ] Company display
- [ ] Sync data
- [ ] Disconnect/reconnect

---

## ⚠️ REMEMBER AFTER TESTING!

### CRITICAL: Revert Production Secret

After you're done testing on localhost:

- [ ] Go to: Supabase Dashboard → Edge Functions → Secrets
- [ ] Find: `QBO_REDIRECT_URI`
- [ ] Change it back to: `https://your-production-domain.com/qbo-callback`
- [ ] Click "Save"

**WHY?** Otherwise production users won't be able to connect!

---

## 🆘 Help Resources

If you get stuck:

1. **Quick Guide**: `/TEST_QB_NOW.md`
2. **Visual Navigation**: `/QB_VISUAL_GUIDE.md`
3. **Detailed Docs**: `/LOCALHOST_QB_TESTING_GUIDE.md`
4. **Architecture**: `/ACCOUNTING_INTEGRATION_ARCHITECTURE.md`

---

## ✅ FINAL CHECK BEFORE CLICKING

All 6 sections above have checkmarks? 

**YES** → 🚀 **GO TEST NOW!**

**NO** → ⚠️ Complete missing steps first

---

**Good luck! You've got this! 🎉**
