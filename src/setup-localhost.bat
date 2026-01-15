@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM QuickBooks OAuth - Localhost Testing Setup Script (Windows)
REM ============================================================================
REM
REM This script helps you configure your environment for localhost testing
REM
REM Usage: setup-localhost.bat
REM
REM ============================================================================

echo.
echo ================================================================
echo   QuickBooks OAuth - Localhost Testing Setup
echo ================================================================
echo.

REM Check if .env.local.example exists
if not exist "supabase\functions\server\.env.local.example" (
    echo [ERROR] .env.local.example not found
    echo Expected at: supabase\functions\server\.env.local.example
    pause
    exit /b 1
)

REM Check if .env.local already exists
if exist "supabase\functions\server\.env.local" (
    echo [WARNING] .env.local already exists
    set /p OVERWRITE="Overwrite it? (Y/N): "
    if /i not "!OVERWRITE!"=="Y" (
        echo [INFO] Keeping existing .env.local
        echo.
        echo To manually edit, run:
        echo   notepad supabase\functions\server\.env.local
        echo.
        pause
        exit /b 0
    )
)

REM Copy the example file
echo [INFO] Creating .env.local from template...
copy /Y "supabase\functions\server\.env.local.example" "supabase\functions\server\.env.local" >nul
echo [SUCCESS] Created .env.local
echo.

REM Prompt for required values
echo ================================================================
echo   Let's fill in your configuration values
echo ================================================================
echo.
echo Press ENTER to skip optional fields
echo.

REM Supabase Configuration
echo --- Supabase Configuration ---
echo Get these from: Supabase Dashboard -^> Settings -^> API
echo.

set /p SUPABASE_URL="SUPABASE_URL: "
set /p SUPABASE_ANON_KEY="SUPABASE_ANON_KEY: "
set /p SUPABASE_SERVICE_ROLE_KEY="SUPABASE_SERVICE_ROLE_KEY: "
echo.

REM QuickBooks Configuration
echo --- QuickBooks Configuration ---
echo Get these from: https://developer.intuit.com/app/developer/myapps
echo.

set /p QBO_CLIENT_ID="QBO_CLIENT_ID: "
set /p QBO_CLIENT_SECRET="QBO_CLIENT_SECRET: "
echo.
echo Using redirect URI: http://localhost:5173/qbo-callback
set QBO_REDIRECT_URI=http://localhost:5173/qbo-callback
echo.

REM OpenAI Configuration
echo --- OpenAI Configuration ---
echo Get from: https://platform.openai.com/api-keys
echo.

set /p OPENAI_API_KEY="OPENAI_API_KEY: "
echo.

REM Create PowerShell script to update the file (more reliable than batch string replacement)
echo [INFO] Saving configuration...

powershell -Command "(Get-Content 'supabase\functions\server\.env.local') -replace 'SUPABASE_URL=.*', 'SUPABASE_URL=%SUPABASE_URL%' -replace 'SUPABASE_ANON_KEY=.*', 'SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%' -replace 'SUPABASE_SERVICE_ROLE_KEY=.*', 'SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE_KEY%' -replace 'QBO_REDIRECT_URI=.*', 'QBO_REDIRECT_URI=%QBO_REDIRECT_URI%' -replace 'QBO_CLIENT_ID=.*', 'QBO_CLIENT_ID=%QBO_CLIENT_ID%' -replace 'QBO_CLIENT_SECRET=.*', 'QBO_CLIENT_SECRET=%QBO_CLIENT_SECRET%' -replace 'OPENAI_API_KEY=.*', 'OPENAI_API_KEY=%OPENAI_API_KEY%' | Set-Content 'supabase\functions\server\.env.local'"

echo [SUCCESS] Configuration saved!
echo.

REM Show next steps
echo ================================================================
echo   Setup Complete! Next Steps:
echo ================================================================
echo.
echo 1. Update QuickBooks Developer Portal:
echo    - Go to: https://developer.intuit.com/app/developer/myapps
echo    - Select your app -^> Keys ^& credentials
echo    - Add Redirect URI: http://localhost:5173/qbo-callback
echo.
echo 2. Update QBO_REDIRECT_URI in Supabase (if using production Edge Functions):
echo    - Go to: Supabase Dashboard -^> Settings -^> Edge Functions -^> Secrets
echo    - Update QBO_REDIRECT_URI to: http://localhost:5173/qbo-callback
echo    - Remember to change back after testing!
echo.
echo 3. Start your development server:
echo    npm run dev
echo.
echo 4. Test the OAuth flow:
echo    - Go to: http://localhost:5173
echo    - Navigate to: Settings -^> Accounting Integrations
echo    - Click: Connect QuickBooks
echo.
echo For more help, see:
echo    - /QUICK_START_LOCALHOST_QB.md
echo    - /QB_OAUTH_FLOW_LOCALHOST.md
echo.
echo Happy testing!
echo.
pause
