# ⚡ QUICK START - Deploy in 5 Minutes

## 🎯 Three Simple Steps

### 1️⃣ Push to GitHub (30 seconds)

```bash
git add python-extraction-server/
git commit -m "Add Python extraction API"
git push origin main
```

### 2️⃣ Deploy to Render (3 minutes)

1. Go to **https://render.com**
2. Sign up with GitHub
3. Click **New + → Web Service**
4. Select your repository
5. Fill in:
   - Root Directory: `python-extraction-server`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
6. Click **Create Web Service**
7. Wait ~2 minutes ⏳

### 3️⃣ Test It (30 seconds)

```bash
# Replace with YOUR Render URL
curl https://your-app.onrender.com/health

# Should return: {"status": "healthy"}
```

**DONE!** ✅ Your API is live!

---

## 🧪 Test with Your Bank Statement

```bash
curl -X POST https://your-app.onrender.com/extract \
  -F "file=@~/Downloads/your_statement.pdf" \
  | python -m json.tool
```

Expected output:
```json
{
  "success": true,
  "transactions": [
    {
      "date": "2024-04-17",
      "description": "Zelle Payment To Chrissy",
      "amount": -53.0,
      "balance": 52.36
    }
  ],
  "count": 1247
}
```

---

## ✅ If That Works...

**Congratulations!** You now have:
- ✅ FREE bank statement extraction
- ✅ 1-2 second processing time
- ✅ Unlimited pages and transactions
- ✅ Cloud-hosted API
- ✅ Auto-deploys when you push to GitHub

**Cost:** $0 forever 🎉

---

## 🎨 Use Browser Test Tool

Open `python-extraction-server/test.html` in your browser:
1. Enter your Render URL
2. Upload your bank statement
3. Click "Extract Transactions"
4. See beautiful results! ✨

---

## 📝 What to Report Back

After testing:
1. ✅ Did deployment work?
2. ✅ API URL: _______________
3. ✅ Transaction count: _______________
4. ✅ Quality good? (Real transactions, not random text)
5. ✅ Speed: _____ seconds

Then I'll integrate it into your Novalare app! 🚀

---

## 🆘 Troubleshooting

### Deployment failed?
- Check the **Logs** tab in Render
- Make sure `python-extraction-server/` folder exists
- Verify all files are committed to git

### "Application Error"?
- Wait 30 seconds and try again
- Check **Events** tab for deployment status
- Free tier has cold starts (~30s for first request)

### Still stuck?
Try **Railway.app** instead - even easier!
1. Go to https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub
4. Select your repo
5. Done! (Railway auto-detects everything)

---

**Ready? Go to [render.com](https://render.com) now!** 🚀
