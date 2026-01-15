#!/usr/bin/env python3
"""Test parse_amount fix for US format with commas"""

def parse_amount(amount_str):
    """Parse amount string to float (supports US and EU formats)"""
    if not amount_str or not isinstance(amount_str, str):
        return None
    
    # Remove currency symbols and spaces
    amount_str = amount_str.replace('$', '').replace('€', '').replace('£', '').replace(' ', '').strip()
    
    # Skip empty
    if not amount_str or amount_str == '-':
        return None
    
    # Handle parentheses as negative (accounting notation)
    if amount_str.startswith('(') and amount_str.endswith(')'):
        amount_str = '-' + amount_str[1:-1]
    
    # FIX 2: Support European decimal format (1.234,56)
    # Detect format by checking which separator comes last (rightmost)
    dot_count = amount_str.count('.')
    comma_count = amount_str.count(',')
    
    if comma_count > 0 and dot_count > 0:
        # Both present: check which is the decimal separator (rightmost)
        last_dot_pos = amount_str.rfind('.')
        last_comma_pos = amount_str.rfind(',')
        
        if last_comma_pos > last_dot_pos:
            # European format: 1.234,56 (comma is decimal)
            amount_str = amount_str.replace('.', '').replace(',', '.')
        else:
            # US format: 2,000.00 (dot is decimal)
            amount_str = amount_str.replace(',', '')
    elif comma_count > 0 and dot_count == 0:
        # Only comma: could be European decimal (123,56) or US thousands (1,234)
        # If comma is in last 3 positions from end, likely decimal
        comma_pos = amount_str.rfind(',')
        if len(amount_str) - comma_pos <= 3:
            # Likely European decimal: 123,56 → 123.56
            amount_str = amount_str.replace(',', '.')
        else:
            # Likely US thousands separator: 1,234 → 1234
            amount_str = amount_str.replace(',', '')
    elif dot_count > 1:
        # Multiple dots: European thousands separator (1.234.567 → 1234567)
        amount_str = amount_str.replace('.', '')
    # else: US format with single dot (123.45) - no changes needed
    
    try:
        return float(amount_str)
    except ValueError:
        return None

# Test cases
test_cases = [
    ("$2,000.00", 2000.0),
    ("$10,000.00", 10000.0),
    ("$750.00", 750.0),
    ("$2,500.00", 2500.0),
    ("1.234,56", 1234.56),  # European
    ("1.234.567,89", 1234567.89),  # European
    ("123.45", 123.45),  # US simple
    ("1,234", 1234.0),  # US thousands
    ("123,56", 123.56),  # European simple
]

print("Testing parse_amount()...\n")
all_passed = True
for test_input, expected in test_cases:
    result = parse_amount(test_input)
    status = "✅" if result == expected else "❌"
    print(f"{status} {test_input:20s} → {result:12} (expected {expected})")
    if result != expected:
        all_passed = False

print()
if all_passed:
    print("✅ All tests passed!")
else:
    print("❌ Some tests failed!")
