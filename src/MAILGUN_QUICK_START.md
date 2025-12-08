# Mailgun Quick Start - Novalare

## Your Configuration

**Domain:** `mg.novalare.com`  
**Base URL:** `https://api.mailgun.net`  
**Email Address:** `invoices@mg.novalare.com`

---

## Setup (2 Minutes)

### Step 1: Copy Your Webhook URL

Go to **Dev Portal → 📧 Email Setup** and copy the webhook URL.

It looks like:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/api/webhook/mailgun
```

### Step 2: Create Mailgun Route

1. **Log in:** https://app.mailgun.com
2. **Go to:** Sending → Routes
3. **Click:** Create Route
4. **Fill in:**
   ```
   Match Recipient: *@mg.novalare.com
   Actions: ✅ Forward
   URL: [Paste webhook URL from Step 1]
   Priority: 0
   ```
5. **Click:** Create Route

### Step 3: Test It!

**Option A: Use Built-in Tester**
- Go to Dev Portal → 📧 Email Setup
- Upload a test invoice PDF
- Click "Send Test Webhook"

**Option B: Send Real Email**
- Send email to: `invoices@mg.novalare.com`
- Attach invoice PDF
- Check Email tab in Company Workspace

---

## How It Works

```
Email to invoices@mg.novalare.com
          ↓
     Mailgun forwards to webhook
          ↓
     Server saves email + attachments
          ↓
     Appears in Email inbox
          ↓
     Click "Process" to extract invoice
          ↓
     Done!
```

---

## Company Routing

**Route to specific companies:**

```
company-1@mg.novalare.com    → Company 1
company-2@mg.novalare.com    → Company 2
company-3@mg.novalare.com    → Company 3
invoices@mg.novalare.com     → Company 1 (default)
```

---

## What Gets Processed

✅ **Accepted:**
- PDF attachments only
- Any email subject
- Any sender address
- Multiple PDFs per email

❌ **Ignored:**
- Non-PDF attachments (JPG, PNG, DOCX, etc.)
- Emails with no attachments
- Files over 10MB

---

## Where to Check Results

1. **Email Inbox:**
   - Dev Portal → Any Company → Email tab
   - Shows all received emails
   - Click "Process" to extract invoice details

2. **Invoices:**
   - After clicking "Process", invoice appears in Invoices tab
   - Automatically extracts: Vendor, Amount, Date, Invoice #
   - Duplicate detection prevents re-processing same invoice

3. **Logs:**
   - Supabase Dashboard → Edge Functions → Logs
   - Filter for `make-server-53c2e113`
   - Shows detailed processing steps

---

## Testing Checklist

- [ ] Copied webhook URL from Dev Portal
- [ ] Created route in Mailgun (Sending → Routes)
- [ ] Route matches `*@mg.novalare.com`
- [ ] Route forwards to webhook URL
- [ ] Sent test email with PDF attachment
- [ ] Email appears in Email tab
- [ ] Clicked "Process" button
- [ ] Invoice appears in Invoices tab

---

## Troubleshooting

**No email received:**
- Check route exists in Mailgun
- Verify route is active (not paused)
- Check Mailgun logs: Sending → Logs
- Verify email sent to correct address

**Email received but no attachments:**
- Only PDF files are supported
- Check file size < 10MB
- Verify attachment was included in email

**Process button fails:**
- Check OpenAI API key is set
- Check Supabase logs for errors
- Verify PDF is not corrupted/scanned

**Wrong company:**
- Use format: `company-{ID}@mg.novalare.com`
- Check company exists in database
- Defaults to company 1 if no match

---

## Next Steps

1. ✅ Set up Mailgun route (Step 2 above)
2. 🎯 Test with a sample invoice
3. 🎯 Forward real invoices to `invoices@mg.novalare.com`
4. 🎯 Process multiple companies using different emails
5. 🎯 Set up email forwarding from your main inbox

---

## Support Resources

- **Setup Guide:** `/EMAIL_WEBHOOK_SETUP.md`
- **Technical Details:** `/WEBHOOK_SUMMARY.md`
- **Dev Portal:** Built-in testing and monitoring
- **Mailgun Docs:** https://documentation.mailgun.com/

---

## Your Email Address

**Primary:** `invoices@mg.novalare.com`

**Company-Specific:**
- `company-1@mg.novalare.com`
- `company-2@mg.novalare.com`
- `company-3@mg.novalare.com`

**All work automatically once route is created!** 🎉
