# 🚫 Disable Proxies - Complete Guide

## Problem

You're getting this error:
```
TypeError: Client.__init__() got an unexpected keyword argument 'proxies'
```

This happens when:
1. Your environment has proxy settings
2. The OpenAI SDK version doesn't accept proxy parameters
3. System-wide proxies are interfering

---

## ✅ Solution 1: Clean Code (Already Fixed)

The code now uses a **clean OpenAI client initialization** with NO proxy arguments:

```python
# ✅ CORRECT (no proxies)
client = OpenAI(api_key=api_key)
```

**NOT this:**
```python
# ❌ WRONG (causes error)
client = OpenAI(api_key=api_key, proxies={...})
```

---

## ✅ Solution 2: Disable Environment Proxies

If you're still getting errors, your **system environment** might have proxy settings.

### Check for proxy variables:
```bash
echo $HTTP_PROXY
echo $HTTPS_PROXY
echo $http_proxy
echo $https_proxy
```

### Disable them temporarily:
```bash
# Before running the server:
unset HTTP_PROXY
unset HTTPS_PROXY
unset http_proxy
unset https_proxy
unset NO_PROXY
unset no_proxy

# Then start server:
python3 app.py
```

---

## ✅ Solution 3: Run with NO_PROXY

Run the server with proxies explicitly disabled:

```bash
HTTP_PROXY="" HTTPS_PROXY="" python3 app.py
```

Or create a wrapper script:

```bash
#!/bin/bash
# run_server_no_proxy.sh

# Clear all proxy variables
unset HTTP_PROXY
unset HTTPS_PROXY
unset http_proxy
unset https_proxy
unset ALL_PROXY
unset all_proxy

# Start server
cd python-extraction-server
python3 app.py
```

Then:
```bash
chmod +x run_server_no_proxy.sh
./run_server_no_proxy.sh
```

---

## ✅ Solution 4: Check OpenAI SDK Version

Make sure you're using a compatible OpenAI SDK version:

```bash
pip show openai
```

**Recommended versions:**
- ✅ `openai >= 1.0.0` (new SDK)
- ⚠️ Avoid `openai < 1.0.0` (old SDK with different API)

If you have an old version:
```bash
pip install --upgrade openai
```

---

## ✅ Solution 5: Python Script to Test

Create a test file to verify OpenAI works without proxies:

```python
# test_openai_clean.py
import os
from openai import OpenAI

# Make sure API key is set
api_key = os.environ.get('OPENAI_API_KEY')
if not api_key:
    print("❌ OPENAI_API_KEY not set")
    exit(1)

print(f"✅ API key found: {api_key[:10]}...")

# Initialize client WITHOUT any proxy arguments
try:
    client = OpenAI(api_key=api_key)
    print("✅ OpenAI client initialized successfully")
    
    # Test a simple completion
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Say 'test'"}],
        max_tokens=10
    )
    print(f"✅ API call successful: {response.choices[0].message.content}")
    
except TypeError as e:
    if "proxies" in str(e):
        print("❌ Proxy error detected!")
        print("Your environment or library has proxy settings.")
        print("\nTry:")
        print("  1. unset HTTP_PROXY HTTPS_PROXY")
        print("  2. pip install --upgrade openai")
    else:
        raise
        
except Exception as e:
    print(f"❌ Error: {e}")
```

Run it:
```bash
python3 test_openai_clean.py
```

---

## ✅ Solution 6: Check Requirements

Make sure your `requirements.txt` doesn't force old versions:

```bash
# Check current requirements
cat requirements.txt | grep openai

# Should be:
openai>=1.0.0

# NOT:
# openai==0.28.0  ❌ (old version)
# openai[proxies]  ❌ (has proxy extras)
```

---

## ✅ Solution 7: Virtual Environment (Clean Slate)

Create a fresh virtual environment without proxy pollution:

```bash
# Create new venv
python3 -m venv venv_clean

# Activate it
source venv_clean/bin/activate

# Install only what's needed (NO proxies)
pip install flask flask-cors pdfplumber openai Pillow

# Verify no proxy packages
pip list | grep -i proxy
# Should return nothing

# Run server
python3 app.py
```

---

## 🔍 Debugging: Find the Proxy Code

If you're still getting errors, search for where proxies are being set:

```bash
# Search in your code
cd python-extraction-server
grep -r "proxies" . --include="*.py"

# Should return nothing or just comments
```

---

## 📊 Status Check

After applying fixes, verify:

### ✅ Checklist:
- [ ] `app.py` uses `OpenAI(api_key=api_key)` with NO proxy args
- [ ] No `HTTP_PROXY` environment variables set
- [ ] OpenAI SDK version >= 1.0.0
- [ ] No proxy-related packages in `pip list`
- [ ] Test script runs successfully

### Expected Output:
```bash
python3 app.py

# Should show:
🔑 OpenAI API key found: sk-proj-ab...
🤖 Calling GPT-4 Vision for layout discovery...
✅ GPT-4 Vision responded successfully

# Should NOT show:
❌ TypeError: Client.__init__() got an unexpected keyword argument 'proxies'
```

---

## 🚀 Final Test

Once proxies are disabled:

```bash
# Terminal 1: Start server
python3 app.py

# Terminal 2: Test AI discovery
curl -X POST http://127.0.0.1:8000/discover-layout \
  -F "file=@/path/to/your/statement.pdf" \
  | python3 -m json.tool
```

Should return:
```json
{
  "success": true,
  "layout_schema": {
    "bank_name": "Capital One",
    "confidence_score": 95,
    ...
  }
}
```

---

## 💡 Key Takeaways

1. **Modern OpenAI SDK** (>= 1.0.0) doesn't use `proxies` parameter
2. **Clean initialization**: `OpenAI(api_key=api_key)` - that's it!
3. **Environment matters**: System proxies can interfere even if code is clean
4. **Test in isolation**: Create a simple test script to verify OpenAI works

---

## 📝 Summary

The code is now **proxy-free**:

```python
# ✅ What the code does now:
client = OpenAI(api_key=api_key)

# ❌ What it does NOT do:
# client = OpenAI(api_key=api_key, proxies={...})  # REMOVED
# client = OpenAI(api_key=api_key, http_client=...)  # REMOVED
```

If you still get proxy errors, it's your **environment**, not the code.

→ Use Solution 2 or 3 above to disable system proxies.
