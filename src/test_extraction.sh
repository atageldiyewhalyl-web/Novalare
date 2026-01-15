#!/bin/bash

# 🧪 ONE-COMMAND TEST SCRIPT FOR PDFPLUMBER
# 
# Usage: ./test_extraction.sh <path_to_pdf>
# Example: ./test_extraction.sh ~/Downloads/bank_statement.pdf

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "\n${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}        🧪 PDFPLUMBER BANK STATEMENT EXTRACTION TEST        ${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Change to server directory
cd "$(dirname "$0")/supabase/functions/server"

# Step 1: Check setup
echo -e "${BOLD}Step 1: Checking setup...${NC}"
if python3 check_setup.py; then
    echo -e "${GREEN}✅ Setup check passed!${NC}\n"
else
    echo -e "${RED}❌ Setup incomplete. Installing pdfplumber...${NC}"
    pip3 install pdfplumber
    echo -e "${GREEN}✅ Installation complete!${NC}\n"
fi

# Step 2: Check if PDF path provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: No PDF file specified${NC}"
    echo -e "${YELLOW}Usage: ./test_extraction.sh <path_to_pdf>${NC}"
    echo -e "${YELLOW}Example: ./test_extraction.sh ~/Downloads/bank_statement.pdf${NC}\n"
    exit 1
fi

PDF_PATH="$1"

# Step 3: Check if file exists
if [ ! -f "$PDF_PATH" ]; then
    echo -e "${RED}❌ Error: File not found: $PDF_PATH${NC}\n"
    exit 1
fi

# Step 4: Run extraction test
echo -e "${BOLD}Step 2: Running extraction on: $PDF_PATH${NC}\n"
python3 test_pdfplumber.py "$PDF_PATH"

# Step 5: Success message
echo -e "\n${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}                    ✅ TEST COMPLETE!                          ${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${BLUE}📋 Review the results above to verify:${NC}"
echo -e "   ${GREEN}✅${NC} Clean transaction descriptions (no random text)"
echo -e "   ${GREEN}✅${NC} Correct amounts (match your PDF)"
echo -e "   ${GREEN}✅${NC} Balance validation passed"
echo -e "   ${GREEN}✅${NC} Transaction count looks right"
echo ""
echo -e "${BLUE}📁 JSON output saved to:${NC}"
echo -e "   ${PDF_PATH%.pdf}_extracted.json"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo -e "   • If extraction looks perfect → Deploy to server with Python"
echo -e "   • If extraction has issues → Use Google Document AI or OpenAI"
echo ""
