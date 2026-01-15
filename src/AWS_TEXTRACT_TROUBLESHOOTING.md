# AWS Textract Troubleshooting - "I Already Have Payment Info!"

## 🚨 SITUATION
You're getting `SubscriptionRequiredException` error even though you've already added your payment information to AWS.

**This is VERY COMMON and usually NOT a payment problem - it's a verification/activation problem.**

---

## 🎯 QUICK DIAGNOSIS

**First, run the diagnostics tool:**
1. In Novalare, select "AWS Textract + GPT-4 Mini" extraction method
2. Click the **"🔍 Debug AWS"** button
3. Open your browser console (F12) or check Supabase Logs
4. Read the detailed output - it will tell you EXACTLY what's wrong

---

## 💡 MOST COMMON REASONS (After Payment Added)

### REASON 1: Account Verification Incomplete ⚠️ **MOST COMMON**

**THE PROBLEM:**
AWS requires FULL account verification beyond just payment:
- ✅ Email verified?
- ✅ Phone verified?
- ✅ Identity verified? (sometimes required for new accounts)

**HOW TO CHECK:**
1. Go to: https://console.aws.amazon.com/billing/home#/account
2. Look for **yellow or red warning banners** at the top
3. Check the "Contact Information" and "Security Challenge Questions" sections

**WHAT TO LOOK FOR:**
- "Email not verified" → Check your inbox for AWS verification email
- "Phone not verified" → They may have sent you a verification code via SMS
- "Additional verification required" → May need to upload ID or wait for AWS review

**FIX:**
Complete ALL pending verifications shown on the account page.

---

### REASON 2: Payment Method Not Actually Verified

**THE PROBLEM:**
Adding a payment method ≠ Payment method verified

Your bank might have:
- Blocked the $1 verification charge from AWS
- Required 3D Secure authentication you didn't complete
- Declined due to international transaction rules
- Flagged it as suspicious

**HOW TO CHECK:**
1. Go to: https://console.aws.amazon.com/billing/home#/paymentmethods
2. Check if your card shows status "**Verified**" or "**Active**"
3. Look for any warning icons or error messages

**FIX:**
1. **Remove** the payment method
2. **Re-add** the same card (or try a different card)
3. Watch for popup notifications from your bank
4. Check your bank's mobile app for approval requests
5. If using a corporate card, check with your company's finance team

---

### REASON 3: Account Too New (Activation Delay)

**THE PROBLEM:**
New AWS accounts take 12-48 hours to activate premium services, even with valid payment.

**WHEN DID YOU CREATE YOUR AWS ACCOUNT?**
- ⏰ Less than 24 hours ago? → **WAIT 24 hours**
- ⏰ 24-48 hours ago? → **WAIT or contact support**
- ⏰ More than 48 hours ago? → **Contact support** (something is wrong)

**WHY THIS HAPPENS:**
AWS runs automated fraud checks on new accounts. Premium services like Textract are locked until these checks complete.

**FIX:**
- **If account < 24 hours old:** Use alternative extraction method temporarily (Python API or Hybrid)
- **If account > 24 hours old:** Contact AWS Support (see below)

---

### REASON 4: Service Quota Set to Zero

**THE PROBLEM:**
Your account's Textract quota might be set to 0 (especially for new/unverified accounts).

**HOW TO CHECK:**
1. Go to: https://console.aws.amazon.com/servicequotas/home/services/textract/quotas
2. Find "**AnalyzeDocument transactions per second**"
3. Should show **> 0** (default is usually 1 or 5)

**IF IT SHOWS 0:**
- Request a quota increase (may take 1-2 business days)
- OR contact AWS Support for instant increase (see below)

---

### REASON 5: Account in Limited/Suspended State

**THE PROBLEM:**
Your AWS account may be in a limited state due to:
- Previous unpaid invoices (even from months ago)
- Suspicious activity detected
- Billing address mismatch with credit card
- Incomplete identity verification

**HOW TO CHECK:**
1. Go to: https://console.aws.amazon.com/billing/home
2. Look for **alerts, warnings, or "Limited" status** at the top
3. Check the "Alerts & Notifications" section

**FIX:**
- Resolve any outstanding alerts
- Update billing address to match your card
- Contact AWS Support to lift limitations

---

## 🚀 FASTEST SOLUTION: Contact AWS Support

**THIS IS THE FASTEST WAY TO FIX IT** - usually resolved in 1-4 hours.

### How to Contact AWS Support:

1. **Go to:** https://console.aws.amazon.com/support/home

2. **Click:** "Create case"

3. **Select:** "Account and billing support" (it's **FREE** - no support plan needed)

4. **Subject:** `Textract SubscriptionRequiredException with valid payment method`

5. **Message (copy-paste this template):**
   ```
   Account ID: [Your account ID from diagnostic output]
   User ARN: [Your ARN from diagnostic output]
   Region: us-east-1
   
   I am getting SubscriptionRequiredException when calling the Textract API,
   even though I have added a valid payment method to my account.
   
   I have verified:
   - Payment method is added and shows as "Verified"
   - IAM user has AmazonTextractFullAccess policy attached
   - Account email and phone are verified
   - No warnings or alerts on billing dashboard
   
   Please activate the Textract service on my account immediately.
   
   Error details:
   - API: AnalyzeDocument
   - Feature: TABLES
   - Error: SubscriptionRequiredException
   
   Thank you!
   ```

6. **Click:** "Submit"

**Expected Response Time:**
- Usually 1-4 hours
- Often much faster (30 minutes - 2 hours)
- Support can activate Textract **instantly** once they review your account

---

## ✅ STEP-BY-STEP CHECKLIST

Use this checklist to systematically verify everything:

### ☑️ Step 1: Run Diagnostics
- [ ] Click "🔍 Debug AWS" button in Novalare
- [ ] Read the detailed output in browser console or Supabase logs
- [ ] Note your Account ID and User ARN (you'll need these for support)

### ☑️ Step 2: Verify Account Status
- [ ] Visit https://console.aws.amazon.com/billing/home#/account
- [ ] Check for ANY yellow/red warnings
- [ ] Verify email shows "Verified"
- [ ] Verify phone shows "Verified"
- [ ] Complete any pending verifications

### ☑️ Step 3: Verify Payment Method
- [ ] Visit https://console.aws.amazon.com/billing/home#/paymentmethods
- [ ] Check payment method shows "Verified" or "Active"
- [ ] If unclear, remove and re-add the card
- [ ] Check bank for any blocked charges

### ☑️ Step 4: Check Service Quotas
- [ ] Visit https://console.aws.amazon.com/servicequotas/home/services/textract/quotas
- [ ] Find "AnalyzeDocument transactions per second"
- [ ] Verify it's > 0
- [ ] If 0, request quota increase

### ☑️ Step 5: Check Account Health
- [ ] Visit https://console.aws.amazon.com/billing/home
- [ ] Look for alerts or "Limited" status
- [ ] Check for unpaid invoices
- [ ] Verify billing address matches card

### ☑️ Step 6: Contact AWS Support
- [ ] Create support case (see template above)
- [ ] Include Account ID and User ARN
- [ ] Mention you've verified payment and account
- [ ] Request immediate Textract activation

---

## 🔄 TEMPORARY WORKAROUND

While waiting for AWS to fix this, you can still extract bank statements using alternative methods:

### **Option 1: Python AI Microservice** (Recommended)
- Select "🐍 AI Layout Discovery + Heuristic" in the dropdown
- Requires your Python API deployed on Render
- Similar accuracy to Textract
- No AWS dependencies

### **Option 2: Hybrid AI+Heuristics** (Deprecated but works)
- Select "🚀 Hybrid AI+Heuristics" in the dropdown
- Built into the main app
- Less accurate but works for many bank formats

**These work immediately while you wait for AWS to activate Textract.**

---

## 📊 WHY THIS HAPPENS

AWS Textract is a **premium service** (not in free tier) that requires:
1. Valid payment method ✅ (you have this)
2. Full account verification ❓ (this might be incomplete)
3. Service activation period ⏰ (can take 12-48 hours)
4. Positive account standing ✅ (no unpaid bills or fraud flags)

**The first 1,000 pages/month ARE FREE** - but AWS still requires full account setup before activating the service.

---

## 🎯 BOTTOM LINE

**Most likely causes:**
1. **Account too new** → Wait 24-48 hours OR contact support
2. **Incomplete verification** → Check account page for pending verifications
3. **Payment not verified** → Check with your bank, try removing/re-adding card

**Fastest fix:**
Contact AWS Support - they can activate Textract instantly (1-4 hours response time)

**While you wait:**
Use Python API or Hybrid extraction methods

---

## ❓ Need More Help?

Run the diagnostics tool - it will give you EXACT instructions based on your specific error:

1. Select "AWS Textract + GPT-4 Mini" in extraction method dropdown
2. Click "🔍 Debug AWS" button
3. Check the console output for detailed next steps

The diagnostic tool checks:
- ✅ Credentials validity
- ✅ IAM permissions
- ✅ Account identity
- ✅ Textract API connectivity
- ✅ Error details and recommended fixes
