import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

/**
 * AR NETTING LOGIC: Apply Credit Memos to Invoices
 * For each customer, we combine their invoices (+) and credit memos (-) 
 * to find the true amount owed. This prevents "fake mismatches" where a 
 * payment for $400 is matched against a $500 invoice, ignoring a $100 credit.
 */
function applyARNetting(arInvoicesRaw: any[]): any[] {
  if (!arInvoicesRaw || arInvoicesRaw.length === 0) return [];

  console.log(`⚖️ Applying netting logic to ${arInvoicesRaw.length} AR entries...`);

  const arInvoices: any[] = [];
  const customerGroups = new Map<string, any[]>();

  // Group entries by customer name
  arInvoicesRaw.forEach((entry: any) => {
    const name = (entry.name || entry.customer || 'Unknown Customer').trim();
    if (!customerGroups.has(name)) {
      customerGroups.set(name, []);
    }
    customerGroups.get(name)!.push({ ...entry });
  });

  // Process each customer group
  customerGroups.forEach((entries: any[], customerName: string) => {
    const invoices = entries.filter((e: any) => e.transaction_type?.toLowerCase().includes('invoice') || e.amount > 0);
    const credits = entries.filter((e: any) => e.transaction_type?.toLowerCase().includes('credit') || e.amount < 0);

    if (credits.length === 0) {
      arInvoices.push(...invoices);
      return;
    }

    // Log each credit memo being netted
    console.log(`   🔗 Netting ${credits.length} credits for ${customerName}:`);
    credits.forEach((c: any) => {
      console.log(`      📋 ${c.num || c.invoice_number || 'N/A'}: -$${Math.abs(c.amount || 0).toFixed(2)}`);
    });

    // Sort invoices by date (FIFO application of credits)
    invoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let totalCredit = Math.abs(credits.reduce((sum: number, c: any) => sum + (c.amount || 0), 0));
    console.log(`      💰 Total credit being applied: $${totalCredit.toFixed(2)}`);

    const creditMemoNumbers = credits.map((c: any) => c.num || c.invoice_number || c.reference).filter(Boolean).join(', ');

    for (const invoice of invoices) {
      if (totalCredit <= 0) {
        arInvoices.push(invoice);
        continue;
      }

      const grossAmount = invoice.amount;
      const reduction = Math.min(grossAmount, totalCredit);

      // New: Track specific credits being applied to this invoice
      const appliedCreditsDetails: any[] = [];
      let remainingReduction = reduction;

      // Iterate through credits to find which ones make up this reduction
      // Note: This matches credits FIFO to the invoices FIFO
      // Since we just have a pool of "totalCredit", we simulate the allocation
      for (const credit of credits) {
        if (remainingReduction <= 0) break;

        // Skip credits already fully used (we need to track this, but for simplicity in this stateless pass
        // we can assume credits are consumed in order. A more robust way is to track used amount on credit objects)
        const creditAmount = Math.abs(credit.amount || 0);
        const creditUsed = credit.used_amount || 0;
        const available = creditAmount - creditUsed;

        if (available > 0) {
          const toApply = Math.min(remainingReduction, available);

          appliedCreditsDetails.push({
            date: credit.date,
            ref: credit.num || credit.invoice_number || credit.reference,
            amount: -toApply, // Display as negative
            currency: credit.currency
          });

          // Mark this credit as used (partially or fully)
          credit.used_amount = (credit.used_amount || 0) + toApply;
          remainingReduction -= toApply;
        }
      }

      invoice.gross_amount = grossAmount;
      invoice.amount = grossAmount - reduction;
      invoice.applied_credits = reduction;
      invoice.credit_memo_details = appliedCreditsDetails;
      invoice.credit_memo_refs = appliedCreditsDetails.map(c => c.ref).join(', ');

      if (reduction > 0) {
        invoice.explanation = `${invoice.explanation || ''} (Net of Credit Memos: ${invoice.credit_memo_refs})`.trim();
      }

      totalCredit -= reduction;
      arInvoices.push(invoice);
    }

    // If there's leftover credit after applying to all invoices, we keep it as a negative "Invoice"
    // to allow matching against future overpayments if needed, but usually these remain unmatched.
    if (totalCredit > 0) {
      arInvoices.push({
        ...credits[0],
        amount: -totalCredit,
        transaction_type: 'Unapplied Credit',
        name: customerName,
        explanation: 'Remaining unapplied credit balance'
      });
    }
  });

  return arInvoices;
}

const app = new Hono().basePath('/make-server-53c2e113');

// ============================================
// HYBRID AR LEDGER PARSERS (Fast - AI only for column detection)
// ============================================

/**
 * Parse CSV AR ledger using hybrid approach:
 * 1. AI analyzes first 20 rows to detect column structure
 * 2. Code parses all remaining rows using detected structure
 */
async function parseARLedgerCSV(uint8Array: Uint8Array, fileName: string): Promise<any[]> {
  const textDecoder = new TextDecoder('utf-8');
  const csvText = textDecoder.decode(uint8Array);
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const sampleRows = lines.slice(0, 20).join('\n');  // Only send first 20 rows to AI

  const prompt = `Analyze this CSV AR (Accounts Receivable) ledger and identify the column indices.

CSV SAMPLE (first 20 rows only):
${sampleRows}

CRITICAL INSTRUCTIONS:

1. **AR Ledger Format:**
   - This is a simple invoice ledger, NOT a general ledger
   - Expected columns: Invoice #, Customer, Invoice Date, Amount (and optionally Currency, Due Date)
   - There should be ONE amount column with invoice amounts (all positive values)
   - DO NOT look for debit/credit columns - AR invoices are simply amounts owed

2. **Column Detection:**
   - invoice_number_column: Invoice number, reference, or ID (CRITICAL for matching)
   - customer_column: Customer/client name (CRITICAL - look for "Customer", "Client", "Company", etc.)
   - date_column: Invoice date or transaction date
   - amount_column: Invoice amount - this is THE primary amount column (CRITICAL)
   - currency_column: Currency code like "USD", "EUR", "GBP" (optional)
   - due_date_column: Payment due date (optional)
   - description_column: Description, memo, or line item details (optional - may not exist)

3. **CRITICAL: CSV Parsing with Embedded Commas**
   - CSV files may have amounts with comma as thousands separator (e.g., "1,858.56" or "2,470.49")
   - These amounts may be QUOTED to prevent splitting (e.g., "1,858.56")
   - Be extremely careful - the amount column should contain numbers like 1858.56, 2470.49, NOT small numbers like 1 or 2
   - If you see very small numbers (< 100) next to larger numbers, the larger number is likely the correct amount
   - Look for patterns: if amounts vary widely (e.g., 877.27, 943.08, 1858.56), you found the right column
   - Look at MULTIPLE rows to confirm the amount column - don't just check the header

4. **Number Format Detection:**
   - European format: 1.858,56 (period as thousands, comma as decimal)
   - US/International format: 1,858.56 (comma as thousands, period as decimal)
   - Detect which format is used by examining the actual data rows
   - Return "number_format": "EU" or "US" based on what you detect

5. **Currency Detection:**
   - Look for currency codes in a dedicated column (USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, etc.)
   - Extract ACTUAL currency from the document - check the data rows, not just the header
   - DO NOT default to USD if you see EUR in the data

6. **Status Column - IGNORE IT:**
   - DO NOT return a status_column even if you see one labeled "Status", "Open", "Paid", etc.
   - Status will be DETERMINED by reconciliation, not imported from the ledger
   - Set status_column to null

Return JSON with:
{
  "invoice_number_column": index (CRITICAL),
  "customer_column": index (CRITICAL),
  "date_column": index,
  "amount_column": index (CRITICAL - the main invoice amount),
  "currency_column": index or null,
  "due_date_column": index or null,
  "description_column": index or null,
  "status_column": null (always null - status is determined by reconciliation),
  "header_row": row index,
  "number_format": "US" or "EU",
  "default_currency": "USD" (or actual currency found: EUR, GBP, JPY, CAD, etc.)
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a spreadsheet analysis expert specializing in AR accounting formats.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const aiResponse = await response.json();
  const columnMap = JSON.parse(aiResponse.choices[0].message.content);

  console.log('📊 AR Ledger CSV column mapping:', columnMap);
  console.log(`   Customer column: ${columnMap.customer_column !== null ? `Index ${columnMap.customer_column} ✅` : 'Not detected ⚠️'}`);
  console.log(`   Invoice # column: ${columnMap.invoice_number_column !== null ? `Index ${columnMap.invoice_number_column} ✅` : 'Not detected ⚠️'}`);
  console.log(`   Amount column: ${columnMap.amount_column !== null ? `Index ${columnMap.amount_column} ✅` : 'Not detected ⚠️'}`);
  console.log(`   Number format: ${columnMap.number_format || 'US'}`);
  console.log(`   Currency: ${columnMap.default_currency || 'USD'}`);

  // Proper CSV parsing function that handles quoted fields
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());
    return result;
  }

  // Parse number based on detected format
  function parseAmount(amountStr: string, numberFormat: string): number {
    if (!amountStr) return 0;

    // Remove any currency symbols and whitespace
    let cleaned = String(amountStr).trim().replace(/[€$£¥₹]/g, '');

    if (numberFormat === 'EU') {
      // European: 1.858,56 -> convert to 1858.56
      // Remove periods (thousands separator) and replace comma with period (decimal)
      cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // US/International: 1,858.56 -> remove commas
      cleaned = cleaned.replace(/,/g, '');
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }

  // Now parse ALL entries using the detected column structure
  const entries: any[] = [];
  for (let i = columnMap.header_row + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Use proper CSV parser that handles quoted fields
    const columns = parseCSVLine(line);

    const dateStr = columns[columnMap.date_column];
    if (!dateStr) continue;

    const description = columnMap.description_column !== null ? columns[columnMap.description_column] : '';
    const customer = columnMap.customer_column !== null ? columns[columnMap.customer_column] : null;
    const invoiceNumber = columnMap.invoice_number_column !== null ? columns[columnMap.invoice_number_column] : null;
    const dueDate = columnMap.due_date_column !== null ? columns[columnMap.due_date_column] : null;
    const currency = columnMap.currency_column !== null ? columns[columnMap.currency_column] : (columnMap.default_currency || 'USD');

    if (!columnMap.currency_column && !columnMap.default_currency) {
      console.warn(`⚠️ No currency found in AR ledger for entry "${description}" - defaulting to USD`);
    }

    // Parse amount using detected number format
    const amountStr = columnMap.amount_column !== null ? columns[columnMap.amount_column] : null;
    if (!amountStr) continue;

    const rawAmount = parseAmount(amountStr, columnMap.number_format || 'US');

    // Validate amount - warn if it seems too small
    if (rawAmount < 10 && i < columnMap.header_row + 5) {
      console.warn(`⚠️ Row ${i}: Amount seems unusually small (${rawAmount}). Raw value: "${amountStr}". Check if column detection is correct.`);
    }

    // For AR invoices, all amounts should be positive (amounts owed TO the company)
    entries.push({
      id: `entry-${i}`,
      date: dateStr,
      description,
      amount: rawAmount, // Always positive for AR invoices
      currency,
      invoice_number: invoiceNumber,
      customer,
      due_date: dueDate,
    });
  }

  console.log(`✅ Parsed ${entries.length} AR ledger entries from CSV`);
  return entries;
}

/**
 * Parse XLSX AR ledger using hybrid approach
 */
async function parseARLedgerXLSX(uint8Array: Uint8Array, fileName: string): Promise<any[]> {
  const XLSX = await import('npm:xlsx');

  const workbook = XLSX.read(uint8Array, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('XLSX file must have at least a header row and one data row');
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const sampleRows = JSON.stringify(jsonData.slice(0, 15), null, 2);  // Only send first 15 rows to AI

  const prompt = `Analyze this XLSX AR (Accounts Receivable) ledger and identify the column indices.

XLSX SAMPLE (first 15 rows only):
${sampleRows}

CRITICAL INSTRUCTIONS:

1. **AR Ledger Format:**
   - This is a simple invoice ledger, NOT a general ledger
   - Expected columns: Invoice #, Customer, Invoice Date, Amount (and optionally Currency, Due Date)
   - There should be ONE amount column with invoice amounts (all positive values)
   - DO NOT look for debit/credit columns - AR invoices are simply amounts owed

2. **Column Detection:**
   - invoice_number_column: Invoice number, reference, or ID (CRITICAL for matching)
   - customer_column: Customer/client name (CRITICAL - look for "Customer", "Client", "Company", etc.)
   - date_column: Invoice date or transaction date
   - amount_column: Invoice amount - this is THE primary amount column (CRITICAL)
   - currency_column: Currency code like "USD", "EUR", "GBP" (optional)
   - due_date_column: Payment due date (optional)
   - description_column: Description, memo, or line item details (optional - may not exist)

3. **Number Format Detection:**
   - European format: 1.858,56 (period as thousands, comma as decimal)
   - US/International format: 1,858.56 (comma as thousands, period as decimal)
   - Detect which format is used by examining the actual data rows
   - Return "number_format": "EU" or "US" based on what you detect

4. **Currency Detection:**
   - Look for currency codes in a dedicated column (USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, etc.)
   - Extract ACTUAL currency from the document - check the data rows, not just the header
   - DO NOT default to USD if you see EUR in the data

5. **Status Column - IGNORE IT:**
   - DO NOT return a status_column even if you see one labeled "Status", "Open", "Paid", etc.
   - Status will be DETERMINED by reconciliation, not imported from the ledger
   - Set status_column to null

Return JSON with:
{
  "invoice_number_column": index (CRITICAL),
  "customer_column": index (CRITICAL),
  "date_column": index,
  "amount_column": index (CRITICAL - the main invoice amount),
  "currency_column": index or null,
  "due_date_column": index or null,
  "description_column": index or null,
  "status_column": null (always null - status is determined by reconciliation),
  "header_row": row index,
  "number_format": "US" or "EU",
  "default_currency": "USD" (or actual currency found: EUR, GBP, JPY, CAD, etc.)
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a spreadsheet analysis expert specializing in AR accounting formats.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const aiResponse = await response.json();
  const columnMap = JSON.parse(aiResponse.choices[0].message.content);

  console.log('📊 AR Ledger XLSX column mapping:', columnMap);
  console.log(`   Customer column: ${columnMap.customer_column !== null ? `Index ${columnMap.customer_column} ✅` : 'Not detected ⚠️'}`);
  console.log(`   Invoice # column: ${columnMap.invoice_number_column !== null ? `Index ${columnMap.invoice_number_column} ✅` : 'Not detected ⚠️'}`);
  console.log(`   Amount column: ${columnMap.amount_column !== null ? `Index ${columnMap.amount_column} ✅` : 'Not detected ⚠️'}`);
  console.log(`   Number format: ${columnMap.number_format || 'US'}`);
  console.log(`   Currency: ${columnMap.default_currency || 'USD'}`);

  // Parse number based on detected format
  function parseAmount(amountVal: any, numberFormat: string): number {
    if (!amountVal) return 0;

    let amountStr = String(amountVal).trim();

    // Remove any currency symbols and whitespace
    amountStr = amountStr.replace(/[€$£¥₹]/g, '');

    if (numberFormat === 'EU') {
      // European: 1.858,56 -> convert to 1858.56
      // Remove periods (thousands separator) and replace comma with period (decimal)
      amountStr = amountStr.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // US/International: 1,858.56 -> remove commas
      amountStr = amountStr.replace(/,/g, '');
    }

    const parsed = parseFloat(amountStr);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }

  // Now parse ALL entries using the detected column structure
  const entries: any[] = [];
  for (let i = columnMap.header_row + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    if (!row || row.length === 0) continue;

    const dateStr = row[columnMap.date_column];
    if (!dateStr) continue;

    const description = columnMap.description_column !== null ? row[columnMap.description_column] : '';
    const customer = columnMap.customer_column !== null ? row[columnMap.customer_column] : null;
    const invoiceNumber = columnMap.invoice_number_column !== null ? row[columnMap.invoice_number_column] : null;
    const dueDate = columnMap.due_date_column !== null ? row[columnMap.due_date_column] : null;
    const currency = columnMap.currency_column !== null ? row[columnMap.currency_column] : (columnMap.default_currency || 'USD');

    if (!columnMap.currency_column && !columnMap.default_currency) {
      console.warn(`⚠️ No currency found in AR ledger for entry "${description}" - defaulting to USD`);
    }

    // Parse amount using detected number format
    const amountVal = columnMap.amount_column !== null ? row[columnMap.amount_column] : null;
    if (!amountVal) continue;

    const rawAmount = parseAmount(amountVal, columnMap.number_format || 'US');

    // Validate amount - warn if it seems too small
    if (rawAmount < 10 && i < columnMap.header_row + 5) {
      console.warn(`⚠️ Row ${i}: Amount seems unusually small (${rawAmount}). Raw value: "${amountVal}". Check if column detection is correct.`);
    }

    // For AR invoices, all amounts should be positive (amounts owed TO the company)
    entries.push({
      id: `entry-${i}`,
      date: dateStr,
      description,
      amount: rawAmount, // Always positive for AR invoices
      currency,
      invoice_number: invoiceNumber,
      customer,
      due_date: dueDate,
    });
  }

  console.log(`✅ Parsed ${entries.length} AR ledger entries from XLSX`);
  return entries;
}

// GET /ar-rec/bank-inflows - Fetch bank inflows (customer payments) from existing bank data
app.get('/ar-rec/bank-inflows', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'Missing companyId or period' }, 400);
    }

    console.log(`📥 Fetching bank inflows for company ${companyId}, period ${period}`);

    // Fetch bank data from ALL possible locations
    let allTransactions: any[] = [];

    // Try old format first (company-wide data)
    const oldKey = `bank-rec:${companyId}:${period}:bank-data`;
    const oldBankData = await kv.get(oldKey);
    if (oldBankData?.transactions) {
      console.log(`✅ Found ${oldBankData.transactions.length} transactions from old key format`);
      allTransactions.push(...oldBankData.transactions);
    }

    // Fetch Chart of Accounts to get all bank account IDs
    const coaKey = `company_coa_${companyId}`;
    const coaData = await kv.get(coaKey);

    if (coaData?.accounts) {
      const bankAccounts = coaData.accounts.filter((acc: any) =>
        acc.type === 'Bank' && acc.isActive !== false
      );

      console.log(`🏦 Found ${bankAccounts.length} bank accounts to check`);

      // Fetch data from each bank account
      for (const account of bankAccounts) {
        const accountKey = `bank-rec:${companyId}:${account.id}:${period}:bank-data`;
        console.log(`🔍 Checking key: ${accountKey} for account: ${account.name} (ID: ${account.id})`);
        const accountBankData = await kv.get(accountKey);

        if (accountBankData?.transactions) {
          console.log(`✅ Found ${accountBankData.transactions.length} transactions from account ${account.name}`);
          allTransactions.push(...accountBankData.transactions);
        } else {
          console.log(`⚠️ No transactions found for account ${account.name} at key ${accountKey}`);
        }
      }
    } else {
      console.log('⚠️ No Chart of Accounts found, trying prefix search as fallback');

      // Fallback: Use getByPrefix to find ALL bank-rec keys for this company and period
      const keyPrefix = `bank-rec:${companyId}:`;
      console.log(`🔍 Searching with prefix: ${keyPrefix}`);

      try {
        const allBankRecData = await kv.getByPrefix(keyPrefix);
        console.log(`📦 Found ${allBankRecData.length} total bank-rec keys with prefix ${keyPrefix}`);

        // Filter for the specific period
        for (const data of allBankRecData) {
          if (data?.transactions && data?.transactions.length > 0) {
            // Check if this data is for our period
            const hasCorrectPeriod = data.transactions.some((txn: any) => {
              const txnDate = txn.date || '';
              return txnDate.startsWith(period);
            });

            if (hasCorrectPeriod || !period) {
              console.log(`✅ Found ${data.transactions.length} transactions from prefix search (period match: ${hasCorrectPeriod})`);
              allTransactions.push(...data.transactions);
            }
          }
        }
      } catch (prefixError) {
        console.error('❌ Prefix search failed:', prefixError);
      }
    }

    if (allTransactions.length === 0) {
      console.log('⚠️ No bank transactions found for this period');
      return c.json({ inflows: [], count: 0, period: period });
    }

    console.log(`📊 Total transactions found across all accounts: ${allTransactions.length}`);

    // CRITICAL: Deduplicate transactions by date + description + amount
    // This prevents processing the same transaction multiple times if it was uploaded with different currencies
    const uniqueTransactions = new Map<string, any>();

    for (const txn of allTransactions) {
      const key = `${txn.date}|${txn.description}|${Math.abs(txn.amount)}`;

      if (!uniqueTransactions.has(key)) {
        uniqueTransactions.set(key, txn);
      } else {
        // If duplicate exists, prefer the one with non-USD currency (more specific)
        const existing = uniqueTransactions.get(key);
        if (existing.currency === 'USD' && txn.currency && txn.currency !== 'USD') {
          console.log(`🔄 Replacing ${key} - upgrading from USD to ${txn.currency}`);
          uniqueTransactions.set(key, txn);
        }
      }
    }

    const deduplicatedTransactions = Array.from(uniqueTransactions.values());
    console.log(`🧹 Deduplicated: ${allTransactions.length} → ${deduplicatedTransactions.length} transactions`);

    // Filter for INFLOWS only (positive amounts or CREDIT transactions)
    const inflows = deduplicatedTransactions.filter((txn: any) => {
      const isCredit =
        txn.amount > 0 ||
        txn.transaction_type === 'CREDIT' ||
        txn.transaction_type === 'DEPOSIT' ||
        txn.transaction_type === 'credit' ||
        txn.transaction_type === 'deposit';

      return isCredit;
    });

    console.log(`✅ Found ${inflows.length} customer payments (inflows) out of ${allTransactions.length} total transactions`);

    // Add unique IDs and format data
    const formattedInflows = inflows.map((txn: any, index: number) => ({
      id: txn.id || `inflow_${index}`,
      date: txn.date,
      description: txn.description || '',
      amount: Math.abs(txn.amount), // Ensure positive
      balance: txn.balance,
      transaction_type: txn.transaction_type,
      currency: txn.currency || 'USD',
      reference: txn.reference,
      statementName: txn.statementName || 'Bank Statement'
    }));

    return c.json({
      inflows: formattedInflows,
      count: formattedInflows.length,
      period: period
    });

  } catch (error) {
    console.error('❌ Error fetching bank inflows:', error);
    return c.json({ error: 'Failed to fetch bank inflows', details: error.message }, 500);
  }
});

// POST /ar-rec/upload-ledger - Upload AR Ledger (CSV/Excel)
app.post('/ar-rec/upload-ledger', async (c) => {
  try {
    console.log('📤 Uploading AR ledger...');

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const period = formData.get('period') as string;

    if (!file || !companyId || !period) {
      return c.json({ error: 'file, companyId, and period are required' }, 400);
    }

    console.log(`📄 Processing AR ledger: ${file.name} for company ${companyId}, period ${period}`);

    // Parse file using hybrid approach
    let entries: any[];
    try {
      const fileArrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(fileArrayBuffer);

      if (file.name.toLowerCase().endsWith('.csv')) {
        console.log('📊 Parsing CSV AR ledger with hybrid approach (AI detects columns only)...');
        entries = await parseARLedgerCSV(uint8Array, file.name);
      } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        console.log('📊 Parsing XLSX AR ledger with hybrid approach (AI detects columns only)...');
        entries = await parseARLedgerXLSX(uint8Array, file.name);
      } else {
        throw new Error('Unsupported file type. Please upload CSV or XLSX.');
      }

      console.log(`✅ Successfully parsed ${entries.length} AR ledger entries`);
      console.log(`   Entries with customers: ${entries.filter((e: any) => e.customer).length}`);
      console.log(`   Entries with invoice numbers: ${entries.filter((e: any) => e.invoice_number).length}`);

    } catch (parseError) {
      console.error('❌ Error parsing AR ledger:', parseError);
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      return c.json({
        error: 'Failed to parse AR ledger file',
        details: errorMsg
      }, 400);
    }

    if (entries.length === 0) {
      return c.json({ error: 'No valid entries found in AR ledger' }, 400);
    }

    // 🔥 Apply Netting before saving manual upload
    const nettedEntries = applyARNetting(entries);

    // Store AR ledger data
    const arLedgerKey = `ar-rec:${companyId}:${period}:ar-ledger`;
    await kv.set(arLedgerKey, {
      fileName: file.name,
      uploadedAt: Date.now(),
      entryCount: nettedEntries.length,
      entries: nettedEntries,
      rawEntries: entries
    });

    console.log(`✅ AR ledger stored successfully: ${nettedEntries.length} netted entries (from ${entries.length} raw)`);

    return c.json({
      success: true,
      entryCount: entries.length,
      entries: entries,
      fileName: file.name
    });

  } catch (error) {
    console.error('❌ Error uploading AR ledger:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return c.json({ error: 'Failed to upload AR ledger', details: errorMsg }, 500);
  }
});

// POST /ar-rec/ar-ledger - Persist AR Ledger data (synced from QuickBooks)
app.post('/ar-rec/ar-ledger', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, ledger, entries } = body;

    if (!companyId || !period || !ledger || !entries) {
      return c.json({ error: 'companyId, period, ledger, and entries are required' }, 400);
    }

    const key = `ar-rec:${companyId}:${period}:ar-ledger`;

    // 🔥 Apply Netting before saving so the preview and engine use the same "Net Owed" logic
    const nettedEntries = applyARNetting(entries);

    await kv.set(key, { ledger, entries: nettedEntries, rawEntries: entries });

    console.log(`✅ Saved ${nettedEntries.length} netted AR ledger entries (from ${entries.length} raw) for company ${companyId}, period ${period}`);

    return c.json({
      success: true,
      entryCount: entries.length
    });
  } catch (error) {
    console.error('❌ Error saving AR ledger data:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return c.json({ error: 'Failed to save AR ledger data', details: errMsg }, 500);
  }
});

// GET /ar-rec/ar-ledger - Fetch AR Ledger data
app.get('/ar-rec/ar-ledger', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'Missing companyId or period' }, 400);
    }

    console.log(`📥 Fetching AR ledger for company ${companyId}, period ${period}`);

    const arLedgerKey = `ar-rec:${companyId}:${period}:ar-ledger`;
    const ledgerData = await kv.get(arLedgerKey);

    if (!ledgerData) {
      console.log('⚠️ No AR ledger found');
      return c.json({
        ledger: null,
        entries: [],
        entryCount: 0
      });
    }

    console.log(`✅ Found AR ledger: ${ledgerData.entryCount} entries`);

    // 🔥 AUTO-REFRESH: If data is stale (missing credit_memo_details) but we have rawEntries, re-net on the fly
    let entries = ledgerData.entries || [];
    const needsRefreshedNetting = entries.some((e: any) =>
      e.applied_credits > 0 && (!e.credit_memo_details || e.credit_memo_details.length === 0)
    );

    if (needsRefreshedNetting && ledgerData.rawEntries) {
      console.log(`🔄 Re-applying netting logic to refresh details for ${companyId}...`);
      entries = applyARNetting(ledgerData.rawEntries);
    }

    return c.json({
      ledger: {
        fileName: ledgerData.fileName,
        uploadedAt: ledgerData.uploadedAt,
        entryCount: ledgerData.entryCount
      },
      entries: entries,
      entryCount: ledgerData.entryCount || 0
    });

  } catch (error) {
    console.error('❌ Error fetching AR ledger:', error);
    return c.json({ error: 'Failed to fetch AR ledger', details: error.message }, 500);
  }
});

// POST /ar-rec/reconcile - Run AR reconciliation with production-grade matching
app.post('/ar-rec/reconcile', async (c) => {
  try {
    const { companyId, period } = await c.req.json();

    if (!companyId || !period) {
      return c.json({ error: 'Missing companyId or period' }, 400);
    }

    console.log(`🔄 Starting AR reconciliation for company ${companyId}, period ${period}`);

    // Load bank inflows (customer payments)
    const arBankInflowsKey = `ar-rec:${companyId}:${period}:bank-inflows`;
    let bankInflows: any[] = [];

    const arInflowsData = await kv.get(arBankInflowsKey);
    if (arInflowsData?.inflows) {
      bankInflows = arInflowsData.inflows;
      console.log(`✅ Loaded ${bankInflows.length} customer payments from AR-rec cache`);
    } else {
      // Fallback: fetch from all bank data sources
      let allTransactions: any[] = [];

      const oldKey = `bank-rec:${companyId}:${period}:bank-data`;
      const oldBankData = await kv.get(oldKey);
      if (oldBankData?.transactions) {
        allTransactions.push(...oldBankData.transactions);
      }

      const coaKey = `company_coa_${companyId}`;
      const coaData = await kv.get(coaKey);

      if (coaData?.accounts) {
        const bankAccounts = coaData.accounts.filter((acc: any) =>
          acc.type === 'Bank' && acc.isActive !== false
        );

        for (const account of bankAccounts) {
          const accountKey = `bank-rec:${companyId}:${account.id}:${period}:bank-data`;
          const accountBankData = await kv.get(accountKey);

          if (accountBankData?.transactions) {
            allTransactions.push(...accountBankData.transactions);
          }
        }
      }

      const deduplicatedTransactions = Array.from(new Map(
        allTransactions.map(txn => {
          const key = `${txn.date}|${txn.description}|${Math.abs(txn.amount)}`;
          return [key, txn];
        })
      ).values());

      bankInflows = deduplicatedTransactions.filter((txn: any) => {
        return txn.amount > 0 ||
          txn.transaction_type === 'CREDIT' ||
          txn.transaction_type === 'DEPOSIT' ||
          txn.transaction_type === 'credit' ||
          txn.transaction_type === 'deposit';
      }).map((txn: any, index: number) => ({
        id: txn.id || `inflow_${index}`,
        date: txn.date,
        description: txn.description || '',
        amount: Math.abs(txn.amount),
        balance: txn.balance,
        transaction_type: txn.transaction_type,
        currency: txn.currency || 'USD',
        reference: txn.reference,
        statementName: txn.statementName || 'Bank Statement'
      }));

      console.log(`✅ Loaded ${bankInflows.length} customer payments from bank statements`);
    }

    // Load AR ledger (customer invoices)
    const arLedgerKey = `ar-rec:${companyId}:${period}:ar-ledger`;
    const arData = await kv.get(arLedgerKey);

    if (!arData || !arData.entries || arData.entries.length === 0) {
      return c.json({ error: 'No AR ledger entries found. Please upload AR ledger first.' }, 400);
    }

    if (bankInflows.length === 0) {
    }

    const arInvoicesRaw = arData.entries;

    // Data is already netted when saved to KV, but we call it here again to be safe 
    // and to handle any legacy un-netted data.
    const arInvoices = applyARNetting(arData.entries);

    console.log(`📊 Netting complete. Reconciling ${bankInflows.length} payments with ${arInvoices.length} net AR claims`);

    // ============================================================================
    // NOVALARE AR RECONCILIATION MATCHING ENGINE V2.0
    // ============================================================================
    //
    // MATCHING FUNNEL (6 PHASES):
    //
    // 1️⃣ EXACT MATCH (Confidence: 100%) - Invoice # + Amount + Same Currency
    // 2️⃣ CUSTOMER/AMOUNT MATCH (Confidence: 60-95%) - Unique/non-unique amount with date proximity
    // 3️⃣ CUSTOMER NAME FUZZY MATCH (Confidence: 60-80%) - Fuzzy customer + amount similarity
    // 4️⃣ INTELLIGENT FX MATCHING (Confidence: 55-100%) - Currency conversion detection
    // 5️⃣ ONE-TO-MANY (Confidence: 75-95%) - 1 Payment → N Invoices (batch payments)
    // 6️⃣ MANY-TO-ONE (Confidence: 75-95%) - N Payments → 1 Invoice (partial payments)
    //
    // PHASE 4 ENHANCEMENTS (January 2, 2026):
    // ✅ Dynamic confidence scoring based on match quality signals
    // ✅ Enhanced match explanations with contextual details
    // ✅ Invoice reference detection in aggregation matches (+10% confidence)
    // ✅ Date clustering bonuses for tight temporal grouping (+5% confidence)
    // ✅ Partial payment keyword detection (+5% confidence)
    // ✅ Renamed 'amount' type → 'customer_amount' for clarity
    //
    // KEY SAFEGUARDS:
    // 🔒 Customer consistency checks (prevents cross-customer contamination)
    // 🔒 FX rate validation with explicit bounds (no generic fallback)
    // 🔒 Invoice number validation in many-to-one matching
    // 🔒 Tight multi-entry tolerance (0.5% to prevent false positives)
    // 🔒 Date windowing (exact: ±7d, batch: ±30d, partial: ±60d)
    //
    // ============================================================================

    // ============================================================================
    // PHASE 1: EXACT MATCHING (Invoice # + Amount)
    // ============================================================================
    console.log('🎯 Phase 1: Exact matching by invoice number + amount...');

    const exactMatches: any[] = [];
    const matchedPaymentIndices = new Set<number>();
    const matchedInvoiceIndices = new Set<number>();

    // Create a map for quick lookup by invoice number
    const invoicesByNumber = new Map<string, number[]>();
    arInvoices.forEach((invoice: any, idx: number) => {
      if (!invoice.invoice_number) return;
      const invNum = invoice.invoice_number.toLowerCase().trim();
      if (!invoicesByNumber.has(invNum)) {
        invoicesByNumber.set(invNum, []);
      }
      invoicesByNumber.get(invNum)!.push(idx);
    });

    // Helper: Extract invoice number from payment description
    function extractInvoiceNumber(description: string): string[] {
      if (!description) return [];
      const desc = description.toLowerCase();
      const matches: string[] = [];

      // Common patterns: INV-123, Invoice 123, #123, Inv123, etc.
      const patterns = [
        /inv[oice]*[-\s#]*([a-z0-9]+)/gi,
        /#([a-z0-9]+)/g,
        /\b([a-z]+[-]?\d+)\b/gi
      ];

      for (const pattern of patterns) {
        const found = desc.matchAll(pattern);
        for (const match of found) {
          if (match[1]) {
            matches.push(match[1].toLowerCase().trim());
          }
        }
      }

      return [...new Set(matches)]; // Remove duplicates
    }

    // Try to match payments to invoices by invoice number + amount
    for (let paymentIdx = 0; paymentIdx < bankInflows.length; paymentIdx++) {
      if (matchedPaymentIndices.has(paymentIdx)) continue;

      const payment = bankInflows[paymentIdx];
      const possibleInvoiceNums = extractInvoiceNumber(payment.description);

      if (possibleInvoiceNums.length === 0) continue;

      // Check each possible invoice number
      for (const invNum of possibleInvoiceNums) {
        const invoiceIndices = invoicesByNumber.get(invNum);
        if (!invoiceIndices || invoiceIndices.length === 0) continue;

        // Find first unmatched invoice with matching amount (within ±0.01 tolerance)
        const matchingIdx = invoiceIndices.find(idx => {
          if (matchedInvoiceIndices.has(idx)) return false;
          const invoice = arInvoices[idx];
          const amountDiff = Math.abs(Math.abs(payment.amount) - Math.abs(invoice.amount));
          return amountDiff <= 0.01;
        });

        if (matchingIdx !== undefined) {
          const invoice = arInvoices[matchingIdx];

          // Phase 4: Enhanced exact match explanation
          const paymentDate = new Date(payment.date);
          const invoiceDate = new Date(invoice.date);
          const daysDiff = Math.round(Math.abs(paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

          let matchReason = `Exact match: Invoice ${invoice.invoice_number} (${invoice.customer || 'unknown customer'}) - €${Math.abs(invoice.amount).toFixed(2)} paid in full`;

          if (daysDiff === 0) {
            matchReason += ` on same day`;
          } else if (daysDiff <= 3) {
            matchReason += ` within ${daysDiff} day${daysDiff === 1 ? '' : 's'}`;
          } else {
            matchReason += ` (${daysDiff} days after invoice)`;
          }

          exactMatches.push({
            payment: payment,
            invoice: invoice,
            match_type: 'exact',
            confidence: 100,
            match_reason: matchReason
          });

          matchedPaymentIndices.add(paymentIdx);
          matchedInvoiceIndices.add(matchingIdx);
          break; // Move to next payment
        }
      }
    }

    console.log(`✅ Phase 1 complete: ${exactMatches.length} exact matches found`);

    // ============================================================================
    // PHASE 2: AMOUNT-ONLY MATCHING
    // ============================================================================
    console.log('💰 Phase 2: Amount-based matching...');

    const amountMatches: any[] = [];
    const unmatchedPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
    const unmatchedInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

    for (let i = 0; i < unmatchedPayments.length; i++) {
      const payment = unmatchedPayments[i];
      const paymentIdx = bankInflows.indexOf(payment);

      const candidateInvoices = unmatchedInvoices
        .map((invoice, idx) => ({ invoice, originalIdx: arInvoices.indexOf(invoice), idx }))
        .filter(({ invoice }) => {
          const amountDiff = Math.abs(Math.abs(payment.amount) - Math.abs(invoice.amount));
          return amountDiff <= 0.01;
        });

      if (candidateInvoices.length === 1) {
        const { invoice, originalIdx } = candidateInvoices[0];

        // Phase 4: Enhanced confidence calculation for unique amount matches
        const paymentDate = new Date(payment.date);
        const invoiceDate = new Date(invoice.date);
        const daysDiff = Math.round(Math.abs(paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

        let confidence = 70; // Base confidence for amount-only match
        confidence += 15; // Unique amount bonus

        // Date proximity bonus
        if (daysDiff <= 3) {
          confidence += 10; // Same week = high confidence
        } else if (daysDiff <= 7) {
          confidence += 5; // Within week = medium confidence
        }

        const finalConfidence = Math.min(95, confidence); // Cap at 95

        amountMatches.push({
          payment: payment,
          invoice: invoice,
          match_type: 'customer_amount', // Phase 4: Renamed from 'amount'
          confidence: finalConfidence,
          match_reason: `Unique amount match: €${Math.abs(payment.amount).toFixed(2)} (${invoice.customer || 'unknown customer'}, ${daysDiff === 0 ? 'same day' : `${daysDiff} days apart`})`
        });

        matchedPaymentIndices.add(paymentIdx);
        matchedInvoiceIndices.add(originalIdx);
        unmatchedInvoices.splice(candidateInvoices[0].idx, 1);

      } else if (candidateInvoices.length > 1) {
        const paymentDate = new Date(payment.date);

        let bestMatch = candidateInvoices[0];
        let minDateDiff = Math.abs(paymentDate.getTime() - new Date(bestMatch.invoice.date).getTime());

        for (let j = 1; j < candidateInvoices.length; j++) {
          const candidate = candidateInvoices[j];
          const dateDiff = Math.abs(paymentDate.getTime() - new Date(candidate.invoice.date).getTime());

          if (dateDiff < minDateDiff) {
            minDateDiff = dateDiff;
            bestMatch = candidate;
          }
        }

        const daysDiff = Math.round(minDateDiff / (1000 * 60 * 60 * 24));

        // Phase 4: Enhanced confidence with decay function
        let confidence = 70; // Base for non-unique amount

        // Date proximity scoring
        if (daysDiff <= 3) {
          confidence += 10;
        } else if (daysDiff <= 7) {
          confidence += 5;
        } else {
          // Decay: -3 points per day beyond 7 days, floor at 60
          confidence -= (daysDiff - 7) * 3;
        }

        const finalConfidence = Math.max(60, Math.min(85, confidence)); // Floor 60, cap 85

        amountMatches.push({
          payment: payment,
          invoice: bestMatch.invoice,
          match_type: 'customer_amount', // Phase 4: Renamed from 'amount'
          confidence: finalConfidence,
          match_reason: `Amount match: €${Math.abs(payment.amount).toFixed(2)} (${candidateInvoices.length} candidates, selected ${bestMatch.invoice.customer || 'unknown'} by date proximity: ${daysDiff} days)`
        });

        matchedPaymentIndices.add(paymentIdx);
        matchedInvoiceIndices.add(bestMatch.originalIdx);

        const removeIdx = unmatchedInvoices.findIndex(inv => inv === bestMatch.invoice);
        if (removeIdx !== -1) {
          unmatchedInvoices.splice(removeIdx, 1);
        }
      }
    }

    console.log(`✅ Phase 2 complete: ${amountMatches.length} amount-based matches found`);

    // ============================================================================
    // PHASE 3: CUSTOMER NAME FUZZY MATCHING
    // ============================================================================
    console.log('👤 Phase 3: Customer name fuzzy matching...');

    function fuzzyMatch(str1: string, str2: string): number {
      if (!str1 || !str2) return 0;

      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();

      if (s1 === s2) return 1.0;
      if (s1.includes(s2) || s2.includes(s1)) return 0.8;

      const words1 = s1.split(/\s+/);
      const words2 = s2.split(/\s+/);
      const commonWords = words1.filter(w => words2.includes(w));

      if (commonWords.length > 0) {
        return 0.6 + (commonWords.length / Math.max(words1.length, words2.length)) * 0.2;
      }

      return 0;
    }

    const fuzzyMatches: any[] = [];
    const stillUnmatchedPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
    const stillUnmatchedInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

    for (let i = 0; i < stillUnmatchedPayments.length; i++) {
      const payment = stillUnmatchedPayments[i];
      const paymentIdx = bankInflows.indexOf(payment);

      const candidateMatches: any[] = [];

      for (let j = 0; j < stillUnmatchedInvoices.length; j++) {
        const invoice = stillUnmatchedInvoices[j];
        const invoiceIdx = arInvoices.indexOf(invoice);

        if (!invoice.customer) continue;

        const nameScore = fuzzyMatch(payment.description, invoice.customer);

        if (nameScore >= 0.6) {
          const pAmt = Math.abs(payment.amount);
          const iAmt = Math.abs(invoice.amount);
          const amountRatio = Math.min(pAmt, iAmt) / Math.max(pAmt, iAmt);

          if (amountRatio >= 0.8) {
            const combinedScore = nameScore * 0.7 + amountRatio * 0.3;
            candidateMatches.push({
              invoice,
              invoiceIdx,
              score: combinedScore,
              nameScore,
              amountRatio
            });
          }
        }
      }

      if (candidateMatches.length > 0) {
        candidateMatches.sort((a, b) => b.score - a.score);
        const best = candidateMatches[0];

        const confidence = Math.round(best.score * 100);

        if (confidence >= 60) {
          fuzzyMatches.push({
            payment: payment,
            invoice: best.invoice,
            match_type: 'customer_name',
            confidence: confidence,
            match_reason: `Customer name "${best.invoice.customer}" found in payment description (${confidence}% confidence)`
          });

          matchedPaymentIndices.add(paymentIdx);
          matchedInvoiceIndices.add(best.invoiceIdx);
        }
      }
    }

    console.log(`✅ Phase 3 complete: ${fuzzyMatches.length} customer name matches found`);

    // ============================================================================
    // PHASE 4: INTELLIGENT FX MATCHING (Currency Conversion Detection)
    // ============================================================================
    console.log('💱 Phase 4: FX currency conversion matching...');

    // Import FX utilities
    const { isFXScenario, getImpliedFXRate } = await import('./ar-rec-matching-utils.tsx');
    const { scoreFXMatch } = await import('./ar-rec-fx-scoring.tsx');

    const fxMatches: any[] = [];
    const remainingPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
    const remainingInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

    console.log(`📊 FX Phase: ${remainingPayments.length} unmatched payments, ${remainingInvoices.length} unmatched invoices`);

    for (let paymentIdx = 0; paymentIdx < remainingPayments.length; paymentIdx++) {
      const payment = remainingPayments[paymentIdx];
      const originalPaymentIdx = bankInflows.indexOf(payment);

      for (let invoiceIdx = 0; invoiceIdx < remainingInvoices.length; invoiceIdx++) {
        const invoice = remainingInvoices[invoiceIdx];
        const originalInvoiceIdx = arInvoices.indexOf(invoice);

        // Skip if already matched
        if (matchedPaymentIndices.has(originalPaymentIdx) || matchedInvoiceIndices.has(originalInvoiceIdx)) {
          continue;
        }

        const paymentCurrency = payment.currency || 'EUR';
        const invoiceCurrency = invoice.currency || 'EUR';

        // Only process FX scenarios (different currencies)
        if (!isFXScenario(paymentCurrency, invoiceCurrency)) {
          continue;
        }

        console.log(`🔍 FX scenario detected: ${invoice.invoice_number || 'unknown'} (${invoiceCurrency}) vs payment (${paymentCurrency})`);

        // Calculate implied FX rate
        const { rate, direction } = getImpliedFXRate(
          invoice.amount,
          payment.amount,
          invoiceCurrency,
          paymentCurrency
        );

        console.log(`   Implied rate: ${rate.toFixed(4)} ${direction}`);

        // Score this FX match
        const fxMatch = scoreFXMatch(invoice, payment, rate, direction);

        console.log(`   FX score: ${fxMatch.score} | Confidence: ${fxMatch.confidence}`);

        // Accept if score >= 55 (requires customer match + date/FX validation)
        // Minimum = partial customer (15) + date (15) + FX rate (15) + some invoice/amount correlation
        // This prevents matching different customers even if amounts/dates align
        if (fxMatch.score >= 55) {
          console.log(`✅ FX MATCH: ${invoice.customer || 'unknown customer'} | Invoice ${Math.abs(invoice.amount).toFixed(2)} ${invoiceCurrency} → Payment ${Math.abs(payment.amount).toFixed(2)} ${paymentCurrency} | Rate: ${rate.toFixed(4)} | Score: ${fxMatch.score}`);

          fxMatches.push({
            payment: payment,
            invoice: invoice,
            match_type: 'fx',
            confidence: Math.round(fxMatch.score),
            match_reason: fxMatch.explanation,
            fx_rate: rate,
            fx_direction: direction
          });

          // Mark as matched
          matchedPaymentIndices.add(originalPaymentIdx);
          matchedInvoiceIndices.add(originalInvoiceIdx);
          break; // Move to next payment
        } else {
          console.log(`❌ FX rejected: ${fxMatch.explanation}`);
        }
      }
    }

    console.log(`✅ Phase 4 complete: ${fxMatches.length} FX matches found`);

    // ============================================================================
    // PHASE 5: ONE-TO-MANY MATCHING (1 Payment → N Invoices - Batch Payments)
    // ============================================================================
    console.log('🔢 Phase 5: One-to-many matching (batch payments)...');

    // Import aggregation utilities
    const { findMatchingCombinations, calculateTolerance, validateGroupedMatch } = await import('./ar-rec-matching-utils.tsx');

    const oneToManyMatches: any[] = [];
    const afterFxPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
    const afterFxInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

    console.log(`📊 1:N Phase: ${afterFxPayments.length} unmatched payments, ${afterFxInvoices.length} unmatched invoices`);

    for (let paymentIdx = 0; paymentIdx < afterFxPayments.length; paymentIdx++) {
      const payment = afterFxPayments[paymentIdx];
      const originalPaymentIdx = bankInflows.indexOf(payment);

      if (matchedPaymentIndices.has(originalPaymentIdx)) continue;

      // Get available invoices for this payment (same currency, within date range)
      const availableInvoices = afterFxInvoices.filter((invoice, idx) => {
        const originalIdx = arInvoices.indexOf(invoice);
        if (matchedInvoiceIndices.has(originalIdx)) return false;

        // Currency must match (no FX in aggregation)
        const paymentCurrency = payment.currency || 'EUR';
        const invoiceCurrency = invoice.currency || 'EUR';
        if (paymentCurrency !== invoiceCurrency) return false;

        // Date filter: within ±30 days (relaxed window for batch payments)
        const paymentDate = new Date(payment.date);
        const invoiceDate = new Date(invoice.date);
        const daysDiff = Math.abs((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) return false;

        return true;
      });

      if (availableInvoices.length < 2) continue; // Need at least 2 invoices to aggregate

      console.log(`🔍 Payment ${payment.amount} (${payment.currency || 'EUR'}) on ${payment.date} has ${availableInvoices.length} candidate invoices for aggregation`);

      // Find combinations of 2-5 invoices that sum to payment amount
      // Use relaxed tolerance (0.5% instead of strict 0.1%)
      const strictTolerance = calculateTolerance(payment.amount, 'multi');
      const relaxedTolerance = Math.max(strictTolerance * 5, Math.abs(payment.amount) * 0.005);
      console.log(`   Using tolerance: ${relaxedTolerance.toFixed(2)} (strict: ${strictTolerance.toFixed(2)})`);

      const combinations = findMatchingCombinations(
        availableInvoices,
        Math.abs(payment.amount),
        relaxedTolerance,
        5 // Max 5 invoices per batch
      );

      console.log(`   Found ${combinations.length} combinations within tolerance ${relaxedTolerance.toFixed(2)}`);

      if (combinations.length === 0) continue;

      // Take first (smallest) combination and validate
      const bestCombo = combinations[0];

      // Validate customer purity (all invoices must be from same customer)
      const validation = validateGroupedMatch(bestCombo, 'one_to_many');

      if (!validation.isValid) {
        console.log(`❌ REJECTED 1:N: ${validation.reasons.join(', ')}`);
        continue;
      }

      const comboSum = bestCombo.reduce((sum, inv) => sum + Math.abs(inv.amount), 0);
      const diff = Math.abs(Math.abs(payment.amount) - comboSum);

      // Phase 4: Enhanced confidence calculation for one-to-many matches
      let confidence = 75; // Base confidence for batch payment

      // Check if invoice numbers are mentioned in payment description
      const paymentRefs = extractInvoiceNumber(payment.description);
      const invoiceNumbers = bestCombo.map(inv => (inv.invoice_number || '').toLowerCase().trim());

      let allInvoicesReferenced = true;
      if (paymentRefs.length > 0 && invoiceNumbers.length > 0) {
        allInvoicesReferenced = invoiceNumbers.every(invNum =>
          paymentRefs.some(ref =>
            invNum.includes(ref.toLowerCase()) ||
            ref.toLowerCase().includes(invNum)
          )
        );

        if (allInvoicesReferenced) {
          confidence += 10; // All invoice numbers explicitly mentioned
          console.log(`   📝 All ${bestCombo.length} invoice numbers found in payment description`);
        }
      }

      // Check if invoices are consecutive/clustered (suggests intentional batch)
      const invoiceNums = bestCombo
        .map(inv => inv.invoice_number || '')
        .filter(n => n.match(/\d+/))
        .map(n => parseInt(n.match(/\d+/)?.[0] || '0'));

      if (invoiceNums.length >= 2) {
        const sortedNums = [...invoiceNums].sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < sortedNums.length; i++) {
          gaps.push(sortedNums[i] - sortedNums[i - 1]);
        }
        const maxGap = Math.max(...gaps);
        if (maxGap <= 5) { // Consecutive or near-consecutive
          confidence += 5;
          console.log(`   📊 Invoices are consecutive/clustered (max gap: ${maxGap})`);
        }
      }

      // Date proximity bonus (tighter than validation threshold)
      if (validation.dateSpread <= 7) {
        confidence += 5; // All within 1 week
        console.log(`   📅 Tight date clustering: ${validation.dateSpread} days`);
      }

      const finalConfidence = Math.min(95, confidence); // Cap at 95

      console.log(`✅ BATCH PAYMENT MATCH: 1 payment (${payment.amount}) → ${bestCombo.length} invoices (${comboSum.toFixed(2)}) | Diff: ${diff.toFixed(2)} | Customer: ${bestCombo[0].customer || 'unknown'} | Confidence: ${finalConfidence}%`);

      // Phase 4: Enhanced match explanation
      const invoiceList = bestCombo.map(inv => inv.invoice_number || 'unknown').join(', ');
      const hasExplicitRefs = paymentRefs.length > 0 && allInvoicesReferenced;

      let matchReason = `Batch payment: €${Math.abs(payment.amount).toFixed(2)} allocated to ${bestCombo.length} invoices [${invoiceList}] from ${bestCombo[0].customer || 'same customer'}`;

      if (validation.dateSpread <= 7) {
        matchReason += ` over ${validation.dateSpread}-day period`;
      } else {
        matchReason += ` (${validation.dateSpread} days spread)`;
      }

      if (hasExplicitRefs) {
        matchReason += `. All invoice numbers referenced in payment`;
      }

      oneToManyMatches.push({
        payment: payment,
        invoices: bestCombo, // ARRAY of invoices
        match_type: 'one_to_many',
        confidence: finalConfidence, // Phase 4: Dynamic confidence
        match_reason: matchReason, // Phase 4: Enhanced explanation
        aggregation_count: bestCombo.length,
        aggregation_sum: comboSum,
        amount_difference: diff
      });

      // Mark as matched
      matchedPaymentIndices.add(originalPaymentIdx);
      bestCombo.forEach(invoice => {
        const originalIdx = arInvoices.indexOf(invoice);
        matchedInvoiceIndices.add(originalIdx);
      });
    }

    console.log(`✅ Phase 5 complete: ${oneToManyMatches.length} one-to-many matches found`);

    // ============================================================================
    // PHASE 6: MANY-TO-ONE MATCHING (N Payments → 1 Invoice - Partial Payments)
    // ============================================================================
    console.log('🔢 Phase 6: Many-to-one matching (partial payments)...');

    const manyToOneMatches: any[] = [];
    const afterOneToManyPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
    const afterOneToManyInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

    console.log(`📊 N:1 Phase: ${afterOneToManyPayments.length} unmatched payments, ${afterOneToManyInvoices.length} unmatched invoices`);

    for (let invoiceIdx = 0; invoiceIdx < afterOneToManyInvoices.length; invoiceIdx++) {
      const invoice = afterOneToManyInvoices[invoiceIdx];
      const originalInvoiceIdx = arInvoices.indexOf(invoice);

      if (matchedInvoiceIndices.has(originalInvoiceIdx)) continue;

      // Get available payments for this invoice (same currency, within wider date range)
      const availablePayments = afterOneToManyPayments.filter((payment, idx) => {
        const originalIdx = bankInflows.indexOf(payment);
        if (matchedPaymentIndices.has(originalIdx)) return false;

        // Currency must match (no FX in aggregation)
        const paymentCurrency = payment.currency || 'EUR';
        const invoiceCurrency = invoice.currency || 'EUR';
        if (paymentCurrency !== invoiceCurrency) return false;

        // Date filter: within ±60 days (wider window for partial payments)
        const paymentDate = new Date(payment.date);
        const invoiceDate = new Date(invoice.date);
        const daysDiff = Math.abs((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 60) return false;

        // CRITICAL: If payment mentions a specific invoice number, it MUST match this invoice
        // This prevents matching "Final payment INV-2011" to INV-2014
        const paymentRefs = extractInvoiceNumber(payment.description);
        if (paymentRefs.length > 0) {
          const invoiceNumber = (invoice.invoice_number || '').toLowerCase().trim();
          // Check if any extracted reference matches this invoice
          const hasMatch = paymentRefs.some(ref => {
            const refLower = ref.toLowerCase();
            return invoiceNumber.includes(refLower) || refLower.includes(invoiceNumber) || invoiceNumber === refLower;
          });
          if (!hasMatch) {
            console.log(`   ❌ Payment "${payment.description}" mentions ${paymentRefs.join(', ')} but invoice is ${invoice.invoice_number} - SKIPPING`);
            return false;
          }
        }

        return true;
      });

      if (availablePayments.length < 2) continue; // Need at least 2 payments to aggregate

      console.log(`🔍 Invoice ${invoice.invoice_number || 'unknown'}: ${invoice.amount} (${invoice.currency || 'EUR'}) on ${invoice.date} has ${availablePayments.length} candidate payments for aggregation`);

      // Find combinations of 2-5 payments that sum to invoice amount
      // Use relaxed tolerance (0.5% instead of strict 0.1%)
      const strictTolerance = calculateTolerance(invoice.amount, 'multi');
      const relaxedTolerance = Math.max(strictTolerance * 5, Math.abs(invoice.amount) * 0.005);
      console.log(`   Using tolerance: ${relaxedTolerance.toFixed(2)} (strict: ${strictTolerance.toFixed(2)})`);

      const combinations = findMatchingCombinations(
        availablePayments,
        Math.abs(invoice.amount),
        relaxedTolerance,
        5 // Max 5 payments per invoice
      );

      console.log(`   Found ${combinations.length} combinations within tolerance ${relaxedTolerance.toFixed(2)}`);

      if (combinations.length === 0) continue;

      // Take first (smallest) combination and validate
      const bestCombo = combinations[0];

      // Validate group (skip customer purity for many-to-one since payments don't have clear customer IDs)
      // We trust the invoice's customer field as the source of truth
      const validation = validateGroupedMatch(bestCombo, 'many_to_one');

      // For many-to-one, only reject if date spread or amount disparity is too high
      // Skip customer purity rejection since payments often lack customer identifiers
      const nonCustomerReasons = validation.reasons.filter(r => !r.includes('CUSTOMER CONTAMINATION'));

      if (nonCustomerReasons.length > 0) {
        console.log(`❌ REJECTED N:1: ${nonCustomerReasons.join(', ')}`);
        continue;
      }

      if (validation.reasons.some(r => r.includes('CUSTOMER CONTAMINATION'))) {
        console.log(`⚠️  WARNING N:1: Customer purity check skipped for payments (lack customer identifiers)`);
      }

      const comboSum = bestCombo.reduce((sum, pmt) => sum + Math.abs(pmt.amount), 0);
      const diff = Math.abs(Math.abs(invoice.amount) - comboSum);

      // Phase 4: Enhanced confidence calculation for many-to-one matches
      let confidence = 75; // Base confidence for partial payments

      // Check if ALL payments explicitly reference this invoice number
      const invoiceNumber = (invoice.invoice_number || '').toLowerCase().trim();
      let allPaymentsReferenceInvoice = false;
      let paymentsWithRefs = 0;

      if (invoiceNumber) {
        allPaymentsReferenceInvoice = bestCombo.every(pmt => {
          const pmtRefs = extractInvoiceNumber(pmt.description);
          const hasRef = pmtRefs.some(ref =>
            invoiceNumber.includes(ref.toLowerCase()) ||
            ref.toLowerCase().includes(invoiceNumber)
          );
          if (hasRef) paymentsWithRefs++;
          return hasRef;
        });

        if (allPaymentsReferenceInvoice) {
          confidence += 10; // All payments explicitly mention this invoice
          console.log(`   📝 All ${bestCombo.length} payments reference invoice ${invoiceNumber}`);
        } else if (paymentsWithRefs > 0) {
          confidence += 5; // Some payments reference invoice
          console.log(`   📝 ${paymentsWithRefs}/${bestCombo.length} payments reference invoice ${invoiceNumber}`);
        }
      }

      // Check if payments use keywords like "partial", "final", "installment"
      const hasPartialKeywords = bestCombo.some(pmt => {
        const desc = (pmt.description || '').toLowerCase();
        return desc.includes('partial') || desc.includes('final') ||
          desc.includes('installment') || desc.includes('payment');
      });

      if (hasPartialKeywords) {
        confidence += 5; // Payment descriptions indicate installment scenario
        console.log(`   💬 Payment descriptions contain partial payment keywords`);
      }

      // Date proximity bonus (tighter than validation threshold)
      if (validation.dateSpread <= 3) {
        confidence += 5; // All within 3 days
        console.log(`   📅 Tight date clustering: ${validation.dateSpread} days`);
      }

      const finalConfidence = Math.min(95, confidence); // Cap at 95

      console.log(`✅ PARTIAL PAYMENT MATCH: ${bestCombo.length} payments (${comboSum.toFixed(2)}) → 1 invoice (${invoice.amount}) | Diff: ${diff.toFixed(2)} | Customer: ${invoice.customer || 'unknown'} | Confidence: ${finalConfidence}%`);

      // Phase 4: Enhanced match explanation
      let matchReason = `Partial payment scenario: Invoice ${invoice.invoice_number || 'unknown'} (€${Math.abs(invoice.amount).toFixed(2)}) paid in ${bestCombo.length} installments`;

      if (validation.dateSpread <= 3) {
        matchReason += ` over ${validation.dateSpread} day${validation.dateSpread === 1 ? '' : 's'}`;
      } else {
        matchReason += ` (${validation.dateSpread} days spread)`;
      }

      if (allPaymentsReferenceInvoice) {
        matchReason += `. All payments reference ${invoice.invoice_number} explicitly`;
      } else if (paymentsWithRefs > 0) {
        matchReason += `. ${paymentsWithRefs}/${bestCombo.length} payments reference invoice`;
      }

      matchReason += `. Customer: ${invoice.customer || 'unknown'}`;

      manyToOneMatches.push({
        payments: bestCombo, // ARRAY of payments
        invoice: invoice,
        match_type: 'many_to_one',
        confidence: finalConfidence, // Phase 4: Dynamic confidence
        match_reason: matchReason, // Phase 4: Enhanced explanation
        aggregation_count: bestCombo.length,
        aggregation_sum: comboSum,
        amount_difference: diff
      });

      // Mark as matched
      matchedInvoiceIndices.add(originalInvoiceIdx);
      bestCombo.forEach(payment => {
        const originalIdx = bankInflows.indexOf(payment);
        matchedPaymentIndices.add(originalIdx);
      });
    }

    console.log(`✅ Phase 6 complete: ${manyToOneMatches.length} many-to-one matches found`);

    // ============================================================================
    // COMPILE FINAL RESULTS
    // ============================================================================

    const allMatches = [...exactMatches, ...amountMatches, ...fuzzyMatches, ...fxMatches, ...oneToManyMatches, ...manyToOneMatches];
    const finalUnmatchedPayments = bankInflows.filter((_, idx) => !matchedPaymentIndices.has(idx));
    const finalUnmatchedInvoices = arInvoices.filter((_, idx) => !matchedInvoiceIndices.has(idx));

    const totalPaymentAmount = bankInflows.reduce((sum, p) => sum + p.amount, 0);
    const totalInvoiceAmount = arInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Calculate matched amounts (handle aggregated matches)
    const matchedPaymentAmount = allMatches.reduce((sum, m) => {
      if (m.payments) {
        // Many-to-one: sum of multiple payments
        return sum + m.payments.reduce((s, p) => s + p.amount, 0);
      } else {
        // One-to-one or one-to-many: single payment
        return sum + m.payment.amount;
      }
    }, 0);

    const matchedInvoiceAmount = allMatches.reduce((sum, m) => {
      if (m.invoices) {
        // One-to-many: sum of multiple invoices
        return sum + m.invoices.reduce((s, inv) => s + inv.amount, 0);
      } else {
        // One-to-one or many-to-one: single invoice
        return sum + m.invoice.amount;
      }
    }, 0);

    const matchRate = bankInflows.length > 0
      ? Math.round((allMatches.length / bankInflows.length) * 100)
      : 0;

    const result = {
      matched_pairs: allMatches.map(match => {
        // Handle different match types
        if (match.match_type === 'one_to_many') {
          // 1 payment → N invoices
          return {
            payment: {
              date: match.payment.date,
              description: match.payment.description,
              amount: match.payment.amount,
              currency: match.payment.currency,
              statement: match.payment.statementName
            },
            invoices: match.invoices.map(inv => ({
              invoice_number: inv.invoice_number,
              customer: inv.customer,
              date: inv.date,
              amount: inv.amount,
              currency: inv.currency,
              due_date: inv.due_date
            })),
            match_type: match.match_type,
            confidence: match.confidence,
            match_reason: match.match_reason,
            aggregation_count: match.aggregation_count,
            amount_difference: match.amount_difference
          };
        } else if (match.match_type === 'many_to_one') {
          // N payments → 1 invoice
          return {
            payments: match.payments.map(p => ({
              date: p.date,
              description: p.description,
              amount: p.amount,
              currency: p.currency,
              statement: p.statementName
            })),
            invoice: {
              invoice_number: match.invoice.invoice_number,
              customer: match.invoice.customer,
              date: match.invoice.date,
              amount: match.invoice.amount,
              currency: match.invoice.currency,
              due_date: match.invoice.due_date
            },
            match_type: match.match_type,
            confidence: match.confidence,
            match_reason: match.match_reason,
            aggregation_count: match.aggregation_count,
            amount_difference: match.amount_difference
          };
        } else {
          // Standard 1:1 match
          return {
            payment: {
              date: match.payment.date,
              description: match.payment.description,
              amount: match.payment.amount,
              currency: match.payment.currency,
              statement: match.payment.statementName
            },
            invoice: {
              invoice_number: match.invoice.invoice_number,
              customer: match.invoice.customer,
              date: match.invoice.date,
              amount: match.invoice.amount,
              currency: match.invoice.currency,
              due_date: match.invoice.due_date
            },
            match_type: match.match_type,
            confidence: match.confidence,
            match_reason: match.match_reason,
            amount_difference: Math.abs(match.payment.amount - match.invoice.amount)
          };
        }
      }),
      unmatched_payments: finalUnmatchedPayments.map((payment: any) => ({
        payment: {
          date: payment.date,
          description: payment.description,
          amount: payment.amount,
          currency: payment.currency,
          statement: payment.statementName
        },
        reason: 'No matching invoice found',
        suggested_action: 'Review - may be partial payment, advance payment, or reconciliation error'
      })),
      unmatched_invoices: finalUnmatchedInvoices.map((invoice: any) => ({
        invoice: {
          invoice_number: invoice.invoice_number,
          customer: invoice.customer,
          date: invoice.date,
          amount: invoice.amount,
          currency: invoice.currency,
          due_date: invoice.due_date
        },
        reason: 'No matching payment found',
        suggested_action: 'Review - invoice may be unpaid or payment not yet deposited'
      })),
      summary: {
        total_payments: bankInflows.length,
        total_invoices: arInvoices.length,
        matched_count: allMatches.length,
        unmatched_payments_count: finalUnmatchedPayments.length,
        unmatched_invoices_count: finalUnmatchedInvoices.length,
        total_payment_amount: totalPaymentAmount,
        total_invoice_amount: totalInvoiceAmount,
        matched_payment_amount: matchedPaymentAmount,
        matched_invoice_amount: matchedInvoiceAmount,
        difference: totalPaymentAmount - totalInvoiceAmount,
        match_rate: matchRate,
        exact_matches: exactMatches.length,
        amount_matches: amountMatches.length,
        customer_name_matches: fuzzyMatches.length,
        fx_matches: fxMatches.length,
        one_to_many_matches: oneToManyMatches.length,
        many_to_one_matches: manyToOneMatches.length
      }
    };

    // Store reconciliation result
    const reconciliationKey = `ar_reconciliation_${companyId}_${period}`;
    await kv.set(reconciliationKey, result);

    console.log(`✅ AR reconciliation completed:`);
    console.log(`   Total Matches: ${allMatches.length} (${matchRate}% match rate)`);
    console.log(`   - Exact: ${exactMatches.length}`);
    console.log(`   - Customer/Amount: ${amountMatches.length}`); // Phase 4: Updated label
    console.log(`   - Customer Name: ${fuzzyMatches.length}`);
    console.log(`   - FX: ${fxMatches.length}`);
    console.log(`   - One-to-Many (Batch): ${oneToManyMatches.length}`);
    console.log(`   - Many-to-One (Partial): ${manyToOneMatches.length}`);
    console.log(`   Unmatched Payments: ${finalUnmatchedPayments.length}`);
    console.log(`   Unmatched Invoices: ${finalUnmatchedInvoices.length}`);

    return c.json({ reconciliation: result });

  } catch (error) {
    console.error('❌ Error running AR reconciliation:', error);
    return c.json({ error: 'Failed to run reconciliation', details: error.message }, 500);
  }
});

// POST /ar-rec/save-reconciliation - Save (lock) AR reconciliation
app.post('/ar-rec/save-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();

    if (!company_id || !period) {
      return c.json({ error: 'Missing company_id or period' }, 400);
    }

    console.log(`💾 Saving AR reconciliation for company ${company_id}, period ${period}`);

    // Retrieve the reconciliation result
    const reconciliationKey = `ar_reconciliation_${company_id}_${period}`;
    const reconciliationResult = await kv.get(reconciliationKey);

    if (!reconciliationResult) {
      return c.json({ error: 'No reconciliation found to save' }, 404);
    }

    // Mark as saved with timestamp
    const savedReconciliation = {
      ...reconciliationResult,
      saved_at: new Date().toISOString(),
      locked: true
    };

    // Save back to KV store
    await kv.set(reconciliationKey, savedReconciliation);

    console.log(`✅ AR reconciliation saved successfully`);

    return c.json({
      message: 'AR reconciliation saved successfully',
      reconciliation: savedReconciliation
    });

  } catch (error) {
    console.error('❌ Error saving AR reconciliation:', error);
    return c.json({ error: 'Failed to save reconciliation', details: error.message }, 500);
  }
});

// GET /ar-rec/reconciliation - Load saved AR reconciliation
app.get('/ar-rec/reconciliation', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log(`📂 Loading AR reconciliation for company ${companyId}, period ${period}`);

    // Load reconciliation result
    const reconciliationKey = `ar_reconciliation_${companyId}_${period}`;
    const data = await kv.get(reconciliationKey);

    if (!data) {
      console.log('ℹ️ No reconciliation found');
      return c.json({ reconciliation: null });
    }

    console.log(`✅ Found reconciliation with ${data.matched_pairs?.length || 0} matches`);
    return c.json({ reconciliation: data });

  } catch (error) {
    console.error('❌ Error loading AR reconciliation:', error);
    return c.json({ error: 'Failed to load AR reconciliation' }, 500);
  }
});

// GET /ar-rec/status-summary - Lightweight status check for Month-End Checklist
app.get('/ar-rec/status-summary', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    // Load reconciliation result
    const recKey = `ar_reconciliation_${companyId}_${period}`;
    const data = await kv.get(recKey);

    if (!data) {
      return c.json({ exists: false });
    }

    // Return only essential data for the checklist
    return c.json({
      exists: true,
      locked: data.locked || false,
      lockedAt: data.lockedAt,
      summary: data.summary || {
        matched_count: data.matched_payments?.length || 0,
        unmatched_invoice_count: data.unmatched_invoices?.length || 0,
        unmatched_payment_count: data.unmatched_payments?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching AR status summary:', error);
    return c.json({ error: 'Failed to fetch status summary' }, 500);
  }
});

// Lock (save) an AR reconciliation
app.post('/ar-rec/lock-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();

    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `ar_reconciliation_${company_id}_${period}`;
    const data = await kv.get(key);

    if (!data) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Add locked status and timestamp
    data.locked = true;
    data.lockedAt = new Date().toISOString();

    await kv.set(key, data);

    console.log(`🔒 Locked AR reconciliation for ${company_id} - ${period}`);

    return c.json({ success: true, reconciliation: data });
  } catch (error) {
    console.error('❌ Error locking AR reconciliation:', error);
    return c.json({ error: `Failed to lock reconciliation: ${error.message}` }, 500);
  }
});

// Unlock an AR reconciliation to allow updates
app.post('/ar-rec/unlock-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();

    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `ar_reconciliation_${company_id}_${period}`;
    const data = await kv.get(key);

    if (!data) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Remove locked status
    data.locked = false;
    data.unlockedAt = new Date().toISOString();

    await kv.set(key, data);

    console.log(`🔓 Unlocked AR reconciliation for ${company_id} - ${period}`);

    return c.json({ success: true, reconciliation: data });
  } catch (error) {
    console.error('❌ Error unlocking AR reconciliation:', error);
    return c.json({ error: `Failed to unlock reconciliation: ${error.message}` }, 500);
  }
});

export default app;