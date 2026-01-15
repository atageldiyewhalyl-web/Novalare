# 🚀 Supabase Edge Function Deployment Script (PowerShell)
# This script deploys your Edge Function to Supabase

Write-Host "🚀 Novalare - Supabase Edge Function Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
try {
    $null = Get-Command supabase -ErrorAction Stop
    Write-Host "✅ Supabase CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📦 Install it using:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Windows (Scoop):" -ForegroundColor White
    Write-Host "  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git"
    Write-Host "  scoop install supabase"
    Write-Host ""
    Write-Host "Or download from: https://github.com/supabase/cli/releases" -ForegroundColor White
    exit 1
}

Write-Host ""

# Check if user is logged in
try {
    $null = supabase projects list 2>&1
    Write-Host "✅ Authenticated with Supabase" -ForegroundColor Green
} catch {
    Write-Host "🔐 You need to login to Supabase first" -ForegroundColor Yellow
    Write-Host ""
    supabase login
}

Write-Host ""

# Check if project is linked
if (-not (Test-Path ".supabase/config.toml")) {
    Write-Host "🔗 Project not linked yet" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please enter your Supabase Project Reference ID:" -ForegroundColor White
    Write-Host "(Find it in: Supabase Dashboard → Settings → General → Reference ID)" -ForegroundColor Gray
    Write-Host ""
    $PROJECT_REF = Read-Host "Project Ref ID"
    Write-Host ""
    
    supabase link --project-ref $PROJECT_REF
    Write-Host ""
}

Write-Host "✅ Project is linked" -ForegroundColor Green
Write-Host ""

# Deploy the edge function
Write-Host "📦 Deploying make-server-53c2e113 function..." -ForegroundColor Cyan
Write-Host ""

supabase functions deploy make-server-53c2e113

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔍 Verify deployment:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Check function status:" -ForegroundColor White
Write-Host "   supabase functions list" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test health endpoint:" -ForegroundColor White
Write-Host "   Invoke-WebRequest https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-53c2e113/health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. View logs:" -ForegroundColor White
Write-Host "   supabase functions logs make-server-53c2e113" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Refresh your app and check if errors are gone!" -ForegroundColor White
Write-Host ""
