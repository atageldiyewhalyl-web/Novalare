# 🚀 Render.com Deployment Guide

## Why Render.com?

✅ **No local environment issues** - Runs in the cloud  
✅ **No proxy problems** - Clean networking  
✅ **Free tier available** - $0/month for starter plan  
✅ **Auto-deployment** - Push to GitHub → auto-deploy  
✅ **Environment variables** - Secure API key storage  

---

## 📋 Prerequisites

1. ✅ GitHub account
2. ✅ Render.com account (free) - https://render.com
3. ✅ OpenAI API key
4. ✅ This repository pushed to GitHub

---

## 🎯 Deployment Steps

### Step 1: Push Code to GitHub

If you haven't already:

```bash
cd novalare-extraction-api

# Initialize git (if not done)
git init

# Add all files
git add .

# Commit
git commit -m "Add Python extraction API with AI enhancements"

# Create GitHub repo (on GitHub.com)
# Then add remote:
git remote add origin https://github.com/YOUR_USERNAME/novalare-extraction-api.git

# Push
git push -u origin main
```

---

### Step 2: Create Render Service

1. **Go to Render.com** → https://render.com
2. **Sign in** (or create account)
3. **Click "New +"** → Select **"Web Service"**

4. **Connect your GitHub repository:**
   - Grant Render access to your GitHub
   - Select repository: `novalare-extraction-api`

5. **Configure the service:**

   | Field | Value |
   |-------|-------|
   | **Name** | `novalare-extraction-api` |
   | **Region** | `Oregon (US West)` |
   | **Branch** | `main` |
   | **Root Directory** | `python-extraction-server` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `python app.py` |
   | **Plan** | `Starter ($0/month)` or `Free` |

6. **Click "Advanced"** and add environment variables:

   | Key | Value |
   |-----|-------|
   | `OPENAI_API_KEY` | `sk-proj-YOUR_KEY_HERE` |
   | `PYTHON_VERSION` | `3.11.0` |
   | `PORT` | `8000` |

7. **Click "Create Web Service"**

---

### Step 3: Wait for Deployment

Render will:
1. ✅ Clone your repository
2. ✅ Install dependencies from `requirements.txt`
3. ✅ Start the server with `python app.py`
4. ✅ Expose it at `https://novalare-extraction-api.onrender.com`

**First deployment takes ~5 minutes**

---

### Step 4: Test the Deployed API

Once deployed, you'll get a URL like:
```
https://novalare-extraction-api.onrender.com
```

**Test health endpoint:**
```bash
curl https://novalare-extraction-api.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00Z"
}
```

**Test AI discovery:**
```bash
curl -X POST https://novalare-extraction-api.onrender.com/discover-layout \
  -F "file=@/path/to/statement.pdf"
```

---

## 🎛️ Environment Variables Setup

### In Render Dashboard:

1. Go to your service → **Environment** tab
2. Add these variables:

```
OPENAI_API_KEY = sk-proj-YOUR_KEY_HERE
PYTHON_VERSION = 3.11.0
PORT = 8000
```

3. Click **Save Changes**
4. Service will auto-redeploy

---

## 🔄 Auto-Deployment

Every time you push to GitHub:
```bash
git add .
git commit -m "Update AI prompt"
git push
```

Render automatically:
1. Detects the push
2. Rebuilds the service
3. Deploys new version
4. Zero downtime!

---

## 📊 Using the Deployed API

### From Your Frontend (Next.js/React):

```typescript
// Replace localhost with Render URL
const API_URL = 'https://novalare-extraction-api.onrender.com';

// Test AI discovery
const response = await fetch(`${API_URL}/discover-layout`, {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('AI discovered:', result.layout_schema);
```

### From curl (Testing):

```bash
# Set your Render URL
RENDER_URL="https://novalare-extraction-api.onrender.com"

# Test discovery
curl -X POST $RENDER_URL/discover-layout \
  -F "file=@statement.pdf" \
  | python3 -m json.tool

# Test extraction
curl -X POST $RENDER_URL/extract-with-schema \
  -F "file=@statement.pdf" \
  -F "auto_discover=true" \
  | python3 -m json.tool
```

---

## 🐛 Troubleshooting

### Issue: "Application failed to respond"

**Check logs:**
1. Go to Render dashboard
2. Click your service
3. Click **Logs** tab
4. Look for errors

**Common fixes:**
- Verify `requirements.txt` has all dependencies
- Check `OPENAI_API_KEY` is set correctly
- Verify `PORT` environment variable is set

### Issue: OpenAI API errors

**Check:**
```bash
# In Render logs, look for:
"🔑 OpenAI API key found: sk-proj-..."
```

If missing:
1. Go to **Environment** tab
2. Add `OPENAI_API_KEY`
3. Save and redeploy

### Issue: PDF processing errors

**Check Pillow installation:**
- Verify `requirements.txt` includes `Pillow==10.1.0`
- Redeploy if needed

### Issue: Slow first request (cold start)

**This is normal on free tier:**
- Free tier instances sleep after 15 min of inactivity
- First request wakes it up (~30 seconds)
- Upgrade to Starter plan ($7/month) for always-on

---

## 💰 Pricing

| Plan | Cost | Features |
|------|------|----------|
| **Free** | $0/month | 750 hours/month, sleeps after 15min |
| **Starter** | $7/month | Always on, no sleep, 0.5 GB RAM |
| **Standard** | $25/month | 2 GB RAM, better performance |

**Recommendation:** Start with **Free tier** for testing, upgrade to **Starter** for production.

---

## 🔐 Security Best Practices

### 1. Never commit API keys
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo "*.key" >> .gitignore
```

### 2. Use Render's environment variables
- ✅ Store `OPENAI_API_KEY` in Render dashboard
- ❌ Don't hardcode in code

### 3. Enable HTTPS only
- ✅ Render provides free SSL certificates
- ✅ All traffic is encrypted by default

---

## 📁 Required Files (Already Created)

Your repository should have:

```
python-extraction-server/
├── app.py                    ✅ Main Flask app
├── requirements.txt          ✅ Dependencies
├── runtime.txt              ✅ Python version
├── render.yaml              ✅ Render config (optional)
└── templates/               ✅ Bank templates
    └── built_in/
        ├── chase.json
        ├── capital_one.json
        └── deutsche_bank.json
```

---

## 🎯 Next Steps After Deployment

### 1. Update Frontend to Use Render URL

In your Next.js app:
```typescript
// Before (local)
const API_URL = 'http://localhost:8000';

// After (production)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://novalare-extraction-api.onrender.com';
```

### 2. Test with Real PDFs

```bash
RENDER_URL="https://novalare-extraction-api.onrender.com"

# Test Capital One
curl -X POST $RENDER_URL/extract-with-schema \
  -F "file=@capital_one_statement.pdf" \
  -F "auto_discover=true" \
  | jq '.count'

# Should return: 30+
```

### 3. Monitor Performance

In Render dashboard:
- **Metrics** → View request rates, response times
- **Logs** → Debug any issues
- **Events** → See deployment history

---

## 🚀 Advanced: Custom Domain (Optional)

### Add your own domain:

1. Go to **Settings** tab
2. Scroll to **Custom Domain**
3. Add domain: `api.novalare.com`
4. Update DNS records (Render provides instructions)
5. SSL certificate auto-generated

Then access at:
```
https://api.novalare.com/discover-layout
```

---

## 📊 Expected Performance

| Metric | Free Tier | Starter Plan |
|--------|-----------|--------------|
| **Cold start** | ~30 seconds | N/A (always on) |
| **Warm response** | ~2-3 seconds | ~1-2 seconds |
| **AI discovery** | ~10-15 seconds | ~8-12 seconds |
| **Extraction** | ~5-8 seconds | ~3-5 seconds |

---

## ✅ Deployment Checklist

Before going live:

- [ ] Code pushed to GitHub
- [ ] Render service created
- [ ] `OPENAI_API_KEY` environment variable set
- [ ] First deployment successful (check logs)
- [ ] Health endpoint responds: `/health`
- [ ] AI discovery works: `/discover-layout`
- [ ] Extraction works: `/extract-with-schema`
- [ ] Frontend updated with Render URL
- [ ] Tested with real PDFs
- [ ] Monitoring enabled

---

## 🎓 Key Benefits

### vs Local Development:
- ✅ No proxy issues
- ✅ No environment conflicts
- ✅ No "works on my machine" problems
- ✅ Accessible from anywhere
- ✅ Auto-scaling

### vs Other Platforms:
- ✅ Simpler than AWS/GCP
- ✅ Free tier (unlike Heroku)
- ✅ Auto-deployment
- ✅ Built-in SSL
- ✅ Easy environment variables

---

## 📞 Support

If you run into issues:

1. **Check Render docs:** https://render.com/docs
2. **View logs:** Render dashboard → Logs tab
3. **Check status:** https://status.render.com
4. **Community:** https://community.render.com

---

## 🎬 You're Ready!

Follow the steps above to deploy your Python extraction API to Render.com.

**No more local environment issues!** 🚀

Your AI-enhanced extraction system will be live at:
```
https://novalare-extraction-api.onrender.com
```

And it will extract **30+ transactions** from Capital One statements with **zero proxy errors**! 🎯
