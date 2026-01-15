# ✅ QuickBooks Localhost Testing - Interactive Checklist

Copy this checklist and check off items as you complete them!

---

## 📋 PRE-SETUP CHECKLIST

### QuickBooks Developer Account Setup
- [ ] I have a QuickBooks Developer account at https://developer.intuit.com
- [ ] I've created a QuickBooks app in the developer portal
- [ ] I have my `QBO_CLIENT_ID`
- [ ] I have my `QBO_CLIENT_SECRET`
- [ ] I have a QuickBooks Sandbox test company (optional but recommended)

### Supabase Setup
- [ ] I have a Supabase project
- [ ] I know my `SUPABASE_URL`
- [ ] I have my `SUPABASE_ANON_KEY`
- [ ] I have my `SUPABASE_SERVICE_ROLE_KEY`

### Other Services
- [ ] I have an `OPENAI_API_KEY` (required for AI features)

---

## 🔧 CONFIGURATION CHECKLIST

### Step 1: QuickBooks Developer Portal
- [ ] Logged into https://developer.intuit.com/app/developer/myapps
- [ ] Selected my app
- [ ] Clicked "Keys & credentials"
- [ ] Under "Redirect URIs", clicked "Add URI"
- [ ] Entered EXACTLY: `http://localhost:5173/qbo-callback`
  - [ ] No trailing slash
  - [ ] Using `http://` not `https://`
  - [ ] Port is `5173`
- [ ] Clicked "Save"
- [ ] ✅ Redirect URI is now in the list

### Step 2: Environment Variables

Choose ONE option:

#### Option A: Automated Setup (Recommended)
- [ ] Ran setup script:
  - Mac/Linux: `chmod +x setup-localhost.sh && ./setup-localhost.sh`
  - Windows: `setup-localhost.bat`
- [ ] Entered all required credentials
- [ ] Script completed successfully
- [ ] File created: `supabase/functions/server/.env.local`

#### Option B: Manual Setup
- [ ] Copied example file:
  ```bash
  cp supabase/functions/server/.env.local.example supabase/functions/server/.env.local
  ```
- [ ] Opened `.env.local` in text editor
- [ ] Filled in `SUPABASE_URL`
- [ ] Filled in `SUPABASE_ANON_KEY`
- [ ] Filled in `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Filled in `QBO_CLIENT_ID`
- [ ] Filled in `QBO_CLIENT_SECRET`
- [ ] Set `QBO_REDIRECT_URI=http://localhost:5173/qbo-callback`
- [ ] Filled in `OPENAI_API_KEY`
- [ ] Saved file

### Step 3: Update Production Secrets (If Using Production Edge Functions)
- [ ] Opened Supabase Dashboard
- [ ] Navigated to: Project → Settings → Edge Functions → Secrets
- [ ] Found `QBO_REDIRECT_URI` in the list
- [ ] Updated it to: `http://localhost:5173/qbo-callback`
- [ ] Clicked "Save"
- [ ] ⚠️ **NOTED TO CHANGE BACK** after testing

---

## 🧪 TESTING CHECKLIST

### Pre-Test Verification
- [ ] Dev server is ready to start (`npm install` completed)
- [ ] I have a test user account in my app
- [ ] Browser allows popups for localhost
- [ ] QuickBooks Developer Portal has localhost redirect URI
- [ ] Environment variables are configured

### Running the Test

#### 1. Start Development Server
- [ ] Ran: `npm run dev` (or `yarn dev`)
- [ ] Server started successfully
- [ ] App accessible at http://localhost:5173
- [ ] No console errors on page load

#### 2. Login to App
- [ ] Navigated to http://localhost:5173
- [ ] Clicked "Login" or "Sign In"
- [ ] Entered test account credentials
- [ ] Logged in successfully
- [ ] Redirected to dashboard/home page

#### 3. Navigate to Integrations
- [ ] Found Settings or Accounting Integrations page
- [ ] Navigated to integrations section
- [ ] "Connect QuickBooks" button is visible
- [ ] No existing connections (or ready to test with new company)

#### 4. Initiate OAuth Flow
- [ ] Clicked "Connect QuickBooks" button
- [ ] Popup window opened (not blocked)
- [ ] QuickBooks login page loaded in popup
- [ ] No console errors in main window

#### 5. QuickBooks Login
- [ ] Entered QuickBooks credentials in popup
- [ ] Clicked "Sign In"
- [ ] Login successful
- [ ] Authorization page appeared

#### 6. Authorize App
- [ ] Authorization page shows correct app name
- [ ] Company name is correct (or sandbox company)
- [ ] Clicked "Authorize"
- [ ] QuickBooks redirected back to my app

#### 7. Callback Processing
- [ ] URL changed to: `http://localhost:5173/qbo-callback?code=...&realmId=...&state=...`
- [ ] Loading spinner appeared: "Connecting to QuickBooks..."
- [ ] No errors in console
- [ ] Popup is still open (processing)

#### 8. Backend Processing
- [ ] Console shows: "Exchanging tokens with QuickBooks..."
- [ ] No 401 or 403 errors
- [ ] No "Invalid OAuth state" error
- [ ] Processing completed

#### 9. Success!
- [ ] Popup closed automatically
- [ ] Parent window showed success message/toast
- [ ] UI updated with connected company
- [ ] Company name displays correctly
- [ ] Status shows "Connected" or similar
- [ ] "Disconnect" button appeared

---

## 🔍 DEBUGGING CHECKLIST (If Something Failed)

### If Popup Was Blocked
- [ ] Checked browser popup blocker
- [ ] Allowed popups for localhost:5173
- [ ] Tried again

### If "401 Unauthorized" Error
- [ ] Checked `/utils/supabase/info.tsx` has correct `publicAnonKey`
- [ ] Verified I'm logged in (active session)
- [ ] Checked browser console for auth errors

### If "redirect_uri_mismatch" Error
- [ ] Verified QB Developer Portal has EXACTLY: `http://localhost:5173/qbo-callback`
- [ ] Checked `QBO_REDIRECT_URI` in `.env.local` or Supabase secrets
- [ ] Ensured no trailing slash in redirect URI
- [ ] Verified protocol is `http://` not `https://`
- [ ] Confirmed port is `5173`

### If "Invalid OAuth state" Error
- [ ] Waited for more than 10 minutes (state expired)
- [ ] Started flow again from beginning
- [ ] Checked Edge Function logs for state creation
- [ ] Verified KV store is accessible

### If Popup Closes But No Connection Shows
- [ ] Checked browser console for postMessage errors
- [ ] Verified Edge Function logs show success
- [ ] Refreshed the page
- [ ] Checked KV store for connection record

### If Backend Error
- [ ] Opened Supabase Dashboard → Edge Functions → Logs
- [ ] Filtered by: `make-server-53c2e113`
- [ ] Found recent `/accounting/qbo/callback` request
- [ ] Read error message
- [ ] Verified all environment variables are set
- [ ] Checked QuickBooks API status

---

## 🎯 POST-TEST CHECKLIST

### Verify Connection
- [ ] Company name displays in UI
- [ ] Status is "Connected" or "Active"
- [ ] Last synced timestamp shows
- [ ] Disconnect button is available
- [ ] No error messages

### Test Additional Features
- [ ] Clicked "Sync Now" (if available)
- [ ] Verified data syncs from QuickBooks
- [ ] Tested fetching Chart of Accounts
- [ ] Checked that accounts appear in UI
- [ ] Verified account details are correct

### Test Disconnection
- [ ] Clicked "Disconnect" button
- [ ] Confirmed disconnection
- [ ] Connection removed from UI
- [ ] Can reconnect successfully

### Multi-Company Test (Optional)
- [ ] Clicked "Connect Another Company"
- [ ] Connected second QuickBooks company
- [ ] Both companies show in list
- [ ] Can switch between companies
- [ ] Each maintains separate connection

---

## 🚀 PRODUCTION DEPLOYMENT CHECKLIST

### Before Deploying
- [ ] All localhost tests passed
- [ ] Token refresh tested (wait 1+ hour)
- [ ] Multi-company setup tested
- [ ] Disconnection and reconnection tested
- [ ] Journal entry creation tested
- [ ] Data sync verified

### Update Configuration
- [ ] Changed `QBO_REDIRECT_URI` in Supabase secrets to production URL
- [ ] Updated QuickBooks Developer Portal redirect URI to production
- [ ] Removed or kept localhost redirect URI (can keep both)
- [ ] Verified production environment variables

### Deploy
- [ ] Deployed Edge Functions
- [ ] Deployed frontend
- [ ] Tested OAuth flow on production URL
- [ ] Verified connection works
- [ ] Checked production Edge Function logs

### Post-Deployment
- [ ] Created test connection on production
- [ ] Verified data sync works
- [ ] Tested journal entry creation
- [ ] Monitored logs for errors
- [ ] Documented any issues

---

## 📊 SUCCESS CRITERIA

You've successfully completed localhost testing when:

- ✅ OAuth flow completes without errors
- ✅ QuickBooks company connects and shows in UI
- ✅ Can disconnect and reconnect
- ✅ Data syncs from QuickBooks (Chart of Accounts)
- ✅ Can connect multiple companies
- ✅ Tokens refresh automatically after 1 hour
- ✅ No console errors during flow
- ✅ Edge Function logs show successful processing
- ✅ All features work as expected

---

## 📝 NOTES SECTION

Use this space for troubleshooting notes:

**Issues encountered:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

**Solutions that worked:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

**Environment details:**
- Node version: ___________
- npm/yarn version: ___________
- Browser: ___________
- OS: ___________

---

## 🎉 Completion Status

- [ ] ✅ **PRE-SETUP COMPLETE** - All credentials obtained
- [ ] ✅ **CONFIGURATION COMPLETE** - Environment set up
- [ ] ✅ **TESTING COMPLETE** - OAuth flow works
- [ ] ✅ **POST-TEST COMPLETE** - Features verified
- [ ] ✅ **READY FOR PRODUCTION** - All tests passed

---

**Date Completed**: __________________

**Tested By**: __________________

**Next Steps**: 
- [ ] Deploy to production
- [ ] Test with real QuickBooks companies
- [ ] Monitor usage and errors
- [ ] Document any edge cases

---

*Happy Testing! 🚀*

Print this checklist and check off items as you go!
