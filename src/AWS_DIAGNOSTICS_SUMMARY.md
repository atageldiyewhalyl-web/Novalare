# AWS CLI & boto3 Diagnostics - Implementation Summary

## 🎉 What Was Added

I've enhanced your AWS Textract troubleshooting toolkit with **AWS CLI commands** and **boto3 (Python SDK) diagnostics** to give you more ways to diagnose and potentially fix the subscription activation issue.

---

## 📦 New Files Created

### 1. `/AWS_CLI_DIAGNOSTICS.md` (Comprehensive Guide)
**Purpose:** Complete reference for all CLI and boto3 diagnostic tools

**Contains:**
- AWS CLI installation instructions (macOS, Linux, Windows)
- Configuration guide
- 7 diagnostic command categories:
  - Identity verification (`aws sts get-caller-identity`)
  - IAM permissions check
  - **Service quota check** (MOST IMPORTANT!)
  - Quota increase requests
  - Direct Textract API test
  - Account verification status
  - Payment method checks
- boto3 diagnostic script with full code
- Integration instructions for Python service
- Troubleshooting flowcharts
- Pro tips and common pitfalls

### 2. `/AWS_CLI_QUICK_COMMANDS.md` (Quick Reference)
**Purpose:** Fast access to most common commands

**Contains:**
- 4 essential commands you can run right now
- Expected outputs and what they mean
- Quick issue diagnosis guide
- API endpoint examples
- AWS Support contact template

### 3. `/python-extraction-server/check_textract_quotas.py` (Standalone Script)
**Purpose:** Runnable Python script for deep diagnostics

**Features:**
- Checks AWS credentials validity
- Verifies service quotas (detects quota = 0)
- Tests Textract API with minimal PDF
- Provides actionable troubleshooting steps
- Can be run locally or on server
- Returns clear success/failure status

**Usage:**
```bash
cd python-extraction-server
export AWS_ACCESS_KEY_ID="your_key"
export AWS_SECRET_ACCESS_KEY="your_secret"
python check_textract_quotas.py

# For all quotas:
python check_textract_quotas.py --all
```

---

## 🔧 Enhanced Existing Files

### 1. `/python-extraction-server/app.py`
**Added:** New API endpoint `/diagnose-aws-textract`

**What it does:**
- Runs boto3 diagnostics from your Python service
- Checks credentials, quotas, and API status
- Returns structured JSON with:
  - `credentials_valid`: bool
  - `quotas_activated`: bool (quota > 0)
  - `api_working`: bool
  - `details`: account info, quota values
  - `errors`: list of issues found
  - `troubleshooting`: actionable fixes

**Usage:**
```bash
# Local
curl http://localhost:8000/diagnose-aws-textract

# Production (Render)
curl https://your-app.onrender.com/diagnose-aws-textract
```

**Example Response:**
```json
{
  "success": false,
  "credentials_valid": true,
  "quotas_activated": false,
  "api_working": false,
  "details": {
    "account_id": "123456789012",
    "user_arn": "arn:aws:iam::123456789012:user/novalare_textract_user",
    "quota_value": 0.0,
    "quota_code": "L-D4F7CA1B"
  },
  "errors": [
    "Textract quota is set to 0 - service not activated"
  ],
  "details": {
    "fix": {
      "cli_command": "aws service-quotas request-service-quota-increase..."
    }
  }
}
```

### 2. `/python-extraction-server/requirements.txt`
**Added:**
```
boto3==1.35.0
botocore==1.35.0
```

### 3. `/components/devportal/AWSTextractTroubleshootingDialog.tsx`
**Added:** New collapsible "Advanced Diagnostics" section

**Features:**
- Expandable CLI commands section
- Copyable AWS CLI commands (with one-click copy)
- boto3 diagnostic script instructions
- Links to documentation files
- Visual indicators for command copying
- Dark mode support

**Commands included:**
1. Verify credentials: `aws sts get-caller-identity`
2. Check quota: `aws service-quotas get-service-quota...`
3. Request increase: `aws service-quotas request-service-quota-increase...`
4. Check IAM: `aws iam list-attached-user-policies...`
5. Run Python script: `python check_textract_quotas.py`
6. Call API: `curl .../diagnose-aws-textract`

---

## 🎯 Most Important Command

### Check Service Quota (THIS IS THE KEY!)
```bash
aws service-quotas get-service-quota \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --region us-east-1
```

**What to look for:**
```json
{
  "Quota": {
    "QuotaName": "AnalyzeDocument transactions per second",
    "Value": 1.0  // <-- This is what matters!
  }
}
```

**Interpretation:**
- ✅ `Value >= 1.0` → **ACTIVATED** (Textract is ready to use)
- ❌ `Value = 0.0` → **NOT ACTIVATED** (This is your problem!)

**If quota = 0, request increase:**
```bash
aws service-quotas request-service-quota-increase \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --desired-value 1.0 \
  --region us-east-1
```

---

## 🚀 Quick Start Guide

### Option 1: AWS CLI (Local Terminal)
```bash
# 1. Install AWS CLI (if not installed)
brew install awscli  # macOS
# OR download from AWS website

# 2. Configure credentials
aws configure
# Enter your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY

# 3. Check quota
aws service-quotas get-service-quota \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --region us-east-1
```

### Option 2: Python boto3 Script
```bash
cd python-extraction-server
export AWS_ACCESS_KEY_ID="your_key"
export AWS_SECRET_ACCESS_KEY="your_secret"
python check_textract_quotas.py
```

### Option 3: API Endpoint (Remote)
```bash
# Call from anywhere
curl https://your-app.onrender.com/diagnose-aws-textract | json_pp
```

### Option 4: UI Dialog (Easiest)
1. Open the troubleshooting dialog in your app
2. Expand "Advanced Diagnostics: AWS CLI & boto3"
3. Click to copy any command
4. Run in your terminal

---

## 🔍 Diagnostic Workflow

```
┌─────────────────────────────────────┐
│  1. Run AWS CLI quota check         │
│     aws service-quotas get-...      │
└─────────────┬───────────────────────┘
              │
              ├─── Value = 0.0? ────────────┐
              │                              │
              │                              ▼
              │                    ┌─────────────────────┐
              │                    │ Request quota       │
              │                    │ increase via CLI    │
              │                    └─────────────────────┘
              │
              ├─── Value >= 1.0? ──────────┐
              │                             │
              │                             ▼
              │                    ┌─────────────────────┐
              │                    │ Quota OK, but API   │
              │                    │ still fails?        │
              │                    │ → Check AWS Console:│
              │                    │   - Account verify  │
              │                    │   - Payment verify  │
              │                    └─────────────────────┘
              │
              ├─── "NoSuchResourceException"? ─────────┐
              │                                         │
              │                                         ▼
              │                                ┌─────────────────┐
              │                                │ Wrong region!   │
              │                                │ Try: us-east-1  │
              │                                └─────────────────┘
              │
              └─── "AccessDeniedException"? ──────────┐
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │ IAM permissions │
                                             │ missing         │
                                             └─────────────────┘
```

---

## 📊 Comparison: CLI vs boto3 vs API

| Feature | AWS CLI | boto3 Script | API Endpoint |
|---------|---------|--------------|--------------|
| **Setup** | Install CLI | Python env | None |
| **Speed** | Fast | Fast | Network delay |
| **Detail** | Medium | High | Medium |
| **Automation** | Yes (shell) | Yes (Python) | Yes (HTTP) |
| **Local/Remote** | Local only | Local only | Remote OK |
| **Best for** | Quick checks | Deep diagnosis | Monitoring |

**Recommendation:** 
- **First time:** Use AWS CLI quota check (fastest to confirm activation)
- **Deep dive:** Run boto3 script (full diagnostic output)
- **Ongoing:** Use API endpoint (can monitor from app)

---

## 💡 Pro Tips

1. **Always check quotas first** - Most "SubscriptionRequired" errors are actually quota = 0
2. **Save your account info** - Run `aws sts get-caller-identity` and save the output
3. **Use `--region` flag** - Textract isn't available in all regions
4. **Check CloudTrail** - See your actual API calls to debug intermittent issues
5. **Cache credentials check** - Don't verify on every request (rate limits!)

---

## 🆘 If Quota = 0 and You Can't Request Increase

**This means account verification is incomplete.** AWS CLI can't fix this - you MUST use AWS Console:

1. **Account verification:** https://console.aws.amazon.com/billing/home#/account
2. **Payment verification:** https://console.aws.amazon.com/billing/home#/paymentmethods
3. **Contact support:** https://console.aws.amazon.com/support/home

**Support template available in UI dialog!**

---

## 📚 Documentation Files

- `/AWS_CLI_DIAGNOSTICS.md` - Full guide with all commands and examples
- `/AWS_CLI_QUICK_COMMANDS.md` - Quick reference card
- `/python-extraction-server/check_textract_quotas.py` - Standalone diagnostic script
- This file (`/AWS_DIAGNOSTICS_SUMMARY.md`) - Implementation overview

---

## 🎉 Next Steps

1. **Install AWS CLI** (if not installed): `brew install awscli`
2. **Configure:** `aws configure`
3. **Check quota:** `aws service-quotas get-service-quota --service-code textract --quota-code L-D4F7CA1B --region us-east-1`
4. **If quota = 0:** Request increase via CLI or contact AWS Support
5. **Monitor:** Use API endpoint for ongoing health checks

---

## 📞 Still Stuck?

The troubleshooting dialog now has a complete AWS Support message template with your account details pre-filled. Just:

1. Run diagnostics in UI
2. Copy support template
3. Open AWS Support case
4. Paste template
5. Wait 1-4 hours for response

**Expected response time: Usually < 2 hours for billing/activation issues**
