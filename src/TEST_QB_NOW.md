# 🚀 QuickBooks OAuth Testing - YOUR SETUP (Port 3000)

## ⚡ Quick Test Steps

Your app runs at **http://localhost:3000** (not 5173!), so follow these steps:

---

## Step 1: Update QuickBooks Developer Portal (5 minutes)

1. Go to: https://developer.intuit.com/app/developer/myapps
2. Click on your QuickBooks app
3. Click **"Keys & credentials"** in the left sidebar
4. Scroll to **"Redirect URIs"** section
5. Click **"Add URI"**
6. Enter EXACTLY this (no trailing slash):
   ```
   http://localhost:3000/qbo-callback
   ```
7. Click **"Save"**
8. ✅ You should see it in the list now

**⚠️ Important**: Keep your production redirect URI too! You can have multiple redirect URIs.

---

## Step 2: Update Supabase Edge Function Secret (2 minutes)

Since you're using production Supabase Edge Functions, you need to temporarily update the redirect URI:

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/functions
2. Click **"Edge Functions"** → **"Secrets"**
3. Find **`QBO_REDIRECT_URI`** in the list
4. Click **"Edit"**
5. Change it to:
   ```
   http://localhost:3000/qbo-callback
   ```
6. Click **"Save"**

**⚠️ IMPORTANT**: Remember to change this back to your production URL when done testing!

---

## Step 3: Test the OAuth Flow! 🎉

Your app is already running at http://localhost:3000/dashboard, so:

1. **In your browser**, go to: http://localhost:3000/dashboard
2. **Navigate to**: Settings tab (or wherever you have Accounting Integrations)
3. **Click**: "Connect QuickBooks" button
4. **A popup should open** with QuickBooks login
5. **Sign in** to QuickBooks (use sandbox credentials if you have them)
6. **Click "Authorize"** to allow your app
7. **Watch the magic happen**:
   - QuickBooks redirects to `http://localhost:3000/qbo-callback`
   - You'll see "Connecting to QuickBooks..." spinner
   - Edge Function exchanges the code for tokens
   - Popup closes automatically
   - Success message appears!
   - Your UI updates with the connected company

---

## 🔍 What to Watch For

### ✅ Success Indicators:
- Popup opens without being blocked
- QuickBooks login page loads
- After authorization, URL changes to `http://localhost:3000/qbo-callback?code=XXX&realmId=XXX&state=XXX`
- Console shows: "📥 QBO callback received"
- Console shows: "✅ QuickBooks connected successfully!"
- Popup closes
- Company name appears in your Accounting Integrations list

### ❌ Common Issues:

**1. "redirect_uri_mismatch" error:**
- Check QuickBooks Developer Portal has EXACTLY: `http://localhost:3000/qbo-callback`
- Make sure no trailing slash
- Make sure using `http://` not `https://`

**2. "401 Unauthorized" error:**
- Check you're logged into your Novalare app
- Verify your session is active
- Check browser console for auth errors

**3. "Invalid OAuth state" error:**
- State tokens expire after 10 minutes
- Start the flow again from the beginning
- Click "Connect QuickBooks" button again

**4. Popup blocked:**
- Allow popups for localhost:3000 in your browser
- Look for popup blocker icon in address bar

---

## 🐛 Debugging Tips

### Browser Console (F12):
Open your browser console and look for these messages:

```
✅ GOOD:
📥 QBO callback received: {code: 'present', realmId: '...', state: '...'}
🔄 Exchanging tokens with QuickBooks...
✅ QuickBooks connected successfully!

❌ BAD:
❌ OAuth error: redirect_uri_mismatch
❌ Missing required OAuth parameters
❌ Failed to complete connection
```

### Edge Function Logs:
1. Go to: Supabase Dashboard → Edge Functions → Logs
2. Filter by: `make-server-53c2e113`
3. Look for requests to `/accounting/qbo/callback`
4. Check for error messages

---

## 📋 Pre-Test Checklist

Before clicking "Connect QuickBooks", verify:

- [ ] ✅ App is running at http://localhost:3000
- [ ] ✅ I'm logged into my Novalare account
- [ ] ✅ Browser allows popups for localhost:3000
- [ ] ✅ QuickBooks Developer Portal has redirect URI: `http://localhost:3000/qbo-callback`
- [ ] ✅ Supabase secret `QBO_REDIRECT_URI` = `http://localhost:3000/qbo-callback`
- [ ] ✅ I have my QuickBooks login credentials ready
- [ ] ✅ Browser console (F12) is open to watch logs

---

## 🎯 Expected Flow Timeline

1. **T+0s**: Click "Connect QuickBooks" → Popup opens
2. **T+2s**: QuickBooks login page loads
3. **T+5s**: Enter credentials, click Sign In
4. **T+7s**: Authorization page appears
5. **T+9s**: Click Authorize
6. **T+10s**: Redirect to callback URL
7. **T+11s**: "Connecting to QuickBooks..." spinner
8. **T+13s**: Edge Function processes tokens
9. **T+14s**: Success! Popup closes
10. **T+15s**: UI updates with connected company

**Total time**: ~15 seconds

---

## 🔄 After Testing

### When you're done testing on localhost:

1. **Revert the Supabase secret**:
   - Go to: Supabase Dashboard → Edge Functions → Secrets
   - Edit `QBO_REDIRECT_URI`
   - Change it back to your production URL (e.g., `https://novalare.com/qbo-callback`)
   - Save

2. **Keep the localhost redirect URI in QuickBooks**:
   - You can leave `http://localhost:3000/qbo-callback` in the QuickBooks Developer Portal
   - Having multiple redirect URIs is fine
   - This makes future localhost testing easier

---

## 🆘 Still Not Working?

### Check These Files:

1. **`/utils/supabase/info.tsx`** - Make sure `publicAnonKey` is correct
2. **`/pages/QBOCallback.tsx`** - Handles the OAuth callback
3. **`/components/devportal/AccountingIntegrations.tsx`** - Has the Connect button

### Common Fixes:

- **Clear browser cache** and try again
- **Disable browser extensions** that might interfere
- **Try incognito mode** to rule out extension issues
- **Check QuickBooks API status**: https://status.developer.intuit.com/

---

## ✅ Success! What's Next?

Once you successfully connect:

1. **Test disconnection**: Click "Disconnect" and reconnect
2. **Test syncing**: Click "Sync Now" to fetch Chart of Accounts
3. **Test multi-company**: Connect a second QuickBooks company
4. **Test journal entries**: Create a journal entry and push to QuickBooks
5. **Test token refresh**: Wait 1+ hour and verify it refreshes automatically

---

## 📞 Need More Help?

- **Detailed guide**: `/LOCALHOST_QB_TESTING_GUIDE.md`
- **Architecture**: `/ACCOUNTING_INTEGRATION_ARCHITECTURE.md`
- **Checklist**: `/QB_LOCALHOST_CHECKLIST.md`

---

**🎉 Ready? Go click that "Connect QuickBooks" button! 🚀**
