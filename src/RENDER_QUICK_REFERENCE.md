# 🎯 Render.com - Quick Reference Card

## Your Service URL
```
https://novalare-extraction-api.onrender.com
```
*(Replace with your actual URL after deployment)*

---

## 🧪 Test Commands

### Health Check
```bash
curl https://YOUR_URL.onrender.com/health
```

### AI Discovery (Capital One)
```bash
curl -X POST https://YOUR_URL.onrender.com/discover-layout \
  -F "file=@statement.pdf" \
  | python3 -m json.tool
```

### Full Extraction
```bash
curl -X POST https://YOUR_URL.onrender.com/extract-with-schema \
  -F "file=@statement.pdf" \
  -F "auto_discover=true" \
  | python3 -m json.tool | jq '.count'
```

---

## 🔧 Environment Variables

Set in Render Dashboard → Environment tab:

```
OPENAI_API_KEY = sk-proj-YOUR_KEY_HERE
PYTHON_VERSION = 3.11.0
PORT = 8000
```

---

## 📊 Expected Performance

| Metric | Free Tier | Starter ($7/mo) |
|--------|-----------|-----------------|
| Cold start | 30 sec | N/A (always on) |
| Warm response | 2-3 sec | 1-2 sec |
| AI discovery | 10-15 sec | 8-12 sec |
| Extraction | 5-8 sec | 3-5 sec |

---

## 🚨 Troubleshooting

### Check Logs
```
Render Dashboard → Your Service → Logs
```

### Common Errors

**"Application failed to respond"**
→ Check if `OPENAI_API_KEY` is set
→ Verify service logs for errors

**"No transactions extracted"**
→ Check PDF format is supported
→ Review AI discovery response

**Cold start (free tier)**
→ Normal behavior after 15 min inactivity
→ Upgrade to Starter plan for always-on

---

## 🔄 Update Deployment

```bash
# Make changes to code
git add .
git commit -m "Update prompt"
git push

# Render auto-deploys in ~3 minutes
```

---

## 📈 Monitor Service

### Metrics Tab
- Request volume
- Response times
- Error rates

### Logs Tab
- Real-time logs
- Search/filter
- Download logs

### Events Tab
- Deployment history
- Build logs
- Rollback options

---

## 💰 Upgrade Plan

### From Dashboard
```
Settings → Plan → Change Plan → Starter
```

**Starter benefits:**
- Always on (no sleep)
- Faster responses
- Better for production

---

## 🔐 Security

### Rotate API Key
1. Get new OpenAI key
2. Render → Environment → Edit `OPENAI_API_KEY`
3. Save (auto-redeploys)

### Add Team Members
```
Settings → Team → Invite Member
```

---

## 📱 Frontend Integration

### Next.js Environment Variable
```bash
# .env.local
NEXT_PUBLIC_API_URL=https://YOUR_URL.onrender.com
```

### Usage in Code
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const response = await fetch(`${API_URL}/discover-layout`, {
  method: 'POST',
  body: formData
});
```

---

## 🎯 Success Criteria

Your deployment is successful if:

✅ Health check responds
✅ AI discovery works
✅ Extracts 30+ transactions from Capital One
✅ Response time < 3 seconds (warm)
✅ No errors in logs

---

## 📞 Support Links

- **Render Docs:** https://render.com/docs
- **Render Status:** https://status.render.com
- **Community:** https://community.render.com
- **Your Dashboard:** https://dashboard.render.com

---

## 🎓 Quick Commands

```bash
# Save your URL as variable
export RENDER_URL="https://YOUR_URL.onrender.com"

# Health check
curl $RENDER_URL/health

# Transaction count
curl -s -X POST $RENDER_URL/extract-with-schema \
  -F "file=@statement.pdf" \
  -F "auto_discover=true" | jq '.count'

# View schema
curl -s -X POST $RENDER_URL/discover-layout \
  -F "file=@statement.pdf" | jq '.layout_schema'
```

---

## 🔄 Rollback

If deployment breaks:

```
Render Dashboard → Events → Select previous deploy → Rollback
```

---

## 📊 Monthly Checklist

- [ ] Review error logs
- [ ] Check response times
- [ ] Monitor OpenAI usage
- [ ] Verify bill ($0 or $7)
- [ ] Update dependencies if needed

---

## 🚀 Pro Tips

1. **Keep Render URL in .env** - Easy to change
2. **Monitor logs after deploy** - Catch errors early
3. **Test with real PDFs** - Verify extraction quality
4. **Use Starter for production** - No cold starts
5. **Set up status page** - https://status.render.com alerts

---

Print this and keep it handy! 📋
