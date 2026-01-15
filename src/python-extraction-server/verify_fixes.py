#!/usr/bin/env python3
"""
Verify that all OpenAI refusal fixes are present in app.py
Run this before deploying to ensure the file has all the fixes
"""

import sys

def check_file(filepath):
    """Check if app.py has all the required fixes"""
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    checks = {
        "System message for accounting software": "You are an AI assistant for a professional accounting software",
        "Business context in prompt": "IMPORTANT: This is an authorized business use case",
        "Refusal detection": "Check for OpenAI refusal messages",
        "Refusal phrases list": "i'm sorry",
        "Try-except around json.loads": "Try to parse JSON with detailed error handling",
        "JSON error handler": "except json.JSONDecodeError as e:",
        "Helpful error for refusal": "OpenAI refused to process"
    }
    
    print("🔍 Checking app.py for OpenAI refusal fixes...\n")
    
    all_passed = True
    for check_name, search_string in checks.items():
        if search_string in content:
            print(f"✅ {check_name}")
        else:
            print(f"❌ {check_name} - MISSING!")
            all_passed = False
    
    print("\n" + "="*60 + "\n")
    
    if all_passed:
        print("🎉 All fixes are present!")
        print("\n✅ Ready to deploy:\n")
        print("   git add app.py")
        print("   git commit -m 'Fix: OpenAI refusal handling'")
        print("   git push origin main")
        print("\n🕐 Render will auto-deploy in 2-3 minutes")
        return 0
    else:
        print("❌ Some fixes are MISSING!")
        print("\n⚠️  DO NOT DEPLOY until all checks pass")
        print("\nPossible issues:")
        print("  1. Wrong file - make sure this is the app.py that Render uses")
        print("  2. Incomplete edits - re-apply the fixes")
        print("  3. File conflict - check for merge conflicts")
        return 1

if __name__ == "__main__":
    filepath = sys.argv[1] if len(sys.argv) > 1 else "app.py"
    
    try:
        sys.exit(check_file(filepath))
    except FileNotFoundError:
        print(f"❌ File not found: {filepath}")
        print("\nUsage: python3 verify_fixes.py [path/to/app.py]")
        sys.exit(1)
