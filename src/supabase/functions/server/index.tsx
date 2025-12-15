import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as XLSX from "npm:xlsx";
import * as kv from "./kv_store.tsx";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import routes from "./routes.tsx";
import monthEndCloseRoutes from "./month-end-close-routes.tsx";
import authRoutes from "./auth-routes.tsx";
import bankRecRoutes from "./bank-rec-routes.tsx";
import apRecRoutes from "./ap-rec-routes.tsx";
import arRecRoutes from "./ar-rec-routes.tsx";
import journalEntriesRoutes from "./journal-entries-routes.tsx";
import receiptRoutes from "./receipt-routes.tsx";
import ccRecRoutes from "./cc-rec-routes.tsx";
import trialBalanceRoutes from "./trial-balance-routes.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// Health check endpoint
app.get("/make-server-53c2e113/health", (c) => {
  return c.json({ status: "ok" });
});

// Mount API routes for DevPortal LAST to avoid conflicts
// app.route('/make-server-53c2e113', routes);

// ============================================================================
// EXACT MATCHING HELPER FUNCTIONS FOR HYBRID RECONCILIATION
// ============================================================================

/**
 * Exact matching for Bank Reconciliation
 * Returns { exactMatches, unmatchedBank, unmatchedLedger }
 */
function performExactBankMatching(bankTransactions: any[], ledgerEntries: any[]) {
  const startTime = Date.now();
  console.log(`🎯 EXACT MATCHING: ${bankTransactions.length} bank × ${ledgerEntries.length} ledger...`);
  
  const exactMatches: any[] = [];
  const unmatchedBank: any[] = [];
  const matchedLedgerIndices = new Set<number>();
  
  // Create hash map for O(1) amount lookups instead of O(n)
  const ledgerByAmount = new Map<number, number[]>();
  ledgerEntries.forEach((entry, idx) => {
    const roundedAmount = Math.round(entry.amount * 100) / 100;
    if (!ledgerByAmount.has(roundedAmount)) {
      ledgerByAmount.set(roundedAmount, []);
    }
    ledgerByAmount.get(roundedAmount)!.push(idx);
  });
  
  // For each bank transaction, try to find exact match in ledger
  for (const bankTxn of bankTransactions) {
    let matched = false;
    const roundedBankAmount = Math.round(bankTxn.amount * 100) / 100;
    
    // Only check ledger entries with matching amounts (MUCH faster - O(1) instead of O(n))
    const candidateIndices = ledgerByAmount.get(roundedBankAmount) || [];
    
    for (const i of candidateIndices) {
      if (matchedLedgerIndices.has(i)) continue; // Skip already matched ledger entries
      
      const ledgerEntry = ledgerEntries[i];
      
      // Check if amounts match (within ±0.01 tolerance)
      const amountDiff = Math.abs(bankTxn.amount - ledgerEntry.amount);
      if (amountDiff > 0.01) continue;
      
      // Check if dates are within 3 days
      const bankDate = new Date(bankTxn.date);
      const ledgerDate = new Date(ledgerEntry.date);
      const daysDiff = Math.abs((bankDate.getTime() - ledgerDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 3) continue;
      
      // Found exact match!
      exactMatches.push({
        bank_transaction: {
          date: bankTxn.date,
          description: bankTxn.description,
          amount: bankTxn.amount
        },
        ledger_entries: [{
          date: ledgerEntry.date,
          description: ledgerEntry.description,
          amount: ledgerEntry.amount
        }],
        match_confidence: 1.0,
        match_type: 'exact',
        explanation: `Exact match: Same amount (${bankTxn.amount.toFixed(2)}), dates within 3 days`
      });
      
      matchedLedgerIndices.add(i);
      matched = true;
      break; // Move to next bank transaction
    }
    
    if (!matched) {
      unmatchedBank.push(bankTxn);
    }
  }
  
  // Collect unmatched ledger entries
  const unmatchedLedger = ledgerEntries.filter((_, idx) => !matchedLedgerIndices.has(idx));
  
  const elapsedMs = Date.now() - startTime;
  console.log(`✅ EXACT MATCHING DONE in ${elapsedMs}ms: ${exactMatches.length} matched, ${unmatchedBank.length} unmatched bank, ${unmatchedLedger.length} unmatched ledger`);
  
  return { exactMatches, unmatchedBank, unmatchedLedger };
}

/**
 * 🎯 RULE-BASED SUM DETECTION for Bank Reconciliation
 * Detects one-to-many and many-to-one grouped transactions
 * Returns { groupedMatches, unmatchedBank, unmatchedLedger }
 */
function performSumBasedMatching(
  bankTransactions: any[], 
  ledgerEntries: any[],
  maxGroupSize: number = 5,
  dateTolerance: number = 7,
  amountTolerance: number = 0.02
) {
  const startTime = Date.now();
  console.log(`🧮 SUM-BASED MATCHING: ${bankTransactions.length} bank × ${ledgerEntries.length} ledger...`);
  console.log(`   Config: maxGroupSize=${maxGroupSize}, dateTolerance=${dateTolerance} days, amountTolerance=€${amountTolerance}`);
  
  const groupedMatches: any[] = [];
  const matchedBankIndices = new Set<number>();
  const matchedLedgerIndices = new Set<number>();
  
  // Helper: Calculate days difference
  const daysBetween = (date1Str: string, date2Str: string): number => {
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    return Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
  };
  
  // Helper: Check if same direction (both positive or both negative)
  const sameDirection = (amt1: number, amt2: number): boolean => {
    return (amt1 > 0 && amt2 > 0) || (amt1 < 0 && amt2 < 0);
  };
  
  // Helper: Find combinations that sum to target
  const findSummingCombinations = (
    candidates: any[], 
    targetAmount: number, 
    minSize: number = 2, 
    maxSize: number = 5
  ): number[][] => {
    const results: number[][] = [];
    const tolerance = Math.abs(targetAmount) * 0.001 + amountTolerance; // 0.1% + fixed tolerance
    
    const backtrack = (start: number, currentCombo: number[], currentSum: number) => {
      // Check if we have a valid sum match
      if (currentCombo.length >= minSize && currentCombo.length <= maxSize) {
        const diff = Math.abs(currentSum - targetAmount);
        if (diff <= tolerance) {
          results.push([...currentCombo]);
          return; // Found one, stop exploring this branch
        }
      }
      
      // Prune: if we've reached max size, stop
      if (currentCombo.length >= maxSize) return;
      
      // Prune: if current sum already exceeds target by too much
      const overshoot = Math.abs(currentSum) - Math.abs(targetAmount);
      if (overshoot > tolerance * 2) return;
      
      // Try adding each remaining candidate
      for (let i = start; i < candidates.length; i++) {
        currentCombo.push(i);
        backtrack(i + 1, currentCombo, currentSum + candidates[i].amount);
        currentCombo.pop();
      }
    };
    
    backtrack(0, [], 0);
    return results;
  };
  
  // 🔹 PHASE 1: ONE-TO-MANY (One bank transaction → Multiple ledger entries)
  console.log(`   Phase 1: ONE-TO-MANY matching...`);
  let oneToManyCount = 0;
  
  for (let bankIdx = 0; bankIdx < bankTransactions.length; bankIdx++) {
    if (matchedBankIndices.has(bankIdx)) continue;
    
    const bankTxn = bankTransactions[bankIdx];
    
    // Filter ledger candidates: within date range, similar magnitude, same direction, not yet matched
    const candidates = ledgerEntries
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry, idx }) => {
        if (matchedLedgerIndices.has(idx)) return false;
        if (!sameDirection(bankTxn.amount, entry.amount)) return false;
        if (daysBetween(bankTxn.date, entry.date) > dateTolerance) return false;
        if (Math.abs(entry.amount) > Math.abs(bankTxn.amount) * 1.1) return false; // Ledger item can't be larger than bank
        return true;
      });
    
    if (candidates.length < 2) continue; // Need at least 2 ledger entries to group
    
    // Find combinations that sum to bank amount
    const combos = findSummingCombinations(
      candidates.map(c => c.entry),
      bankTxn.amount,
      2,
      Math.min(maxGroupSize, candidates.length)
    );
    
    if (combos.length > 0) {
      // Use first valid combination
      const combo = combos[0];
      const matchedLedgerEntries = combo.map(i => candidates[i].entry);
      const matchedLedgerIndicesInCombo = combo.map(i => candidates[i].idx);
      const sumAmount = matchedLedgerEntries.reduce((sum, e) => sum + e.amount, 0);
      
      groupedMatches.push({
        bank_transaction: {
          date: bankTxn.date,
          description: bankTxn.description,
          amount: bankTxn.amount
        },
        ledger_entries: matchedLedgerEntries.map(e => ({
          date: e.date,
          description: e.description,
          amount: e.amount
        })),
        match_confidence: 0.98,
        match_type: 'grouped_one_to_many',
        explanation: `One bank transaction (€${bankTxn.amount.toFixed(2)}) matches ${matchedLedgerEntries.length} ledger entries totaling €${sumAmount.toFixed(2)}`
      });
      
      matchedBankIndices.add(bankIdx);
      matchedLedgerIndicesInCombo.forEach(idx => matchedLedgerIndices.add(idx));
      oneToManyCount++;
    }
  }
  
  console.log(`   ✅ Phase 1 complete: ${oneToManyCount} one-to-many matches found`);
  
  // 🔹 PHASE 2: MANY-TO-ONE (Multiple bank transactions → One ledger entry)
  console.log(`   Phase 2: MANY-TO-ONE matching...`);
  let manyToOneCount = 0;
  
  for (let ledgerIdx = 0; ledgerIdx < ledgerEntries.length; ledgerIdx++) {
    if (matchedLedgerIndices.has(ledgerIdx)) continue;
    
    const ledgerEntry = ledgerEntries[ledgerIdx];
    
    // Filter bank candidates: within date range, similar magnitude, same direction, not yet matched
    const candidates = bankTransactions
      .map((txn, idx) => ({ txn, idx }))
      .filter(({ txn, idx }) => {
        if (matchedBankIndices.has(idx)) return false;
        if (!sameDirection(ledgerEntry.amount, txn.amount)) return false;
        if (daysBetween(ledgerEntry.date, txn.date) > dateTolerance) return false;
        if (Math.abs(txn.amount) > Math.abs(ledgerEntry.amount) * 1.1) return false; // Bank item can't be larger than ledger
        return true;
      });
    
    if (candidates.length < 2) continue; // Need at least 2 bank transactions to group
    
    // Find combinations that sum to ledger amount
    const combos = findSummingCombinations(
      candidates.map(c => c.txn),
      ledgerEntry.amount,
      2,
      Math.min(maxGroupSize, candidates.length)
    );
    
    if (combos.length > 0) {
      // Use first valid combination
      const combo = combos[0];
      const matchedBankTxns = combo.map(i => candidates[i].txn);
      const matchedBankIndicesInCombo = combo.map(i => candidates[i].idx);
      const sumAmount = matchedBankTxns.reduce((sum, t) => sum + t.amount, 0);
      
      // For many-to-one, we need to create multiple match records (one per bank transaction)
      // But they all reference the same ledger entry
      for (let i = 0; i < matchedBankTxns.length; i++) {
        groupedMatches.push({
          bank_transaction: {
            date: matchedBankTxns[i].date,
            description: matchedBankTxns[i].description,
            amount: matchedBankTxns[i].amount
          },
          ledger_entries: [{
            date: ledgerEntry.date,
            description: ledgerEntry.description,
            amount: ledgerEntry.amount
          }],
          match_confidence: 0.97,
          match_type: 'grouped_many_to_one',
          explanation: `Part ${i+1}/${matchedBankTxns.length} of grouped payment: ${matchedBankTxns.length} bank transactions (total €${sumAmount.toFixed(2)}) match one ledger entry (€${ledgerEntry.amount.toFixed(2)})`
        });
        
        matchedBankIndices.add(matchedBankIndicesInCombo[i]);
      }
      
      matchedLedgerIndices.add(ledgerIdx);
      manyToOneCount++;
    }
  }
  
  console.log(`   ✅ Phase 2 complete: ${manyToOneCount} many-to-one matches found`);
  
  // Collect unmatched items
  const unmatchedBank = bankTransactions.filter((_, idx) => !matchedBankIndices.has(idx));
  const unmatchedLedger = ledgerEntries.filter((_, idx) => !matchedLedgerIndices.has(idx));
  
  const elapsedMs = Date.now() - startTime;
  console.log(`✅ SUM-BASED MATCHING DONE in ${elapsedMs}ms: ${groupedMatches.length} grouped matches (${oneToManyCount} one-to-many + ${manyToOneCount} many-to-one), ${unmatchedBank.length} unmatched bank, ${unmatchedLedger.length} unmatched ledger`);
  
  return { groupedMatches, unmatchedBank, unmatchedLedger };
}

/**
 * Exact matching for AP Reconciliation
 * Returns { exactMatches, amountMismatches, unmatchedVendor, unmatchedInternal }
 */
function performExactAPMatching(vendorInvoices: any[], apEntries: any[]) {
  console.log('🎯 Starting exact AP matching phase...');
  
  const exactMatches: any[] = [];
  const amountMismatches: any[] = [];
  const matchedVendorIndices = new Set<number>();
  const matchedInternalIndices = new Set<number>();
  
  // Create a map for quick lookup by invoice number
  const internalByInvoice = new Map<string, number[]>();
  apEntries.forEach((entry, idx) => {
    const invoiceNum = entry.invoice_number.toLowerCase().trim();
    if (!internalByInvoice.has(invoiceNum)) {
      internalByInvoice.set(invoiceNum, []);
    }
    internalByInvoice.get(invoiceNum)!.push(idx);
  });
  
  // Match vendor invoices with internal entries
  for (let vendorIdx = 0; vendorIdx < vendorInvoices.length; vendorIdx++) {
    const vendorInv = vendorInvoices[vendorIdx];
    const invoiceNum = vendorInv.invoice_number.toLowerCase().trim();
    
    if (!invoiceNum) continue;
    
    const internalIndices = internalByInvoice.get(invoiceNum);
    if (!internalIndices || internalIndices.length === 0) continue;
    
    // Use first unmatched internal entry for this invoice number
    const internalIdx = internalIndices.find(idx => !matchedInternalIndices.has(idx));
    if (internalIdx === undefined) continue;
    
    const internalEntry = apEntries[internalIdx];
    
    // Check if amounts match (within ±0.01 tolerance)
    const amountDiff = Math.abs(vendorInv.amount - internalEntry.amount);
    
    if (amountDiff <= 0.01) {
      // Exact match!
      exactMatches.push({
        vendor_invoice: vendorInv,
        internal_entry: internalEntry,
        match_type: 'exact'
      });
      matchedVendorIndices.add(vendorIdx);
      matchedInternalIndices.add(internalIdx);
    } else {
      // Amount mismatch
      amountMismatches.push({
        invoice_number: vendorInv.invoice_number,
        vendor_amount: vendorInv.amount,
        internal_amount: internalEntry.amount,
        difference: vendorInv.amount - internalEntry.amount,
        notes: `Amount difference of ${Math.abs(amountDiff).toFixed(2)} - Investigate discrepancy`
      });
      matchedVendorIndices.add(vendorIdx);
      matchedInternalIndices.add(internalIdx);
    }
  }
  
  // Collect unmatched
  const unmatchedVendor = vendorInvoices.filter((_, idx) => !matchedVendorIndices.has(idx));
  const unmatchedInternal = apEntries.filter((_, idx) => !matchedInternalIndices.has(idx));
  
  console.log(`✅ Exact AP matching complete: ${exactMatches.length} exact matches, ${amountMismatches.length} amount mismatches, ${unmatchedVendor.length} unmatched vendor, ${unmatchedInternal.length} unmatched internal`);
  
  return { exactMatches, amountMismatches, unmatchedVendor, unmatchedInternal };
}

/**
 * Batch array into chunks of specified size
 */
function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// ============================================================================
// END OF HELPER FUNCTIONS
// ============================================================================

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
  **Common errors: Missing marketable securities, wrong "other assets" values**
- Depreciation & Amortization: ALWAYS check Cash Flow Statement "Operating Activities" - it's ALWAYS there as an add-back to net income. Also check income statement.
- Stock-Based Compensation: Check Cash Flow Statement "Operating Activities" (usually an add-back), OR check footnotes/supplementary data for total stock compensation expense

🗓️ MULTI-YEAR DATA EXTRACTION:
- 10-K filings contain 3 years of Income Statement data and 2 years of Balance Sheet data
- You MUST extract ALL available years and return them as arrays
- Array format: [oldest_year, middle_year, most_recent_year] - always 3 elements
- Example: If most recent fiscal year is 2018, extract: [2016, 2017, 2018]

**IMPORTANT ARRAY RULES:**
- Income Statement & Cash Flow fields: Extract all 3 years → [2016_value, 2017_value, 2018_value]
- Balance Sheet fields: Extract 2 available years, pad oldest with 0 → [0, 2017_value, 2018_value]
- Fiscal years array: Return the 3 years → [2016, 2017, 2018]
- ALL numeric fields must be arrays with exactly 3 elements

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
- depreciation_amortization: **REQUIRED** - ALWAYS check Cash Flow Statement Operating Activities for ALL 3 YEARS! Look for "Depreciation and amortization" add-back to net income. (array of 3 numbers)
- stock_based_compensation: **REQUIRED** - Check Cash Flow Statement Operating Activities for ALL 3 YEARS for "Stock-based compensation" or "Share-based compensation" add-back. (array of 3 numbers)

Other P&L Items (extract 3 years):
- interest_income: Interest/investment income (array of 3 numbers)
- interest_expense: Interest expense/debt interest (array of 3 numbers)
- other_income_expense: Other/miscellaneous income (array of 3 numbers, negative for expense)
- income_tax_expense: Income tax/provision for taxes (array of 3 numbers)

Balance Sheet - Assets (extract 2 years, pad oldest with 0):
⚠️ Balance sheets show only 2 years. Extract [0, year2_value, year3_value] for all balance sheet fields.

**CRITICAL LIQUID ASSETS EXTRACTION:**
- cash_and_equivalents: This is THE MOST IMPORTANT line item. You MUST find and sum ALL of these FOR BOTH YEARS:
  1. "Cash and cash equivalents" (always present in current assets)
  2. "Short-term marketable securities" or "Marketable securities - current" (in current assets section)
  3. "Long-term marketable securities" or "Marketable securities - non-current" (in non-current assets section)
  
  COMMON ERROR: Do NOT only use "Cash and cash equivalents" alone. Many companies (especially tech) have HUGE marketable securities positions that are separate line items. You MUST add them all together.
  
  VERIFICATION: For tech companies like Apple, this number should often be $200B+ not $60B. Double-check you found ALL marketable securities.

**OTHER CURRENT ASSETS (extract 2 years, pad with 0):**
- accounts_receivable: "Accounts receivable" or "Trade accounts receivable, net" (after allowances). Array of 3: [0, year2_value, year3_value]
- inventories: "Inventories" (raw materials, work in progress, finished goods). Array of 3: [0, year2_value, year3_value]
- other_current_assets: Look for the SPECIFIC line item labeled "Other current assets" on the balance sheet. Array of 3: [0, year2_value, year3_value] 
  * This is NOT a calculation - it's an actual line item
  * Common range: $10B-$50B for large companies
  * DO NOT accidentally put Property/Plant/Equipment here
  * DO NOT put non-current items here

**NON-CURRENT ASSETS (extract 2 years, pad with 0):**
- property_plant_equipment: "Property, plant and equipment, net" or "Property and equipment, net" (after depreciation). Array of 3: [0, year2_value, year3_value]

- other_noncurrent_assets: **BE VERY CAREFUL HERE** - Sum ONLY these non-current items FOR BOTH YEARS. Array of 3: [0, year2_value, year3_value]
  * "Goodwill" (if present)
  * "Intangible assets, net" or "Acquired intangible assets, net"
  * "Deferred tax assets" - non-current portion
  * "Other non-current assets" - the specific line item
  * Any other non-current assets NOT already captured above
  
  **CRITICAL ERROR TO AVOID:** Do NOT double-count items. Do NOT put current assets here. Do NOT put Property/Plant/Equipment here (it has its own field).
  
  VERIFICATION: For tech companies, this is typically $10B-$30B, NOT $100B+. If you get a huge number, you likely double-counted marketable securities or other items.

CALCULATION CHECK: Total Current Assets = cash_and_equivalents + accounts_receivable + inventories + other_current_assets
CALCULATION CHECK: Total Assets = Total Current Assets + property_plant_equipment + other_noncurrent_assets
**IF THESE DON'T MATCH THE BALANCE SHEET TOTALS, YOU MADE AN ERROR - GO BACK AND FIX IT**

Balance Sheet - Liabilities (extract 2 years, pad with 0):
- accounts_payable: "Accounts payable" or "Trade accounts payable". Array of 3: [0, year2_value, year3_value]
- other_current_liabilities: "Other current liabilities" or "Accrued liabilities" or "Accrued expenses" - the specific line item, NOT a sum. Array of 3: [0, year2_value, year3_value]
- deferred_revenue: "Deferred revenue" or "Unearned revenue" (combine current + non-current portions). Array of 3: [0, year2_value, year3_value]
- short_term_debt: "Commercial paper" + "Short-term debt" + "Current portion of long-term debt" (if shown separately). Array of 3: [0, year2_value, year3_value]
- long_term_debt: "Long-term debt" or "Term debt" - this should INCLUDE current portion for total debt calculation. Array of 3: [0, year2_value, year3_value]
- other_noncurrent_liabilities: Sum of other non-current liabilities like deferred tax liabilities, pension obligations, etc. Array of 3: [0, year2_value, year3_value]

CALCULATION CHECK: Total Current Liabilities = accounts_payable + other_current_liabilities + deferred_revenue + short_term_debt
CALCULATION CHECK: Total Liabilities = Total Current Liabilities + long_term_debt + other_noncurrent_liabilities

Balance Sheet - Equity (extract 2 years, pad with 0):
- common_stock: "Common stock" + "Additional paid-in capital" (combine these two). Array of 3: [0, year2_value, year3_value]
- retained_earnings: "Retained earnings" (can be negative if accumulated deficit). Array of 3: [0, year2_value, year3_value]
- other_equity: "Accumulated other comprehensive income (loss)" + any other equity items like treasury stock. Array of 3: [0, year2_value, year3_value]

CALCULATION CHECK: Total Equity = common_stock + retained_earnings + other_equity
FINAL CHECK: Total Assets MUST EQUAL Total Liabilities + Total Equity

WHERE TO LOOK:
📊 Income Statement (Consolidated Statement of Operations): revenue, COGS, opex categories, interest, taxes
📋 Balance Sheet (Consolidated Balance Sheet / Statement of Financial Position): ALL asset, liability, and equity line items
💰 Cash Flow Statement (Operating Activities): D&A (always present), stock comp (usually present)
📝 Footnotes: Stock comp details, segment breakdowns, debt details

BALANCE SHEET EXTRACTION RULES:
1. Find the "Consolidated Balance Sheet" or "Statement of Financial Position" section
2. Balance sheets show 2 years - extract BOTH years (usually the two rightmost columns)
3. Return as 3-element arrays: [0, older_year_value, most_recent_year_value]
4. Extract EXACT line items as they appear - don't make up categories
4. For "other_current_assets" and "other_current_liabilities" - these are specific line items on the balance sheet, NOT your calculations
5. For "other_noncurrent_assets" - sum ONLY non-current items not already captured (Goodwill + Intangibles + Deferred tax assets + Other non-current assets line item)
6. **MANDATORY VERIFICATION STEP:** After extraction, VERIFY your totals match the 10-K:
   - Does Total Current Assets = sum of the 4 current asset fields you extracted?
   - Does Total Assets = Total Current Assets + PPE + Other Non-Current Assets?
   - If NO, you made an error. Common errors:
     * Missing marketable securities in cash_and_equivalents
     * Double-counting items in other_noncurrent_assets
     * Wrong "Other current assets" value
   - GO BACK and re-extract until totals match the 10-K exactly

COMPANY-SPECIFIC GUIDANCE:
- Tech (Apple, Microsoft): 
  * High R&D, high stock comp, high intangibles
  * **CRITICAL FOR APPLE:** Balance sheet shows 3 separate lines for liquid assets:
    1. "Cash and cash equivalents" (~$25B)
    2. "Marketable securities" in current assets (~$40B)  
    3. "Marketable securities" in non-current assets (~$170B)
    YOU MUST SUM ALL THREE for cash_and_equivalents field (~$237B total)
  * "Other current assets" for Apple is typically ~$12-40B (specific line item)
  * "Other non-current assets" for Apple is typically ~$20-30B (NOT $190B - that would mean you included marketable securities which is wrong)
- Consumer (Coca-Cola, Pepsi): Marketing-heavy, less stock comp, high inventories  
- All companies: D&A is ALWAYS in cash flow statement, balance sheet must balance

🔍 FINAL VERIFICATION CHECKLIST (complete BEFORE returning JSON):
1. ✓ Did I extract 3 years of income statement data? (all income statement fields should be 3-element arrays)
2. ✓ Did I extract 2 years of balance sheet data with 0 padding? (all balance sheet fields should be [0, year2, year3])
3. ✓ Did I find and sum ALL marketable securities (current + non-current) in cash_and_equivalents FOR BOTH YEARS?
4. ✓ Does my "Total Current Assets" calculation match the 10-K's stated Total Current Assets FOR BOTH YEARS?
5. ✓ Does my "Total Assets" calculation match the 10-K's stated Total Assets FOR BOTH YEARS?
6. ✓ Is my "other_noncurrent_assets" reasonable (typically $20-40B for large tech, NOT $150B+)?
7. ✓ Did I extract "Other current assets" from the actual line item on the balance sheet?

❌ If ANY check fails, DO NOT return the JSON yet - go back and fix the errors first.

Return format (ALL numeric fields are arrays with 3 elements):
{
  "company_name": "string",
  "fiscal_years": [number, number, number],  // Example: [2016, 2017, 2018]
  "company_type": "string",
  
  // Income Statement & Cash Flow (3 years of data)
  "revenue": [number, number, number],
  "cost_of_sales": [number, number, number],
  "research_and_development": [number, number, number],
  "sales_and_marketing": [number, number, number],
  "selling_general_admin": [number, number, number],
  "other_operating_expenses": [number, number, number],
  "depreciation_amortization": [number, number, number],
  "interest_income": [number, number, number],
  "interest_expense": [number, number, number],
  "other_income_expense": [number, number, number],
  "income_tax_expense": [number, number, number],
  "stock_based_compensation": [number, number, number],
  
  // Balance Sheet (2 years padded with 0 for oldest)
  "cash_and_equivalents": [0, number, number],
  "accounts_receivable": [0, number, number],
  "inventories": [0, number, number],
  "other_current_assets": [0, number, number],
  "property_plant_equipment": [0, number, number],
  "other_noncurrent_assets": [0, number, number],
  "accounts_payable": [0, number, number],
  "other_current_liabilities": [0, number, number],
  "deferred_revenue": [0, number, number],
  "short_term_debt": [0, number, number],
  "long_term_debt": [0, number, number],
  "other_noncurrent_liabilities": [0, number, number],
  "common_stock": [0, number, number],
  "retained_earnings": [0, number, number],
  "other_equity": [0, number, number]
}

Example with real data:
{
  "company_name": "Apple Inc.",
  "fiscal_years": [2016, 2017, 2018],
  "company_type": "technology",
  "revenue": [215639, 229234, 265595],
  "cash_and_equivalents": [0, 268895, 237100],  // Only 2 years available on balance sheet
  ...
}

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
      console.error('❌ OpenAI API Error Status:', openAIResponse.status);
      console.error('❌ OpenAI API Error Response:', errorText);
      
      let errorMessage = 'Failed to process document with OpenAI';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      
      return c.json({ 
        error: 'Failed to process document with OpenAI', 
        details: errorMessage,
        status: openAIResponse.status 
      }, 500);
    }

    const openAIData = await openAIResponse.json();
    console.log('📥 OpenAI full response:', JSON.stringify(openAIData, null, 2));
    
    const gptResponse = openAIData.choices?.[0]?.message?.content;
    
    if (!gptResponse) {
      console.error('❌ No response from OpenAI:', openAIData);
      return c.json({ 
        error: 'OpenAI returned no content', 
        details: JSON.stringify(openAIData) 
      }, 500);
    }

    console.log('📥 OpenAI Response:', gptResponse);

    // Parse the JSON response from GPT-4o
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const cleanText = gptResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanText);
      console.log('✅ Parsed financial data:', extractedData);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', gptResponse);
      console.error('❌ Parse error details:', parseError);
      return c.json({ error: 'Failed to parse extracted data', raw: gptResponse, parseError: parseError.message }, 500);
    }

    // Helper function to safely get array element or default to 0
    const getVal = (arr: number[], idx: number) => (arr && arr[idx] !== undefined) ? arr[idx] : 0;
    
    // Calculate derived metrics for each year (indices 0, 1, 2)
    const grossProfit: number[] = [];
    const totalOperatingExpenses: number[] = [];
    const operatingProfit: number[] = [];
    const ebitda: number[] = [];
    const adjustedEbitda: number[] = [];
    const pretaxProfit: number[] = [];
    const netIncome: number[] = [];
    const grossMargin: number[] = [];
    const operatingMargin: number[] = [];
    const ebitdaMargin: number[] = [];
    const netIncomeMargin: number[] = [];
    const totalCurrentAssets: number[] = [];
    const totalAssets: number[] = [];
    const totalCurrentLiabilities: number[] = [];
    const totalLiabilities: number[] = [];
    const totalEquity: number[] = [];
    
    // Calculate for all 3 years
    for (let i = 0; i < 3; i++) {
      // Income Statement calculations
      grossProfit[i] = getVal(extractedData.revenue, i) - getVal(extractedData.cost_of_sales, i);
      
      // IMPORTANT: D&A is already embedded in COGS, R&D, SG&A, etc.
      // We only extract it separately for EBITDA calculation - don't subtract it again!
      totalOperatingExpenses[i] = 
        getVal(extractedData.research_and_development, i) + 
        getVal(extractedData.sales_and_marketing, i) + 
        getVal(extractedData.selling_general_admin, i) + 
        getVal(extractedData.other_operating_expenses, i);
        // Note: NOT including depreciation_amortization here - it's already in the above expenses
      
      operatingProfit[i] = grossProfit[i] - totalOperatingExpenses[i]; // EBIT
      
      // Calculate EBITDA (EBIT + D&A)
      ebitda[i] = operatingProfit[i] + getVal(extractedData.depreciation_amortization, i);
      
      // Calculate Adjusted EBITDA (EBITDA + Stock-based comp)
      adjustedEbitda[i] = ebitda[i] + getVal(extractedData.stock_based_compensation, i);
      
      // Calculate pretax profit (EBIT + interest income - interest expense + other income/expense)
      pretaxProfit[i] = operatingProfit[i] + getVal(extractedData.interest_income, i) - getVal(extractedData.interest_expense, i) + getVal(extractedData.other_income_expense, i);
      
      // Calculate net income
      netIncome[i] = pretaxProfit[i] - getVal(extractedData.income_tax_expense, i);

      // Calculate margins
      const rev = getVal(extractedData.revenue, i);
      grossMargin[i] = rev > 0 ? (grossProfit[i] / rev) * 100 : 0;
      operatingMargin[i] = rev > 0 ? (operatingProfit[i] / rev) * 100 : 0;
      ebitdaMargin[i] = rev > 0 ? (ebitda[i] / rev) * 100 : 0;
      netIncomeMargin[i] = rev > 0 ? (netIncome[i] / rev) * 100 : 0;

      // Balance sheet calculations (first year will be 0 since balance sheet only has 2 years)
      totalCurrentAssets[i] = 
        getVal(extractedData.cash_and_equivalents, i) + 
        getVal(extractedData.accounts_receivable, i) + 
        getVal(extractedData.inventories, i) + 
        getVal(extractedData.other_current_assets, i);
      
      totalAssets[i] = 
        totalCurrentAssets[i] + 
        getVal(extractedData.property_plant_equipment, i) + 
        getVal(extractedData.other_noncurrent_assets, i);
      
      totalCurrentLiabilities[i] = 
        getVal(extractedData.accounts_payable, i) + 
        getVal(extractedData.other_current_liabilities, i) + 
        getVal(extractedData.short_term_debt, i) +
        getVal(extractedData.deferred_revenue, i); // Some companies split current/non-current
      
      totalLiabilities[i] = 
        totalCurrentLiabilities[i] + 
        getVal(extractedData.long_term_debt, i) + 
        getVal(extractedData.other_noncurrent_liabilities, i);
      
      totalEquity[i] = 
        getVal(extractedData.common_stock, i) + 
        getVal(extractedData.retained_earnings, i) + 
        getVal(extractedData.other_equity, i);
    }

    // Round all values
    const round = (arr: number[]) => arr.map(v => Math.round(v * 100) / 100);

    const result = {
      ...extractedData,
      gross_profit: round(grossProfit),
      operating_profit: round(operatingProfit),
      ebitda: round(ebitda),
      adjusted_ebitda: round(adjustedEbitda),
      pretax_profit: round(pretaxProfit),
      net_income: round(netIncome),
      gross_margin: round(grossMargin),
      operating_margin: round(operatingMargin),
      ebitda_margin: round(ebitdaMargin),
      net_income_margin: round(netIncomeMargin),
      total_current_assets: round(totalCurrentAssets),
      total_assets: round(totalAssets),
      total_current_liabilities: round(totalCurrentLiabilities),
      total_liabilities: round(totalLiabilities),
      total_equity: round(totalEquity),
    };

    console.log('✅ Analysis complete:', result);

    return c.json(result);

  } catch (error) {
    console.error('❌ Error analyzing 10-K:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ 
      error: 'Failed to process 10-K filing', 
      message: error.message,
      stack: error.stack 
    }, 500);
  }
});

// Invoice extraction endpoint
app.post("/make-server-53c2e113/analyze-invoice", async (c) => {
  try {
    console.log('🧾 Starting invoice analysis endpoint...');
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ No file provided');
      return c.json({ error: 'No file provided' }, 400);
    }

    console.log('📄 Processing invoice file:', file.name, 'Size:', file.size, 'Type:', file.type);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not configured');
      return c.json({ error: 'OpenAI API key not configured' }, 500);
    }

    let invoiceText = '';
    let useVision = false;
    
    // Determine file type from name if type is missing
    const fileType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    console.log('📋 Detected file type:', fileType);

    // Handle PDFs - extract text first
    if (fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      console.log('📖 Extracting text from PDF...');
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const tempPath = `/tmp/invoice-${Date.now()}.pdf`;
        
        await Deno.writeFile(tempPath, bytes);
        
        const pdfParse = (await import('npm:pdf-parse@1.1.1')).default;
        const dataBuffer = await Deno.readFile(tempPath);
        const data = await pdfParse(dataBuffer);
        
        invoiceText = data.text;
        console.log('✅ Extracted', invoiceText.length, 'characters from PDF');
        
        await Deno.remove(tempPath);
      } catch (parseError) {
        console.error('❌ PDF parsing error:', parseError);
        return c.json({ 
          error: 'Failed to parse PDF file',
          details: parseError.message 
        }, 500);
      }
    } else {
      // For images, use GPT-4o Vision
      console.log('🖼️ Processing image file for vision analysis...');
      useVision = true;
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Convert to base64 in chunks to avoid stack overflow
        const chunkSize = 8192;
        let base64 = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          base64 += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64 = btoa(base64);
        
        invoiceText = base64;
      } catch (conversionError) {
        console.error('❌ Image conversion error:', conversionError);
        return c.json({ 
          error: 'Failed to convert image file',
          details: conversionError.message 
        }, 500);
      }
    }

    console.log('🤖 Sending to GPT-4o for extraction...');

    let messages;
    
    if (useVision) {
      // Vision API call for images
      messages = [
        {
          role: 'user',
          content: [
            {
              type: "text",
              text: `You are an expert invoice data extraction system. Analyze this invoice image and extract the following information in JSON format:

{
  "supplier_name": "Company/vendor name",
  "invoice_number": "Invoice number",
  "invoice_date": "Date in format YYYY-MM-DD",
  "due_date": "Due date in format YYYY-MM-DD",
  "net_amount": "Net/subtotal amount as number (no currency symbol)",
  "vat_amount": "VAT/tax amount as number (no currency symbol)",
  "total_amount": "Total amount as number (no currency symbol)",
  "currency": "Currency code (USD, EUR, GBP, etc.)"
}

IMPORTANT:
- Extract amounts as numbers only (e.g., "1234.56" not "$1,234.56")
- Use YYYY-MM-DD format for dates
- If a field is not found, use "N/A" for text fields and "0" for numeric fields
- Be precise and accurate
- Return ONLY the JSON object, no additional text or explanation`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${invoiceText}`
              }
            }
          ]
        }
      ];
    } else {
      // Text-based extraction for PDFs
      messages = [
        {
          role: 'user',
          content: `You are an expert invoice data extraction system. Analyze this invoice text and extract the following information in JSON format:

{
  "supplier_name": "Company/vendor name",
  "invoice_number": "Invoice number",
  "invoice_date": "Date in format YYYY-MM-DD",
  "due_date": "Due date in format YYYY-MM-DD",
  "net_amount": "Net/subtotal amount as number (no currency symbol)",
  "vat_amount": "VAT/tax amount as number (no currency symbol)",
  "total_amount": "Total amount as number (no currency symbol)",
  "currency": "Currency code (USD, EUR, GBP, etc.)"
}

IMPORTANT:
- Extract amounts as numbers only (e.g., "1234.56" not "$1,234.56")
- Use YYYY-MM-DD format for dates
- If a field is not found, use "N/A" for text fields and "0" for numeric fields
- Be precise and accurate
- Return ONLY the JSON object, no additional text or explanation

Invoice Text:
${invoiceText.substring(0, 15000)}`
        }
      ];
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      return c.json({ 
        error: `OpenAI API error: ${response.status}`,
        details: errorText 
      }, 500);
    }

    const result = await response.json();
    console.log('✅ OpenAI response received');

    const extractedText = result.choices[0].message.content;
    console.log('📊 Extracted content:', extractedText);

    // Parse the JSON response
    let invoiceData;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        invoiceData = JSON.parse(jsonMatch[0]);
      } else {
        invoiceData = JSON.parse(extractedText);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', parseError);
      return c.json({ 
        error: 'Failed to parse extracted data',
        details: extractedText 
      }, 500);
    }

    console.log('✅ Invoice extraction complete:', invoiceData);

    return c.json(invoiceData);

  } catch (error) {
    console.error('❌ Invoice analysis error:', error);
    return c.json({ 
      error: 'Failed to process invoice',
      details: error.message 
    }, 500);
  }
});

// Bank Reconciliation endpoint
app.post("/make-server-53c2e113/analyze-bank-rec", async (c) => {
  try {
    console.log('🏦 Starting bank reconciliation endpoint...');
    
    const formData = await c.req.formData();
    console.log('📋 FormData received, entries:', Array.from(formData.entries()).map(([key, value]) => ({
      key,
      valueType: value instanceof File ? 'File' : typeof value,
      fileName: value instanceof File ? value.name : 'N/A',
      fileSize: value instanceof File ? value.size : 'N/A'
    })));
    
    const bankFile = formData.get('bank_file') as File;
    const ledgerFile = formData.get('ledger_file') as File;

    console.log('🔍 Bank file:', bankFile ? `${bankFile.name} (${bankFile.size} bytes)` : 'NULL');
    console.log('🔍 Ledger file:', ledgerFile ? `${ledgerFile.name} (${ledgerFile.size} bytes)` : 'NULL');

    if (!bankFile || !ledgerFile) {
      console.error('❌ Missing files');
      return c.json({ error: 'Both bank and ledger files are required' }, 400);
    }

    console.log('📄 Processing files:', bankFile.name, ledgerFile.name);

    // Parse CSV or Excel files
    const parseFile = async (file: File) => {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || 
                     file.name.toLowerCase().endsWith('.xls') ||
                     file.type.includes('spreadsheet') ||
                     file.type.includes('excel');
      
      console.log(`📄 Parsing ${file.name} as ${isExcel ? 'Excel' : 'CSV'}`);

      if (isExcel) {
        // Parse Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          throw new Error(`File ${file.name} has insufficient data`);
        }

        console.log(`��� Excel data: ${jsonData.length} rows`);
        console.log(`📋 Raw first row (headers):`, JSON.stringify(jsonData[0]));
        console.log(`📋 Raw second row (sample data):`, JSON.stringify(jsonData[1]));
        console.log(`📋 Raw third row (sample data):`, JSON.stringify(jsonData[2]));

        const headers = jsonData[0].map((h: any) => 
          h && h.toString ? h.toString().toLowerCase().replace(/[^a-z0-9]/g, '_') : ''
        ).filter((h: string) => h !== '');
        
        console.log(`📋 Normalized headers:`, headers);
        
        const rows = jsonData.slice(1).map((row: any[], rowIdx: number) => {
          const obj: any = {};
          headers.forEach((header: string, idx: number) => {
            const cellValue = row[idx];
            // Handle Excel dates (serial numbers)
            if (typeof cellValue === 'number' && cellValue > 40000 && cellValue < 60000) {
              // Likely an Excel date serial number
              const excelEpoch = new Date(1899, 11, 30);
              const date = new Date(excelEpoch.getTime() + cellValue * 86400000);
              obj[header] = date.toISOString().split('T')[0];
            } else {
              obj[header] = cellValue !== undefined && cellValue !== null ? cellValue.toString() : '';
            }
          });
          
          // Debug first 3 rows
          if (rowIdx < 3) {
            console.log(`Excel row ${rowIdx + 1}:`, JSON.stringify(obj));
          }
          
          return obj;
        }).filter(row => {
          return Object.values(row).some(v => v && v.toString().trim() !== '');
        });

        console.log(`✅ Parsed ${rows.length} rows from Excel file ${file.name}`);
        if (rows.length > 0) {
          console.log('📝 First parsed row:', JSON.stringify(rows[0]));
          console.log('📝 Available keys:', Object.keys(rows[0]));
        }

        return { headers, rows };

      } else {
        // Parse CSV file
        const text = await file.text();
        console.log(`📄 Raw CSV content from ${file.name} (first 500 chars):`, text.substring(0, 500));
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error(`File ${file.name} has insufficient data`);
        }

        // Parse CSV line handling quoted fields
        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));
        console.log('📋 CSV headers:', headers);
        
        const rows = lines.slice(1).map((line, lineIdx) => {
          const values = parseCsvLine(line);
          const obj: any = {};
          headers.forEach((header, colIdx) => {
            obj[header] = values[colIdx] || '';
          });
          return obj;
        }).filter(row => {
          // Filter out empty rows
          return Object.values(row).some(v => v && v.toString().trim() !== '');
        });

        console.log(`✅ Parsed ${rows.length} rows from CSV file ${file.name}`);
        if (rows.length > 0) {
          console.log('📝 Sample row:', JSON.stringify(rows[0]));
        }

        return { headers, rows };
      }
    };

    const bankData = await parseFile(bankFile);
    const ledgerData = await parseFile(ledgerFile);

    console.log(`📊 Parsed ${bankData.rows.length} bank transactions, ${ledgerData.rows.length} ledger entries`);

    // Helper to find field value from multiple possible keys
    const findField = (row: any, ...keys: string[]): string => {
      for (const key of keys) {
        if (row[key] && row[key].toString().trim() !== '') {
          return row[key].toString().trim();
        }
      }
      return '';
    };

    // Helper to parse amount from string
    const parseAmount = (amountStr: string): number => {
      if (!amountStr || amountStr === '') {
        console.log('parseAmount: empty input');
        return 0;
      }
      
      // Remove currency symbols and spaces
      let cleaned = amountStr.toString().trim();
      cleaned = cleaned.replace(/[€$£¥\s]/g, '');
      
      // Handle both European (1.234,56) and US (1,234.56) formats
      // If there's both comma and dot, determine which is decimal separator
      const hasComma = cleaned.includes(',');
      const hasDot = cleaned.includes('.');
      
      if (hasComma && hasDot) {
        // Both present - last one is decimal separator
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        if (lastComma > lastDot) {
          // European format: 1.234,56
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
          // US format: 1,234.56
          cleaned = cleaned.replace(/,/g, '');
        }
      } else if (hasComma) {
        // Only comma - could be decimal or thousands separator
        // If comma is followed by exactly 2 digits at end, it's decimal
        if (/,\d{2}$/.test(cleaned)) {
          cleaned = cleaned.replace(',', '.');
        } else {
          cleaned = cleaned.replace(/,/g, '');
        }
      }
      
      const parsed = parseFloat(cleaned);
      console.log(`parseAmount: "${amountStr}" -> "${cleaned}" -> ${parsed}`);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Normalize bank transactions
    console.log('🔄 Normalizing bank transactions...');
    console.log('Available keys in first bank row:', Object.keys(bankData.rows[0] || {}));
    
    const bankTransactions = bankData.rows.map((row: any, idx: number) => {
      const dateField = findField(row, 'date', 'datum', 'transaction_date', 'booking_date', 'value_date');
      const descField = findField(row, 'description', 'bankdescription', 'bank_description', 'beschreibung', 'memo', 'text', 'purpose', 'reference', 'narrative');
      const amountField = findField(row, 'amount', 'amount_eur', 'amount_usd', 'betrag', 'value', 'transaction_amount', 'debit', 'credit');
      
      const transaction = {
        date: dateField,
        description: descField || 'Unknown',
        amount: parseAmount(amountField),
        balance: row.balance ? parseAmount(row.balance.toString()) : undefined,
        _row_index: idx,
        _raw_row: idx < 3 ? row : undefined // Keep first 3 raw rows for debugging
      };
      
      if (idx < 5) {
        console.log(`Bank row ${idx}:`, JSON.stringify(transaction));
      }
      return transaction;
    }).filter((t: any) => {
      const isValid = t.amount !== 0 && t.date;
      if (!isValid) {
        console.log(`⚠️ Filtered out bank transaction - amount: ${t.amount}, date: "${t.date}", desc: "${t.description}"`);
      }
      return isValid;
    });

    // Normalize ledger entries
    console.log('🔄 Normalizing ledger entries...');
    console.log('Available keys in first ledger row:', Object.keys(ledgerData.rows[0] || {}));
    
    const ledgerEntries = ledgerData.rows.map((row: any, idx: number) => {
      const dateField = findField(row, 'date', 'datum', 'posting_date', 'transaction_date');
      const descField = findField(row, 'description', 'ledgerdescription', 'ledger_description', 'bankdescription', 'bank_description', 'beschreibung', 'text', 'memo', 'purpose', 'narrative');
      const amountField = findField(row, 'amount', 'amount_eur', 'amount_usd', 'betrag', 'value', 'debit', 'credit', 'transaction_amount');
      
      const entry = {
        date: dateField,
        description: descField || 'Unknown',
        amount: parseAmount(amountField),
        account: findField(row, 'account', 'konto', 'account_number'),
        reference: findField(row, 'reference', 'referenz', 'ref'),
        _row_index: idx,
        _raw_row: idx < 3 ? row : undefined // Keep first 3 raw rows for debugging
      };
      
      if (idx < 5) {
        console.log(`Ledger row ${idx}:`, JSON.stringify(entry));
      }
      return entry;
    }).filter((e: any) => {
      const isValid = e.amount !== 0 && e.date;
      if (!isValid) {
        console.log(`⚠️ Filtered out ledger entry - amount: ${e.amount}, date: "${e.date}", desc: "${e.description}"`);
      }
      return isValid;
    });

    console.log(`✅ Normalized ${bankTransactions.length} bank transactions, ${ledgerEntries.length} ledger entries`);
    
    // 🎯 PHASE 1: EXACT MATCHING (No AI needed)
    const { exactMatches, unmatchedBank: unmatchedBankAfterExact, unmatchedLedger: unmatchedLedgerAfterExact } = 
      performExactBankMatching(bankTransactions, ledgerEntries);
    
    // 🎯 PHASE 1.5: RULE-BASED SUM DETECTION (No AI needed!)
    console.log(`\n🧮 Starting sum-based matching on remaining ${unmatchedBankAfterExact.length} bank and ${unmatchedLedgerAfterExact.length} ledger...`);
    
    let groupedMatches = [];
    let unmatchedBankAfterSum = unmatchedBankAfterExact;
    let unmatchedLedgerAfterSum = unmatchedLedgerAfterExact;
    
    try {
      const sumMatchResult = performSumBasedMatching(unmatchedBankAfterExact, unmatchedLedgerAfterExact, 5, 7, 0.02);
      groupedMatches = sumMatchResult.groupedMatches;
      unmatchedBankAfterSum = sumMatchResult.unmatchedBank;
      unmatchedLedgerAfterSum = sumMatchResult.unmatchedLedger;
      console.log(`✅ COMBINED RULE-BASED MATCHES: ${exactMatches.length} exact + ${groupedMatches.length} grouped = ${exactMatches.length + groupedMatches.length} total`);
      console.log(`   Remaining for AI: ${unmatchedBankAfterSum.length} bank, ${unmatchedLedgerAfterSum.length} ledger`);
    } catch (sumError) {
      console.error('⚠️ Sum-based matching failed, skipping this phase:', sumError);
      console.error('⚠️ Stack:', sumError.stack);
      // Continue with exact matching results only
    }
    
    if (bankTransactions.length === 0) {
      console.error('❌ No valid bank transactions after filtering');
      console.error('📊 Raw bank data rows:', bankData.rows.length);
      console.error('📋 Bank headers:', bankData.headers);
      console.error('��� Sample raw bank row:', JSON.stringify(bankData.rows[0]));
      console.error('📝 All raw bank rows:', JSON.stringify(bankData.rows.slice(0, 5)));
      
      const errorDetails = {
        error: 'No valid bank transactions found',
        details: {
          raw_rows: bankData.rows.length,
          headers: bankData.headers,
          sample_row: bankData.rows[0],
          requirement: 'Need columns: date, description, amount (with non-zero amounts and valid dates)',
          file_type: bankFile.name.endsWith('.xlsx') ? 'Excel' : 'CSV'
        }
      };
      
      throw new Error(`No valid bank transactions found. Please check your file format.\n\nHeaders found: ${bankData.headers.join(', ')}\n\nRequired: date, description, amount\n\nSample row: ${JSON.stringify(bankData.rows[0])}`);
    }
    
    if (ledgerEntries.length === 0) {
      console.error('❌ No valid ledger entries after filtering');
      console.error('📊 Raw ledger data rows:', ledgerData.rows.length);
      console.error('📋 Ledger headers:', ledgerData.headers);
      console.error('📝 Sample raw ledger row:', JSON.stringify(ledgerData.rows[0]));
      console.error('📝 All raw ledger rows:', JSON.stringify(ledgerData.rows.slice(0, 5)));
      
      throw new Error(`No valid ledger entries found. Please check your file format.\n\nHeaders found: ${ledgerData.headers.join(', ')}\n\nRequired: date, description, amount\n\nSample row: ${JSON.stringify(ledgerData.rows[0])}`);
    }

    // 🤖 PHASE 2: AI-POWERED MATCHING (Batched processing for unmatched transactions)
    const aiStartTime = Date.now();
    console.log(`🤖 AI MATCHING START: ${unmatchedBankAfterExact.length} unmatched transactions...`);
    
    // Check if API key is available
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      throw new Error('OpenAI API key not configured');
    }

    // Note: We always run sum-based matching now, so this early return is unlikely
    // unless all transactions are exact matches

    // 🎯 PHASE 2A: PRE-FILTER OBVIOUS UNMATCHED ITEMS (No AI needed!)
    const preFilterStartTime = Date.now();
    const preFilteredUnmatched: any[] = [];
    const remainingForAI: any[] = [];
    
    // Regex patterns for common unmatched items
    const bankFeePatterns = /bank.*fee|account.*fee|service.*charge|monthly.*fee|wire.*fee|transfer.*fee|atm.*fee|maintenance/i;
    const interestPatterns = /interest.*earned|interest.*income|interest.*credit|interest.*paid/i;
    
    for (const txn of unmatchedBankAfterSum) {
      const desc = txn.description.toLowerCase();
      
      // Bank fees (always unmatched, create JE)
      if (bankFeePatterns.test(desc)) {
        preFilteredUnmatched.push({
          transaction: {
            date: txn.date,
            description: txn.description,
            amount: txn.amount
          },
          suggested_action: 'Bank fee not in ledger - Create journal entry',
          suggested_je: {
            description: `Bank fees ${txn.date}`,
            debit_account: '6800 Bank Charges',
            credit_account: '1200 Bank',
            amount: Math.abs(txn.amount)
          }
        });
      }
      // Interest income (always unmatched, create JE)
      else if (interestPatterns.test(desc) && txn.amount > 0) {
        preFilteredUnmatched.push({
          transaction: {
            date: txn.date,
            description: txn.description,
            amount: txn.amount
          },
          suggested_action: 'Interest income not in ledger - Create journal entry',
          suggested_je: {
            description: `Interest earned ${txn.date}`,
            debit_account: '1200 Bank',
            credit_account: '8100 Interest Income',
            amount: txn.amount
          }
        });
      }
      // Send to AI for complex matching
      else {
        remainingForAI.push(txn);
      }
    }
    
    const preFilterElapsed = Date.now() - preFilterStartTime;
    console.log(`✅ PRE-FILTER DONE in ${preFilterElapsed}ms: ${preFilteredUnmatched.length} auto-classified, ${remainingForAI.length} need AI`);
    
    // If all unmatched items were pre-filtered, skip AI entirely
    if (remainingForAI.length === 0) {
      console.log('✅ All unmatched items pre-filtered! No AI needed.');
      const bankTotal = bankTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const ledgerTotal = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
      const allMatches = [...exactMatches, ...groupedMatches];
      const matchRate = bankTransactions.length > 0 
        ? (allMatches.length / bankTransactions.length) * 100 
        : 0;
      
      return c.json({
        summary: {
          total_bank_transactions: bankTransactions.length,
          total_ledger_entries: ledgerEntries.length,
          matched_count: allMatches.length,
          unmatched_bank_count: preFilteredUnmatched.length,
          unmatched_ledger_count: unmatchedLedgerAfterSum.length,
          total_bank_amount: bankTotal,
          total_ledger_amount: ledgerTotal,
          difference: bankTotal - ledgerTotal,
          match_rate: matchRate,
          exact_matches: exactMatches.length,
          grouped_matches: groupedMatches.length,
          ai_matches: 0
        },
        matched_pairs: allMatches,
        unmatched_bank: preFilteredUnmatched,
        unmatched_ledger: unmatchedLedgerAfterSum.map(e => ({
          entry: {
            date: e.date,
            description: e.description,
            amount: e.amount
          },
          reason: 'No matching bank transaction found',
          action: 'Review and verify this entry'
        }))
      });
    }

    // Batch remaining transactions for AI (INCREASED from 20 to 150 for 7.5x speedup!)
    const BATCH_SIZE = 150; // 🚀 MASSIVELY INCREASED for speed
    const CONCURRENT_BATCHES = 5; // Process 5 batches in parallel
    const bankBatches = batchArray(remainingForAI, BATCH_SIZE);
    console.log(`📦 Processing ${remainingForAI.length} unmatched bank transactions in ${bankBatches.length} batches of ${BATCH_SIZE} (${CONCURRENT_BATCHES} concurrent)`);
    
    let allAIMatches: any[] = [];
    let allAIUnmatchedBank: any[] = [];
    
    // Process batches in parallel (5 at a time)
    for (let i = 0; i < bankBatches.length; i += CONCURRENT_BATCHES) {
      const groupStartTime = Date.now();
      const batchGroup = bankBatches.slice(i, i + CONCURRENT_BATCHES);
      console.log(`\n🔄 GROUP ${Math.floor(i/CONCURRENT_BATCHES) + 1}/${Math.ceil(bankBatches.length/CONCURRENT_BATCHES)}: Processing ${batchGroup.length} batches in PARALLEL...`);
      
      // Process all batches in this group concurrently
      const batchResults = await Promise.all(batchGroup.map(async (bankBatch, groupIdx) => {
        const batchIdx = i + groupIdx;
        const batchStartTime = Date.now();
        console.log(`  📊 Batch ${batchIdx + 1}/${bankBatches.length}: Starting ${bankBatch.length} transactions...`);
        
        // Prepare comprehensive prompt for this batch
        const reconciliationPrompt = `You are a SENIOR ACCOUNTING SYSTEM performing bank reconciliation. You must handle complex matching scenarios including partial payments, FX conversions, and timing differences.

## ℹ️ IMPORTANT CONTEXT:
Simple exact matches and basic grouped sum matches (one-to-many, many-to-one) have ALREADY been handled by rule-based algorithms.
You are receiving ONLY the complex/ambiguous transactions that require AI intelligence:
- Fuzzy description matching
- FX conversions with amount differences
- Timing differences with large date gaps
- Fee-adjusted matches
- Complex partial payment patterns

## 🚨 CRITICAL INSTRUCTION - READ THIS FIRST:

You will classify ${bankBatch.length} bank transactions into TWO categories:
1. **matched_pairs**: Bank transactions that HAVE a corresponding ledger entry (exact, fuzzy, grouped, fx_conversion, timing_difference)
2. **unmatched_bank**: Bank transactions that DO NOT have any ledger entry (fees, interest, unknown transactions)

⚠️ THESE ARRAYS MUST NOT OVERLAP! Each bank transaction goes into EXACTLY ONE array.
⚠️ matched_pairs.length + unmatched_bank.length MUST EQUAL ${bankBatch.length}
⚠️ DO NOT use match_type "unmatched" in the matched_pairs array!

## BANK TRANSACTIONS (${bankBatch.length} in this batch):
${JSON.stringify(bankBatch, null, 2)}

## LEDGER ENTRIES (${unmatchedLedgerAfterSum.length} total):
${JSON.stringify(unmatchedLedgerAfterSum.slice(0, 40), null, 2)}${unmatchedLedgerAfterSum.length > 40 ? '\n... (showing first 40)' : ''}

## ⚠️ CRITICAL RULE - READ THIS FIRST:

**"matched_pairs" array = ONLY transactions that HAVE a corresponding ledger entry**
**"unmatched_bank" array = ONLY transactions that DO NOT have any ledger entry**

DO NOT put transactions with NO ledger match into "matched_pairs"!
DO NOT use match_type "unmatched" in the "matched_pairs" array!

## CRITICAL MATCHING RULES (FOLLOW EXACTLY):

### 1️⃣ EXACT MATCH (match_type: "exact")
- Same amount (tolerance: ±€0.01)
- Dates within 3 days
- Example: €1,234.56 on 15.03 (bank) ↔ €1,234.56 on 15.03 (ledger)
- ✅ Put in "matched_pairs"

### 2️⃣ FUZZY MATCH (match_type: "fuzzy")
- Similar descriptions with different formatting
- Examples:
  * "AMZN MKTP" ↔ "Amazon EU SARL"
  * "CARD PAYMENT" ↔ "VISA ending 1234"
  * "SEPA TRANSFER" ↔ "Wire to Supplier ABC"
- Amounts must match (±€0.01)
- Dates within 5 days
- ⚠️ ONLY use "fuzzy" if there IS a ledger entry!
- ⚠️ If NO ledger entry exists, put in "unmatched_bank" instead!
- ✅ Put in "matched_pairs"

### 3️⃣ ONE-TO-MANY (match_type: "grouped")
**One bank transaction = Multiple ledger entries that SUM to bank amount**
- Example: Bank shows €2,500 → Ledger has €1,200 + €800 + €500 = €2,500
- All ledger entries must have similar dates (within 7 days of bank)
- Common for: Payroll (multiple employees), Grouped expenses, Batch payments
- ✅ Put in "matched_pairs"

### 4️⃣ MANY-TO-ONE (match_type: "grouped") ⚠️ CRITICAL - DON'T MISS THIS
**Multiple bank transactions = One ledger entry**
- Example: Bank shows €1,000 + €1,000 + €500 = €2,500 → Ledger has ONE entry for €2,500
- Common for: Partial/installment payments, Split receipts, Payment plans
- Look for descriptions like "Payment 1/3", "Partial payment", or same vendor/client in multiple bank rows
- **If you see multiple bank transactions with similar descriptions that SUM to a ledger amount, THIS IS A MANY-TO-ONE MATCH!**
- ✅ Put in "matched_pairs"

### 5️⃣ FX / CURRENCY CONVERSION (match_type: "fx_conversion")
**Foreign exchange transactions with gains/losses**
- Bank amount ≠ Ledger amount due to FX rate differences
- Examples:
  * Bank: $10,000 USD receipt = €9,200 (at spot rate)
  * Ledger: €9,181.94 (at booking rate)
  * Difference: €18.06 = FX gain
- Descriptions contain: "USD", "GBP", "FX", "FOREX", "CONVERSION", "EXCHANGE"
- **ALWAYS match these even if amounts differ!**
- In suggested_je, create FX gain/loss adjustment:
  * If bank > ledger: CR Foreign Exchange Gain
  * If bank < ledger: DR Foreign Exchange Loss
- ✅ Put in "matched_pairs"

### 6️⃣ TIMING DIFFERENCES (match_type: "timing_difference")
**Ledger entry exists but clears in different period**
- Example:
  * Ledger: 31.03.2025 - Payment to Supplier DEF (-€5,000)
  * Bank: 02.04.2025 - Same transaction clears
- **This is NOT unmatched!** Match them with match_type: "timing_difference"
- Date gap > 5 days BUT same description and amount
- **DO NOT suggest creating a JE** - the transaction already exists in ledger!
- ✅ Put in "matched_pairs"

### 7️⃣ UNMATCHED BANK TRANSACTIONS (DO NOT PUT IN matched_pairs!)
**Bank transactions with NO corresponding ledger entry**
- Examples:
  * Bank fees (monthly account fees, wire fees)
  * Interest earned
  * Unknown transactions
  * Transactions that need investigation
- ⛔ DO NOT put these in "matched_pairs" with match_type "fuzzy" or "unmatched"
- ⛔ DO NOT create fake ledger entries
- ✅ Put ONLY in "unmatched_bank" array with suggested JE

## ⛔ ANTI-PATTERNS - NEVER DO THESE:

❌ WRONG: Putting "Interest Earned" in matched_pairs with empty ledger_entries: []
✅ RIGHT: Put "Interest Earned" in unmatched_bank with suggested_je

❌ WRONG: Putting "Bank Fee" in matched_pairs with match_type: "unmatched"  
✅ RIGHT: Put "Bank Fee" in unmatched_bank with suggested_je

❌ WRONG: matched_pairs has 12 items, unmatched_bank has 4 items, but total bank transactions is 15
✅ RIGHT: matched_pairs + unmatched_bank must EQUAL total bank transactions (no double-counting!)

❌ WRONG: Same transaction appears in both matched_pairs AND unmatched_bank
✅ RIGHT: Each bank transaction appears in EXACTLY ONE array

## VALIDATION CHECKLIST (Before finalizing):

✅ Did I check for MANY-TO-ONE matches? (multiple bank → one ledger)
✅ Did I check for FX conversions? (look for USD/GBP/FX in descriptions)
✅ Did I identify timing differences? (same amount, large date gap)
✅ Did I avoid suggesting JEs when ledger entry already exists?
✅ Is each ledger entry used exactly ONCE?
✅ Does matched_pairs.length + unmatched_bank.length = total bank transactions?
✅ Are ALL entries in matched_pairs paired with at least ONE ledger entry?
✅ Did I put bank transactions with NO ledger entry into unmatched_bank (not matched_pairs)?

## OUTPUT FORMAT (STRICT JSON):
{
  "matched_pairs": [
    {
      "bank_transaction": {"date": "15.03.2025", "description": "AMZN MKTP", "amount": -123.45},
      "ledger_entries": [{"date": "15.03.2025", "description": "Amazon EU SARL", "amount": -123.45}],
      "match_confidence": 0.95,
      "match_type": "fuzzy",
      "explanation": "AMZN MKTP matches Amazon EU SARL (fuzzy description match)"
    },
    {
      "bank_transaction": {"date": "20.03.2025", "description": "Payroll", "amount": -12500},
      "ledger_entries": [
        {"date": "20.03.2025", "description": "Salary Employee A", "amount": -5000},
        {"date": "20.03.2025", "description": "Salary Employee B", "amount": -5000},
        {"date": "20.03.2025", "description": "Salary Employee C", "amount": -2500}
      ],
      "match_confidence": 1.0,
      "match_type": "grouped",
      "explanation": "One bank payroll transaction matches 3 ledger salary entries totaling -12500"
    }
  ],
  "unmatched_bank": [
    {
      "transaction": {"date": "31.03.2025", "description": "Interest Earned", "amount": 12.34},
      "suggested_action": "Interest income not in ledger - Create journal entry",
      "suggested_je": {
        "description": "Interest earned March 2025",
        "debit_account": "1200 Bank",
        "credit_account": "8100 Interest Income",
        "amount": 12.34
      }
    },
    {
      "transaction": {"date": "31.03.2025", "description": "Monthly Account Fee", "amount": -9.90},
      "suggested_action": "Bank fee not in ledger - Create journal entry",
      "suggested_je": {
        "description": "Bank service fees March 2025",
        "debit_account": "6800 Bank Charges",
        "credit_account": "1200 Bank",
        "amount": 9.90
      }
    },
    {
      "transaction": {"date": "15.03.2025", "description": "Unknown POS Payment", "amount": -75.20},
      "suggested_action": "Investigate - Unknown transaction requires review",
      "suggested_je": null
    }
  ],
  "unmatched_ledger": [
    {
      "entry": {"date": "31.03.2025", "description": "Outstanding check #1234", "amount": -1000},
      "reason": "Timing difference - Check not yet cleared",
      "action": "Verify check clears in April statement"
    }
  ]
}

## COMMON MISTAKES TO AVOID:

❌ **WRONG**: Marking 3 bank transactions (€1000, €1000, €500) as unmatched when ledger has ONE entry for €2500
✅ **RIGHT**: Group those 3 bank transactions as MANY-TO-ONE match to the €2500 ledger entry

❌ **WRONG**: Marking FX conversion as unmatched because amounts differ (€9200 vs €9181.94)
✅ **RIGHT**: Match them with match_type: "fx_conversion" and create FX gain/loss JE for difference

❌ **WRONG**: Suggesting JE for "Payment to Supplier DEF" when ledger already has this entry (just different date)
✅ **RIGHT**: Match as timing difference, action: "Verify clearing date"

❌ **WRONG**: Ignoring partial payment descriptions like "Payment 1/3, 2/3, 3/3"
✅ **RIGHT**: Recognize pattern and sum bank transactions to match one ledger invoice

**RETURN ONLY JSON. NO MARKDOWN. NO EXPLANATIONS OUTSIDE JSON.**`;

        // Call OpenAI API (using GPT-4o-mini for cost efficiency - 94% cheaper!)
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o', // Using GPT-4o (not mini) for complex pattern recognition
            // Cost: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens
            // Trade-off: 15x more expensive than mini, but handles FX, partial payments, and fuzzy matching much better
            // Since we pre-filter with rule-based exact + sum matching, AI only sees ~25-40% of transactions
            // Result: Better accuracy (90%+ vs 65%) with manageable cost increase
            messages: [
              {
                role: 'system',
                content: 'You are a SENIOR ACCOUNTANT with 20+ years of reconciliation experience. You excel at: (1) Fuzzy description matching, (2) FX conversions with gain/loss adjustments, (3) Identifying timing differences vs true unmatched items, (4) Fee-adjusted matches. NEVER suggest creating a JE when the ledger entry already exists. Return ONLY valid JSON.'
              },
              {
                role: 'user',
                content: reconciliationPrompt
              }
            ],
            temperature: 0.2, // Slightly higher for better pattern recognition
            max_tokens: 16000, // 150 txns × ~80 tokens/txn = ~12000 tokens + overhead
            response_format: { type: "json_object" } // Force JSON output
          }),
        });

        if (!openAIResponse.ok) {
          const errorText = await openAIResponse.text();
          console.error('❌ OpenAI API error:', openAIResponse.status, errorText);
          throw new Error(`OpenAI API error: ${openAIResponse.status}`);
        }

        const openAIData = await openAIResponse.json();
        const gptResponse = openAIData.choices?.[0]?.message?.content;
        const batchElapsedMs = Date.now() - batchStartTime;
        console.log(`  ✅ Batch ${batchIdx + 1} done in ${batchElapsedMs}ms`);
        
        if (!gptResponse) {
          console.error('❌ No response from OpenAI');
          throw new Error('OpenAI returned no content');
        }

        console.log('✅ AI response received (length:', gptResponse.length, 'chars)');
        
        // Check if response was truncated
        const finishReason = openAIData.choices?.[0]?.finish_reason;
        if (finishReason === 'length') {
          console.warn('⚠️ AI response was truncated due to max_tokens limit');
        }

        // Parse AI response (remove markdown if present)
        let aiResult;
        try {
          let cleaned = gptResponse.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
          }
          
          // Try to repair incomplete JSON by adding missing closing brackets
          if (!cleaned.endsWith('}')) {
            console.warn('⚠️ Response appears incomplete, attempting to repair...');
            const openBraces = (cleaned.match(/{/g) || []).length;
            const closeBraces = (cleaned.match(/}/g) || []).length;
            const missing = openBraces - closeBraces;
            if (missing > 0) {
              cleaned += '}'.repeat(missing);
              console.log('🔧 Added', missing, 'closing braces');
            }
          }
          
          aiResult = JSON.parse(cleaned);
          console.log('✅ Parsed AI result:', {
            matched: aiResult.matched_pairs?.length || 0,
            unmatched_bank: aiResult.unmatched_bank?.length || 0,
            unmatched_ledger: aiResult.unmatched_ledger?.length || 0
          });
        } catch (parseError) {
          console.error('❌ Failed to parse AI response:', parseError);
          console.error('Raw response (first 1000 chars):', gptResponse.substring(0, 1000));
          console.error('Raw response (last 500 chars):', gptResponse.substring(Math.max(0, gptResponse.length - 500)));
          throw new Error(`AI response parsing failed: ${parseError.message}`);
        }

        // Validate and normalize AI response structure
        const matched = (aiResult.matched_pairs || []).map((pair: any) => ({
          bank_transaction: {
            date: pair.bank_transaction?.date || '',
            description: pair.bank_transaction?.description || '',
            amount: pair.bank_transaction?.amount || 0
          },
          ledger_entries: Array.isArray(pair.ledger_entries) 
            ? pair.ledger_entries.map((entry: any) => ({
                date: entry?.date || '',
                description: entry?.description || '',
                amount: entry?.amount || 0
              }))
            : [],
          match_confidence: pair.match_confidence || 0.5,
          match_type: pair.match_type || 'ai_suggested',
          explanation: pair.explanation || ''
        }));

        const unmatchedBankWithSuggestions = (aiResult.unmatched_bank || []).map((item: any) => {
          const txn = item.transaction || item;
          return {
            transaction: {
              date: txn?.date || '',
              description: txn?.description || '',
              amount: txn?.amount || 0
            },
            suggested_action: item.suggested_action || item.suggestion || 'Review this transaction',
            suggested_je: item.suggested_je ? {
              description: item.suggested_je.description || '',
              debit_account: item.suggested_je.debit_account || '',
              credit_account: item.suggested_je.credit_account || '',
              amount: item.suggested_je.amount || 0
            } : null
          };
        });

        const unmatchedLedger = (aiResult.unmatched_ledger || []).map((item: any) => {
          const entry = item.entry || item;
          return {
            entry: {
              date: entry?.date || '',
              description: entry?.description || '',
              amount: entry?.amount || 0
            },
            reason: item.reason || 'No matching bank transaction found',
            action: item.action || 'Review and verify this entry'
          };
        });

        console.log('✅ Normalized results for batch:', {
          matched: matched.length,
          unmatched_bank: unmatchedBankWithSuggestions.length
        });

        // 🔍 Validate AI results for common errors
        const totalClassified = matched.length + unmatchedBankWithSuggestions.length;
        if (totalClassified !== bankBatch.length) {
          console.warn(`⚠️ Classification mismatch: ${matched.length} matched + ${unmatchedBankWithSuggestions.length} unmatched = ${totalClassified}, but expected ${bankBatch.length}`);
          console.warn('⚠️ This means the AI either double-counted or missed some transactions');
        }

        // Filter out any matched_pairs that have empty ledger_entries (AI mistake)
        const validMatched = matched.filter((pair: any) => {
          const hasLedgerEntries = pair.ledger_entries && pair.ledger_entries.length > 0;
          if (!hasLedgerEntries) {
            console.warn(`⚠️ Removing incorrectly matched transaction (no ledger entries):`, pair.bank_transaction.description);
            // Move it to unmatched
            unmatchedBankWithSuggestions.push({
              transaction: pair.bank_transaction,
              suggested_action: 'Transaction has no ledger match - Needs review',
              suggested_je: null
            });
          }
          return hasLedgerEntries;
        });

        // Filter out any matched_pairs with match_type "unmatched" (AI mistake)
        const finalMatched = validMatched.filter((pair: any) => {
          const isUnmatched = pair.match_type === 'unmatched';
          if (isUnmatched) {
            console.warn(`⚠️ Removing transaction with match_type "unmatched" from matched_pairs:`, pair.bank_transaction.description);
            // Move it to unmatched
            unmatchedBankWithSuggestions.push({
              transaction: pair.bank_transaction,
              suggested_action: 'Transaction marked as unmatched - Needs review',
              suggested_je: null
            });
          }
          return !isUnmatched;
        });

        console.log('✅ After validation for batch:', {
          matched: finalMatched.length,
          unmatched_bank: unmatchedBankWithSuggestions.length,
          total: finalMatched.length + unmatchedBankWithSuggestions.length
        });
        
        // Return results from this batch
        return {
          matched: finalMatched,
          unmatchedBank: unmatchedBankWithSuggestions
        };
      })); // End of Promise.all
      
      // Accumulate results from all batches in this group
      for (const result of batchResults) {
        allAIMatches.push(...result.matched);
        allAIUnmatchedBank.push(...result.unmatchedBank);
      }
      
      const groupElapsedMs = Date.now() - groupStartTime;
      console.log(`✅ GROUP DONE in ${groupElapsedMs}ms. Total: ${allAIMatches.length} matched, ${allAIUnmatchedBank.length} unmatched\n`);
    } // End of batch group for loop
    
    const aiElapsedMs = Date.now() - aiStartTime;
    console.log(`🎉 AI MATCHING COMPLETE in ${aiElapsedMs}ms (${(aiElapsedMs/1000).toFixed(1)}s)`);
    
    console.log('✅ All batches processed. Total AI results:', {
      ai_matches: allAIMatches.length,
      ai_unmatched: allAIUnmatchedBank.length
    });

    // Process unmatched ledger entries (these weren't matched by either exact or AI matching)
    const unmatchedLedger = unmatchedLedgerAfterExact.map((item: any) => ({
      entry: {
        date: item.date || '',
        description: item.description || '',
        amount: item.amount || 0
      },
      reason: 'No matching bank transaction found',
      action: 'Review and verify this entry'
    }));

    // Calculate summary
    const bankTotal = bankTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const ledgerTotal = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
    
    // Combine exact and AI matches
    // Combine all matches: exact + grouped (rule-based) + AI
    const allMatches = [...exactMatches, ...groupedMatches, ...allAIMatches];
    const matchedCount = allMatches.length;
    
    // Combine AI unmatched and pre-filtered unmatched
    const allUnmatchedBank = [...preFilteredUnmatched, ...allAIUnmatchedBank];
    
    const matchRate = bankTransactions.length > 0 
      ? (matchedCount / bankTransactions.length) * 100 
      : 0;
    
    const summary = {
      total_bank_transactions: bankTransactions.length,
      total_ledger_entries: ledgerEntries.length,
      matched_count: matchedCount,
      unmatched_bank_count: allUnmatchedBank.length,
      unmatched_ledger_count: unmatchedLedgerAfterSum.length,
      total_bank_amount: bankTotal,
      total_ledger_amount: ledgerTotal,
      difference: bankTotal - ledgerTotal,
      match_rate: matchRate,
      // Breakdown for transparency
      exact_matches: exactMatches.length,
      grouped_matches: groupedMatches.length,
      ai_matches: allAIMatches.length
    };

    console.log('✅ Bank reconciliation complete:', summary);
    console.log(`🚀 SPEED BREAKDOWN: Exact (${exactMatches.length}) + Grouped (${groupedMatches.length}) + Pre-filter (instant) + AI (${allAIMatches.length} in ${(aiElapsedMs/1000).toFixed(1)}s)`);

    // Save reconciliation to history
    const timestamp = Date.now();
    const historyKey = `bank_rec_${timestamp}`;
    const historyData = {
      timestamp,
      bankFileName: bankFile.name,
      ledgerFileName: ledgerFile.name,
      summary,
      matched_pairs: allMatches,
      unmatched_bank: allUnmatchedBank,
      unmatched_ledger: unmatchedLedgerAfterSum.map(e => ({
        entry: {
          date: e.date,
          description: e.description,
          amount: e.amount
        },
        reason: 'No matching bank transaction found',
        action: 'Review and verify this entry'
      }))
    };
    
    console.log('💾 Attempting to save history:', {
      key: historyKey,
      bankFileName: bankFile.name,
      ledgerFileName: ledgerFile.name,
      dataSize: JSON.stringify(historyData).length
    });
    
    try {
      await kv.set(historyKey, historyData);
      console.log('✅ Saved reconciliation to history:', historyKey);
    } catch (saveError) {
      console.error('⚠️ Failed to save to history:', saveError);
      console.error('⚠️ Error details:', saveError.message, saveError.stack);
      // Don't fail the request if history save fails
    }

    return c.json({
      summary,
      matched_pairs: allMatches,
      unmatched_bank: allUnmatchedBank,
      unmatched_ledger: unmatchedLedgerAfterSum.map(e => ({
        entry: {
          date: e.date,
          description: e.description,
          amount: e.amount
        },
        reason: 'No matching bank transaction found',
        action: 'Review and verify this entry'
      }))
    });

  } catch (error) {
    console.error('❌ Bank reconciliation error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return c.json({ 
      error: 'Failed to process bank reconciliation',
      details: error.message,
      stack: error.stack
    }, 500);
  }
});

// Get Bank Reconciliation History
app.get("/make-server-53c2e113/bank-rec-history", async (c) => {
  try {
    console.log('📜 Fetching bank reconciliation history...');
    
    // Query database directly since kv.getByPrefix() doesn't return keys
    const { createClient } = await import("jsr:@supabase/supabase-js@2.49.8");
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    const { data, error } = await supabase
      .from('kv_store_53c2e113')
      .select('key, value')
      .like('key', 'bank_rec_%')
      .order('key', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    
    console.log(`📊 Raw history entries count: ${data?.length || 0}`);
    
    if (data && data.length > 0) {
      console.log('📋 Sample entry:', {
        key: data[0].key,
        hasValue: !!data[0].value,
        hasTimestamp: !!data[0].value?.timestamp
      });
    }
    
    // Sort by timestamp (newest first) and format
    const sortedHistory = (data || [])
      .filter(entry => entry.value && entry.value.timestamp)
      .sort((a, b) => b.value.timestamp - a.value.timestamp)
      .map(entry => {
        const timestamp = entry.value.timestamp || Date.now();
        let dateString;
        try {
          dateString = new Date(timestamp).toISOString();
        } catch (e) {
          console.warn('Invalid timestamp for entry:', entry.key, timestamp);
          dateString = new Date().toISOString();
        }
        return {
          id: entry.key,
          timestamp: timestamp,
          date: dateString,
          bankFileName: entry.value.bankFileName || 'Unknown',
          ledgerFileName: entry.value.ledgerFileName || 'Unknown',
          summary: entry.value.summary
        };
      });
    
    console.log(`✅ Found ${sortedHistory.length} reconciliation history entries`);
    
    return c.json({ history: sortedHistory });
  } catch (error) {
    console.error('❌ Failed to fetch history:', error);
    console.error('❌ Error details:', error.message, error.stack);
    return c.json({ error: 'Failed to fetch reconciliation history', details: error.message }, 500);
  }
});

// Get Single Bank Reconciliation by ID
app.get("/make-server-53c2e113/bank-rec-history/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log('📖 Fetching reconciliation:', id);
    
    const data = await kv.get(id);
    
    if (!data) {
      return c.json({ error: 'Reconciliation not found' }, 404);
    }
    
    console.log('✅ Reconciliation found');
    
    return c.json({
      summary: data.summary,
      matched_pairs: data.matched_pairs,
      unmatched_bank: data.unmatched_bank,
      unmatched_ledger: data.unmatched_ledger
    });
  } catch (error) {
    console.error('❌ Failed to fetch reconciliation:', error);
    return c.json({ error: 'Failed to fetch reconciliation' }, 500);
  }
});

// Helper function for chunked AP reconciliation processing
async function processAPReconciliationInChunks(
  jobId: string,
  vendorInvoices: any[],
  apEntries: any[],
  vendorFileName: string,
  apFileName: string
) {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  try {
    console.log(`🔄 [Job ${jobId}] Starting chunked processing...`);
    await kv.set(`job_${jobId}`, {
      status: 'processing',
      progress: 5,
      message: 'Performing client-side exact matching...',
      vendorCount: vendorInvoices.length,
      apCount: apEntries.length
    });

    // STEP 1: Client-side exact matching (fast, no API calls)
    const exactMatches: any[] = [];
    const unmatchedVendor: any[] = [];
    const unmatchedAP = [...apEntries];
    
    for (const vendorInv of vendorInvoices) {
      const matchIndex = unmatchedAP.findIndex(ap => 
        ap.invoice_number.toLowerCase() === vendorInv.invoice_number.toLowerCase() &&
        Math.abs(ap.amount - vendorInv.amount) < 0.01
      );
      
      if (matchIndex !== -1) {
        exactMatches.push({
          vendor_invoice: {
            num: vendorInv.invoice_number,
            date: vendorInv.date,
            amt: vendorInv.amount,
            status: vendorInv.status
          },
          internal_entry: {
            num: unmatchedAP[matchIndex].invoice_number,
            date: unmatchedAP[matchIndex].date,
            amt: unmatchedAP[matchIndex].amount,
            vendor: unmatchedAP[matchIndex].vendor
          },
          match_type: 'exact'
        });
        unmatchedAP.splice(matchIndex, 1);
      } else {
        unmatchedVendor.push(vendorInv);
      }
    }

    console.log(`✅ [Job ${jobId}] Exact matching complete: ${exactMatches.length} matches found`);
    
    await kv.set(`job_${jobId}`, {
      status: 'processing',
      progress: 30,
      message: `Found ${exactMatches.length} exact matches. Processing remaining ${unmatchedVendor.length} items...`,
      vendorCount: vendorInvoices.length,
      apCount: apEntries.length
    });

    // STEP 2: For unmatched items, use AI in smaller batches
    const BATCH_SIZE = 50; // Process 50 items at a time
    const fuzzyMatches: any[] = [];
    const missingInInternal: any[] = [];
    
    if (unmatchedVendor.length > 0) {
      const batches = [];
      for (let i = 0; i < unmatchedVendor.length; i += BATCH_SIZE) {
        batches.push(unmatchedVendor.slice(i, i + BATCH_SIZE));
      }

      console.log(`🤖 [Job ${jobId}] Processing ${batches.length} batches with AI...`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchProgress = 30 + ((i / batches.length) * 50);
        
        await kv.set(`job_${jobId}`, {
          status: 'processing',
          progress: Math.round(batchProgress),
          message: `AI processing batch ${i + 1}/${batches.length} (${batch.length} items)...`,
          vendorCount: vendorInvoices.length,
          apCount: apEntries.length
        });

        // Simplify for AI
        const simplifiedBatch = batch.map((inv: any) => ({
          num: inv.invoice_number,
          date: inv.date,
          amt: inv.amount
        }));

        const simplifiedAP = unmatchedAP.map((entry: any) => ({
          num: entry.invoice_number,
          date: entry.date,
          amt: entry.amount
        }));

        const batchPrompt = `Match these ${batch.length} vendor invoices with the AP ledger entries. Return ONLY invoices that you cannot find ANY match for.

VENDOR INVOICES:
${JSON.stringify(simplifiedBatch)}

AP LEDGER:
${JSON.stringify(simplifiedAP.slice(0, 200))}

Return JSON:
{
  "missing_in_internal": [
    {"invoice": {num, date, amt}, "reason": "Not found", "suggested_action": "Record invoice"}
  ]
}`;

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
                  content: 'You are an accountant. Return ONLY valid JSON with no markdown.'
                },
                {
                  role: 'user',
                  content: batchPrompt
                }
              ],
              temperature: 0.1,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const aiResponse = data.choices[0].message.content;
            const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                             aiResponse.match(/{[\s\S]*}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
            const batchResult = JSON.parse(jsonStr.trim());
            
            if (batchResult.missing_in_internal) {
              missingInInternal.push(...batchResult.missing_in_internal);
            }
          }
        } catch (error) {
          console.error(`⚠️ [Job ${jobId}] Batch ${i + 1} error:`, error);
          // Add all batch items as missing if AI fails
          batch.forEach((inv: any) => {
            missingInInternal.push({
              invoice: {
                num: inv.invoice_number,
                date: inv.date,
                amt: inv.amount
              },
              reason: 'Not found in AP ledger',
              suggested_action: 'Record this invoice'
            });
          });
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ [Job ${jobId}] AI processing complete`);

    await kv.set(`job_${jobId}`, {
      status: 'processing',
      progress: 90,
      message: 'Compiling results...',
      vendorCount: vendorInvoices.length,
      apCount: apEntries.length
    });

    // STEP 3: Compile final results
    const vendorTotal = vendorInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0);
    const internalTotal = apEntries.reduce((sum: number, entry: any) => sum + entry.amount, 0);
    const totalMatched = exactMatches.length;

    const finalResult = {
      summary: {
        total_vendor_invoices: vendorInvoices.length,
        total_internal_entries: apEntries.length,
        exact_matched: exactMatches.length,
        one_to_many_matched: 0,
        many_to_one_matched: 0,
        fuzzy_matched: 0,
        total_matched: totalMatched,
        missing_in_internal_count: missingInInternal.length,
        extra_in_internal_count: unmatchedAP.length,
        vendor_total_amount: vendorTotal,
        internal_total_amount: internalTotal,
        difference: vendorTotal - internalTotal,
        match_rate: (totalMatched / vendorInvoices.length) * 100
      },
      exact_matches: exactMatches,
      one_to_many_matches: [],
      many_to_one_matches: [],
      fuzzy_matches: [],
      missing_in_internal: missingInInternal,
      extra_in_internal: unmatchedAP.map((entry: any) => ({
        invoice_number: entry.invoice_number,
        date: entry.date,
        amount: entry.amount,
        vendor: entry.vendor
      }))
    };

    // Save to history
    const timestamp = Date.now();
    const historyKey = `ap_rec_${timestamp}`;
    await kv.set(historyKey, {
      timestamp,
      vendorFileName,
      apFileName,
      ...finalResult
    });

    // Update job status to complete
    await kv.set(`job_${jobId}`, {
      status: 'complete',
      progress: 100,
      message: 'Reconciliation complete!',
      result: finalResult,
      historyKey,
      vendorCount: vendorInvoices.length,
      apCount: apEntries.length
    });

    console.log(`✅ [Job ${jobId}] Reconciliation complete!`);
  } catch (error) {
    console.error(`❌ [Job ${jobId}] Error:`, error);
    await kv.set(`job_${jobId}`, {
      status: 'error',
      progress: 0,
      message: error.message || 'Processing failed',
      error: error.message
    });
  }
}

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

    console.log('📄 Files received:', {
      vendor: vendorFile.name,
      apLedger: apLedgerFile.name
    });

    // Parse vendor statement (can be PDF, CSV, or Excel)
    let vendorInvoices = [];
    
    if (vendorFile.type === 'application/pdf' || vendorFile.name.endsWith('.pdf')) {
      // For PDF, use OpenAI Vision API to extract invoice data
      console.log('📋 Processing PDF vendor statement...');
      
      const arrayBuffer = await vendorFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid call stack overflow
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode(...chunk);
      }
      const base64Pdf = btoa(binaryString);
      console.log(`📄 PDF size: ${base64Pdf.length} chars, truncating to 15000 to fit token limits`);
      
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Use GPT-4 to extract structured data from PDF
      const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are an expert at extracting invoice data from vendor statements. Extract ALL invoices with their invoice numbers, dates, amounts, and status. Return ONLY valid JSON array format with no markdown formatting.`
            },
            {
              role: 'user',
              content: `Extract all invoice data from this vendor statement PDF. Return a JSON array where each invoice has:
- invoice_number (string)
- date (string in YYYY-MM-DD format)
- amount (number, positive for charges, negative for credits)
- status (string: "Unpaid", "Paid", "Credit", etc.)
- description (string, optional)

Return ONLY the JSON array, no markdown formatting.

PDF content: ${base64Pdf.substring(0, 15000)}`
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!extractionResponse.ok) {
        const error = await extractionResponse.text();
        throw new Error(`OpenAI extraction failed: ${error}`);
      }

      const extractionData = await extractionResponse.json();
      const extractedText = extractionData.choices[0].message.content;
      
      // Parse JSON from AI response (remove markdown if present)
      const jsonMatch = extractedText.match(/\[\s*{\s*[\s\S]*}\s*\]/);
      if (jsonMatch) {
        vendorInvoices = JSON.parse(jsonMatch[0]);
      } else {
        vendorInvoices = JSON.parse(extractedText);
      }
      
    } else {
      // Parse CSV or Excel
      console.log('📊 Processing CSV/Excel vendor statement...');
      const arrayBuffer = await vendorFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet);
      
      // Map to standard format
      vendorInvoices = data.map((row: any) => ({
        invoice_number: String(row['Invoice #'] || row['Invoice'] || row['invoice_number'] || row['Invoice Number'] || '').trim(),
        date: row['Date'] || row['date'] || row['Invoice Date'] || '',
        amount: parseFloat(row['Amount'] || row['amount'] || row['Total'] || 0),
        status: row['Status'] || row['status'] || 'Unpaid',
        description: row['Description'] || row['description'] || ''
      }));
    }

    console.log(`✅ Extracted ${vendorInvoices.length} vendor invoices`);

    // Parse AP ledger (CSV or Excel)
    console.log('📊 Processing AP ledger...');
    const apArrayBuffer = await apLedgerFile.arrayBuffer();
    const apWorkbook = XLSX.read(apArrayBuffer, { type: 'array' });
    const apSheet = apWorkbook.Sheets[apWorkbook.SheetNames[0]];
    const apData = XLSX.utils.sheet_to_json(apSheet);
    
    let apEntries = apData.map((row: any) => ({
      invoice_number: String(row['Invoice #'] || row['Invoice'] || row['invoice_number'] || row['Invoice Number'] || '').trim(),
      date: row['Date'] || row['date'] || row['Invoice Date'] || '',
      amount: parseFloat(row['Amount'] || row['amount'] || row['Total'] || 0),
      status: row['Status'] || row['status'] || 'Pending',
      vendor: row['Vendor'] || row['vendor'] || ''
    }));

    console.log(`✅ Parsed ${apEntries.length} AP ledger entries`);

    // NEW: Check if we should use chunked processing for large datasets
    const totalRecords = vendorInvoices.length + apEntries.length;
    
    if (totalRecords > 200) {
      // Use chunked processing for large datasets
      console.log(`🔄 Large dataset detected (${totalRecords} records). Using chunked processing...`);
      
      // Create a unique job ID
      const jobId = `ap_rec_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store job status
      await kv.set(`job_${jobId}`, {
        status: 'processing',
        progress: 0,
        total: totalRecords,
        current: 0,
        message: 'Starting reconciliation...',
        vendorCount: vendorInvoices.length,
        apCount: apEntries.length,
        vendorFileName: vendorFile.name,
        apFileName: apLedgerFile.name
      });

      // Start async processing - don't await
      processAPReconciliationInChunks(jobId, vendorInvoices, apEntries, vendorFile.name, apLedgerFile.name);
      
      // Return job ID immediately
      return c.json({ 
        jobId,
        status: 'processing',
        message: 'Processing started. Use the job ID to check progress.',
        estimatedTime: Math.ceil(totalRecords / 100) * 15, // ~15 seconds per 100 records
        vendorCount: vendorInvoices.length,
        apCount: apEntries.length
      });
    }

    // For smaller datasets, use the original single-request approach
    console.log(`✅ Small dataset (${totalRecords} records). Using single-request processing...`);

    // Send to OpenAI for intelligent reconciliation
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Simplify data to reduce token count - only keep essential fields
    const simplifiedVendor = vendorInvoices.map(inv => ({
      num: inv.invoice_number,
      date: inv.date,
      amt: inv.amount,
      status: inv.status
    }));
    
    const simplifiedAP = apEntries.map(entry => ({
      num: entry.invoice_number,
      date: entry.date,
      amt: entry.amount,
      vendor: entry.vendor
    }));

    const reconciliationPrompt = `You are a SENIOR ACCOUNTANT performing AP vendor statement reconciliation.

## VENDOR INVOICES (${vendorInvoices.length} from vendor statement):
${JSON.stringify(simplifiedVendor)}

## INTERNAL AP LEDGER (${apEntries.length} entries):
${JSON.stringify(simplifiedAP)}

## YOUR TASK:

Reconcile the vendor statement with the internal AP ledger. Identify:

1. **MATCHED INVOICES**: Invoice numbers that appear in BOTH vendor statement AND internal ledger with matching amounts
2. **AMOUNT MISMATCHES**: Invoice numbers in both but with different amounts
3. **MISSING INVOICES**: Invoices on vendor statement but NOT in internal ledger (company needs to record them)
4. **INTERNAL ONLY**: Invoices in internal ledger but NOT on vendor statement (vendor may not have issued, or already credited)
5. **DUPLICATES**: Same invoice number appears multiple times in internal ledger

## MATCHING RULES:
- Match on 'num' field (invoice number, exact match, case-insensitive)
- If 'amt' (amount) differs by more than €0.01, it's an amount mismatch
- Credits are typically negative amounts
- Field mapping: num=invoice_number, amt=amount, date=date

## OUTPUT FORMAT (STRICT JSON):
{
  "summary": {
    "total_vendor_invoices": number,
    "total_internal_entries": number,
    "exact_matched": number,
    "one_to_many_matched": 0,
    "many_to_one_matched": 0,
    "fuzzy_matched": 0,
    "total_matched": number (same as exact_matched),
    "missing_in_internal_count": number,
    "extra_in_internal_count": number,
    "vendor_total_amount": sum of vendor amounts,
    "internal_total_amount": sum of internal amounts,
    "difference": vendor_total - internal_total,
    "match_rate": (total_matched / total_vendor_invoices * 100)
  },
  "exact_matches": [
    {
      "vendor_invoice": {num, date, amt, status},
      "internal_entry": {num, date, amt, vendor},
      "match_type": "exact"
    }
  ],
  "one_to_many_matches": [],
  "many_to_one_matches": [],
  "fuzzy_matches": [],
  "missing_in_internal": [
    {
      "invoice": {num, date, amt, status},
      "reason": "Not found in internal ledger",
      "suggested_action": "Record this invoice"
    }
  ],
  "extra_in_internal": [
    {
      "invoice_number": "INV-123",
      "date": "2024-01-01",
      "amount": 100.00,
      "vendor": "Vendor Name"
    }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

    console.log(`🤖 Sending to OpenAI for reconciliation (${simplifiedVendor.length} vendor + ${simplifiedAP.length} AP entries)...`);

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
            content: 'You are a senior accountant expert at AP reconciliation. Always return valid JSON with no markdown formatting.'
          },
          {
            role: 'user',
            content: reconciliationPrompt
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API request failed: ${error}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI response received');

    const aiResponse = data.choices[0].message.content;
    console.log('📝 AI response preview:', aiResponse.substring(0, 200));

    // Parse JSON from AI response
    let result;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                       aiResponse.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      result = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Raw response:', aiResponse);
      throw new Error('Failed to parse AI reconciliation response');
    }

    console.log('✅ AP reconciliation complete:', result.summary);

    // Save to history
    const timestamp = Date.now();
    const historyKey = `ap_rec_${timestamp}`;
    const historyData = {
      timestamp,
      vendorFileName: vendorFile.name,
      apFileName: apLedgerFile.name,
      summary: result.summary,
      exact_matches: result.exact_matches || [],
      one_to_many_matches: result.one_to_many_matches || [],
      many_to_one_matches: result.many_to_one_matches || [],
      fuzzy_matches: result.fuzzy_matches || [],
      missing_in_internal: result.missing_in_internal || [],
      extra_in_internal: result.extra_in_internal || [],
      matched_invoices: result.matched_invoices || [],
      amount_mismatches: result.amount_mismatches || [],
      missing_invoices: result.missing_invoices || [],
      internal_only_invoices: result.internal_only_invoices || [],
      duplicates: result.duplicates || []
    };

    console.log('💾 Saving AP reconciliation to history:', historyKey);
    
    try {
      await kv.set(historyKey, historyData);
      console.log('✅ Saved AP reconciliation to history');
    } catch (saveError) {
      console.error('⚠️ Failed to save to history:', saveError);
      // Don't fail the request if history save fails
    }

    return c.json(result);

  } catch (error) {
    console.error('❌ AP reconciliation error:', error);
    return c.json({ 
      error: 'Failed to process AP reconciliation',
      details: error.message 
    }, 500);
  }
});

// AP Reconciliation Job Status endpoint
app.get("/make-server-53c2e113/ap-rec-job/:jobId", async (c) => {
  try {
    const jobId = c.req.param('jobId');
    console.log(`📊 Checking job status for: ${jobId}`);
    
    const jobStatus = await kv.get(`job_${jobId}`);
    
    if (!jobStatus) {
      return c.json({ error: 'Job not found' }, 404);
    }
    
    return c.json(jobStatus);
  } catch (error) {
    console.error('❌ Failed to fetch job status:', error);
    return c.json({ error: 'Failed to fetch job status' }, 500);
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
    console.log('📝 Reconciliation data:', JSON.stringify(result, null, 2));

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Executive Summary
    const summaryData = [
      ['AP Reconciliation Report'],
      [],
      ['Reconciliation Date', new Date().toISOString().split('T')[0]],
      [],
      ['Summary Statistics', ''],
      ['Total Vendor Transactions', result.summary?.total_vendor_transactions || 0],
      ['Total Vendor Amount', `€${(result.summary?.total_vendor_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Total AP Ledger Entries', result.summary?.total_ap_entries || 0],
      ['Total AP Amount', `€${(result.summary?.total_ap_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      [],
      ['Reconciliation Results', ''],
      ['Total Matched', result.summary?.matched_count || 0],
      ['Match Rate', `${(result.summary?.match_rate || 0).toFixed(1)}%`],
      [],
      ['Unmatched Vendor Transactions', result.summary?.unmatched_vendor_count || 0],
      ['Unmatched AP Entries', result.summary?.unmatched_ap_count || 0],
      [],
      ['Total Difference', `€${Math.abs(result.summary?.difference || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Status', Math.abs(result.summary?.difference || 0) < 1 ? 'Balanced ✓' : 'Out of Balance ⚠'],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths for summary sheet
    summarySheet['!cols'] = [
      { wch: 30 },
      { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

    // Sheet 2: Matched Pairs
    if (result.matched_pairs && result.matched_pairs.length > 0) {
      const matchedData = [
        ['Date', 'Description', 'Amount', 'Match Type', 'Confidence', 'Explanation'],
        ...result.matched_pairs.map((m: any) => [
          m.vendor_transaction?.date || 'N/A',
          m.vendor_transaction?.description || 'N/A',
          `€${Math.abs(m.vendor_transaction?.amount || 0).toFixed(2)}`,
          m.match_type || 'N/A',
          `${m.match_confidence || 0}%`,
          m.explanation || ''
        ])
      ];
      const matchedSheet = XLSX.utils.aoa_to_sheet(matchedData);
      
      matchedSheet['!cols'] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 50 }
      ];

      XLSX.utils.book_append_sheet(workbook, matchedSheet, 'Matched Transactions');
    }

    // Sheet 3: Unmatched Vendor Transactions
    if (result.unmatched_vendor && result.unmatched_vendor.length > 0) {
      const unmatchedVendorData = [
        ['Date', 'Description', 'Amount', 'Suggested Action'],
        ...result.unmatched_vendor.map((m: any) => [
          m.transaction?.date || 'N/A',
          m.transaction?.description || 'N/A',
          `€${Math.abs(m.transaction?.amount || 0).toFixed(2)}`,
          m.suggested_action || 'Review transaction'
        ])
      ];
      const unmatchedVendorSheet = XLSX.utils.aoa_to_sheet(unmatchedVendorData);
      
      unmatchedVendorSheet['!cols'] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 15 },
        { wch: 50 }
      ];

      XLSX.utils.book_append_sheet(workbook, unmatchedVendorSheet, 'Unmatched Vendor Txns');
    }

    // Sheet 4: Unmatched AP Entries
    if (result.unmatched_ap && result.unmatched_ap.length > 0) {
      const unmatchedAPData = [
        ['Date', 'Description', 'Amount', 'Account', 'Reason', 'Action'],
        ...result.unmatched_ap.map((i: any) => [
          i.entry?.date || 'N/A',
          i.entry?.description || 'N/A',
          `€${Math.abs(i.entry?.amount || 0).toFixed(2)}`,
          i.entry?.account || 'N/A',
          i.reason || 'Not found in vendor statements',
          i.action || 'Review entry'
        ])
      ];
      const unmatchedAPSheet = XLSX.utils.aoa_to_sheet(unmatchedAPData);
      
      unmatchedAPSheet['!cols'] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 30 },
        { wch: 40 }
      ];

      XLSX.utils.book_append_sheet(workbook, unmatchedAPSheet, 'Unmatched AP Entries');
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log('✅ Excel file generated successfully');

    // Return as downloadable file
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="AP_Reconciliation_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });

  } catch (error) {
    console.error('❌ AP reconciliation Excel export error:', error);
    return c.json({ 
      error: 'Excel export failed', 
      details: error.message 
    }, 500);
  }
});

// Vendor Statements Excel Export endpoint
app.post("/make-server-53c2e113/export-vendor-statements", async (c) => {
  try {
    console.log('📊 Starting vendor statements Excel export...');
    
    const body = await c.req.json();
    const { statements, transactions, companyId, period } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      console.error('❌ No transactions provided');
      return c.json({ error: 'Transactions are required' }, 400);
    }

    console.log('📝 Creating Excel workbook with', transactions.length, 'transactions...');

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['Vendor Statements Export'],
      [],
      ['Export Date', new Date().toISOString().split('T')[0]],
      ['Period', period || 'N/A'],
      [],
      ['Summary Statistics', ''],
      ['Total Statements', statements?.length || 0],
      ['Total Transactions', transactions.length],
      ['Total Amount', `€${transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Sheet 2: All Transactions
    const allTransactionsData = [
      ['Date', 'Vendor/Statement', 'Description', 'Amount', 'Balance', 'Invoice Number']
    ];
    
    transactions.forEach((txn) => {
      allTransactionsData.push([
        txn.date || '',
        txn.vendor || txn.statementName || '',
        txn.description || '',
        txn.amount || 0,
        txn.balance || '',
        txn.invoiceNumber || ''
      ]);
    });
    
    const allTransactionsSheet = XLSX.utils.aoa_to_sheet(allTransactionsData);
    allTransactionsSheet['!cols'] = [
      { wch: 12 },  // Date
      { wch: 25 },  // Vendor
      { wch: 40 },  // Description
      { wch: 15 },  // Amount
      { wch: 15 },  // Balance
      { wch: 15 }   // Invoice Number
    ];
    XLSX.utils.book_append_sheet(workbook, allTransactionsSheet, 'All Transactions');

    // Sheet 3: By Statement (if statements provided)
    if (statements && Array.isArray(statements) && statements.length > 0) {
      statements.forEach((statement, idx) => {
        const statementTransactions = transactions.filter(t => t.statementId === statement.id);
        
        if (statementTransactions.length > 0) {
          const sheetData = [
            [statement.fileName || `Statement ${idx + 1}`],
            ['Uploaded', new Date(statement.uploadedAt || Date.now()).toLocaleDateString()],
            ['Transactions', statementTransactions.length],
            [],
            ['Date', 'Description', 'Amount', 'Balance', 'Invoice Number']
          ];
          
          statementTransactions.forEach((txn) => {
            sheetData.push([
              txn.date || '',
              txn.description || '',
              txn.amount || 0,
              txn.balance || '',
              txn.invoiceNumber || ''
            ]);
          });
          
          const statementSheet = XLSX.utils.aoa_to_sheet(sheetData);
          statementSheet['!cols'] = [
            { wch: 12 },  // Date
            { wch: 40 },  // Description
            { wch: 15 },  // Amount
            { wch: 15 },  // Balance
            { wch: 15 }   // Invoice Number
          ];
          
          // Truncate sheet name to 31 characters (Excel limit)
          let sheetName = (statement.fileName || `Statement ${idx + 1}`).substring(0, 31);
          // Remove invalid characters for Excel sheet names
          sheetName = sheetName.replace(/[:\\/?*\[\]]/g, '_');
          
          XLSX.utils.book_append_sheet(workbook, statementSheet, sheetName);
        }
      });
    }

    console.log('📦 Writing workbook to buffer...');
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log('✅ Excel file created successfully');

    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Vendor_Statements_${period || new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });

  } catch (error) {
    console.error('❌ Vendor statements Excel export error:', error);
    return c.json({ 
      error: 'Excel export failed', 
      details: error.message 
    }, 500);
  }
});

// Get AP Reconciliation History
app.get("/make-server-53c2e113/ap-rec-history", async (c) => {
  try {
    console.log('📜 Fetching AP reconciliation history...');
    
    // Query database directly
    const { createClient } = await import("jsr:@supabase/supabase-js@2.49.8");
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    const { data, error } = await supabase
      .from('kv_store_53c2e113')
      .select('key, value')
      .like('key', 'ap_rec_%')
      .order('key', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    
    console.log('📊 Raw data from database:', JSON.stringify(data, null, 2));
    
    const sortedHistory = (data || [])
      .filter(entry => {
        // Only include actual history entries, not job status entries
        if (!entry.key.startsWith('ap_rec_')) return false;
        if (entry.key.includes('job_')) return false;
        if (!entry.value || typeof entry.value !== 'object') return false;
        if (!entry.value.summary) return false;
        return true;
      })
      .map(entry => {
        console.log('📝 Processing entry:', entry.key, {
          timestamp: entry.value.timestamp,
          vendorFileName: entry.value.vendorFileName,
          apFileName: entry.value.apFileName,
          hasSummary: !!entry.value.summary
        });
        
        const timestamp = entry.value.timestamp || Date.now();
        let dateString;
        try {
          dateString = new Date(timestamp).toISOString();
        } catch (e) {
          console.warn('Invalid timestamp for entry:', entry.key, timestamp);
          dateString = new Date().toISOString();
        }
        return {
          id: entry.key,
          timestamp: timestamp,
          date: dateString,
          vendorFileName: entry.value.vendorFileName || 'Unknown',
          apFileName: entry.value.apFileName || 'Unknown',
          summary: entry.value.summary
        };
      });
    
    console.log(`✅ Found ${sortedHistory.length} AP reconciliation history entries`);
    console.log('📋 History entries:', JSON.stringify(sortedHistory, null, 2));
    
    return c.json({ history: sortedHistory });
  } catch (error) {
    console.error('❌ Failed to fetch AP history:', error);
    return c.json({ error: 'Failed to fetch AP reconciliation history', details: error.message }, 500);
  }
});

// Get Single AP Reconciliation Result by ID
app.get("/make-server-53c2e113/ap-rec-result/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log('📖 Fetching AP reconciliation:', id);
    
    const data = await kv.get(id);
    
    if (!data) {
      return c.json({ error: 'AP reconciliation not found' }, 404);
    }
    
    console.log('✅ AP reconciliation found');
    
    return c.json({
      result: {
        summary: data.summary,
        exact_matches: data.exact_matches || [],
        one_to_many_matches: data.one_to_many_matches || [],
        many_to_one_matches: data.many_to_one_matches || [],
        fuzzy_matches: data.fuzzy_matches || [],
        missing_in_internal: data.missing_in_internal || [],
        extra_in_internal: data.extra_in_internal || []
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch AP reconciliation:', error);
    return c.json({ error: 'Failed to fetch AP reconciliation' }, 500);
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

    // Parse card transactions CSV
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
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid call stack overflow
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode(...chunk);
      }
      const base64Data = btoa(binaryString);
      
      // Determine MIME type
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
        
        // Parse JSON from AI response
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
        
        // Match by amount (exact or within 0.50)
        const amountDiff = Math.abs(transaction.amount - receipt.total);
        if (amountDiff > 0.50) continue;

        // Match by date (within ±2 days)
        const transactionDate = new Date(transaction.date);
        const receiptDate = new Date(receipt.date);
        const daysDiff = Math.abs((transactionDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 2) continue;

        // Calculate similarity score
        let score = 0;
        if (amountDiff < 0.01) score += 50; // Exact amount match
        else score += (1 - amountDiff) * 20;
        
        if (daysDiff === 0) score += 30; // Same day
        else score += (1 - daysDiff / 2) * 20;

        // Merchant name similarity (simple contains check)
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

    // Find orphaned receipts (receipts with no matching transaction)
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
    return c.json({ 
      error: 'Expense reconciliation failed', 
      details: error.message 
    }, 500);
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
      // Escape quotes and wrap in quotes if contains comma/quote/newline
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')).join('\n');

    console.log('✅ CSV file generated successfully');

    // Return as downloadable file
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Expense_Report_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('❌ Expense CSV export error:', error);
    return c.json({ 
      error: 'CSV export failed', 
      details: error.message 
    }, 500);
  }
});

// ============================================================================
// CHART OF ACCOUNTS ENDPOINTS
// ============================================================================

// Get Company Chart of Accounts
app.get("/make-server-53c2e113/companies/:companyId/coa", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    console.log('📊 Fetching COA for company:', companyId);

    const data = await kv.get(`company_coa_${companyId}`);
    
    if (!data) {
      // Return empty COA if not configured yet
      console.log('⚠️ No COA found for company, returning empty array');
      return c.json({ accounts: [] });
    }

    console.log(`✅ Found ${data.accounts?.length || 0} accounts for company`);
    return c.json(data);

  } catch (error) {
    console.error('❌ Failed to fetch COA:', error);
    return c.json({ 
      error: 'Failed to fetch chart of accounts', 
      details: error.message 
    }, 500);
  }
});

// Save Company Chart of Accounts
app.post("/make-server-53c2e113/companies/:companyId/coa", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const { accounts } = await c.req.json();
    
    console.log('💾 Saving COA for company:', companyId, '- Accounts:', accounts.length);

    await kv.set(`company_coa_${companyId}`, { accounts });

    console.log('✅ COA saved successfully');
    return c.json({ success: true, accountCount: accounts.length });

  } catch (error) {
    console.error('❌ Failed to save COA:', error);
    return c.json({ 
      error: 'Failed to save chart of accounts', 
      details: error.message 
    }, 500);
  }
});

// ============================================================================
// JOURNAL ENTRIES ENDPOINTS
// ============================================================================

// Get Company Journal Entries
app.get("/make-server-53c2e113/companies/:companyId/journal-entries", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    console.log('📝 Fetching journal entries for company:', companyId);

    const data = await kv.get(`company_journal_entries_${companyId}`);
    
    if (!data) {
      console.log('⚠️ No journal entries found for company, returning empty array');
      return c.json({ entries: [] });
    }

    console.log(`✅ Found ${data.entries?.length || 0} entries for company`);
    return c.json(data);

  } catch (error) {
    console.error('❌ Failed to fetch journal entries:', error);
    return c.json({ 
      error: 'Failed to fetch journal entries', 
      details: error.message 
    }, 500);
  }
});

// Save Company Journal Entry
app.post("/make-server-53c2e113/companies/:companyId/journal-entries", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const newEntry = await c.req.json();
    
    console.log('💾 Saving journal entry for company:', companyId);

    // Get existing entries
    const existing = await kv.get(`company_journal_entries_${companyId}`) || { entries: [] };
    const entries = existing.entries || [];

    // Add new entry
    entries.push(newEntry);

    // Save back
    await kv.set(`company_journal_entries_${companyId}`, { entries });

    console.log('✅ Journal entry saved successfully');
    return c.json({ success: true, entryId: newEntry.id });

  } catch (error) {
    console.error('❌ Failed to save journal entry:', error);
    return c.json({ 
      error: 'Failed to save journal entry', 
      details: error.message 
    }, 500);
  }
});

// Generate Journal Entry with AI
app.post("/make-server-53c2e113/journal-entries/generate", async (c) => {
  try {
    const { prompt, chartOfAccounts } = await c.req.json();
    console.log('🤖 Generating journal entry from prompt:', prompt);

    const systemPrompt = `You are an expert accountant. Generate a valid journal entry based on the user's request.

Chart of Accounts:
${chartOfAccounts.map((acc: any) => `${acc.code} - ${acc.name} (${acc.type})`).join('\n')}

Rules:
1. Debits MUST equal Credits (balanced entry)
2. Use only accounts from the provided Chart of Accounts
3. Follow double-entry bookkeeping principles
4. Assets/Expenses increase with Debits
5. Liabilities/Equity/Revenue increase with Credits

Return ONLY valid JSON in this exact format:
{
  "description": "Brief description of the entry",
  "lines": [
    {
      "account": "account code",
      "accountName": "account name",
      "debit": number or 0,
      "credit": number or 0,
      "memo": "optional memo"
    }
  ]
}`;

    const userPrompt = `Create a journal entry for: ${prompt}

Remember: Debits MUST equal Credits. Return ONLY the JSON, no other text.`;

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error('AI generation failed');
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse JSON from response
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in response:', content);
      throw new Error('Invalid AI response format');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    // Validate the result
    const debitTotal = result.lines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
    const creditTotal = result.lines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);
    
    if (Math.abs(debitTotal - creditTotal) > 0.01) {
      console.error('❌ Generated entry is not balanced:', { debitTotal, creditTotal });
      throw new Error('Generated entry is not balanced');
    }

    console.log('✅ Generated journal entry successfully');
    return c.json(result);

  } catch (error) {
    console.error('❌ Journal entry generation error:', error);
    return c.json({ 
      error: 'Failed to generate journal entry', 
      details: error.message 
    }, 500);
  }
});

// Save/Post Journal Entry
app.post("/make-server-53c2e113/journal-entries", async (c) => {
  try {
    const entry = await c.req.json();
    console.log('💾 Saving journal entry:', entry.id);

    // Validate entry is balanced
    const debitTotal = entry.lines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
    const creditTotal = entry.lines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);
    
    if (Math.abs(debitTotal - creditTotal) > 0.01) {
      return c.json({ error: 'Entry is not balanced' }, 400);
    }

    // Save to database
    await kv.set(`journal_entry_${entry.id}`, entry);

    console.log('✅ Journal entry saved successfully');
    return c.json({ success: true, id: entry.id });

  } catch (error) {
    console.error('❌ Failed to save journal entry:', error);
    return c.json({ 
      error: 'Failed to save journal entry', 
      details: error.message 
    }, 500);
  }
});

// NOTE: The GET /journal-entries endpoint has been moved to journal-entries-routes.tsx
// to support the new journal entries workflow with Draft/Ready/Posted tabs.
// The old endpoint that returned all posted entries has been removed to avoid route conflicts.

// Export Journal Entries to Excel
app.get("/make-server-53c2e113/journal-entries/export", async (c) => {
  try {
    console.log('📊 Exporting journal entries to Excel...');

    const allEntries = await kv.getByPrefix('journal_entry_');
    console.log('📋 Retrieved entries from DB:', allEntries.length);
    
    let entries = allEntries
      .filter((entry: any) => entry && entry.status === 'posted')
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    // If no entries, create a sample entry for export
    if (entries.length === 0) {
      console.log('⚠️ No journal entries found, creating sample export...');
      entries = [{
        id: 'SAMPLE',
        date: new Date().toISOString().split('T')[0],
        description: 'No journal entries have been posted yet',
        createdAt: Date.now(),
        lines: [{
          account: '-',
          accountName: 'No entries',
          debit: 0,
          credit: 0,
          memo: 'Create and post journal entries to see them here'
        }]
      }];
    }

    console.log('📝 Processing', entries.length, 'entries for export');

    // Import xlsx
    const XLSX = await import('npm:xlsx');
    console.log('✅ XLSX library loaded');

    // Flatten entries into rows
    const rows = [];
    for (const entry of entries) {
      for (const line of entry.lines) {
        rows.push({
          'Entry ID': entry.id,
          'Date': new Date(entry.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          'Description': entry.description,
          'Account Code': line.account,
          'Account Name': line.accountName,
          'Debit': line.debit || 0,
          'Credit': line.credit || 0,
          'Memo': line.memo || '',
          'Posted Date': new Date(entry.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        });
      }
    }

    console.log('📊 Created', rows.length, 'rows for Excel');

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(rows);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Entry ID
      { wch: 12 }, // Date
      { wch: 30 }, // Description
      { wch: 12 }, // Account Code
      { wch: 25 }, // Account Name
      { wch: 12 }, // Debit
      { wch: 12 }, // Credit
      { wch: 30 }, // Memo
      { wch: 18 }, // Posted Date
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Journal Entries');

    console.log('📦 Generating Excel buffer...');
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log('✅ Excel export generated successfully');

    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Journal_Entries_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });

  } catch (error) {
    console.error('❌ Journal entries export error:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ 
      error: 'Export failed', 
      details: error.message,
      stack: error.stack 
    }, 500);
  }
});

// Mount API routes for DevPortal (mounted LAST to avoid route conflicts)
// Note: All route files have basePath('/make-server-53c2e113') so they mount at root
app.route('/', authRoutes);
app.route('/', routes);
app.route('/', monthEndCloseRoutes);
app.route('/', bankRecRoutes);
app.route('/', apRecRoutes);
app.route('/', arRecRoutes);
app.route('/', journalEntriesRoutes);
app.route('/', receiptRoutes);
app.route('/', ccRecRoutes);
app.route('/', trialBalanceRoutes);

// ============================================
// RECEIPT EXTRACTION API
// ============================================

// Upload and extract receipt data
app.post("/make-server-53c2e113/api/receipts/upload", async (c) => {
  try {
    console.log('📄 Receipt upload started');
    
    const formData = await c.req.formData();
    const companyId = formData.get('companyId') as string;
    const file = formData.get('file') as File;

    if (!companyId) {
      return c.json({ error: 'Company ID is required' }, 400);
    }

    if (!file) {
      return c.json({ error: 'Receipt file is required' }, 400);
    }

    console.log('📎 Processing receipt:', file.name, 'for company:', companyId);

    // Read file and convert to base64 safely (handles large files)
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid call stack overflow
    let binaryString = '';
    const chunkSize = 8192; // Process 8KB at a time
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const base64Data = btoa(binaryString);
    
    // Determine MIME type - be very permissive for customer uploads
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      // Guess MIME type from file extension
      const ext = file.name.toLowerCase().split('.').pop();
      const mimeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'heic': 'image/heic',
        'heif': 'image/heif',
        'tiff': 'image/tiff',
        'tif': 'image/tiff',
        'pdf': 'application/pdf',
      };
      mimeType = mimeMap[ext || ''] || 'image/jpeg'; // Default to JPEG
    }

    console.log('📷 File MIME type:', mimeType, '| Size:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');

    const imageUrl = `data:${mimeType};base64,${base64Data}`;

    // Extract data using OpenAI Vision
    console.log('🤖 Calling OpenAI to extract receipt data...');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

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
            content: 'You are an expert at extracting structured data from receipts. Extract all relevant information accurately. Return ONLY valid JSON, no markdown or explanations.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract the following data from this receipt:
- merchant: The store/business name (string)
- date: Transaction date in YYYY-MM-DD format (string)
- total: Total amount paid (number)
- subtotal: Subtotal before tax (number, if present)
- tax: Tax/VAT amount (number, if present)
- taxRate: Tax/VAT rate as a percentage (number, if shown on receipt, e.g., 8.0 for 8%)
- category: Expense category. For general retailers (Walmart, Target, Amazon, Costco, Marshalls), categorize based on items purchased. String, one of: "Office Supplies", "Meals & Entertainment", "Travel & Transportation", "Software & Subscriptions", "Utilities", "Professional Services", "Marketing", "Personal/Non-Deductible", "Other"
- paymentMethod: How it was paid (string, e.g., "Credit Card", "Cash", "Debit Card")
- items: Array of line items, each with:
  - description: Item description (string)
  - amount: Item amount (number)
  - quantity: Quantity if shown (number, optional)

Return ONLY a JSON object with these fields. Be accurate with numbers and dates.`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API failed: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('🤖 OpenAI response:', content);
    
    // Parse JSON from AI response
    let extracted;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extracted = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      throw new Error('Failed to parse receipt data');
    }

    // Upload file to Supabase Storage
    const bucketName = 'make-53c2e113-receipts';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Create bucket if it doesn't exist
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      if (!bucketExists) {
        console.log('📦 Creating receipts storage bucket...');
        await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 20971520, // 20MB
        });
        console.log('✅ Storage bucket created');
      }
    } catch (bucketError) {
      console.error('⚠️ Bucket creation error (may already exist):', bucketError);
    }

    // Upload file to storage
    const receiptId = crypto.randomUUID();
    
    // Sanitize filename - remove special characters and spaces
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    
    const filePath = `${companyId}/${receiptId}-${sanitizedFileName}`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      throw new Error(`Failed to upload receipt: ${uploadError.message}`);
    }

    console.log('✅ Receipt file uploaded to storage:', filePath);

    // Create receipt record
    const receipt = {
      id: receiptId,
      companyId,
      merchant: extracted.merchant || 'Unknown Merchant',
      date: extracted.date || new Date().toISOString().split('T')[0],
      total: parseFloat(extracted.total) || 0,
      subtotal: parseFloat(extracted.subtotal) || 0,
      tax: parseFloat(extracted.tax) || 0,
      taxRate: parseFloat(extracted.taxRate) || null,
      category: extracted.category || 'Other',
      paymentMethod: extracted.paymentMethod || 'Credit Card',
      status: 'pending',
      items: extracted.items || [],
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
      filePath: filePath,
      extractedData: extracted,
    };

    // Save to KV store
    console.log('💾 Saving receipt to KV with filePath:', filePath);
    console.log('💾 Receipt object:', JSON.stringify(receipt, null, 2));
    await kv.set(`receipt:${companyId}:${receiptId}`, receipt);
    
    console.log('✅ Receipt saved:', receiptId);
    
    // Verify it was saved correctly
    const savedReceipt = await kv.get(`receipt:${companyId}:${receiptId}`);
    console.log('🔍 Verification - Retrieved receipt:', JSON.stringify(savedReceipt, null, 2));
    if (!savedReceipt?.filePath) {
      console.error('⚠️ WARNING: Receipt was saved but filePath is missing after retrieval!');
    }

    return c.json({
      success: true,
      receipt,
      debug: {
        hasFilePath: !!receipt.filePath,
        filePath: receipt.filePath,
        receiptId: receipt.id
      }
    });

  } catch (error) {
    console.error('❌ Receipt upload error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause
    });
    return c.json({
      error: 'Failed to process receipt',
      details: error.message,
      errorType: error.name
    }, 500);
  }
});

// Get all receipts for a company
app.get("/make-server-53c2e113/api/receipts/:companyId", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    console.log('📋 Fetching receipts for company:', companyId);

    const receipts = await kv.getByPrefix(`receipt:${companyId}:`);
    
    console.log(`✅ Found ${receipts.length} receipts`);
    return c.json({ receipts });

  } catch (error) {
    console.error('❌ Error fetching receipts:', error);
    return c.json({
      error: 'Failed to fetch receipts',
      details: error.message
    }, 500);
  }
});

// Update receipt details (status, category, payment method)
app.patch("/make-server-53c2e113/api/receipts/:companyId/:receiptId", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const receiptId = c.req.param('receiptId');
    const updates = await c.req.json();

    console.log(`📝 Updating receipt ${receiptId}:`, updates);

    const receipt = await kv.get(`receipt:${companyId}:${receiptId}`);
    
    if (!receipt) {
      return c.json({ error: 'Receipt not found' }, 404);
    }

    // Update allowed fields
    if (updates.status !== undefined) receipt.status = updates.status;
    if (updates.category !== undefined) receipt.category = updates.category;
    if (updates.paymentMethod !== undefined) receipt.paymentMethod = updates.paymentMethod;
    
    receipt.updatedAt = new Date().toISOString();

    await kv.set(`receipt:${companyId}:${receiptId}`, receipt);

    console.log('✅ Receipt updated');
    return c.json({ success: true, receipt });

  } catch (error) {
    console.error('❌ Error updating receipt:', error);
    return c.json({
      error: 'Failed to update receipt',
      details: error.message
    }, 500);
  }
});

// Delete receipt
app.delete("/make-server-53c2e113/api/receipts/:companyId/:receiptId", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const receiptId = c.req.param('receiptId');

    console.log(`🗑️ Deleting receipt ${receiptId}`);

    // Get receipt to find filePath
    const receipt = await kv.get(`receipt:${companyId}:${receiptId}`);
    
    // Delete file from storage
    if (receipt && receipt.filePath) {
      const bucketName = 'make-53c2e113-receipts';
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await supabase.storage.from(bucketName).remove([receipt.filePath]);
      console.log('🗑️ Deleted file from storage:', receipt.filePath);
    }

    await kv.del(`receipt:${companyId}:${receiptId}`);

    console.log('✅ Receipt deleted');
    return c.json({ success: true });

  } catch (error) {
    console.error('❌ Error deleting receipt:', error);
    return c.json({
      error: 'Failed to delete receipt',
      details: error.message
    }, 500);
  }
});

// Get signed URL to view receipt file
app.get("/make-server-53c2e113/api/receipts/:companyId/:receiptId/view", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const receiptId = c.req.param('receiptId');

    console.log(`👁️ Getting view URL for receipt ${receiptId} in company ${companyId}`);

    // Get receipt to find filePath or imageUrl
    const receipt = await kv.get(`receipt:${companyId}:${receiptId}`);
    
    console.log('📄 Receipt data:', JSON.stringify(receipt, null, 2));
    
    if (!receipt) {
      console.error('❌ Receipt not found in KV store');
      return c.json({ error: 'Receipt not found' }, 404);
    }
    
    // Check if receipt has filePath (from storage) or imageUrl (signed URL)
    if (receipt.filePath) {
      // Receipt is in storage, create fresh signed URL
      const bucketName = 'make-53c2e113-receipts';
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      
      console.log('📦 Getting signed URL from bucket:', bucketName, 'path:', receipt.filePath);
      
      const { data: signedUrlData, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(receipt.filePath, 3600);
      
      if (error) {
        console.error('❌ Error creating signed URL:', error);
        return c.json({ 
          error: 'Failed to create view URL', 
          details: error.message 
        }, 500);
      }

      console.log('✅ Created signed URL for receipt');
      return c.json({ 
        url: signedUrlData.signedUrl,
        fileName: receipt.fileName
      });
    } else if (receipt.imageUrl) {
      // Receipt has a signed URL already (legacy or from email)
      console.log('✅ Using existing imageUrl for receipt');
      return c.json({ 
        url: receipt.imageUrl,
        fileName: receipt.fileName
      });
    } else {
      console.error('❌ Receipt has no filePath or imageUrl - it may have been uploaded before storage was enabled');
      return c.json({ error: 'Receipt file not available. Please re-upload this receipt.' }, 404);
    }

  } catch (error) {
    console.error('❌ Error getting receipt view URL:', error);
    return c.json({
      error: 'Failed to get receipt view URL',
      details: error.message
    }, 500);
  }
});

// Export receipts to XLSX
app.post("/make-server-53c2e113/api/receipts/export/xlsx", async (c) => {
  try {
    const body = await c.req.json();
    const receipts = body.receipts || [];

    if (receipts.length === 0) {
      return c.json({ error: 'No receipts to export' }, 400);
    }

    console.log(`📊 Exporting ${receipts.length} receipts to XLSX`);

    // Prepare data for Excel
    const worksheetData = receipts.map((receipt) => ({
      'Date': receipt.date,
      'Merchant': receipt.merchant,
      'Category': receipt.category,
      'Payment Method': receipt.paymentMethod || '',
      'Tax Rate': receipt.taxRate ? `${(receipt.taxRate * 100).toFixed(0)}%` : '',
      'Tax': (receipt.tax || receipt.taxAmount || 0).toFixed(2),
      'Subtotal': (receipt.subtotal || 0).toFixed(2),
      'Total': (receipt.total || receipt.amount || 0).toFixed(2),
      'Status': receipt.status,
      'File Name': receipt.fileName,
      'Source': receipt.source || 'upload',
      'Uploaded At': receipt.uploadedAt
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Receipts');

    // Auto-size columns
    const maxWidth = 50;
    const columnWidths = Object.keys(worksheetData[0] || {}).map(key => ({
      wch: Math.min(
        Math.max(
          key.length,
          ...worksheetData.map(row => String(row[key] || '').length)
        ),
        maxWidth
      )
    }));
    worksheet['!cols'] = columnWidths;

    // Generate XLSX file
    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log('✅ XLSX file generated successfully');

    // Return the file with proper headers
    return c.body(xlsxBuffer, 200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="receipts_export_${new Date().toISOString().split('T')[0]}.xlsx"`,
    });

  } catch (error) {
    console.error('❌ Error exporting to XLSX:', error);
    return c.json({
      error: 'Failed to export to XLSX',
      details: error.message
    }, 500);
  }
});

Deno.serve(app.fetch);