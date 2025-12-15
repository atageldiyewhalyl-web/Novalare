# 📧 Cloudflare Email Worker Setup Guide - COMPLETE WALKTHROUGH

This guide will help you set up automatic email routing for invoice processing in Novalare.

## 🎯 Overview

**Email Format:** `{company-name}+invoice@novalare.com`

**Example:** When you create a company called "ABC Bäckerei GmbH", the system automatically generates:
```
abc-backerei-gmbh+invoice@novalare.com
```

Vendors can send invoice PDFs to this email, and they'll be automatically:
1. Received by Cloudflare
2. Processed by an Email Worker
3. Forwarded to your webhook
4. Extracted using AI (GPT-4o)
5. Displayed in "Workflows → Invoice Extraction" (status: Pending)

---

## ⚙️ Complete Setup (Follow These Steps)

### ✅ STEP 1: Enable Cloudflare Email Routing

1. Go to **Cloudflare Dashboard** → Select **novalare.com**
2. Navigate to **Email** → **Email Routing**
3. Click **"Enable Email Routing"**
4. Cloudflare will automatically update your MX records
5. Wait for DNS propagation (usually 5-10 minutes)

**Verify:** You should see "Email Routing is enabled" message

---

### ✅ STEP 2: Get Your Supabase Project URL

You need this for the Worker script!

1. Go to **https://supabase.com/dashboard**
2. Select your Novalare project
3. Click **Settings** (gear icon in sidebar)
4. Click **API**
5. Find **"Project URL"** section
6. Copy the URL (example: `https://abcdefghijklmnop.supabase.co`)

**📝 Write it down!** You'll need it in the next step.

---

### ✅ STEP 3: Create and Deploy Cloudflare Email Worker

#### 3.1 Create the Worker

1. In Cloudflare Dashboard, click **Workers & Pages** (in sidebar)
2. Click **"Create Worker"**
3. Name it: `novalare-email-router`
4. Click **"Create Worker"**

#### 3.2 Update the Worker Script

1. You should see a code editor
2. **Delete all the default code**
3. Copy the script from `/CLOUDFLARE_WORKER_SCRIPT.js` file (provided in your project)
4. Paste it into the Cloudflare editor

#### 3.3 Update the Webhook URL

Find this line in the script:
```javascript
const webhookUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/api/webhook/cloudflare';
```

**Replace `YOUR_SUPABASE_PROJECT_ID`** with your actual Supabase URL from Step 2.

**Example:**
```javascript
// ❌ Before:
const webhookUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/api/webhook/cloudflare';

// ✅ After (using your real URL):
const webhookUrl = 'https://abcdefghijklmnop.supabase.co/functions/v1/make-server-53c2e113/api/webhook/cloudflare';
```

#### 3.4 Save and Deploy

1. Click **"Save and Deploy"** (top right)
2. Wait for deployment to complete
3. You should see "Successfully deployed" message

**Verify:** The worker is now live at `novalare-email-router.your-account.workers.dev`

---

### ✅ STEP 4: Configure Catch-All Email Routing

Now connect the Worker to your email domain:

1. Go back to **Email** → **Email Routing** → **Routing Rules**
2. Click **"Edit"** next to **"Catch-all address"** (or "Create" if not set)
3. Configure:
   - **Action:** Send to a Worker
   - **Worker:** Select `novalare-email-router` from dropdown
4. Click **"Save"**

**What this does:** 
- ALL emails to `@novalare.com` will be sent to your Worker
- The Worker filters and only processes emails with `+invoice` in the address
- Other emails are ignored

---

## 🧪 Complete Testing Guide

### Test 1: Verify Backend is Ready

1. Open your Novalare app
2. Open browser console (F12)
3. Go to **DevPortal** → **Companies**
4. Check console for any errors

**Expected:** No errors, companies load successfully

---

### Test 2: Create a Test Company

1. In **DevPortal** → **Companies**
2. Click **"Add Company"**
3. Fill in:
   - **Name:** `Test Invoice Company`
   - **Country:** DE
   - **Status:** Active
   - **Tags:** Test
4. Click **"Add Company"**

**Check the email address generated:**
- Should be: `test-invoice-company+invoice@novalare.com`
- You'll see this in the company details

**Verify in console:**
```
📧 Generated email address: test-invoice-company+invoice@novalare.com
ℹ️ Email routing handled by Cloudflare Email Worker
```

---

### Test 3: Send a Test Invoice Email

#### Option A: Use a Real Email Client

1. Open Gmail, Outlook, or any email client
2. Compose new email:
   - **To:** `test-invoice-company+invoice@novalare.com`
   - **Subject:** `Test Invoice from Acme Corp`
   - **Body:** Any text (optional)
   - **Attachment:** Attach a PDF invoice (search "sample invoice PDF" online)
3. Click **Send**

#### Option B: Use a Test Invoice PDF

If you don't have an invoice, download one:
- Google: "sample invoice PDF download"
- Or use: https://templates.invoicehome.com/invoice-template-us-neat-750px.png

---

### Test 4: Monitor Processing (Check Logs)

**4.1 Check Cloudflare Worker Logs:**

1. Go to **Workers & Pages** → **novalare-email-router**
2. Click **"Logs"** tab (or **"Begin log stream"**)
3. Wait 1-2 minutes after sending email

**Expected logs:**
```
📧 Incoming email
  To: test-invoice-company+invoice@novalare.com
  From: your-email@gmail.com
  Subject: Test Invoice from Acme Corp
✅ Invoice email detected - processing...
📎 Attachment found: invoice.pdf
✅ Attachment processed: invoice.pdf
📎 Total attachments processed: 1
📤 Calling webhook: https://your-project.supabase.co/...
✅ Webhook response: {"success":true,...}
✅ Email processing complete!
```

**4.2 Check Supabase Edge Function Logs:**

1. Go to **Supabase Dashboard** → Your Project
2. Click **Edge Functions** (in sidebar)
3. Click **Logs**
4. Look for recent `/api/webhook/cloudflare` requests

**Expected logs:**
```
📬 Cloudflare Email Worker webhook received
📧 Email Details:
  From: your-email@gmail.com
  To: test-invoice-company+invoice@novalare.com
  Subject: Test Invoice from Acme Corp
  Company ID: ...
📄 Processing attachment: invoice.pdf (application/pdf)
📖 Parsing PDF buffer...
📄 Extracted 500 characters from PDF
🤖 Sending extracted text to OpenAI...
✅ Invoice extracted and saved: Acme Corp - €1,190.00 EUR
✅ Cloudflare webhook processed successfully
   - Attachments: 1
   - Invoices extracted: 1
```

---

### Test 5: Verify in Novalare UI

1. Open Novalare app
2. Go to **Workflows** → **Invoice Extraction**
3. You should see your test invoice!

**Expected:**
```
┌─────────────────────────────────────┐
│ 📄 invoice.pdf                      │
│                                     │
│ Vendor: Acme Corp                   │
│ Invoice #: INV-12345                │
│ Date: 2024-03-15                    │
│ Amount: €1,190.00                   │
│ Status: Pending Review              │
│                                     │
│ [View PDF] [Approve] [Reject]       │
└─────────────────────────────────────┘
```

4. Click **"View PDF"** to see the original invoice
5. Click **"Approve"** to mark it as reviewed

---

## 🎉 Success! Your System is Working!

Now every time you create a new company:
1. **Unique email is generated automatically**
2. **Share email with client's vendors**
3. **Vendors send invoices to that email**
4. **AI extracts data automatically**
5. **Accountant reviews and approves**
6. **Export to QuickBooks/Xero/DATEV**

---

## 🔧 Troubleshooting

### Problem: Email Not Received by Worker

**Check:**
1. **Cloudflare Email Routing enabled?**
   - Email → Email Routing → Should say "Enabled"
2. **Catch-all rule configured?**
   - Email → Email Routing → Routing Rules → Catch-all → Worker selected
3. **MX records updated?**
   - DNS → Records → Should have Cloudflare MX records
4. **Email format correct?**
   - Must include `+invoice@novalare.com`

**Fix:** Wait 10 minutes for DNS propagation, then try again

---

### Problem: Worker Receives Email but Webhook Fails

**Check Worker Logs:**
```
❌ Webhook failed: 404 Not Found
```

**Causes:**
1. **Webhook URL is wrong**
   - Check: Does it include your real Supabase project ID?
   - Fix: Update Worker script with correct URL

2. **Supabase Edge Function not deployed**
   - Check: Supabase Dashboard → Edge Functions → Should show "make-server-53c2e113"
   - Fix: Your backend is deployed, but check it's running

**Fix:** Update Worker script with correct Supabase URL, redeploy

---

### Problem: Invoice Not Extracted (No AI Data)

**Check Supabase Logs:**
```
❌ OpenAI API error: 401 Unauthorized
```

**Cause:** OpenAI API key missing or invalid

**Fix:**
1. Go to Supabase Dashboard → Edge Functions → Settings
2. Check environment variable: `OPENAI_API_KEY`
3. Verify it's set correctly (you already configured this)

---

### Problem: PDF Extraction Fails

**Check Logs:**
```
❌ No text extracted from PDF, might be image-based
```

**Cause:** PDF is image-based (scanned document) not text-based

**Current Limitation:** The system currently works best with text-based PDFs

**Workaround:** The PDF is still uploaded and stored, accountant can manually enter data

---

## 📊 Email Format Examples

| Company Name | Generated Email |
|-------------|-----------------|
| ABC Bäckerei GmbH | `abc-backerei-gmbh+invoice@novalare.com` |
| TechNova UG | `technova-ug+invoice@novalare.com` |
| Green Logistics GmbH | `green-logistics-gmbh+invoice@novalare.com` |
| Müller & Co. KG | `muller-co-kg+invoice@novalare.com` |
| Café am Markt | `cafe-am-markt+invoice@novalare.com` |

---

## 🚀 Production Checklist

Before going live with clients:

- [ ] Cloudflare Email Routing enabled
- [ ] Email Worker created and deployed
- [ ] Webhook URL updated in Worker script
- [ ] Catch-all routing rule configured (`@novalare.com` → Worker)
- [ ] Tested with real invoice PDF
- [ ] Verified invoice extraction in UI
- [ ] Checked Cloudflare Worker logs (no errors)
- [ ] Checked Supabase Edge Function logs (no errors)
- [ ] OpenAI API key configured and working
- [ ] All team members can access "Invoice Extraction" workflow

---

## 📧 What Emails Are Processed?

**✅ Processed (forwarded to webhook):**
- `company-name+invoice@novalare.com`
- `any-text+invoice@novalare.com`

**❌ Ignored (not processed):**
- `info@novalare.com`
- `support@novalare.com`
- `hello@novalare.com`
- `admin@novalare.com`

This keeps your regular business emails separate from invoice processing!

---

## 🎯 Next Steps After Setup

1. **Create your real client companies** in DevPortal
2. **Share the invoice email** with each client
3. **Train clients' vendors** to send invoices to the email
4. **Monitor the Invoice Extraction workflow** daily
5. **Review and approve** extracted invoices
6. **Export to QuickBooks/Xero/DATEV**

---

## 📞 Need Help?

If you're stuck:

1. **Check Worker logs first:** Most issues appear here
2. **Check Supabase logs second:** See if webhook is being called
3. **Verify environment variables:** OPENAI_API_KEY, SUPABASE_URL, etc.
4. **Test with simple invoice:** Use a basic text-based PDF invoice

**Remember:** The system is fully automatic once set up. You only configure Cloudflare once!

---

**Webhook Endpoint:** `/functions/v1/make-server-53c2e113/api/webhook/cloudflare`

**Support Email Format:** `{company-name}+invoice@novalare.com`