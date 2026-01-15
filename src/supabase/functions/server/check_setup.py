#!/usr/bin/env python3
"""
Quick setup checker for pdfplumber extraction

Verifies that all dependencies are installed correctly
"""

import sys

# Color codes
GREEN = '\033[92m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

def check(name, success):
    if success:
        print(f"{GREEN}✅ {name}{RESET}")
        return True
    else:
        print(f"{RED}❌ {name}{RESET}")
        return False

print(f"\n{BOLD}{BLUE}{'=' * 60}{RESET}")
print(f"{BOLD}{BLUE}PDFPLUMBER SETUP CHECK{RESET}")
print(f"{BOLD}{BLUE}{'=' * 60}{RESET}\n")

all_good = True

# Check Python version
print(f"{BOLD}1. Python Version{RESET}")
version = sys.version_info
if version.major == 3 and version.minor >= 7:
    check(f"Python {version.major}.{version.minor}.{version.micro}", True)
else:
    check(f"Python {version.major}.{version.minor}.{version.micro} (need 3.7+)", False)
    all_good = False

print()

# Check pdfplumber
print(f"{BOLD}2. pdfplumber Library{RESET}")
try:
    import pdfplumber
    check(f"pdfplumber {pdfplumber.__version__}", True)
except ImportError:
    check("pdfplumber (NOT INSTALLED)", False)
    print(f"   {BLUE}Install with: pip3 install pdfplumber{RESET}")
    all_good = False

print()

# Check other dependencies
print(f"{BOLD}3. Other Dependencies{RESET}")

try:
    import PIL
    check("Pillow (image processing)", True)
except ImportError:
    check("Pillow (optional, but recommended)", False)

try:
    import pdfminer
    check("pdfminer.six (PDF parsing)", True)
except ImportError:
    check("pdfminer.six (should be installed with pdfplumber)", False)

print()

# Summary
print(f"{BOLD}{BLUE}{'=' * 60}{RESET}")
if all_good:
    print(f"{GREEN}{BOLD}✅ ALL CHECKS PASSED!{RESET}")
    print(f"\n{BLUE}You're ready to test pdfplumber extraction:{RESET}")
    print(f"  python3 test_pdfplumber.py <path_to_pdf>\n")
else:
    print(f"{RED}{BOLD}❌ SETUP INCOMPLETE{RESET}")
    print(f"\n{BLUE}Fix the issues above, then run this check again.{RESET}\n")
    print(f"{BLUE}Quick fix:{RESET}")
    print(f"  pip3 install pdfplumber\n")

print(f"{BOLD}{BLUE}{'=' * 60}{RESET}\n")

sys.exit(0 if all_good else 1)
