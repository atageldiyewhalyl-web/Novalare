# AWS CLI & Boto3 Diagnostics for Textract Activation

## 🎯 Purpose
Use these AWS CLI commands and boto3 scripts to diagnose and potentially fix Textract subscription issues.

---

## Prerequisites

### Install AWS CLI
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download and run: https://awscli.amazonaws.com/AWSCLIV2.msi
```

### Configure AWS CLI
```bash
# Configure with your credentials
aws configure

# You'll be prompted for:
# AWS Access Key ID: [YOUR_ACCESS_KEY_ID]
# AWS Secret Access Key: [YOUR_SECRET_ACCESS_KEY]
# Default region name: us-east-1
# Default output format: json
```

---

## 🔍 Diagnostic Commands

### 1. Verify Your Identity
```bash
# Who am I? Verify credentials work
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "AIDAI...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/novalare_textract_user"
# }
```

### 2. Check IAM User Permissions
```bash
# List your attached policies
aws iam list-attached-user-policies --user-name novalare_textract_user

# List all policies (attached + inline)
aws iam list-user-policies --user-name novalare_textract_user

# Get specific policy details
aws iam get-policy --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess
```

### 3. Check Service Quotas (CRITICAL!)
```bash
# List ALL Textract service quotas
aws service-quotas list-service-quotas \
  --service-code textract \
  --region us-east-1

# Check specific quota: AnalyzeDocument transactions per second
aws service-quotas get-service-quota \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --region us-east-1

# Expected output if activated:
# {
#     "Quota": {
#         "QuotaName": "AnalyzeDocument transactions per second",
#         "Value": 1.0,  <-- Should be > 0
#         "Unit": "None"
#     }
# }

# If Value is 0.0, Textract is NOT activated!
```

### 4. Request Quota Increase (if quota = 0)
```bash
# Request increase from 0 to 1 TPS
aws service-quotas request-service-quota-increase \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --desired-value 1.0 \
  --region us-east-1

# Check quota request status
aws service-quotas list-requested-service-quota-change-history-by-quota \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --region us-east-1
```

### 5. Test Textract Directly
```bash
# Create a minimal test PDF
echo "Test" > test.txt
# (You'll need a real PDF file for this test)

# Try to analyze a document
aws textract analyze-document \
  --document '{"S3Object":{"Bucket":"YOUR-BUCKET","Name":"test.pdf"}}' \
  --feature-types '["TABLES"]' \
  --region us-east-1

# OR with local file (requires base64 encoding)
aws textract analyze-document \
  --document fileb://test.pdf \
  --feature-types TABLES \
  --region us-east-1
```

### 6. Check Account Verification Status
```bash
# This doesn't have a direct CLI command, but you can check:
aws account get-contact-information

# Check if account is in good standing
aws organizations describe-account --account-id YOUR_ACCOUNT_ID
# (Only works if you have Organizations enabled)
```

### 7. Check Payment Methods (Billing)
```bash
# Note: Billing requires root credentials or specific billing permissions
# Check account status
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-12-24 \
  --granularity MONTHLY \
  --metrics BlendedCost

# This will fail if billing isn't accessible, confirming permission issues
```

---

## 🐍 Enhanced boto3 Diagnostics (Python)

### Check Service Quotas with boto3
Create this file as `check_textract_quotas.py`:

```python
import boto3
import os
from botocore.exceptions import ClientError

def check_textract_quotas():
    """Check if Textract is activated by examining service quotas"""
    
    # Get credentials from environment or AWS config
    region = os.getenv('AWS_REGION', 'us-east-1')
    
    print('🔍 CHECKING AWS TEXTRACT QUOTAS WITH BOTO3')
    print('=' * 60)
    print()
    
    # Step 1: Verify credentials
    print('STEP 1: Verifying AWS credentials...')
    try:
        sts = boto3.client('sts', region_name=region)
        identity = sts.get_caller_identity()
        print(f'✅ Authenticated as: {identity["Arn"]}')
        print(f'   Account ID: {identity["Account"]}')
        print()
    except ClientError as e:
        print(f'❌ Credential verification failed: {e}')
        return
    
    # Step 2: Check Service Quotas
    print('STEP 2: Checking Textract service quotas...')
    try:
        quotas = boto3.client('service-quotas', region_name=region)
        
        # Get the specific quota for AnalyzeDocument
        quota_code = 'L-D4F7CA1B'  # AnalyzeDocument transactions per second
        
        response = quotas.get_service_quota(
            ServiceCode='textract',
            QuotaCode=quota_code
        )
        
        quota_value = response['Quota']['Value']
        quota_name = response['Quota']['QuotaName']
        
        print(f'Quota: {quota_name}')
        print(f'Current Value: {quota_value}')
        print()
        
        if quota_value == 0.0:
            print('❌ TEXTRACT IS NOT ACTIVATED!')
            print('   Quota is set to 0 - service cannot be used')
            print()
            print('ACTION REQUIRED:')
            print('1. Request quota increase to at least 1.0')
            print('2. Contact AWS Support for immediate activation')
            print()
            return False
        else:
            print('✅ TEXTRACT IS ACTIVATED!')
            print(f'   You can process up to {quota_value} requests per second')
            print()
            return True
            
    except ClientError as e:
        error_code = e.response['Error']['Code']
        
        if error_code == 'NoSuchResourceException':
            print('❌ Cannot find Textract quota - service may not be available in this region')
            print(f'   Current region: {region}')
            print('   Try: us-east-1, us-west-2, or eu-west-1')
        else:
            print(f'❌ Error checking quotas: {e}')
        print()
        return False
    
    # Step 3: Try to make a test Textract call
    print('STEP 3: Testing Textract API with dummy document...')
    try:
        textract = boto3.client('textract', region_name=region)
        
        # Minimal valid PDF (base64 decoded)
        minimal_pdf = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>\nendobj\n4 0 obj\n<</Length 45>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test) Tj\nET\nendstream\nendobj\n2 0 obj\n<</Type/Pages/Count 1/Kids[3 0 R]>>\nendobj\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n5 0 obj\n<</BaseFont/Helvetica/Type/Font/Subtype/Type1>>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000270 00000 n\n0000000219 00000 n\n0000000015 00000 n\n0000000101 00000 n\n0000000319 00000 n\ntrailer\n<</Size 6/Root 1 0 R>>\nstartxref\n392\n%%EOF'
        
        response = textract.analyze_document(
            Document={'Bytes': minimal_pdf},
            FeatureTypes=['TABLES']
        )
        
        print('✅ TEXTRACT API CALL SUCCESSFUL!')
        print(f'   Returned {len(response.get("Blocks", []))} blocks')
        print(f'   Request ID: {response["ResponseMetadata"]["RequestId"]}')
        print()
        print('🎉 YOUR TEXTRACT IS FULLY WORKING!')
        print()
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        
        print(f'❌ TEXTRACT API FAILED!')
        print(f'   Error Code: {error_code}')
        print(f'   Error Message: {error_msg}')
        print()
        
        if error_code == 'ProvisionedThroughputExceededException':
            print('⚠️ You hit the rate limit - but this means Textract IS activated!')
            print('   Just wait a second and try again')
            return True
            
        elif error_code == 'InvalidParameterException':
            print('⚠️ Parameter issue - but service is accessible')
            print('   The activation itself is working')
            return True
            
        else:
            print('❌ Textract is not working')
            print()
            return False

if __name__ == '__main__':
    check_textract_quotas()
```

### Run the boto3 diagnostic script:
```bash
# Set your credentials
export AWS_ACCESS_KEY_ID="your_key_id"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
export AWS_REGION="us-east-1"

# Run the script
python check_textract_quotas.py
```

---

## 🚀 Quick Activation Commands

### If quota is 0, request increase:
```bash
# Request quota increase (usually approved within minutes to 24 hours)
aws service-quotas request-service-quota-increase \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --desired-value 1.0 \
  --region us-east-1

# Save the request ID from the output
# Then check status:
aws service-quotas get-requested-service-quota-change \
  --request-id REQUEST_ID_FROM_ABOVE
```

### If you get "SubscriptionRequiredException":
This is NOT fixable via CLI - you need AWS Console or Support:

1. **Check account verification**: https://console.aws.amazon.com/billing/home#/account
2. **Verify payment method**: https://console.aws.amazon.com/billing/home#/paymentmethods  
3. **Contact Support** (fastest): https://console.aws.amazon.com/support/home

---

## 🎯 Most Common Issues and CLI Checks

### Issue 1: "I added payment but still get SubscriptionRequiredException"
```bash
# This cannot be checked via CLI
# You MUST use AWS Console to:
# - Verify email/phone
# - Check payment method shows "Verified"
# - Look for account warnings
```

### Issue 2: "Service quota is 0"
```bash
# Check current quota
aws service-quotas get-service-quota \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --region us-east-1

# Request increase
aws service-quotas request-service-quota-increase \
  --service-code textract \
  --quota-code L-D4F7CA1B \
  --desired-value 1.0 \
  --region us-east-1
```

### Issue 3: "IAM permissions denied"
```bash
# Check your policies
aws iam list-attached-user-policies --user-name YOUR_USERNAME

# Attach Textract policy (requires admin rights)
aws iam attach-user-policy \
  --user-name YOUR_USERNAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess
```

### Issue 4: "Wrong region"
```bash
# Textract is available in specific regions only
# Test different regions:
for region in us-east-1 us-east-2 us-west-2 eu-west-1; do
  echo "Testing $region..."
  aws textract analyze-document \
    --document fileb://test.pdf \
    --feature-types TABLES \
    --region $region 2>&1 | head -5
done
```

---

## 📊 Integration with Python Extraction Service

Add this to your Python extraction service (`/python-extraction-server/app.py`):

```python
@app.route('/api/check-textract-status', methods=['GET'])
def check_textract_status():
    """Check if AWS Textract is activated and return diagnostic info"""
    import boto3
    from botocore.exceptions import ClientError
    
    region = os.getenv('AWS_REGION', 'us-east-1')
    
    result = {
        'credentials_valid': False,
        'quotas_activated': False,
        'api_working': False,
        'details': {}
    }
    
    # Check 1: Verify credentials
    try:
        sts = boto3.client('sts', region_name=region)
        identity = sts.get_caller_identity()
        result['credentials_valid'] = True
        result['details']['account_id'] = identity['Account']
        result['details']['user_arn'] = identity['Arn']
    except ClientError as e:
        result['details']['credential_error'] = str(e)
        return jsonify(result), 200
    
    # Check 2: Check quotas
    try:
        quotas = boto3.client('service-quotas', region_name=region)
        quota_response = quotas.get_service_quota(
            ServiceCode='textract',
            QuotaCode='L-D4F7CA1B'  # AnalyzeDocument TPS
        )
        quota_value = quota_response['Quota']['Value']
        result['details']['quota_value'] = quota_value
        result['quotas_activated'] = quota_value > 0
    except ClientError as e:
        result['details']['quota_error'] = str(e)
    
    # Check 3: Test API
    if result['quotas_activated']:
        try:
            textract = boto3.client('textract', region_name=region)
            # Use minimal PDF test
            minimal_pdf = b'...'  # Your minimal PDF bytes
            response = textract.analyze_document(
                Document={'Bytes': minimal_pdf},
                FeatureTypes=['TABLES']
            )
            result['api_working'] = True
            result['details']['test_blocks'] = len(response.get('Blocks', []))
        except ClientError as e:
            result['details']['api_error'] = str(e)
    
    return jsonify(result), 200
```

---

## 💡 Pro Tips

1. **Always check quotas first**: Most "SubscriptionRequired" errors are actually quota = 0
2. **Use `--region` flag**: Textract isn't available in all regions
3. **Check CloudTrail**: See your actual API calls: `aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=AnalyzeDocument`
4. **boto3 is more reliable than CLI**: For automation, use boto3 in Python
5. **Cache credential checks**: Don't check STS on every request (rate limits!)

---

## 🆘 If Nothing Works

**Contact AWS Support (it's FREE for billing/account issues):**

```bash
# Get your account info first
aws sts get-caller-identity

# Then create support case at:
# https://console.aws.amazon.com/support/home
#
# Category: "Account and billing"
# Subject: "Cannot activate Textract despite valid payment method"
# Include: Account ID, User ARN, Region, Error messages
```

**Expected response time: 1-4 hours (usually < 2 hours)**
