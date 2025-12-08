# Email Webhook Setup Guide - Novalare Invoice Processing

## Overview
This guide will help you set up automatic invoice processing via email using Mailgun webhooks.

**Your Mailgun Domain:** `mg.novalare.com`  
**Receiving Email:** `invoices@mg.novalare.com`

---

## Architecture

```
Vendor Email → invoices@mg.novalare.com
          ↓
    Mailgun receives email
          ↓
    Mailgun sends webhook to your server
          ↓
    Server extracts PDF attachments
          ↓
    OpenAI processes invoices
          ↓
    Invoices saved to database
```

---

## Quick Setup (3 Steps)

### Step 1: ✅ Mailgun Account (Already Complete)

- **Domain:** mg.novalare.com
- **Base URL:** https://api.mailgun.net
- **Status:** Active and ready to receive emails

### Step 2: Get Your Webhook URL

Your webhook URL is:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/api/webhook/mailgun
```

You can copy this from the **Email Webhook Tester** page in the Dev Portal sidebar.

### Step 3: Configure Route in Mailgun (DO THIS NOW!)

1. **Log in to Mailgun:** https://app.mailgun.com
2. **Go to:** Sending → Routes
3. **Click:** Create Route
4. **Configure:**
   - **Expression type**: Match Recipient
   - **Recipient**: `*@mg.novalare.com`
   - **Actions**: 
     - ✅ Check **"Forward"**
     - **URL**: Paste your webhook URL from Step 2
   - **Priority**: 0
   - **Description**: "Novalare Invoice Processing"
5. **Click:** Create Route

**✅ Done!** Emails sent to `invoices@mg.novalare.com` will now be automatically processed!

---

## Testing

### Option 1: Use the Built-in Webhook Tester

1. In the Dev Portal, go to **Email Webhook Tester**
2. Upload a test invoice PDF
3. Click "Send Test Webhook"
4. Check the Email tab in any company workspace to see the result

### Option 2: Send a Real Email

1. Send an email to `invoices@mg.novalare.com`
2. Attach a PDF invoice
3. Subject line can be anything (e.g., "Invoice #12345")
4. Within seconds, it will appear in the Email inbox

### Option 3: Test with Mailgun Dashboard

1. Go to Mailgun dashboard → **Sending** → **Overview**
2. Use the "Send a test email" feature
3. Send to: `invoices@mg.novalare.com`
4. Attach a PDF invoice

---

## Company ID Routing

The webhook supports routing emails to specific companies based on the recipient email:

**Email Format Examples:**
- `company-1@mg.novalare.com` → Routes to company ID `1`
- `company-2@mg.novalare.com` → Routes to company ID `2`
- `invoices+acme@mg.novalare.com` → Routes to company ID `acme`
- `invoices@mg.novalare.com` → Routes to company ID `1` (default)

**Pattern Recognition:**
- `company-{ID}@...` → Extracts company ID
- `{anything}+{ID}@...` → Extracts company ID
- Otherwise → Defaults to company ID `1`

---

## Monitoring & Debugging

### Check Processing Status

1. **Email Tab in Company Workspace:**
   - Shows all received emails
   - Click "Process" to manually trigger invoice extraction
   - Shows processing status (Success/Failed)

2. **Supabase Logs:**
   - Go to Supabase Dashboard → Edge Functions → Logs
   - Filter for `make-server-53c2e113`
   - Look for messages starting with 📬, 📧, 📎, ✅

3. **Mailgun Logs:**
   - Mailgun Dashboard → Sending → Logs
   - Check delivery status and webhook responses

### Common Issues

**❌ No webhook received:**
- Verify the route is created in Mailgun (Step 3)
- Check webhook URL is correct (no typos)
- Ensure email was sent to `*@mg.novalare.com`
- Check Mailgun logs for delivery status

**❌ Attachments not processing:**
- Only PDF files are processed
- Check file size limit (10MB max)
- Verify OpenAI API key is set in Supabase

**❌ Duplicate invoices:**
- System automatically detects duplicates based on vendor + invoice number
- Check logs for "Duplicate invoice detected" messages
- Duplicates are still saved in the Email inbox but not in Invoices

**❌ Wrong company:**
- Verify recipient email format matches pattern
- Check company exists in database
- Defaults to company ID `1` if not found

---

## Email Format from Mailgun

Mailgun sends these fields to your webhook:

```
from: "vendor@company.com"
To: "invoices@mg.novalare.com"
subject: "Invoice #12345"
body-plain: "Email body text"
timestamp: "1234567890" (Unix timestamp)
attachment-1: (PDF file)
attachment-2: (PDF file)
...
```

---

## Security

- ✅ Webhook endpoint protected by Supabase authentication
- ✅ All files uploaded to private Supabase Storage bucket
- ✅ Signed URLs expire after 1 year
- ✅ Only PDF attachments are processed
- ⚠️ Consider adding Mailgun webhook signature verification for production

---

## Advanced: Multiple Email Addresses

You can set up different email addresses for different purposes:

```
invoices@mg.novalare.com       → General invoices (company 1)
company-2@mg.novalare.com      → Company 2 invoices
ap@mg.novalare.com             → Accounts payable
expenses@mg.novalare.com       → Employee expenses
```

The Mailgun route `*@mg.novalare.com` catches all of these automatically!

---

## Webhook URL Reference

```
Endpoint:
https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/api/webhook/mailgun

Method: POST
Content-Type: multipart/form-data
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
```

Replace `YOUR_PROJECT_ID` with your actual Supabase project ID.

---

## Next Steps

1. ✅ Mailgun account created (mg.novalare.com)
2. 🎯 **DO NOW:** Create the route in Mailgun (Step 3 above)
3. 🎯 Test by sending an email to `invoices@mg.novalare.com`
4. 🎯 Check the Email tab in Dev Portal to see it processed
5. ✅ Start forwarding real invoices!

---

## Support

If you encounter issues:

1. Check the **Email Webhook Tester** page in Dev Portal
2. Review Supabase Edge Function logs
3. Check Mailgun route is active and webhook logs
4. Verify environment variables are set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`

---

## Summary

**Your receiving email:** `invoices@mg.novalare.com`

**What happens when someone sends an invoice:**
1. Email arrives at Mailgun
2. Mailgun forwards to your webhook
3. Server extracts PDF attachments
4. OpenAI processes each invoice
5. Data saved to database
6. Appears in Email inbox instantly
7. Click "Process" to extract invoice details

**Simple as that!** 🎉
