#!/usr/bin/env python3
"""
STANDALONE TEST SCRIPT for pdfplumber extraction

Usage:
    python3 test_pdfplumber.py <path_to_bank_statement.pdf>

Example:
    python3 test_pdfplumber.py ~/Downloads/chase_statement.pdf
"""

import sys
import json
import os

# Color codes for pretty output
GREEN = '\033[92m'
BLUE = '\033[94m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_header(text):
    print(f"\n{BOLD}{BLUE}{'=' * 80}{RESET}")
    print(f"{BOLD}{BLUE}{text.center(80)}{RESET}")
    print(f"{BOLD}{BLUE}{'=' * 80}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text):
    print(f"{RED}❌ {text}{RESET}")

def print_info(text):
    print(f"{BLUE}ℹ️  {text}{RESET}")

def print_warning(text):
    print(f"{YELLOW}⚠️  {text}{RESET}")

if __name__ == '__main__':
    print_header("PDF BANK STATEMENT EXTRACTOR TEST")
    
    # Check if pdfplumber is installed
    try:
        import pdfplumber
        print_success(f"pdfplumber is installed (version: {pdfplumber.__version__})")
    except ImportError:
        print_error("pdfplumber is NOT installed!")
        print_info("Install it with: pip3 install pdfplumber")
        sys.exit(1)
    
    # Check command line arguments
    if len(sys.argv) < 2:
        print_error("Missing PDF file path!")
        print_info("Usage: python3 test_pdfplumber.py <path_to_pdf>")
        print_info("Example: python3 test_pdfplumber.py ~/Downloads/chase_statement.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    # Check if file exists
    if not os.path.exists(pdf_path):
        print_error(f"File not found: {pdf_path}")
        sys.exit(1)
    
    print_success(f"Found PDF: {pdf_path}")
    file_size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
    print_info(f"File size: {file_size_mb:.2f} MB")
    
    # Import the extraction script
    print_header("RUNNING EXTRACTION")
    
    # We'll import the extract_bank_table module
    import extract_bank_table
    
    try:
        transactions = extract_bank_table.extract_transactions(pdf_path)
        
        print_header("EXTRACTION RESULTS")
        print_success(f"Extracted {len(transactions)} transactions!")
        
        if transactions:
            print(f"\n{BOLD}First 10 transactions:{RESET}\n")
            print(f"{'#':<4} {'Date':<12} {'Description':<50} {'Amount':>12} {'Balance':>12}")
            print("-" * 92)
            
            for i, t in enumerate(transactions[:10], 1):
                date = t['date']
                desc = t['description'][:47] + '...' if len(t['description']) > 50 else t['description']
                amount = f"${t['amount']:,.2f}"
                balance = f"${t['balance']:,.2f}" if t.get('balance') else "N/A"
                
                # Color negative amounts red, positive green
                if t['amount'] < 0:
                    amount = f"{RED}{amount}{RESET}"
                else:
                    amount = f"{GREEN}{amount}{RESET}"
                
                print(f"{i:<4} {date:<12} {desc:<50} {amount:>20} {balance:>12}")
            
            if len(transactions) > 10:
                print(f"\n... and {len(transactions) - 10} more transactions\n")
                
                print(f"\n{BOLD}Last 5 transactions:{RESET}\n")
                print(f"{'#':<4} {'Date':<12} {'Description':<50} {'Amount':>12} {'Balance':>12}")
                print("-" * 92)
                
                for i, t in enumerate(transactions[-5:], len(transactions) - 4):
                    date = t['date']
                    desc = t['description'][:47] + '...' if len(t['description']) > 50 else t['description']
                    amount = f"${t['amount']:,.2f}"
                    balance = f"${t['balance']:,.2f}" if t.get('balance') else "N/A"
                    
                    if t['amount'] < 0:
                        amount = f"{RED}{amount}{RESET}"
                    else:
                        amount = f"{GREEN}{amount}{RESET}"
                    
                    print(f"{i:<4} {date:<12} {desc:<50} {amount:>20} {balance:>12}")
            
            # Calculate totals
            total_debits = sum(t['amount'] for t in transactions if t['amount'] < 0)
            total_credits = sum(t['amount'] for t in transactions if t['amount'] > 0)
            net_change = sum(t['amount'] for t in transactions)
            
            print_header("SUMMARY")
            print(f"{BOLD}Total transactions:{RESET} {len(transactions)}")
            print(f"{BOLD}Total debits:{RESET}  {RED}${total_debits:,.2f}{RESET}")
            print(f"{BOLD}Total credits:{RESET} {GREEN}${total_credits:,.2f}{RESET}")
            print(f"{BOLD}Net change:{RESET}    ${net_change:,.2f}")
            
            # Validate with running balance if available
            if transactions[0].get('balance') and transactions[-1].get('balance'):
                starting_balance = transactions[0]['balance'] - transactions[0]['amount']
                ending_balance = transactions[-1]['balance']
                calculated_ending = starting_balance + net_change
                
                print(f"\n{BOLD}Balance validation:{RESET}")
                print(f"Starting balance: ${starting_balance:,.2f}")
                print(f"Ending balance:   ${ending_balance:,.2f}")
                print(f"Calculated:       ${calculated_ending:,.2f}")
                
                if abs(ending_balance - calculated_ending) < 0.01:
                    print_success("Balance validation PASSED! ✨")
                else:
                    print_warning(f"Balance mismatch: ${abs(ending_balance - calculated_ending):,.2f}")
            
            # Save to JSON file
            output_file = pdf_path.replace('.pdf', '_extracted.json')
            with open(output_file, 'w') as f:
                json.dump({
                    'success': True,
                    'transactions': transactions,
                    'count': len(transactions),
                    'summary': {
                        'total_debits': total_debits,
                        'total_credits': total_credits,
                        'net_change': net_change
                    }
                }, f, indent=2)
            
            print_success(f"Saved results to: {output_file}")
        
        else:
            print_warning("No transactions extracted!")
            print_info("This might mean:")
            print_info("  1. The PDF doesn't contain a transaction table")
            print_info("  2. The table format is not recognized")
            print_info("  3. The PDF is password protected")
    
    except Exception as e:
        print_error(f"Extraction failed: {str(e)}")
        import traceback
        print("\n" + traceback.format_exc())
        sys.exit(1)
    
    print_header("TEST COMPLETE")
    print_success("pdfplumber extraction works! 🎉")
    print_info("If the results look good, you can deploy to a server with Python support.")
    print()
