// Chart of Accounts Templates for Different Industries

export interface Account {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  subtype?: string;
  description?: string;
  isActive: boolean;
}

// ============================================================================
// GENERAL BUSINESS - Standard COA
// ============================================================================
export const GENERAL_BUSINESS_COA: Account[] = [
  // Assets (1000-1999)
  { code: '1000', name: 'Cash', type: 'Asset', subtype: 'Current Asset', description: 'Cash on hand and in bank accounts', isActive: true },
  { code: '1010', name: 'Petty Cash', type: 'Asset', subtype: 'Current Asset', description: 'Small cash fund for minor expenses', isActive: true },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', subtype: 'Current Asset', description: 'Money owed by customers', isActive: true },
  { code: '1200', name: 'Inventory', type: 'Asset', subtype: 'Current Asset', description: 'Goods available for sale', isActive: true },
  { code: '1300', name: 'Prepaid Expenses', type: 'Asset', subtype: 'Current Asset', description: 'Expenses paid in advance', isActive: true },
  { code: '1400', name: 'Prepaid Insurance', type: 'Asset', subtype: 'Current Asset', description: 'Insurance premiums paid in advance', isActive: true },
  { code: '1500', name: 'Equipment', type: 'Asset', subtype: 'Fixed Asset', description: 'Office and business equipment', isActive: true },
  { code: '1510', name: 'Accumulated Depreciation - Equipment', type: 'Asset', subtype: 'Fixed Asset', description: 'Accumulated depreciation on equipment', isActive: true },
  { code: '1600', name: 'Furniture & Fixtures', type: 'Asset', subtype: 'Fixed Asset', description: 'Office furniture and fixtures', isActive: true },
  { code: '1610', name: 'Accumulated Depreciation - Furniture', type: 'Asset', subtype: 'Fixed Asset', description: 'Accumulated depreciation on furniture', isActive: true },
  { code: '1700', name: 'Vehicles', type: 'Asset', subtype: 'Fixed Asset', description: 'Company vehicles', isActive: true },
  { code: '1710', name: 'Accumulated Depreciation - Vehicles', type: 'Asset', subtype: 'Fixed Asset', description: 'Accumulated depreciation on vehicles', isActive: true },
  
  // Liabilities (2000-2999)
  { code: '2000', name: 'Accounts Payable', type: 'Liability', subtype: 'Current Liability', description: 'Money owed to suppliers', isActive: true },
  { code: '2100', name: 'Accrued Expenses', type: 'Liability', subtype: 'Current Liability', description: 'Expenses incurred but not yet paid', isActive: true },
  { code: '2200', name: 'Unearned Revenue', type: 'Liability', subtype: 'Current Liability', description: 'Payments received for future services', isActive: true },
  { code: '2300', name: 'Notes Payable - Short Term', type: 'Liability', subtype: 'Current Liability', description: 'Short-term loans and notes', isActive: true },
  { code: '2400', name: 'Credit Card Payable', type: 'Liability', subtype: 'Current Liability', description: 'Credit card balances owed', isActive: true },
  { code: '2500', name: 'Payroll Liabilities', type: 'Liability', subtype: 'Current Liability', description: 'Wages and taxes payable', isActive: true },
  { code: '2600', name: 'Sales Tax Payable', type: 'Liability', subtype: 'Current Liability', description: 'Sales tax collected from customers', isActive: true },
  { code: '2700', name: 'Notes Payable - Long Term', type: 'Liability', subtype: 'Long-term Liability', description: 'Long-term loans and notes', isActive: true },
  
  // Equity (3000-3999)
  { code: '3000', name: 'Owner\'s Equity', type: 'Equity', subtype: 'Equity', description: 'Owner\'s investment in the business', isActive: true },
  { code: '3100', name: 'Retained Earnings', type: 'Equity', subtype: 'Equity', description: 'Accumulated profits retained in business', isActive: true },
  { code: '3200', name: 'Dividends', type: 'Equity', subtype: 'Equity', description: 'Distributions to owners', isActive: true },
  
  // Revenue (4000-4999)
  { code: '4000', name: 'Sales Revenue', type: 'Revenue', subtype: 'Operating Revenue', description: 'Revenue from product sales', isActive: true },
  { code: '4100', name: 'Service Revenue', type: 'Revenue', subtype: 'Operating Revenue', description: 'Revenue from services provided', isActive: true },
  { code: '4200', name: 'Interest Income', type: 'Revenue', subtype: 'Non-operating Revenue', description: 'Interest earned on investments', isActive: true },
  { code: '4300', name: 'Other Income', type: 'Revenue', subtype: 'Non-operating Revenue', description: 'Miscellaneous income', isActive: true },
  
  // Expenses (5000-6999)
  { code: '5000', name: 'Cost of Goods Sold', type: 'Expense', subtype: 'Cost of Sales', description: 'Direct costs of producing goods sold', isActive: true },
  { code: '6000', name: 'Salaries & Wages', type: 'Expense', subtype: 'Operating Expense', description: 'Employee compensation', isActive: true },
  { code: '6100', name: 'Rent Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Office and facility rent', isActive: true },
  { code: '6200', name: 'Depreciation Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Depreciation of fixed assets', isActive: true },
  { code: '6300', name: 'Insurance Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Business insurance costs', isActive: true },
  { code: '6400', name: 'Utilities Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Electricity, water, gas, internet', isActive: true },
  { code: '6500', name: 'Office Supplies Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Office supplies and materials', isActive: true },
  { code: '6600', name: 'Professional Fees', type: 'Expense', subtype: 'Operating Expense', description: 'Legal, accounting, consulting fees', isActive: true },
  { code: '6700', name: 'Marketing & Advertising', type: 'Expense', subtype: 'Operating Expense', description: 'Marketing and advertising costs', isActive: true },
  { code: '6800', name: 'Travel & Entertainment', type: 'Expense', subtype: 'Operating Expense', description: 'Business travel and entertainment', isActive: true },
  { code: '6900', name: 'Interest Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Interest paid on loans', isActive: true },
  { code: '6950', name: 'Bank Fees', type: 'Expense', subtype: 'Operating Expense', description: 'Banking service charges', isActive: true },
];

// ============================================================================
// PROFESSIONAL SERVICES - Consulting, Law Firms, Accounting Firms
// ============================================================================
export const PROFESSIONAL_SERVICES_COA: Account[] = [
  // Assets
  { code: '1000', name: 'Operating Cash Account', type: 'Asset', subtype: 'Current Asset', description: 'Main business checking account', isActive: true },
  { code: '1050', name: 'Client Trust Account', type: 'Asset', subtype: 'Current Asset', description: 'Client funds held in trust', isActive: true },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', subtype: 'Current Asset', description: 'Unbilled services and outstanding invoices', isActive: true },
  { code: '1150', name: 'Retainer Receivable', type: 'Asset', subtype: 'Current Asset', description: 'Client retainers and prepayments', isActive: true },
  { code: '1300', name: 'Prepaid Expenses', type: 'Asset', subtype: 'Current Asset', description: 'Prepaid insurance, rent, licenses', isActive: true },
  { code: '1500', name: 'Computer Equipment', type: 'Asset', subtype: 'Fixed Asset', description: 'Computers, servers, IT equipment', isActive: true },
  { code: '1510', name: 'Accumulated Depreciation - Equipment', type: 'Asset', subtype: 'Fixed Asset', description: 'Depreciation on equipment', isActive: true },
  { code: '1600', name: 'Office Furniture', type: 'Asset', subtype: 'Fixed Asset', description: 'Desks, chairs, conference tables', isActive: true },
  { code: '1800', name: 'Leasehold Improvements', type: 'Asset', subtype: 'Fixed Asset', description: 'Office renovations and improvements', isActive: true },
  
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'Liability', subtype: 'Current Liability', description: 'Vendor invoices payable', isActive: true },
  { code: '2050', name: 'Client Trust Liability', type: 'Liability', subtype: 'Current Liability', description: 'Client funds held in trust', isActive: true },
  { code: '2200', name: 'Deferred Revenue', type: 'Liability', subtype: 'Current Liability', description: 'Retainers and advance payments', isActive: true },
  { code: '2500', name: 'Payroll Liabilities', type: 'Liability', subtype: 'Current Liability', description: 'Wages, taxes, benefits payable', isActive: true },
  { code: '2600', name: 'Professional Liability Insurance Payable', type: 'Liability', subtype: 'Current Liability', description: 'Malpractice insurance payable', isActive: true },
  
  // Equity
  { code: '3000', name: 'Partners Capital', type: 'Equity', subtype: 'Equity', description: 'Partner ownership accounts', isActive: true },
  { code: '3100', name: 'Retained Earnings', type: 'Equity', subtype: 'Equity', description: 'Accumulated earnings', isActive: true },
  { code: '3200', name: 'Partner Distributions', type: 'Equity', subtype: 'Equity', description: 'Distributions to partners', isActive: true },
  
  // Revenue
  { code: '4000', name: 'Professional Fees - Billable Hours', type: 'Revenue', subtype: 'Operating Revenue', description: 'Hourly billing revenue', isActive: true },
  { code: '4100', name: 'Project Fees - Fixed Price', type: 'Revenue', subtype: 'Operating Revenue', description: 'Fixed-fee project revenue', isActive: true },
  { code: '4200', name: 'Retainer Fees', type: 'Revenue', subtype: 'Operating Revenue', description: 'Monthly retainer revenue', isActive: true },
  { code: '4300', name: 'Success Fees', type: 'Revenue', subtype: 'Operating Revenue', description: 'Performance-based fees', isActive: true },
  { code: '4400', name: 'Reimbursable Expenses', type: 'Revenue', subtype: 'Operating Revenue', description: 'Client expense reimbursements', isActive: true },
  
  // Expenses
  { code: '6000', name: 'Professional Salaries', type: 'Expense', subtype: 'Operating Expense', description: 'Partner and associate salaries', isActive: true },
  { code: '6050', name: 'Support Staff Salaries', type: 'Expense', subtype: 'Operating Expense', description: 'Administrative staff salaries', isActive: true },
  { code: '6100', name: 'Office Rent', type: 'Expense', subtype: 'Operating Expense', description: 'Office space rental', isActive: true },
  { code: '6200', name: 'Professional Development', type: 'Expense', subtype: 'Operating Expense', description: 'Training, certifications, conferences', isActive: true },
  { code: '6250', name: 'Professional Liability Insurance', type: 'Expense', subtype: 'Operating Expense', description: 'Malpractice and E&O insurance', isActive: true },
  { code: '6300', name: 'Software Subscriptions', type: 'Expense', subtype: 'Operating Expense', description: 'Practice management, research tools', isActive: true },
  { code: '6400', name: 'Legal Research & Subscriptions', type: 'Expense', subtype: 'Operating Expense', description: 'Legal databases and publications', isActive: true },
  { code: '6500', name: 'Client Development', type: 'Expense', subtype: 'Operating Expense', description: 'Business development and networking', isActive: true },
  { code: '6600', name: 'Outsourced Services', type: 'Expense', subtype: 'Operating Expense', description: 'Contract professionals and specialists', isActive: true },
  { code: '6700', name: 'Travel - Client Related', type: 'Expense', subtype: 'Operating Expense', description: 'Client meeting travel expenses', isActive: true },
];

// ============================================================================
// RETAIL / E-COMMERCE
// ============================================================================
export const RETAIL_COA: Account[] = [
  // Assets
  { code: '1000', name: 'Cash - Main Account', type: 'Asset', subtype: 'Current Asset', description: 'Primary checking account', isActive: true },
  { code: '1020', name: 'Cash - Payment Processor', type: 'Asset', subtype: 'Current Asset', description: 'Stripe, PayPal, Square balances', isActive: true },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', subtype: 'Current Asset', description: 'B2B customer invoices', isActive: true },
  { code: '1200', name: 'Inventory - Finished Goods', type: 'Asset', subtype: 'Current Asset', description: 'Products ready for sale', isActive: true },
  { code: '1250', name: 'Inventory - In Transit', type: 'Asset', subtype: 'Current Asset', description: 'Inventory being shipped to warehouse', isActive: true },
  { code: '1300', name: 'Prepaid Inventory', type: 'Asset', subtype: 'Current Asset', description: 'Deposits on inventory orders', isActive: true },
  { code: '1500', name: 'Store Fixtures & Equipment', type: 'Asset', subtype: 'Fixed Asset', description: 'Shelving, displays, POS systems', isActive: true },
  { code: '1510', name: 'Accumulated Depreciation - Fixtures', type: 'Asset', subtype: 'Fixed Asset', description: 'Depreciation on fixtures', isActive: true },
  { code: '1600', name: 'Leasehold Improvements', type: 'Asset', subtype: 'Fixed Asset', description: 'Store build-out and renovations', isActive: true },
  
  // Liabilities
  { code: '2000', name: 'Accounts Payable - Inventory', type: 'Liability', subtype: 'Current Liability', description: 'Supplier invoices for inventory', isActive: true },
  { code: '2050', name: 'Accounts Payable - Operating', type: 'Liability', subtype: 'Current Liability', description: 'Operating expense payables', isActive: true },
  { code: '2100', name: 'Sales Tax Payable', type: 'Liability', subtype: 'Current Liability', description: 'Sales tax collected', isActive: true },
  { code: '2200', name: 'Customer Deposits', type: 'Liability', subtype: 'Current Liability', description: 'Prepayments and layaways', isActive: true },
  { code: '2300', name: 'Gift Card Liability', type: 'Liability', subtype: 'Current Liability', description: 'Outstanding gift card balances', isActive: true },
  { code: '2400', name: 'Returns & Refunds Payable', type: 'Liability', subtype: 'Current Liability', description: 'Pending customer refunds', isActive: true },
  { code: '2500', name: 'Merchant Processing Fees Payable', type: 'Liability', subtype: 'Current Liability', description: 'Payment processor fees', isActive: true },
  
  // Equity
  { code: '3000', name: 'Owner\'s Equity', type: 'Equity', subtype: 'Equity', description: 'Owner investment', isActive: true },
  { code: '3100', name: 'Retained Earnings', type: 'Equity', subtype: 'Equity', description: 'Accumulated profits', isActive: true },
  
  // Revenue
  { code: '4000', name: 'Retail Sales - In Store', type: 'Revenue', subtype: 'Operating Revenue', description: 'Physical store sales', isActive: true },
  { code: '4100', name: 'Online Sales', type: 'Revenue', subtype: 'Operating Revenue', description: 'E-commerce website sales', isActive: true },
  { code: '4200', name: 'Wholesale Sales', type: 'Revenue', subtype: 'Operating Revenue', description: 'B2B bulk sales', isActive: true },
  { code: '4300', name: 'Shipping & Handling Revenue', type: 'Revenue', subtype: 'Operating Revenue', description: 'Shipping fees collected', isActive: true },
  { code: '4900', name: 'Sales Returns & Allowances', type: 'Revenue', subtype: 'Operating Revenue', description: 'Product returns (contra-revenue)', isActive: true },
  { code: '4950', name: 'Sales Discounts', type: 'Revenue', subtype: 'Operating Revenue', description: 'Promotional discounts (contra-revenue)', isActive: true },
  
  // Cost of Sales
  { code: '5000', name: 'Cost of Goods Sold', type: 'Expense', subtype: 'Cost of Sales', description: 'Product costs', isActive: true },
  { code: '5100', name: 'Freight & Shipping - Inbound', type: 'Expense', subtype: 'Cost of Sales', description: 'Inbound shipping costs', isActive: true },
  { code: '5200', name: 'Inventory Shrinkage', type: 'Expense', subtype: 'Cost of Sales', description: 'Theft, damage, obsolescence', isActive: true },
  
  // Expenses
  { code: '6000', name: 'Store Rent', type: 'Expense', subtype: 'Operating Expense', description: 'Retail space rent', isActive: true },
  { code: '6100', name: 'Sales Staff Wages', type: 'Expense', subtype: 'Operating Expense', description: 'Sales associate payroll', isActive: true },
  { code: '6200', name: 'Merchant Processing Fees', type: 'Expense', subtype: 'Operating Expense', description: 'Credit card processing fees', isActive: true },
  { code: '6300', name: 'E-commerce Platform Fees', type: 'Expense', subtype: 'Operating Expense', description: 'Shopify, WooCommerce, etc.', isActive: true },
  { code: '6400', name: 'Marketing & Advertising', type: 'Expense', subtype: 'Operating Expense', description: 'Advertising campaigns', isActive: true },
  { code: '6500', name: 'Packaging Supplies', type: 'Expense', subtype: 'Operating Expense', description: 'Boxes, bags, tissue paper', isActive: true },
  { code: '6600', name: 'Shipping & Fulfillment - Outbound', type: 'Expense', subtype: 'Operating Expense', description: 'Customer shipping costs', isActive: true },
  { code: '6700', name: 'Warehouse & Storage', type: 'Expense', subtype: 'Operating Expense', description: '3PL and storage fees', isActive: true },
];

// ============================================================================
// REAL ESTATE
// ============================================================================
export const REAL_ESTATE_COA: Account[] = [
  // Assets
  { code: '1000', name: 'Operating Cash', type: 'Asset', subtype: 'Current Asset', description: 'Main operating account', isActive: true },
  { code: '1050', name: 'Security Deposits Held', type: 'Asset', subtype: 'Current Asset', description: 'Tenant security deposits', isActive: true },
  { code: '1100', name: 'Rent Receivable', type: 'Asset', subtype: 'Current Asset', description: 'Outstanding rent payments', isActive: true },
  { code: '1500', name: 'Land', type: 'Asset', subtype: 'Fixed Asset', description: 'Land holdings', isActive: true },
  { code: '1600', name: 'Buildings & Improvements', type: 'Asset', subtype: 'Fixed Asset', description: 'Property structures', isActive: true },
  { code: '1610', name: 'Accumulated Depreciation - Buildings', type: 'Asset', subtype: 'Fixed Asset', description: 'Building depreciation', isActive: true },
  { code: '1700', name: 'Rental Property - Residential', type: 'Asset', subtype: 'Fixed Asset', description: 'Residential rental properties', isActive: true },
  { code: '1800', name: 'Rental Property - Commercial', type: 'Asset', subtype: 'Fixed Asset', description: 'Commercial rental properties', isActive: true },
  
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'Liability', subtype: 'Current Liability', description: 'Operating payables', isActive: true },
  { code: '2050', name: 'Security Deposits Liability', type: 'Liability', subtype: 'Current Liability', description: 'Tenant deposits held', isActive: true },
  { code: '2100', name: 'Prepaid Rent Liability', type: 'Liability', subtype: 'Current Liability', description: 'Rent collected in advance', isActive: true },
  { code: '2200', name: 'Property Tax Payable', type: 'Liability', subtype: 'Current Liability', description: 'Property taxes owed', isActive: true },
  { code: '2700', name: 'Mortgage Payable', type: 'Liability', subtype: 'Long-term Liability', description: 'Property mortgages', isActive: true },
  
  // Equity
  { code: '3000', name: 'Owner\'s Equity', type: 'Equity', subtype: 'Equity', description: 'Owner capital', isActive: true },
  { code: '3100', name: 'Retained Earnings', type: 'Equity', subtype: 'Equity', description: 'Accumulated earnings', isActive: true },
  
  // Revenue
  { code: '4000', name: 'Rental Income - Residential', type: 'Revenue', subtype: 'Operating Revenue', description: 'Residential rent collected', isActive: true },
  { code: '4100', name: 'Rental Income - Commercial', type: 'Revenue', subtype: 'Operating Revenue', description: 'Commercial rent collected', isActive: true },
  { code: '4200', name: 'Late Fees', type: 'Revenue', subtype: 'Operating Revenue', description: 'Late payment fees', isActive: true },
  { code: '4300', name: 'Pet Fees', type: 'Revenue', subtype: 'Operating Revenue', description: 'Pet rent and deposits', isActive: true },
  { code: '4400', name: 'Parking Fees', type: 'Revenue', subtype: 'Operating Revenue', description: 'Parking space rental', isActive: true },
  
  // Expenses
  { code: '6000', name: 'Property Management Fees', type: 'Expense', subtype: 'Operating Expense', description: 'Management company fees', isActive: true },
  { code: '6100', name: 'Repairs & Maintenance', type: 'Expense', subtype: 'Operating Expense', description: 'Property upkeep and repairs', isActive: true },
  { code: '6200', name: 'Property Tax Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Annual property taxes', isActive: true },
  { code: '6300', name: 'Property Insurance', type: 'Expense', subtype: 'Operating Expense', description: 'Property insurance premiums', isActive: true },
  { code: '6400', name: 'Utilities - Owner Paid', type: 'Expense', subtype: 'Operating Expense', description: 'Utilities paid by owner', isActive: true },
  { code: '6500', name: 'HOA Fees', type: 'Expense', subtype: 'Operating Expense', description: 'Homeowners association fees', isActive: true },
  { code: '6600', name: 'Landscaping & Grounds', type: 'Expense', subtype: 'Operating Expense', description: 'Lawn care and landscaping', isActive: true },
  { code: '6700', name: 'Snow Removal', type: 'Expense', subtype: 'Operating Expense', description: 'Winter maintenance', isActive: true },
  { code: '6800', name: 'Mortgage Interest Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Interest on property loans', isActive: true },
  { code: '6900', name: 'Depreciation Expense', type: 'Expense', subtype: 'Operating Expense', description: 'Building depreciation', isActive: true },
];

// ============================================================================
// SAAS / TECHNOLOGY
// ============================================================================
export const SAAS_COA: Account[] = [
  // Assets
  { code: '1000', name: 'Operating Cash', type: 'Asset', subtype: 'Current Asset', description: 'Main bank account', isActive: true },
  { code: '1020', name: 'Payment Processor Balance', type: 'Asset', subtype: 'Current Asset', description: 'Stripe/PayPal balance', isActive: true },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', subtype: 'Current Asset', description: 'Enterprise customer invoices', isActive: true },
  { code: '1500', name: 'Computer Equipment', type: 'Asset', subtype: 'Fixed Asset', description: 'Servers and hardware', isActive: true },
  { code: '1600', name: 'Software Development Costs', type: 'Asset', subtype: 'Intangible Asset', description: 'Capitalized development', isActive: true },
  
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'Liability', subtype: 'Current Liability', description: 'Vendor bills', isActive: true },
  { code: '2100', name: 'Deferred Revenue - Monthly', type: 'Liability', subtype: 'Current Liability', description: 'Monthly subscriptions prepaid', isActive: true },
  { code: '2150', name: 'Deferred Revenue - Annual', type: 'Liability', subtype: 'Current Liability', description: 'Annual subscriptions prepaid', isActive: true },
  { code: '2200', name: 'Customer Credits', type: 'Liability', subtype: 'Current Liability', description: 'Account credits and refunds', isActive: true },
  
  // Equity
  { code: '3000', name: 'Common Stock', type: 'Equity', subtype: 'Equity', description: 'Shareholder equity', isActive: true },
  { code: '3100', name: 'Retained Earnings', type: 'Equity', subtype: 'Equity', description: 'Accumulated profits', isActive: true },
  
  // Revenue
  { code: '4000', name: 'Subscription Revenue - Monthly', type: 'Revenue', subtype: 'Operating Revenue', description: 'Monthly recurring revenue', isActive: true },
  { code: '4100', name: 'Subscription Revenue - Annual', type: 'Revenue', subtype: 'Operating Revenue', description: 'Annual recurring revenue', isActive: true },
  { code: '4200', name: 'Professional Services Revenue', type: 'Revenue', subtype: 'Operating Revenue', description: 'Implementation and consulting', isActive: true },
  { code: '4300', name: 'Usage-Based Revenue', type: 'Revenue', subtype: 'Operating Revenue', description: 'Overage and usage fees', isActive: true },
  
  // Expenses
  { code: '5000', name: 'Cloud Hosting - AWS/GCP', type: 'Expense', subtype: 'Cost of Revenue', description: 'Infrastructure costs', isActive: true },
  { code: '5100', name: 'Third-Party API Costs', type: 'Expense', subtype: 'Cost of Revenue', description: 'External API usage', isActive: true },
  { code: '5200', name: 'Payment Processing Fees', type: 'Expense', subtype: 'Cost of Revenue', description: 'Stripe/PayPal fees', isActive: true },
  { code: '6000', name: 'Engineering Salaries', type: 'Expense', subtype: 'Operating Expense', description: 'Development team payroll', isActive: true },
  { code: '6100', name: 'Product & Design Salaries', type: 'Expense', subtype: 'Operating Expense', description: 'Product team payroll', isActive: true },
  { code: '6200', name: 'Sales & Marketing Salaries', type: 'Expense', subtype: 'Operating Expense', description: 'GTM team payroll', isActive: true },
  { code: '6300', name: 'Software Subscriptions', type: 'Expense', subtype: 'Operating Expense', description: 'Tools and SaaS platforms', isActive: true },
  { code: '6400', name: 'Paid Advertising', type: 'Expense', subtype: 'Operating Expense', description: 'Google Ads, Facebook Ads', isActive: true },
  { code: '6500', name: 'Customer Support Costs', type: 'Expense', subtype: 'Operating Expense', description: 'Support tools and staffing', isActive: true },
];

// Export templates map
export const COA_TEMPLATES = {
  'general-business': {
    name: 'General Business',
    description: 'Standard chart of accounts suitable for most businesses',
    accounts: GENERAL_BUSINESS_COA,
  },
  'professional-services': {
    name: 'Professional Services',
    description: 'For consulting firms, law firms, accounting practices',
    accounts: PROFESSIONAL_SERVICES_COA,
  },
  'retail': {
    name: 'Retail / E-commerce',
    description: 'For retail stores, online shops, and e-commerce businesses',
    accounts: RETAIL_COA,
  },
  'real-estate': {
    name: 'Real Estate',
    description: 'For property management and real estate investment',
    accounts: REAL_ESTATE_COA,
  },
  'saas': {
    name: 'SaaS / Technology',
    description: 'For software companies and subscription businesses',
    accounts: SAAS_COA,
  },
};

export type TemplateKey = keyof typeof COA_TEMPLATES;
