import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-53c2e113');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================
// AR RECONCILIATION ROUTES
// ============================================

// Helper function to extract transactions from customer statement using AI
async function extractCustomerStatementTransactions(fileContent: string, fileName: string) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  console.log('🤖 Calling OpenAI to extract customer statement transactions...');

  const prompt = `You are an AI assistant specialized in extracting transaction data from customer account statements.

Extract ALL transactions from this customer statement and return them as a JSON array.

For each transaction, extract:
- date: Transaction date in YYYY-MM-DD format
- description: Transaction description or memo
- amount: Transaction amount (positive for invoices/charges, negative for payments/credits)
- balance: Running balance if available (optional)
- invoice_number: Invoice or reference number if available (optional)
- type: "invoice" or "payment" or "credit" or "debit" (classify based on context)

IMPORTANT:
- Extract ALL transactions, no matter how many
- Amounts should be numbers (not strings)
- Use positive numbers for charges/invoices
- Use negative numbers for payments/credits
- If balance is not shown, omit it or use null
- Ensure dates are in YYYY-MM-DD format

Return ONLY valid JSON array, nothing else. Example:
[
  {
    "date": "2024-01-15",
    "description": "Invoice #12345 - Service Fee",
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
          content: `${prompt}\\n\\nCustomer Statement Content:\\n${fileContent}`
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
    const jsonMatch = content.match(/```(?:json)?\\s*([\\s\\S]*?)```/) || [null, content];
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
        text += `\\nSheet: ${sheetName}\\n`;
        text += XLSX.utils.sheet_to_csv(sheet);
        text += '\\n';
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
        fullText += pageText + '\\n';
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
  return fileName
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/[^\\w\\s.-]/g, '_')
    .replace(/\\s+/g, '_')
    .replace(/_+/g, '_');
}

// Upload customer statement
app.post('/upload-customer-statement', async (c) => {
  try {
    console.log('📤 Uploading customer statement...');
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const period = formData.get('period') as string;
    
    if (!file || !companyId || !period) {
      return c.json({ error: 'file, companyId, and period are required' }, 400);
    }

    console.log(`📄 Processing customer statement: ${file.name} for company ${companyId}, period ${period}`);

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
      transactions = await extractCustomerStatementTransactions(fileContent, file.name);
      console.log(`✅ Transactions extracted successfully: ${transactions.length} transactions`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error extracting transactions:', errMsg, e);
      throw new Error(`Failed to extract transactions: ${errMsg}`);
    }
    
    // Upload file to Supabase Storage
    const bucketName = 'make-53c2e113-ar-statements';
    
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
    
    // Get the existing customer statements data
    const key = `ar-rec:${companyId}:${period}:customer-statements`;
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
      console.log(`✅ Saved ${transactions.length} transactions from customer statement`);
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
    console.error('❌ Error uploading customer statement:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const errMsg = error instanceof Error ? error.message : String(error);
    return c.json({ 
      error: 'Failed to upload customer statement',
      details: errMsg || 'Unknown error occurred'
    }, 500);
  }
});

// Get customer statements and transactions
app.get('/customer-statements', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const key = `ar-rec:${companyId}:${period}:customer-statements`;
    const data = await kv.get(key);
    
    return c.json({
      statements: data?.statements || [],
      transactions: data?.transactions || []
    });
  } catch (error) {
    console.error('❌ Error fetching customer statements:', error);
    return c.json({ error: 'Failed to fetch customer statements' }, 500);
  }
});

// Helper function to extract AR ledger entries using AI
async function extractARLedgerEntries(fileContent: string, fileName: string) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  console.log('🤖 Calling OpenAI to extract AR ledger entries...');

  const prompt = `You are an AI assistant specialized in extracting data from AR (Accounts Receivable) ledgers.

Extract ALL entries from this AR ledger and return them as a JSON array.

For each entry, extract:
- date: Entry date in YYYY-MM-DD format
- description: Entry description or memo
- amount: Entry amount (positive for debits/invoices, negative for credits/payments)
- account: Account code or name if available (optional)
- reference: Reference number, invoice number, or document number if available (optional)
- customer: Customer name if available (optional)

IMPORTANT:
- Extract ALL entries, no matter how many
- Amounts should be numbers (not strings)
- Use positive numbers for debits/invoices/revenues
- Use negative numbers for credits/payments
- If optional fields are not shown, omit them or use null
- Ensure dates are in YYYY-MM-DD format

Return ONLY valid JSON array, nothing else. Example:
[
  {
    "date": "2024-01-15",
    "description": "Invoice #12345 - Consulting Services",
    "amount": 2450.25,
    "account": "4000",
    "reference": "INV-12345",
    "customer": "ABC Company"
  },
  {
    "date": "2024-01-18",
    "description": "Payment from XYZ Corp",
    "amount": -1200.00,
    "account": "1000",
    "reference": "PMT-9876",
    "customer": "XYZ Corp"
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
          content: `${prompt}\\n\\nAR Ledger Content:\\n${fileContent}`
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
    const jsonMatch = content.match(/```(?:json)?\\s*([\\s\\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1].trim();
    entries = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    entries = JSON.parse(content);
  }

  console.log(`✅ Extracted ${entries.length} AR ledger entries`);
  return entries;
}

// Upload AR ledger
app.post('/upload-ar-ledger', async (c) => {
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
    
    // Extract AR entries using AI
    let entries: any[];
    try {
      console.log('🤖 Extracting AR ledger entries with AI...');
      entries = await extractARLedgerEntries(fileContent, file.name);
      console.log(`✅ AR entries extracted successfully: ${entries.length} entries`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ Error extracting AR entries:', errMsg, e);
      throw new Error(`Failed to extract AR entries: ${errMsg}`);
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
    const key = `ar-rec:${companyId}:${period}:ar-ledger`;
    const data = {
      ledger,
      entries: entriesWithIds,
    };
    
    try {
      console.log('💾 Saving AR ledger to KV store...');
      await kv.set(key, data);
      console.log(`✅ Saved ${entries.length} entries from AR ledger`);
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
    console.error('❌ Error uploading AR ledger:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const errMsg = error instanceof Error ? error.message : String(error);
    return c.json({ 
      error: 'Failed to upload AR ledger',
      details: errMsg || 'Unknown error occurred'
    }, 500);
  }
});

// Get AR ledger data
app.get('/ar-ledger', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const key = `ar-rec:${companyId}:${period}:ar-ledger`;
    const data = await kv.get(key);
    
    return c.json({
      ledger: data?.ledger || null,
      entries: data?.entries || []
    });
  } catch (error) {
    console.error('❌ Error fetching AR ledger:', error);
    return c.json({ error: 'Failed to fetch AR ledger' }, 500);
  }
});

export default app;
