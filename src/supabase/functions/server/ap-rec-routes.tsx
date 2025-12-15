import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-53c2e113');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================
// AP RECONCILIATION ROUTES
// ============================================

// Helper function to extract transactions from vendor statement using AI
async function extractVendorStatementTransactions(fileContent: string, fileName: string) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  console.log('🤖 Calling OpenAI to extract vendor statement transactions...');

  const prompt = `You are an AI assistant specialized in extracting transaction data from vendor account statements.

Extract ALL transactions from this vendor statement and return them as a JSON array.

For each transaction, extract:
- date: Transaction date in YYYY-MM-DD format
- description: Transaction description or memo
- amount: Transaction amount (positive for charges/invoices, negative for payments/credits)
- balance: Running balance if available (optional)
- invoice_number: Invoice or reference number if available (optional)
- type: "invoice" or "payment" or "credit" or "debit" (classify based on context)

IMPORTANT:
- Extract ALL transactions, no matter how many
- Amounts should be numbers (not strings)
- Use negative numbers for payments/credits
- Use positive numbers for charges/invoices
- If balance is not shown, omit it or use null
- Ensure dates are in YYYY-MM-DD format

Return ONLY valid JSON array, nothing else. Example:
[
  {
    "date": "2024-01-15",
    "description": "Invoice #12345 - Office Supplies",
    "amount": 1250.50,
    "balance": 5430.25,
    "invoice_number": "12345",
    "type": "invoice"
  },
  {
    "date": "2024-01-20",
    "description": "Payment received - Check #9876",
    "amount": -1000.00,
    "balance": 4430.25,
    "invoice_number": null,
    "type": "payment"
  }
]`;

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
          content: 'You are a financial data extraction expert. Return only valid JSON arrays.'
        },
        {
          role: 'user',
          content: `${prompt}\n\nVendor Statement Content:\n${fileContent}`
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
  const content = data.choices[0]?.message?.content || '[]';
  
  console.log('📄 Raw AI response:', content);
  
  // Parse the JSON response
  let transactions = [];
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1].trim();
    transactions = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    transactions = JSON.parse(content);
  }

  console.log(`✅ Extracted ${transactions.length} transactions`);
  return transactions;
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
      // Use jsr:@lillallol/pdfjs for Deno environment compatibility
      const { getDocument } = await import('npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs');
      
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      
      console.log('📄 Loading PDF document...');
      const loadingTask = getDocument({
        data: typedArray,
        useSystemFonts: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/',
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      console.log(`📄 PDF loaded with ${numPages} pages`);
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      console.log('✅ PDF parsed successfully, pages:', numPages, 'text length:', fullText.length);
      console.log('📝 First 500 chars of PDF:', fullText.substring(0, 500));
      
      return fullText;
    } catch (e) {
      console.error('Error parsing PDF file:', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to parse PDF file: ${errMsg}`);
    }
  } else {
    return await file.text();
  }
}

// Helper to sanitize filename for storage
function sanitizeFileName(fileName: string): string {
  // Replace special characters with safe alternatives
  return fileName
    .replace(/–/g, '-')  // Replace en dash with regular hyphen
    .replace(/—/g, '-')  // Replace em dash with regular hyphen
    .replace(/[^\w\s.-]/g, '_')  // Replace other special chars with underscore
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/_+/g, '_');  // Collapse multiple underscores
}

// Upload vendor statement
app.post('/ap-rec/upload-vendor-statement', async (c) => {
  try {
    console.log('📤 Uploading vendor statement...');
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const period = formData.get('period') as string;
    
    if (!file || !companyId || !period) {
      return c.json({ error: 'file, companyId, and period are required' }, 400);
    }

    console.log(`📄 Processing vendor statement: ${file.name} for company ${companyId}, period ${period}`);

    // Read file content
    let fileContent: string;
    try {
      console.log('📖 Reading file content...');
      fileContent = await readFileContent(file);
      console.log(`✅ File content read successfully, length: ${fileContent.length}`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error reading file content:', errMsg, e);
      throw new Error(`Failed to read file content: ${errMsg}`);
    }
    
    // Extract transactions using AI
    let transactions: any[];
    try {
      console.log('🤖 Extracting transactions with AI...');
      transactions = await extractVendorStatementTransactions(fileContent, file.name);
      console.log(`✅ Transactions extracted successfully: ${transactions.length} transactions`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error extracting transactions:', errMsg, e);
      throw new Error(`Failed to extract transactions: ${errMsg}`);
    }
    
    // Upload file to Supabase Storage
    const bucketName = 'make-53c2e113-ap-statements';
    
    // Create bucket if it doesn't exist
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      if (!bucketExists) {
        console.log('📦 Creating storage bucket...');
        await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 52428800, // 50MB
        });
        console.log('✅ Storage bucket created');
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error creating bucket:', errMsg, e);
      throw new Error(`Failed to create storage bucket: ${errMsg}`);
    }
    
    // Upload file
    const fileName = `${companyId}/${period}/${Date.now()}-${sanitizeFileName(file.name)}`;
    let uploadData: any;
    try {
      console.log('📤 Uploading file to storage...');
      const arrayBuffer = await file.arrayBuffer();
      
      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });
      
      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw uploadError;
      }
      
      uploadData = data;
      console.log('✅ File uploaded to storage:', uploadData.path);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error uploading to storage:', errMsg, e);
      throw new Error(`Failed to upload to storage: ${errMsg}`);
    }
    
    // Get the existing vendor statements data
    const key = `ap-rec:${companyId}:${period}:vendor-statements`;
    let existingData: any;
    try {
      existingData = await kv.get(key) || { statements: [], transactions: [] };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error fetching existing data:', errMsg, e);
      throw new Error(`Failed to fetch existing data: ${errMsg}`);
    }
    
    // Create statement record
    const statementId = `stmt-${Date.now()}`;
    const statement = {
      id: statementId,
      fileName: file.name,
      uploadedAt: Date.now(),
      transactionCount: transactions.length,
      filePath: uploadData.path,
    };
    
    // Add IDs and metadata to transactions
    const transactionsWithIds = transactions.map((tx: any, idx: number) => ({
      id: `${statementId}-tx-${idx}`,
      ...tx,
      statementId: statementId,
      statementName: file.name,
    }));
    
    // Update the stored data
    const updatedData = {
      statements: [...existingData.statements, statement],
      transactions: [...existingData.transactions, ...transactionsWithIds],
    };
    
    try {
      console.log('💾 Saving data to KV store...');
      await kv.set(key, updatedData);
      console.log(`✅ Saved ${transactions.length} transactions from vendor statement`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error saving to KV store:', errMsg, e);
      throw new Error(`Failed to save data: ${errMsg}`);
    }
    
    return c.json({
      success: true,
      statementId,
      transactionCount: transactions.length,
      statement,
    });
    
  } catch (error) {
    console.error('❌ Error uploading vendor statement:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const errMsg = error instanceof Error ? error.message : String(error);
    return c.json({ 
      error: 'Failed to upload vendor statement',
      details: errMsg || 'Unknown error occurred'
    }, 500);
  }
});

// Get vendor statements and transactions
app.get('/ap-rec/vendor-statements', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const key = `ap-rec:${companyId}:${period}:vendor-statements`;
    const data = await kv.get(key);
    
    return c.json({
      statements: data?.statements || [],
      transactions: data?.transactions || []
    });
  } catch (error) {
    console.error('❌ Error fetching vendor statements:', error);
    return c.json({ error: 'Failed to fetch vendor statements' }, 500);
  }
});

// Delete vendor statement
app.delete('/ap-rec/vendor-statement/:statementId', async (c) => {
  try {
    const statementId = c.req.param('statementId');
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const key = `ap-rec:${companyId}:${period}:vendor-statements`;
    const data = await kv.get(key);
    
    if (!data) {
      return c.json({ error: 'No data found' }, 404);
    }

    // Find the statement
    const statement = data.statements.find((s: any) => s.id === statementId);
    if (!statement) {
      return c.json({ error: 'Statement not found' }, 404);
    }

    // Delete file from storage
    if (statement.filePath) {
      const bucketName = 'make-53c2e113-ap-statements';
      await supabase.storage.from(bucketName).remove([statement.filePath]);
      console.log('🗑️ Deleted file from storage:', statement.filePath);
    }

    // Remove statement and its transactions
    const updatedData = {
      statements: data.statements.filter((s: any) => s.id !== statementId),
      transactions: data.transactions.filter((t: any) => t.statementId !== statementId),
    };
    
    await kv.set(key, updatedData);
    
    console.log(`✅ Deleted vendor statement ${statementId} and its transactions`);
    
    return c.json({ success: true });
    
  } catch (error) {
    console.error('❌ Error deleting vendor statement:', error);
    return c.json({ error: 'Failed to delete vendor statement' }, 500);
  }
});

// Get signed URL for viewing a vendor statement
app.get('/ap-rec/vendor-statement/:statementId/view', async (c) => {
  try {
    const statementId = c.req.param('statementId');
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const key = `ap-rec:${companyId}:${period}:vendor-statements`;
    const data = await kv.get(key);
    
    if (!data) {
      return c.json({ error: 'No data found' }, 404);
    }

    const statement = data.statements.find((s: any) => s.id === statementId);
    if (!statement || !statement.filePath) {
      return c.json({ error: 'Statement not found' }, 404);
    }

    // Create signed URL (valid for 1 hour)
    const bucketName = 'make-53c2e113-ap-statements';
    const { data: signedUrlData, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(statement.filePath, 3600);
    
    if (error) {
      console.error('❌ Error creating signed URL:', error);
      throw error;
    }

    return c.json({ 
      url: signedUrlData.signedUrl,
      fileName: statement.fileName 
    });
    
  } catch (error) {
    console.error('❌ Error getting signed URL:', error);
    return c.json({ error: 'Failed to get view URL' }, 500);
  }
});

// Get AP ledger data
app.get('/ap-rec/ap-ledger', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const key = `ap-rec:${companyId}:${period}:ap-ledger`;
    const data = await kv.get(key);
    
    return c.json({
      ledger: data?.ledger || null,
      entries: data?.entries || []
    });
  } catch (error) {
    console.error('❌ Error fetching AP ledger:', error);
    return c.json({ error: 'Failed to fetch AP ledger' }, 500);
  }
});

// Upload AP ledger
app.post('/ap-rec/upload-ap-ledger', async (c) => {
  try {
    console.log('📤 Uploading AP ledger...');
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const period = formData.get('period') as string;
    
    if (!file || !companyId || !period) {
      return c.json({ error: 'file, companyId, and period are required' }, 400);
    }

    console.log(`📄 Processing AP ledger: ${file.name} for company ${companyId}, period ${period}`);

    // Read file content
    let fileContent: string;
    try {
      console.log('📖 Reading file content...');
      fileContent = await readFileContent(file);
      console.log(`✅ File content read successfully, length: ${fileContent.length}`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error reading file content:', errMsg, e);
      throw new Error(`Failed to read file content: ${errMsg}`);
    }
    
    // Extract AP entries using AI
    let entries: any[];
    try {
      console.log('🤖 Extracting AP ledger entries with AI...');
      entries = await extractAPLedgerEntries(fileContent, file.name);
      console.log(`✅ AP entries extracted successfully: ${entries.length} entries`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error extracting AP entries:', errMsg, e);
      throw new Error(`Failed to extract AP entries: ${errMsg}`);
    }
    
    // Create ledger record
    const ledgerId = `ledger-${Date.now()}`;
    const ledger = {
      id: ledgerId,
      fileName: file.name,
      uploadedAt: Date.now(),
      entryCount: entries.length,
    };
    
    // Add IDs to entries
    const entriesWithIds = entries.map((entry: any, idx: number) => ({
      id: `${ledgerId}-entry-${idx}`,
      ...entry,
    }));
    
    // Save to KV store
    const key = `ap-rec:${companyId}:${period}:ap-ledger`;
    const data = {
      ledger,
      entries: entriesWithIds,
    };
    
    try {
      console.log('💾 Saving AP ledger to KV store...');
      await kv.set(key, data);
      console.log(`✅ Saved ${entries.length} entries from AP ledger`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error saving to KV store:', errMsg, e);
      throw new Error(`Failed to save data: ${errMsg}`);
    }
    
    return c.json({
      success: true,
      ledgerId,
      entryCount: entries.length,
      ledger,
    });
    
  } catch (error) {
    console.error('❌ Error uploading AP ledger:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const errMsg = error instanceof Error ? error.message : String(error);
    return c.json({ 
      error: 'Failed to upload AP ledger',
      details: errMsg || 'Unknown error occurred'
    }, 500);
  }
});

// Helper function to extract AP ledger entries using AI
async function extractAPLedgerEntries(fileContent: string, fileName: string) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  console.log('🤖 Calling OpenAI to extract AP ledger entries...');

  const prompt = `You are an AI assistant specialized in extracting data from AP (Accounts Payable) ledgers.

Extract ALL entries from this AP ledger and return them as a JSON array.

For each entry, extract:
- date: Entry date in YYYY-MM-DD format
- description: Entry description or memo
- amount: Entry amount (positive for debits/expenses, negative for credits/payments)
- account: Account code or name if available (optional)
- reference: Reference number, invoice number, or document number if available (optional)
- vendor: Vendor name if available (optional)

IMPORTANT:
- Extract ALL entries, no matter how many
- Amounts should be numbers (not strings)
- Use positive numbers for debits/invoices/expenses
- Use negative numbers for credits/payments
- If optional fields are not shown, omit them or use null
- Ensure dates are in YYYY-MM-DD format

Return ONLY valid JSON array, nothing else. Example:
[
  {
    "date": "2024-01-15",
    "description": "Office Supplies - Staples Inc.",
    "amount": 450.25,
    "account": "5200",
    "reference": "INV-12345",
    "vendor": "Staples Inc."
  },
  {
    "date": "2024-01-18",
    "description": "Payment to ABC Company",
    "amount": -1200.00,
    "account": "2000",
    "reference": "CHK-9876",
    "vendor": "ABC Company"
  }
]`;

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
          content: 'You are a financial data extraction expert. Return only valid JSON arrays.'
        },
        {
          role: 'user',
          content: `${prompt}\n\nAP Ledger Content:\n${fileContent}`
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
  const content = data.choices[0]?.message?.content || '[]';
  
  console.log('📄 Raw AI response:', content);
  
  // Parse the JSON response
  let entries = [];
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1].trim();
    entries = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    entries = JSON.parse(content);
  }

  console.log(`✅ Extracted ${entries.length} AP ledger entries`);
  return entries;
}

// Run AP Reconciliation - Match vendor statements with AP ledger
app.post('/run-ap-reconciliation', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period } = body;

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log(`🔄 Running AP reconciliation for company ${companyId}, period ${period}`);

    // Load vendor statement transactions
    const vendorKey = `ap-rec:${companyId}:${period}:vendor-statements`;
    const vendorData = await kv.get(vendorKey);

    if (!vendorData || !vendorData.transactions || vendorData.transactions.length === 0) {
      return c.json({ error: 'No vendor statement transactions found. Please upload vendor statements first.' }, 400);
    }

    // Load AP ledger entries
    const apKey = `ap-rec:${companyId}:${period}:ap-ledger`;
    const apData = await kv.get(apKey);

    if (!apData || !apData.entries || apData.entries.length === 0) {
      return c.json({ error: 'No AP ledger entries found. Please upload AP ledger first.' }, 400);
    }

    const vendorTransactions = vendorData.transactions;
    const apEntries = apData.entries;

    console.log(`📊 Reconciling ${vendorTransactions.length} vendor transactions with ${apEntries.length} AP ledger entries`);

    /* ==========================================
     * NOVALARE AP RECONCILIATION MATCHING ENGINE
     * ==========================================
     * 
     * MATCHING FUNNEL (4 STAGES):
     * 
     * 1️⃣ DETERMINISTIC EXACT MATCH (Confidence: 100%)
     *    - 1 Vendor Txn ↔ 1 AP Entry
     *    - Same date (±3 days) AND same amount (±€1)
     *    - Fast, cheap, highly accurate
     * 
     * 2️⃣ DETERMINISTIC ONE-TO-MANY MATCH (Confidence: 93-95%)
     *    - 1 Vendor Txn ↔ 2-3 AP Entries (sum matches)
     *    - Same date (±3 days) AND sum of amounts match (±€1)
     *    - Example: €1,073.01 vendor → [€500, €300, €273.01] AP
     * 
     * 3️⃣ AI FUZZY MATCH (Confidence: 60-85%)
     *    - Uses GPT-4o to analyze description, amount, date similarity
     *    - Catches edge cases, invoice number mismatches, description variations
     * 
     * KEY PRINCIPLES:
     * - Process in order: cheap → expensive, certain → uncertain
     * - Mark used IDs to prevent double-matching
     * - Amounts use absolute value comparison
     * - Date matching handles multiple formats
     */

    const matchedPairs: any[] = [];
    const unmatchedVendor: any[] = [];
    const unmatchedAP: any[] = [];

    const usedVendorIds = new Set<string>();
    const usedAPIds = new Set<string>();

    console.log('🔍 Step 1: Finding exact matches...');

    // Helper: Check if dates are within N days
    const datesMatch = (date1: string, date2: string, daysThreshold = 3): boolean => {
      try {
        const parseDate = (dateStr: string): Date | null => {
          if (!dateStr) return null;
          let d = new Date(dateStr);
          if (!isNaN(d.getTime())) return d;
          return null;
        };

        const d1 = parseDate(date1);
        const d2 = parseDate(date2);

        if (!d1 || !d2) return false;

        const diffMs = Math.abs(d1.getTime() - d2.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        return diffDays <= daysThreshold;
      } catch (e) {
        return false;
      }
    };

    // Helper: Check if amounts match (within tolerance)
    const amountsMatch = (amt1: number, amt2: number, tolerance = 1): boolean => {
      return Math.abs(Math.abs(amt1) - Math.abs(amt2)) <= tolerance;
    };

    // Helper: Normalize vendor name for fuzzy matching
    const normalizeVendorName = (name: string): string => {
      if (!name) return '';
      return name
        .toLowerCase()
        .trim()
        // Remove common suffixes
        .replace(/\s+(gmbh|co\.|co|ltd\.|ltd|inc\.|inc|ag|kg|ohg|gbr|ug|sa|srl|llc|corp|corporation)$/i, '')
        // Remove dots and special chars
        .replace(/[.,\-()]/g, '')
        // Normalize unicode (e.g., ä -> a, ö -> o)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Helper: Check if vendor names match (fuzzy)
    const vendorNamesMatch = (name1: string, name2: string): boolean => {
      if (!name1 || !name2) return false;
      
      const n1 = normalizeVendorName(name1);
      const n2 = normalizeVendorName(name2);
      
      // Exact match after normalization
      if (n1 === n2) return true;
      
      // One contains the other (handles "AlphaSupply" vs "AlphaSupply Co")
      if (n1.includes(n2) || n2.includes(n1)) return true;
      
      // Check if key words match (split by space, match 2+ words)
      const words1 = n1.split(' ').filter(w => w.length > 2);
      const words2 = n2.split(' ').filter(w => w.length > 2);
      
      if (words1.length >= 2 && words2.length >= 2) {
        const matchingWords = words1.filter(w1 => words2.some(w2 => w1 === w2));
        if (matchingWords.length >= 2) return true;
      }
      
      return false;
    };

    // Step 1: Exact 1-to-1 matches
    let exactMatchCount = 0;
    
    // First pass: Try matching with vendor name validation (highest confidence)
    for (const vendor of vendorTransactions) {
      if (usedVendorIds.has(vendor.id)) continue;

      for (const ap of apEntries) {
        if (usedAPIds.has(ap.id)) continue;

        const vendorName = vendor.description || vendor.vendor || '';
        const apVendorName = ap.vendor || ap.description || '';
        
        if (datesMatch(vendor.date, ap.date, 5) && 
            amountsMatch(vendor.amount, ap.amount) &&
            vendorNamesMatch(vendorName, apVendorName)) {
          matchedPairs.push({
            vendor_transaction: vendor,
            ap_entries: [ap],
            match_confidence: 100,
            match_type: 'exact_match',
            explanation: 'Exact match on date, amount, and vendor name'
          });

          usedVendorIds.add(vendor.id);
          usedAPIds.add(ap.id);
          exactMatchCount++;
          break;
        }
      }
    }

    // Second pass: Match on date + amount only (vendor name not required)
    for (const vendor of vendorTransactions) {
      if (usedVendorIds.has(vendor.id)) continue;

      for (const ap of apEntries) {
        if (usedAPIds.has(ap.id)) continue;

        if (datesMatch(vendor.date, ap.date, 5) && 
            amountsMatch(vendor.amount, ap.amount)) {
          matchedPairs.push({
            vendor_transaction: vendor,
            ap_entries: [ap],
            match_confidence: 95,
            match_type: 'exact_match',
            explanation: 'Exact match on date and amount'
          });

          usedVendorIds.add(vendor.id);
          usedAPIds.add(ap.id);
          exactMatchCount++;
          break;
        }
      }
    }

    console.log(`✅ Found ${exactMatchCount} exact matches`);

    // Step 2: One-to-many matches (1 vendor transaction → multiple AP entries)
    console.log('🔍 Step 2: Finding one-to-many matches...');
    let oneToManyCount = 0;

    // First pass: Try matching with vendor name validation (highest confidence)
    for (const vendor of vendorTransactions) {
      if (usedVendorIds.has(vendor.id)) continue;

      const unusedAP = apEntries.filter(ap => !usedAPIds.has(ap.id));
      const vendorName = vendor.description || vendor.vendor || '';

      // Try combinations of 2-3 AP entries
      for (let combo of getCombinations(unusedAP, 2, 3)) {
        const sumAP = combo.reduce((sum, ap) => sum + Math.abs(ap.amount), 0);

        const allVendorNamesMatch = combo.every(ap => {
          const apVendorName = ap.vendor || ap.description || '';
          return vendorNamesMatch(vendorName, apVendorName);
        });

        if (amountsMatch(Math.abs(vendor.amount), sumAP) &&
            combo.every(ap => datesMatch(vendor.date, ap.date, 5)) &&
            allVendorNamesMatch) {
          matchedPairs.push({
            vendor_transaction: vendor,
            ap_entries: combo,
            match_confidence: 93,
            match_type: 'one_to_many',
            explanation: `1 vendor transaction matched to ${combo.length} AP entries with matching vendor name`
          });

          usedVendorIds.add(vendor.id);
          combo.forEach(ap => usedAPIds.add(ap.id));
          oneToManyCount++;
          break;
        }
      }
    }

    // Second pass: Match on date + amount only (vendor name not required)
    for (const vendor of vendorTransactions) {
      if (usedVendorIds.has(vendor.id)) continue;

      const unusedAP = apEntries.filter(ap => !usedAPIds.has(ap.id));

      // Try combinations of 2-3 AP entries
      for (let combo of getCombinations(unusedAP, 2, 3)) {
        const sumAP = combo.reduce((sum, ap) => sum + Math.abs(ap.amount), 0);

        if (amountsMatch(Math.abs(vendor.amount), sumAP) &&
            combo.every(ap => datesMatch(vendor.date, ap.date, 5))) {
          matchedPairs.push({
            vendor_transaction: vendor,
            ap_entries: combo,
            match_confidence: 88,
            match_type: 'one_to_many',
            explanation: `1 vendor transaction matched to ${combo.length} AP entries (date + amount match)`
          });

          usedVendorIds.add(vendor.id);
          combo.forEach(ap => usedAPIds.add(ap.id));
          oneToManyCount++;
          break;
        }
      }
    }

    console.log(`✅ Found ${oneToManyCount} one-to-many matches`);

    // Step 3: AI Fuzzy Matching for remaining items
    console.log('🔍 Step 3: Running AI fuzzy matching...');

    const remainingVendor = vendorTransactions.filter(v => !usedVendorIds.has(v.id));
    const remainingAP = apEntries.filter(ap => !usedAPIds.has(ap.id));

    console.log(`🤖 AI Fuzzy: ${remainingVendor.length} vendor, ${remainingAP.length} AP entries remaining`);

    if (remainingVendor.length > 0 && remainingAP.length > 0) {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

      if (openaiApiKey) {
        // Limit AI processing to prevent huge costs
        const MAX_AI_ITEMS = 50;
        const limitedVendor = remainingVendor.slice(0, MAX_AI_ITEMS);
        const limitedAP = remainingAP.slice(0, MAX_AI_ITEMS);

        const prompt = `You are an expert AP reconciliation assistant. Match vendor statement transactions with AP ledger entries.

VENDOR STATEMENT TRANSACTIONS (${limitedVendor.length}):
${JSON.stringify(limitedVendor, null, 2)}

AP LEDGER ENTRIES (${limitedAP.length}):
${JSON.stringify(limitedAP, null, 2)}

MATCHING CRITERIA:
- Date proximity (within ±5 days is good)
- Amount similarity (exact or very close)
- Description/vendor similarity (fuzzy matching)
- Invoice number matching (if available)

Return a JSON object with:
{
  "matches": [
    {
      "vendor_id": "vendor transaction id",
      "ap_ids": ["ap entry id(s)"],
      "confidence": 60-85,
      "explanation": "Brief explanation"
    }
  ]
}

IMPORTANT:
- Only suggest matches with confidence ≥ 60%
- You can match 1 vendor to 1 or more AP entries (if amounts sum correctly)
- Focus on high-confidence matches
- Return ONLY valid JSON`;

        try {
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
                  content: 'You are a senior accountant with AP reconciliation expertise. Return only valid JSON.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.1,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices[0]?.message?.content || '{"matches":[]}';

            let aiResult;
            try {
              const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
              const jsonStr = jsonMatch[1].trim();
              aiResult = JSON.parse(jsonStr);
            } catch (e) {
              aiResult = JSON.parse(content);
            }

            // Process AI matches
            for (const match of aiResult.matches || []) {
              const vendor = remainingVendor.find(v => v.id === match.vendor_id);
              const aps = match.ap_ids.map((id: string) => remainingAP.find(ap => ap.id === id)).filter(Boolean);

              if (vendor && aps.length > 0) {
                matchedPairs.push({
                  vendor_transaction: vendor,
                  ap_entries: aps,
                  match_confidence: match.confidence || 70,
                  match_type: aps.length > 1 ? 'ai_fuzzy_multi' : 'ai_fuzzy',
                  explanation: match.explanation
                });

                usedVendorIds.add(vendor.id);
                aps.forEach(ap => usedAPIds.add(ap.id));
              }
            }

            console.log(`✅ AI found ${aiResult.matches?.length || 0} fuzzy matches`);
          }
        } catch (error) {
          console.error('❌ AI fuzzy matching error:', error);
        }
      }
    }

    // Step 4: Collect unmatched items
    for (const vendor of vendorTransactions) {
      if (!usedVendorIds.has(vendor.id)) {
        unmatchedVendor.push({
          transaction: vendor,
          suggested_action: 'Review: This vendor transaction is not in the AP ledger',
          suggested_je: {
            description: `Record vendor invoice: ${vendor.description}`,
            debit_account: '5000 - Expenses',
            credit_account: '2000 - Accounts Payable',
            amount: Math.abs(vendor.amount)
          }
        });
      }
    }

    for (const ap of apEntries) {
      if (!usedAPIds.has(ap.id)) {
        unmatchedAP.push({
          entry: ap,
          reason: 'Not found in vendor statements',
          action: 'Review: This AP entry has no matching vendor transaction'
        });
      }
    }

    // Calculate summary
    const totalVendorAmount = vendorTransactions.reduce((sum, v) => sum + Math.abs(v.amount), 0);
    const totalAPAmount = apEntries.reduce((sum, ap) => sum + Math.abs(ap.amount), 0);
    const difference = totalVendorAmount - totalAPAmount;
    const matchRate = (matchedPairs.length / Math.max(vendorTransactions.length, apEntries.length)) * 100;

    const reconciliation = {
      matched_pairs: matchedPairs,
      unmatched_vendor: unmatchedVendor,
      unmatched_ap: unmatchedAP,
      summary: {
        total_vendor_transactions: vendorTransactions.length,
        total_ap_entries: apEntries.length,
        matched_count: matchedPairs.length,
        unmatched_vendor_count: unmatchedVendor.length,
        unmatched_ap_count: unmatchedAP.length,
        total_vendor_amount: totalVendorAmount,
        total_ap_amount: totalAPAmount,
        difference: difference,
        match_rate: matchRate
      }
    };

    // Save reconciliation result
    const recKey = `ap-rec:${companyId}:${period}:reconciliation`;
    await kv.set(recKey, { reconciliation });

    console.log(`✅ AP Reconciliation complete: ${matchedPairs.length} matched, ${unmatchedVendor.length} unmatched vendor, ${unmatchedAP.length} unmatched AP`);

    return c.json({ success: true, reconciliation });

  } catch (error) {
    console.error('❌ Error running AP reconciliation:', error);
    return c.json({ error: 'Failed to run AP reconciliation' }, 500);
  }
});

// Helper function to get combinations of array items
function* getCombinations(arr: any[], minSize: number, maxSize: number) {
  function* combine(start: number, combo: any[]) {
    if (combo.length >= minSize && combo.length <= maxSize) {
      yield combo;
    }
    if (combo.length >= maxSize) return;

    for (let i = start; i < arr.length; i++) {
      yield* combine(i + 1, [...combo, arr[i]]);
    }
  }

  yield* combine(0, []);
}

// Get AP Reconciliation - Load saved reconciliation results
app.get('/ap-reconciliation', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log(`📂 Loading AP reconciliation for company ${companyId}, period ${period}`);

    // Load reconciliation result
    const recKey = `ap-rec:${companyId}:${period}:reconciliation`;
    const data = await kv.get(recKey);

    if (!data || !data.reconciliation) {
      console.log('ℹ️ No reconciliation found');
      return c.json({ reconciliation: null });
    }

    console.log(`✅ Found reconciliation with ${data.reconciliation.matched_pairs?.length || 0} matches`);
    return c.json({ reconciliation: data.reconciliation });

  } catch (error) {
    console.error('❌ Error loading AP reconciliation:', error);
    return c.json({ error: 'Failed to load AP reconciliation' }, 500);
  }
});

// Get AP Reconciliation - Alternative route path for Month-End Close
app.get('/ap-rec/reconciliation', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log(`📂 Loading AP reconciliation for company ${companyId}, period ${period}`);

    // Load reconciliation result
    const recKey = `ap-rec:${companyId}:${period}:reconciliation`;
    const data = await kv.get(recKey);

    if (!data || !data.reconciliation) {
      console.log('ℹ️ No reconciliation found');
      // Return empty structure for Month-End Close compatibility
      return c.json({ 
        matches: [],
        unmatchedVendor: [],
        unmatchedAP: [],
        locked: false
      });
    }

    // Transform the data structure for Month-End Close compatibility
    const rec = data.reconciliation;
    console.log(`✅ Found reconciliation with ${rec.matched_pairs?.length || 0} matches`);
    
    // Load resolved items from separate key
    const resolvedKey = `ap-rec:${companyId}:${period}:resolved`;
    const resolvedData = await kv.get(resolvedKey);
    const resolvedItems = resolvedData?.items || [];
    console.log(`📋 Loaded ${resolvedItems.length} resolved items`);
    
    // Load follow-up items from separate key
    const followUpKey = `ap-rec:${companyId}:${period}:follow-up`;
    const followUpData = await kv.get(followUpKey);
    const followUpItems = followUpData?.items || [];
    
    return c.json({
      matches: rec.matched_pairs || [],
      unmatchedVendor: rec.unmatched_vendor || [],
      unmatchedAP: rec.unmatched_ap || [],
      locked: rec.locked || false,
      summary: rec.summary || {},
      resolved_items: resolvedItems,
      follow_up_items: followUpItems
    });

  } catch (error) {
    console.error('❌ Error loading AP reconciliation:', error);
    return c.json({ error: 'Failed to load AP reconciliation' }, 500);
  }
});

// Lock (save) an AP reconciliation
app.post('/ap-rec/lock-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();
    
    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `ap-rec:${company_id}:${period}:reconciliation`;
    const data = await kv.get(key);
    
    if (!data || !data.reconciliation) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Add locked status and timestamp
    data.reconciliation.locked = true;
    data.reconciliation.lockedAt = new Date().toISOString();
    
    await kv.set(key, data);
    
    console.log(`🔒 Locked AP reconciliation for ${company_id} - ${period}`);
    
    return c.json({ success: true, reconciliation: data.reconciliation });
  } catch (error) {
    console.error('❌ Error locking AP reconciliation:', error);
    return c.json({ error: `Failed to lock reconciliation: ${error.message}` }, 500);
  }
});

// Unlock an AP reconciliation to allow updates
app.post('/ap-rec/unlock-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();
    
    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `ap-rec:${company_id}:${period}:reconciliation`;
    const data = await kv.get(key);
    
    if (!data || !data.reconciliation) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Remove locked status
    data.reconciliation.locked = false;
    data.reconciliation.unlockedAt = new Date().toISOString();
    
    await kv.set(key, data);
    
    console.log(`🔓 Unlocked AP reconciliation for ${company_id} - ${period}`);
    
    return c.json({ success: true, reconciliation: data.reconciliation });
  } catch (error) {
    console.error('❌ Error unlocking AP reconciliation:', error);
    return c.json({ error: `Failed to unlock reconciliation: ${error.message}` }, 500);
  }
});

// Match vendor transactions with AP entries (supports many-to-many)
app.post('/ap-rec/match-items', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, vendorItems, apItems } = body;
    
    if (!companyId || !period || !vendorItems || !apItems || vendorItems.length === 0 || apItems.length === 0) {
      return c.json({ error: 'companyId, period, vendorItems, and apItems are required' }, 400);
    }

    console.log(`🔗 Matching ${vendorItems.length} vendor transaction(s) with ${apItems.length} AP entry(ies):`, companyId, period);

    // Get current reconciliation data
    const recKey = `ap-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Calculate totals for match group
    const vendorTotal = vendorItems.reduce((sum: number, item: any) => sum + item.transaction.amount, 0);
    const apTotal = apItems.reduce((sum: number, item: any) => sum + item.entry.amount, 0);
    const matchDifference = Math.abs(vendorTotal - apTotal);
    
    console.log(`💰 Vendor Total: €${vendorTotal.toFixed(2)}, AP Total: €${apTotal.toFixed(2)}, Diff: €${matchDifference.toFixed(2)}`);

    // Remove all matched vendor items from unmatched_vendor
    if (reconciliationData.reconciliation?.unmatched_vendor) {
      reconciliationData.reconciliation.unmatched_vendor = reconciliationData.reconciliation.unmatched_vendor.filter((unmatchedItem: any) => {
        const txn = unmatchedItem.transaction;
        return !vendorItems.some((vendorItem: any) => {
          const itemTxn = vendorItem.transaction;
          return (
            txn.date === itemTxn.date &&
            txn.description === itemTxn.description &&
            txn.amount === itemTxn.amount
          );
        });
      });
    }

    // Remove all matched AP items from unmatched_ap
    if (reconciliationData.reconciliation?.unmatched_ap) {
      reconciliationData.reconciliation.unmatched_ap = reconciliationData.reconciliation.unmatched_ap.filter((unmatchedItem: any) => {
        const entry = unmatchedItem.entry;
        return !apItems.some((apItem: any) => {
          const itemEntry = apItem.entry;
          return (
            entry.date === itemEntry.date &&
            entry.description === itemEntry.description &&
            entry.amount === itemEntry.amount
          );
        });
      });
    }

    // Update summary counts
    if (reconciliationData.reconciliation?.summary) {
      reconciliationData.reconciliation.summary.unmatched_vendor_count = reconciliationData.reconciliation.unmatched_vendor?.length || 0;
      reconciliationData.reconciliation.summary.unmatched_ap_count = reconciliationData.reconciliation.unmatched_ap?.length || 0;
      reconciliationData.reconciliation.summary.matched_count = (reconciliationData.reconciliation.summary.matched_count || 0) + 1;
    }
    
    await kv.set(recKey, reconciliationData);

    // Add to resolved bucket
    const resolvedKey = `ap-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    // Create match group ID
    const matchGroupId = Date.now().toString();
    
    // Add all vendor items to resolved
    vendorItems.forEach((vendorItem: any) => {
      existingResolved.items.push({
        type: 'vendor',
        item: vendorItem,
        markedAt: new Date().toISOString(),
        status: 'matched',
        matchGroupId,
        resolution: `Matched ${vendorItems.length} vendor transaction(s) with ${apItems.length} AP entry(ies). Vendor total: €${Math.abs(vendorTotal).toFixed(2)}, AP total: €${Math.abs(apTotal).toFixed(2)}`
      });
    });
    
    // Add all AP items to resolved
    apItems.forEach((apItem: any) => {
      existingResolved.items.push({
        type: 'ap',
        item: apItem,
        markedAt: new Date().toISOString(),
        status: 'matched',
        matchGroupId,
        resolution: `Matched ${apItems.length} AP entry(ies) with ${vendorItems.length} vendor transaction(s). Vendor total: €${Math.abs(vendorTotal).toFixed(2)}, AP total: €${Math.abs(apTotal).toFixed(2)}`
      });
    });
    
    await kv.set(resolvedKey, existingResolved);

    console.log('✅ Items matched successfully (Match Group ID:', matchGroupId, ')');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error matching items:', error);
    return c.json({ error: 'Failed to match items' }, 500);
  }
});

// Mark as timing difference
app.post('/ap-rec/mark-timing-difference', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item } = body;

    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`⏰ Marking ${type} item as timing difference for company ${companyId}, period ${period}`);

    const recKey = `ap-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);

    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Remove item from unmatched list
    if (type === 'vendor') {
      const itemId = item.transaction.id;
      if (reconciliationData.reconciliation?.unmatched_vendor) {
        reconciliationData.reconciliation.unmatched_vendor = reconciliationData.reconciliation.unmatched_vendor.filter(
          (unmatchedItem: any) => unmatchedItem.transaction.id !== itemId
        );
      }
      // Update summary
      if (reconciliationData.reconciliation?.summary) {
        reconciliationData.reconciliation.summary.unmatched_vendor_count = reconciliationData.reconciliation.unmatched_vendor?.length || 0;
      }
    } else if (type === 'ap') {
      const itemId = item.entry.id;
      if (reconciliationData.reconciliation?.unmatched_ap) {
        reconciliationData.reconciliation.unmatched_ap = reconciliationData.reconciliation.unmatched_ap.filter(
          (unmatchedItem: any) => unmatchedItem.entry.id !== itemId
        );
      }
      // Update summary
      if (reconciliationData.reconciliation?.summary) {
        reconciliationData.reconciliation.summary.unmatched_ap_count = reconciliationData.reconciliation.unmatched_ap?.length || 0;
      }
    }

    await kv.set(recKey, reconciliationData);

    // Add to resolved bucket
    const resolvedKey = `ap-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    const matchGroupId = `timing-${Date.now()}`;
    
    existingResolved.items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'timing_difference',
      matchGroupId,
      resolution: 'Will clear next period'
    });
    
    await kv.set(resolvedKey, existingResolved);

    console.log('✅ Item marked as timing difference');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking as timing difference:', error);
    return c.json({ error: 'Failed to mark as timing difference' }, 500);
  }
});

// Mark as ignored/non-issue
app.post('/ap-rec/mark-ignored', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item } = body;

    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`🙈 Marking ${type} item as ignored for company ${companyId}, period ${period}`);

    const recKey = `ap-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);

    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Remove item from unmatched list
    if (type === 'vendor') {
      const itemId = item.transaction.id;
      if (reconciliationData.reconciliation?.unmatched_vendor) {
        reconciliationData.reconciliation.unmatched_vendor = reconciliationData.reconciliation.unmatched_vendor.filter(
          (unmatchedItem: any) => unmatchedItem.transaction.id !== itemId
        );
      }
      // Update summary
      if (reconciliationData.reconciliation?.summary) {
        reconciliationData.reconciliation.summary.unmatched_vendor_count = reconciliationData.reconciliation.unmatched_vendor?.length || 0;
      }
    } else if (type === 'ap') {
      const itemId = item.entry.id;
      if (reconciliationData.reconciliation?.unmatched_ap) {
        reconciliationData.reconciliation.unmatched_ap = reconciliationData.reconciliation.unmatched_ap.filter(
          (unmatchedItem: any) => unmatchedItem.entry.id !== itemId
        );
      }
      // Update summary
      if (reconciliationData.reconciliation?.summary) {
        reconciliationData.reconciliation.summary.unmatched_ap_count = reconciliationData.reconciliation.unmatched_ap?.length || 0;
      }
    }

    await kv.set(recKey, reconciliationData);

    // Add to resolved bucket
    const resolvedKey = `ap-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    const matchGroupId = `ignored-${Date.now()}`;
    
    existingResolved.items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'ignored',
      matchGroupId,
      resolution: 'Marked as non-issue'
    });
    
    await kv.set(resolvedKey, existingResolved);

    console.log('✅ Item marked as ignored');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking as ignored:', error);
    return c.json({ error: 'Failed to mark as ignored' }, 500);
  }
});

// Request information
app.post('/ap-rec/request-information', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item, note } = body;

    if (!companyId || !period || !type || !item || !note) {
      return c.json({ error: 'companyId, period, type, item, and note are required' }, 400);
    }

    console.log(`📝 Requesting information for ${type} item for company ${companyId}, period ${period}`);

    const recKey = `ap-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);

    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Remove item from unmatched list
    if (type === 'vendor') {
      const itemId = item.transaction.id;
      if (reconciliationData.reconciliation?.unmatched_vendor) {
        reconciliationData.reconciliation.unmatched_vendor = reconciliationData.reconciliation.unmatched_vendor.filter(
          (unmatchedItem: any) => unmatchedItem.transaction.id !== itemId
        );
      }
      // Update summary
      if (reconciliationData.reconciliation?.summary) {
        reconciliationData.reconciliation.summary.unmatched_vendor_count = reconciliationData.reconciliation.unmatched_vendor?.length || 0;
      }
    } else if (type === 'ap') {
      const itemId = item.entry.id;
      if (reconciliationData.reconciliation?.unmatched_ap) {
        reconciliationData.reconciliation.unmatched_ap = reconciliationData.reconciliation.unmatched_ap.filter(
          (unmatchedItem: any) => unmatchedItem.entry.id !== itemId
        );
      }
      // Update summary
      if (reconciliationData.reconciliation?.summary) {
        reconciliationData.reconciliation.summary.unmatched_ap_count = reconciliationData.reconciliation.unmatched_ap?.length || 0;
      }
    }

    await kv.set(recKey, reconciliationData);

    // Add to follow-up bucket
    const followUpKey = `ap-rec:${companyId}:${period}:follow-up`;
    const existingFollowUp = await kv.get(followUpKey) || { items: [] };
    
    existingFollowUp.items.push({
      type,
      item,
      note,
      markedAt: new Date().toISOString()
    });
    
    await kv.set(followUpKey, existingFollowUp);

    console.log('✅ Item flagged for follow-up');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error requesting information:', error);
    return c.json({ error: 'Failed to request information' }, 500);
  }
});

export default app;