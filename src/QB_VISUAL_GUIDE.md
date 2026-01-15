# 🎯 VISUAL GUIDE: Where to Click to Test QuickBooks OAuth

## Your Current URL: http://localhost:3000/dashboard

---

## 📍 Step-by-Step Navigation

### 1. Find the Settings Button

In the **LEFT SIDEBAR**, look for:

```
╔══════════════════════════════╗
║  SIDEBAR                     ║
║                              ║
║  🏠 Home                     ║
║                              ║
║  WORKFLOWS                   ║
║  📄 Invoice Extraction       ║
║  🧾 Receipt Extraction       ║
║  🏦 Bank Reconciliation      ║
║  📋 AP Reconciliation        ║
║  📋 AR Reconciliation        ║
║  💳 Credit Card Recon        ║
║  📝 Journal Entries          ║
║  📊 Month End Close          ║
║                              ║
║  📈 Analytics                ║
║  🧪 Dev Tools                ║
║                              ║
║  ⚙️ Settings & Billing   👈 CLICK HERE
╚══════════════════════════════╝
```

### 2. Once in Settings, Find the Integrations Tab

You'll see tabs at the top:

```
╔════════════════════════════════════════════════╗
║  [ General ]  [ Team ]  [ Integrations ]  👈 ║
╚════════════════════════════════════════════════╝
```

Click **"Integrations"**

### 3. Find the Connect QuickBooks Button

In the Integrations tab, you'll see:

```
╔═══════════════════════════════════════════╗
║  Accounting Integrations                  ║
║  ─────────────────────────────────────    ║
║                                           ║
║  Connect your accounting software to      ║
║  automatically sync data and journal      ║
║  entries.                                 ║
║                                           ║
║  ┌────────────────────────────────────┐  ║
║  │  QuickBooks Online                 │  ║
║  │                                    │  ║
║  │  [🔗 Connect QuickBooks]  👈 CLICK │  ║
║  └────────────────────────────────────┘  ║
║                                           ║
║  ┌────────────────────────────────────┐  ║
║  │  Xero (Coming Soon)                │  ║
║  │                                    │  ║
║  │  [ Connect Xero ]                  │  ║
║  └────────────────────────────────────┘  ║
╚═══════════════════════════════════════════╝
```

Click **"Connect QuickBooks"**

---

## 🎬 What Happens Next (Visual Flow)

### Step 1: Popup Opens
```
┌────────────────────────────────────┐
│  🪟 NEW POPUP WINDOW               │
│                                    │
│  QuickBooks Sign In                │
│  ─────────────────────────          │
│                                    │
│  User ID: [________________]      │
│  Password: [________________]     │
│                                    │
│  [ Sign In ]                      │
└────────────────────────────────────┘
```

### Step 2: Authorization Screen
```
┌────────────────────────────────────┐
│  🪟 QUICKBOOKS AUTHORIZATION       │
│                                    │
│  [Your App Name] wants to:         │
│  • Read your company information   │
│  • Read and write accounting data  │
│  • Create journal entries          │
│                                    │
│  Company: [Select Company ▼]      │
│                                    │
│  [ Cancel ]  [ Authorize ] 👈     │
└────────────────────────────────────┘
```

Click **"Authorize"**

### Step 3: Processing
```
┌────────────────────────────────────┐
│  🪟 CONNECTING...                  │
│                                    │
│       ⟳ Loading spinner            │
│                                    │
│  Connecting to QuickBooks...       │
│                                    │
│  Please wait...                    │
└────────────────────────────────────┘
```

### Step 4: Success!
```
POPUP CLOSES AUTOMATICALLY

Main Window Shows:
╔═══════════════════════════════════════════╗
║  ✅ Connected to QuickBooks!              ║
╚═══════════════════════════════════════════╝

Your accounting integrations list now shows:

┌────────────────────────────────────┐
│  QuickBooks Online                 │
│  ────────────────────                │
│  ✅ Connected                       │
│  Company: Your Company Name         │
│  Connected: Just now                │
│                                    │
│  [ 🔄 Sync Now ]  [ 🗑️ Disconnect ]  │
└────────────────────────────────────┘
```

---

## 🚨 Troubleshooting Visual Indicators

### ❌ If You See This:
```
┌────────────────────────────────────┐
│  ⚠️ Popup blocked!                 │
│                                    │
│  Please allow popups for this      │
│  site in your browser settings.    │
└────────────────────────────────────┘
```
**Fix**: Look for popup blocker icon in address bar, click it, allow popups.

---

### ❌ If You See This:
```
┌────────────────────────────────────┐
│  ❌ redirect_uri_mismatch          │
│                                    │
│  The redirect URI doesn't match.   │
└────────────────────────────────────┘
```
**Fix**: Check QuickBooks Developer Portal has EXACTLY:
- `http://localhost:3000/qbo-callback`
- No trailing slash
- Using `http://` not `https://`

---

### ❌ If You See This:
```
┌────────────────────────────────────┐
│  ❌ 401 Unauthorized               │
└────────────────────────────────────┘
```
**Fix**: 
1. Make sure you're logged into Novalare
2. Check your session hasn't expired
3. Refresh the page and try again

---

## 📸 Expected Browser Console Output

Press **F12** to open Developer Console. You should see:

```
✅ SUCCESSFUL FLOW:

📥 QBO callback received: {code: 'present', realmId: '4620816365...', state: 'abc123...'}
🔄 Exchanging tokens with QuickBooks...
📨 Server response: <html>...
✅ QuickBooks connected successfully!
```

```
❌ ERROR FLOW:

❌ OAuth error: redirect_uri_mismatch
OR
❌ Missing required OAuth parameters
OR
❌ Failed to complete connection: ...
```

---

## 🎯 Quick Summary

1. **Left Sidebar** → **⚙️ Settings & Billing**
2. **Top Tabs** → **Integrations**
3. **QuickBooks Card** → **🔗 Connect QuickBooks**
4. **Popup** → Enter credentials → **Sign In**
5. **Authorization** → Select company → **Authorize**
6. **Wait** → Popup closes → **Success!** 🎉

---

## 📞 If It Still Doesn't Work

Check `/TEST_QB_NOW.md` for detailed troubleshooting steps!

---

**Ready? Go navigate to Settings! 🚀**
