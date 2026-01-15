# Bank Statement Extraction Methods

This document explains the three extraction methods available in Novalare for processing bank statement PDFs.

## 📊 Extraction Methods

### 1. **Heuristic Table Extraction** (Python pdfplumber)
- **Speed**: ⚡ Fastest (~1 second for 1000+ transactions)
- **Cost**: 💰 FREE (no API costs)
- **Accuracy**: 🎯 Excellent for structured tables
- **Page Limit**: ✅ Unlimited
- **Requirements**: Requires Python 3 + pdfplumber library

#### Setup:
```bash
# Install Python (if not already installed)
# On Ubuntu/Debian:
sudo apt-get install python3 python3-pip

# Install pdfplumber
pip3 install pdfplumber

# OR install from requirements file:
pip3 install -r /var/task/supabase/functions/server/requirements.txt
```

#### When to Use:
- ✅ You have server access to install Python
- ✅ Processing large bank statements (1000+ transactions)
- ✅ Want instant, free extraction
- ❌ **NOT available in Supabase Edge Functions** (Deno runtime doesn't include Python)

---

### 2. **Google Document AI**
- **Speed**: ⚡ Fast (~2 seconds for 1000+ transactions)
- **Cost**: 💰 ~$0.015 per statement
- **Accuracy**: 🎯 Excellent (Google's production OCR)
- **Page Limit**: ⚠️ 30 pages maximum
- **Requirements**: Google Cloud credentials

#### When to Use:
- ✅ Cloud-based (works anywhere, including Supabase Edge Functions)
- ✅ Processing statements under 30 pages
- ✅ Want reliable, production-grade OCR
- ❌ Large statements over 30 pages

---

### 3. **OpenAI GPT-4 Vision**
- **Speed**: 🐌 Slower (~30 seconds for 31-page statement)
- **Cost**: 💰💰 ~$0.10 per statement
- **Accuracy**: 🎯🎯 Most accurate (understands context)
- **Page Limit**: ✅ Unlimited
- **Requirements**: OpenAI API key

#### When to Use:
- ✅ Cloud-based (works anywhere)
- ✅ Processing very large statements (50+ pages)
- ✅ Complex formats that break other methods
- ✅ Need highest accuracy for messy PDFs
- ❌ Budget-sensitive (costs more)

---

## 🚀 Recommended Setup

### For Supabase Edge Functions (Cloud):
1. **Primary**: Google Document AI (most statements are under 30 pages)
2. **Fallback**: OpenAI GPT-4 Vision (for 30+ page statements)
3. **Disable**: Heuristic extraction (Python not available)

### For Custom Server (with Python):
1. **Primary**: Heuristic extraction (FREE and fast!)
2. **Fallback**: Google Document AI (for complex formats)
3. **Last resort**: OpenAI (for 30+ page statements)

---

## 📁 Files

- `extract_bank_table.py` - Python script using pdfplumber
- `requirements.txt` - Python dependencies
- `bank-rec-heuristic.tsx` - Deno wrapper that calls Python
- `bank-rec-parsers.tsx` - Main parser exports
- `document-processor.tsx` - Google Document AI integration

---

## 🔧 Troubleshooting

### Error: "Python not available on this server"
**Solution**: Use "Google Document AI" or "OpenAI GPT-4" extraction methods instead.

### Error: "pdfplumber is not installed"
**Solution 1**: Install pdfplumber: `pip3 install pdfplumber`  
**Solution 2**: Use cloud-based extraction (Google or OpenAI)

### Statement over 30 pages with Google
**Solution**: Switch to "OpenAI GPT-4 Vision" extraction method.

---

## 💡 Pro Tips

1. **For development**: Use Heuristic (free, fast) if you have Python installed locally
2. **For production on Supabase**: Use Google Document AI (reliable, cloud-based)
3. **For large statements**: OpenAI GPT-4 Vision handles unlimited pages
4. **Cost optimization**: Heuristic (free) > Google ($0.015) > OpenAI ($0.10)

---

## 📊 Performance Comparison

| Method | Speed | Cost | Page Limit | Works in Supabase |
|--------|-------|------|------------|-------------------|
| **Heuristic (pdfplumber)** | ⚡⚡⚡ 1s | FREE | ✅ Unlimited | ❌ No (needs Python) |
| **Google Document AI** | ⚡⚡ 2s | $0.015 | ⚠️ 30 pages | ✅ Yes |
| **OpenAI GPT-4 Vision** | ⚡ 30s | $0.10 | ✅ Unlimited | ✅ Yes |

---

Last updated: December 2024
