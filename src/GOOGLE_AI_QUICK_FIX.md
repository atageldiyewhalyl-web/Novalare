# 🔧 Google Document AI Quick Fix Guide

You're getting a `CONSUMER_INVALID` error because the Document AI API isn't fully enabled yet.

## ✅ Step-by-Step Fix (5 minutes)

### 1. **Enable the API** (if not done already)
```
https://console.cloud.google.com/apis/library/documentai.googleapis.com?project=676313886382
```
- Click the blue **"ENABLE"** button
- ⏱️ **Wait 1-2 minutes** for activation to propagate

### 2. **Grant Service Account Permissions**

The API is enabled, but your service account doesn't have permission to use it yet.

**Steps:**
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=676313886382
2. Find your service account (looks like `novalare-ai@...iam.gserviceaccount.com`)
3. Click the ✏️ **Edit** button next to it
4. Click **"+ ADD ANOTHER ROLE"**
5. Search for and select: **"Document AI API User"**
6. Click **"SAVE"**

### 3. **Wait & Test**
- ⏱️ Wait **30-60 seconds** for IAM changes to propagate
- Go back to Novalare Bank Reconciliation
- Upload a PDF bank statement
- It should work now!

---

## 🚨 If Still Not Working

### Option A: Use Heuristic Extraction (Instant!)
- In Bank Reconciliation, switch the extraction method dropdown to **"Heuristic"**
- Upload your PDF - it works instantly with no setup!
- ⚡ Super fast and reliable

### Option B: Check Billing
- Google Document AI requires billing to be enabled
- Go to: https://console.cloud.google.com/billing/linkedaccount?project=676313886382
- Make sure a billing account is linked

### Option C: Verify Processor Location
Your processor is in: `us` (United States)
- Make sure this matches your GOOGLE_PROCESSOR_LOCATION secret
- Check at: Project Settings → Supabase Secrets

---

## 📊 Current Configuration

- **Project ID:** 676313886382
- **Processor Location:** us
- **Required API:** Document AI API (documentai.googleapis.com)

---

## 💡 Why This Happens

Google Cloud has **two separate steps**:
1. ✅ **Create a processor** (you did this already)
2. ❌ **Enable the API** (this is the missing step)

Even if you created a processor, the API itself needs to be explicitly enabled in the API Library.

**Plus**, the service account needs permission to use the API via IAM roles.

---

## 🎯 Quick Checklist

- [ ] API enabled in API Library
- [ ] Waited 1-2 minutes after enabling
- [ ] Service account has "Document AI API User" role
- [ ] Billing is enabled on the project
- [ ] Processor location matches secret value
- [ ] Tried uploading a PDF again

---

## 🆘 Still Stuck?

Just use **Heuristic extraction** - it's instant, requires no setup, and works great for most bank statements!

Or ping me and I'll help debug further.
