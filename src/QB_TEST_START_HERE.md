# 🚀 START HERE: Test QuickBooks OAuth Now!

## Your Setup: localhost:3000

---

## 📖 Quick Navigation

**Choose your path:**

1. **Just tell me what to do** → Read "TL;DR" below (3 minutes)
2. **Show me where to click** → Read `/QB_VISUAL_GUIDE.md`
3. **Give me a checklist** → Read `/YOUR_CHECKLIST.md`
4. **I want detailed docs** → Read `/TEST_QB_NOW.md`

---

## 🎯 TL;DR - Do This Right Now (3 Steps)

### Step 1: Update QuickBooks (2 minutes)

1. Go to: https://developer.intuit.com/app/developer/myapps
2. Click your app → "Keys & credentials"
3. Under "Redirect URIs", click "Add URI"
4. Enter: `http://localhost:3000/qbo-callback`
5. Click "Save"

**✅ Done!**

---

### Step 2: Update Supabase Secret (2 minutes)

1. Go to: https://supabase.com/dashboard
2. Select your project → Settings → Edge Functions → Secrets
3. Find `QBO_REDIRECT_URI`, click "Edit"
4. Change to: `http://localhost:3000/qbo-callback`
5. Click "Save"

**⚠️ Remember to change this back after testing!**

**✅ Done!**

---

### Step 3: Test It! (1 minute)

Your app is already running at http://localhost:3000/dashboard

1. In **left sidebar**, click: **⚙️ Settings & Billing**
2. Click the **"Integrations"** tab
3. Click: **"Connect QuickBooks"**
4. Popup opens → Sign into QuickBooks
5. Click "Authorize"
6. **Success!** 🎉

**✅ Done!**

---

## 🎬 What You'll See

### Good Flow:
```
Click Connect → Popup opens → QB Login → Authorize 
→ "Connecting..." → Popup closes → Success! ✅
```

### Console Logs (F12):
```
📥 QBO callback received
🔄 Exchanging tokens with QuickBooks...
✅ QuickBooks connected successfully!
```

### UI Updates:
```
╔═══════════════════════════════════╗
║ ✅ QuickBooks Online              ║
║ Company: Your Company Name        ║
║ Connected: Just now               ║
║ [ Sync Now ] [ Disconnect ]      ║
╚═══════════════════════════════════╝
```

---

## 🚨 Common Issues & Quick Fixes

| Issue | Fix |
|-------|-----|
| Popup blocked | Allow popups in browser |
| redirect_uri_mismatch | Check Step 1 above is EXACT |
| 401 Unauthorized | Refresh page, log in again |
| Invalid OAuth state | Try full flow again |

---

## 📋 Pre-Flight Checklist

Before clicking "Connect QuickBooks":

- [ ] App running at http://localhost:3000 ✓
- [ ] I'm logged into Novalare ✓
- [ ] QuickBooks Developer Portal updated (Step 1) ✓
- [ ] Supabase secret updated (Step 2) ✓
- [ ] Browser allows popups ✓
- [ ] QuickBooks login ready ✓

**All checked?** → **GO TEST!** 🚀

---

## 🎯 Success = This:

After clicking "Connect QuickBooks" and completing auth:

1. ✅ Popup closes automatically
2. ✅ Success notification appears
3. ✅ Company name shows in integrations list
4. ✅ "Disconnect" button appears
5. ✅ No errors in console

**That's it! You're done!**

---

## 📚 Additional Resources

If you need more help:

- **Visual guide**: `/QB_VISUAL_GUIDE.md` - Shows exactly where to click
- **Checklist**: `/YOUR_CHECKLIST.md` - Detailed step-by-step
- **Troubleshooting**: `/TEST_QB_NOW.md` - Deep dive into issues
- **Architecture**: `/LOCALHOST_QB_TESTING_GUIDE.md` - How it works

---

## 🆘 Still Stuck?

1. **Check browser console** (F12) for error messages
2. **Check Edge Function logs** in Supabase Dashboard
3. **Verify** all 3 steps above are complete
4. **Try incognito mode** to rule out extension issues

---

## ⚠️ IMPORTANT: After Testing

**Don't forget to revert Supabase secret!**

1. Supabase Dashboard → Edge Functions → Secrets
2. Edit `QBO_REDIRECT_URI`
3. Change back to: `https://your-production-domain.com/qbo-callback`
4. Save

---

## 🎉 Ready to Test?

Your app is at: **http://localhost:3000/dashboard**

**Steps 1 & 2 done?** → **Click Connect QuickBooks now!**

**Not done yet?** → **Do Steps 1 & 2 first** (takes 4 minutes)

---

**You've got this! 🚀**
