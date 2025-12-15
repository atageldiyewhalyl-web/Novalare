# ⚡ Cloudflare Setup - Quick Start Guide

Follow these steps exactly to complete the setup!

---

## 📋 Prerequisites

- [x] Cloudflare account with `novalare.com` domain
- [x] Email Routing already enabled
- [x] Worker `novalare-email-router` already created
- [ ] **TO DO:** Get Supabase Project URL
- [ ] **TO DO:** Update Worker script
- [ ] **TO DO:** Configure catch-all routing

---

## 🎯 Step 1: Get Your Supabase URL

1. Open: **https://supabase.com/dashboard**
2. Select your Novalare project
3. Click: **Settings** → **API**
4. Copy the **Project URL**

**Example:** `https://abcdefghijklmnop.supabase.co`

📝 **Write it down!**

---

## 🎯 Step 2: Update Worker Script

### 2.1 Open Worker Editor

1. Go to **Cloudflare Dashboard**
2. Click **Workers & Pages**
3. Click on **novalare-email-router**
4. Click **Quick Edit** (top right)

### 2.2 Copy the New Script

1. Open the file: `/CLOUDFLARE_WORKER_SCRIPT.js` (in your project files)
2. **Copy ALL the code** (Ctrl+A, Ctrl+C)
3. Go back to Cloudflare Worker editor
4. **Delete all existing code** in the editor
5. **Paste** the new code (Ctrl+V)

### 2.3 Update Webhook URL

Find this line (around line 95):
```javascript
const webhookUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/api/webhook/cloudflare';
```

**Replace `YOUR_SUPABASE_PROJECT_ID.supabase.co`** with your Supabase URL from Step 1

**Example:**
```javascript
// Before:
const webhookUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/api/webhook/cloudflare';

// After (with your URL):
const webhookUrl = 'https://abcdefghijklmnop.supabase.co/functions/v1/make-server-53c2e113/api/webhook/cloudflare';
```

### 2.4 Save and Deploy

1. Click **Save and Deploy** (top right)
2. Wait for "Successfully deployed" message
3. Click **X** to close the editor

✅ **Done!** Worker is updated and deployed

---

## 🎯 Step 3: Configure Catch-All Routing

### 3.1 Open Email Routing Settings

1. In Cloudflare Dashboard, select **novalare.com**
2. Click **Email** (in sidebar)
3. Click **Email Routing**
4. Click **Routing Rules** tab

### 3.2 Configure Catch-All

**If you see "Catch-all address" already configured:**
1. Click **Edit** next to "Catch-all address"
2. Change **Action** to: **Send to a Worker**
3. Select **Worker:** `novalare-email-router`
4. Click **Save**

**If "Catch-all address" is not configured:**
1. Look for **"Catch-all address"** section at the bottom
2. Click **Edit** or **Create**
3. Set **Action:** Send to a Worker
4. Select **Worker:** `novalare-email-router`
5. Click **Save**

### 3.3 Verify Configuration

You should see:
```
Catch-all address
Action: Send to Worker → novalare-email-router
```

✅ **Done!** All emails to `@novalare.com` will now be sent to your Worker

---

## 🧪 Step 4: Test the Setup

### Test 1: Create Test Company

1. Open Novalare app
2. Go to **DevPortal** → **Companies**
3. Click **Add Company**
4. Enter:
   - Name: `Test Email Company`
   - Country: DE
   - Status: Active
5. Click **Add Company**

**Check:** Company email should be `test-email-company+invoice@novalare.com`

---

### Test 2: Send Test Email

1. Open your email client (Gmail, Outlook, etc.)
2. Compose new email:
   - **To:** `test-email-company+invoice@novalare.com`
   - **Subject:** Test Invoice
   - **Attach:** Any PDF file (preferably an invoice)
3. Send!

---

### Test 3: Check Worker Logs

1. Go to **Cloudflare** → **Workers & Pages** → **novalare-email-router**
2. Click **Logs** tab
3. Click **Begin log stream**
4. Wait 1-2 minutes

**Expected logs:**
```
📧 Incoming email
  To: test-email-company+invoice@novalare.com
✅ Invoice email detected - processing...
📎 Attachment found: invoice.pdf
📤 Calling webhook...
✅ Webhook response: {"success":true}
✅ Email processing complete!
```

✅ **If you see these logs:** Worker is working!

❌ **If no logs:** Check catch-all routing configuration

---

### Test 4: Check Novalare UI

1. Go to **Workflows** → **Invoice Extraction**
2. Look for your test invoice

**Expected:** You should see the invoice with AI-extracted data!

---

## ✅ Setup Complete Checklist

- [ ] Got Supabase URL from dashboard
- [ ] Updated Worker script with Supabase URL
- [ ] Saved and deployed Worker
- [ ] Configured catch-all routing rule
- [ ] Created test company
- [ ] Sent test email with PDF
- [ ] Checked Worker logs (saw processing logs)
- [ ] Verified invoice appeared in UI

---

## 🎉 Success!

Your automatic invoice processing system is now live! 🚀

### What happens now:

1. **Create any company** in Novalare
2. **Get unique email:** `company-name+invoice@novalare.com`
3. **Share with vendors**
4. **Invoices arrive automatically** in Invoice Extraction workflow
5. **AI extracts all data**
6. **Accountant reviews and approves**
7. **Export to QuickBooks/Xero/DATEV**

---

## 🔧 Troubleshooting

### Email not received?

1. **Wait 5 minutes** (email processing takes time)
2. **Check email format:** Must include `+invoice@novalare.com`
3. **Check Worker logs:** See if email was received
4. **Check catch-all rule:** Should say "Send to Worker"

### Worker received email but no invoice in UI?

1. **Check Supabase Edge Function logs**
2. **Verify webhook URL** in Worker script
3. **Check OpenAI API key** is configured

### Invoice appeared but no AI data?

1. **Check Supabase logs** for OpenAI errors
2. **Verify PDF has extractable text** (not image-based)
3. **Try different PDF** to test

---

## 📚 Full Documentation

For complete details, see: `/CLOUDFLARE_EMAIL_SETUP.md`

---

**Need help?** Check the logs first - they show exactly what's happening! 🔍
