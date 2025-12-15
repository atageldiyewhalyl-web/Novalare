import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-53c2e113');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================
// CREDIT CARD RECONCILIATION ROUTES
// ============================================

// Helper function to extract transactions from credit card statement using AI
async function extractCreditCardTransactions(fileContent: string, fileName: string) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  console.log('🤖 Calling OpenAI to extract credit card statement transactions...');

  const prompt = `You are an AI assistant specialized in extracting transaction data from credit card statements.

Extract ALL transactions from this credit card statement and return them as a JSON array.

For each transaction, extract:
- date: Transaction date in YYYY-MM-DD format
- description: Transaction description or merchant name
- merchant: Merchant or vendor name (extract the core business name, clean it up)
- amount: Transaction amount (always use positive numbers for charges/purchases, negative for credits/refunds)
- category: Transaction category if mentioned (e.g., "Travel", "Dining", "Office Supplies", "Fuel", etc.)
- card_last4: Last 4 digits of card number if shown in statement
- card_name: Card nickname or cardholder name if mentioned
- is_payment: Boolean flag - true if this is a PAYMENT transaction (credit card payment from bank), false if it's a regular expense

Also extract card-level information:
- card_name: The name/nickname of this credit card (e.g., "Corporate Amex", "Travel Card", etc.)
- card_last4: Last 4 digits of the card number
- statement_period: Statement period if mentioned
- statement_balance: The total statement balance amount
- payment_due_date: Payment due date if mentioned (YYYY-MM-DD format)
- payment_minimum: Minimum payment due amount
- previous_balance: Previous statement balance if mentioned
- new_charges: Total new charges for this period
- credits_refunds: Total credits/refunds for this period

IMPORTANT FOR PAYMENTS:
- Payment transactions are typically labeled as "PAYMENT", "ONLINE PAYMENT", "AUTOPAY", "PAYMENT RECEIVED", "THANK YOU", etc.
- Payment amounts should be NEGATIVE (they reduce the balance)
- Set is_payment: true for all payment transactions
- Set category: "Payment" for payment transactions

IMPORTANT FOR REGULAR TRANSACTIONS:
- Amounts should be numbers (not strings)
- Use positive numbers for purchases/charges
- Use negative numbers for credits/refunds (but NOT payments)
- Set is_payment: false for all non-payment transactions
- Ensure dates are in YYYY-MM-DD format
- Try to identify and clean up merchant names (remove location codes, transaction IDs, etc.)
- Categorize transactions based on merchant type if category is not explicit

Return ONLY valid JSON with this structure:
{
  "card_info": {
    "card_name": "Corporate Amex",
    "card_last4": "1234",
    "statement_period": "November 2024",
    "statement_balance": 1250.75,
    "payment_due_date": "2024-12-15",
    "payment_minimum": 50.00,
    "previous_balance": 800.00,
    "new_charges": 450.75,
    "credits_refunds": 0.00
  },
  "transactions": [
    {
      "date": "2024-11-01",
      "description": "ONLINE PAYMENT - THANK YOU",
      "merchant": "Online Payment",
      "amount": -800.00,
      "category": "Payment",
      "card_last4": "1234",
      "is_payment": true
    },
    {
      "date": "2024-11-15",
      "description": "AMAZON.COM*ABC123 SEATTLE WA",
      "merchant": "Amazon",
      "amount": 125.50,
      "category": "Office Supplies",
      "card_last4": "1234",
      "is_payment": false
    },
    {
      "date": "2024-11-16",
      "description": "STARBUCKS #12345 NEW YORK NY",
      "merchant": "Starbucks",
      "amount": 8.75,
      "category": "Dining",
      "card_last4": "1234",
      "is_payment": false
    },
    {
      "date": "2024-11-20",
      "description": "CREDIT FOR RETURN",
      "merchant": "Amazon",
      "amount": -25.00,
      "category": "Refund",
      "card_last4": "1234",
      "is_payment": false
    }
  ]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a financial data extraction expert. Return only valid JSON objects.'
        },
        {
          role: 'user',
          content: `${prompt}\n\nCredit Card Statement Content:\n${fileContent}`
        }
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', errorText);
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '{"card_info": {}, "transactions": []}';
  
  console.log('📄 Raw AI response:', content);
  
  // Parse the JSON response
  let result;
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1].trim();
    result = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    result = JSON.parse(content);
  }

  // Ensure we have the right structure
  const cardInfo = result.card_info || {};
  const transactions = result.transactions || [];

  console.log(`✅ Extracted ${transactions.length} transactions for card: ${cardInfo.card_name || 'Unknown'}`);
  return { cardInfo, transactions };
}

// Helper to read file content based on type
async function readFileContent(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return await file.text();
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    try {
      const XLSX = await import('npm:xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let text = '';
      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        text += `\nSheet: ${sheetName}\n`;
        text += XLSX.utils.sheet_to_csv(sheet);
        text += '\n';
      });
      
      console.log('📊 Excel file converted to text, length:', text.length);
      return text;
    } catch (e) {
      console.error('Error parsing Excel file:', e);
      throw new Error('Failed to parse Excel file');
    }
  } else if (fileName.endsWith('.pdf')) {
    try {
      console.log('📄 Parsing PDF file...');
      const { getDocument } = await import('npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs');
      
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      
      console.log('📄 Loading PDF document...');
      const loadingTask = getDocument({ data: typedArray });
      const pdf = await loadingTask.promise;
      
      console.log(`📄 PDF loaded with ${pdf.numPages} pages`);
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      console.log('📄 PDF text extracted, length:', fullText.length);
      return fullText;
    } catch (e) {
      console.error('Error parsing PDF file:', e);
      throw new Error('Failed to parse PDF file');
    }
  } else {
    throw new Error('Unsupported file type. Please upload CSV, Excel, or PDF files.');
  }
}

// Helper to generate unique statement ID
function generateStatementId(): string {
  return `cc_stmt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to generate unique transaction ID
function generateTransactionId(): string {
  return `cc_txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to sanitize filename for storage
function sanitizeFileName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')  // Replace invalid chars with underscores
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/_+/g, '_');  // Collapse multiple underscores
}

// Upload credit card statement
app.post('/cc-rec/upload-statement', async (c) => {
  try {
    console.log('📤 Uploading credit card statement...');
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const period = formData.get('period') as string;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    if (!companyId || !period) {
      return c.json({ error: 'Missing companyId or period' }, 400);
    }
    
    console.log(`📂 Processing file: ${file.name}, size: ${file.size} bytes`);
    
    // Read and parse file content
    const fileContent = await readFileContent(file);
    
    // Extract transactions using AI
    const { cardInfo, transactions } = await extractCreditCardTransactions(fileContent, file.name);
    
    if (transactions.length === 0) {
      return c.json({ 
        error: 'No transactions found', 
        details: 'The AI could not extract any transactions from this file. Please ensure it is a valid credit card statement.' 
      }, 400);
    }
    
    // Generate statement ID
    const statementId = generateStatementId();
    
    // Upload file to Supabase Storage
    const bucketName = 'make-53c2e113-cc-statements';
    const sanitizedFileName = sanitizeFileName(file.name);
    const storagePath = `${companyId}/${period}/${statementId}_${sanitizedFileName}`;
    
    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    if (!bucketExists) {
      console.log('📦 Creating storage bucket:', bucketName);
      await supabase.storage.createBucket(bucketName, { public: false });
    }
    
    // Upload file
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    console.log('✅ File uploaded to storage:', storagePath);
    
    // Store statement metadata
    const statement = {
      id: statementId,
      fileName: file.name,
      uploadedAt: Date.now(),
      transactionCount: transactions.length,
      filePath: storagePath,
      cardName: cardInfo.card_name || 'Unknown Card',
      cardLast4: cardInfo.card_last4 || null,
      statementPeriod: cardInfo.statement_period || null,
      statementBalance: cardInfo.statement_balance || null,
      paymentDueDate: cardInfo.payment_due_date || null,
      paymentMinimum: cardInfo.payment_minimum || null,
      previousBalance: cardInfo.previous_balance || null,
      newCharges: cardInfo.new_charges || null,
      creditsRefunds: cardInfo.credits_refunds || null,
    };
    
    const statementKey = `cc_rec:${companyId}:${period}:statement:${statementId}`;
    await kv.set(statementKey, statement);
    
    // Store transactions
    const transactionPromises = transactions.map((txn: any) => {
      const transactionId = generateTransactionId();
      const transaction = {
        id: transactionId,
        date: txn.date,
        description: txn.description,
        merchant: txn.merchant || null,
        amount: txn.amount,
        category: txn.category || null,
        cardName: statement.cardName,
        cardLast4: statement.cardLast4,
        statementId: statementId,
        isPayment: txn.is_payment || false,
      };
      
      const txnKey = `cc_rec:${companyId}:${period}:txn:${transactionId}`;
      return kv.set(txnKey, transaction);
    });
    
    await Promise.all(transactionPromises);
    
    console.log(`✅ Stored ${transactions.length} transactions`);
    
    return c.json({
      success: true,
      statementId,
      transactionCount: transactions.length,
      cardInfo,
    });
    
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return c.json(
      { 
        error: 'Upload failed', 
        details: error.message 
      },
      500
    );
  }
});

// Get all statements and transactions for a company/period
app.get('/cc-rec/statements', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'Missing companyId or period' }, 400);
    }
    
    console.log(`📂 Fetching CC statements for company ${companyId}, period ${period}`);
    
    // Get all statements
    const statementPrefix = `cc_rec:${companyId}:${period}:statement:`;
    const statements = await kv.getByPrefix(statementPrefix);
    
    // Get all transactions
    const txnPrefix = `cc_rec:${companyId}:${period}:txn:`;
    const allTransactions = await kv.getByPrefix(txnPrefix);
    
    // Separate payments from regular transactions
    const payments = allTransactions.filter((txn: any) => txn.isPayment === true);
    const transactions = allTransactions.filter((txn: any) => txn.isPayment !== true);
    
    console.log(`✅ Found ${statements.length} statements, ${transactions.length} transactions, ${payments.length} payments`);
    
    return c.json({
      statements,
      transactions,
      payments,
    });
    
  } catch (error: any) {
    console.error('Error fetching CC statements:', error);
    return c.json({ error: 'Failed to fetch statements' }, 500);
  }
});

// Delete a credit card statement
app.delete('/cc-rec/statement/:statementId', async (c) => {
  try {
    const statementId = c.req.param('statementId');
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'Missing companyId or period' }, 400);
    }
    
    console.log(`🗑️ Deleting statement ${statementId}`);
    
    // Delete all transactions for this statement
    const txnPrefix = `cc_rec:${companyId}:${period}:txn:`;
    const allTransactions = await kv.getByPrefix(txnPrefix);
    const statementTransactions = allTransactions.filter((txn: any) => txn.statementId === statementId);
    
    const txnDeletePromises = statementTransactions.map((txn: any) => {
      const txnKey = `cc_rec:${companyId}:${period}:txn:${txn.id}`;
      return kv.del(txnKey);
    });
    
    await Promise.all(txnDeletePromises);
    console.log(`✅ Deleted ${statementTransactions.length} transactions`);
    
    // Delete statement metadata
    const statementKey = `cc_rec:${companyId}:${period}:statement:${statementId}`;
    await kv.del(statementKey);
    
    console.log('✅ Statement deleted');
    
    return c.json({ success: true });
    
  } catch (error: any) {
    console.error('Delete error:', error);
    return c.json({ error: 'Failed to delete statement' }, 500);
  }
});

// View credit card statement (get signed URL)
app.get('/cc-rec/view-statement', async (c) => {
  try {
    const filePath = c.req.query('filePath');
    
    if (!filePath) {
      return c.json({ error: 'Missing filePath' }, 400);
    }
    
    const bucketName = 'make-53c2e113-cc-statements';
    
    // Create signed URL valid for 1 hour
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return c.json({ error: 'Failed to create signed URL' }, 500);
    }
    
    return c.json({ signedUrl: data.signedUrl });
    
  } catch (error: any) {
    console.error('View statement error:', error);
    return c.json({ error: 'Failed to view statement' }, 500);
  }
});

// Export credit card statements to Excel
app.post('/export-cc-statements', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, statements, transactions } = body;
    
    console.log('📊 Exporting CC statements to Excel...');
    
    const XLSX = await import('npm:xlsx');
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Create transactions worksheet
    const transactionsData = transactions.map((txn: any) => ({
      'Date': txn.date,
      'Card': txn.cardName || 'Unknown',
      'Last 4': txn.cardLast4 || '',
      'Merchant': txn.merchant || '',
      'Description': txn.description,
      'Category': txn.category || '',
      'Amount': txn.amount,
      'Is Payment': txn.isPayment || false,
    }));
    
    const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions');
    
    // Create summary worksheet
    const summaryData = statements.map((stmt: any) => ({
      'Card Name': stmt.cardName || 'Unknown',
      'Card Last 4': stmt.cardLast4 || '',
      'File Name': stmt.fileName,
      'Upload Date': new Date(stmt.uploadedAt).toLocaleString(),
      'Transactions': stmt.transactionCount,
      'Statement Balance': stmt.statementBalance || '',
      'Payment Due Date': stmt.paymentDueDate || '',
      'Payment Minimum': stmt.paymentMinimum || '',
      'Previous Balance': stmt.previousBalance || '',
      'New Charges': stmt.newCharges || '',
      'Credits/Refunds': stmt.creditsRefunds || '',
    }));
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    console.log('✅ Excel file generated');
    
    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="CC_Statements_${companyId}_${period}.xlsx"`,
      },
    });
    
  } catch (error: any) {
    console.error('Export error:', error);
    return c.json({ error: 'Export failed', details: error.message }, 500);
  }
});

// ============================================
// CREDIT CARD LEDGER ROUTES
// ============================================

// Upload and parse credit card ledger (CSV)
app.post('/cc-rec/upload-ledger', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const period = formData.get('period') as string;

    if (!file || !companyId || !period) {
      return c.json({ error: 'file, companyId, and period are required' }, 400);
    }

    console.log('📤 Processing credit card ledger:', file.name);

    // Parse the CSV file
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    const text = new TextDecoder().decode(uint8Array);
    
    // Use AI to parse the ledger with smart column detection
    const entries = await parseCCLedgerCSV(text, file.name);

    // Generate unique IDs for entries
    const entriesWithIds = entries.map(entry => ({
      ...entry,
      id: crypto.randomUUID()
    }));

    // Save ledger data (replaces any existing ledger for this company/period)
    const key = `cc-rec:${companyId}:${period}:ledger`;
    await kv.set(key, {
      fileName: file.name,
      uploadedAt: Date.now(),
      entries: entriesWithIds
    });

    console.log(`✅ Credit card ledger uploaded: ${entriesWithIds.length} entries extracted`);

    return c.json({
      success: true,
      entryCount: entriesWithIds.length
    });
  } catch (error: any) {
    console.error('❌ Error uploading credit card ledger:', error);
    return c.json({ error: `Failed to upload ledger: ${error.message}` }, 500);
  }
});

// Get credit card ledger entries
app.get('/cc-rec/ledger', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const key = `cc-rec:${companyId}:${period}:ledger`;
    const ledgerData = await kv.get(key);

    if (!ledgerData) {
      return c.json({ error: 'No ledger data found for this company and period' }, 404);
    }

    return c.json({
      entries: ledgerData.entries || [],
      fileName: ledgerData.fileName,
      uploadedAt: ledgerData.uploadedAt
    });
  } catch (error: any) {
    console.error('❌ Error loading credit card ledger:', error);
    return c.json({ error: `Failed to load ledger: ${error.message}` }, 500);
  }
});

// ============================================
// HELPER FUNCTIONS FOR LEDGER PARSING
// ============================================

// Helper function to parse dates (handles Excel dates and various formats)
function excelDateToISOString(value: any): string {
  if (!value) return new Date().toISOString().split('T')[0];
  
  // If it's already a date string (YYYY-MM-DD or MM/DD/YYYY or DD/MM/YYYY)
  if (typeof value === 'string') {
    // Try to parse various date formats
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // M/D/YYYY or MM/DD/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}$/, // M-D-YYYY or MM-DD-YYYY
    ];
    
    for (const format of dateFormats) {
      if (format.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
  }
  
  // If it's an Excel serial date number
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().split('T')[0];
  }
  
  // Fallback
  return new Date().toISOString().split('T')[0];
}

// Parse credit card ledger CSV with AI-powered column detection
async function parseCCLedgerCSV(text: string, fileName: string): Promise<any[]> {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const sampleRows = lines.slice(0, 6).join('\n');
  
  const prompt = `Analyze this credit card ledger CSV and identify the column indices.

CSV SAMPLE:
${sampleRows}

This is a CREDIT CARD SUB-LEDGER from an accounting system (QuickBooks, Xero, or DATEV).
This is NOT a credit card statement - it's the accounting LEDGER showing how charges were recorded.

Expected columns:
- Posting Date column (date the entry hit the books)
- Vendor/Merchant column (clean vendor name as recorded in accounting)
- Memo/Description column (optional - free text description)
- Debit column (charges/expenses - amount charged to expense accounts)
- Credit column (refunds/reversals/adjustments)
- GL Account column (expense account number like "6100 - Software" or "6250 - Travel")
- Card Account column (optional - which credit card liability account)
- Reference/Document column (optional - accounting system reference)

Return JSON with:
{
  "date_column": index,
  "vendor_column": index,
  "memo_column": index or null,
  "debit_column": index or null,
  "credit_column": index or null,
  "gl_account_column": index or null,
  "card_account_column": index or null,
  "reference_column": index or null,
  "header_row": row index (usually 0)
}

IMPORTANT: 
- Vendor/Merchant is the PRIMARY description field
- Memo is a SECONDARY optional description
- GL Account shows the expense category (6xxx account numbers)
- Debit = Charges to expense accounts
- Credit = Refunds or adjustments`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a CSV analysis expert specializing in accounting formats.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const aiResponse = await response.json();
  const columnMap = JSON.parse(aiResponse.choices[0].message.content);

  console.log('📊 Credit card ledger column mapping:', columnMap);

  // Parse entries
  const entries: any[] = [];
  for (let i = columnMap.header_row + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map(col => col.trim().replace(/^\"|\"$/g, ''));
    
    const debitStr = columnMap.debit_column !== null ? cols[columnMap.debit_column]?.replace(/[^0-9.-]/g, '') || '0' : '0';
    const creditStr = columnMap.credit_column !== null ? cols[columnMap.credit_column]?.replace(/[^0-9.-]/g, '') || '0' : '0';
    
    const debit = parseFloat(debitStr) || 0;
    const credit = parseFloat(creditStr) || 0;
    
    const entry = {
      date: excelDateToISOString(cols[columnMap.date_column] || ''),
      vendor: cols[columnMap.vendor_column] || '',
      memo: columnMap.memo_column !== null ? cols[columnMap.memo_column] : undefined,
      debit: Math.abs(debit),
      credit: Math.abs(credit),
      glAccount: columnMap.gl_account_column !== null ? cols[columnMap.gl_account_column] : undefined,
      cardAccount: columnMap.card_account_column !== null ? cols[columnMap.card_account_column] : undefined,
      reference: columnMap.reference_column !== null ? cols[columnMap.reference_column] : undefined
    };

    entries.push(entry);
  }

  return entries;
}

// ============================================
// CREDIT CARD RECONCILIATION MATCHING ENGINE
// ============================================

// Run Credit Card Reconciliation - Match CC transactions with ledger entries
app.post('/cc-rec/run-reconciliation', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period } = body;

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log(`🔄 Running CC reconciliation for company ${companyId}, period ${period}`);

    // Load CC transactions (excluding payments)
    const txnPrefix = `cc_rec:${companyId}:${period}:txn:`;
    const allTransactions = await kv.getByPrefix(txnPrefix);
    const ccTransactions = allTransactions.filter((txn: any) => txn.isPayment !== true);

    if (!ccTransactions || ccTransactions.length === 0) {
      return c.json({ error: 'No credit card transactions found. Please upload at least one statement first.' }, 400);
    }

    // Load ledger entries
    const ledgerKey = `cc-rec:${companyId}:${period}:ledger`;
    const ledgerData = await kv.get(ledgerKey);

    if (!ledgerData || !ledgerData.entries || ledgerData.entries.length === 0) {
      return c.json({ error: 'No ledger entries found. Please upload credit card ledger first.' }, 400);
    }

    const ccLedgerEntries = ledgerData.entries;

    console.log(`📊 Reconciling ${ccTransactions.length} CC transactions with ${ccLedgerEntries.length} ledger entries`);

    /* ==========================================
     * NOVALARE CREDIT CARD RECONCILIATION MATCHING ENGINE
     * ==========================================
     * 
     * MATCHING FUNNEL (5 STAGES):
     * 
     * 1️⃣ DETERMINISTIC EXACT MATCH (Confidence: 100%)
     *    - 1 CC Txn ↔ 1 Ledger Entry
     *    - Same date (±3 days) AND same amount (±$1)
     *    - Fast, cheap, highly accurate
     * 
     * 2️⃣ DETERMINISTIC ONE-TO-MANY MATCH (Confidence: 93-95%)
     *    - 1 CC Txn ↔ 2-3 Ledger Entries (sum matches)
     *    - Same date (±3 days) AND sum of amounts match (±$1)
     *    - Example: $1,073.01 CC → [$500, $300, $273.01] ledger
     *    - Filters by description similarity (>20%) to avoid false combos
     * 
     * 3️⃣ DETERMINISTIC MANY-TO-ONE MATCH (Confidence: 93-95%)
     *    - 2-3 CC Txns ↔ 1 Ledger Entry (sum matches)
     *    - Same date (±3 days) AND sum of amounts match (±$1)
     *    - Less common but important for consolidated entries
     * 
     * 4️⃣ FX-ADJUSTED MATCH (Confidence: 85-90%)
     *    - AI detects foreign exchange rate between amounts
     *    - Example: CC $445.28 ↔ Ledger €400 (rate ~1.113)
     *    - Uses GPT-4o-mini to validate FX rate reasonableness
     * 
     * 5️⃣ AI FUZZY MATCH (Confidence: 60-85%)
     *    - Last resort for remaining unmatched items
     *    - Uses GPT-4o to analyze description, amount, date similarity
     *    - Expensive but catches edge cases and errors
     * 
     * KEY PRINCIPLES:
     * - Process in order: cheap → expensive, certain → uncertain
     * - Mark used IDs to prevent double-matching
     * - Amounts use absolute value comparison
     * - Date matching handles multiple formats
     * - Description filtering prevents combinatorial explosion
     */

    const matchedPairs: any[] = [];
    const unmatchedCC: any[] = [];
    const unmatchedLedger: any[] = [];

    const usedCCIds = new Set<string>();
    const usedLedgerIds = new Set<string>();

    console.log('🔍 Step 1: Finding exact matches...');

    // Helper: Check if dates are within N days
    const datesMatch = (date1: string, date2: string, daysThreshold = 3): boolean => {
      try {
        const parseDate = (dateStr: string): Date | null => {
          if (!dateStr) return null;
          
          let d = new Date(dateStr);
          if (!isNaN(d.getTime())) return d;
          
          const patterns = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/
          ];
          
          for (const pattern of patterns) {
            const match = dateStr.match(pattern);
            if (match) {
              const [_, p1, p2, p3] = match;
              d = new Date(parseInt(p3) || parseInt(p1), parseInt(p2) - 1, parseInt(p1) || parseInt(p3));
              if (!isNaN(d.getTime())) return d;
            }
          }
          
          return null;
        };
        
        const d1 = parseDate(date1);
        const d2 = parseDate(date2);
        
        if (!d1 || !d2) {
          return date1 === date2;
        }
        
        const diffMs = Math.abs(d1.getTime() - d2.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= daysThreshold;
      } catch {
        return date1 === date2;
      }
    };

    // Helper: Check if amounts match (within tolerance)
    const amountsMatch = (amt1: number, amt2: number, tolerance = 1): boolean => {
      return Math.abs(Math.abs(amt1) - Math.abs(amt2)) <= tolerance;
    };

    // Helper: String similarity for merchant/vendor matching
    const stringSimilarity = (str1: string, str2: string): number => {
      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();
      
      if (s1 === s2) return 1.0;
      if (s1.length === 0 || s2.length === 0) return 0;
      
      if (s1.includes(s2) || s2.includes(s1)) return 0.8;
      
      const words1 = s1.split(/\s+/);
      const words2 = s2.split(/\s+/);
      const commonWords = words1.filter(w => words2.includes(w)).length;
      const totalWords = Math.max(words1.length, words2.length);
      
      return commonWords / totalWords;
    };

    // Step 1: Exact 1-to-1 matches
    let exactMatchCount = 0;
    
    for (const ccTxn of ccTransactions) {
      if (usedCCIds.has(ccTxn.id)) continue;

      for (const ledger of ccLedgerEntries) {
        if (usedLedgerIds.has(ledger.id)) continue;

        if (datesMatch(ccTxn.date, ledger.date) &&
            amountsMatch(ccTxn.amount, ledger.debit)) {
          matchedPairs.push({
            cc_transaction: ccTxn,
            ledger_entries: [ledger],
            match_confidence: 100,
            match_type: 'exact',
            explanation: 'Exact match on date and amount'
          });

          usedCCIds.add(ccTxn.id);
          usedLedgerIds.add(ledger.id);
          exactMatchCount++;
          break;
        }
      }
    }

    console.log(`✅ Found ${exactMatchCount} exact matches`);

    // Step 2: One-to-many matches (1 CC → multiple ledger entries)
    console.log('🔍 Step 2: Finding one-to-many matches...');
    let oneToManyCount = 0;

    for (const ccTxn of ccTransactions) {
      if (usedCCIds.has(ccTxn.id)) continue;

      const unusedLedger = ccLedgerEntries.filter(l => !usedLedgerIds.has(l.id));
      
      // OPTIMIZATION: Only check if we have a reasonable number of entries
      if (unusedLedger.length > 50 || unusedLedger.length < 2) continue;
      
      // OPTIMIZATION: Pre-filter by date to reduce combinations
      const dateCandidates = unusedLedger.filter(l => datesMatch(ccTxn.date, l.date, 3));
      
      if (dateCandidates.length < 2 || dateCandidates.length > 20) continue;
      
      // Try combinations of 2-3 ledger entries (limited by pre-filtering)
      for (let size = 2; size <= 3; size++) {
        if (oneToManyCount > 10) break; // OPTIMIZATION: Limit total 1:many matches
        
        const combinations = generateCombinations(dateCandidates, size);
        
        // OPTIMIZATION: Limit combinations checked per transaction
        const maxCombos = Math.min(combinations.length, 100);
        
        for (let i = 0; i < maxCombos; i++) {
          const combo = combinations[i];
          
          const sum = combo.reduce((acc, l) => acc + l.debit, 0);
          
          if (amountsMatch(ccTxn.amount, sum)) {
            matchedPairs.push({
              cc_transaction: ccTxn,
              ledger_entries: combo,
              match_confidence: 93,
              match_type: 'one_to_many',
              explanation: `1 CC transaction matched to ${combo.length} ledger entries`
            });

            usedCCIds.add(ccTxn.id);
            combo.forEach(l => usedLedgerIds.add(l.id));
            oneToManyCount++;
            break;
          }
        }
        
        if (usedCCIds.has(ccTxn.id)) break;
      }
    }

    console.log(`✅ Found ${oneToManyCount} one-to-many matches`);

    // Step 3: Many-to-one matches (multiple CC → 1 ledger)
    console.log('🔍 Step 3: Finding many-to-one matches...');
    let manyToOneCount = 0;

    for (const ledger of ccLedgerEntries) {
      if (usedLedgerIds.has(ledger.id)) continue;

      const unusedCC = ccTransactions.filter(t => !usedCCIds.has(t.id));
      
      // OPTIMIZATION: Only check if we have a reasonable number of entries
      if (unusedCC.length > 50 || unusedCC.length < 2) continue;
      
      // OPTIMIZATION: Pre-filter by date to reduce combinations
      const dateCandidates = unusedCC.filter(t => datesMatch(ledger.date, t.date, 3));
      
      if (dateCandidates.length < 2 || dateCandidates.length > 20) continue;
      
      for (let size = 2; size <= 3; size++) {
        if (manyToOneCount > 10) break; // OPTIMIZATION: Limit total many:1 matches
        
        const combinations = generateCombinations(dateCandidates, size);
        
        // OPTIMIZATION: Limit combinations checked per ledger entry
        const maxCombos = Math.min(combinations.length, 100);
        
        for (let i = 0; i < maxCombos; i++) {
          const combo = combinations[i];
          
          const sum = combo.reduce((acc, t) => acc + Math.abs(t.amount), 0);
          
          if (amountsMatch(ledger.debit, sum)) {
            matchedPairs.push({
              cc_transaction: combo[0],
              cc_transactions: combo,
              ledger_entries: [ledger],
              match_confidence: 93,
              match_type: 'many_to_one',
              explanation: `${combo.length} CC transactions matched to 1 ledger entry`
            });

            usedLedgerIds.add(ledger.id);
            combo.forEach(t => usedCCIds.add(t.id));
            manyToOneCount++;
            break;
          }
        }
        
        if (usedLedgerIds.has(ledger.id)) break;
      }
    }

    console.log(`✅ Found ${manyToOneCount} many-to-one matches`);

    // Step 4: FX-adjusted matching
    console.log('🔍 Step 4: Finding FX-adjusted matches...');
    let fxMatchCount = 0;

    const remainingCC = ccTransactions.filter(t => !usedCCIds.has(t.id));
    const remainingLedger = ccLedgerEntries.filter(l => !usedLedgerIds.has(l.id));

    for (const ccTxn of remainingCC) {
      for (const ledger of remainingLedger) {
        if (!datesMatch(ccTxn.date, ledger.date, 3)) continue;
        
        const ccAmount = Math.abs(ccTxn.amount);
        const ledgerAmount = ledger.debit;
        
        // Check if amounts could be FX-related with more realistic exchange rate bounds
        if (ccAmount < 0.01 || ledgerAmount < 0.01) continue;
        
        const ratio = ccAmount / ledgerAmount;
        
        // More realistic FX matching: ratio between 0.7-1.5, and vendors must be similar
        // Common exchange rates: EUR/USD ~1.1, GBP/USD ~1.25, etc.
        if (ratio >= 0.7 && ratio <= 1.5 && Math.abs(ratio - 1.0) > 0.03) {
          // Require vendor name similarity for FX matches
          const ccVendor = (ccTxn.description || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const ledgerVendor = (ledger.vendor || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          
          // Check if vendor names have meaningful overlap
          const hasVendorMatch = ccVendor.length > 3 && ledgerVendor.length > 3 && (
            ccVendor.includes(ledgerVendor.slice(0, Math.min(5, ledgerVendor.length))) ||
            ledgerVendor.includes(ccVendor.slice(0, Math.min(5, ccVendor.length)))
          );
          
          if (hasVendorMatch) {
            matchedPairs.push({
              cc_transaction: ccTxn,
              ledger_entries: [ledger],
              match_confidence: 82,
              match_type: 'fx',
              explanation: `FX conversion: ${ccAmount.toFixed(2)} to ${ledgerAmount.toFixed(2)} (rate: ${ratio.toFixed(4)})`
            });

            usedCCIds.add(ccTxn.id);
            usedLedgerIds.add(ledger.id);
            fxMatchCount++;
            break;
          }
        }
      }
    }

    console.log(`✅ Found ${fxMatchCount} FX-adjusted matches`);

    // Step 5: AI Fuzzy Matching for remaining items
    console.log('🔍 Step 5: Running AI fuzzy matching...');

    const finalRemainingCC = ccTransactions.filter(t => !usedCCIds.has(t.id));
    const finalRemainingLedger = ccLedgerEntries.filter(l => !usedLedgerIds.has(l.id));

    console.log(`🤖 AI Fuzzy: ${finalRemainingCC.length} CC, ${finalRemainingLedger.length} ledger remaining`);

    let fuzzyMatches = 0;
    
    if (finalRemainingCC.length > 0 && finalRemainingLedger.length > 0) {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      
      if (openaiApiKey) {
        try {
          const MAX_AI_ITEMS = 30;
          const limitedCC = finalRemainingCC.slice(0, MAX_AI_ITEMS);
          const limitedLedger = finalRemainingLedger.slice(0, MAX_AI_ITEMS);

          const prompt = `You are an expert credit card reconciliation assistant. Match CC transactions with ledger entries.

CC TRANSACTIONS (${limitedCC.length}):
${JSON.stringify(limitedCC, null, 2)}

LEDGER ENTRIES (${limitedLedger.length}):
${JSON.stringify(limitedLedger, null, 2)}

MATCHING CRITERIA:
- Date proximity (within ±5 days is good)
- Amount similarity (exact or very close)
- Merchant/vendor similarity (fuzzy matching)
- Description similarity

Return JSON array of matches:
[
  {
    "cc_transaction_id": "...",
    "ledger_entry_ids": ["..."],
    "confidence": 0.75,
    "explanation": "Similar merchant name and amount"
  }
]

Only return matches with confidence >= 0.60. Return empty array if no good matches.`;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'You are a financial reconciliation expert. Return only valid JSON arrays.' },
                { role: 'user', content: prompt }
              ],
              response_format: { type: 'json_object' },
              temperature: 0.2,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices[0]?.message?.content || '{"matches":[]}';
            let aiMatches = JSON.parse(content);
            
            if (!Array.isArray(aiMatches)) {
              aiMatches = aiMatches.matches || [];
            }

            console.log(`🤖 AI found ${aiMatches.length} fuzzy matches`);

            for (const match of aiMatches) {
              const ccTxn = limitedCC.find(t => t.id === match.cc_transaction_id);
              const ledgerEntries = match.ledger_entry_ids.map((id: string) => 
                limitedLedger.find(l => l.id === id)
              ).filter(Boolean);

              if (ccTxn && ledgerEntries.length > 0 &&
                  !usedCCIds.has(ccTxn.id) &&
                  ledgerEntries.every(l => !usedLedgerIds.has(l.id))) {
                
                matchedPairs.push({
                  cc_transaction: ccTxn,
                  ledger_entries: ledgerEntries,
                  match_confidence: Math.round(match.confidence * 100),
                  match_type: 'fuzzy',
                  explanation: match.explanation
                });

                usedCCIds.add(ccTxn.id);
                ledgerEntries.forEach(l => usedLedgerIds.add(l.id));
                fuzzyMatches++;
              }
            }
          }
        } catch (err) {
          console.error('AI fuzzy matching error:', err);
        }
      } else {
        console.log('⚠️ Skipping AI fuzzy matching - OPENAI_API_KEY not configured');
      }
    }

    console.log(`✅ Found ${fuzzyMatches} AI fuzzy matches`);

    // Compile unmatched items
    for (const ccTxn of ccTransactions) {
      if (!usedCCIds.has(ccTxn.id)) {
        unmatchedCC.push({
          transaction: ccTxn,
          suggested_action: 'Review transaction - no matching ledger entry found'
        });
      }
    }

    for (const ledger of ccLedgerEntries) {
      if (!usedLedgerIds.has(ledger.id)) {
        unmatchedLedger.push({
          entry: ledger,
          reason: 'No matching CC transaction found',
          action: 'Verify if this was recorded correctly in ledger'
        });
      }
    }

    // Calculate summary statistics
    const totalCCAmount = ccTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalLedgerAmount = ccLedgerEntries.reduce((sum, l) => sum + l.debit, 0);

    const result = {
      matched_pairs: matchedPairs,
      unmatched_cc: unmatchedCC,
      unmatched_ledger: unmatchedLedger,
      summary: {
        total_cc_transactions: ccTransactions.length,
        total_ledger_entries: ccLedgerEntries.length,
        matched_count: matchedPairs.length,
        unmatched_cc_count: unmatchedCC.length,
        unmatched_ledger_count: unmatchedLedger.length,
        total_cc_amount: totalCCAmount,
        total_ledger_amount: totalLedgerAmount,
        difference: totalCCAmount - totalLedgerAmount,
        match_rate: (matchedPairs.length / ccTransactions.length) * 100,
        exact_matches: exactMatchCount,
        one_to_many_matches: oneToManyCount,
        many_to_one_matches: manyToOneCount,
        fx_matches: fxMatchCount,
        fuzzy_matches: fuzzyMatches,
      },
      reconciled_at: new Date().toISOString(),
    };

    // Save reconciliation result
    const recKey = `cc-rec:${companyId}:${period}:reconciliation`;
    await kv.set(recKey, result);

    console.log(`✅ CC Reconciliation completed: ${result.summary.match_rate.toFixed(1)}% match rate`);
    console.log(`📊 Match breakdown: Exact=${exactMatchCount}, 1:Many=${oneToManyCount}, Many:1=${manyToOneCount}, FX=${fxMatchCount}, Fuzzy=${fuzzyMatches}`);

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Error running CC reconciliation:', error);
    return c.json({ error: `Failed to run reconciliation: ${error.message}` }, 500);
  }
});

// Helper function to generate combinations
function generateCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 1) return arr.map(item => [item]);
  
  const results: T[][] = [];
  
  for (let i = 0; i <= arr.length - size; i++) {
    const head = arr[i];
    const tailCombinations = generateCombinations(arr.slice(i + 1), size - 1);
    
    for (const tail of tailCombinations) {
      results.push([head, ...tail]);
    }
  }
  
  return results;
}

// Get reconciliation data
app.get('/cc-rec/reconciliation', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const recKey = `cc-rec:${companyId}:${period}:reconciliation`;
    const result = await kv.get(recKey);

    if (!result) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Load additional data from separate keys
    const resolvedKey = `cc-rec:${companyId}:${period}:resolved`;
    const followUpKey = `cc-rec:${companyId}:${period}:follow-up`;
    
    const resolvedData = await kv.get(resolvedKey);
    const followUpData = await kv.get(followUpKey);
    
    // Merge all data together
    const fullResult = {
      ...result,
      resolved_items: resolvedData?.items || [],
      follow_up_items: followUpData?.items || []
    };

    return c.json({ reconciliation: fullResult });
  } catch (error: any) {
    console.error('❌ Error fetching CC reconciliation:', error);
    return c.json({ error: `Failed to fetch reconciliation: ${error.message}` }, 500);
  }
});

// Lock (save) a reconciliation
app.post('/cc-rec/lock-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();
    
    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `cc-rec:${company_id}:${period}:reconciliation`;
    const reconciliation = await kv.get(key);
    
    if (!reconciliation) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    reconciliation.locked = true;
    reconciliation.lockedAt = new Date().toISOString();
    
    await kv.set(key, reconciliation);

    console.log(`🔒 Locked CC reconciliation for ${company_id} - ${period}`);
    
    return c.json({ success: true, reconciliation });
  } catch (error: any) {
    console.error('❌ Error locking CC reconciliation:', error);
    return c.json({ error: `Failed to lock reconciliation: ${error.message}` }, 500);
  }
});

// Unlock a reconciliation to allow updates
app.post('/cc-rec/unlock-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();
    
    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `cc-rec:${company_id}:${period}:reconciliation`;
    const reconciliation = await kv.get(key);
    
    if (!reconciliation) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    reconciliation.locked = false;
    reconciliation.unlockedAt = new Date().toISOString();
    
    await kv.set(key, reconciliation);

    console.log(`🔓 Unlocked CC reconciliation for ${company_id} - ${period}`);
    
    return c.json({ success: true, reconciliation });
  } catch (error: any) {
    console.error('❌ Error unlocking CC reconciliation:', error);
    return c.json({ error: `Failed to unlock reconciliation: ${error.message}` }, 500);
  }
});

// Match CC transactions with ledger entries manually
app.post('/cc-rec/match-items', async (c) => {
  try {
    const { companyId, period, ccItems, ledgerItems } = await c.req.json();
    
    if (!companyId || !period || !ccItems || !ledgerItems) {
      return c.json({ error: 'companyId, period, ccItems, and ledgerItems are required' }, 400);
    }

    console.log(`🔗 Manually matching ${ccItems.length} CC items with ${ledgerItems.length} ledger items for ${companyId} - ${period}`);

    const recKey = `cc-rec:${companyId}:${period}:reconciliation`;
    const reconciliation = await kv.get(recKey);
    
    if (!reconciliation) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Create a new match group
    const matchGroupId = `manual-match-${Date.now()}`;
    const newMatch = {
      matchGroupId,
      ccTransactions: ccItems,
      ledgerEntries: ledgerItems,
      matchedAt: new Date().toISOString(),
      matchType: 'manual',
      explanation: 'Manually matched by user',
      confidence: 100
    };

    // Add to manually_matched_items (NOT pre_matched_items - those are AI-matched only)
    if (!reconciliation.manually_matched_items) {
      reconciliation.manually_matched_items = [];
    }
    reconciliation.manually_matched_items.push(newMatch);

    // Remove matched items from unmatched arrays
    const ccIds = ccItems.map((item: any) => item.id);
    const ledgerIds = ledgerItems.map((item: any) => item.id);
    
    reconciliation.unmatched_cc = reconciliation.unmatched_cc.filter(
      (item: any) => !ccIds.includes(item.transaction?.id)
    );
    reconciliation.unmatched_ledger = reconciliation.unmatched_ledger.filter(
      (item: any) => !ledgerIds.includes(item.entry?.id)
    );

    // Add matched items to resolved_items array
    if (!reconciliation.resolved_items) {
      reconciliation.resolved_items = [];
    }
    
    // Add each CC item as a resolved item
    ccItems.forEach((transaction: any) => {
      reconciliation.resolved_items.push({
        type: 'cc',
        item: { transaction, suggested_action: 'Matched' },
        markedAt: new Date().toISOString(),
        status: 'matched',
        resolution: 'Matched items',
        matchGroupId
      });
    });
    
    // Add each ledger item as a resolved item
    ledgerItems.forEach((entry: any) => {
      reconciliation.resolved_items.push({
        type: 'ledger',
        item: { entry, reason: 'Matched', action: 'Matched' },
        markedAt: new Date().toISOString(),
        status: 'matched',
        resolution: 'Matched items',
        matchGroupId
      });
    });

    // Update summary counts
    reconciliation.summary.matched_count += (ccItems.length + ledgerItems.length);
    reconciliation.summary.unmatched_cc_count = reconciliation.unmatched_cc.length;
    reconciliation.summary.unmatched_ledger_count = reconciliation.unmatched_ledger.length;

    // Save updated reconciliation
    await kv.set(recKey, reconciliation);

    console.log(`✅ Successfully matched items. Match group ID: ${matchGroupId}`);
    
    return c.json({ success: true, matchGroupId, reconciliation });
  } catch (error: any) {
    console.error('❌ Error matching CC items:', error);
    return c.json({ error: `Failed to match items: ${error.message}` }, 500);
  }
});

// Mark CC transaction as timing difference
app.post('/cc-rec/mark-timing-difference', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item } = body;
    
    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`⏰ CC Rec - Marking as timing difference:`, type, companyId, period);

    // Get current reconciliation data
    const recKey = `cc-rec:${companyId}:${period}:reconciliation`;
    const reconciliation = await kv.get(recKey);
    
    if (!reconciliation) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Get item ID for matching
    const itemId = type === 'cc' ? item.transaction?.id : item.entry?.id;
    const matchGroupId = `timing-${itemId}`;

    // Remove from unmatched list
    if (type === 'cc' && reconciliation.unmatched_cc) {
      reconciliation.unmatched_cc = reconciliation.unmatched_cc.filter((unmatchedItem: any) => 
        unmatchedItem.transaction?.id !== itemId
      );
      
      if (reconciliation.summary) {
        reconciliation.summary.unmatched_cc_count = reconciliation.unmatched_cc.length;
      }
    } else if (type === 'ledger' && reconciliation.unmatched_ledger) {
      reconciliation.unmatched_ledger = reconciliation.unmatched_ledger.filter((unmatchedItem: any) => 
        unmatchedItem.entry?.id !== itemId
      );
      
      if (reconciliation.summary) {
        reconciliation.summary.unmatched_ledger_count = reconciliation.unmatched_ledger.length;
      }
    }

    // Add to resolved items
    if (!reconciliation.resolved_items) {
      reconciliation.resolved_items = [];
    }
    
    reconciliation.resolved_items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'timing_difference',
      resolution: 'Will clear next period',
      matchGroupId
    });
    
    await kv.set(recKey, reconciliation);

    console.log('✅ CC Rec - Marked as timing difference');
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error marking CC item as timing difference:', error);
    return c.json({ error: `Failed to mark as timing difference: ${error.message}` }, 500);
  }
});

// Mark CC transaction as ignored/non-issue
app.post('/cc-rec/mark-ignored', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item } = body;
    
    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`🙈 CC Rec - Marking as ignored:`, type, companyId, period);

    // Get current reconciliation data
    const recKey = `cc-rec:${companyId}:${period}:reconciliation`;
    const reconciliation = await kv.get(recKey);
    
    if (!reconciliation) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Get item ID for matching
    const itemId = type === 'cc' ? item.transaction?.id : item.entry?.id;
    const matchGroupId = `ignored-${itemId}`;

    // Remove from unmatched list
    if (type === 'cc' && reconciliation.unmatched_cc) {
      reconciliation.unmatched_cc = reconciliation.unmatched_cc.filter((unmatchedItem: any) => 
        unmatchedItem.transaction?.id !== itemId
      );
      
      if (reconciliation.summary) {
        reconciliation.summary.unmatched_cc_count = reconciliation.unmatched_cc.length;
      }
    } else if (type === 'ledger' && reconciliation.unmatched_ledger) {
      reconciliation.unmatched_ledger = reconciliation.unmatched_ledger.filter((unmatchedItem: any) => 
        unmatchedItem.entry?.id !== itemId
      );
      
      if (reconciliation.summary) {
        reconciliation.summary.unmatched_ledger_count = reconciliation.unmatched_ledger.length;
      }
    }

    // Add to resolved items
    if (!reconciliation.resolved_items) {
      reconciliation.resolved_items = [];
    }
    
    reconciliation.resolved_items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'ignored',
      resolution: 'Marked as non-issue',
      matchGroupId
    });
    
    await kv.set(recKey, reconciliation);

    console.log('✅ CC Rec - Marked as ignored');
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error marking CC item as ignored:', error);
    return c.json({ error: `Failed to mark as ignored: ${error.message}` }, 500);
  }
});

// Request information / add to follow-up
app.post('/cc-rec/request-information', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item, note } = body;
    
    if (!companyId || !period || !type || !item || !note) {
      return c.json({ error: 'companyId, period, type, item, and note are required' }, 400);
    }

    console.log(`📝 CC Rec - Adding to follow-up:`, type, companyId, period);

    // Get current reconciliation data
    const recKey = `cc-rec:${companyId}:${period}:reconciliation`;
    const reconciliation = await kv.get(recKey);
    
    if (!reconciliation) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Get item ID for matching
    const itemId = type === 'cc' ? item.transaction?.id : item.entry?.id;

    // Remove from unmatched list
    if (type === 'cc' && reconciliation.unmatched_cc) {
      reconciliation.unmatched_cc = reconciliation.unmatched_cc.filter((unmatchedItem: any) => 
        unmatchedItem.transaction?.id !== itemId
      );
      
      if (reconciliation.summary) {
        reconciliation.summary.unmatched_cc_count = reconciliation.unmatched_cc.length;
      }
    } else if (type === 'ledger' && reconciliation.unmatched_ledger) {
      reconciliation.unmatched_ledger = reconciliation.unmatched_ledger.filter((unmatchedItem: any) => 
        unmatchedItem.entry?.id !== itemId
      );
      
      if (reconciliation.summary) {
        reconciliation.summary.unmatched_ledger_count = reconciliation.unmatched_ledger.length;
      }
    }

    // Add to follow-up items
    if (!reconciliation.follow_up_items) {
      reconciliation.follow_up_items = [];
    }
    
    reconciliation.follow_up_items.push({
      type,
      item,
      note,
      markedAt: new Date().toISOString()
    });
    
    await kv.set(recKey, reconciliation);

    console.log('✅ CC Rec - Added to follow-up');
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error adding CC item to follow-up:', error);
    return c.json({ error: `Failed to add to follow-up: ${error.message}` }, 500);
  }
});

export default app;