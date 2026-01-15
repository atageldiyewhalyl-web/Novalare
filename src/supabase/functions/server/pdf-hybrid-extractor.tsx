/**
 * PDF Hybrid Extractor: AI Schema Detection + Heuristic Coordinate-Based Parsing
 * 
 * Strategy:
 * 1. AI (GPT-4 Vision) detects semantic schema (WHAT to look for)
 * 2. PDF.js extracts text with coordinates (WHERE things are)
 * 3. Heuristic clustering finds column positions
 * 4. Precise extraction using detected schema + positions
 */

import * as kv from './kv_store.tsx';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AISchema {
  bank_name?: string;
  columns: string[]; // e.g. ["Date", "Description", "Amount", "Balance"]
  date_format: string; // e.g. "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"
  number_format: string; // e.g. "US", "EU"
  currency: string; // e.g. "USD", "EUR", "GBP"
  currency_position: string; // e.g. "before", "after"
  layout_type: string; // e.g. "amount_balance", "debit_credit_balance"
  negative_format: string; // e.g. "minus", "parentheses"
  header_text?: string[]; // Actual header row text
  special_notes?: string;
}

export interface Word {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ColumnPosition {
  name: string;
  x: number;
  tolerance: number;
  xStart?: number;
  xEnd?: number;
}

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  debit?: number;
  credit?: number;
}

// ============================================
// STEP 1: AI SCHEMA DETECTION
// ============================================

/**
 * Use GPT-4 Vision to detect the semantic schema of the bank statement
 * This runs ONCE per bank format and gets cached
 */
export async function detectSchemaWithAI(
  pdfBuffer: Uint8Array,
  bankIdentifier?: string
): Promise<AISchema> {
  console.log('🤖 AI Schema Detection: Analyzing PDF layout...');
  
  // Check cache first
  if (bankIdentifier) {
    const cachedSchema = await kv.get(`bank_schema:${bankIdentifier}`);
    if (cachedSchema) {
      console.log('✅ Using cached schema for', bankIdentifier);
      // TODO: Remove this override after testing - forces re-detection
      console.warn('🔄 CACHE OVERRIDE: Re-detecting schema for improved accuracy');
      // return cachedSchema as AISchema;  // Temporarily disabled
    }
  }
  
  // Extract sample text from first page to analyze
  const sampleText = await extractSampleText(pdfBuffer);
  
  // Call GPT-4 (text-only, no vision needed)
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }
  
  const prompt = `Analyze this bank statement sample text and return ONLY a JSON schema (no markdown, no explanation):

SAMPLE TEXT FROM BANK STATEMENT:
${sampleText}

Return this JSON structure:
{
  "bank_name": "Name of bank if visible",
  "columns": ["Date", "Description", "Debit", "Credit", "Balance"],
  "date_format": "MM/DD/YYYY or DD/MM/YYYY or YYYY-MM-DD",
  "number_format": "US (1,234.56) or EU (1.234,56)",
  "currency": "USD or EUR or GBP",
  "currency_position": "before or after",
  "layout_type": "debit_credit_balance",
  "negative_format": "minus or parentheses",
  "header_text": ["Date", "Description", "Debit", "Credit", "Balance"],
  "special_notes": "Any special formatting rules"
}

CRITICAL RULES FOR layout_type DETECTION:
1. Look for EXACT column header words in the sample text
2. If you see BOTH words "Debit" AND "Credit" (or "Payment" and "Deposit") as column headers → USE "debit_credit_balance"
3. If you see only ONE amount column (like "Amount", "Transaction", "Value") → USE "amount_balance"
4. IMPORTANT: Scan the entire sample text for header keywords, not just the first line
5. IMPORTANT: "Debit" = money OUT (negative), "Credit" = money IN (positive)

Examples to help you decide:
- Headers: "Date | Description | Debit | Credit | Balance" → "debit_credit_balance"
- Headers: "Date | Description | Payment | Deposit | Balance" → "debit_credit_balance"  
- Headers: "Date | Description | Amount | Balance" → "amount_balance"
- Headers: "Date | Transaction | Value | Running Balance" → "amount_balance"

Other Rules:
- columns: List the column names from left to right as they appear
- date_format: The exact format used (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD.MM.YYYY, etc.)
- number_format: "US" for 1,234.56 or "EU" for 1.234,56
- negative_format: "minus" for -50.00, "parentheses" for (50.00)
- Return ONLY valid JSON, nothing else.`;

  try {
    console.log('📡 Calling GPT-4o API for schema detection...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using GPT-4o for reliable schema detection
        messages: [{
          role: 'user',
          content: prompt
        }],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GPT-4 API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const content = result.choices[0].message.content;
    
    const schema = JSON.parse(content) as AISchema;
    
    console.log('✅ AI detected schema:', JSON.stringify(schema, null, 2));
    
    // Cache the schema
    const schemaId = bankIdentifier || schema.bank_name || `schema_${Date.now()}`;
    await kv.set(`bank_schema:${schemaId}`, schema);
    console.log('💾 Cached schema with ID:', schemaId);
    
    return schema;
    
  } catch (error) {
    console.error('❌ AI schema detection failed:', error);
    throw new Error(`AI schema detection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// STEP 2: PDF.JS COORDINATE EXTRACTION
// ============================================

/**
 * Extract text with x,y coordinates using PDF.js (pdfjs-dist)
 * This is the KEY improvement over pdf-parse which only gives lumped text
 */
export async function extractWordsWithCoordinates(
  pdfBuffer: Uint8Array
): Promise<Word[]> {
  console.log('📄 Extracting text with coordinates using PDF.js...');
  
  try {
    // Import PDF.js (using legacy build for Deno compatibility)
    const { getDocument } = await import('npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs');
    
    // Load PDF document
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    
    console.log(`📚 PDF has ${pdf.numPages} pages`);
    
    const allWords: Word[] = [];
    
    // Extract from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Process each text item
      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          // Extract position from transform matrix
          const transform = item.transform;
          const x = transform[4];
          const y = transform[5];
          const width = item.width || 0;
          const height = item.height || 0;
          
          allWords.push({
            text: item.str.trim(),
            x,
            y,
            width,
            height
          });
        }
      }
    }
    
    console.log(`✅ Extracted ${allWords.length} words with coordinates`);
    
    // DEBUG: Show ALL unique X positions to see where amounts actually are
    const uniqueXPositions = [...new Set(allWords.map(w => Math.round(w.x)))].sort((a, b) => a - b);
    console.log(`📍 DEBUG: All unique X positions found:`, uniqueXPositions.slice(0, 20).join(', '));
    
    // DEBUG: Show sample words from different X positions
    const wordsByX = new Map<number, string[]>();
    allWords.forEach(w => {
      const roundedX = Math.round(w.x);
      if (!wordsByX.has(roundedX)) wordsByX.set(roundedX, []);
      wordsByX.get(roundedX)!.push(w.text);
    });
    
    console.log(`📍 DEBUG: Sample words at each X position:`);
    Array.from(wordsByX.entries()).slice(0, 15).forEach(([x, words]) => {
      console.log(`  X=${x}: ${words.slice(0, 3).join(', ')}`);
    });
    
    return allWords;
    
  } catch (error) {
    console.error('❌ PDF.js extraction failed:', error);
    throw new Error(`PDF.js extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// STEP 3: HEURISTIC COLUMN DETECTION
// ============================================

/**
 * Detect column positions using clustering based on AI schema
 * AI tells us WHAT patterns to look for, we find WHERE they are
 */
export function detectColumnPositions(
  words: Word[],
  schema: AISchema
): Map<string, ColumnPosition> {
  console.log('🔍 Detecting column positions using heuristics + AI schema...');
  
  // Build regex patterns from AI schema
  const datePattern = buildDateRegex(schema.date_format);
  const moneyPattern = buildMoneyRegex(schema.number_format, schema.currency, schema.currency_position);
  
  console.log('🎯 Using patterns:', {
    date: datePattern.source,
    money: moneyPattern.source
  });
  
  // Find candidate words for each type
  let dateWords = words.filter(w => datePattern.test(w.text));
  const moneyWords = words.filter(w => moneyPattern.test(w.text));
  
  console.log(`📊 Found ${dateWords.length} date candidates, ${moneyWords.length} money candidates`);
  
  // If no dates found with AI-detected pattern, try fallback patterns
  if (dateWords.length === 0) {
    console.warn('⚠️ No dates found with AI pattern, trying fallback patterns...');
    
    // Try multiple common date patterns
    const fallbackPatterns = [
      /\d{1,2}\.\d{1,2}\.\d{4}/,           // DD.MM.YYYY (German/EU)
      /\d{1,2}\/\d{1,2}\/\d{4}/,           // MM/DD/YYYY or DD/MM/YYYY
      /\d{4}-\d{2}-\d{2}/,                  // YYYY-MM-DD
      /\d{1,2}-\d{1,2}-\d{4}/,              // MM-DD-YYYY or DD-MM-YYYY
      /\d{1,2}\/\d{1,2}\/\d{2}/,            // MM/DD/YY
      /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b/i  // DD MMM YYYY
    ];
    
    for (const pattern of fallbackPatterns) {
      dateWords = words.filter(w => pattern.test(w.text));
      if (dateWords.length > 0) {
        console.log(`✅ Found ${dateWords.length} dates with fallback pattern: ${pattern.source}`);
        break;
      }
    }
    
    if (dateWords.length === 0) {
      // Last resort: log sample words to help debug
      console.error('❌ Still no dates found! Sample words from PDF:');
      console.error(words.slice(0, 50).map(w => w.text).join(', '));
      throw new Error('No dates found - cannot detect column layout. PDF may not contain transaction dates or dates are in an unsupported format.');
    }
  }
  
  const columnMap = new Map<string, ColumnPosition>();
  
  // Date column: should be clustered at one X position
  const dateColumnX = median(dateWords.map(w => w.x));
  columnMap.set('date', {
    name: 'date',
    x: dateColumnX,
    tolerance: 20
  });
  
  console.log(`📍 Date column detected at X=${dateColumnX.toFixed(1)}`);
  
  // CRITICAL FIX: Remove date words from money words to prevent column overlap
  const dateXPositions = new Set(dateWords.map(w => w.x));
  const moneyWordsFiltered = moneyWords.filter(w => {
    return !Array.from(dateXPositions).some(dateX => Math.abs(w.x - dateX) <= 5);
  });
  
  console.log(`🔧 Filtered money candidates: ${moneyWords.length} -> ${moneyWordsFiltered.length} (removed ${moneyWords.length - moneyWordsFiltered.length} date overlaps)`);
  
  // 🚨 NEW FIX: Group words into rows first, then only cluster money from transaction-like rows
  // This prevents header/footer rows (which have money at different X positions) from polluting the clustering
  const rows = clusterByY(words, 5);
  const transactionRows = rows.filter(row => {
    // A transaction row should have: a date + some description text + money values
    const hasDate = row.some(w => datePattern.test(w.text));
    const hasDescription = row.some(w => w.x > dateColumnX + 50 && w.x < dateColumnX + 200 && w.text.length > 3);
    return hasDate && hasDescription;
  });
  
  console.log(`🎯 Identified ${transactionRows.length} transaction-like rows out of ${rows.length} total rows`);
  
  // Extract money words ONLY from transaction rows
  const transactionWords = transactionRows.flat();
  const transactionMoneyWords = transactionWords.filter(w => 
    moneyPattern.test(w.text) && !datePattern.test(w.text)
  );
  
  console.log(`💰 Found ${transactionMoneyWords.length} money values in transaction rows (vs ${moneyWordsFiltered.length} total)`);
  
  // 🚨 CRITICAL FIX: Only cluster money values to the RIGHT of description area
  // This filters out card numbers, account numbers, etc. that appear in the description area
  // UPDATED: Increased threshold to 400 to exclude operation titles and summary values
  const descriptionEndX = dateColumnX + 360; // Conservative: description + operation title + metadata typically end before X=400
  const moneyWordsForClustering = transactionMoneyWords.filter(w => w.x > descriptionEndX);
  
  console.log(`🎯 Filtered to ${moneyWordsForClustering.length} money values to the right of descriptions (X > ${descriptionEndX.toFixed(1)})`);
  
  // 🚨 SECOND CRITICAL FIX: Remove garbage values that match money regex but aren't actually amounts
  // This includes UUIDs (contain hyphens), "Card transactions", "Internal transfer", etc.
  const cleanMoneyWordsForClustering = moneyWordsForClustering.filter(w => {
    const text = w.text.trim();
    
    // Reject if contains letters (except currency symbols which were already removed)
    if (/[a-zA-Z]/.test(text.replace(/EUR|USD|GBP|CHF/gi, ''))) {
      return false;
    }
    
    // Reject UUIDs (contain hyphens in specific pattern like "1ac33afd-ff7b")
    if (/-[0-9a-f]{4,}/i.test(text)) {
      return false;
    }
    
    // Reject if too long (amounts are typically 3-12 chars, UUIDs are 20+)
    if (text.length > 15) {
      return false;
    }
    
    return true;
  });
  
  console.log(`🧹 Cleaned clustering data: ${moneyWordsForClustering.length} -> ${cleanMoneyWordsForClustering.length} (removed ${moneyWordsForClustering.length - cleanMoneyWordsForClustering.length} garbage values)`);
  
  if (cleanMoneyWordsForClustering.length < 10) {
    console.warn(`⚠️ Very few money values found for clustering (${cleanMoneyWordsForClustering.length}). Trying with all transaction money words...`);
    // Fallback: use all transaction money words if filtering is too aggressive
    cleanMoneyWordsForClustering.push(...transactionMoneyWords.filter(w => w.x <= descriptionEndX));
  }
  
  // Money columns: cluster based on layout type using ONLY clean transaction money words
  if (schema.layout_type === 'debit_credit_balance') {
    // Expect 3 money columns
    const clusters = kMeansCluster(cleanMoneyWordsForClustering.map(w => w.x), 3);
    clusters.sort((a, b) => a - b);
    
    columnMap.set('debit', { name: 'debit', x: clusters[0], tolerance: 25 });
    columnMap.set('credit', { name: 'credit', x: clusters[1], tolerance: 25 });
    columnMap.set('balance', { name: 'balance', x: clusters[2], tolerance: 25 });
    
    console.log(`📍 Debit column at X=${clusters[0].toFixed(1)}`);
    console.log(`📍 Credit column at X=${clusters[1].toFixed(1)}`);
    console.log(`📍 Balance column at X=${clusters[2].toFixed(1)}`);
    
  } else {
    // amount_balance: expect 2 money columns
    const clusters = kMeansCluster(cleanMoneyWordsForClustering.map(w => w.x), 2);
    clusters.sort((a, b) => a - b);
    
    columnMap.set('amount', { name: 'amount', x: clusters[0], tolerance: 25 });
    columnMap.set('balance', { name: 'balance', x: clusters[1], tolerance: 25 });
    
    console.log(`📍 Amount column at X=${clusters[0].toFixed(1)}`);
    console.log(`📍 Balance column at X=${clusters[1].toFixed(1)}`);
  }
  
  // Description column: between date and first money column
  const firstMoneyX = Math.min(...Array.from(columnMap.values())
    .filter(col => col.name !== 'date')
    .map(col => col.x));
  
  columnMap.set('description', {
    name: 'description',
    x: 0,
    tolerance: 0,
    xStart: dateColumnX + 60,
    xEnd: firstMoneyX - 20
  });
  
  console.log(`📍 Description column from X=${(dateColumnX + 60).toFixed(1)} to X=${(firstMoneyX - 20).toFixed(1)}`);
  
  return columnMap;
}

// ============================================
// STEP 4: TRANSACTION EXTRACTION
// ============================================

/**
 * Extract transactions using AI schema + detected column positions
 * This is where the magic happens - precise, coordinate-based extraction
 */
export function extractTransactions(
  words: Word[],
  schema: AISchema,
  columnMap: Map<string, ColumnPosition>
): Transaction[] {
  console.log('💎 Extracting transactions with coordinate-based matching...');
  
  // Group words into rows by Y position
  const rows = clusterByY(words, 5);
  
  console.log(`📋 Grouped ${words.length} words into ${rows.length} rows`);
  
  const transactions: Transaction[] = [];
  let skippedRows = 0;
  let rowsWithoutDates = 0;
  let rowsWithInvalidDates = 0;
  let rowsWithoutAmounts = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const txn: Partial<Transaction> = {};
    
    // Debug: log first few rows
    if (i < 5) {
      console.log(`\n🔍 Row ${i}: ${row.length} words`, row.map(w => `"${w.text}"`).join(', '));
    }
    
    // Extract date
    const dateCol = columnMap.get('date')!;
    const dateWord = row.find(w => Math.abs(w.x - dateCol.x) <= dateCol.tolerance);
    if (!dateWord) {
      rowsWithoutDates++;
      if (i < 5) console.log(`  ⏭️  No date found at X=${dateCol.x.toFixed(1)} (tolerance=${dateCol.tolerance})`);
      continue; // Skip rows without dates (headers, footers)
    }
    
    if (i < 5) console.log(`  📅 Date candidate: "${dateWord.text}" at X=${dateWord.x.toFixed(1)}`);
    
    txn.date = parseDate(dateWord.text, schema.date_format);
    if (!txn.date) {
      rowsWithInvalidDates++;
      if (i < 5) console.log(`  ❌ Invalid date: "${dateWord.text}"`);
      continue; // Invalid date
    }
    
    if (i < 5) console.log(`  ✅ Parsed date: ${txn.date}`);
    
    // Extract description (all words in description column range)
    const descCol = columnMap.get('description')!;
    const descWords = row.filter(w => 
      w.x >= descCol.xStart! && w.x < descCol.xEnd!
    );
    txn.description = descWords.map(w => w.text).join(' ').trim();
    
    if (i < 5) console.log(`  📝 Description: "${txn.description}" (${descWords.length} words from X=${descCol.xStart?.toFixed(1)} to X=${descCol.xEnd?.toFixed(1)})`);
    
    // Extract amounts based on layout type
    if (schema.layout_type === 'debit_credit_balance') {
      const debitCol = columnMap.get('debit')!;
      const creditCol = columnMap.get('credit')!;
      const balanceCol = columnMap.get('balance')!;
      
      const debitWord = row.find(w => Math.abs(w.x - debitCol.x) <= debitCol.tolerance);
      const creditWord = row.find(w => Math.abs(w.x - creditCol.x) <= creditCol.tolerance);
      const balanceWord = row.find(w => Math.abs(w.x - balanceCol.x) <= balanceCol.tolerance);
      
      if (i < 5) {
        console.log(`  💰 Looking for debit at X=${debitCol.x.toFixed(1)}: ${debitWord ? `"${debitWord.text}"` : 'NOT FOUND'}`);
        console.log(`  💰 Looking for credit at X=${creditCol.x.toFixed(1)}: ${creditWord ? `"${creditWord.text}"` : 'NOT FOUND'}`);
        console.log(`  💰 Looking for balance at X=${balanceCol.x.toFixed(1)}: ${balanceWord ? `"${balanceWord.text}"` : 'NOT FOUND'}`);
      }
      
      if (debitWord) {
        txn.debit = parseAmount(debitWord.text, schema);
        txn.amount = -Math.abs(txn.debit); // Debits are negative
        if (i < 5) console.log(`  💵 Parsed debit: ${txn.debit} → amount: ${txn.amount}`);
      } else if (creditWord) {
        txn.credit = parseAmount(creditWord.text, schema);
        txn.amount = Math.abs(txn.credit); // Credits are positive
      }
      
      if (balanceWord) {
        txn.balance = parseAmount(balanceWord.text, schema);
      }
      
    } else {
      // amount_balance layout
      const amountCol = columnMap.get('amount')!;
      const balanceCol = columnMap.get('balance')!;
      
      const amountWord = row.find(w => Math.abs(w.x - amountCol.x) <= amountCol.tolerance);
      const balanceWord = row.find(w => Math.abs(w.x - balanceCol.x) <= balanceCol.tolerance);
      
      if (i < 5) {
        console.log(`  💰 Looking for amount at X=${amountCol.x.toFixed(1)}: ${amountWord ? `"${amountWord.text}"` : 'NOT FOUND'}`);
        console.log(`  💰 Looking for balance at X=${balanceCol.x.toFixed(1)}: ${balanceWord ? `"${balanceWord.text}"` : 'NOT FOUND'}`);
        
        // DEBUG: Show ALL words in this row with their X positions
        if (!amountWord) {
          console.log(`  🔍 DEBUG - All words in row with X positions:`);
          row.forEach(w => console.log(`     X=${w.x.toFixed(1)}: "${w.text}"`));
        }
      }
      
      if (amountWord) {
        txn.amount = parseAmount(amountWord.text, schema);
        if (i < 5) console.log(`  💵 Parsed amount: ${txn.amount}`);
      }
      
      if (balanceWord) {
        txn.balance = parseAmount(balanceWord.text, schema);
        if (i < 5) console.log(`  💵 Parsed balance: ${txn.balance}`);
      }
    }
    
    // Validate transaction has required fields
    if (txn.date && txn.description && txn.amount !== undefined) {
      transactions.push(txn as Transaction);
      if (i < 5) console.log(`  ✅ Transaction added!`);
    } else {
      skippedRows++;
      if (i < 5) {
        console.log(`  ❌ Transaction skipped - missing fields:`, {
          hasDate: !!txn.date,
          hasDescription: !!txn.description,
          hasAmount: txn.amount !== undefined
        });
      }
      if (!txn.amount && txn.amount !== 0) {
        rowsWithoutAmounts++;
      }
    }
  }
  
  console.log(`\n📊 Extraction Summary:`);
  console.log(`   Total rows: ${rows.length}`);
  console.log(`   Rows without dates: ${rowsWithoutDates}`);
  console.log(`   Rows with invalid dates: ${rowsWithInvalidDates}`);
  console.log(`   Rows without amounts: ${rowsWithoutAmounts}`);
  console.log(`   Rows skipped (other reasons): ${skippedRows - rowsWithoutAmounts}`);
  console.log(`   Valid transactions: ${transactions.length}`);
  
  console.log(`✅ Extracted ${transactions.length} valid transactions`);
  return transactions;
}

// ============================================
// STEP 5: VALIDATION
// ============================================

/**
 * Validate extracted transactions make mathematical sense
 */
export function validateExtraction(transactions: Transaction[]): {
  valid: boolean;
  confidence: number;
  checks: { name: string; passed: boolean; message: string }[];
} {
  console.log('🔍 Validating extraction quality...');
  
  const checks: { name: string; passed: boolean; message: string }[] = [];
  
  if (transactions.length === 0) {
    return {
      valid: false,
      confidence: 0,
      checks: [{ name: 'has_transactions', passed: false, message: 'No transactions extracted' }]
    };
  }
  
  // Check 1: Dates are sequential
  const dates = transactions.map(t => new Date(t.date).getTime()).filter(d => !isNaN(d));
  const datesAreSequential = dates.every((d, i) => 
    i === 0 || d >= dates[i - 1] - 7 * 24 * 60 * 60 * 1000 // Allow 7 day tolerance
  );
  checks.push({
    name: 'sequential_dates',
    passed: datesAreSequential,
    message: datesAreSequential ? 'Dates are sequential' : 'Dates are not sequential'
  });
  
  // Check 2: All transactions have descriptions
  const completeness = transactions.filter(t => t.description && t.description.length > 2).length / transactions.length;
  const isComplete = completeness > 0.8;
  checks.push({
    name: 'completeness',
    passed: isComplete,
    message: `${(completeness * 100).toFixed(0)}% of transactions have valid descriptions`
  });
  
  // Check 3: Amounts are reasonable (not all the same value)
  const amounts = transactions.map(t => Math.abs(t.amount));
  const uniqueAmounts = new Set(amounts).size;
  const amountsAreReasonable = uniqueAmounts > Math.min(5, transactions.length * 0.5);
  checks.push({
    name: 'reasonable_amounts',
    passed: amountsAreReasonable,
    message: `${uniqueAmounts} unique amounts found`
  });
  
  // Check 4: Balance math (if balances present)
  const hasBalances = transactions.filter(t => t.balance !== undefined).length > 0;
  let balanceMathValid = true;
  
  if (hasBalances && transactions.length > 1) {
    const txnsWithBalance = transactions.filter(t => t.balance !== undefined);
    if (txnsWithBalance.length > 1) {
      // Check if balance changes match amounts
      let mathErrors = 0;
      for (let i = 1; i < txnsWithBalance.length; i++) {
        const prevBalance = txnsWithBalance[i - 1].balance!;
        const currentBalance = txnsWithBalance[i].balance!;
        const amount = txnsWithBalance[i].amount;
        const expectedBalance = prevBalance + amount;
        const diff = Math.abs(currentBalance - expectedBalance);
        
        if (diff > 0.02) { // Allow 2 cent rounding error
          mathErrors++;
        }
      }
      
      balanceMathValid = mathErrors < txnsWithBalance.length * 0.2; // Allow 20% error rate
    }
  }
  
  checks.push({
    name: 'balance_math',
    passed: balanceMathValid,
    message: balanceMathValid ? 'Balance math is correct' : 'Balance math has errors'
  });
  
  const passedCount = checks.filter(c => c.passed).length;
  const confidence = passedCount / checks.length;
  const valid = confidence >= 0.75; // Need at least 75% of checks to pass
  
  console.log(`📊 Validation: ${passedCount}/${checks.length} checks passed (${(confidence * 100).toFixed(0)}% confidence)`);
  
  return {
    valid,
    confidence,
    checks
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Extract sample text from first page of PDF for AI schema detection
 */
async function extractSampleText(pdfBuffer: Uint8Array): Promise<string> {
  try {
    // Import PDF.js (using legacy build for Deno compatibility)
    const { getDocument } = await import('npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs');
    
    // Load PDF document
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    
    // Extract text from first page
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    
    // Join text items into a single string
    const sampleText = textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
    
    return sampleText;
    
  } catch (error) {
    console.error('❌ Sample text extraction failed:', error);
    throw error;
  }
}

/**
 * Build date regex from AI-detected format
 */
function buildDateRegex(format: string): RegExp {
  const formatLower = format.toLowerCase();
  
  if (formatLower.includes('mm/dd/yyyy')) {
    return /\d{1,2}\/\d{1,2}\/\d{4}/;
  } else if (formatLower.includes('dd/mm/yyyy')) {
    return /\d{1,2}\/\d{1,2}\/\d{4}/;
  } else if (formatLower.includes('yyyy-mm-dd')) {
    return /\d{4}-\d{2}-\d{2}/;
  } else if (formatLower.includes('dd-mm-yyyy')) {
    return /\d{1,2}-\d{1,2}-\d{4}/;
  } else if (formatLower.includes('dd.mm.yyyy')) {
    return /\d{1,2}\.\d{1,2}\.\d{4}/;
  } else {
    // Fallback: match common date patterns
    return /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/;
  }
}

/**
 * Build money regex from AI-detected format
 */
function buildMoneyRegex(numberFormat: string, currency: string, currencyPosition: string): RegExp {
  const formatLower = numberFormat.toLowerCase();
  
  if (formatLower.includes('eu')) {
    // EU format: 1.234,56 - STRICT version to avoid matching garbage
    // Must either:
    // 1. Have exactly 2 decimal places: 1.234,56 or 1234,56 or 123,45
    // 2. OR be a whole number with no decimals: 1234 or 123
    // Added \b word boundaries to prevent matching "1ac33afd" as "1"
    return /\b€?\s*-?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?\b|\b€?\s*-?\(?\d{1,6}\)?\b/;
  } else if (formatLower.includes('us')) {
    // US format: 1,234.56 - STRICT version
    return /\b\$?\s*-?\(?\d{1,3}(?:,\d{3})*\.\d{2}\)?\b|\b\$?\s*-?\(?\d{1,6}\)?\b/;
  } else {
    // Fallback: match both formats but with word boundaries
    return /\b[€$£]?\s*-?\(?\d{1,3}(?:[,\.]\d{3})*[,\.]\d{2}\)?\b|\b[€$£]?\s*-?\(?\d{1,6}\)?\b/;
  }
}

/**
 * Parse date string using AI-detected format
 */
function parseDate(dateStr: string, format: string): string | null {
  try {
    const formatLower = format.toLowerCase();
    
    if (formatLower.includes('yyyy-mm-dd')) {
      // ISO format, already good
      return dateStr;
    } else if (formatLower.includes('mm/dd/yyyy')) {
      // US format
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    } else if (formatLower.includes('dd/mm/yyyy')) {
      // EU format
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    } else if (formatLower.includes('dd.mm.yyyy')) {
      // German format with dots
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    
    // Fallback: try to parse and convert to ISO
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse amount using AI-detected format
 */
function parseAmount(amountStr: string, schema: AISchema): number {
  try {
    let cleaned = amountStr.trim();
    
    // Remove currency symbols AND currency words (EUR, USD, GBP, etc.)
    // MUST do this BEFORE validating for letters!
    cleaned = cleaned.replace(/[$€£¥]/g, '');
    cleaned = cleaned.replace(/\b(EUR|USD|GBP|CHF|JPY|CNY|CAD|AUD)\b/gi, '').trim();
    
    // VALIDATION: Reject strings containing letters (except currency symbols)
    // This prevents parsing "1ac33afd" as "1"
    if (/[a-zA-Z]/.test(cleaned)) {
      console.warn(`⚠️ Rejected amount with letters: "${amountStr}"`);
      return 0;
    }
    
    // Handle parentheses (negative)
    let isNegative = false;
    if (schema.negative_format === 'parentheses' && cleaned.startsWith('(') && cleaned.endsWith(')')) {
      isNegative = true;
      cleaned = cleaned.slice(1, -1);
    }
    
    // Handle negative sign
    if (cleaned.startsWith('-')) {
      isNegative = true;
      cleaned = cleaned.substring(1);
    }
    
    // Handle number format
    if (schema.number_format.toLowerCase().includes('eu')) {
      // EU format: 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56 -> 1234.56
      cleaned = cleaned.replace(/,/g, '');
    }
    
    const value = parseFloat(cleaned);
    
    if (isNaN(value)) {
      return 0;
    }
    
    // VALIDATION: Reject unreasonably large amounts (likely parsing errors)
    if (value > 10000000) { // 10 million
      console.warn(`⚠️ Rejected unreasonably large amount: ${value} from "${amountStr}"`);
      return 0;
    }
    
    return isNegative ? -value : value;
  } catch {
    return 0;
  }
}

/**
 * Cluster words into rows by Y position
 */
function clusterByY(words: Word[], tolerance: number): Word[][] {
  if (words.length === 0) return [];
  
  // Sort by Y position
  const sorted = [...words].sort((a, b) => a.y - b.y);
  
  const rows: Word[][] = [];
  let currentRow: Word[] = [sorted[0]];
  let currentY = sorted[0].y;
  
  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i];
    
    if (Math.abs(word.y - currentY) <= tolerance) {
      // Same row
      currentRow.push(word);
    } else {
      // New row
      rows.push(currentRow.sort((a, b) => a.x - b.x)); // Sort words in row by X
      currentRow = [word];
      currentY = word.y;
    }
  }
  
  // Add last row
  if (currentRow.length > 0) {
    rows.push(currentRow.sort((a, b) => a.x - b.x));
  }
  
  return rows;
}

/**
 * Simple k-means clustering for X positions
 */
function kMeansCluster(values: number[], k: number, maxIterations: number = 10): number[] {
  if (values.length === 0) return [];
  if (k >= values.length) return [...new Set(values)].sort((a, b) => a - b);
  
  // Initialize centroids: pick k evenly-spaced values
  const sorted = [...values].sort((a, b) => a - b);
  const centroids: number[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i / k) * sorted.length);
    centroids.push(sorted[idx]);
  }
  
  // Iterate
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each value to nearest centroid
    const clusters: number[][] = Array(k).fill(null).map(() => []);
    
    for (const value of values) {
      let nearestIdx = 0;
      let nearestDist = Math.abs(value - centroids[0]);
      
      for (let i = 1; i < k; i++) {
        const dist = Math.abs(value - centroids[i]);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
      
      clusters[nearestIdx].push(value);
    }
    
    // Recalculate centroids
    let changed = false;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const newCentroid = clusters[i].reduce((a, b) => a + b, 0) / clusters[i].length;
        if (Math.abs(newCentroid - centroids[i]) > 0.1) {
          changed = true;
        }
        centroids[i] = newCentroid;
      }
    }
    
    if (!changed) break;
  }
  
  return centroids.sort((a, b) => a - b);
}

/**
 * Calculate median of array
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

// ============================================
// MAIN EXPORT: HYBRID PARSER
// ============================================

/**
 * Main function: Extract transactions using hybrid AI + heuristic approach
 */
export async function parsePDFHybrid(
  uint8Array: Uint8Array,
  fileName: string,
  bankIdentifier?: string
): Promise<Transaction[]> {
  console.log('🚀 HYBRID PDF PARSER: AI Schema + Coordinate-Based Extraction');
  console.log(`📄 Processing: ${fileName} (${uint8Array.length} bytes)`);
  
  const startTime = Date.now();
  
  try {
    // Step 1: Detect schema with AI (cached after first run)
    console.log('\n📍 STEP 1: AI Schema Detection');
    const schema = await detectSchemaWithAI(uint8Array, bankIdentifier);
    
    // Step 2: Extract words with coordinates
    console.log('\n📍 STEP 2: PDF.js Coordinate Extraction');
    const words = await extractWordsWithCoordinates(uint8Array);
    
    // Step 3: Detect column positions using heuristics
    console.log('\n📍 STEP 3: Heuristic Column Detection');
    const columnMap = detectColumnPositions(words, schema);
    
    // Step 4: Extract transactions
    console.log('\n📍 STEP 4: Transaction Extraction');
    const transactions = extractTransactions(words, schema, columnMap);
    
    // Step 5: Validate
    console.log('\n📍 STEP 5: Validation');
    const validation = validateExtraction(transactions);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ HYBRID PARSER COMPLETE in ${elapsed}s`);
    console.log(`📊 Extracted ${transactions.length} transactions`);
    console.log(`🎯 Confidence: ${(validation.confidence * 100).toFixed(0)}%`);
    console.log(`📋 Validation checks:`);
    validation.checks.forEach(check => {
      console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}: ${check.message}`);
    });
    
    if (!validation.valid) {
      console.warn('⚠️ Validation failed - extraction may be inaccurate');
      console.warn('Consider manual review or fallback to GPT-4 Vision');
    }
    
    return transactions;
    
  } catch (error) {
    console.error('❌ Hybrid parser failed:', error);
    throw new Error(`Hybrid parser failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}