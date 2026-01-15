# 🚀 5-Minute Deployment Guide

## 🎯 Easiest Method: Render.com (100% Free)

### Step 1: Push Code to GitHub (if not already)

```bash
# In your project root
git add python-extraction-server/
git commit -m "Add Python extraction API"
git push origin main
```

### Step 2: Deploy to Render

1. **Go to**: [https://render.com](https://render.com)
2. **Sign up** with GitHub
3. Click **"New +"** → **"Web Service"**
4. Click **"Connect account"** to link GitHub
5. Select your repository
6. Configure:
   ```
   Name: novalare-extraction
   Region: Oregon (or closest to you)
   Branch: main
   Root Directory: python-extraction-server
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: gunicorn app:app
   Instance Type: Free
   ```
7. Click **"Create Web Service"**
8. Wait 2-3 minutes for deployment ⏳
9. **Done!** Your URL will be: `https://novalare-extraction.onrender.com`

### Step 3: Test It

```bash
# Replace with YOUR Render URL
curl https://novalare-extraction.onrender.com/health

# Should return:
# {"status": "healthy"}
```

### Step 4: Test with Your PDF

```bash
curl -X POST https://novalare-extraction.onrender.com/extract \
  -F "file=@/Users/you/Downloads/DA5BE812-292D-458D-A064-631672FF2ED6-1ist.pdf" \
  | python -m json.tool | head -50
```

You should see:
```json
{
  "success": true,
  "transactions": [
    {
      "date": "2024-04-17",
      "description": "Online Transfer From...",
      "amount": 30.0,
      "balance": 105.36
    },
    ...
  ],
  "count": 1247
}
```

---

## 🎉 If That Works...

**Congratulations!** You now have a FREE Python extraction API! 🚀

### Step 5: Connect to Your Novalare App

Update your extraction code to use the new API. I'll create the integration code now!

---

## ⚡ Alternative: Railway.app (Also Free)

If Render doesn't work, try Railway:

1. **Go to**: [https://railway.app](https://railway.app)
2. **Sign in with GitHub**
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your repository
6. Railway auto-detects Python and deploys!
7. Click **"Settings"** → **"Generate Domain"** to get your URL

Even easier! 🎯

---

## 📊 What You Get

✅ **FREE** extraction API  
✅ **FAST** (1-2 seconds per statement)  
✅ **UNLIMITED** transactions per statement  
✅ **NO** OpenAI costs  
✅ **NO** Google Document AI costs  
✅ **HTTPS** by default  
✅ **Auto-deploys** when you push to GitHub  

---

## 🔧 Troubleshooting

### Deploy failed?
- Check the **Logs** tab in Render dashboard
- Common issues:
  - Wrong root directory → Should be `python-extraction-server`
  - Missing files → Make sure all files are committed to git

### "Application Error"?
- Wait 30 seconds and refresh
- Check **Events** tab for deployment status

### Still stuck?
- Try Railway.app instead (even easier!)
- Or DM me the error logs

---

## 💡 Pro Tips

1. **Custom domain**: Add your own domain in Render settings
2. **Environment variables**: Add secrets in Environment tab
3. **Monitoring**: Render shows logs, metrics, and uptime
4. **Scaling**: Upgrade to paid tier ($7/mo) for:
   - No cold starts
   - More memory
   - Better performance

---

**Ready?** Go to [render.com](https://render.com) and deploy in 5 minutes! 🚀
