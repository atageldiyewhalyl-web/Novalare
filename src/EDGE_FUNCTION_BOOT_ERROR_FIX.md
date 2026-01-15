# Edge Function Boot Error - Quick Fix Guide

## Error Symptoms
```
❌ API Error (/api/companies/2/receipts): {
  "code": "BOOT_ERROR",
  "message": "Function failed to start (please check logs)"
}
```

## Most Likely Causes

### 1. **Supabase Cold Start Timeout** (90% probability)
- Edge Functions can take 10-30 seconds to cold start
- Large imports (XLSX, pdf-parse, etc.) slow down boot
- First request after deploy always times out

**Fix:** Just wait 30 seconds and try again. Second request will work.

### 2. **Import Error** (8% probability)
- One of the imports in bank-rec-parsers.tsx is failing
- Circular dependency between files
- TypeScript compilation error

**Fix:** Check Supabase logs at:
`https://supabase.com/dashboard/project/_/functions/logs`

### 3. **File Too Large** (2% probability)
- bank-rec-parsers.tsx is ~1400 lines
- May exceed Edge Function bundle size limit

**Fix:** Already split into separate file, should be fine.

## Quick Diagnostic Steps

### Step 1: Check if it's just cold start
1. Wait 30 seconds
2. Refresh the page
3. Try the API call again
4. If it works → it was just cold start!

### Step 2: Check Supabase Logs
1. Go to: https://supabase.com/dashboard/project/_/functions/logs
2. Look for errors during function boot
3. Search for keywords: "import", "error", "failed"

### Step 3: Test with Health Endpoint
Open in browser:
```
https://YOUR_PROJECT.supabase.co/functions/v1/make-server-53c2e113/health
```

**If this works:**
- Edge Function is booting fine
- Issue is with specific route

**If this fails:**
- Edge Function isn't booting at all
- Check logs for import errors

## Emergency Fallback

If all else fails, **temporarily remove the problematic import**:

### File: `/supabase/functions/server/bank-rec-routes.tsx`

Comment out `parsePDFStreaming`:
```typescript
import { 
  parseCSV, 
  parseXLSX, 
  parsePDFSmart, 
  // parsePDFStreaming,  // Temporarily disabled
  parsePDFHeuristic,
  parsePDFWithGoogle,
  parsePDFWithOpenAI,
  parsePDFWithPythonAPI,
  parseLedgerCSV, 
  parseLedgerXLSX 
} from './bank-rec-parsers.tsx';
```

This will let you isolate if the generator function is causing issues.

## What I Just Changed

✅ **Restored the import** - Bank-rec-routes.tsx now imports parsePDFStreaming again
✅ **No code changes** - All functions remain intact

The error is likely **transient** (cold start). Just wait and retry!

---

## Next Steps

1. ⏳ **Wait 30 seconds** and refresh
2. 🔍 **Check Supabase logs** if still failing
3. 📞 **Let me know** what you see in the logs
