# AWS CLI Quick Commands - Textract Troubleshooting

## 🚀 Quick Start

### 1. Verify Credentials Work
```bash
aws sts get-caller-identity
```
**Expected output:**
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/novalare_textract_user"
}
```

---

### 2. Check Textract Quota (MOST IMPORTANT!)
```bash
aws service-quotas get-service-quota \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --region us-east-1
```

**What to look for:**
- `"Value": 1.0` or higher = ✅ **ACTIVATED**
- `"Value": 0.0` = ❌ **NOT ACTIVATED** (this is your problem!)

---

### 3. Request Quota Increase (if quota = 0)
```bash
aws service-quotas request-service-quota-increase \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --desired-value 1.0 \
  --region us-east-1
```

**Check request status:**
```bash
aws service-quotas list-requested-service-quota-change-history-by-quota \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --region us-east-1
```

---

### 4. Check IAM Permissions
```bash
# List your policies
aws iam list-attached-user-policies --user-name novalare_textract_user

# Attach Textract policy (if missing)
aws iam attach-user-policy \
  --user-name novalare_textract_user \
  --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess
```

---

## 🐍 Python boto3 Diagnostics

### Run the diagnostic script:
```bash
# From /python-extraction-server directory
cd python-extraction-server

# Set credentials
export AWS_ACCESS_KEY_ID="your_key_id"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
export AWS_REGION="us-east-1"

# Run diagnostic
python check_textract_quotas.py

# Run with full quota listing
python check_textract_quotas.py --all
```

---

## 🌐 API Endpoint Diagnostics

### Call the Python service diagnostic endpoint:
```bash
# If running locally
curl http://localhost:8000/diagnose-aws-textract

# If deployed on Render
curl https://your-app.onrender.com/diagnose-aws-textract
```

**Example response:**
```json
{
  "success": true,
  "credentials_valid": true,
  "quotas_activated": true,
  "api_working": true,
  "details": {
    "account_id": "123456789012",
    "user_arn": "arn:aws:iam::123456789012:user/novalare_textract_user",
    "region": "us-east-1",
    "quota_value": 1.0,
    "test_call": {
      "blocks_returned": 5,
      "request_id": "abc123..."
    }
  },
  "message": "🎉 Textract is fully activated and working!"
}
```

---

## 🎯 Common Issues

### Issue: "SubscriptionRequiredException"
**NOT fixable via CLI alone** - use AWS Console:

1. **Verify account:** https://console.aws.amazon.com/billing/home#/account
2. **Verify payment:** https://console.aws.amazon.com/billing/home#/paymentmethods
3. **Contact support:** https://console.aws.amazon.com/support/home

### Issue: Quota is 0
```bash
# Request increase
aws service-quotas request-service-quota-increase \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --desired-value 1.0 \
  --region us-east-1
```

### Issue: Wrong region
```bash
# Try different regions
for region in us-east-1 us-east-2 us-west-2 eu-west-1; do
  echo "Testing $region..."
  aws service-quotas get-service-quota \
    --service-code textract \
    --quota-code L-D4F7CA1B \
    --region $region 2>&1 | grep -i "value"
done
```

---

## 📊 Summary of All Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **AWS CLI** | Check quotas, credentials, permissions | Quick diagnosis from terminal |
| **boto3 script** | Deep diagnostics with detailed output | When CLI results are unclear |
| **API endpoint** | Remote diagnosis from your app | Integration testing, monitoring |
| **AWS Console** | Visual troubleshooting, support tickets | SubscriptionRequiredException |

---

## 🆘 Still Not Working?

**Contact AWS Support (FREE for billing/account issues):**

```bash
# Get your account info first
aws sts get-caller-identity
```

Then create a support case at: https://console.aws.amazon.com/support/home

**Template:**
```
Category: Account and billing
Subject: Cannot activate Textract despite valid payment method

Account ID: [from get-caller-identity]
User ARN: [from get-caller-identity]
Region: us-east-1

Issue: Getting SubscriptionRequiredException when calling Textract API,
even though I have added a valid payment method to my account.

I have verified:
- Payment method is added and shows as verified
- IAM user has AmazonTextractFullAccess policy
- Account email and phone are verified

Please activate Textract service on my account immediately.
```

**Expected response: 1-4 hours**
