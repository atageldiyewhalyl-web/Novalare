/**
 * AWS Account Diagnostic Script
 * Run this to check why Textract isn't working - ENHANCED VERSION
 */

import { TextractClient, AnalyzeDocumentCommand } from "npm:@aws-sdk/client-textract";
import { STSClient, GetCallerIdentityCommand } from "npm:@aws-sdk/client-sts";
import { IAMClient, GetUserCommand, ListAttachedUserPoliciesCommand } from "npm:@aws-sdk/client-iam";

export async function runAWSDiagnostics() {
  console.log('🔍 AWS ACCOUNT DIAGNOSTICS - ENHANCED VERSION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const region = Deno.env.get('AWS_REGION') || 'us-east-1';
  
  // CHECK 1: Credentials present?
  console.log('CHECK 1: Credentials');
  console.log('✅ AWS_ACCESS_KEY_ID:', accessKeyId ? `${accessKeyId.substring(0, 16)}...` : '❌ MISSING');
  console.log('✅ AWS_SECRET_ACCESS_KEY:', secretAccessKey ? `${secretAccessKey.substring(0, 8)}... (${secretAccessKey.length} chars)` : '❌ MISSING');
  console.log('✅ AWS_REGION:', region);
  console.log();
  
  if (!accessKeyId || !secretAccessKey) {
    console.error('❌ FATAL: AWS credentials not set in environment variables');
    return { success: false, error: 'MISSING_CREDENTIALS', details: 'AWS credentials not found in environment' };
  }
  
  const credentials = {
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
  };
  
  // CHECK 2: Who am I? (verify credentials work)
  console.log('CHECK 2: Identity Verification (STS GetCallerIdentity)');
  let accountId = '';
  let userArn = '';
  try {
    const stsClient = new STSClient({ region, credentials });
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    
    accountId = identity.Account || '';
    userArn = identity.Arn || '';
    
    console.log('✅ Credentials are VALID!');
    console.log('   Account ID:', accountId);
    console.log('   User ARN:', userArn);
    console.log('   User ID:', identity.UserId);
    console.log();
  } catch (error: any) {
    console.error('❌ FAILED to verify identity!');
    console.error('   Error:', error.message);
    console.error('   This means your AWS credentials are INVALID or EXPIRED');
    console.error();
    return { success: false, error: 'INVALID_CREDENTIALS', details: error.message };
  }
  
  // CHECK 3: IAM User Permissions (if using IAM user)
  if (userArn.includes(':user/')) {
    console.log('CHECK 3: IAM User Permissions');
    try {
      const iamClient = new IAMClient({ region, credentials });
      const userName = userArn.split('/').pop() || '';
      
      // Get user info
      const userInfo = await iamClient.send(new GetUserCommand({ UserName: userName }));
      console.log('✅ IAM User found:', userName);
      console.log('   Created:', userInfo.User?.CreateDate);
      
      // Get attached policies
      const policies = await iamClient.send(new ListAttachedUserPoliciesCommand({ UserName: userName }));
      console.log('   Attached Policies:');
      if (policies.AttachedPolicies && policies.AttachedPolicies.length > 0) {
        policies.AttachedPolicies.forEach(policy => {
          console.log(`     - ${policy.PolicyName}`);
          if (policy.PolicyName?.includes('Textract') || policy.PolicyName?.includes('FullAccess')) {
            console.log('       ✅ This policy may grant Textract access');
          }
        });
      } else {
        console.log('     ⚠️ No attached policies found - user may only have inline policies or group policies');
      }
      console.log();
    } catch (error: any) {
      console.warn('⚠️ Could not check IAM permissions (this is OK if using root credentials)');
      console.warn('   Error:', error.message);
      console.log();
    }
  }
  
  // CHECK 4: Try Textract with a tiny dummy PDF
  console.log('CHECK 4: Textract API Test');
  console.log('Testing with minimal 1-page dummy PDF...');
  
  try {
    const textractClient = new TextractClient({ region, credentials });
    
    // Minimal valid PDF (just a blank page - smallest possible)
    const minimalPDF = Uint8Array.from(atob(
      'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0NT4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNzIgNzIwIFRkCihUZXN0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9Db3VudCAxL0tpZHNbMyAwIFJdPj4KZW5kb2JqCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjUgMCBvYmoKPDwvQmFzZUZvbnQvSGVsdmV0aWNhL1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZgowMDAwMDAwMjcwIDAwMDAwIG4KMDAwMDAwMDIxOSAwMDAwMCBuCjAwMDAwMDAwMTUgMDAwMDAgbgowMDAwMDAwMTAxIDAwMDAwIG4KMDAwMDAwMDMxOSAwMDAwMCBuCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzkyCiUlRU9G'
    ), c => c.charCodeAt(0));
    
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: minimalPDF,
      },
      FeatureTypes: ['TABLES'],
    });
    
    const response = await textractClient.send(command);
    
    console.log('✅ TEXTRACT WORKS! API call successful!');
    console.log(`   Returned ${response.Blocks?.length || 0} blocks`);
    console.log(`   Request ID: ${response.$metadata.requestId}`);
    console.log();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 SUCCESS! Your AWS Textract is fully activated and working!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log();
    console.log('Next steps:');
    console.log('1. Try uploading a real bank statement PDF');
    console.log('2. If that fails, the issue is with the PDF format, not AWS');
    console.log();
    
    return { 
      success: true, 
      accountId, 
      userArn, 
      region,
      message: 'Textract is fully activated and working!' 
    };
    
  } catch (error: any) {
    console.error('❌ TEXTRACT FAILED!');
    console.error();
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Status Code:', error.$metadata?.httpStatusCode);
    console.error('Request ID:', error.$metadata?.requestId);
    console.error();
    
    if (error.name === 'SubscriptionRequiredException') {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🚨 ROOT CAUSE: SubscriptionRequiredException');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error();
      console.error('⚠️ YOU SAID: "I already added my payment information"');
      console.error();
      console.error('This error means AWS STILL doesn\'t see Textract as activated.');
      console.error('Even with payment method, here are the COMMON REASONS:');
      console.error();
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('REASON 1: Account Verification Incomplete ⚠️ MOST COMMON');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('AWS needs FULL account verification beyond payment:');
      console.error('1. Email verified? (check your inbox for AWS verification email)');
      console.error('2. Phone verified? (AWS may have sent you a verification code)');
      console.error('3. Identity verified? (some accounts require ID verification)');
      console.error();
      console.error('→ CHECK NOW: https://console.aws.amazon.com/billing/home#/account');
      console.error('  Look for yellow/red warning banners at the top');
      console.error();
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('REASON 2: Account Too New (Activation Delay)');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('New AWS accounts can take 12-48 hours to activate premium services');
      console.error('even AFTER adding payment method.');
      console.error();
      console.error('When did you create this account?');
      console.error('- Less than 24 hours ago? → WAIT 24 hours');
      console.error('- Less than 48 hours ago? → WAIT or contact support');
      console.error('- More than 48 hours ago? → Contact support (something is wrong)');
      console.error();
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('REASON 3: Payment Method Not Verified');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Adding payment ≠ payment verified');
      console.error();
      console.error('Check if your payment method shows "Verified":');
      console.error('→ https://console.aws.amazon.com/billing/home#/paymentmethods');
      console.error();
      console.error('Your bank may have:');
      console.error('- Blocked the $1 verification charge from AWS');
      console.error('- Required 3D Secure authentication you didn\'t complete');
      console.error('- Declined the card due to international transaction rules');
      console.error();
      console.error('Try:');
      console.error('1. Remove and re-add your payment method');
      console.error('2. Use a different card');
      console.error('3. Check with your bank if they blocked AWS charges');
      console.error();
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('REASON 4: Service Quota Set to Zero');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('New/unverified accounts may have Textract quota = 0');
      console.error();
      console.error('→ CHECK: https://console.aws.amazon.com/servicequotas/home/services/textract/quotas');
      console.error('  Look for "AnalyzeDocument transactions per second"');
      console.error('  Should be > 0 (default is usually 1 or 5)');
      console.error();
      console.error('If it shows 0:');
      console.error('- Request quota increase (may take 1-2 days)');
      console.error('- OR contact AWS Support for instant increase');
      console.error();
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('REASON 5: Account in Limited/Suspended State');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Check account health:');
      console.error('→ https://console.aws.amazon.com/billing/home');
      console.error('  Look for alerts, warnings, or "Limited" status');
      console.error();
      console.error('Common causes:');
      console.error('- Previous unpaid invoices');
      console.error('- Suspicious activity flagged');
      console.error('- Billing address mismatch');
      console.error();
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🎯 IMMEDIATE ACTION REQUIRED:');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error();
      console.error('STEP 1: Check account verification status');
      console.error('→ https://console.aws.amazon.com/billing/home#/account');
      console.error('  Complete ANY pending verifications (email, phone, identity)');
      console.error();
      console.error('STEP 2: Verify payment method is "Verified"');
      console.error('→ https://console.aws.amazon.com/billing/home#/paymentmethods');
      console.error('  Try removing and re-adding if status is unclear');
      console.error();
      console.error('STEP 3: Contact AWS Support (FASTEST FIX)');
      console.error('→ https://console.aws.amazon.com/support/home');
      console.error('  Click "Create case" → "Account and billing" (FREE)');
      console.error();
      console.error('Subject: "Textract SubscriptionRequiredException with valid payment method"');
      console.error();
      console.error('Message template:');
      console.error('---');
      console.error(`Account ID: ${accountId}`);
      console.error(`User ARN: ${userArn}`);
      console.error(`Region: ${region}`);
      console.error('');
      console.error('I am getting SubscriptionRequiredException when calling Textract API,');
      console.error('even though I have added a valid payment method to my account.');
      console.error('');
      console.error('I have verified:');
      console.error('- Payment method is added and shows as verified');
      console.error('- IAM user has AmazonTextractFullAccess policy');
      console.error('- Account email and phone are verified');
      console.error('');
      console.error('Please activate Textract service on my account immediately.');
      console.error('---');
      console.error();
      console.error('⏰ Expected response time: 1-4 hours (usually faster)');
      console.error();
      
      return {
        success: false,
        error: 'SUBSCRIPTION_REQUIRED',
        accountId,
        userArn,
        region,
        details: 'Textract not activated - see detailed troubleshooting above',
        troubleshooting: {
          accountVerification: 'https://console.aws.amazon.com/billing/home#/account',
          paymentMethods: 'https://console.aws.amazon.com/billing/home#/paymentmethods',
          serviceQuotas: 'https://console.aws.amazon.com/servicequotas/home/services/textract/quotas',
          support: 'https://console.aws.amazon.com/support/home'
        }
      };
      
    } else if (error.name === 'AccessDeniedException') {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🚨 ROOT CAUSE: Access Denied');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error();
      console.error('Your IAM user lacks Textract permissions.');
      console.error();
      console.error('FIXES:');
      console.error('1. Add "AmazonTextractFullAccess" policy to user "novalare_textract_user"');
      console.error('   → https://console.aws.amazon.com/iam/home#/users/novalare_textract_user');
      console.error();
      console.error('2. Check for DENY policies that might block Textract');
      console.error();
      console.error('3. Try using ROOT credentials temporarily (NOT recommended for production)');
      console.error();
      
      return {
        success: false,
        error: 'ACCESS_DENIED',
        accountId,
        userArn,
        region,
        details: error.message
      };
      
    } else {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🚨 UNEXPECTED ERROR');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error();
      
      return {
        success: false,
        error: 'UNEXPECTED_ERROR',
        accountId,
        userArn,
        region,
        details: error.message,
        fullError: JSON.stringify(error, null, 2)
      };
    }
  }
  
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Diagnostics complete.');
}