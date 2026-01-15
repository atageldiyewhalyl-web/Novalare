# 📧 Novalare Email Invoice/Receipt Extraction System - Complete Analysis

## 🎯 **System Overview**

The email extraction system allows accounting firms to forward invoices and receipts to unique email addresses, where they are automatically processed using AI and displayed in the Novalare dashboard.

---

## 📨 **Email Address Format**

### **Current Format (UPDATED)**
```
companyname.invoices@novalare.com
companyname.receipts@novalare.com
```

### **Examples**
- Company: "ABC Bäckerei GmbH"
  - Invoices: `abcbackereigmbh.invoices@novalare.com`
  - Receipts: `abcbackereigmbh.receipts@novalare.com`

- Company: "TechNova Solutions"
  - Invoices: `technovasolutions.invoices@novalare.com`
  - Receipts: `technovasolutions.receipts@novalare.com`

### **Email Generation Rules**
1. Take company name from database (`company:{companyId}`)
2. Clean it: lowercase, remove special characters, max 30 chars
3. Append `.invoices` or `.receipts` and `@novalare.com`
4. Check for uniqueness across ALL companies
5. If duplicate, add incrementing number: `companyname1.invoices@novalare.com`
6. Fallback: If company name is invalid, use UUID format

---

## 🔄 **Email Flow - Step by Step**

### **1. Email Address Creation**
```
User visits Invoice/Receipt Extraction page
  ↓
Frontend calls: GET /companies/{companyId}/email-settings
  ↓
Backend checks if settings exist
  ↓
If NOT exists:
  - Fetch company name from database
  - Generate unique invoices email
  - Generate unique receipts email
  - Save to KV store: company:{companyId}:email-settings
  ↓
Return email addresses to frontend
  ↓
Frontend displays in banner with copy button
```

**Backend Code Location:** `/supabase/functions/server/email-settings-routes.tsx`

---

### **2. Email Reception (Cloudflare)**
```
Vendor sends invoice PDF to: abcbackereigmbh.invoices@novalare.com
  ↓
Cloudflare Email Routing receives email
  ↓
Cloudflare Email Worker is triggered
  ↓
Worker filters emails (only process .invoices or .receipts)
  ↓
Worker parses MIME to extract PDF attachments
  ↓
Worker converts attachments to base64
  ↓
Worker forwards to webhook with:
  - from: sender email
  - to: recipient email (the .invoices address)
  - subject: email subject
  - attachments: [{filename, contentType, content (base64)}]
```

**Cloudflare Worker Code:** `/CLOUDFLARE_WORKER_SCRIPT.js`

**Webhook Endpoint:** `https://{projectId}.supabase.co/functions/v1/make-server-53c2e113/api/webhook/cloudflare`

---

### **3. Email Processing (Backend)**
```
Webhook receives email from Cloudflare
  ↓
Extract "to" email address from payload
  ↓
Search ALL company email-settings for matching address
  ↓
If found: Get companyId and determine type (invoices/receipts)
  ↓
For each attachment:
  - Decode base64 content
  - Upload to Supabase Storage (bucket: make-53c2e113)
  - Generate signed URL (1 year expiry)
  ↓
Classify document using OpenAI GPT-4o:
  - Is it an invoice or receipt?
  - Confidence score
  ↓
Extract data using OpenAI:
  - For invoices: vendor, date, total, line items, etc.
  - For receipts: merchant, date, total, items, etc.
  ↓
Save to KV store:
  - invoice:{companyId}:{invoiceId}
  - receipt:{companyId}:{receiptId}
  - email:{companyId}:{emailId}
  ↓
Increment processed counter in email-settings
  ↓
Return success response to Cloudflare
```

**Backend Code Locations:**
- Webhook: `/supabase/functions/server/routes.tsx` (line 1223)
- Document Classification: `/supabase/functions/server/document-processor.tsx` (classifyDocument)
- Invoice Extraction: `/supabase/functions/server/document-processor.tsx` (extractInvoiceData)
- Receipt Extraction: `/supabase/functions/server/document-processor.tsx` (extractReceiptData)

---

### **4. Display in Frontend**
```
User navigates to Invoice/Receipt Extraction page
  ↓
React Query fetches invoices/receipts from backend
  ↓
Endpoint: GET /api/invoices/{companyId}
Endpoint: GET /api/receipts/{companyId}
  ↓
Display in table with status (Pending/Approved/Rejected)
  ↓
User can approve, reject, or delete
  ↓
UI filters by selected month
```

**Frontend Code Locations:**
- Invoice Extraction: `/components/devportal/workflows/InvoiceExtraction.tsx`
- Receipt Extraction: `/components/devportal/workflows/ReceiptExtraction_new.tsx`

---

## 🗄️ **Data Storage**

### **KV Store Structure**

#### Email Settings
```
Key: company:{companyId}:email-settings

Value: {
  receiptsEmail: "companyname.receipts@novalare.com",
  invoicesEmail: "companyname.invoices@novalare.com",
  receiptsProcessed: 42,
  invoicesProcessed: 156,
  createdAt: "2024-01-15T10:30:00.000Z",
  updatedAt: "2024-01-20T14:45:00.000Z"
}
```

#### Invoice
```
Key: invoice:{companyId}:{invoiceId}

Value: {
  id: "inv_abc123",
  companyId: "company_xyz",
  vendor: "Office Supplies Inc",
  invoiceNumber: "INV-2024-001",
  invoiceDate: "2024-01-15",
  dueDate: "2024-02-15",
  totalAmount: 1250.50,
  currency: "USD",
  lineItems: [...],
  status: "Pending",
  source: "email",
  emailId: "email-123",
  emailFrom: "vendor@supplies.com",
  emailSubject: "Invoice INV-2024-001",
  fileUrl: "https://...",
  filePath: "company_xyz/1234567890-invoice.pdf",
  createdAt: "2024-01-15T10:30:00.000Z"
}
```

#### Receipt
```
Key: receipt:{companyId}:{receiptId}

Value: {
  id: "rec_abc123",
  companyId: "company_xyz",
  merchant: "Starbucks",
  date: "2024-01-15",
  total: 45.50,
  tax: 3.50,
  subtotal: 42.00,
  category: "Meals & Entertainment",
  paymentMethod: "Credit Card",
  items: [...],
  status: "Pending",
  source: "email",
  emailId: "email-456",
  emailFrom: "receipts@starbucks.com",
  imageUrl: "https://...",
  createdAt: "2024-01-15T14:20:00.000Z"
}
```

#### Email Record
```
Key: email:{companyId}:{emailId}

Value: {
  id: "email-123",
  companyId: "company_xyz",
  from: "vendor@supplies.com",
  subject: "Invoice INV-2024-001",
  body: "Full email stored",
  attachments: [
    {
      fileName: "invoice.pdf",
      fileUrl: "https://...",
      fileType: "application/pdf",
      fileSize: 245678
    }
  ],
  extractedInvoices: 1,
  extractedReceipts: 0,
  receivedAt: "2024-01-15T10:30:00.000Z",
  status: "Processed"
}
```

---

## 🤖 **AI Processing**

### **Document Classification (OpenAI GPT-4o)**

**Prompt:**
```
Classify this document. Is it an INVOICE or a RECEIPT?

INVOICE characteristics:
- Formal business document sent BEFORE payment
- Contains invoice number, due date, payment terms
- Usually multi-page with detailed line items
- From vendor/supplier to customer
- Shows "Invoice", "Bill", "Payment Due"
- Professional layout with company letterhead

RECEIPT characteristics:
- Proof of payment AFTER transaction
- Shorter, simpler format (single page or small slip)
- Shows items purchased at point of sale
- Often from retail stores, restaurants, gas stations
- Shows "Receipt", "Paid", "Transaction Complete"
- May be handwritten or from cash register/POS
- Common for everyday expenses (meals, supplies, parking)

Return ONLY a JSON object:
{
  "type": "invoice" or "receipt",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}
```

**Method:**
- For images: Uses Vision API with image URL
- For PDFs: Extracts text using pdf-parse, then uses GPT-4o

---

### **Invoice Data Extraction (OpenAI GPT-4o)**

**Extracted Fields:**
- vendor (company name)
- invoiceNumber
- invoiceDate
- dueDate
- totalAmount
- currency
- lineItems (array)
  - description
  - quantity
  - unitPrice
  - amount
- subtotal
- tax
- category (accounting category)

**Method:**
- Vision API for images
- Text extraction + GPT-4o for PDFs

---

### **Receipt Data Extraction (OpenAI GPT-4o)**

**Extracted Fields:**
- merchant
- date
- total
- tax
- subtotal
- category
- paymentMethod
- items (array)
  - description
  - amount
  - quantity

**Method:**
- Vision API for images
- Text extraction + GPT-4o for PDFs

---

## 🔧 **API Endpoints**

### **Email Settings**
- `GET /companies/:companyId/email-settings` - Get or create email settings
- `POST /companies/:companyId/email-settings/regenerate` - Regenerate email address
- `POST /companies/:companyId/email-settings/increment` - Increment processed count
- `POST /companies/:companyId/email-settings/update-from-name` - Update emails after company name change

### **Webhooks**
- `POST /api/webhook/cloudflare` - Receive emails from Cloudflare Worker

### **Invoices**
- `GET /api/invoices/:companyId` - Get all invoices for company
- `POST /api/invoices/:companyId` - Create invoice (manual upload)
- `PATCH /api/invoices/:companyId/:invoiceId` - Update invoice
- `DELETE /api/invoices/:companyId/:invoiceId` - Delete invoice

### **Receipts**
- `GET /api/receipts/:companyId` - Get all receipts for company
- `POST /api/receipts/:companyId` - Create receipt (manual upload)
- `PATCH /api/receipts/:companyId/:receiptId` - Update receipt
- `DELETE /api/receipts/:companyId/:receiptId` - Delete receipt

---

## ⚙️ **Cloudflare Setup Requirements**

### **1. Email Routing**
- Enable Email Routing in Cloudflare Dashboard
- Add MX records for novalare.com (automatic)
- Wait for DNS propagation (~5-10 minutes)

### **2. Email Worker**
- Create Worker: `novalare-email-router`
- Deploy script from `/CLOUDFLARE_WORKER_SCRIPT.js`
- Configure webhook URL with Supabase project ID
- Add Supabase anon key for authentication

### **3. Email Route**
- Create catch-all route: `*@novalare.com` → Worker
- OR specific routes:
  - `*.invoices@novalare.com` → Worker
  - `*.receipts@novalare.com` → Worker

---

## 🐛 **Common Issues & Solutions**

### **Issue: Email not being processed**
**Causes:**
1. Email address not in company email-settings
2. Cloudflare Worker not deployed
3. Webhook URL incorrect
4. No attachments in email

**Solution:**
- Check company email-settings in KV store
- Verify Cloudflare Worker logs
- Check webhook endpoint in Worker script
- Ensure emails have PDF/image attachments

---

### **Issue: Wrong company receiving email**
**Causes:**
1. Duplicate email addresses across companies
2. Email lookup logic failing

**Solution:**
- Email addresses are unique across ALL companies
- Check KV store for duplicates
- Regenerate email if needed

---

### **Issue: Attachments not extracted**
**Causes:**
1. MIME parsing failure
2. Attachments not base64 encoded
3. Unsupported file format

**Solution:**
- Check Cloudflare Worker logs for MIME errors
- Verify attachment is PDF or image
- Check base64 encoding in email

---

### **Issue: AI extraction failing**
**Causes:**
1. OpenAI API key missing/invalid
2. Document quality too poor
3. Rate limits exceeded

**Solution:**
- Verify OPENAI_API_KEY environment variable
- Check document quality
- Monitor OpenAI API usage

---

## 🚀 **Performance Metrics**

- **Email Processing Time:** ~5-10 seconds
- **AI Classification:** ~2-3 seconds
- **AI Extraction:** ~5-8 seconds
- **Total End-to-End:** ~10-20 seconds

---

## 🔐 **Security Features**

1. **Email Uniqueness:** Prevents duplicate addresses across companies
2. **Company Isolation:** Emails only processed for valid companies
3. **Authentication:** Webhook requires Supabase anon key
4. **Storage:** Files stored in private Supabase bucket with signed URLs
5. **Validation:** Company existence verified before processing

---

## 📊 **Monitoring & Logging**

### **Backend Logs**
- Email received: `📬 Cloudflare Email Worker webhook received`
- Company found: `✅ Found company by invoices email: {name}`
- Attachment processed: `📎 Found {count} attachments`
- Classification: `🏷️ Document classified as: {type}`
- Extraction: `✅ Invoice saved: {vendor} - {amount}`

### **Cloudflare Worker Logs**
- Email received: `📧 Incoming email`
- Filtered: `✅ Invoice email detected - processing...`
- Attachments: `📎 Total attachments processed: {count}`
- Webhook called: `📤 Calling webhook: {url}`
- Success: `✅ Email processing complete!`

---

## 🎨 **Frontend Features**

### **Email Banner**
- Shows unique forwarding email
- Copy-to-clipboard button
- Styled with #65D3FD branding
- Instructions: "Forward invoices/receipts to this email:"

### **Period Filtering**
- Dropdown selector with last 12 months
- Format: "December 2024", "November 2024"
- Client-side filtering by date
- Default: Current month

### **Invoice/Receipt Table**
- Status badges (Pending/Approved/Rejected)
- Approve/Reject actions
- View PDF/image
- Delete functionality
- Expandable line items
- Bulk actions (select multiple)
- Email source indicator

---

## 🔄 **Future Enhancements**

1. **Real-time Updates:** WebSocket notifications when email processed
2. **Email Preview:** View original email in UI
3. **Retry Failed:** Manually retry failed extractions
4. **Auto-categorization:** ML-based category suggestions
5. **Email Rules:** Custom routing rules per company
6. **Multi-attachment:** Handle multiple invoices in one email
7. **Email Templates:** Suggested forwarding instructions for vendors
