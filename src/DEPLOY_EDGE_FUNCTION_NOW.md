# 🚀 Deploy Supabase Edge Function - URGENT FIX

## ❌ Current Issue
Your app shows: **"Requested function was not found"**

This means the Supabase Edge Function is **not deployed** to your Supabase project.

---

## ✅ Solution: Deploy the Edge Function

### Option 1: Deploy via Supabase CLI (Recommended)

#### Step 1: Install Supabase CLI

**Mac/Linux:**
```bash
brew install supabase/tap/supabase
```

**Windows:**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Or download from: https://github.com/supabase/cli/releases

#### Step 2: Login to Supabase
```bash
supabase login
```

This will open a browser window to authenticate.

#### Step 3: Link Your Project

Find your **Project Reference ID** from your Supabase Dashboard:
- Go to: https://supabase.com/dashboard/project/[your-project]/settings/general
- Copy the "Reference ID" (looks like: `abcdefghijklmnop`)

```bash
supabase link --project-ref YOUR_PROJECT_REF_ID
```

#### Step 4: Deploy the Edge Function

```bash
supabase functions deploy make-server-53c2e113
```

This will deploy the entire `/supabase/functions/server/` directory.

---

### Option 2: Manual Deployment via Supabase Dashboard

If you can't use the CLI, you can manually create the function:

1. **Go to Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"**
3. Name it: `make-server-53c2e113`
4. Copy ALL the code from `/supabase/functions/server/index.tsx`
5. You'll also need to manually create all the route files as separate modules

⚠️ **Warning**: This is very tedious and error-prone. Use CLI method instead.

---

### Option 3: Deploy Using Supabase Management API

If you have access to the Management API, you can deploy programmatically. But this is advanced - stick with Option 1.

---

## 🔍 How to Verify Deployment

After deploying, check if the function is working:

### 1. Test the Health Endpoint

Open this URL in your browser (replace with your project ID):
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/health
```

You should see:
```json
{"status":"ok"}
```

### 2. Check in Supabase Dashboard

- Go to: **Edge Functions** section
- You should see `make-server-53c2e113` listed
- Status should be: **Active** (green)

### 3. View Logs

In the Edge Functions dashboard:
- Click on `make-server-53c2e113`
- Go to **Logs** tab
- You should see startup logs when the function initializes

---

## 📋 Checklist After Deployment

- [ ] Edge function deployed successfully
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] All environment variables are set (you already added QB credentials)
- [ ] App loads without "function not found" errors
- [ ] You can navigate to Settings → Accounting Integrations

---

## 🐛 Common Deployment Errors

### Error: "No such file or directory"
**Fix**: Make sure you're in the project root directory when running `supabase functions deploy`

### Error: "Project not linked"
**Fix**: Run `supabase link --project-ref YOUR_PROJECT_ID` first

### Error: "Invalid credentials"
**Fix**: Run `supabase login` again to re-authenticate

### Error: "Function timeout during deployment"
**Fix**: Your function is too large. This shouldn't happen with our code. Check your internet connection.

---

## 🎯 What Happens After Deployment

Once deployed, the Edge Function will:
1. ✅ Start up and load all route modules
2. ✅ Be accessible at: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/*`
3. ✅ Automatically scale with traffic
4. ✅ Have access to all your Supabase secrets (QB credentials, etc.)
5. ✅ Handle all your API requests (companies, invoices, QB OAuth, etc.)

---

## 🚨 Next Steps

1. **Deploy the function** using one of the methods above
2. **Refresh your app** in the browser
3. **Check that errors are gone**
4. **Try connecting QuickBooks** from Settings → Accounting Integrations

---

## 💡 Need Help?

If deployment fails, check:
- **Supabase Dashboard** → **Edge Functions** → **Logs**
- **Browser Console** for new error messages
- **Network Tab** to see if requests are reaching the function

Let me know the specific error and I'll help troubleshoot!
