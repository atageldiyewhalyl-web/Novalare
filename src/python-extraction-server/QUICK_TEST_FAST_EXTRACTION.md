# ⚡ Quick Test: Fast Extraction

## 🚀 Test Locally (5 minutes)

### Step 1: Install Dependencies
```bash
cd python-extraction-server

# Install new dependency
pip install nest-asyncio

# Or install all dependencies
pip install -r requirements.txt
```

### Step 2: Set API Key
```bash
# Set OpenAI API key
export OPENAI_API_KEY="sk-your-key-here"
```

### Step 3: Start Server
```bash
python app.py
```

Expected output:
```
 * Running on http://0.0.0.0:8000
```

### Step 4: Test Health Endpoint
```bash
curl http://localhost:8000/
```

Expected response:
```json
{
  "service": "Novalare Bank Statement Extraction API",
  "status": "healthy",
  "version": "4.0.0 - GPT-4 Mini Split & Map (10x Faster)",
  "endpoints": {
    "POST /extract-fast": "🚀 NEW! Fast extraction with GPT-4 mini (10x faster, 7x cheaper)",
    ...
  }
}
```

### Step 5: Test Fast Extraction
```bash
# Use the test script
chmod +x test_fast_extraction.sh
./test_fast_extraction.sh ~/path/to/your/bank_statement.pdf
```

Or manually:
```bash
curl -X POST http://localhost:8000/extract-fast \
  -F "file=@~/path/to/bank_statement.pdf" \
  -H "Accept: application/json" \
  | python -m json.tool
```

---

## 📊 What to Expect

### Console Output (Server Logs)
```
📄 FAST EXTRACTION (GPT-4 mini + Split & Map)
   Strategy: Process pages in parallel
   Total pages: 10
   Processing 8 pages with content...
  ⚠️  Skipping page 1 (empty or too short)
  ⚠️  Skipping page 10 (empty or too short)

🚀 Processing 8 pages in parallel with GPT-4 mini...
  ✅ Page 2: Extracted 18 transactions
  ✅ Page 3: Extracted 22 transactions
  ✅ Page 4: Extracted 19 transactions
  ✅ Page 5: Extracted 21 transactions
  ✅ Page 6: Extracted 20 transactions
  ✅ Page 7: Extracted 17 transactions
  ✅ Page 8: Extracted 19 transactions
  ✅ Page 9: Extracted 20 transactions

✅ TOTAL: 156 transactions extracted from 8 pages
   ✅ Final count: 156 valid transactions
```

### API Response
```json
{
  "success": true,
  "method": "gpt4_mini_split_map",
  "count": 156,
  "processing_time_seconds": 4.2,
  "speed_note": "Processed in 4.2s (10x faster than sequential)",
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "ATM Withdrawal",
      "amount": -200.0,
      "balance": 1500.50
    },
    {
      "date": "2024-01-16",
      "description": "Direct Deposit - Payroll",
      "amount": 3500.0,
      "balance": 5000.50
    },
    ...
  ],
  "summary": {
    "total_debits": -5234.50,
    "total_credits": 8750.00,
    "net_change": 3515.50
  }
}
```

---

## ⏱️ Speed Comparison

Test the same PDF with both endpoints:

### Old Method
```bash
time curl -X POST http://localhost:8000/extract \
  -F "file=@statement.pdf" \
  -o /dev/null -s

# Expected: ~40 seconds
```

### New Method
```bash
time curl -X POST http://localhost:8000/extract-fast \
  -F "file=@statement.pdf" \
  -o /dev/null -s

# Expected: ~4 seconds ⚡
```

### Result
```
Old: 40.2 seconds
New: 4.1 seconds
Speedup: 9.8x faster! 🚀
```

---

## 🧪 Test Different Scenarios

### Test 1: Small PDF (2-3 pages)
```bash
# Expected: 2-3 seconds
curl -X POST http://localhost:8000/extract-fast \
  -F "file=@small_statement.pdf"
```

### Test 2: Medium PDF (8-10 pages)
```bash
# Expected: 4-5 seconds
curl -X POST http://localhost:8000/extract-fast \
  -F "file=@medium_statement.pdf"
```

### Test 3: Large PDF (15-20 pages)
```bash
# Expected: 5-7 seconds
# Old method would timeout!
curl -X POST http://localhost:8000/extract-fast \
  -F "file=@large_statement.pdf"
```

### Test 4: Different Banks
```bash
# Chase
curl -X POST http://localhost:8000/extract-fast \
  -F "file=@chase_statement.pdf"

# Capital One
curl -X POST http://localhost:8000/extract-fast \
  -F "file=@capital_one_statement.pdf"

# Deutsche Bank (European format)
curl -X POST http://localhost:8000/extract-fast \
  -F "file=@deutsche_bank_statement.pdf"
```

---

## ✅ Validation Checklist

After testing, verify:

- [ ] **Speed:** Processing time is 3-6 seconds
- [ ] **Accuracy:** Transaction count matches manual count
- [ ] **Completeness:** All transactions extracted
- [ ] **Dates:** Dates are in YYYY-MM-DD format
- [ ] **Amounts:** Amounts are correct (negative for debits)
- [ ] **Balances:** Running balances match (if available)
- [ ] **No errors:** No exceptions in server logs
- [ ] **Cost:** Check OpenAI dashboard (should be ~$0.003/doc)

---

## 🐛 Troubleshooting

### Issue: ImportError: nest_asyncio
```bash
pip install nest-asyncio
```

### Issue: OpenAI API Key Not Set
```bash
export OPENAI_API_KEY="sk-your-key-here"
python app.py
```

### Issue: Port Already in Use
```bash
# Use different port
export PORT=8001
python app.py

# Or kill existing process
lsof -ti:8000 | xargs kill -9
```

### Issue: Module Not Found
```bash
# Reinstall all dependencies
pip install -r requirements.txt
```

### Issue: Event Loop Error
**Already fixed** - code uses `nest_asyncio.apply()` ✅

---

## 📈 Performance Benchmarks

Run this to benchmark your system:

```bash
#!/bin/bash
echo "🏁 Benchmarking Fast Extraction"
echo ""

for i in {1..5}; do
  echo "Run $i:"
  time curl -X POST http://localhost:8000/extract-fast \
    -F "file=@test_statement.pdf" \
    -o /dev/null -s 2>&1 | grep real
done

echo ""
echo "Average should be 3-6 seconds ⚡"
```

---

## 💡 Next Steps

Once local testing is successful:

1. **Deploy to Render**
   ```bash
   git add .
   git commit -m "feat: Add GPT-4 mini split & map"
   git push origin main
   ```

2. **Test Production**
   ```bash
   curl -X POST https://your-app.onrender.com/extract-fast \
     -F "file=@statement.pdf"
   ```

3. **Update Frontend**
   - Change API endpoint to `/extract-fast`
   - Update loading message
   - Test end-to-end

4. **Monitor**
   - Track processing times
   - Check error rates
   - Gather user feedback

---

## 🎉 Success Indicators

You'll know it's working when:

- ✅ Server starts without errors
- ✅ Health endpoint returns version "4.0.0"
- ✅ Fast extraction completes in 3-6 seconds
- ✅ Transactions are accurate
- ✅ No timeout errors
- ✅ OpenAI costs are 7x lower

---

## 📞 Need Help?

1. Check server logs for errors
2. Verify OpenAI API key is valid
3. Test with small PDF first (2-3 pages)
4. Compare old vs new endpoint side-by-side
5. Check OpenAI dashboard for API usage

---

**Happy Testing!** 🚀

Next: [Deploy to Production →](DEPLOY_FAST_EXTRACTION.md)
