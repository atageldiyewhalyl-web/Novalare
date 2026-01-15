# ✅ Render Deployment Checklist

## Pre-Deployment

### Code Ready
- [x] `app.py` - Enhanced with AI improvements (Phase 1 complete)
- [x] `requirements.txt` - All dependencies listed
- [x] `runtime.txt` - Python version specified (3.11.0)
- [x] `render.yaml` - Render configuration created
- [x] `.gitignore` - Sensitive files excluded
- [x] `templates/built_in/` - Bank templates included

### GitHub Setup
- [ ] GitHub account created
- [ ] Repository created on GitHub
- [ ] Code pushed to repository
- [ ] Main branch is `main` (not `master`)

### Render.com Setup
- [ ] Render.com account created (free)
- [ ] GitHub connected to Render
- [ ] OpenAI API key ready

---

## Deployment Steps

### Step 1: GitHub Push
- [ ] Navigate to project root
- [ ] Run `git init` (if needed)
- [ ] Run `git add .`
- [ ] Run `git commit -m "Add AI extraction API"`
- [ ] Create GitHub repo
- [ ] Add remote: `git remote add origin <URL>`
- [ ] Push: `git push -u origin main`

### Step 2: Render Service Creation
- [ ] Go to https://render.com
- [ ] Click "New +" → "Web Service"
- [ ] Select GitHub repository
- [ ] Configure service:
  - [ ] Name: `novalare-extraction-api`
  - [ ] Root Directory: `python-extraction-server`
  - [ ] Runtime: `Python 3`
  - [ ] Build Command: `pip install -r requirements.txt`
  - [ ] Start Command: `python app.py`
  - [ ] Plan: `Free` or `Starter`
  - [ ] Region: `Oregon (US West)`

### Step 3: Environment Variables
- [ ] Click "Advanced" settings
- [ ] Add `OPENAI_API_KEY` = `sk-proj-YOUR_KEY`
- [ ] Add `PYTHON_VERSION` = `3.11.0`
- [ ] Add `PORT` = `8000`
- [ ] Save environment variables

### Step 4: Deploy
- [ ] Click "Create Web Service"
- [ ] Wait for build (~5 minutes)
- [ ] Check logs for errors
- [ ] Note your service URL

---

## Post-Deployment Testing

### Health Check
- [ ] Test: `curl https://YOUR_URL.onrender.com/health`
- [ ] Expected: `{"status": "healthy", ...}`

### API Key Verification
- [ ] Check Render logs for: `🔑 OpenAI API key found`
- [ ] No errors about missing API key

### AI Discovery Test
```bash
curl -X POST https://YOUR_URL.onrender.com/discover-layout \
  -F "file=@test_statement.pdf"
```
- [ ] Returns success: true
- [ ] Contains layout_schema
- [ ] Visual landmarks detected
- [ ] Confidence score > 80

### Extraction Test
```bash
curl -X POST https://YOUR_URL.onrender.com/extract-with-schema \
  -F "file=@test_statement.pdf" \
  -F "auto_discover=true"
```
- [ ] Returns transactions array
- [ ] Transaction count > 25 for Capital One
- [ ] Amounts are complete ("+$750.00")
- [ ] Multi-line descriptions captured

---

## Integration with Frontend

### Update API URL
- [ ] In your Next.js app, update:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  'https://YOUR_URL.onrender.com';
```

### Add Environment Variable
- [ ] Create `.env.local`:
```
NEXT_PUBLIC_API_URL=https://novalare-extraction-api.onrender.com
```

### Test Frontend Integration
- [ ] Upload PDF through UI
- [ ] Verify extraction works
- [ ] Check transaction count
- [ ] Verify no CORS errors

---

## Monitoring & Maintenance

### Daily Checks
- [ ] Service is running (not crashed)
- [ ] Response times < 3 seconds
- [ ] No 500 errors in logs

### Weekly Checks
- [ ] Review error logs
- [ ] Check OpenAI API usage
- [ ] Monitor request volume

### Monthly Tasks
- [ ] Review Render costs
- [ ] Update dependencies if needed
- [ ] Check for OpenAI SDK updates

---

## Performance Expectations

### Free Tier
- [ ] Cold start: ~30 seconds (after 15 min sleep)
- [ ] Warm response: ~2-3 seconds
- [ ] AI discovery: ~10-15 seconds
- [ ] Extraction: ~5-8 seconds

### Starter Plan ($7/month)
- [ ] No cold starts (always on)
- [ ] Warm response: ~1-2 seconds
- [ ] AI discovery: ~8-12 seconds
- [ ] Extraction: ~3-5 seconds

---

## Troubleshooting

### Issue: Build Failed
- [ ] Check `requirements.txt` format
- [ ] Verify Python version in `runtime.txt`
- [ ] Check Render build logs

### Issue: Service Won't Start
- [ ] Verify `PORT` environment variable
- [ ] Check `app.py` reads PORT correctly
- [ ] Review Render service logs

### Issue: OpenAI Errors
- [ ] Verify `OPENAI_API_KEY` is set
- [ ] Check key is valid (not expired)
- [ ] Review OpenAI usage limits

### Issue: PDF Processing Fails
- [ ] Verify `Pillow` in requirements.txt
- [ ] Check PDF file size (< 10 MB recommended)
- [ ] Review error in logs

---

## Upgrade Path

### When to Upgrade from Free to Starter

Upgrade if:
- [ ] Cold starts are annoying users (30 sec wait)
- [ ] You need 24/7 availability
- [ ] Multiple users testing simultaneously
- [ ] You're ready for production

**Cost:** $7/month (0.5 GB RAM, always on)

### When to Upgrade from Starter to Standard

Upgrade if:
- [ ] Processing large PDFs (10+ pages)
- [ ] High concurrent users (10+)
- [ ] Need faster response times
- [ ] RAM errors in logs

**Cost:** $25/month (2 GB RAM, better performance)

---

## Success Criteria

Your deployment is successful if:

✅ **Deployment**
- [ ] Build completes without errors
- [ ] Service starts successfully
- [ ] Health endpoint responds

✅ **Functionality**
- [ ] AI discovery works
- [ ] Extracts 30+ transactions from Capital One
- [ ] Visual landmarks detected
- [ ] Multi-line descriptions captured

✅ **Performance**
- [ ] Response time < 3 seconds (warm)
- [ ] AI discovery < 15 seconds
- [ ] No 500 errors

✅ **Integration**
- [ ] Frontend connects successfully
- [ ] No CORS errors
- [ ] PDF uploads work end-to-end

---

## Rollback Plan

If deployment fails:

1. **Check Render logs first**
   - Go to Render dashboard → Logs
   - Look for error messages
   - Fix in code, push again

2. **Revert to previous version**
   - Render → Events → Rollback to previous deploy
   - Fix issue locally
   - Redeploy when ready

3. **Test locally first** (if possible)
   - Use Docker to test exact Render environment
   - Verify before pushing to production

---

## Next Steps After Successful Deployment

1. [ ] **Update documentation** with your Render URL
2. [ ] **Share with team** - Service is live!
3. [ ] **Set up monitoring** - Render dashboard alerts
4. [ ] **Test with multiple banks** - Chase, Bank of America
5. [ ] **Plan Phase 2** - Two-step AI process + caching

---

## 🎉 Deployment Complete!

Once all checkboxes are ticked, your AI-enhanced extraction API is:

✅ Live at: `https://novalare-extraction-api.onrender.com`  
✅ Extracting 30+ transactions from Capital One  
✅ No proxy issues  
✅ No local environment problems  
✅ Auto-deploying on every push  
✅ Ready for production use  

**Welcome to the cloud!** ☁️🚀
