# 📸 Visual Deployment Guide - Step by Step

## 🎯 Goal
Deploy your Edge Function so your app can talk to the backend.

---

## 📋 Before You Start

**What you need:**
- ✅ Terminal/Command Prompt access
- ✅ Your Supabase Project Reference ID
- ✅ 5-10 minutes

---

## 🚀 Step-by-Step Instructions

### STEP 1: Install Supabase CLI

#### Mac/Linux:
```bash
# Open Terminal and run:
brew install supabase/tap/supabase
```

#### Windows:
```powershell
# Open PowerShell as Administrator and run:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Verify installation:**
```bash
supabase --version
```

You should see: `1.x.x` or higher

---

### STEP 2: Get Your Project Reference ID

1. **Go to**: https://supabase.com/dashboard
2. **Select** your Novalare project
3. **Click** "Settings" (left sidebar)
4. **Click** "General"
5. **Scroll down** to "Reference ID"
6. **Copy** the ID (looks like: `abcdefghijklmnop`)

**Example:**
```
Reference ID: xyz123abc456def7
```

---

### STEP 3: Login to Supabase

```bash
# Run this command:
supabase login
```

**What happens:**
1. A browser window opens
2. You see "Authorize Supabase CLI"
3. Click "Authorize"
4. Terminal shows: "✔ Logged in successfully"

---

### STEP 4: Link Your Project

```bash
# Replace YOUR_PROJECT_REF with the ID you copied in Step 2:
supabase link --project-ref YOUR_PROJECT_REF
```

**Example:**
```bash
supabase link --project-ref xyz123abc456def7
```

**What happens:**
```
✔ Linked to project: your-project-name
✔ Generated config for project
```

---

### STEP 5: Deploy the Edge Function

#### Option A: Use the Quick Script (Easiest)

**Mac/Linux:**
```bash
chmod +x DEPLOY_QUICKSTART.sh
./DEPLOY_QUICKSTART.sh
```

**Windows:**
```powershell
.\DEPLOY_QUICKSTART.ps1
```

#### Option B: Manual Command

```bash
supabase functions deploy make-server-53c2e113
```

**What happens:**
```
Deploying Function (project-ref = xyz123abc456def7)...
Bundling make-server-53c2e113
Deploying make-server-53c2e113 (version: xxx-xxx-xxx)
✔ Deployed Function make-server-53c2e113
```

This takes **30-60 seconds**.

---

### STEP 6: Verify Deployment

#### Test 1: Check Function List

```bash
supabase functions list
```

**Expected output:**
```
┌──────────────────────────┬──────────┬─────────┬───────────────────────┐
│ NAME                     │ STATUS   │ VERSION │ UPDATED AT            │
├──────────────────────────┼──────────┼─────────┼───────────────────────┤
│ make-server-53c2e113     │ ACTIVE   │ 1       │ 2024-01-XX XX:XX:XX   │
└──────────────────────────┴──────────┴─────────┴───────────────────────┘
```

✅ **STATUS = ACTIVE** means it's working!

#### Test 2: Test Health Endpoint

```bash
# Replace YOUR_PROJECT_ID with your actual project ID
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/health
```

**Expected response:**
```json
{"status":"ok"}
```

✅ If you see this, **YOUR BACKEND IS LIVE!**

---

### STEP 7: Refresh Your App

1. **Go to** your Novalare app in the browser
2. **Press** Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac) to hard refresh
3. **Check** the browser console (F12 → Console tab)

**Before deployment:**
```
❌ API Error: "Requested function was not found"
```

**After deployment:**
```
✅ (No errors!)
```

---

## 🎉 SUCCESS INDICATORS

You know it worked when:

✅ **No "function not found" errors** in console  
✅ **Dashboard loads** with companies  
✅ **Settings page loads** without errors  
✅ **Health endpoint** returns `{"status":"ok"}`  
✅ **Supabase Dashboard** shows function as "ACTIVE"  

---

## 🔍 Troubleshooting Visual Guide

### Problem: "supabase: command not found"

**What you see:**
```bash
$ supabase login
bash: supabase: command not found
```

**Fix:**
Go back to STEP 1 and install the CLI.

---

### Problem: "Project not linked"

**What you see:**
```bash
$ supabase functions deploy make-server-53c2e113
Error: Project ref not provided
```

**Fix:**
Run STEP 4 again:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

---

### Problem: Browser Shows Old Errors

**What you see:**
The app still shows "function not found" after deployment.

**Fix:**
1. Open Developer Tools (F12)
2. Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
3. Click "Clear site data" or "Clear storage"
4. Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

---

### Problem: Deployment Stuck

**What you see:**
```bash
Deploying Function...
(stuck here for 5+ minutes)
```

**Fix:**
1. Press Ctrl+C to cancel
2. Check your internet connection
3. Try again: `supabase functions deploy make-server-53c2e113`

---

## 📊 What's Running Now?

After successful deployment, here's what's live:

```
Your Edge Function (make-server-53c2e113)
├── 🏃 Running on Supabase infrastructure
├── 🌍 Accessible at: https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113
├── 🔐 Has access to your Supabase secrets (QB credentials)
└── 📡 Handles 162+ API routes:
    ├── /api/companies (Company management)
    ├── /api/invoices (Invoice processing)
    ├── /api/settings (User settings)
    ├── /accounting/qbo/auth-url (QuickBooks OAuth)
    ├── /accounting/qbo/callback (QuickBooks callback)
    ├── /accounting/connections (List QB connections)
    └── ... and 156 more routes!
```

---

## 🎯 Next: Test QuickBooks Integration

Once deployment is verified:

1. **Open** your app
2. **Navigate to** Settings → Accounting Integrations
3. **Click** "Connect QuickBooks"
4. **Sign in** with your Intuit Developer account
5. **Select** a sandbox company
6. **Authorize** the connection
7. **See** your connected company appear! 🎉

---

## 💡 Quick Reference

**Deploy function:**
```bash
supabase functions deploy make-server-53c2e113
```

**View logs:**
```bash
supabase functions logs make-server-53c2e113
```

**Test health:**
```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/health
```

**List functions:**
```bash
supabase functions list
```

---

## ✅ Deployment Checklist

Copy this checklist and check off each item:

```
□ Installed Supabase CLI
□ Logged in to Supabase (supabase login)
□ Got Project Reference ID from Supabase Dashboard
□ Linked project (supabase link --project-ref XXX)
□ Deployed function (supabase functions deploy make-server-53c2e113)
□ Verified function is ACTIVE (supabase functions list)
□ Tested health endpoint (curl ...)
□ Refreshed app in browser
□ Verified no "function not found" errors
□ App loads Dashboard, Settings, Companies successfully
□ Ready to test QuickBooks integration!
```

---

## 🚀 You're Ready!

Your backend is now **live and operational**. The hard part is done!

Everything you've built is now accessible:
- ✅ PDF extraction pipeline
- ✅ Bank reconciliation engine
- ✅ Invoice processing
- ✅ QuickBooks OAuth integration
- ✅ Multi-tenant architecture

**Next step**: Connect your first QuickBooks sandbox company and start testing! 🎉
