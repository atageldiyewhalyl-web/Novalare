import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as XLSX from "npm:xlsx";
import * as kv from "./kv_store.tsx";
import routes from "./routes.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// Mount API routes for DevPortal
app.route('/make-server-53c2e113', routes);

// Health check endpoint
app.get("/make-server-53c2e113/health", (c) => {
  return c.json({ status: "ok" });
});

// Warm-up endpoint - call this periodically to keep function warm and reduce cold start latency
app.get("/make-server-53c2e113/warm", async (c) => {
  const startTime = Date.now();
  
  // Pre-load commonly used modules to warm the cache
  try {
    // Warm up pdf-parse (expensive first load)
    await import('npm:pdf-parse@1.1.1');
    
    const warmTime = Date.now() - startTime;
    return c.json({ 
      status: "warm", 
      warmTime: `${warmTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({ 
      status: "warm", 
      warning: "Module preload failed but function is warm",
      timestamp: new Date().toISOString()
    });
  }
});

// 10-K Analysis endpoint
app.post("/make-server-53c2e113/analyze-10k", async (c) => {
  try {
    console.log('🚀 Starting 10-K analysis endpoint...');
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ No file provided');
      return c.json({ error: 'No file provided' }, 400);
    }

    console.log('📄 Processing 10-K file:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Save PDF to temp file (required for parsing)
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const tempPath = `/tmp/upload-${Date.now()}.pdf`;
    
    console.log('💾 Saving PDF to temp location:', tempPath);
    await Deno.writeFile(tempPath, bytes);
    
    console.log('📖 Extracting text from PDF...');
    
    // Extract text using pdf-parse (works with file path in Deno)
    let extractedText = '';
    try {
      const pdfParse = (await import('npm:pdf-parse@1.1.1')).default;
      const dataBuffer = await Deno.readFile(tempPath);
      const data = await pdfParse(dataBuffer);
      
      extractedText = data.text;
      console.log('✅ Extracted', extractedText.length, 'characters from', data.numpages, 'pages');
      
      // Clean up temp file
      await Deno.remove(tempPath);
      
    } catch (parseError) {
      console.error('❌ PDF parsing error:', parseError);
      // Clean up temp file even on error
      try { await Deno.remove(tempPath); } catch {}
      return c.json({ 
        error: 'Failed to parse PDF file. Please ensure it is a valid, text-based PDF document (not a scanned image).',
        details: parseError.message 
      }, 500);
    }
    
    if (!extractedText.trim()) {
      return c.json({ 
        error: 'No text could be extracted from the PDF. The file may contain scanned images. Please upload a text-based PDF.' 
      }, 400);
    }
    
    console.log('🔍 Searching for financial statement sections...');
    
    // Search for BOTH income statement AND cash flow statement
    const incomeStatementKeywords = [
      'consolidated statements of operations',
      'consolidated statements of income',
      'consolidated income statement',
      'statements of operations',
      'income statement',
      'statement of earnings',
      'consolidated statements of earnings'
    ];
    
    const cashFlowKeywords = [
      'consolidated statements of cash flows',
      'consolidated statement of cash flows',
      'statements of cash flows',
      'cash flow statement',
      'statement of cash flows'
    ];
    
    let relevantSection = '';
    const lowerText = extractedText.toLowerCase();
    
    // Find BOTH income statement and cash flow statement sections
    let incomeIndex = -1;
    let cashFlowIndex = -1;
    
    for (const keyword of incomeStatementKeywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        console.log('✅ Found income statement:', keyword, 'at position', index);
        incomeIndex = index;
        break;
      }
    }
    
    for (const keyword of cashFlowKeywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        console.log('✅ Found cash flow statement:', keyword, 'at position', index);
        cashFlowIndex = index;
        break;
      }
    }
    
    // Extract text covering BOTH sections
    if (incomeIndex !== -1 && cashFlowIndex !== -1) {
      const startIndex = Math.min(incomeIndex, cashFlowIndex);
      const endIndex = Math.max(incomeIndex, cashFlowIndex);
      const start = Math.max(0, startIndex - 10000);
      const end = Math.min(extractedText.length, endIndex + 100000);
      relevantSection = extractedText.substring(start, end);
      console.log('✅ Extracted section covering both income and cash flow statements');
    } else if (incomeIndex !== -1) {
      // Just income statement found
      const start = Math.max(0, incomeIndex - 10000);
      const end = Math.min(extractedText.length, incomeIndex + 150000);
      relevantSection = extractedText.substring(start, end);
      console.log('⚠️ Only income statement found, may miss cash flow data');
    } else {
      // Fallback - use first portion
      console.log('⚠️ No specific financial sections found, using first portion');
      relevantSection = extractedText.substring(0, 80000);
    }
    
    // Final safety check - limit to ~100k chars (~25k tokens max)
    if (relevantSection.length > 100000) {
      console.log('⚠️ Section too long, truncating to 100k characters');
      relevantSection = relevantSection.substring(0, 100000);
    }
    
    console.log('📊 Using', relevantSection.length, 'characters for analysis');
    extractedText = relevantSection;

    // Check if API key is available
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      return c.json({ 
        error: 'OpenAI API key not configured. Please set the OPENAI_API_KEY secret in Supabase Dashboard: Project Settings > Edge Functions > Manage secrets',
        setup_url: 'https://supabase.com/dashboard/project/_/settings/functions'
      }, 500);
    }

    console.log('🔑 API Key found, length:', apiKey.length);
    console.log('🤖 Sending extracted text to OpenAI GPT-4o...');

    // Send extracted text to GPT-4o for analysis
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a financial analyst specialized in extracting data from 10-K filings. Extract financial metrics and return them as a JSON object. Return ONLY the JSON, no markdown formatting or explanation.

⚠️ ACCURACY IS CRITICAL - YOUR EXTRACTIONS MUST MATCH THE 10-K EXACTLY ⚠️

CRITICAL: You must search MULTIPLE sections of the 10-K to find all metrics:
1. Consolidated Statement of Operations (Income Statement)
2. Consolidated Balance Sheet (Statement of Financial Position) - **MOST ERROR-PRONE SECTION**
3. Consolidated Statement of Cash Flows - Operating Activities section
4. Footnotes and supplementary schedules

EXTRACTION STRATEGY:
- Income statement items: Get from Statement of Operations
- Balance sheet items: Get from Consolidated Balance Sheet or Statement of Financial Position
  **BALANCE SHEET IS THE HARDEST - READ THE ENTIRE SECTION CAREFULLY**
- Depreciation & Amortization: ALWAYS check Cash Flow Statement "Operating Activities"
- Stock-Based Compensation: Check Cash Flow Statement "Operating Activities" or footnotes

🗓️ MULTI-YEAR DATA EXTRACTION:
- 10-K filings contain 3 years of Income Statement data and 2 years of Balance Sheet data
- You MUST extract ALL available years and return them as arrays
- Array format: [oldest_year, middle_year, most_recent_year] - always 3 elements
- Balance Sheet fields: Extract 2 available years, pad oldest with 0 → [0, year2_value, year3_value]

Required fields:
- company_name: Name of the company (string)
- fiscal_years: Array of 3 fiscal years [oldest, middle, newest] - e.g., [2016, 2017, 2018]
- company_type: "technology" | "consumer" | "industrial" | "financial" | "other" (string)

Income Statement (extract 3 years of data):
- revenue: Total revenue/net sales/operating revenue (array of 3 numbers)
- cost_of_sales: COGS/Cost of revenue/Cost of products sold (array of 3 numbers)

Operating Expense Categories (extract 3 years):
- research_and_development: R&D expenses (array of 3 numbers, use 0 if not applicable)
- sales_and_marketing: Sales/Marketing/Advertising expenses if separate from SG&A (array of 3 numbers, use 0 if combined)
- selling_general_admin: SG&A/General & administrative (array of 3 numbers)
- other_operating_expenses: Any other operating expenses not categorized above (array of 3 numbers, use 0 if none)

Critical Non-GAAP Items (extract 3 years from Cash Flow Statement):
- depreciation_amortization: **REQUIRED** - ALWAYS check Cash Flow Statement Operating Activities for ALL 3 YEARS! (array of 3 numbers)
- stock_based_compensation: **REQUIRED** - Check Cash Flow Statement Operating Activities for ALL 3 YEARS (array of 3 numbers)

Other P&L Items (extract 3 years):
- interest_income: Interest/investment income (array of 3 numbers)
- interest_expense: Interest expense/debt interest (array of 3 numbers)
- other_income_expense: Other/miscellaneous income (array of 3 numbers, negative for expense)
- income_tax_expense: Income tax/provision for taxes (array of 3 numbers)

Balance Sheet - Assets (extract 2 years, pad oldest with 0):
- cash_and_equivalents: Cash + Short-term marketable securities + Long-term marketable securities. Array of 3: [0, year2_value, year3_value]
- accounts_receivable: "Accounts receivable" or "Trade accounts receivable, net". Array of 3: [0, year2_value, year3_value]
- inventories: "Inventories". Array of 3: [0, year2_value, year3_value]
- other_current_assets: The specific line item "Other current assets". Array of 3: [0, year2_value, year3_value]
- property_plant_equipment: "Property, plant and equipment, net". Array of 3: [0, year2_value, year3_value]
- other_noncurrent_assets: Goodwill + Intangible assets + Deferred tax assets + Other non-current assets. Array of 3: [0, year2_value, year3_value]

Balance Sheet - Liabilities (extract 2 years, pad with 0):
- accounts_payable: "Accounts payable". Array of 3: [0, year2_value, year3_value]
- other_current_liabilities: "Other current liabilities" or "Accrued liabilities". Array of 3: [0, year2_value, year3_value]
- deferred_revenue: "Deferred revenue" (current + non-current). Array of 3: [0, year2_value, year3_value]
- short_term_debt: "Commercial paper" + "Short-term debt" + "Current portion of long-term debt". Array of 3: [0, year2_value, year3_value]
- long_term_debt: "Long-term debt". Array of 3: [0, year2_value, year3_value]
- other_noncurrent_liabilities: Sum of other non-current liabilities. Array of 3: [0, year2_value, year3_value]

Balance Sheet - Equity (extract 2 years, pad with 0):
- common_stock: "Common stock" + "Additional paid-in capital". Array of 3: [0, year2_value, year3_value]
- retained_earnings: "Retained earnings" (can be negative). Array of 3: [0, year2_value, year3_value]
- other_equity: "Accumulated other comprehensive income (loss)" + treasury stock. Array of 3: [0, year2_value, year3_value]

All numbers in millions. Use positive numbers. Be thorough - check all sections before returning 0.`
          },
          {
            role: 'user',
            content: `Please analyze this 10-K filing and extract the financial data:\n\n${extractedText}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('❌ OpenAI API Error:', openAIResponse.status, errorText);
      return c.json({ error: 'Failed to process document with OpenAI', details: errorText }, 500);
    }

    const openAIData = await openAIResponse.json();
    const gptResponse = openAIData.choices?.[0]?.message?.content;
    
    if (!gptResponse) {
      return c.json({ error: 'OpenAI returned no content' }, 500);
    }

    // Parse the JSON response from GPT-4o
    let extractedData;
    try {
      const cleanText = gptResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanText);
    } catch (parseError) {
      return c.json({ error: 'Failed to parse extracted data', raw: gptResponse }, 500);
    }

    // Calculate derived metrics
    const getVal = (arr: number[], idx: number) => (arr && arr[idx] !== undefined) ? arr[idx] : 0;
    
    const grossProfit: number[] = [];
    const operatingProfit: number[] = [];
    const ebitda: number[] = [];
    const netIncome: number[] = [];
    
    for (let i = 0; i < 3; i++) {
      grossProfit[i] = getVal(extractedData.revenue, i) - getVal(extractedData.cost_of_sales, i);
      const totalOpex = getVal(extractedData.research_and_development, i) + 
        getVal(extractedData.sales_and_marketing, i) + 
        getVal(extractedData.selling_general_admin, i) + 
        getVal(extractedData.other_operating_expenses, i);
      operatingProfit[i] = grossProfit[i] - totalOpex;
      ebitda[i] = operatingProfit[i] + getVal(extractedData.depreciation_amortization, i);
      const pretax = operatingProfit[i] + getVal(extractedData.interest_income, i) - getVal(extractedData.interest_expense, i) + getVal(extractedData.other_income_expense, i);
      netIncome[i] = pretax - getVal(extractedData.income_tax_expense, i);
    }

    const result = {
      ...extractedData,
      gross_profit: grossProfit,
      operating_profit: operatingProfit,
      ebitda: ebitda,
      net_income: netIncome,
    };

    console.log('✅ Analysis complete');
    return c.json(result);

  } catch (error) {
    console.error('❌ Error analyzing 10-K:', error);
    return c.json({ error: 'Failed to process 10-K filing', message: error.message }, 500);
  }
});

// Invoice extraction endpoint
app.post("/make-server-53c2e113/analyze-invoice", async (c) => {
  try {
    console.log('🧾 Starting invoice analysis endpoint...');
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return c.json({ error: 'OpenAI API key not configured' }, 500);
    }

    let invoiceText = '';
    let useVision = false;

    if (file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const tempPath = `/tmp/invoice-${Date.now()}.pdf`;
      await Deno.writeFile(tempPath, bytes);
      
      try {
        const pdfParse = (await import('npm:pdf-parse@1.1.1')).default;
        const dataBuffer = await Deno.readFile(tempPath);
        const data = await pdfParse(dataBuffer);
        invoiceText = data.text;
        await Deno.remove(tempPath);
      } catch (parseError) {
        try { await Deno.remove(tempPath); } catch {}
        return c.json({ error: 'Failed to parse PDF file', details: parseError.message }, 500);
      }
    } else {
      useVision = true;
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let base64 = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        base64 += String.fromCharCode.apply(null, Array.from(chunk));
      }
      invoiceText = btoa(base64);
    }

    const messages = useVision ? [
        {
          role: 'user',
          content: [
          { type: "text", text: 'Extract invoice data as JSON: supplier_name, invoice_number, invoice_date (YYYY-MM-DD), due_date, net_amount, vat_amount, total_amount, currency' },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${invoiceText}` } }
        ]
      }
    ] : [
      { role: 'user', content: `Extract invoice data as JSON: supplier_name, invoice_number, invoice_date (YYYY-MM-DD), due_date, net_amount, vat_amount, total_amount, currency\n\nInvoice Text:\n${invoiceText.substring(0, 15000)}` }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 500, temperature: 0.1 })
    });

    if (!response.ok) {
      return c.json({ error: `OpenAI API error: ${response.status}` }, 500);
    }

    const result = await response.json();
    const extractedText = result.choices[0].message.content;

      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
    const invoiceData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(extractedText);

    return c.json(invoiceData);

  } catch (error) {
    console.error('❌ Invoice analysis error:', error);
    return c.json({ error: 'Failed to process invoice', details: error.message }, 500);
  }
});

// Bank Reconciliation endpoint
app.post("/make-server-53c2e113/analyze-bank-rec", async (c) => {
  try {
    console.log('🏦 Starting bank reconciliation endpoint...');
    
    const formData = await c.req.formData();
    const bankFile = formData.get('bank_file') as File;
    const ledgerFile = formData.get('ledger_file') as File;

    if (!bankFile || !ledgerFile) {
      return c.json({ error: 'Both bank and ledger files are required' }, 400);
    }

    const parseFile = async (file: File) => {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) throw new Error(`File ${file.name} has insufficient data`);

        const headers = jsonData[0].map((h: any) => h?.toString?.().toLowerCase().replace(/[^a-z0-9]/g, '_') || '').filter(Boolean);
        const rows = jsonData.slice(1).map((row: any[]) => {
          const obj: any = {};
          headers.forEach((header: string, idx: number) => {
            const cellValue = row[idx];
            if (typeof cellValue === 'number' && cellValue > 40000 && cellValue < 60000) {
              const excelEpoch = new Date(1899, 11, 30);
              obj[header] = new Date(excelEpoch.getTime() + cellValue * 86400000).toISOString().split('T')[0];
            } else {
              obj[header] = cellValue !== undefined && cellValue !== null ? cellValue.toString() : '';
            }
          });
          return obj;
        }).filter(row => Object.values(row).some(v => v && v.toString().trim() !== ''));

        return { headers, rows };
      } else {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error(`File ${file.name} has insufficient data`);

        const headers = lines[0].split(',').map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));
        const rows = lines.slice(1).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, idx) => { obj[header] = values[idx] || ''; });
          return obj;
        }).filter(row => Object.values(row).some(v => v && v.toString().trim() !== ''));

        return { headers, rows };
      }
    };

    const bankData = await parseFile(bankFile);
    const ledgerData = await parseFile(ledgerFile);

    const findField = (row: any, ...keys: string[]): string => {
      for (const key of keys) {
        if (row[key] && row[key].toString().trim() !== '') return row[key].toString().trim();
      }
      return '';
    };

    const parseAmount = (amountStr: string): number => {
      if (!amountStr) return 0;
      let cleaned = amountStr.toString().trim().replace(/[€$£¥\s]/g, '');
      if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') 
          ? cleaned.replace(/\./g, '').replace(',', '.') 
          : cleaned.replace(/,/g, '');
      } else if (cleaned.includes(',')) {
        cleaned = /,\d{2}$/.test(cleaned) ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
      }
      return parseFloat(cleaned) || 0;
    };

    const bankTransactions = bankData.rows.map((row: any, idx: number) => ({
      date: findField(row, 'date', 'datum', 'transaction_date'),
      description: findField(row, 'description', 'beschreibung', 'memo') || 'Unknown',
      amount: parseAmount(findField(row, 'amount', 'betrag', 'value')),
      _row_index: idx
    })).filter((t: any) => t.amount !== 0 && t.date);

    const ledgerEntries = ledgerData.rows.map((row: any, idx: number) => ({
      date: findField(row, 'date', 'datum', 'posting_date'),
      description: findField(row, 'description', 'beschreibung', 'memo') || 'Unknown',
      amount: parseAmount(findField(row, 'amount', 'betrag', 'value')),
      _row_index: idx
    })).filter((e: any) => e.amount !== 0 && e.date);

    console.log(`✅ Normalized ${bankTransactions.length} bank transactions, ${ledgerEntries.length} ledger entries`);
    
    if (bankTransactions.length === 0) {
      throw new Error('No valid bank transactions found. Please check your file format.');
    }
    
    if (ledgerEntries.length === 0) {
      throw new Error('No valid ledger entries found. Please check your file format.');
    }

    // ============================================================
    // 🚀 HYBRID MATCHING: Local Exact Match + AI Batch Processing
    // ============================================================
    
    console.log('🔄 Starting hybrid matching process...');
    
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // ============================================================
    // STEP 1: LOCAL EXACT MATCHING (Fast - handles 70-80% of matches)
    // ============================================================
    console.log('📍 Step 1: Local exact matching...');
    
    const localMatched: any[] = [];
    const usedBankIndices = new Set<number>();
    const usedLedgerIndices = new Set<number>();
    
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      try {
        if (dateStr.includes('.')) {
          const [day, month, year] = dateStr.split('.');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          return new Date(dateStr);
        }
      } catch {
        return null;
      }
    };
    
    const datesWithinDays = (date1: string, date2: string, days: number): boolean => {
      const d1 = parseDate(date1);
      const d2 = parseDate(date2);
      if (!d1 || !d2) return false;
      const diffMs = Math.abs(d1.getTime() - d2.getTime());
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= days;
    };
    
    // Local exact matching: same amount (±0.01) and date within 3 days
    for (let bIdx = 0; bIdx < bankTransactions.length; bIdx++) {
      if (usedBankIndices.has(bIdx)) continue;
      const bankTx = bankTransactions[bIdx];
      
      for (let lIdx = 0; lIdx < ledgerEntries.length; lIdx++) {
        if (usedLedgerIndices.has(lIdx)) continue;
        const ledgerEntry = ledgerEntries[lIdx];
        
        const amountMatch = Math.abs(bankTx.amount - ledgerEntry.amount) < 0.02;
        const dateMatch = datesWithinDays(bankTx.date, ledgerEntry.date, 3);
        
        if (amountMatch && dateMatch) {
          localMatched.push({
            bank_transaction: {
              date: bankTx.date,
              description: bankTx.description,
              amount: bankTx.amount
            },
            ledger_entries: [{
              date: ledgerEntry.date,
              description: ledgerEntry.description,
              amount: ledgerEntry.amount
            }],
            match_confidence: 1.0,
            match_type: 'exact',
            explanation: `Exact match: amounts match (${bankTx.amount}) and dates within 3 days`
          });
          usedBankIndices.add(bIdx);
          usedLedgerIndices.add(lIdx);
          break;
        }
      }
    }
    
    console.log(`✅ Local exact matching found ${localMatched.length} matches`);
    
    // Get remaining unmatched transactions
    const remainingBank = bankTransactions.filter((_, idx) => !usedBankIndices.has(idx));
    const remainingLedger = ledgerEntries.filter((_, idx) => !usedLedgerIndices.has(idx));
    
    console.log(`📊 Remaining after local match: ${remainingBank.length} bank, ${remainingLedger.length} ledger`);
    
    // ============================================================
    // STEP 2: AI BATCH PROCESSING (For remaining unmatched items)
    // ============================================================
    
    const aiMatched: any[] = [];
    const aiUnmatchedBank: any[] = [];
    const aiUnmatchedLedger: any[] = [];
    
    if (remainingBank.length > 0 || remainingLedger.length > 0) {
      console.log('📍 Step 2: AI batch processing for remaining items...');
      
      const BATCH_SIZE = 50;
      const bankBatches: any[][] = [];
      
      for (let i = 0; i < remainingBank.length; i += BATCH_SIZE) {
        bankBatches.push(remainingBank.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`🔄 Processing ${bankBatches.length} batches of up to ${BATCH_SIZE} transactions each...`);
      
      const globalUsedLedgerDescs = new Set<string>();
      
      for (let batchIdx = 0; batchIdx < bankBatches.length; batchIdx++) {
        const bankBatch = bankBatches[batchIdx];
        console.log(`📦 Processing batch ${batchIdx + 1}/${bankBatches.length} (${bankBatch.length} transactions)...`);
        
        const availableLedger = remainingLedger.filter(l => 
          !globalUsedLedgerDescs.has(`${l.date}|${l.description}|${l.amount}`)
        );
        
        const batchPrompt = `Match these ${bankBatch.length} bank transactions against ${availableLedger.length} ledger entries.

BANK TRANSACTIONS:
${JSON.stringify(bankBatch.map(t => ({ date: t.date, description: t.description, amount: t.amount })), null, 2)}

AVAILABLE LEDGER ENTRIES:
${JSON.stringify(availableLedger.slice(0, 100).map(e => ({ date: e.date, description: e.description, amount: e.amount })), null, 2)}${availableLedger.length > 100 ? '\n... (showing first 100)' : ''}

MATCHING RULES:
- exact: Same amount (±0.01), dates within 5 days
- fuzzy: Same amount, similar description (e.g., "AMZN" matches "Amazon")
- grouped: One bank txn matches multiple ledger entries that SUM to bank amount
- timing_difference: Same amount/description but dates >5 days apart
- fx_conversion: FX-related transactions with slight amount differences

For UNMATCHED bank items (fees, interest, unknown), suggest journal entries.

Return JSON:
{
  "matched_pairs": [{ "bank_transaction": {...}, "ledger_entries": [...], "match_confidence": 0.95, "match_type": "fuzzy" }],
  "unmatched_bank": [{ "transaction": {...}, "suggested_action": "...", "suggested_je": { "debit_account": "...", "credit_account": "...", "amount": 0 } }],
  "unmatched_ledger": [{ "entry": {...}, "reason": "...", "action": "..." }]
}`;

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
              model: 'gpt-4o-mini',
        messages: [
                { role: 'system', content: 'You are an expert accountant. Match bank transactions to ledger entries. Return ONLY valid JSON.' },
                { role: 'user', content: batchPrompt }
              ],
              temperature: 0.1,
              max_tokens: 4000,
              response_format: { type: "json_object" }
      }),
    });

          if (!response.ok) {
            console.error(`❌ Batch ${batchIdx + 1} API error:`, response.status);
            bankBatch.forEach(tx => {
              aiUnmatchedBank.push({
                transaction: { date: tx.date, description: tx.description, amount: tx.amount },
                suggested_action: 'AI processing failed - manual review required',
                suggested_je: null
              });
            });
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (!content) {
            console.error(`❌ Batch ${batchIdx + 1}: No content in response`);
            continue;
          }

          let batchResult;
          try {
            let cleaned = content.trim();
            if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
            }
            batchResult = JSON.parse(cleaned);
          } catch (parseErr) {
            console.error(`❌ Batch ${batchIdx + 1} parse error:`, parseErr);
            continue;
          }

          if (batchResult.matched_pairs) {
            for (const pair of batchResult.matched_pairs) {
              if (pair.ledger_entries && pair.ledger_entries.length > 0) {
                aiMatched.push({
      bank_transaction: {
        date: pair.bank_transaction?.date || '',
        description: pair.bank_transaction?.description || '',
        amount: pair.bank_transaction?.amount || 0
      },
                  ledger_entries: pair.ledger_entries.map((e: any) => ({
                    date: e?.date || '',
                    description: e?.description || '',
                    amount: e?.amount || 0
                  })),
                  match_confidence: pair.match_confidence || 0.8,
                  match_type: pair.match_type || 'ai_matched',
      explanation: pair.explanation || ''
                });
                
                pair.ledger_entries.forEach((e: any) => {
                  globalUsedLedgerDescs.add(`${e.date}|${e.description}|${e.amount}`);
                });
              }
            }
          }

          if (batchResult.unmatched_bank) {
            for (const item of batchResult.unmatched_bank) {
      const txn = item.transaction || item;
              aiUnmatchedBank.push({
        transaction: {
          date: txn?.date || '',
          description: txn?.description || '',
          amount: txn?.amount || 0
        },
                suggested_action: item.suggested_action || 'Review this transaction',
        suggested_je: item.suggested_je ? {
          description: item.suggested_je.description || '',
          debit_account: item.suggested_je.debit_account || '',
          credit_account: item.suggested_je.credit_account || '',
          amount: item.suggested_je.amount || 0
        } : null
              });
            }
          }

          console.log(`✅ Batch ${batchIdx + 1} complete: ${batchResult.matched_pairs?.length || 0} matched, ${batchResult.unmatched_bank?.length || 0} unmatched`);
          
        } catch (err) {
          console.error(`❌ Batch ${batchIdx + 1} error:`, err);
        }
      }
      
      // Find unmatched ledger entries
      for (const entry of remainingLedger) {
        const key = `${entry.date}|${entry.description}|${entry.amount}`;
        if (!globalUsedLedgerDescs.has(key)) {
          aiUnmatchedLedger.push({
            entry: {
              date: entry.date,
              description: entry.description,
              amount: entry.amount
            },
            reason: 'No matching bank transaction found',
            action: 'Verify this ledger entry or check next bank statement'
          });
        }
      }
    }
    
    console.log('✅ AI batch processing complete');
    
    // ============================================================
    // STEP 3: COMBINE RESULTS
    // ============================================================
    console.log('📍 Step 3: Combining results...');
    
    const finalMatched = [...localMatched, ...aiMatched];
    const unmatchedBankWithSuggestions = [...aiUnmatchedBank];
    const unmatchedLedger = [...aiUnmatchedLedger];
    
    const bankTotal = bankTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const ledgerTotal = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
    
    const summary = {
      total_bank_transactions: bankTransactions.length,
      total_ledger_entries: ledgerEntries.length,
      matched_count: finalMatched.length,
      unmatched_bank_count: unmatchedBankWithSuggestions.length,
      unmatched_ledger_count: unmatchedLedger.length,
      bank_total: bankTotal,
      ledger_total: ledgerTotal,
      difference: bankTotal - ledgerTotal
    };

    console.log('✅ Bank reconciliation complete:', summary);

    return c.json({
      summary,
      matched_pairs: finalMatched,
      unmatched_bank: unmatchedBankWithSuggestions,
      unmatched_ledger: unmatchedLedger
    });

  } catch (error) {
    console.error('❌ Bank reconciliation error:', error);
    return c.json({ error: 'Failed to process bank reconciliation', details: error.message }, 500);
  }
});

// AP Reconciliation endpoint
app.post("/make-server-53c2e113/reconcile-ap", async (c) => {
  try {
    console.log('📊 Starting AP reconciliation endpoint...');
    
    const formData = await c.req.formData();
    const vendorFile = formData.get('vendor_statement') as File;
    const apLedgerFile = formData.get('ap_ledger') as File;

    if (!vendorFile || !apLedgerFile) {
      console.error('❌ Missing required files');
      return c.json({ error: 'Both vendor statement and AP ledger files are required' }, 400);
    }

    console.log('📄 Files received:', { vendor: vendorFile.name, apLedger: apLedgerFile.name });

    // Parse vendor statement (CSV or Excel)
    let vendorInvoices: any[] = [];
    
    console.log('📊 Processing vendor statement...');
      const arrayBuffer = await vendorFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet);
      
      vendorInvoices = data.map((row: any) => ({
        invoice_number: String(row['Invoice #'] || row['Invoice'] || row['invoice_number'] || row['Invoice Number'] || '').trim(),
        date: row['Date'] || row['date'] || row['Invoice Date'] || '',
        amount: parseFloat(row['Amount'] || row['amount'] || row['Total'] || 0),
        status: row['Status'] || row['status'] || 'Unpaid',
        description: row['Description'] || row['description'] || ''
      }));

    console.log(`✅ Extracted ${vendorInvoices.length} vendor invoices`);

    // Parse AP ledger
    console.log('📊 Processing AP ledger...');
    const apArrayBuffer = await apLedgerFile.arrayBuffer();
    const apWorkbook = XLSX.read(apArrayBuffer, { type: 'array' });
    const apSheet = apWorkbook.Sheets[apWorkbook.SheetNames[0]];
    const apData = XLSX.utils.sheet_to_json(apSheet);
    
    const apEntries: any[] = apData.map((row: any) => ({
      invoice_number: String(row['Invoice #'] || row['Invoice'] || row['invoice_number'] || row['Invoice Number'] || '').trim(),
      date: row['Date'] || row['date'] || row['Invoice Date'] || '',
      amount: parseFloat(row['Amount'] || row['amount'] || row['Total'] || 0),
      status: row['Status'] || row['status'] || 'Pending',
      vendor: row['Vendor'] || row['vendor'] || ''
    }));

    console.log(`✅ Parsed ${apEntries.length} AP ledger entries`);

    // ============================================================
    // HYBRID MATCHING
    // ============================================================
    
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // STEP 1: LOCAL EXACT MATCHING
    console.log('📍 Step 1: Local exact matching by invoice number...');
    
    const localMatched: any[] = [];
    const amountMismatches: any[] = [];
    const usedVendorIndices = new Set<number>();
    const usedAPIndices = new Set<number>();
    
    const apByInvoiceNum = new Map<string, { entry: any; index: number }[]>();
    apEntries.forEach((entry, idx) => {
      const key = entry.invoice_number.toLowerCase().trim();
      if (!apByInvoiceNum.has(key)) {
        apByInvoiceNum.set(key, []);
      }
      apByInvoiceNum.get(key)!.push({ entry, index: idx });
    });
    
    for (let vIdx = 0; vIdx < vendorInvoices.length; vIdx++) {
      const vendorInv = vendorInvoices[vIdx];
      const invNumKey = vendorInv.invoice_number.toLowerCase().trim();
      
      const apMatches = apByInvoiceNum.get(invNumKey);
      if (apMatches && apMatches.length > 0) {
        const unusedMatch = apMatches.find(m => !usedAPIndices.has(m.index));
        
        if (unusedMatch) {
          const apEntry = unusedMatch.entry;
          const amountDiff = Math.abs(vendorInv.amount - apEntry.amount);
          
          if (amountDiff < 0.02) {
            localMatched.push({
              vendor_invoice: vendorInv,
              internal_entry: apEntry,
              match_type: 'exact',
              match_confidence: 1.0,
              explanation: `Exact match: invoice number "${vendorInv.invoice_number}" and amount ${vendorInv.amount}`
            });
            usedVendorIndices.add(vIdx);
            usedAPIndices.add(unusedMatch.index);
          } else {
            amountMismatches.push({
              invoice_number: vendorInv.invoice_number,
              vendor_amount: vendorInv.amount,
              internal_amount: apEntry.amount,
              difference: vendorInv.amount - apEntry.amount,
              notes: `Amount differs by €${Math.abs(amountDiff).toFixed(2)} - investigate pricing, discounts, or tax differences`
            });
            usedVendorIndices.add(vIdx);
            usedAPIndices.add(unusedMatch.index);
          }
        }
      }
    }
    
    console.log(`✅ Local matching: ${localMatched.length} exact matches, ${amountMismatches.length} amount mismatches`);
    
    // STEP 2: Find duplicates
    console.log('📍 Step 2: Finding duplicates...');
    
    const duplicates: any[] = [];
    const invoiceCountMap = new Map<string, any[]>();
    
    apEntries.forEach((entry) => {
      const key = entry.invoice_number.toLowerCase().trim();
      if (!invoiceCountMap.has(key)) {
        invoiceCountMap.set(key, []);
      }
      invoiceCountMap.get(key)!.push(entry);
    });
    
    invoiceCountMap.forEach((entries, invoiceNum) => {
      if (entries.length > 1) {
        duplicates.push({
          invoice_number: entries[0].invoice_number,
          occurrences: entries.length,
          entries: entries
        });
      }
    });
    
    console.log(`✅ Found ${duplicates.length} duplicate invoice numbers`);
    
    // STEP 3: Get remaining unmatched items
    const remainingVendorInvoices = vendorInvoices.filter((_, idx) => !usedVendorIndices.has(idx));
    const remainingAPEntries = apEntries.filter((_, idx) => !usedAPIndices.has(idx));
    
    console.log(`📊 Remaining: ${remainingVendorInvoices.length} vendor invoices, ${remainingAPEntries.length} AP entries`);
    
    // STEP 4: AI BATCH PROCESSING for fuzzy matching
    let aiMatched: any[] = [];
    let missingInvoices: any[] = [];
    let internalOnlyInvoices: any[] = [];
    
    if (remainingVendorInvoices.length > 0 || remainingAPEntries.length > 0) {
      console.log('📍 Step 4: AI processing for fuzzy matching...');
      
      const BATCH_SIZE = 100;
      const vendorBatches: any[][] = [];
      
      for (let i = 0; i < remainingVendorInvoices.length; i += BATCH_SIZE) {
        vendorBatches.push(remainingVendorInvoices.slice(i, i + BATCH_SIZE));
      }
      
      if (vendorBatches.length === 0 && remainingAPEntries.length > 0) {
        vendorBatches.push([]);
      }
      
      console.log(`🔄 Processing ${vendorBatches.length} batch(es)...`);
      
      for (let batchIdx = 0; batchIdx < vendorBatches.length; batchIdx++) {
        const vendorBatch = vendorBatches[batchIdx];
        console.log(`📦 Batch ${batchIdx + 1}/${vendorBatches.length}`);
        
        const batchPrompt = `Reconcile remaining invoices:

UNMATCHED VENDOR INVOICES (${vendorBatch.length}):
${JSON.stringify(vendorBatch, null, 2)}

UNMATCHED AP ENTRIES (${remainingAPEntries.length}):
${JSON.stringify(remainingAPEntries.slice(0, 100), null, 2)}${remainingAPEntries.length > 100 ? '\n... (showing first 100)' : ''}

TASK:
1. Try fuzzy matching (similar invoice numbers, typos, different formats)
2. Mark truly unmatched vendor invoices as "missing_invoices" (need to be recorded)
3. Mark truly unmatched AP entries as "internal_only_invoices" (not on vendor statement)

Return JSON:
{
  "matched_invoices": [{ "vendor_invoice": {...}, "internal_entry": {...}, "match_type": "fuzzy", "match_confidence": 0.8, "explanation": "..." }],
  "missing_invoices": [{ "invoice": {...}, "reason": "...", "action": "Record this invoice in AP system" }],
  "internal_only_invoices": [{ "invoice": {...}, "reason": "...", "action": "Verify with vendor" }]
}`;

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are a senior accountant. Match invoices and identify discrepancies. Return ONLY valid JSON.' },
                { role: 'user', content: batchPrompt }
              ],
              temperature: 0.1,
              max_tokens: 4000,
              response_format: { type: "json_object" }
            }),
          });

          if (!response.ok) {
            console.error(`❌ Batch ${batchIdx + 1} API error:`, response.status);
            vendorBatch.forEach(inv => {
              missingInvoices.push({
                invoice: inv,
                reason: 'AI processing failed - manual review required',
                action: 'Manually verify this invoice'
              });
            });
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (!content) {
            console.error(`❌ Batch ${batchIdx + 1}: No content`);
            continue;
          }

          let batchResult;
          try {
            let cleaned = content.trim();
            if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
            }
            batchResult = JSON.parse(cleaned);
          } catch (parseErr) {
            console.error(`❌ Batch ${batchIdx + 1} parse error:`, parseErr);
            continue;
          }

          if (batchResult.matched_invoices) {
            aiMatched = [...aiMatched, ...batchResult.matched_invoices];
          }
          if (batchResult.missing_invoices) {
            missingInvoices = [...missingInvoices, ...batchResult.missing_invoices];
          }
          if (batchResult.internal_only_invoices) {
            internalOnlyInvoices = [...internalOnlyInvoices, ...batchResult.internal_only_invoices];
          }

          console.log(`✅ Batch ${batchIdx + 1} complete`);
        } catch (err) {
          console.error(`❌ Batch ${batchIdx + 1} error:`, err);
        }
      }
    }
    
    console.log('✅ AI batch processing complete');
    
    // STEP 5: COMBINE RESULTS
    console.log('📍 Step 5: Combining results...');
    
    const finalMatched = [...localMatched, ...aiMatched];
    
    const vendorTotal = vendorInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const internalTotal = apEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    
    const result = {
      summary: {
        vendor_name: vendorInvoices[0]?.vendor || apEntries[0]?.vendor || 'Vendor',
        statement_date: new Date().toISOString().split('T')[0],
        total_vendor_invoices: vendorInvoices.length,
        total_internal_entries: apEntries.length,
        matched_count: finalMatched.length,
        amount_mismatches_count: amountMismatches.length,
        missing_invoices_count: missingInvoices.length,
        internal_only_count: internalOnlyInvoices.length,
        duplicates_count: duplicates.length,
        vendor_total: Math.round(vendorTotal * 100) / 100,
        internal_total: Math.round(internalTotal * 100) / 100,
        difference: Math.round((vendorTotal - internalTotal) * 100) / 100
      },
      matched_invoices: finalMatched,
      amount_mismatches: amountMismatches,
      missing_invoices: missingInvoices,
      internal_only_invoices: internalOnlyInvoices,
      duplicates: duplicates
    };

    console.log('✅ AP reconciliation complete:', result.summary);

    return c.json(result);

  } catch (error) {
    console.error('❌ AP reconciliation error:', error);
    return c.json({ error: 'Failed to process AP reconciliation', details: error.message }, 500);
  }
});

// AP Reconciliation Excel Export endpoint
app.post("/make-server-53c2e113/export-ap-reconciliation", async (c) => {
  try {
    console.log('📊 Starting AP reconciliation Excel export...');
    
    const body = await c.req.json();
    const result = body.result;

    if (!result) {
      console.error('❌ No reconciliation result provided');
      return c.json({ error: 'Reconciliation result is required' }, 400);
    }

    console.log('📝 Creating Excel workbook...');

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Executive Summary
    const summaryData = [
      ['AP Reconciliation Report'],
      [],
      ['Vendor Name', result.summary.vendor_name],
      ['Statement Date', result.summary.statement_date],
      ['Reconciliation Date', new Date().toISOString().split('T')[0]],
      [],
      ['Summary Statistics', ''],
      ['Total Vendor Invoices', result.summary.total_vendor_invoices],
      ['Total Vendor Amount', result.summary.vendor_total],
      ['Total Internal Entries', result.summary.total_internal_entries],
      ['Total Internal Amount', result.summary.internal_total],
      [],
      ['Reconciliation Results', ''],
      ['Matched Invoices', result.summary.matched_count],
      ['Amount Mismatches', result.summary.amount_mismatches_count],
      ['Missing Invoices', result.summary.missing_invoices_count],
      ['Internal Only Invoices', result.summary.internal_only_count],
      ['Duplicate Invoices', result.summary.duplicates_count],
      [],
      ['Total Difference', result.summary.difference],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

    // Sheet 2: Amount Mismatches
    if (result.amount_mismatches && result.amount_mismatches.length > 0) {
      const mismatchData = [
        ['Invoice Number', 'Vendor Amount', 'Internal Amount', 'Difference', 'Notes', 'Recommended Action'],
        ...result.amount_mismatches.map((m: any) => [
          m.invoice_number,
          m.vendor_amount,
          m.internal_amount,
          m.difference,
          m.notes,
          'Investigate discrepancy and adjust internal records or request vendor correction'
        ])
      ];
      const mismatchSheet = XLSX.utils.aoa_to_sheet(mismatchData);
      mismatchSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, mismatchSheet, 'Amount Mismatches');
    }

    // Sheet 3: Missing Invoices
    if (result.missing_invoices && result.missing_invoices.length > 0) {
      const missingData = [
        ['Invoice Number', 'Date', 'Amount', 'Status', 'Reason', 'Recommended Action'],
        ...result.missing_invoices.map((m: any) => [
          m.invoice.invoice_number,
          m.invoice.date,
          m.invoice.amount,
          m.invoice.status || 'N/A',
          m.reason,
          m.action
        ])
      ];
      const missingSheet = XLSX.utils.aoa_to_sheet(missingData);
      missingSheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 40 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, missingSheet, 'Missing Invoices');
    }

    // Sheet 4: Internal Only Invoices
    if (result.internal_only_invoices && result.internal_only_invoices.length > 0) {
      const internalData = [
        ['Invoice Number', 'Date', 'Amount', 'Vendor', 'Reason', 'Recommended Action'],
        ...result.internal_only_invoices.map((i: any) => [
          i.invoice.invoice_number,
          i.invoice.date,
          i.invoice.amount,
          i.invoice.vendor || result.summary.vendor_name,
          i.reason,
          i.action
        ])
      ];
      const internalSheet = XLSX.utils.aoa_to_sheet(internalData);
      internalSheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, internalSheet, 'Internal Only');
    }

    // Sheet 5: Duplicate Invoices
    if (result.duplicates && result.duplicates.length > 0) {
      const duplicateData = [['Invoice Number', 'Occurrences', 'Entry Details', 'Recommended Action']];
      
      result.duplicates.forEach((dup: any) => {
        const entryDetails = dup.entries.map((e: any) => 
          `Date: ${e.date}, Amount: ${e.amount}, Status: ${e.status}`
        ).join(' | ');
        
        duplicateData.push([
          dup.invoice_number,
          dup.occurrences,
          entryDetails,
          'Review and remove duplicate entries from internal system'
        ]);
      });

      const duplicateSheet = XLSX.utils.aoa_to_sheet(duplicateData);
      duplicateSheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 60 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, duplicateSheet, 'Duplicates');
    }

    // Sheet 6: Matched Invoices
    if (result.matched_invoices && result.matched_invoices.length > 0) {
      const matchedData = [
        ['Invoice Number', 'Date', 'Amount', 'Match Type', 'Status'],
        ...result.matched_invoices.map((m: any) => [
          m.vendor_invoice.invoice_number,
          m.vendor_invoice.date,
          m.vendor_invoice.amount,
          m.match_type === 'exact' ? 'Exact Match' : 'Fuzzy Match',
          '✓ Reconciled'
        ])
      ];
      const matchedSheet = XLSX.utils.aoa_to_sheet(matchedData);
      matchedSheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, matchedSheet, 'Matched Invoices');
    }

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log('✅ Excel file generated successfully');

    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="AP_Reconciliation_${result.summary.vendor_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });

  } catch (error) {
    console.error('❌ AP reconciliation Excel export error:', error);
    return c.json({ error: 'Excel export failed', details: error.message }, 500);
  }
});

// Expense Reconciliation endpoint
app.post("/make-server-53c2e113/reconcile-expenses", async (c) => {
  try {
    console.log('💳 Starting expense reconciliation endpoint...');
    
    const formData = await c.req.formData();
    const transactionsFile = formData.get('transactions') as File;
    const receipts = formData.getAll('receipts') as File[];

    if (!transactionsFile) {
      console.error('❌ No transactions file provided');
      return c.json({ error: 'Card transactions file is required' }, 400);
    }

    console.log('📄 Files received:', {
      transactions: transactionsFile.name,
      receiptsCount: receipts.length
    });

    // Parse card transactions
    console.log('📊 Parsing card transactions...');
    const transactionsBuffer = await transactionsFile.arrayBuffer();
    const transactionsWorkbook = XLSX.read(transactionsBuffer, { type: 'array' });
    const firstSheet = transactionsWorkbook.Sheets[transactionsWorkbook.SheetNames[0]];
    const transactionsData = XLSX.utils.sheet_to_json(firstSheet);

    const transactions = transactionsData.map((row: any) => ({
      date: row['Date'] || row['date'] || row['Transaction Date'] || '',
      amount: parseFloat(row['Amount'] || row['amount'] || 0),
      merchant: String(row['Merchant'] || row['merchant'] || row['Description'] || '').trim(),
      description: String(row['Description'] || row['description'] || '').trim(),
    }));

    console.log(`✅ Parsed ${transactions.length} card transactions`);

    // Extract data from receipts using OpenAI Vision
    console.log('🔍 Extracting data from receipts...');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const receiptData = [];
    for (const receipt of receipts) {
      console.log(`Processing receipt: ${receipt.name}`);
      
      const arrayBuffer = await receipt.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      let mimeType = receipt.type;
      if (!mimeType) {
        if (receipt.name.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (receipt.name.endsWith('.jpg') || receipt.name.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (receipt.name.endsWith('.png')) mimeType = 'image/png';
      }

      const imageUrl = `data:${mimeType};base64,${base64Data}`;

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are an expert at extracting structured data from receipts and invoices. Extract the date, total amount, VAT/tax amount, merchant name, and any line items. Return ONLY valid JSON.'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Extract the following data from this receipt:\n- date (YYYY-MM-DD format)\n- total (number)\n- vat (number, if present)\n- merchant (string)\n- items (array of line items, if present)\n\nReturn ONLY a JSON object with these fields.'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`❌ OpenAI API error for ${receipt.name}:`, error);
          continue;
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extracted = JSON.parse(jsonMatch[0]);
          receiptData.push({
            ...extracted,
            filename: receipt.name,
          });
          console.log(`✅ Extracted data from ${receipt.name}`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${receipt.name}:`, err);
      }
    }

    console.log(`✅ Extracted data from ${receiptData.length} receipts`);

    // Categorization rules
    const categorizeExpense = (merchant: string, description: string) => {
      const text = (merchant + ' ' + description).toLowerCase();
      
      if (text.includes('uber') || text.includes('taxi') || text.includes('lyft')) {
        return 'Travel - Taxi';
      }
      if (text.includes('lufthansa') || text.includes('ryanair') || text.includes('delta') || 
          text.includes('american airlines') || text.includes('flight') || text.includes('airline')) {
        return 'Travel - Flights';
      }
      if (text.includes('hotel') || text.includes('marriott') || text.includes('hilton') || 
          text.includes('airbnb') || text.includes('booking.com')) {
        return 'Travel - Accommodation';
      }
      if (text.includes('starbucks') || text.includes('restaurant') || text.includes('cafe') || 
          text.includes('coffee') || text.includes('bistro')) {
        return 'Meals & Entertainment';
      }
      if (text.includes('amazon') || text.includes('office depot') || text.includes('staples')) {
        if (text.includes('supplies') || text.includes('office')) {
          return 'Office Supplies';
        }
        return 'General Supplies';
      }
      if (text.includes('gas') || text.includes('shell') || text.includes('bp') || text.includes('fuel')) {
        return 'Travel - Fuel';
      }
      if (text.includes('parking') || text.includes('parkhaus')) {
        return 'Travel - Parking';
      }
      if (text.includes('software') || text.includes('saas') || text.includes('subscription')) {
        return 'Software & Subscriptions';
      }
      
      return 'Uncategorized';
    };

    // Match receipts to transactions
    console.log('🔗 Matching receipts to transactions...');
    const matches = [];
    const unmatchedTransactions = [];
    const orphanedReceipts = [];
    const usedReceiptIndices = new Set();

    for (const transaction of transactions) {
      let bestMatch = null;
      let bestMatchIndex = -1;
      let bestMatchScore = 0;

      for (let i = 0; i < receiptData.length; i++) {
        if (usedReceiptIndices.has(i)) continue;

        const receipt = receiptData[i];
        
        const amountDiff = Math.abs(transaction.amount - receipt.total);
        if (amountDiff > 0.50) continue;

        const transactionDate = new Date(transaction.date);
        const receiptDate = new Date(receipt.date);
        const daysDiff = Math.abs((transactionDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 2) continue;

        let score = 0;
        if (amountDiff < 0.01) score += 50;
        else score += (1 - amountDiff) * 20;
        
        if (daysDiff === 0) score += 30;
        else score += (1 - daysDiff / 2) * 20;

        const merchantLower = transaction.merchant.toLowerCase();
        const receiptMerchantLower = receipt.merchant.toLowerCase();
        if (merchantLower.includes(receiptMerchantLower) || receiptMerchantLower.includes(merchantLower)) {
          score += 20;
        }

        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestMatch = receipt;
          bestMatchIndex = i;
        }
      }

      if (bestMatch && bestMatchScore > 50) {
        usedReceiptIndices.add(bestMatchIndex);
        const category = categorizeExpense(transaction.merchant, transaction.description);
        matches.push({
          transaction,
          receipt: bestMatch,
          category,
          matchScore: bestMatchScore,
          hasReceipt: true,
        });
      } else {
        const category = categorizeExpense(transaction.merchant, transaction.description);
        unmatchedTransactions.push({
          transaction,
          category,
          hasReceipt: false,
          reason: 'Missing receipt',
        });
      }
    }

    // Find orphaned receipts
    for (let i = 0; i < receiptData.length; i++) {
      if (!usedReceiptIndices.has(i)) {
        orphanedReceipts.push({
          receipt: receiptData[i],
          reason: 'No matching card transaction found',
        });
      }
    }

    console.log(`✅ Matched: ${matches.length}, Unmatched: ${unmatchedTransactions.length}, Orphaned: ${orphanedReceipts.length}`);

    // Calculate category breakdown
    const categoryTotals: Record<string, { count: number; total: number }> = {};
    [...matches, ...unmatchedTransactions].forEach((item) => {
      const category = item.category;
      const amount = item.transaction.amount;
      if (!categoryTotals[category]) {
        categoryTotals[category] = { count: 0, total: 0 };
      }
      categoryTotals[category].count++;
      categoryTotals[category].total += amount;
    });

    const result = {
      summary: {
        total_transactions: transactions.length,
        total_receipts: receiptData.length,
        matched_count: matches.length,
        missing_receipts_count: unmatchedTransactions.length,
        orphaned_receipts_count: orphanedReceipts.length,
        total_amount: transactions.reduce((sum, t) => sum + t.amount, 0),
      },
      matches,
      unmatched_transactions: unmatchedTransactions,
      orphaned_receipts: orphanedReceipts,
      category_breakdown: Object.entries(categoryTotals).map(([category, data]) => ({
        category,
        count: data.count,
        total: data.total,
      })).sort((a, b) => b.total - a.total),
    };

    return c.json(result);

  } catch (error) {
    console.error('❌ Expense reconciliation error:', error);
    return c.json({ error: 'Expense reconciliation failed', details: error.message }, 500);
  }
});

// Export Expense Report as CSV
app.post("/make-server-53c2e113/export-expense-csv", async (c) => {
  try {
    console.log('📊 Starting expense CSV export...');
    
    const body = await c.req.json();
    const result = body.result;

    if (!result) {
      console.error('❌ No expense result provided');
      return c.json({ error: 'Expense result is required' }, 400);
    }

    console.log('📝 Creating CSV export...');

    // CSV Header
    const headers = ['Date', 'Amount', 'Merchant', 'Category', 'Has Receipt', 'Receipt File', 'Notes'];
    const rows = [headers];

    // Add matched transactions
    result.matches.forEach((match: any) => {
      rows.push([
        match.transaction.date,
        match.transaction.amount.toFixed(2),
        match.transaction.merchant,
        match.category,
        'Yes',
        match.receipt.filename,
        'Exact match',
      ]);
    });

    // Add unmatched transactions (missing receipts)
    result.unmatched_transactions.forEach((unmatched: any) => {
      rows.push([
        unmatched.transaction.date,
        unmatched.transaction.amount.toFixed(2),
        unmatched.transaction.merchant,
        unmatched.category,
        'No',
        '',
        unmatched.reason,
      ]);
    });

    // Convert to CSV string
    const csvContent = rows.map(row => row.map(cell => {
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')).join('\n');

    console.log('✅ CSV file generated successfully');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Expense_Report_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('❌ Expense CSV export error:', error);
    return c.json({ error: 'CSV export failed', details: error.message }, 500);
  }
});

Deno.serve(app.fetch);
