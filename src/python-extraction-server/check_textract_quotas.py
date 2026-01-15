#!/usr/bin/env python3
"""
AWS Textract Quota & Activation Checker
Uses boto3 to diagnose Textract activation issues
"""

import boto3
import os
import sys
from botocore.exceptions import ClientError, NoCredentialsError

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
        account_id = identity["Account"]
        user_arn = identity["Arn"]
        print(f'✅ Authenticated as: {user_arn}')
        print(f'   Account ID: {account_id}')
        print()
    except NoCredentialsError:
        print('❌ No AWS credentials found!')
        print('   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables')
        print('   Or configure: aws configure')
        return False
    except ClientError as e:
        print(f'❌ Credential verification failed: {e}')
        return False
    
    # Step 2: Check Service Quotas
    print('STEP 2: Checking Textract service quotas...')
    print('-' * 60)
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
        
        print(f'📊 Quota: {quota_name}')
        print(f'   Current Value: {quota_value} transactions/second')
        print()
        
        if quota_value == 0.0:
            print('❌ TEXTRACT IS NOT ACTIVATED!')
            print('   Quota is set to 0 - service cannot be used')
            print()
            print('🔧 ACTION REQUIRED:')
            print('1. Request quota increase via AWS CLI:')
            print()
            print('   aws service-quotas request-service-quota-increase \\')
            print('     --service-code textract \\')
            print(f'     --quota-code {quota_code} \\')
            print('     --desired-value 1.0 \\')
            print(f'     --region {region}')
            print()
            print('2. OR contact AWS Support for immediate activation')
            print('   → https://console.aws.amazon.com/support/home')
            print()
            return False
        else:
            print('✅ QUOTA IS ACTIVATED!')
            print(f'   You can process up to {quota_value} requests per second')
            print()
            
    except ClientError as e:
        error_code = e.response['Error']['Code']
        
        if error_code == 'NoSuchResourceException':
            print('❌ Cannot find Textract quota - service may not be available in this region')
            print(f'   Current region: {region}')
            print()
            print('💡 Try these regions: us-east-1, us-east-2, us-west-2, eu-west-1')
            print()
        elif error_code == 'AccessDeniedException':
            print('❌ Access denied when checking quotas')
            print('   Your IAM user may need ServiceQuotas permissions')
            print()
            print('   Add this policy: ServiceQuotasReadOnlyAccess')
            print()
        else:
            print(f'❌ Error checking quotas: {e}')
            print()
        return False
    
    # Step 3: Try to make a test Textract call
    print('STEP 3: Testing Textract API with dummy document...')
    print('-' * 60)
    try:
        textract = boto3.client('textract', region_name=region)
        
        # Minimal valid PDF (smallest possible valid PDF)
        minimal_pdf = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>\nendobj\n4 0 obj\n<</Length 45>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test) Tj\nET\nendstream\nendobj\n2 0 obj\n<</Type/Pages/Count 1/Kids[3 0 R]>>\nendobj\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n5 0 obj\n<</BaseFont/Helvetica/Type/Font/Subtype/Type1>>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000270 00000 n\n0000000219 00000 n\n0000000015 00000 n\n0000000101 00000 n\n0000000319 00000 n\ntrailer\n<</Size 6/Root 1 0 R>>\nstartxref\n392\n%%EOF'
        
        response = textract.analyze_document(
            Document={'Bytes': minimal_pdf},
            FeatureTypes=['TABLES']
        )
        
        print('✅ TEXTRACT API CALL SUCCESSFUL!')
        print(f'   Returned {len(response.get("Blocks", []))} blocks')
        print(f'   Request ID: {response["ResponseMetadata"]["RequestId"]}')
        print()
        print('=' * 60)
        print('🎉 YOUR TEXTRACT IS FULLY WORKING!')
        print('=' * 60)
        print()
        print('Next steps:')
        print('1. Try uploading a real bank statement PDF')
        print('2. If that fails, the issue is with the PDF format, not AWS')
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
            print()
            return True
            
        elif error_code == 'InvalidParameterException':
            print('⚠️ Parameter issue - but service is accessible')
            print('   The activation itself is working')
            print()
            return True
            
        elif error_code == 'SubscriptionRequiredException':
            print('=' * 60)
            print('🚨 SUBSCRIPTION REQUIRED ERROR')
            print('=' * 60)
            print()
            print('This error means AWS does not see Textract as activated.')
            print()
            print('🔍 MOST COMMON CAUSES (even with payment added):')
            print()
            print('1️⃣  ACCOUNT VERIFICATION INCOMPLETE')
            print('   → Check: https://console.aws.amazon.com/billing/home#/account')
            print('   → Verify email, phone, and identity')
            print()
            print('2️⃣  ACCOUNT TOO NEW (12-48 hour activation delay)')
            print('   → Wait 24-48 hours after adding payment')
            print()
            print('3️⃣  PAYMENT METHOD NOT VERIFIED BY BANK')
            print('   → Check: https://console.aws.amazon.com/billing/home#/paymentmethods')
            print('   → Try removing and re-adding card')
            print()
            print('4️⃣  SERVICE QUOTA SET TO ZERO')
            print('   → (We already checked this - your quota seems OK)')
            print()
            print('5️⃣  ACCOUNT LIMITED/SUSPENDED')
            print('   → Check: https://console.aws.amazon.com/billing/home')
            print('   → Look for warnings or alerts')
            print()
            print('🎯 FASTEST FIX: Contact AWS Support (FREE)')
            print('   → https://console.aws.amazon.com/support/home')
            print('   → Category: "Account and billing"')
            print('   → Subject: "Textract SubscriptionRequiredException with valid payment"')
            print()
            print('   Include in your message:')
            print(f'   - Account ID: {account_id}')
            print(f'   - User ARN: {user_arn}')
            print(f'   - Region: {region}')
            print('   - "Payment method added and verified, but still getting SubscriptionRequiredException"')
            print()
            print('   Expected response: 1-4 hours')
            print()
            
        elif error_code == 'AccessDeniedException':
            print('=' * 60)
            print('🚨 ACCESS DENIED ERROR')
            print('=' * 60)
            print()
            print('Your IAM user lacks Textract permissions.')
            print()
            print('🔧 FIX: Add AmazonTextractFullAccess policy')
            print()
            print('Via AWS CLI:')
            print(f'   aws iam attach-user-policy \\')
            print(f'     --user-name YOUR_USERNAME \\')
            print(f'     --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess')
            print()
            print('Via AWS Console:')
            print('   → https://console.aws.amazon.com/iam/home#/users')
            print('   → Select your user')
            print('   → Permissions → Add permissions → Attach policies')
            print('   → Search "Textract" → Select AmazonTextractFullAccess')
            print()
            
        else:
            print('=' * 60)
            print('🚨 UNEXPECTED ERROR')
            print('=' * 60)
            print()
            print('Full error details:')
            print(e)
            print()
        
        return False

def check_all_textract_quotas():
    """List ALL Textract quotas to see full activation status"""
    
    region = os.getenv('AWS_REGION', 'us-east-1')
    
    print('📊 LISTING ALL TEXTRACT SERVICE QUOTAS')
    print('=' * 60)
    print()
    
    try:
        quotas = boto3.client('service-quotas', region_name=region)
        
        # List all Textract quotas
        paginator = quotas.get_paginator('list_service_quotas')
        page_iterator = paginator.paginate(ServiceCode='textract')
        
        quota_count = 0
        for page in page_iterator:
            for quota in page['Quotas']:
                quota_count += 1
                print(f'{quota_count}. {quota["QuotaName"]}')
                print(f'   Quota Code: {quota["QuotaCode"]}')
                print(f'   Current Value: {quota["Value"]}')
                print(f'   Unit: {quota.get("Unit", "None")}')
                print()
        
        if quota_count == 0:
            print('❌ No Textract quotas found!')
            print('   This likely means Textract is not available in this region')
            print(f'   Current region: {region}')
            print()
            
    except ClientError as e:
        print(f'❌ Error listing quotas: {e}')
        print()

if __name__ == '__main__':
    # Check if credentials are set
    if not os.getenv('AWS_ACCESS_KEY_ID') and not os.path.exists(os.path.expanduser('~/.aws/credentials')):
        print('❌ No AWS credentials found!')
        print()
        print('Set environment variables:')
        print('  export AWS_ACCESS_KEY_ID="your_key_id"')
        print('  export AWS_SECRET_ACCESS_KEY="your_secret_key"')
        print('  export AWS_REGION="us-east-1"')
        print()
        print('Or configure AWS CLI:')
        print('  aws configure')
        print()
        sys.exit(1)
    
    # Run main diagnostic
    success = check_textract_quotas()
    
    # Optionally list all quotas
    if len(sys.argv) > 1 and sys.argv[1] == '--all':
        print()
        check_all_textract_quotas()
    
    sys.exit(0 if success else 1)
