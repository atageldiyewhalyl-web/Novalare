import { Hono } from "npm:hono";
import * as XLSX from "npm:xlsx";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Upload and analyze trial balance
app.post('/make-server-53c2e113/trial-balance/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const period = formData.get('period') as string;
    const previousPeriod = formData.get('previousPeriod') as string; // Optional for variance analysis

    if (!file || !companyId || !period) {
      return c.json({ error: 'File, companyId, and period are required' }, 400);
    }

    console.log(`📊 Processing trial balance for company ${companyId}, period ${period}`);

    // Parse the file using AI-powered column detection
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let filteredData: any[] = [];
    
    if (file.name.toLowerCase().endsWith('.csv')) {
      filteredData = await parseTrialBalanceCSV(uint8Array, file.name);
    } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      filteredData = await parseTrialBalanceXLSX(uint8Array, file.name);
    } else {
      return c.json({ error: 'Unsupported file format. Please upload CSV or Excel file.' }, 400);
    }

    console.log(`✅ Parsed ${filteredData.length} valid trial balance entries`);

    // A. STRUCTURAL VALIDATION (Hard Stops)
    const totalDebits = filteredData.reduce((sum, row) => sum + (row.debit || 0), 0);
    const totalCredits = filteredData.reduce((sum, row) => sum + (row.credit || 0), 0);
    const difference = Math.abs(totalDebits - totalCredits);
    const tolerance = 0.01; // Allow 1 cent tolerance for rounding
    
    const isBalanced = difference <= tolerance;

    console.log(`💰 Total Debits: ${totalDebits.toFixed(2)}, Total Credits: ${totalCredits.toFixed(2)}, Difference: ${difference.toFixed(2)}`);

    const structuralErrors: any[] = [];
    
    if (!isBalanced) {
      structuralErrors.push({
        severity: 'error',
        type: 'UNBALANCED_TB',
        title: 'Trial Balance is not balanced',
        message: 'Total Debits do not equal Total Credits. Month cannot be closed.',
        details: {
          totalDebits,
          totalCredits,
          difference,
        },
        recommendation: 'Review journal entries for posting errors or one-sided entries. Check for incomplete or corrupted ledger data.',
      });
    }

    // Check for one-sided entries (accounts with only debit OR only credit, but not both over time)
    const oneSidedAccounts = filteredData.filter((row) => {
      return (row.debit > 0 && row.credit === 0) || (row.credit > 0 && row.debit === 0);
    });

    if (oneSidedAccounts.length === filteredData.length) {
      // This is actually normal - trial balance typically shows net balance per account
      console.log('ℹ️ All accounts are one-sided (normal for trial balance)');
    }

    // B. ANALYTICAL WARNINGS (Soft Warnings)
    const analyticalWarnings: any[] = [];

    // Load previous period data for variance analysis (if available)
    let previousTB: any = null;
    if (previousPeriod) {
      const prevKey = `trial-balance:${companyId}:${previousPeriod}`;
      previousTB = await kv.get(prevKey);
    }

    // Group accounts by type for analysis
    const accountsByType: Record<string, any[]> = {};
    filteredData.forEach((row) => {
      const accountName = String(row.account_name).toLowerCase();
      let type = row.account_type?.toLowerCase() || '';
      
      // Auto-detect account type from name if not provided
      if (!type) {
        if (accountName.includes('cash') || accountName.includes('bank')) type = 'cash';
        else if (accountName.includes('receivable') || accountName.includes('ar')) type = 'receivables';
        else if (accountName.includes('payable') || accountName.includes('ap')) type = 'payables';
        else if (accountName.includes('revenue') || accountName.includes('income') || accountName.includes('sales')) type = 'revenue';
        else if (accountName.includes('expense') || accountName.includes('cost')) type = 'expense';
        else if (accountName.includes('credit card') || accountName.includes('cc payable')) type = 'credit_card';
        else if (accountName.includes('suspense') || accountName.includes('miscellaneous') || accountName.includes('clearing')) type = 'suspense';
        else type = 'other';
      }
      
      if (!accountsByType[type]) accountsByType[type] = [];
      accountsByType[type].push(row);
    });

    // Check for negative balances in liability/credit accounts
    filteredData.forEach((row) => {
      const accountName = String(row.account_name).toLowerCase();
      const netBalance = row.debit - row.credit;
      
      if ((accountName.includes('payable') || accountName.includes('credit card')) && netBalance > 0) {
        analyticalWarnings.push({
          severity: 'warning',
          type: 'UNUSUAL_BALANCE',
          title: 'Liability account with debit balance',
          message: `${row.account_name} has a debit balance of ${Math.abs(netBalance).toFixed(2)}`,
          details: { account: row.account_name, balance: netBalance },
          recommendation: 'Verify if this is an overpayment or posting error. Liability accounts typically carry credit balances.',
        });
      }
    });

    // Check for large balances in suspense/misc accounts
    if (accountsByType['suspense']) {
      accountsByType['suspense'].forEach((row) => {
        const netBalance = Math.abs(row.debit - row.credit);
        if (netBalance > 1000) {
          analyticalWarnings.push({
            severity: 'warning',
            type: 'SUSPENSE_BALANCE',
            title: 'Large balance in suspense account',
            message: `${row.account_name} has a balance of ${netBalance.toFixed(2)}`,
            details: { account: row.account_name, balance: netBalance },
            recommendation: 'Suspense and clearing accounts should be zero or near-zero at month-end. Investigate and reclassify transactions.',
          });
        }
      });
    }

    // Variance analysis (if previous period available)
    if (previousTB && previousTB.entries) {
      const prevAccountMap = new Map(
        previousTB.entries.map((entry: any) => [entry.account_name, entry])
      );

      filteredData.forEach((currentRow) => {
        const prevRow = prevAccountMap.get(currentRow.account_name);
        if (!prevRow) return;

        const currentBalance = currentRow.debit - currentRow.credit;
        const prevBalance = prevRow.debit - prevRow.credit;
        const change = currentBalance - prevBalance;
        const percentChange = prevBalance !== 0 ? (change / Math.abs(prevBalance)) * 100 : 0;

        // Flag significant variances
        const accountName = String(currentRow.account_name).toLowerCase();
        
        if (accountName.includes('cash') && Math.abs(percentChange) > 70) {
          analyticalWarnings.push({
            severity: 'warning',
            type: 'UNUSUAL_VARIANCE',
            title: 'Large cash variance',
            message: `${currentRow.account_name} changed by ${percentChange.toFixed(1)}% vs last month`,
            details: {
              account: currentRow.account_name,
              currentBalance,
              previousBalance: prevBalance,
              change,
              percentChange,
            },
            recommendation: 'Investigate significant cash movements. Verify large payments, receipts, or transfers.',
          });
        }
        
        if (accountName.includes('expense') && Math.abs(percentChange) > 150 && Math.abs(change) > 5000) {
          analyticalWarnings.push({
            severity: 'warning',
            type: 'UNUSUAL_VARIANCE',
            title: 'Unusual expense variance',
            message: `${currentRow.account_name} changed by ${percentChange.toFixed(1)}% vs last month`,
            details: {
              account: currentRow.account_name,
              currentBalance,
              previousBalance: prevBalance,
              change,
              percentChange,
            },
            recommendation: 'Review for duplicate entries, missing accruals, or one-time expenses.',
          });
        }
      });
    }

    // Check for zero revenue with non-zero expenses
    const totalRevenue = (accountsByType['revenue'] || []).reduce(
      (sum, row) => sum + (row.credit - row.debit),
      0
    );
    const totalExpenses = (accountsByType['expense'] || []).reduce(
      (sum, row) => sum + (row.debit - row.credit),
      0
    );

    if (totalRevenue === 0 && totalExpenses > 0) {
      analyticalWarnings.push({
        severity: 'warning',
        type: 'MISSING_REVENUE',
        title: 'No revenue recorded',
        message: 'Expenses exist but no revenue has been recorded for this period',
        details: { totalExpenses },
        recommendation: 'Verify if revenue recognition is pending or if this is expected for the period.',
      });
    }

    // Build final result
    const result = {
      companyId,
      period,
      uploadedAt: new Date().toISOString(),
      isBalanced,
      structuralErrors,
      analyticalWarnings,
      summary: {
        totalDebits,
        totalCredits,
        difference,
        totalAccounts: filteredData.length,
        totalRevenue,
        totalExpenses,
      },
      entries: filteredData,
      canClose: structuralErrors.length === 0, // Only block if structural errors exist
    };

    // Save to KV store
    const tbKey = `trial-balance:${companyId}:${period}`;
    await kv.set(tbKey, result);

    console.log(`✅ Trial balance processed and saved. Balanced: ${isBalanced}, Errors: ${structuralErrors.length}, Warnings: ${analyticalWarnings.length}`);

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Error processing trial balance:', error);
    return c.json({ error: `Failed to process trial balance: ${error.message}` }, 500);
  }
});

// Get trial balance for a company and period
app.get('/make-server-53c2e113/trial-balance/get', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const tbKey = `trial-balance:${companyId}:${period}`;
    const result = await kv.get(tbKey);

    if (!result) {
      return c.json({ error: 'No trial balance found for this company and period' }, 404);
    }

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Error fetching trial balance:', error);
    return c.json({ error: `Failed to fetch trial balance: ${error.message}` }, 500);
  }
});

export default app;

// ============================================================================
// AI-POWERED COLUMN DETECTION FOR TRIAL BALANCE
// ============================================================================

// Helper: Convert Excel date serial number to ISO string
function excelDateToISOString(value: string | number): string {
  if (!value) return new Date().toISOString().split('T')[0];
  
  // If it's already a date string, try to parse it
  if (typeof value === 'string') {
    // Try common date formats
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/,   // MM-DD-YYYY or DD-MM-YYYY
    ];
    
    for (const pattern of datePatterns) {
      if (pattern.test(value)) {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      }
    }
  }
  
  // If it's a number, assume Excel serial date
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

// Parse CSV using AI column detection
async function parseTrialBalanceCSV(uint8Array: Uint8Array, fileName: string): Promise<any[]> {
  const textDecoder = new TextDecoder('utf-8');
  const csvText = textDecoder.decode(uint8Array);
  const lines = csvText.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  // Get OpenAI API key
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  // Sample first 6 rows for AI analysis
  const sampleRows = lines.slice(0, 6).join('\n');

  const prompt = `Analyze this CSV trial balance file and identify the column indices.

CSV SAMPLE:
${sampleRows}

IMPORTANT: Trial balances typically have:
- Account Name or Account Description column
- Account Code/Number (optional)
- EITHER separate Debit and Credit columns, OR a single Balance column

Detect the delimiter used (comma, semicolon, tab, or pipe). Also detect if the CSV has quoted fields.

Return JSON with:
{
  "account_name_column": index,
  "account_code_column": index or null,
  "debit_column": index or null,
  "credit_column": index or null,
  "balance_column": index or null,
  "account_type_column": index or null,
  "header_row": row index (usually 0),
  "delimiter": "," or ";" or "\\t" or "|",
  "has_quotes": true or false
}

If you see Debit and Credit columns, set both. If you see only Balance column, set balance_column.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a CSV analysis expert specializing in accounting trial balance formats.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const aiResponse = await response.json();
  const columnMap = JSON.parse(aiResponse.choices[0].message.content);
  
  console.log('📋 Trial Balance CSV column mapping detected:', columnMap);

  // Helper function to parse CSV line respecting quotes
  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  // Parse trial balance entries
  const entries: any[] = [];
  const delimiter = columnMap.delimiter || ',';
  
  for (let i = columnMap.header_row + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line, delimiter);
    
    const accountName = cols[columnMap.account_name_column] || '';
    const accountCode = columnMap.account_code_column !== null ? cols[columnMap.account_code_column] : '';
    const accountType = columnMap.account_type_column !== null ? cols[columnMap.account_type_column] : '';
    
    let debit = 0;
    let credit = 0;
    
    // Handle different column structures
    if (columnMap.debit_column !== null && columnMap.credit_column !== null) {
      // Separate debit/credit columns
      debit = parseFloat(cols[columnMap.debit_column]?.replace(/[^0-9.-]/g, '') || '0') || 0;
      credit = parseFloat(cols[columnMap.credit_column]?.replace(/[^0-9.-]/g, '') || '0') || 0;
    } else if (columnMap.balance_column !== null) {
      // Single balance column
      const balance = parseFloat(cols[columnMap.balance_column]?.replace(/[^0-9.-]/g, '') || '0') || 0;
      if (balance > 0) {
        debit = balance;
        credit = 0;
      } else {
        debit = 0;
        credit = Math.abs(balance);
      }
    }
    
    // Skip empty rows and total rows
    const lowerAccountName = accountName.toLowerCase().trim();
    if (!lowerAccountName || lowerAccountName.includes('total') || (debit === 0 && credit === 0)) {
      continue;
    }
    
    entries.push({
      account_name: accountName,
      account_code: accountCode,
      account_type: accountType,
      debit,
      credit,
    });
  }

  console.log(`✅ Parsed ${entries.length} trial balance entries from CSV`);
  return entries;
}

// Parse XLSX using AI column detection
async function parseTrialBalanceXLSX(uint8Array: Uint8Array, fileName: string): Promise<any[]> {
  const workbook = XLSX.read(uint8Array, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('XLSX file must have at least a header row and one data row');
  }

  // Get OpenAI API key
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const sampleRows = JSON.stringify(jsonData.slice(0, 6), null, 2);
  
  const prompt = `Analyze this XLSX trial balance and identify the column indices.

XLSX SAMPLE:
${sampleRows}

IMPORTANT: Trial balances typically have:
- Account Name or Account Description column
- Account Code/Number (optional)
- EITHER separate Debit and Credit columns, OR a single Balance column

Return JSON with:
{
  "account_name_column": index,
  "account_code_column": index or null,
  "debit_column": index or null,
  "credit_column": index or null,
  "balance_column": index or null,
  "account_type_column": index or null,
  "header_row": row index (usually 0)
}

If you see Debit and Credit columns, set both. If you see only Balance column, set balance_column.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a spreadsheet analysis expert specializing in accounting trial balance formats.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const aiResponse = await response.json();
  const columnMap = JSON.parse(aiResponse.choices[0].message.content);

  console.log('📊 Trial Balance XLSX column mapping:', columnMap);

  // Parse entries
  const entries: any[] = [];
  for (let i = columnMap.header_row + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    if (!row || row.length === 0) continue;

    const accountName = String(row[columnMap.account_name_column] || '');
    const accountCode = columnMap.account_code_column !== null ? String(row[columnMap.account_code_column] || '') : '';
    const accountType = columnMap.account_type_column !== null ? String(row[columnMap.account_type_column] || '') : '';
    
    let debit = 0;
    let credit = 0;
    
    // Handle different column structures
    if (columnMap.debit_column !== null && columnMap.credit_column !== null) {
      // Separate debit/credit columns
      const debitStr = String(row[columnMap.debit_column] || '0').replace(/[^0-9.-]/g, '');
      const creditStr = String(row[columnMap.credit_column] || '0').replace(/[^0-9.-]/g, '');
      debit = parseFloat(debitStr) || 0;
      credit = parseFloat(creditStr) || 0;
    } else if (columnMap.balance_column !== null) {
      // Single balance column
      const balanceStr = String(row[columnMap.balance_column] || '0').replace(/[^0-9.-]/g, '');
      const balance = parseFloat(balanceStr) || 0;
      if (balance > 0) {
        debit = balance;
        credit = 0;
      } else {
        debit = 0;
        credit = Math.abs(balance);
      }
    }
    
    // Skip empty rows and total rows
    const lowerAccountName = accountName.toLowerCase().trim();
    if (!lowerAccountName || lowerAccountName.includes('total') || (debit === 0 && credit === 0)) {
      continue;
    }
    
    entries.push({
      account_name: accountName,
      account_code: accountCode,
      account_type: accountType,
      debit,
      credit,
    });
  }

  console.log(`✅ Parsed ${entries.length} trial balance entries from XLSX`);
  return entries;
}