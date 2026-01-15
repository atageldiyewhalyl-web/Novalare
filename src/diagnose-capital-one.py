#!/usr/bin/env python3
"""
Diagnostic tool to find exact column positions for Capital One statements
"""

import pdfplumber
import sys

def diagnose_pdf(pdf_path):
    """Extract and display word positions to find column boundaries"""
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"📄 Analyzing: {pdf_path}")
        print(f"📄 Total pages: {len(pdf.pages)}\n")
        
        # Analyze page 2 (where transactions usually start)
        page = pdf.pages[1]  # 0-indexed
        
        print("=" * 80)
        print("PAGE 2 ANALYSIS")
        print("=" * 80)
        
        words = page.extract_words()
        
        # Group words by approximate y-position (rows)
        rows = {}
        for word in words:
            y = round(word['top'])
            if y not in rows:
                rows[y] = []
            rows[y].append(word)
        
        # Print first 15 rows to see transaction structure
        print("\nFirst 15 rows with X-positions:\n")
        
        for i, (y, row_words) in enumerate(sorted(rows.items())[:15]):
            # Sort words by x position
            row_words.sort(key=lambda w: w['x0'])
            
            print(f"Row {i} (y={y}):")
            for word in row_words:
                x = round(word['x0'])
                text = word['text']
                print(f"  x={x:4d} | {text}")
            print()
        
        # Look for a sample transaction row (row with "Apr")
        print("\n" + "=" * 80)
        print("SAMPLE TRANSACTION ROWS (looking for 'Apr'):")
        print("=" * 80 + "\n")
        
        for y, row_words in sorted(rows.items()):
            row_words.sort(key=lambda w: w['x0'])
            row_text = ' '.join([w['text'] for w in row_words])
            
            # Find rows starting with "Apr" (transaction rows)
            if any(w['text'].startswith('Apr') for w in row_words):
                print(f"Row (y={y}):")
                for word in row_words:
                    x = round(word['x0'])
                    text = word['text']
                    width = round(word['x1'] - word['x0'])
                    print(f"  x={x:4d} (width={width:3d}) | {text}")
                print(f"  FULL: {row_text}\n")
                
                # Only show first 3 transaction rows
                break

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python diagnose-capital-one.py <path-to-pdf>")
        sys.exit(1)
    
    diagnose_pdf(sys.argv[1])
