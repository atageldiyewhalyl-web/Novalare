# Email Webhook Integration - Quick Summary

## ✅ What I Just Built

### 1. **Mailgun Webhook Endpoint** (`/api/webhook/mailgun`)
   - Receives emails from Mailgun
   - Extracts PDF attachments
   - Uses OpenAI to extract invoice data
   - Automatically stores invoices with email metadata
   - Handles duplicate detection
   - Routes emails to correct companies

### 2. **Webhook Tester UI** (New page in Dev Portal)
   - Located in sidebar under "Developer Tools"
   - Test webhook without setting up Mailgun
   - Upload PDFs directly to simulate email workflow
   - See real-time processing results

### 3. **Complete Setup Documentation**
   - `/EMAIL_WEBHOOK_SETUP.md` - Full setup guide
   - Step-by-step Mailgun configuration
   - DNS setup for custom domains
   - Troubleshooting tips

---

## 🚀 Quick Start (3 Options)

### Option 1: Test Immediately (No Mailgun Needed)
1. Go to Dev Portal
2. Click "Email Webhook Tester" in sidebar
3. Upload a PDF invoice
4. Click "Send Test Webhook"
5. Check Invoice Extraction page for results

### Option 2: Set Up Mailgun (Free)
1. Sign up at https://mailgun.com (free tier)
2. Get your sandbox domain (e.g., `sandbox123.mailgun.org`)
3. Add webhook URL in Mailgun dashboard:
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/api/webhook/mailgun
   ```
4. Create email route to forward to webhook
5. Send test email with PDF attachment

### Option 3: Production Setup (Custom Domain)
1. Follow Option 2 first
2. Add custom domain in Mailgun (e.g., `mg.yourdomain.com`)
3. Configure DNS records (MX, TXT, CNAME)
4. Update email routes to use custom domain
5. Receive emails at `invoices@mg.yourdomain.com`

---

## 📧 How Email Routing Works

The webhook automatically routes emails to companies based on recipient:

| Email Format | Routes To |
|--------------|-----------|
| `company-1@domain.com` | Company ID: `1` |
| `company-acme@domain.com` | Company ID: `acme` |
| `invoices+acme@domain.com` | Company ID: `acme` |
| `anything@domain.com` | Company ID: `1` (default) |

---

## 🔍 What Happens When Email Arrives

```
1. Vendor sends invoice to invoices@yourdomain.com
   ↓
2. Mailgun receives email and triggers webhook
   ↓
3. Server extracts company ID from recipient
   ↓
4. Server downloads PDF attachments
   ↓
5. Server uploads PDFs to Supabase Storage
   ↓
6. OpenAI extracts invoice data from PDFs
   ↓
7. Server checks for duplicates (vendor + invoice #)
   ↓
8. Server saves invoice with email metadata:
   - emailFrom: sender@vendor.com
   - emailSubject: Invoice #12345
   - emailReceivedAt: 2025-01-15T10:30:00Z
   - source: 'email'
   ↓
9. Invoice appears in Invoice Extraction page with "Via email" badge
   ↓
10. Click badge to see email details
```

---

## 🎯 What You Need From Me

**Nothing yet!** You can test immediately using the Webhook Tester.

**When you're ready for production:**

1. **Mailgun Account** (free)
   - Sign up at https://mailgun.com
   - Get API key (optional, for webhook verification)

2. **Domain/Email Choice:**
   - Use Mailgun sandbox: `invoices@sandbox123.mailgun.org` (easiest)
   - OR use custom domain: `invoices@mg.yourdomain.com` (production)

3. **That's it!** Everything else is already built and ready.

---

## 📍 Files Created/Modified

### New Files:
- `/supabase/functions/server/routes.tsx` - Added webhook endpoint
- `/components/devportal/WebhookTester.tsx` - Testing UI
- `/EMAIL_WEBHOOK_SETUP.md` - Full documentation
- `/WEBHOOK_SUMMARY.md` - This file

### Modified Files:
- `/pages/DevPortal.tsx` - Added Webhook Tester to navigation

---

## 🐛 Testing & Debugging

### View Logs:
1. **Supabase Logs:** Dashboard → Edge Functions → Logs
2. **Mailgun Logs:** Dashboard → Sending → Logs
3. **Browser Console:** F12 → Console (for webhook tester)

### Look For:
- `📬 Mailgun webhook received`
- `📧 Email Details: ...`
- `📎 Found X attachments`
- `✅ Invoice extracted and saved`

---

## 🔒 Security Features

- ✅ Webhook requires Supabase auth token
- ✅ Files stored in private Supabase bucket
- ✅ Duplicate invoice detection
- ✅ PDF-only processing (no executables)
- ✅ 10MB file size limit
- ✅ Signed URLs with 1-year expiry

---

## 💡 Next Steps (Optional)

1. **Add Webhook Signature Verification** - Verify requests are from Mailgun
2. **Email Notifications** - Send confirmation when invoice is processed
3. **Multi-Company Email Aliases** - Separate email per client company
4. **Error Notifications** - Email admin if processing fails
5. **Batch Processing** - Handle multiple invoices in one email

---

## 📞 Support

If you need help:
1. Check `/EMAIL_WEBHOOK_SETUP.md` for full instructions
2. Use Webhook Tester to test locally first
3. Check Supabase Edge Function logs for errors
4. Verify environment variables are set (OPENAI_API_KEY, SUPABASE_URL, etc.)

---

**Ready to test?** Go to Dev Portal → Email Webhook Tester and upload a PDF! 🚀
