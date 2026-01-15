# ⚡ Quick Start Guide - 2 Minutes to Test!

## 🎯 Your Mission

Test the Python API integration through your Novalare UI (no terminal needed!)

---

## 📝 Step-by-Step Instructions

### **STEP 1: Add Environment Variable to Supabase (1 minute)**

1. Open [Supabase Dashboard](https://supabase.com/dashboard) in new tab
2. Click on your project
3. Left sidebar → Click **Settings** (gear icon)
4. Click **Edge Functions**
5. Scroll to **Secrets** section
6. Click **Add new secret** button
7. Enter:
   - **Name:** `PYTHON_EXTRACTION_API_URL`
   - **Value:** `https://extraction-89ev.onrender.com`
8. Click **Save**
9. ✅ Done! Supabase will auto-redeploy

---

### **STEP 2: Test in Novalare UI (1 minute)**

1. Go to your Novalare app: `https://your-app-url.com`
2. Log in to Dev Portal
3. Select any company (or create test company)
4. Click **Bank Reconciliation** in left menu
5. Look for **"Upload Bank Statements"** card
6. Click the dropdown that says "⚡ Heuristic (Instant)"
7. Select **"🐍 Python AI (Bank-Agnostic)"**
8. Upload any bank statement PDF
9. Watch the extraction happen!

---

## 🎬 What You'll See

```
┌─────────────────────────────────────────┐
│  🐍 Using PYTHON API with AI Layout     │
│     Discovery...                        │
│                                         │
│  🔍 Step 1: Discovering layout with AI...│
│  ✅ Layout discovered: Chase            │
│     (running_balance)                   │
│  📋 Cache key: chase_running_balance... │
│                                         │
│  📄 Step 2: Extracting transactions...  │
│  ✅ Extracted 47 transactions           │
│  💰 Summary: -$2,450.00 debits,        │
│              +$5,200.00 credits         │
└─────────────────────────────────────────┘
```

Then you'll see all transactions appear in the table below!

---

## 🎯 Expected Results

### **If Everything Works:**
- ✅ PDF uploads successfully
- ✅ You see "🐍 Using PYTHON API..." in logs/console
- ✅ Transactions appear in the table
- ✅ All dates, amounts, and descriptions are correct

### **If Environment Variable Missing:**
- ❌ Error: "PYTHON_EXTRACTION_API_URL environment variable not set"
- 🔧 **Fix:** Go back to Step 1 and add the environment variable

### **If Python API is Sleeping (Free Tier):**
- ⏳ First request takes 50+ seconds (cold start)
- ✅ Subsequent requests are instant
- 🔧 **Fix:** Wait patiently on first request, or set up cron keep-alive

---

## 🧪 Test Cases

Try these different types of statements to test the bank-agnostic feature:

1. **Chase statement** (running balance, MM/DD/YYYY dates)
2. **Deutsche Bank statement** (Soll/Haben columns, DD.MM. dates)
3. **Capital One statement** (multi-line descriptions, day-only dates)
4. **Any other bank** (the AI will discover the layout!)

---

## 💡 Pro Tips

### **Check the Browser Console**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Watch for logs:
   ```
   🐍 Using PYTHON API with AI Layout Discovery...
   🔍 Step 1: Discovering layout with AI...
   ✅ Layout discovered: Chase (running_balance)
   📄 Step 2: Extracting transactions with discovered schema...
   ✅ Extracted 47 transactions
   ```

### **Check Supabase Logs**
1. Go to Supabase Dashboard
2. Click **Logs** in left sidebar
3. Filter by "Edge Functions"
4. Look for Python API calls

### **Check Render Logs**
1. Go to [Render Dashboard](https://render.com)
2. Click on your "extraction-89ev" service
3. Click **Logs** tab
4. Watch for incoming requests

---

## 🚀 That's It!

You now have a **production-ready, bank-agnostic extraction system** that you can test directly through your UI!

**No terminal commands needed!** 🎉

---

## 📞 Need Help?

If something doesn't work:

1. Check the environment variable is set correctly
2. Wait 60 seconds for Render cold start
3. Check browser console for errors
4. Check Supabase Edge Function logs
5. Check Render Python API logs

Most issues are fixed by:
- ✅ Adding the environment variable
- ✅ Waiting for cold start (first request only)
- ✅ Checking logs for actual error messages
