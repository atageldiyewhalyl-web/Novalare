# 🧪 Python AI Integration Testing Guide

## ✅ Current Status
- **Backend Integration:** ✅ Complete
- **Frontend UI:** ✅ Complete with status indicator
- **Python Microservice:** 🔄 Deployed on Render (ready to test)
- **Proxy Fix:** ✅ Applied (httpx custom client for OpenAI)

## 🚀 How to Test the Integration

### Step 1: Open the Bank Reconciliation UI
1. Navigate to Dev Portal → Bank Reconciliation
2. Select a company and period

### Step 2: Test the Python API Connection
1. In the extraction method dropdown, select **"🐍 Python AI (Bank-Agnostic)"**
2. A purple alert banner will appear showing Python API status
3. Click the **"Test API"** button to verify the microservice is online
4. You should see: **"🐍 Python AI Microservice is Online!"**

### Step 3: Upload a Bank Statement PDF
1. Click **"Upload Statement"** button
2. Select a bank statement PDF (any bank - Chase, Capital One, Deutsche Bank, etc.)
3. Watch the extraction process:
   - Step 1: 🔍 AI Layout Discovery (GPT-4 Vision analyzes the PDF structure)
   - Step 2: 📄 Extraction (pdfplumber extracts data using discovered schema)
4. Transactions will stream to the UI in real-time

## 🔍 What to Check

### ✅ Successful Integration Indicators:
- [ ] "Test API" button shows Python API is **online**
- [ ] PDF upload starts without errors
- [ ] Console shows: `🐍 Using PYTHON API with AI Layout Discovery...`
- [ ] Console shows: `🔍 Step 1: Discovering layout with AI...`
- [ ] Console shows: `✅ Layout discovered: [Bank Name]`
- [ ] Console shows: `📄 Step 2: Extracting transactions...`
- [ ] Console shows: `✅ Python API extracted [X] transactions`
- [ ] Transactions appear in the UI table
- [ ] Success toast: "Uploaded [filename] - [X] transactions extracted"

### ❌ Common Issues to Watch For:

#### 1. **Python API Offline**
- **Symptom:** Test API button shows "offline"
- **Solution:** Check Render.com deployment status
- **Check:** Verify `PYTHON_EXTRACTION_API_URL` environment variable is set

#### 2. **OpenAI Proxy Error (SHOULD BE FIXED)**
- **Symptom:** Error: "ProxyError: [Errno 111] Connection refused"
- **Solution:** Already fixed! New app.py uses custom httpx client
- **If still happening:** Verify Render deployed the updated app.py

#### 3. **Timeout on Large PDFs**
- **Symptom:** Request timeout after 5 minutes
- **Solution:** Normal for very large PDFs (100+ pages)
- **Workaround:** Try smaller PDF files first

#### 4. **API Key Missing**
- **Symptom:** "OpenAI API key not configured"
- **Solution:** Set `OPENAI_API_KEY` in Render environment variables

## 📊 Testing Different Banks

The Python AI is **bank-agnostic** - it should work with ANY bank statement. Try:
- ✅ Chase
- ✅ Capital One
- ✅ Deutsche Bank
- ✅ Wells Fargo
- ✅ Bank of America
- ✅ Any other bank!

## 🐛 Debugging

### Check Browser Console
Open browser DevTools (F12) and look for:
```
🐍 Using PYTHON API with AI Layout Discovery...
🔍 Step 1: Discovering layout with AI...
✅ Layout discovered: Deutsche Bank (statement)
📄 Step 2: Extracting transactions with discovered schema...
✅ Python API extracted 47 transactions
```

### Check Render Logs
Go to Render.com → Your service → Logs tab to see:
```
Discovering layout for: bank_statement.pdf
Using OpenAI GPT-4 Vision...
Layout discovered: Deutsche Bank
Extracting with pdfplumber...
Extracted 47 transactions
```

### Check Supabase Edge Function Logs
Look for Python API calls and responses

## 🎯 Expected Flow

```
1. User uploads PDF → Frontend
2. Frontend sends to Supabase Edge Function
3. Edge Function calls Python API on Render
4. Python API: /discover-layout (GPT-4 Vision)
   → Returns: bank_name, column_config, parsing_notes
5. Python API: /extract-with-schema (pdfplumber)
   → Returns: transactions array
6. Edge Function returns transactions to Frontend
7. Frontend displays transactions in table
```

## 🎉 Success Criteria

You've successfully integrated the Python AI when:
- ✅ Test API button shows "online"
- ✅ PDF upload completes without errors
- ✅ Transactions are extracted and displayed
- ✅ Works with multiple different banks
- ✅ Console shows AI layout discovery logs

## 🔧 Troubleshooting Commands

### Test Python API directly (from terminal):
```bash
curl -X GET https://your-service.onrender.com/health
```

### Test layout discovery:
```bash
curl -X POST https://your-service.onrender.com/discover-layout \
  -F "file=@bank_statement.pdf"
```

---

**Ready to test? Select "🐍 Python AI (Bank-Agnostic)" and upload a PDF!** 🚀
