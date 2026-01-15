/**
 * AWS Textract Bank Statement Extractor
 * 
 * This module uses AWS Textract to extract structured table data from bank statements,
 * then uses GPT-4 mini to convert it to a clean JSON format.
 * 
 * Expected performance: 5-8 seconds (vs 40+ seconds with GPT-4o Vision)
 */

// AWS SDK v3 imports - Deno will automatically resolve these
import { 
  TextractClient, 
  AnalyzeDocumentCommand,
  type AnalyzeDocumentCommandInput,
  type AnalyzeDocumentCommandOutput,
  type Block
} from "npm:@aws-sdk/client-textract";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TextractTableCell {
  rowIndex: number;
  columnIndex: number;
  text: string;
  confidence: number;
}

export interface TextractTable {
  rows: string[][]; // Array of rows, each row is an array of cell values
  confidence: number;
}

export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  type?: 'debit' | 'credit';
  currency?: string;
}

// ============================================
// STEP 1: TEXTRACT EXTRACTION
// ============================================

/**
 * Extract tables from PDF using AWS Textract
 * Returns structured table data with rows and columns
 */
export async function extractTablesWithTextract(
  pdfBuffer: Uint8Array
): Promise<TextractTable[]> {
  console.log('📄 Starting AWS Textract extraction...');
  
  // Get AWS credentials from environment
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const region = Deno.env.get('AWS_REGION') || 'us-east-1'; // Default to US East
  
  // Textract is only available in these regions
  const textractRegions = [
    'us-east-1', 'us-east-2', 'us-west-2',
    'ca-central-1',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
    'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-2'
  ];
  
  console.log('🔑 AWS Configuration CHECK:', {
    region,
    regionSupportsTextract: textractRegions.includes(region),
    hasAccessKey: !!accessKeyId,
    hasSecretKey: !!secretAccessKey,
    accessKeyPrefix: accessKeyId?.substring(0, 12),
    accessKeyLength: accessKeyId?.length,
    secretKeyLength: secretAccessKey?.length,
    allEnvVars: Object.keys(Deno.env.toObject()).filter(k => k.startsWith('AWS'))
  });
  
  if (!textractRegions.includes(region)) {
    throw new Error(
      `AWS Textract is not available in region "${region}". ` +
      `Please set AWS_REGION to one of: ${textractRegions.join(', ')}. ` +
      `Recommended: us-east-1, us-west-2, or eu-west-1`
    );
  }
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(`AWS credentials not found. Missing: ${!accessKeyId ? 'AWS_ACCESS_KEY_ID' : ''} ${!secretAccessKey ? 'AWS_SECRET_ACCESS_KEY' : ''}`);
  }
  
  // Validate access key format (should start with AKIA)
  if (!accessKeyId.startsWith('AKIA')) {
    throw new Error(`Invalid AWS_ACCESS_KEY_ID format. It should start with AKIA but starts with: ${accessKeyId.substring(0, 4)}`);
  }
  
  // Initialize Textract client with explicit credentials (no session token)
  const textractClient = new TextractClient({
    region,
    credentials: {
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
      // Do NOT include sessionToken - IAM users don't need it
    },
  });
  
  console.log('✅ Textract client initialized successfully');
  
  try {
    const startTime = Date.now();
    
    // Call Textract AnalyzeDocument API
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: pdfBuffer,
      },
      FeatureTypes: ['TABLES'], // We only need table extraction
    });
    
    console.log('🚀 Calling AWS Textract API...');
    const response = await textractClient.send(command);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Textract processing complete in ${elapsed}s`);
    
    if (!response.Blocks || response.Blocks.length === 0) {
      throw new Error('Textract returned no blocks. The PDF may be empty or unreadable.');
    }
    
    console.log(`📊 Textract returned ${response.Blocks.length} blocks`);
    
    // Parse the blocks into structured tables
    const tables = parseTextractTables(response.Blocks);
    
    console.log(`✅ Extracted ${tables.length} tables from document`);
    
    return tables;
    
  } catch (error) {
    console.error('❌ Textract extraction failed:', error);
    
    // Log detailed AWS error information
    if (error && typeof error === 'object') {
      console.error('❌ TEXTRACT DETAILED ERROR:', {
        name: (error as any).name,
        message: (error as any).message,
        code: (error as any).code,
        statusCode: (error as any).$metadata?.httpStatusCode,
        requestId: (error as any).$metadata?.requestId,
        fault: (error as any).$fault,
        retryable: (error as any).$retryable,
        fullMetadata: (error as any).$metadata,
      });
      
      // Special handling for SubscriptionRequiredException
      if ((error as any).name === 'SubscriptionRequiredException') {
        console.error('');
        console.error('🚨 AWS TEXTRACT NOT ACTIVATED ON YOUR ACCOUNT');
        console.error('');
        console.error('TO FIX THIS IMMEDIATELY:');
        console.error('1. Add payment method: https://console.aws.amazon.com/billing/home#/paymentmethods');
        console.error('2. Verify account: https://console.aws.amazon.com/billing/home#/account');
        console.error('3. Contact AWS Support for instant activation: https://console.aws.amazon.com/support/home');
        console.error('');
        
        throw new Error('AWS_TEXTRACT_NOT_ACTIVATED: Your AWS account needs a payment method and/or verification. Visit https://console.aws.amazon.com/billing/home#/paymentmethods to add a credit card, then wait 5-10 minutes or contact AWS Support for instant activation.');
      }
    }
    
    throw new Error(`Textract extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse Textract blocks into structured tables
 */
function parseTextractTables(blocks: Block[]): TextractTable[] {
  const tables: TextractTable[] = [];
  
  // Create a map of block IDs for quick lookup
  const blockMap = new Map<string, Block>();
  blocks.forEach(block => {
    if (block.Id) {
      blockMap.set(block.Id, block);
    }
  });
  
  // Find all TABLE blocks
  const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');
  
  console.log(`🔍 Found ${tableBlocks.length} table blocks`);
  
  for (const tableBlock of tableBlocks) {
    const cells: TextractTableCell[] = [];
    
    // Get all CELL blocks that belong to this table
    if (tableBlock.Relationships) {
      for (const relationship of tableBlock.Relationships) {
        if (relationship.Type === 'CHILD' && relationship.Ids) {
          for (const cellId of relationship.Ids) {
            const cellBlock = blockMap.get(cellId);
            
            if (cellBlock && cellBlock.BlockType === 'CELL') {
              // Extract cell text from WORD blocks
              let cellText = '';
              
              if (cellBlock.Relationships) {
                for (const cellRelationship of cellBlock.Relationships) {
                  if (cellRelationship.Type === 'CHILD' && cellRelationship.Ids) {
                    for (const wordId of cellRelationship.Ids) {
                      const wordBlock = blockMap.get(wordId);
                      if (wordBlock && wordBlock.BlockType === 'WORD' && wordBlock.Text) {
                        cellText += (cellText ? ' ' : '') + wordBlock.Text;
                      }
                    }
                  }
                }
              }
              
              cells.push({
                rowIndex: (cellBlock.RowIndex || 1) - 1, // Convert to 0-based
                columnIndex: (cellBlock.ColumnIndex || 1) - 1, // Convert to 0-based
                text: cellText.trim(),
                confidence: cellBlock.Confidence || 0,
              });
            }
          }
        }
      }
    }
    
    // Convert cells into a 2D array (rows and columns)
    if (cells.length > 0) {
      const maxRow = Math.max(...cells.map(c => c.rowIndex));
      const maxCol = Math.max(...cells.map(c => c.columnIndex));
      
      const rows: string[][] = [];
      for (let r = 0; r <= maxRow; r++) {
        const row: string[] = [];
        for (let c = 0; c <= maxCol; c++) {
          const cell = cells.find(cell => cell.rowIndex === r && cell.columnIndex === c);
          row.push(cell ? cell.text : '');
        }
        rows.push(row);
      }
      
      const avgConfidence = cells.reduce((sum, c) => sum + c.confidence, 0) / cells.length;
      
      tables.push({
        rows,
        confidence: avgConfidence,
      });
      
      console.log(`📋 Table ${tables.length}: ${rows.length} rows × ${rows[0]?.length || 0} columns (confidence: ${avgConfidence.toFixed(1)}%)`);
    }
  }
  
  return tables;
}

// ============================================
// STEP 2: GPT-4 MINI CONVERSION
// ============================================

/**
 * Convert Textract tables to structured transactions using GPT-4 mini
 * This is MUCH faster than GPT-4o because Textract already did the heavy lifting
 */
export async function convertTablesToTransactions(
  tables: TextractTable[]
): Promise<BankTransaction[]> {
  console.log('🤖 Converting tables to transactions with GPT-4 mini...');
  
  if (tables.length === 0) {
    throw new Error('No tables found in document');
  }
  
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }
  
  // Prepare the table data as text for GPT
  const tableText = tables.map((table, idx) => {
    return `TABLE ${idx + 1}:\n${table.rows.map(row => row.join(' | ')).join('\n')}`;
  }).join('\n\n');
  
  const prompt = `You are a bank statement parser. Extract ALL transactions from the table(s) below.

TABLES FROM BANK STATEMENT:
${tableText}

**CURRENCY DETECTION - ABSOLUTELY CRITICAL:**
1. Look for currency codes AFTER amounts (European format): "25.00 EUR", "100 GBP", "5000 JPY"
2. Look for currency codes BEFORE amounts (US format): "USD 25.00", "$25.00"
3. Look for currency in COLUMN HEADERS (e.g., "Amount EUR", "Balance (GBP)")
4. Look for currency in STATEMENT HEADERS or metadata rows (e.g., "Currency: EUR", "Account in GBP")
5. Common currency codes: USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, MXN, SGD, HKD, NZD, SEK, NOK, DKK, PLN, CZK, HUF, RON, BGN, TRY, ZAR, BRL, ARS, CLP, COP, PEN
6. Look for currency symbols: $, €, £, ¥, ₹, ₱, ₩, ₪, ₫, ₴, ₺, ₽, ₦, ₡
7. **CRITICAL**: Do NOT default to USD - extract the ACTUAL currency from the document
8. If all transactions show "EUR" after amounts, set default_currency to "EUR"
9. If all transactions show "GBP" after amounts, set default_currency to "GBP"

EXTRACTION INSTRUCTIONS:
1. Identify which columns contain: date, description, amount, balance, and currency
2. Extract EVERY transaction row (skip headers and footers)
3. For amounts:
   - Negative amounts or amounts in "Debit" column should be negative numbers
   - Positive amounts or amounts in "Credit" column should be positive numbers
   - Parse EU format (1.234,56) and US format (1,234.56) correctly
4. Date format: Convert to YYYY-MM-DD (e.g., "31.10.2025" → "2025-10-31")
5. Return ONLY valid JSON, nothing else

REQUIRED JSON SCHEMA:
{
  "default_currency": "EUR" (CRITICAL: Extract from amounts like "25.00 EUR", "100 GBP", etc. - do NOT default to USD),
  "transactions": [
    {
      "date": "2025-10-31",
      "description": "GetYourGuide BERLIN, DE",
      "amount": -25.00,
      "balance": 585.51,
      "type": "debit" | "credit" (optional),
      "currency": "EUR" (optional - only if different from default_currency)
    }
  ]
}`;

  try {
    const startTime = Date.now();
    
    console.log('📡 Calling GPT-4o API for table conversion...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using GPT-4o for reliable extraction
        messages: [{
          role: 'system',
          content: 'You are a bank statement parser. You MUST ALWAYS include the "default_currency" field in your JSON response. Extract the ACTUAL currency from the statement (EUR, GBP, JPY, etc.) - NEVER default to USD unless the statement is clearly in USD.'
        }, {
          role: 'user',
          content: prompt,
        }],
        response_format: { type: 'json_object' }, // Force JSON output
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 8000, // Enough for ~200 transactions
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const content = result.choices[0].message.content;
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ GPT-4 mini processing complete in ${elapsed}s`);
    
    // Parse the JSON response
    const parsed = JSON.parse(content);
    const transactions = parsed.transactions || [];
    const defaultCurrency = parsed.default_currency || 'USD';
    
    // Apply default currency to transactions that don't have one
    const transactionsWithCurrency = transactions.map((txn: BankTransaction) => ({
      ...txn,
      currency: txn.currency || defaultCurrency
    }));
    
    console.log(`✅ Extracted ${transactionsWithCurrency.length} transactions`);
    console.log(`💱 Default currency: ${defaultCurrency}`);
    
    return transactionsWithCurrency;
    
  } catch (error) {
    console.error('❌ GPT-4 mini conversion failed:', error);
    throw new Error(`GPT-4 mini conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// STEP 3: VALIDATION
// ============================================

/**
 * Validate extracted transactions
 */
export function validateTransactions(transactions: BankTransaction[]): {
  valid: boolean;
  confidence: number;
  checks: { name: string; passed: boolean; message: string }[];
} {
  console.log('🔍 Validating extracted transactions...');
  
  const checks: { name: string; passed: boolean; message: string }[] = [];
  
  if (transactions.length === 0) {
    return {
      valid: false,
      confidence: 0,
      checks: [{ name: 'has_transactions', passed: false, message: 'No transactions extracted' }],
    };
  }
  
  // Check 1: All transactions have required fields
  const hasRequiredFields = transactions.every(t => 
    t.date && t.description && t.amount !== undefined
  );
  checks.push({
    name: 'required_fields',
    passed: hasRequiredFields,
    message: hasRequiredFields ? 'All transactions have required fields' : 'Some transactions missing required fields',
  });
  
  // Check 2: Dates are valid
  const validDates = transactions.filter(t => {
    const date = new Date(t.date);
    return !isNaN(date.getTime());
  }).length;
  const dateValidityRate = validDates / transactions.length;
  checks.push({
    name: 'valid_dates',
    passed: dateValidityRate > 0.95,
    message: `${(dateValidityRate * 100).toFixed(0)}% of dates are valid`,
  });
  
  // Check 3: Amounts are reasonable
  const amounts = transactions.map(t => Math.abs(t.amount));
  const uniqueAmounts = new Set(amounts).size;
  const amountsAreReasonable = uniqueAmounts > Math.min(5, transactions.length * 0.3);
  checks.push({
    name: 'reasonable_amounts',
    passed: amountsAreReasonable,
    message: `${uniqueAmounts} unique amounts found`,
  });
  
  // Check 4: Balance math (if balances present)
  const txnsWithBalance = transactions.filter(t => t.balance !== undefined);
  let balanceMathValid = true;
  
  if (txnsWithBalance.length > 1) {
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
    
    balanceMathValid = mathErrors < txnsWithBalance.length * 0.2;
  }
  
  checks.push({
    name: 'balance_math',
    passed: balanceMathValid,
    message: balanceMathValid ? 'Balance math is correct' : 'Balance math has errors',
  });
  
  const passedCount = checks.filter(c => c.passed).length;
  const confidence = passedCount / checks.length;
  const valid = confidence >= 0.75;
  
  console.log(`📊 Validation: ${passedCount}/${checks.length} checks passed (${(confidence * 100).toFixed(0)}% confidence)`);
  
  return {
    valid,
    confidence,
    checks,
  };
}

// ============================================
// MAIN EXPORT: TEXTRACT + GPT PIPELINE
// ============================================

/**
 * Main function: Extract transactions using AWS Textract + GPT-4 mini
 * Expected time: 5-8 seconds (vs 40+ seconds with GPT-4o Vision)
 */
export async function extractTransactionsWithTextract(
  pdfBuffer: Uint8Array,
  fileName: string
): Promise<BankTransaction[]> {
  console.log('🚀 TEXTRACT + GPT-4 MINI PIPELINE');
  console.log(`📄 Processing: ${fileName} (${pdfBuffer.length} bytes)`);
  
  const startTime = Date.now();
  
  try {
    // Step 1: Extract tables with Textract (3-5 seconds)
    console.log('\n📍 STEP 1: AWS Textract Table Extraction');
    const tables = await extractTablesWithTextract(pdfBuffer);
    
    // Step 2: Convert to transactions with GPT-4 mini (2-3 seconds)
    console.log('\n📍 STEP 2: GPT-4 Mini Conversion');
    const transactions = await convertTablesToTransactions(tables);
    
    // Step 3: Validate
    console.log('\n📍 STEP 3: Validation');
    const validation = validateTransactions(transactions);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ TEXTRACT + GPT PIPELINE COMPLETE in ${elapsed}s`);
    console.log(`📊 Extracted ${transactions.length} transactions`);
    console.log(`🎯 Confidence: ${(validation.confidence * 100).toFixed(0)}%`);
    console.log(`📋 Validation checks:`);
    validation.checks.forEach(check => {
      console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}: ${check.message}`);
    });
    
    if (!validation.valid) {
      console.warn('⚠️ Validation failed - extraction may be inaccurate');
    }
    
    return transactions;
    
  } catch (error) {
    console.error('❌ Textract + GPT pipeline failed:', error);
    throw new Error(`Textract + GPT pipeline failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}