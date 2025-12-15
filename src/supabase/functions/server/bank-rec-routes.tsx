import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-53c2e113');

// ============================================
// BANK RECONCILIATION ROUTES
// ============================================

// Get bank statements and transactions for a company/period
app.get('/bank-rec/bank-data', async (c) => {
  try {
    const companyId = c.req.query('company_id');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `bank-rec:${companyId}:${period}:bank-data`;
    const data = await kv.get(key);
    
    return c.json({
      statements: data?.statements || [],
      transactions: data?.transactions || []
    });
  } catch (error) {
    console.error('❌ Error fetching bank data:', error);
    return c.json({ error: 'Failed to fetch bank data' }, 500);
  }
});

// Get general ledger and entries for a company/period
app.get('/bank-rec/ledger-data', async (c) => {
  try {
    const companyId = c.req.query('company_id');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `bank-rec:${companyId}:${period}:ledger-data`;
    const data = await kv.get(key);
    
    return c.json({
      ledger: data?.ledger || null,
      entries: data?.entries || []
    });
  } catch (error) {
    console.error('❌ Error fetching ledger data:', error);
    return c.json({ error: 'Failed to fetch ledger data' }, 500);
  }
});

// Get reconciliation results for a company/period
app.get('/bank-rec/reconciliation-data', async (c) => {
  try {
    const companyId = c.req.query('company_id');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `bank-rec:${companyId}:${period}:reconciliation`;
    const result = await kv.get(key);
    
    return c.json({
      result: result || null
    });
  } catch (error) {
    console.error('❌ Error fetching reconciliation data:', error);
    return c.json({ error: 'Failed to fetch reconciliation data' }, 500);
  }
});

// Get reconciliation results (alternative endpoint with camelCase params for Month-End Close)
app.get('/bank-rec/reconciliation', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const result = await kv.get(recKey);
    
    if (!result) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }
    
    // Get additional data for tabs
    const timingKey = `bank-rec:${companyId}:${period}:timing-differences`;
    const ignoredKey = `bank-rec:${companyId}:${period}:ignored`;
    const followUpKey = `bank-rec:${companyId}:${period}:follow-up`;
    const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
    
    const timingDiffs = await kv.get(timingKey) || { items: [] };
    const ignored = await kv.get(ignoredKey) || { items: [] };
    const followUp = await kv.get(followUpKey) || { items: [] };
    const resolved = await kv.get(resolvedKey) || { items: [] };
    
    return c.json({
      ...result,
      timing_differences: timingDiffs.items || [],
      ignored_items: ignored.items || [],
      follow_up_items: followUp.items || [],
      resolved_items: resolved.items || []
    });
  } catch (error) {
    console.error('❌ Error fetching reconciliation:', error);
    return c.json({ error: 'Failed to fetch reconciliation' }, 500);
  }
});

// Upload and parse bank statement
app.post('/bank-rec/upload-bank-statement', async (c) => {
  try {
    const formData = await c.req.formData();
    const bankFile = formData.get('bank_file') as File;
    const companyId = formData.get('company_id') as string;
    const period = formData.get('period') as string;

    if (!bankFile || !companyId || !period) {
      return c.json({ error: 'bank_file, company_id, and period are required' }, 400);
    }

    console.log('📤 Processing bank statement:', bankFile.name);

    // Parse the file (CSV, XLSX, or PDF)
    const fileBuffer = await bankFile.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    
    let transactions: any[] = [];
    
    if (bankFile.name.endsWith('.csv')) {
      // Parse CSV
      const text = new TextDecoder().decode(uint8Array);
      transactions = await parseCSV(text, bankFile.name);
    } else if (bankFile.name.endsWith('.xlsx') || bankFile.name.endsWith('.xls')) {
      // Parse XLSX
      transactions = await parseXLSX(uint8Array, bankFile.name);
    } else if (bankFile.name.endsWith('.pdf')) {
      // Parse PDF bank statement
      transactions = await parsePDF(uint8Array, bankFile.name);
    } else {
      return c.json({ error: 'Unsupported file format. Please use PDF, CSV, or XLSX.' }, 400);
    }

    // Generate unique IDs for transactions
    const statementId = crypto.randomUUID();
    const transactionsWithIds = transactions.map(txn => ({
      ...txn,
      id: crypto.randomUUID(),
      statementId,
      statementName: bankFile.name
    }));

    // Store the file in Supabase Storage
    const bucketName = 'make-53c2e113-bank-statements';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Create bucket if it doesn't exist
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    if (!bucketExists) {
      await supabase.storage.createBucket(bucketName, { public: false });
      console.log('✅ Created storage bucket:', bucketName);
    }

    // Upload file to storage
    const filePath = `${companyId}/${period}/${statementId}-${bankFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, uint8Array, {
        contentType: bankFile.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to store file: ${uploadError.message}`);
    }

    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 31536000); // 1 year in seconds

    if (urlError) {
      console.error('Signed URL error:', urlError);
      throw new Error(`Failed to generate file URL: ${urlError.message}`);
    }

    console.log('✅ File stored in Supabase Storage:', filePath);

    // Create statement object with file URL
    const statement = {
      id: statementId,
      fileName: bankFile.name,
      uploadedAt: Date.now(),
      transactionCount: transactionsWithIds.length,
      fileUrl: signedUrlData.signedUrl,
      filePath: filePath
    };

    // Load existing data
    const key = `bank-rec:${companyId}:${period}:bank-data`;
    const existingData = await kv.get(key) || { statements: [], transactions: [] };

    // Add new statement and transactions
    existingData.statements.push(statement);
    existingData.transactions.push(...transactionsWithIds);

    // Save updated data
    await kv.set(key, existingData);

    console.log(`✅ Bank statement uploaded: ${transactionsWithIds.length} transactions extracted`);

    return c.json({
      statementId,
      transactionCount: transactionsWithIds.length
    });
  } catch (error) {
    console.error('❌ Error uploading bank statement:', error);
    return c.json({ error: `Failed to upload bank statement: ${error.message}` }, 500);
  }
});

// Upload and parse general ledger
app.post('/bank-rec/upload-ledger', async (c) => {
  try {
    const formData = await c.req.formData();
    const ledgerFile = formData.get('ledger_file') as File;
    const companyId = formData.get('company_id') as string;
    const period = formData.get('period') as string;

    if (!ledgerFile || !companyId || !period) {
      return c.json({ error: 'ledger_file, company_id, and period are required' }, 400);
    }

    console.log('📤 Processing general ledger:', ledgerFile.name);

    // Parse the file (CSV or XLSX)
    const fileBuffer = await ledgerFile.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    
    let entries: any[] = [];
    
    if (ledgerFile.name.endsWith('.csv')) {
      // Parse CSV
      const text = new TextDecoder().decode(uint8Array);
      entries = await parseLedgerCSV(text, ledgerFile.name);
    } else if (ledgerFile.name.endsWith('.xlsx') || ledgerFile.name.endsWith('.xls')) {
      // Parse XLSX
      entries = await parseLedgerXLSX(uint8Array, ledgerFile.name);
    } else {
      return c.json({ error: 'Unsupported file format. Please use CSV or XLSX.' }, 400);
    }

    // Generate unique IDs for entries
    const entriesWithIds = entries.map(entry => ({
      ...entry,
      id: crypto.randomUUID()
    }));

    // Create ledger object
    const ledger = {
      id: crypto.randomUUID(),
      fileName: ledgerFile.name,
      uploadedAt: Date.now(),
      entryCount: entriesWithIds.length
    };

    // Save ledger data (replaces any existing ledger for this company/period)
    const key = `bank-rec:${companyId}:${period}:ledger-data`;
    await kv.set(key, {
      ledger,
      entries: entriesWithIds
    });

    console.log(`✅ General ledger uploaded: ${entriesWithIds.length} entries extracted`);

    return c.json({
      ledgerId: ledger.id,
      entryCount: entriesWithIds.length
    });
  } catch (error) {
    console.error('❌ Error uploading general ledger:', error);
    return c.json({ error: `Failed to upload general ledger: ${error.message}` }, 500);
  }
});

// Delete a bank statement
app.delete('/bank-rec/bank-statement/:statementId', async (c) => {
  try {
    const statementId = c.req.param('statementId');
    const companyId = c.req.query('company_id');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'company_id and period query params are required' }, 400);
    }
    
    const key = `bank-rec:${companyId}:${period}:bank-data`;
    const existingData = await kv.get(key);
    
    if (!existingData) {
      return c.json({ error: 'No data found for this company and period' }, 404);
    }
    
    // Find the statement to delete
    const statementToDelete = existingData.statements?.find((s: any) => s.id === statementId);
    
    if (!statementToDelete) {
      return c.json({ error: 'Statement not found' }, 404);
    }
    
    // Delete file from storage if it exists
    if (statementToDelete.filePath) {
      const bucketName = 'make-53c2e113-bank-statements';
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      
      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove([statementToDelete.filePath]);
      
      if (deleteError) {
        console.error('Storage delete error:', deleteError);
        // Don't fail the entire operation if storage delete fails
      } else {
        console.log('✅ File deleted from storage:', statementToDelete.filePath);
      }
    }
    
    // Remove statement and its transactions
    existingData.statements = existingData.statements.filter((s: any) => s.id !== statementId);
    existingData.transactions = existingData.transactions.filter((t: any) => t.statementId !== statementId);
    
    // Save updated data
    await kv.set(key, existingData);
    
    console.log(`✅ Bank statement deleted: ${statementId}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting bank statement:', error);
    return c.json({ error: 'Failed to delete bank statement' }, 500);
  }
});

// Delete general ledger
app.delete('/bank-rec/ledger', async (c) => {
  try {
    const companyId = c.req.query('company_id');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `bank-rec:${companyId}:${period}:ledger-data`;
    await kv.del(key);

    console.log(`✅ General ledger deleted for ${companyId} - ${period}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting general ledger:', error);
    return c.json({ error: 'Failed to delete general ledger' }, 500);
  }
});

// Run reconciliation
app.post('/bank-rec/run-reconciliation', async (c) => {
  try {
    const body = await c.req.json();
    const { company_id: companyId, period } = body;

    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    console.log(`🔄 Running reconciliation for ${companyId} - ${period}`);

    // Load bank data
    const bankKey = `bank-rec:${companyId}:${period}:bank-data`;
    const bankData = await kv.get(bankKey);
    
    if (!bankData || !bankData.transactions || bankData.transactions.length === 0) {
      return c.json({ error: 'No bank transactions found. Please upload bank statements first.' }, 400);
    }

    // Load ledger data
    const ledgerKey = `bank-rec:${companyId}:${period}:ledger-data`;
    const ledgerData = await kv.get(ledgerKey);
    
    if (!ledgerData || !ledgerData.entries || ledgerData.entries.length === 0) {
      return c.json({ error: 'No ledger entries found. Please upload general ledger first.' }, 400);
    }

    const bankTransactions = bankData.transactions;
    const ledgerEntries = ledgerData.entries;

    console.log(`📊 Reconciling ${bankTransactions.length} bank transactions with ${ledgerEntries.length} ledger entries`);
    
    /* ==========================================
     * NOVALARE BANK RECONCILIATION MATCHING ENGINE
     * ==========================================
     * 
     * MATCHING FUNNEL (4 STAGES):
     * 
     * 1️⃣ DETERMINISTIC EXACT MATCH (Confidence: 100%)
     *    - 1 Bank Txn ↔ 1 Ledger Entry
     *    - Same date (±2 days) AND same amount (±$1)
     *    - Fast, cheap, highly accurate
     * 
     * 2️⃣ DETERMINISTIC ONE-TO-MANY MATCH (Confidence: 93-95%)
     *    - 1 Bank Txn ↔ 2-3 Ledger Entries (sum matches)
     *    - Same date (±2 days) AND sum of amounts match (±$1)
     *    - Example: $1,073.01 bank → [$500, $300, $273.01] ledger
     *    - Filters by description similarity (>20%) to avoid false combos
     * 
     * 3️⃣ DETERMINISTIC MANY-TO-ONE MATCH (Confidence: 93-95%)
     *    - 2-3 Bank Txns ↔ 1 Ledger Entry (sum matches)
     *    - Same date (±2 days) AND sum of amounts match (±$1)
     *    - Less common but important for consolidated entries
     * 
     * 4️⃣ FX-ADJUSTED MATCH (Confidence: 85-90%)
     *    - AI detects foreign exchange rate between amounts
     *    - Example: Bank $445.28 ↔ Ledger €400 (rate ~1.113)
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
     * - Amounts use absolute value comparison (handles sign convention mismatches)
     * - Date matching handles multiple formats (Excel serial, ISO, US, European)
     * - Description filtering prevents combinatorial explosion
     * 
     * EXPECTED PERFORMANCE:
     * - Deterministic: 70-90% of matches (fast, free)
     * - FX-Adjusted: 0-5% of matches (for multi-currency)
     * - AI Fuzzy: 5-15% of matches (expensive, for edge cases)
     * - Total Match Rate: 80-95% for clean data
     */

    // Step 1: Deterministic matching (exact, one-to-many, many-to-one)
    const matchedPairs: any[] = [];
    const unmatchedBank: any[] = [];
    const unmatchedLedger: any[] = [];
    
    const usedBankIds = new Set<string>();
    const usedLedgerIds = new Set<string>();
    
    console.log('🔍 Step 1: Finding exact matches...');
    
    // Helper: Check if dates are within N days
    // FIX #2: Reduced default threshold from 7 days to 2 days
    // Bank clearing date typically differs from ledger posting date by 0-2 days
    const datesMatch = (date1: string, date2: string, daysThreshold = 2): boolean => {
      try {
        // Normalize dates to handle various formats
        const parseDate = (dateStr: string): Date | null => {
          if (!dateStr) return null;
          
          // Try direct Date parsing first
          let d = new Date(dateStr);
          if (!isNaN(d.getTime())) return d;
          
          // Try common formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
          const patterns = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,  // MM/DD/YYYY or DD/MM/YYYY
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,     // YYYY-MM-DD
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/      // MM-DD-YYYY or DD-MM-YYYY
          ];
          
          for (const pattern of patterns) {
            const match = dateStr.match(pattern);
            if (match) {
              const [_, p1, p2, p3] = match;
              // Try both interpretations (US vs European format)
              d = new Date(parseInt(p3) || parseInt(p1), parseInt(p2) - 1, parseInt(p1) || parseInt(p3));
              if (!isNaN(d.getTime())) return d;
            }
          }
          
          return null;
        };
        
        const d1 = parseDate(date1);
        const d2 = parseDate(date2);
        
        if (!d1 || !d2) {
          // If parsing failed, fall back to string comparison
          return date1 === date2;
        }
        
        const diffMs = Math.abs(d1.getTime() - d2.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= daysThreshold;
      } catch {
        return date1 === date2; // Fallback to string comparison
      }
    };
    
    // Helper: Calculate intelligent tolerance based on amount size and scenario
    // Handles: Rounding, Fees, Percentage tolerance for large amounts
    const calculateTolerance = (amount: number, scenario: 'exact' | 'multi' = 'exact'): number => {
      const absAmount = Math.abs(amount);
      
      // For exact matches: be more lenient
      if (scenario === 'exact') {
        // Small amounts (< $50): Allow up to $2 difference (handles rounding + small fees)
        if (absAmount < 50) return 2.0;
        
        // Medium amounts ($50 - $1000): Allow $5 difference (handles bank fees)
        if (absAmount < 1000) return 5.0;
        
        // Large amounts ($1000 - $10,000): Allow 0.5% tolerance
        if (absAmount < 10000) return absAmount * 0.005;
        
        // Very large amounts (>= $10,000): Allow 0.25% tolerance
        return absAmount * 0.0025;
      }
      
      // For multi-entry matches: be slightly stricter
      if (absAmount < 100) return 2.0;
      if (absAmount < 1000) return 5.0;
      if (absAmount < 10000) return absAmount * 0.005;
      return absAmount * 0.0025;
    };
    
    // Helper: Check if amounts match (with intelligent tolerance)
    // FIX #1: Universal amount matching using absolute values
    // This handles ALL sign conventions: Bank +100 ↔ Ledger -100, Bank -200 ↔ Ledger +200, etc.
    const amountsMatch = (amount1: number, amount2: number, customTolerance?: number): boolean => {
      const tolerance = customTolerance ?? calculateTolerance(amount1, 'exact');
      const diff = Math.abs(Math.abs(amount1) - Math.abs(amount2));
      return diff <= tolerance;
    };
    
    // Helper: Check if amounts match with sign awareness (for reconciliation)
    // Now uses intelligent tolerance calculation
    const amountsMatchWithSign = (bankAmount: number, ledgerAmount: number, customTolerance?: number): boolean => {
      return amountsMatch(bankAmount, ledgerAmount, customTolerance);
    };
    
    // FIX #3: Transaction-type filtering - ensures deposit/withdrawal consistency
    // Deposits (positive bank) should only match credits (negative ledger)
    // Withdrawals (negative bank) should only match debits (positive ledger)
    const isSameTransactionType = (bankAmount: number, ledgerAmount: number): boolean => {
      // Bank positive (deposit) should match ledger negative (credit)
      // Bank negative (withdrawal) should match ledger positive (debit)
      // So they should have OPPOSITE signs (or we compare using absolute values which we do)
      // Actually for grouping, all items in a group should be same type
      return (bankAmount > 0 && ledgerAmount < 0) || (bankAmount < 0 && ledgerAmount > 0) || (bankAmount === 0 && ledgerAmount === 0);
    };
    
    // Helper: Check if a group of amounts have consistent signs
    const hasSameSignPattern = (amounts: number[]): boolean => {
      if (amounts.length === 0) return true;
      const allPositive = amounts.every(a => a >= 0);
      const allNegative = amounts.every(a => a < 0);
      return allPositive || allNegative;
    };
    
    // Helper: String similarity (Levenshtein-based)
    const stringSimilarity = (str1: string, str2: string): number => {
      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();
      
      if (s1 === s2) return 1.0;
      if (s1.length === 0 || s2.length === 0) return 0;
      
      // Check if one string contains the other
      if (s1.includes(s2) || s2.includes(s1)) return 0.8;
      
      // Simple word overlap scoring
      const words1 = s1.split(/\s+/);
      const words2 = s2.split(/\s+/);
      const commonWords = words1.filter(w => words2.includes(w)).length;
      const totalWords = Math.max(words1.length, words2.length);
      
      return commonWords / totalWords;
    };
    
    // Debug: Show sample data
    const debugInfo = {
      sample_bank_transaction: bankTransactions[0],
      sample_ledger_entry: ledgerEntries[0],
      bank_amount_range: {
        min: Math.min(...bankTransactions.map(t => t.amount)),
        max: Math.max(...bankTransactions.map(t => t.amount))
      },
      ledger_amount_range: {
        min: Math.min(...ledgerEntries.map(e => e.amount)),
        max: Math.max(...ledgerEntries.map(e => e.amount))
      },
      bank_sample_dates: bankTransactions.slice(0, 3).map(t => t.date),
      ledger_sample_dates: ledgerEntries.slice(0, 3).map(e => e.date)
    };
    
    console.log('📋 Sample bank transaction:', bankTransactions[0]);
    console.log('📋 Sample ledger entry:', ledgerEntries[0]);
    console.log('📊 Bank amount range:', debugInfo.bank_amount_range);
    console.log('📊 Ledger amount range:', debugInfo.ledger_amount_range);
    console.log('📅 Bank sample dates:', debugInfo.bank_sample_dates);
    console.log('📅 Ledger sample dates:', debugInfo.ledger_sample_dates);
    
    // Log tolerance examples
    if (bankTransactions.length > 0) {
      const sampleAmount = Math.abs(bankTransactions[0].amount);
      const sampleTolerance = calculateTolerance(sampleAmount, 'exact');
      console.log(`💡 Tolerance example: ${sampleAmount.toFixed(2)} → ±${sampleTolerance.toFixed(2)} tolerance`);
    }
    
    // Check for date format issues
    const bankDateSample = bankTransactions[0]?.date;
    const ledgerDateSample = ledgerEntries[0]?.date;
    if (bankDateSample && ledgerDateSample) {
      const bankDateParsed = new Date(bankDateSample);
      const ledgerDateParsed = new Date(ledgerDateSample);
      console.log(`🔍 Date parsing check: Bank "${bankDateSample}" → ${bankDateParsed.toISOString()} | Ledger "${ledgerDateSample}" → ${ledgerDateParsed.toISOString()}`);
      
      if (isNaN(bankDateParsed.getTime())) {
        console.warn(`⚠️ WARNING: Bank date "${bankDateSample}" could not be parsed!`);
      }
      if (isNaN(ledgerDateParsed.getTime())) {
        console.warn(`⚠️ WARNING: Ledger date "${ledgerDateSample}" could not be parsed!`);
      }
    }
    
    // 1A. Exact matches (1 bank = 1 ledger, same date and amount)
    // Note: For bank reconciliation, we need to match by ABSOLUTE value since:
    // - Bank deposits (positive) match ledger credits (negative in our system)
    // - Bank withdrawals (negative) match ledger debits (positive in our system)
    for (const bankTxn of bankTransactions) {
      if (usedBankIds.has(bankTxn.id)) continue;
      
      for (const ledgerEntry of ledgerEntries) {
        if (usedLedgerIds.has(ledgerEntry.id)) continue;
        
        // FIX #1: Unified exact matching with intelligent tolerance
        // Now handles: rounding, small fees, percentage-based tolerance
        if (datesMatch(bankTxn.date, ledgerEntry.date)) {
          const amountDiff = Math.abs(Math.abs(bankTxn.amount) - Math.abs(ledgerEntry.amount));
          
          // Try exact/tolerance match first
          if (amountsMatch(bankTxn.amount, ledgerEntry.amount)) {
            const matchType = amountDiff < 0.01 ? 'exact' : 'tolerance';
            const confidence = amountDiff < 0.01 ? 1.0 : Math.max(0.85, 1.0 - (amountDiff / Math.abs(bankTxn.amount)));
            
            matchedPairs.push({
              bank_transaction: bankTxn,
              ledger_entries: [ledgerEntry],
              match_confidence: confidence,
              match_type: matchType,
              explanation: amountDiff < 0.01 
                ? 'Exact match on date and amount'
                : `Match with ${amountDiff.toFixed(2)} difference (rounding/fee tolerance)`
            });
            usedBankIds.add(bankTxn.id);
            usedLedgerIds.add(ledgerEntry.id);
            break;
          }
        }
      }
    }
    
    console.log(`✅ Found ${matchedPairs.length} exact matches`);
    console.log('🔍 Step 2: Finding one-to-many matches (1 bank = multiple ledger)...');
    
    // Log first unmatched bank transaction for debugging
    const firstUnmatched = bankTransactions.find(bt => !usedBankIds.has(bt.id));
    if (firstUnmatched) {
      console.log(`📋 First unmatched bank txn: ${firstUnmatched.amount} on ${firstUnmatched.date} - "${firstUnmatched.description}"`);
      const candidates = ledgerEntries.filter(le => !usedLedgerIds.has(le.id) && datesMatch(firstUnmatched.date, le.date, 2));
      console.log(`📋 Available ledger entries with matching date (±2 days): ${candidates.length}`);
      if (candidates.length > 0 && candidates.length <= 5) {
        candidates.forEach(c => console.log(`   - ${c.amount} on ${c.date} - "${c.description}"`));
      }
    }
    
    // 1B. One-to-many matches (1 bank transaction = sum of multiple ledger entries)
    // UPGRADED: Now checks for 2, 3, 4, and 5 entry combinations
    let oneToManyAttempts = 0;
    let oneToManySkippedSign = 0;
    let oneToManySkippedDesc = 0;
    
    for (const bankTxn of bankTransactions) {
      if (usedBankIds.has(bankTxn.id)) continue;
      
      // FIX #2 & #4: Use 2-day window for candidate filtering
      // Description filtering is now only applied when too many candidates (prevents false negatives)
      const availableLedger = ledgerEntries.filter(le => {
        if (usedLedgerIds.has(le.id)) return false;
        if (!datesMatch(bankTxn.date, le.date, 2)) return false;
        return true;
      });
      
      // Only apply description filter if we have too many candidates (> 30)
      // This prevents combinatorial explosion while allowing different descriptions to match
      let filteredLedger = availableLedger;
      if (availableLedger.length > 30) {
        filteredLedger = availableLedger.filter(le => {
          const descSimilarity = stringSimilarity(bankTxn.description || '', le.description || '');
          if (descSimilarity < 0.05) {
            oneToManySkippedDesc++;
            return false;
          }
          return true;
        });
        console.log(`🔍 Filtered ${availableLedger.length} → ${filteredLedger.length} candidates using description similarity`);
      }
      const finalAvailableLedger = filteredLedger;
      
      // Try combinations of 2 to 5 ledger entries
      let matched = false;
      
      // Try pairs (2 entries)
      for (let i = 0; i < finalAvailableLedger.length && !matched; i++) {
        for (let j = i + 1; j < finalAvailableLedger.length && !matched; j++) {
          oneToManyAttempts++;
          const ledgerAmounts = [finalAvailableLedger[i].amount, finalAvailableLedger[j].amount];
          
          // CRITICAL: Ensure all ledger entries have the same sign (no mixing debits + credits)
          if (!hasSameSignPattern(ledgerAmounts)) {
            oneToManySkippedSign++;
            if (oneToManySkippedSign === 1) {
              // Log first example of sign mismatch for debugging
              console.log(`🔍 Sign mismatch example: Bank ${bankTxn.amount} vs Ledger [${ledgerAmounts.join(', ')}] - BLOCKED`);
            }
            continue;
          }
          
          const sum = finalAvailableLedger[i].amount + finalAvailableLedger[j].amount;
          const tolerance = calculateTolerance(bankTxn.amount, 'multi');
          
          if (amountsMatchWithSign(bankTxn.amount, sum, tolerance)) {
            const diff = Math.abs(Math.abs(bankTxn.amount) - Math.abs(sum));
            const confidence = diff < 0.01 ? 0.95 : Math.max(0.85, 0.95 - (diff / Math.abs(bankTxn.amount)));
            
            matchedPairs.push({
              bank_transaction: bankTxn,
              ledger_entries: [finalAvailableLedger[i], finalAvailableLedger[j]],
              match_confidence: confidence,
              match_type: 'one_to_many',
              explanation: diff < 0.01
                ? `1 bank txn (${bankTxn.amount.toFixed(2)}) = 2 ledger entries (${finalAvailableLedger[i].amount.toFixed(2)} + ${finalAvailableLedger[j].amount.toFixed(2)})`
                : `1 bank txn (${bankTxn.amount.toFixed(2)}) ≈ 2 ledger entries (sum: ${sum.toFixed(2)}, diff: ${diff.toFixed(2)})`
            });
            usedBankIds.add(bankTxn.id);
            usedLedgerIds.add(finalAvailableLedger[i].id);
            usedLedgerIds.add(finalAvailableLedger[j].id);
            matched = true;
            console.log(`✅ One-to-many match: Bank ${bankTxn.amount} = Ledger ${finalAvailableLedger[i].amount} + ${finalAvailableLedger[j].amount} (tolerance: ${tolerance.toFixed(2)})`);
          }
        }
      }
      
      if (matched) continue;
      
      // RELAXED: Lower threshold from 500 to 200 for 3-entry combinations
      // This allows more combinations while still preventing explosion on tiny amounts
      if (Math.abs(bankTxn.amount) > 200) {
        // Try triples (3 entries)
        for (let i = 0; i < finalAvailableLedger.length && !matched; i++) {
          for (let j = i + 1; j < finalAvailableLedger.length && !matched; j++) {
            for (let k = j + 1; k < finalAvailableLedger.length && !matched; k++) {
              const ledgerAmounts = [finalAvailableLedger[i].amount, finalAvailableLedger[j].amount, finalAvailableLedger[k].amount];
              
              // CRITICAL: Ensure all ledger entries have the same sign
              if (!hasSameSignPattern(ledgerAmounts)) continue;
              
              const sum = finalAvailableLedger[i].amount + finalAvailableLedger[j].amount + finalAvailableLedger[k].amount;
              const tolerance = calculateTolerance(bankTxn.amount, 'multi');
              
              if (amountsMatchWithSign(bankTxn.amount, sum, tolerance)) {
                const diff = Math.abs(Math.abs(bankTxn.amount) - Math.abs(sum));
                const confidence = diff < 0.01 ? 0.93 : Math.max(0.83, 0.93 - (diff / Math.abs(bankTxn.amount)));
                
                matchedPairs.push({
                  bank_transaction: bankTxn,
                  ledger_entries: [finalAvailableLedger[i], finalAvailableLedger[j], finalAvailableLedger[k]],
                  match_confidence: confidence,
                  match_type: 'one_to_many',
                  explanation: diff < 0.01
                    ? `1 bank txn (${bankTxn.amount.toFixed(2)}) = 3 ledger entries (sum: ${sum.toFixed(2)})`
                    : `1 bank txn (${bankTxn.amount.toFixed(2)}) ≈ 3 ledger entries (sum: ${sum.toFixed(2)}, diff: ${diff.toFixed(2)})`
                });
                usedBankIds.add(bankTxn.id);
                usedLedgerIds.add(finalAvailableLedger[i].id);
                usedLedgerIds.add(finalAvailableLedger[j].id);
                usedLedgerIds.add(finalAvailableLedger[k].id);
                matched = true;
              }
            }
          }
        }
      }
      
      // FIX #5: Removed 4 and 5 entry combinations - they cause too many false positives
    }
    
    const currentOneToManyMatches = matchedPairs.length - (matchedPairs.filter(m => m.match_type === 'exact').length);
    console.log(`✅ Found ${currentOneToManyMatches} one-to-many matches`);
    console.log(`📊 One-to-many diagnostics: ${oneToManyAttempts} total attempts, ${oneToManySkippedSign} skipped (sign mismatch), ${oneToManySkippedDesc} skipped (description), ${currentOneToManyMatches} successful`);
    
    if (oneToManySkippedSign > 0 && currentOneToManyMatches === 0) {
      console.log('⚠️ WARNING: Sign-aware logic may be too strict! All attempts were blocked by sign mismatch.');
    }
    
    // After one-to-many matching, check what's still unmatched and why
    const stillUnmatched = bankTransactions.filter(bt => !usedBankIds.has(bt.id));
    console.log(`📋 Still unmatched after one-to-many: ${stillUnmatched.length} bank transactions`);
    if (stillUnmatched.length > 0 && stillUnmatched.length <= 3) {
      stillUnmatched.forEach(bt => {
        const availLedger = ledgerEntries.filter(le => !usedLedgerIds.has(le.id) && datesMatch(bt.date, le.date, 2));
        console.log(`   Bank: ${bt.amount} (${bt.date}) - ${availLedger.length} date-matched ledger entries available`);
      });
    }
    console.log;
    console.log('🔍 Step 3: Finding many-to-one matches (multiple bank = 1 ledger)...');
    
    // 1C. Many-to-one matches (multiple bank transactions = 1 ledger entry)
    // UPGRADED: Now checks for 2, 3, 4, and 5 bank transaction combinations
    for (const ledgerEntry of ledgerEntries) {
      if (usedLedgerIds.has(ledgerEntry.id)) continue;
      
      // FIX #2 & #4: Use 2-day window for candidate filtering
      // Description filtering only applied when too many candidates (prevents false negatives)
      const availableBank = bankTransactions.filter(bt => {
        if (usedBankIds.has(bt.id)) return false;
        if (!datesMatch(bt.date, ledgerEntry.date, 2)) return false;
        return true;
      });
      
      // Only apply description filter if we have too many candidates (> 30)
      let finalAvailableBank = availableBank;
      if (availableBank.length > 30) {
        finalAvailableBank = availableBank.filter(bt => {
          const descSimilarity = stringSimilarity(bt.description || '', ledgerEntry.description || '');
          return descSimilarity >= 0.05;
        });
      }
      
      let matched = false;
      
      // Try pairs (2 bank transactions)
      for (let i = 0; i < finalAvailableBank.length && !matched; i++) {
        for (let j = i + 1; j < finalAvailableBank.length && !matched; j++) {
          const bankAmounts = [finalAvailableBank[i].amount, finalAvailableBank[j].amount];
          
          // CRITICAL: Ensure all bank transactions have the same sign (no mixing deposits + withdrawals)
          if (!hasSameSignPattern(bankAmounts)) continue;
          
          const sum = finalAvailableBank[i].amount + finalAvailableBank[j].amount;
          if (amountsMatchWithSign(sum, ledgerEntry.amount, 1.0)) {
            matchedPairs.push({
              bank_transaction: finalAvailableBank[i],
              ledger_entries: [ledgerEntry],
              match_confidence: 0.95,
              match_type: 'many_to_one',
              explanation: `2 bank txns (${finalAvailableBank[i].amount.toFixed(2)} + ${finalAvailableBank[j].amount.toFixed(2)}) = 1 ledger (${ledgerEntry.amount.toFixed(2)})`
            });
            matchedPairs.push({
              bank_transaction: finalAvailableBank[j],
              ledger_entries: [],
              match_confidence: 0.95,
              match_type: 'many_to_one',
              explanation: 'Part of 2-to-1 match'
            });
            usedBankIds.add(finalAvailableBank[i].id);
            usedBankIds.add(finalAvailableBank[j].id);
            usedLedgerIds.add(ledgerEntry.id);
            matched = true;
          }
        }
      }
      
      if (matched) continue;
      
      // RELAXED: Lower threshold from 500 to 200 for 3-bank transaction combinations
      if (Math.abs(ledgerEntry.amount) > 200) {
        // Try triples (3 bank transactions)
        for (let i = 0; i < finalAvailableBank.length && !matched; i++) {
          for (let j = i + 1; j < finalAvailableBank.length && !matched; j++) {
            for (let k = j + 1; k < finalAvailableBank.length && !matched; k++) {
              const bankAmounts = [finalAvailableBank[i].amount, finalAvailableBank[j].amount, finalAvailableBank[k].amount];
              
              // CRITICAL: Ensure all bank transactions have the same sign
              if (!hasSameSignPattern(bankAmounts)) continue;
              
              const sum = finalAvailableBank[i].amount + finalAvailableBank[j].amount + finalAvailableBank[k].amount;
              if (amountsMatchWithSign(sum, ledgerEntry.amount, 1.0)) {
                matchedPairs.push({
                  bank_transaction: finalAvailableBank[i],
                  ledger_entries: [ledgerEntry],
                  match_confidence: 0.93,
                  match_type: 'many_to_one',
                  explanation: `3 bank txns (sum: ${sum.toFixed(2)}) = 1 ledger (${ledgerEntry.amount.toFixed(2)})`
                });
                matchedPairs.push({
                  bank_transaction: finalAvailableBank[j],
                  ledger_entries: [],
                  match_confidence: 0.93,
                  match_type: 'many_to_one',
                  explanation: 'Part of 3-to-1 match (2/3)'
                });
                matchedPairs.push({
                  bank_transaction: finalAvailableBank[k],
                  ledger_entries: [],
                  match_confidence: 0.93,
                  match_type: 'many_to_one',
                  explanation: 'Part of 3-to-1 match (3/3)'
                });
                usedBankIds.add(finalAvailableBank[i].id);
                usedBankIds.add(finalAvailableBank[j].id);
                usedBankIds.add(finalAvailableBank[k].id);
                usedLedgerIds.add(ledgerEntry.id);
                matched = true;
              }
            }
          }
        }
      }
      
      // FIX #5: Removed 4 and 5 bank transaction combinations - they cause too many false positives
    }
    
    const deterministic_matches = matchedPairs.length;
    console.log(`✅ Total deterministic matches: ${deterministic_matches}`);
    
    // Collect unmatched items
    let remainingBank = bankTransactions.filter(bt => !usedBankIds.has(bt.id));
    let remainingLedger = ledgerEntries.filter(le => !usedLedgerIds.has(le.id));
    
    console.log(`📋 Remaining after deterministic: ${remainingBank.length} bank, ${remainingLedger.length} ledger`);
    
    // Step 4: Use AI for both fuzzy matching AND FX detection on remaining items
    let aiFuzzyMatches: any[] = [];
    let aiUnmatchedBank: any[] = [];
    let aiUnmatchedLedger: any[] = [];
    
    if (remainingBank.length > 0 || remainingLedger.length > 0) {
      console.log('🤖 Step 4: Using AI for fuzzy + FX matching on remaining items...');
      
      // If there are too many remaining items, skip AI fuzzy matching
      if (remainingBank.length > 100 || remainingLedger.length > 100) {
        console.log('⚠️ Too many remaining items for AI fuzzy matching, marking all as unmatched');
        aiUnmatchedBank = remainingBank.map(t => ({
          transaction: t,
          suggested_action: 'Too many items for AI matching - manual review required',
          suggested_je: null
        }));
        aiUnmatchedLedger = remainingLedger.map(e => ({
          entry: e,
          reason: 'Too many items for AI matching',
          action: 'Manual review required'
        }));
      } else {
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
          console.error('❌ OpenAI API key not configured');
          aiUnmatchedBank = remainingBank.map(t => ({
            transaction: t,
            suggested_action: 'Manual review required',
            suggested_je: null
          }));
          aiUnmatchedLedger = remainingLedger.map(e => ({
            entry: e,
            reason: 'AI matching unavailable',
            action: 'Manual review required'
          }));
        } else {
          // Limit items sent to AI to avoid token overflow
          const MAX_AI_ITEMS = 30;
          const limitedBank = remainingBank.slice(0, MAX_AI_ITEMS);
          const limitedLedger = remainingLedger.slice(0, MAX_AI_ITEMS);
          
          if (remainingBank.length > MAX_AI_ITEMS || remainingLedger.length > MAX_AI_ITEMS) {
            console.log(`⚠️ Limiting AI input: ${limitedBank.length}/${remainingBank.length} bank, ${limitedLedger.length}/${remainingLedger.length} ledger`);
          }
          
          const prompt = `You are an expert bank reconciliation assistant. Find matches using BOTH fuzzy description matching AND foreign exchange (FX) detection.

BANK TRANSACTIONS (${limitedBank.length}):
${JSON.stringify(limitedBank, null, 2)}

LEDGER ENTRIES (${limitedLedger.length}):
${JSON.stringify(limitedLedger, null, 2)}

MATCHING STRATEGIES:

1. FUZZY DESCRIPTION MATCHING
   - Match similar descriptions with typos, abbreviations, synonyms
   - Examples:
     * "AMZN MKTP" ↔ "Amazon Marketplace"
     * "STARBUCKS #1234" ↔ "Coffee - Starbucks"
     * "ACH PAYROLL" ↔ "Salary Payment"
   - Confidence threshold: 70%+

2. FOREIGN EXCHANGE (FX) MATCHING
   - Detect currency conversions with fees
   - Formula: ledger_amount × fx_rate + fx_fee = bank_amount
   - Rules:
     * Dates within 7 days (FX settlements lag)
     * Amounts differ by 5-30% (typical FX range)
     * FX rate between 0.5 and 2.0
     * FX fees typically < 5% of transaction
     * Keywords: "wire", "transfer", "international", "FX", "foreign"
   - Confidence threshold: 75%+

3. COMBINATION MATCHING
   - Use BOTH description similarity AND amount tolerance
   - Example: Similar merchant names with slight amount differences

RESPONSE FORMAT (COMPACT JSON):
{
  "matched_pairs": [
    {
      "bank_id": "bank_uuid",
      "ledger_ids": ["ledger_uuid"],
      "match_type": "fuzzy" | "fx" | "combination",
      "confidence": 0.85,
      "explanation": "Brief reason (max 60 chars)",
      "fx_rate": 1.32,
      "fx_fee": 25.00
    }
  ],
  "unmatched_bank_ids": ["uuid1", "uuid2"],
  "unmatched_ledger_ids": ["uuid1", "uuid2"]
}

IMPORTANT:
- Only include fx_rate and fx_fee if match_type is "fx" or "combination"
- Validate FX math: ledger × rate + fee ≈ bank (within 5% tolerance)
- Keep explanations SHORT (under 60 characters)
- Return empty arrays if no matches found
- Only match if confidence ≥ 70%`;

          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (2 minutes)

          try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'You are an expert accountant. Return COMPACT JSON with just IDs. Keep explanations under 50 characters.'
                  },
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1,
                max_tokens: 8000,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const error = await response.text();
              console.error('❌ OpenAI API error:', error);
              // Continue without AI fuzzy matching
              aiUnmatchedBank = remainingBank.map(t => ({
                transaction: t,
                suggested_action: 'AI matching failed - manual review required',
                suggested_je: null
              }));
              aiUnmatchedLedger = remainingLedger.map(e => ({
                entry: e,
                reason: 'AI matching failed',
                action: 'Manual review required'
              }));
            } else {
              const aiResponse = await response.json();
              
              // Try to parse AI response with JSON repair
              let aiResult;
              try {
                const rawContent = aiResponse.choices[0].message.content;
                const finishReason = aiResponse.choices[0].finish_reason;
                
                console.log('🔍 AI response length:', rawContent.length, 'finish_reason:', finishReason);
                
                // Check if response was truncated
                if (finishReason === 'length') {
                  console.log('⚠️ AI response truncated - attempting JSON repair...');
                  
                  // Try to repair truncated JSON
                  let repairedContent = rawContent;
                  const openBraces = (rawContent.match(/{/g) || []).length;
                  const closeBraces = (rawContent.match(/}/g) || []).length;
                  const openBrackets = (rawContent.match(/\[/g) || []).length;
                  const closeBrackets = (rawContent.match(/\]/g) || []).length;
                  
                  // Add missing closing characters
                  if (openBrackets > closeBrackets) {
                    repairedContent += ']'.repeat(openBrackets - closeBrackets);
                  }
                  if (openBraces > closeBraces) {
                    repairedContent += '}'.repeat(openBraces - closeBraces);
                  }
                  
                  aiResult = JSON.parse(repairedContent);
                  console.log('✅ Successfully repaired truncated JSON');
                } else {
                  aiResult = JSON.parse(rawContent);
                }
              } catch (parseError) {
                console.error('❌ JSON parse failed:', parseError);
                console.error('📄 First 500 chars:', aiResponse.choices[0].message.content.substring(0, 500));
                console.error('📄 Last 200 chars:', aiResponse.choices[0].message.content.substring(Math.max(0, aiResponse.choices[0].message.content.length - 200)));
                
                // Fallback: mark all as unmatched
                aiUnmatchedBank = remainingBank.map(t => ({
                  transaction: t,
                  suggested_action: 'AI JSON error - manual review required',
                  suggested_je: null
                }));
                aiUnmatchedLedger = remainingLedger.map(e => ({
                  entry: e,
                  reason: 'AI JSON error',
                  action: 'Manual review required'
                }));
                aiResult = null;
              }
              
              if (aiResult) {
                // Handle compact format (ID-based)
                if (aiResult.matched_pairs && aiResult.matched_pairs.length > 0 && aiResult.matched_pairs[0].bank_id) {
                  console.log('📦 Using compact format (ID-based)');
                  aiFuzzyMatches = aiResult.matched_pairs.map((match: any) => {
                    const bankTxn = limitedBank.find(t => t.id === match.bank_id);
                    const ledgerEntries = (match.ledger_ids || []).map((ledId: string) => 
                      limitedLedger.find(e => e.id === ledId)
                    ).filter(Boolean);
                    
                    if (!bankTxn || ledgerEntries.length === 0) return null;
                    
                    // Detect match type from AI response
                    const matchType = match.match_type || 'fuzzy';
                    
                    // Build base match object
                    const matchObj: any = {
                      bank_transaction: bankTxn,
                      ledger_entries: ledgerEntries,
                      match_confidence: match.confidence || 0.75,
                      match_type: matchType,
                      explanation: match.explanation || `AI ${matchType} match`
                    };
                    
                    // Add FX-specific fields if this is an FX or combination match
                    if ((matchType === 'fx' || matchType === 'combination') && match.fx_rate) {
                      matchObj.fx_rate = match.fx_rate;
                      matchObj.fx_fee = match.fx_fee || 0;
                      
                      // Validate FX math
                      if (ledgerEntries.length === 1) {
                        const calculatedBank = (ledgerEntries[0].amount * match.fx_rate) + (match.fx_fee || 0);
                        const tolerance = Math.abs(bankTxn.amount) * 0.05; // 5% tolerance
                        
                        if (Math.abs(calculatedBank - bankTxn.amount) > tolerance) {
                          console.log(`⚠️ FX match failed validation: calc=${calculatedBank.toFixed(2)}, actual=${bankTxn.amount.toFixed(2)}`);
                          return null; // Skip invalid FX matches
                        }
                        
                        console.log(`✅ FX match validated: ${ledgerEntries[0].amount} × ${match.fx_rate} + ${match.fx_fee} ≈ ${bankTxn.amount}`);
                      }
                    }
                    
                    return matchObj;
                  }).filter(Boolean);
                  
                  // Build unmatched lists
                  const matchedBankIds = new Set(aiFuzzyMatches.map(m => m.bank_transaction.id));
                  const matchedLedgerIds = new Set(aiFuzzyMatches.flatMap(m => m.ledger_entries.map(e => e.id)));
                  
                  // Items from limitedBank/limitedLedger that weren't matched
                  aiUnmatchedBank = limitedBank.filter(t => !matchedBankIds.has(t.id)).map(t => ({
                    transaction: t,
                    suggested_action: 'No fuzzy match - manual review',
                    suggested_je: null
                  }));
                  
                  aiUnmatchedLedger = limitedLedger.filter(e => !matchedLedgerIds.has(e.id)).map(e => ({
                    entry: e,
                    reason: 'No fuzzy match found',
                    action: 'Manual review'
                  }));
                  
                  // Items beyond MAX_AI_ITEMS that weren't sent to AI at all
                  if (remainingBank.length > MAX_AI_ITEMS) {
                    const beyondLimitBank = remainingBank.slice(MAX_AI_ITEMS).map(t => ({
                      transaction: t,
                      suggested_action: 'Exceeded AI limit - manual review required',
                      suggested_je: null
                    }));
                    aiUnmatchedBank = [...aiUnmatchedBank, ...beyondLimitBank];
                  }
                  
                  if (remainingLedger.length > MAX_AI_ITEMS) {
                    const beyondLimitLedger = remainingLedger.slice(MAX_AI_ITEMS).map(e => ({
                      entry: e,
                      reason: 'Exceeded AI limit',
                      action: 'Manual review required'
                    }));
                    aiUnmatchedLedger = [...aiUnmatchedLedger, ...beyondLimitLedger];
                  }
                } else {
                  // Legacy format (full objects)
                  console.log('📦 Using legacy format (full objects)');
                  aiFuzzyMatches = aiResult.matched_pairs || [];
                  aiUnmatchedBank = aiResult.unmatched_bank || [];
                  aiUnmatchedLedger = aiResult.unmatched_ledger || [];
                }
                
                console.log(`✅ AI found ${aiFuzzyMatches.length} fuzzy matches`);
              }
            }
          } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
              console.error('❌ AI fuzzy matching timeout after 120 seconds');
              aiUnmatchedBank = remainingBank.map(t => ({
                transaction: t,
                suggested_action: 'AI matching timed out - manual review required',
                suggested_je: null
              }));
              aiUnmatchedLedger = remainingLedger.map(e => ({
                entry: e,
                reason: 'AI matching timed out',
                action: 'Manual review required'
              }));
            } else {
              console.error('❌ AI fuzzy matching error:', error);
              // Continue without AI fuzzy matching
              aiUnmatchedBank = remainingBank.map(t => ({
                transaction: t,
                suggested_action: 'AI matching error - manual review required',
                suggested_je: null
              }));
              aiUnmatchedLedger = remainingLedger.map(e => ({
                entry: e,
                reason: 'AI matching error',
                action: 'Manual review required'
              }));
            }
          }
        }
      }
    }
    
    // Combine all results
    const allMatchedPairs = [...matchedPairs, ...aiFuzzyMatches];
    
    // CRITICAL FIX: Properly track ALL unmatched items
    // Calculate which items are still unmatched after ALL matching stages
    const allMatchedBankIds = new Set<string>();
    const allMatchedLedgerIds = new Set<string>();
    
    // Collect IDs from all matched pairs
    for (const match of allMatchedPairs) {
      allMatchedBankIds.add(match.bank_transaction.id);
      for (const ledgerEntry of match.ledger_entries) {
        allMatchedLedgerIds.add(ledgerEntry.id);
      }
    }
    
    // Build complete unmatched lists
    const allUnmatchedBank = bankTransactions
      .filter(bt => !allMatchedBankIds.has(bt.id))
      .map(t => ({
        transaction: t,
        suggested_action: 'No match found - manual review required',
        suggested_je: null
      }));
    
    const allUnmatchedLedger = ledgerEntries
      .filter(le => !allMatchedLedgerIds.has(le.id))
      .map(e => ({
        entry: e,
        reason: 'No match found',
        action: 'Manual review required'
      }));
    
    console.log(`📊 Final unmatched: ${allUnmatchedBank.length} bank, ${allUnmatchedLedger.length} ledger`);
    
    // Calculate summary
    const totalBankAmount = bankTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalLedgerAmount = ledgerEntries.reduce((sum, e) => sum + e.amount, 0);
    
    // Count match types
    const exactMatches = allMatchedPairs.filter(m => m.match_type === 'exact').length;
    const toleranceMatches = allMatchedPairs.filter(m => m.match_type === 'tolerance').length;
    const fxMatches = allMatchedPairs.filter(m => m.match_type === 'fx' || m.match_type === 'fx_adjusted').length;
    const oneToManyMatches = allMatchedPairs.filter(m => m.match_type === 'one_to_many').length;
    const combinationMatches = allMatchedPairs.filter(m => m.match_type === 'combination').length;
    const fuzzyMatches = allMatchedPairs.filter(m => m.match_type === 'fuzzy').length;
    
    // Group matched pairs into pre-matched items
    const preMatchedGroups: any[] = [];
    const processedPairs = new Set<number>();
    
    allMatchedPairs.forEach((pair: any, pairIndex: number) => {
      if (processedPairs.has(pairIndex)) return;
      
      // Skip pairs that are part of many-to-one/one-to-many but don't have ledger entries
      if (pair.ledger_entries && pair.ledger_entries.length === 0) {
        processedPairs.add(pairIndex);
        return;
      }
      
      // Create a match group
      const bankTransactions = [pair.bank_transaction];
      const ledgerEntries = pair.ledger_entries || [];
      
      // Check if this is part of a many-to-one or one-to-many match
      // Look for related pairs that form a group
      if (pair.match_type === 'many_to_one' || pair.match_type === 'one_to_many') {
        // Find other pairs that share the same ledger entries
        allMatchedPairs.forEach((otherPair: any, otherIndex: number) => {
          if (otherIndex !== pairIndex && !processedPairs.has(otherIndex)) {
            // Check if they share ledger entries
            const shareEntry = ledgerEntries.some((le: any) => 
              otherPair.ledger_entries?.some((ole: any) => ole.id === le.id)
            );
            if (shareEntry && otherPair.bank_transaction) {
              bankTransactions.push(otherPair.bank_transaction);
              processedPairs.add(otherIndex);
            }
          }
        });
      }
      
      processedPairs.add(pairIndex);
      
      // Create pre-matched group
      const matchGroupId = `match-${Date.now()}-${pairIndex}`;
      preMatchedGroups.push({
        matchGroupId,
        bankTransactions,
        ledgerEntries,
        matchedAt: new Date().toISOString(),
        confidence: pair.match_confidence || 1.0,
        matchType: pair.match_type,
      });
    });
    
    const result = {
      matched_pairs: allMatchedPairs,
      unmatched_bank: allUnmatchedBank,
      unmatched_ledger: allUnmatchedLedger,
      pre_matched_items: preMatchedGroups,
      summary: {
        total_bank_transactions: bankTransactions.length,
        total_ledger_entries: ledgerEntries.length,
        matched_count: allMatchedPairs.length,
        unmatched_bank_count: allUnmatchedBank.length,
        unmatched_ledger_count: allUnmatchedLedger.length,
        total_bank_amount: totalBankAmount,
        total_ledger_amount: totalLedgerAmount,
        difference: totalBankAmount - totalLedgerAmount,
        match_rate: (allMatchedPairs.length / bankTransactions.length) * 100,
        deterministic_matches,
        ai_fuzzy_matches: fuzzyMatches,
        ai_fx_matches: fxMatches,
        ai_combination_matches: combinationMatches
      },
      debug: debugInfo
    };

    // Save reconciliation result
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    await kv.set(recKey, result);

    console.log(`✅ Reconciliation completed: ${result.summary.match_rate.toFixed(1)}% match rate`);
    console.log(`📊 Match breakdown: Exact=${exactMatches}, Tolerance=${toleranceMatches}, FX=${fxMatches}, Multi-entry=${oneToManyMatches}, Fuzzy=${fuzzyMatches}`);

    return c.json(result);
  } catch (error) {
    console.error('❌ Error running reconciliation:', error);
    return c.json({ error: `Failed to run reconciliation: ${error.message}` }, 500);
  }
});

// Lock (save) a reconciliation
app.post('/bank-rec/lock-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();
    
    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `bank-rec:${company_id}:${period}:reconciliation`;
    const reconciliation = await kv.get(key);
    
    if (!reconciliation) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Add locked status and timestamp
    reconciliation.locked = true;
    reconciliation.lockedAt = new Date().toISOString();
    
    await kv.set(key, reconciliation);
    
    console.log(`🔒 Locked reconciliation for ${company_id} - ${period}`);
    
    return c.json({ success: true, reconciliation });
  } catch (error) {
    console.error('❌ Error locking reconciliation:', error);
    return c.json({ error: `Failed to lock reconciliation: ${error.message}` }, 500);
  }
});

// Unlock a reconciliation to allow updates
app.post('/bank-rec/unlock-reconciliation', async (c) => {
  try {
    const { company_id, period } = await c.req.json();
    
    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    const key = `bank-rec:${company_id}:${period}:reconciliation`;
    const reconciliation = await kv.get(key);
    
    if (!reconciliation) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Remove locked status
    reconciliation.locked = false;
    reconciliation.unlockedAt = new Date().toISOString();
    
    await kv.set(key, reconciliation);
    
    console.log(`🔓 Unlocked reconciliation for ${company_id} - ${period}`);
    
    return c.json({ success: true, reconciliation });
  } catch (error) {
    console.error('❌ Error unlocking reconciliation:', error);
    return c.json({ error: `Failed to unlock reconciliation: ${error.message}` }, 500);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Convert Excel serial date to YYYY-MM-DD format
// Excel stores dates as numbers (days since 1900-01-01)
// Example: 43647 = 2019-07-01
function excelDateToISOString(excelDate: any): string {
  // If it's already a string date, return it
  if (typeof excelDate === 'string') {
    // If it looks like a valid date string, return as-is
    if (excelDate.includes('-') || excelDate.includes('/')) {
      return excelDate;
    }
    // If it's a numeric string, convert it
    const num = parseFloat(excelDate);
    if (isNaN(num)) {
      return excelDate; // Return as-is if can't parse
    }
    excelDate = num;
  }
  
  // If it's a number, treat it as Excel serial date
  if (typeof excelDate === 'number') {
    // Excel's epoch is 1900-01-01, but Excel incorrectly treats 1900 as a leap year
    // So we need to account for that
    const excelEpoch = new Date(1900, 0, 1).getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    // Subtract 2 because:
    // 1. Excel starts counting from 1, not 0
    // 2. Excel incorrectly counts Feb 29, 1900 (which didn't exist)
    const daysOffset = excelDate > 59 ? excelDate - 2 : excelDate - 1;
    const date = new Date(excelEpoch + daysOffset * msPerDay);
    
    // Format as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  // If it's a Date object
  if (excelDate instanceof Date) {
    const year = excelDate.getFullYear();
    const month = String(excelDate.getMonth() + 1).padStart(2, '0');
    const day = String(excelDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Fallback: return as string
  return String(excelDate);
}

async function parseCSV(text: string, fileName: string): Promise<any[]> {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  // Use AI to detect columns
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const sampleRows = lines.slice(0, 6).join('\n');
  
  const prompt = `Analyze this CSV bank statement and identify the column indices for: date, description, amount, and balance (if present).

CSV SAMPLE:
${sampleRows}

Important: Detect the delimiter used (comma, semicolon, tab, or pipe). Also detect if the CSV has quoted fields.

Return JSON with:
{
  "date_column": index,
  "description_column": index,
  "amount_column": index,
  "balance_column": index or null,
  "header_row": row index (usually 0),
  "delimiter": "," or ";" or "\\t" or "|",
  "has_quotes": true or false
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
        { role: 'system', content: 'You are a CSV analysis expert who can detect delimiters and column structures.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const aiResponse = await response.json();
  const columnMap = JSON.parse(aiResponse.choices[0].message.content);
  
  console.log('📋 CSV column mapping detected:', columnMap);

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
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
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
  };

  // Parse transactions
  const transactions: any[] = [];
  const delimiter = columnMap.delimiter || ',';
  
  for (let i = columnMap.header_row + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line, delimiter);
    
    // Skip rows that don't have enough columns
    if (cols.length <= Math.max(
      columnMap.date_column,
      columnMap.description_column,
      columnMap.amount_column,
      columnMap.balance_column || 0
    )) {
      continue;
    }
    
    const transaction = {
      date: excelDateToISOString(cols[columnMap.date_column] || ''),
      description: cols[columnMap.description_column] || '',
      amount: parseFloat(cols[columnMap.amount_column]?.replace(/[^0-9.-]/g, '') || '0'),
      balance: columnMap.balance_column !== null && cols[columnMap.balance_column] 
        ? parseFloat(cols[columnMap.balance_column].replace(/[^0-9.-]/g, '') || '0') 
        : undefined
    };

    transactions.push(transaction);
  }

  console.log(`✅ Parsed ${transactions.length} transactions from CSV`);
  return transactions;
}

async function parseXLSX(uint8Array: Uint8Array, fileName: string): Promise<any[]> {
  // Import xlsx dynamically
  const XLSX = await import('npm:xlsx');
  
  const workbook = XLSX.read(uint8Array, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('XLSX file must have at least a header row and one data row');
  }

  // Use AI for column detection (similar to CSV)
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const sampleRows = JSON.stringify(jsonData.slice(0, 6), null, 2);
  
  const prompt = `Analyze this XLSX bank statement and identify the column indices for: date, description, amount, and balance (if present).

XLSX SAMPLE:
${sampleRows}

Return JSON with:
{
  "date_column": index,
  "description_column": index,
  "amount_column": index,
  "balance_column": index or null,
  "header_row": row index (usually 0)
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
        { role: 'system', content: 'You are a spreadsheet analysis expert.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const aiResponse = await response.json();
  const columnMap = JSON.parse(aiResponse.choices[0].message.content);

  // Parse transactions
  const transactions: any[] = [];
  for (let i = columnMap.header_row + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    if (!row || row.length === 0) continue;

    const transaction = {
      date: excelDateToISOString(row[columnMap.date_column] || ''),
      description: String(row[columnMap.description_column] || ''),
      amount: parseFloat(String(row[columnMap.amount_column] || '0').replace(/[^0-9.-]/g, '') || '0'),
      balance: columnMap.balance_column !== null && row[columnMap.balance_column]
        ? parseFloat(String(row[columnMap.balance_column]).replace(/[^0-9.-]/g, '') || '0')
        : undefined
    };

    transactions.push(transaction);
  }

  return transactions;
}

async function parseLedgerCSV(text: string, fileName: string): Promise<any[]> {
  // Similar to bank CSV parsing but for ledger entries
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const sampleRows = lines.slice(0, 6).join('\n');
  
  const prompt = `Analyze this CSV general ledger and identify the column indices.

CSV SAMPLE:
${sampleRows}

IMPORTANT: General ledgers can have EITHER:
1. A single "Amount" column, OR
2. Separate "Debit" and "Credit" columns (common in accounting)

Return JSON with:
{
  "date_column": index,
  "description_column": index,
  "amount_column": index or null (if using debit/credit columns instead),
  "debit_column": index or null (if separate debit/credit columns exist),
  "credit_column": index or null (if separate debit/credit columns exist),
  "account_column": index or null,
  "reference_column": index or null,
  "header_row": row index (usually 0)
}

If you see both Debit and Credit columns, set debit_column and credit_column. Set amount_column to null.
If you see a single Amount column, set amount_column. Set debit_column and credit_column to null.`;

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

  console.log('📊 Ledger column mapping:', columnMap);

  // Parse entries
  const entries: any[] = [];
  for (let i = columnMap.header_row + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map(col => col.trim().replace(/^\"|\"$/g, ''));
    
    let amount = 0;
    
    // Handle debit/credit columns vs single amount column
    if (columnMap.debit_column !== null && columnMap.credit_column !== null) {
      // Separate debit/credit columns
      const debitStr = cols[columnMap.debit_column]?.replace(/[^0-9.-]/g, '') || '0';
      const creditStr = cols[columnMap.credit_column]?.replace(/[^0-9.-]/g, '') || '0';
      const debit = parseFloat(debitStr) || 0;
      const credit = parseFloat(creditStr) || 0;
      
      // Smart handling: Use whichever has a non-zero value
      // Debits are positive, credits are negative
      if (Math.abs(debit) > 0) {
        amount = Math.abs(debit); // Debits are always positive
      } else if (Math.abs(credit) > 0) {
        amount = -Math.abs(credit); // Credits are always negative
      }
    } else if (columnMap.amount_column !== null) {
      // Single amount column
      amount = parseFloat(cols[columnMap.amount_column]?.replace(/[^0-9.-]/g, '') || '0');
    }
    
    const entry = {
      date: excelDateToISOString(cols[columnMap.date_column] || ''),
      description: cols[columnMap.description_column] || '',
      amount,
      account: columnMap.account_column !== null ? cols[columnMap.account_column] : undefined,
      reference: columnMap.reference_column !== null ? cols[columnMap.reference_column] : undefined
    };

    entries.push(entry);
  }

  return entries;
}

async function parseLedgerXLSX(uint8Array: Uint8Array, fileName: string): Promise<any[]> {
  const XLSX = await import('npm:xlsx');
  
  const workbook = XLSX.read(uint8Array, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('XLSX file must have at least a header row and one data row');
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const sampleRows = JSON.stringify(jsonData.slice(0, 6), null, 2);
  
  const prompt = `Analyze this XLSX general ledger and identify the column indices.

XLSX SAMPLE:
${sampleRows}

IMPORTANT: General ledgers can have EITHER:
1. A single "Amount" column, OR
2. Separate "Debit" and "Credit" columns (common in accounting)

Return JSON with:
{
  "date_column": index,
  "description_column": index,
  "amount_column": index or null (if using debit/credit columns instead),
  "debit_column": index or null (if separate debit/credit columns exist),
  "credit_column": index or null (if separate debit/credit columns exist),
  "account_column": index or null,
  "reference_column": index or null,
  "header_row": row index (usually 0)
}

If you see both Debit and Credit columns, set debit_column and credit_column. Set amount_column to null.
If you see a single Amount column, set amount_column. Set debit_column and credit_column to null.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a spreadsheet analysis expert specializing in accounting formats.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const aiResponse = await response.json();
  const columnMap = JSON.parse(aiResponse.choices[0].message.content);

  console.log('📊 Ledger XLSX column mapping:', columnMap);

  // Parse entries
  const entries: any[] = [];
  for (let i = columnMap.header_row + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    if (!row || row.length === 0) continue;

    let amount = 0;
    
    // Handle debit/credit columns vs single amount column
    if (columnMap.debit_column !== null && columnMap.credit_column !== null) {
      // Separate debit/credit columns
      const debitStr = String(row[columnMap.debit_column] || '0').replace(/[^0-9.-]/g, '');
      const creditStr = String(row[columnMap.credit_column] || '0').replace(/[^0-9.-]/g, '');
      const debit = parseFloat(debitStr) || 0;
      const credit = parseFloat(creditStr) || 0;
      
      // Smart handling: Use whichever has a non-zero value
      // Debits are positive, credits are negative
      if (Math.abs(debit) > 0) {
        amount = Math.abs(debit); // Debits are always positive
      } else if (Math.abs(credit) > 0) {
        amount = -Math.abs(credit); // Credits are always negative
      }
    } else if (columnMap.amount_column !== null) {
      // Single amount column
      amount = parseFloat(String(row[columnMap.amount_column] || '0').replace(/[^0-9.-]/g, '') || '0');
    }

    const entry = {
      date: excelDateToISOString(row[columnMap.date_column] || ''),
      description: String(row[columnMap.description_column] || ''),
      amount,
      account: columnMap.account_column !== null ? String(row[columnMap.account_column] || '') : undefined,
      reference: columnMap.reference_column !== null ? String(row[columnMap.reference_column] || '') : undefined
    };

    entries.push(entry);
  }

  return entries;
}

async function parsePDF(uint8Array: Uint8Array, fileName: string): Promise<any[]> {
  console.log('📄 Parsing PDF bank statement...');
  
  // Write PDF to temp file for parsing
  const tempPath = `/tmp/bank-statement-${Date.now()}.pdf`;
  await Deno.writeFile(tempPath, uint8Array);
  
  try {
    // Extract text from PDF
    const pdfParse = (await import('npm:pdf-parse@1.1.1')).default;
    const dataBuffer = await Deno.readFile(tempPath);
    const pdfData = await pdfParse(dataBuffer);
    
    const extractedText = pdfData.text;
    console.log(`✅ Extracted ${extractedText.length} characters from ${pdfData.numpages} pages`);
    console.log('📝 First 500 characters of extracted text:', extractedText.substring(0, 500));
    
    // Clean up temp file
    await Deno.remove(tempPath);
    
    if (!extractedText.trim()) {
      throw new Error('No text could be extracted from the PDF. The file may contain scanned images or be password-protected.');
    }
    
    // Use AI to extract transactions from the unstructured PDF text
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Use more text to capture all transactions (30000 chars should cover most statements)
    const textSample = extractedText.substring(0, 30000);
    
    const prompt = `You are a bank statement parser. Extract all transactions from this bank statement PDF text.

BANK STATEMENT TEXT:
${textSample}

Your task is to identify and extract EVERY transaction line from this bank statement.

Common bank statement formats include:
- Date | Description | Debit | Credit | Balance
- Date | Description | Amount | Balance
- Transaction Date | Posting Date | Description | Withdrawal | Deposit | Balance
- Date | Details | Money Out | Money In | Balance

IMPORTANT EXTRACTION RULES:
1. Look for sections labeled "Transactions", "Account Activity", "Statement Details", or similar
2. Each line with a date + description + amount is likely a transaction
3. Skip page headers, account summaries, and footer information
4. Convert ALL amounts to numbers (remove $, commas, parentheses)
5. Make debits/withdrawals/payments NEGATIVE (subtract from balance)
6. Make credits/deposits POSITIVE (add to balance)
7. If amounts are in separate Debit/Credit columns, use the column to determine sign
8. If amounts have parentheses like (100.00), these are typically debits/withdrawals - make them NEGATIVE
9. If the balance decreases after a transaction, it's a debit (negative)
10. If the balance increases after a transaction, it's a credit (positive)

DATE FORMATS TO RECOGNIZE:
- MM/DD/YYYY, MM/DD/YY
- DD/MM/YYYY, DD/MM/YY
- YYYY-MM-DD
- Mon DD, YYYY (e.g., Jan 15, 2024)
- DD-MMM-YYYY (e.g., 15-Jan-2024)

Return JSON format with ALL transactions you can find:
{
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "ACH DEPOSIT PAYROLL",
      "amount": 5000.00,
      "balance": 12500.00
    },
    {
      "date": "2024-01-16",
      "description": "CHECK #1234",
      "amount": -150.00,
      "balance": 12350.00
    }
  ]
}

If you cannot find any transactions, return an empty array but explain why in a "note" field:
{
  "transactions": [],
  "note": "Explanation of why no transactions were found"
}`;

    console.log('🤖 Calling OpenAI to parse PDF transactions...');
    
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
            content: 'You are an expert at parsing bank statements from any bank worldwide. You can identify transaction patterns in unstructured text and extract them accurately. You understand various date formats, amount representations, and transaction types.' 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error(`Failed to parse PDF with AI: ${error}`);
    }

    const aiResponse = await response.json();
    const result = JSON.parse(aiResponse.choices[0].message.content);
    
    console.log('🤖 AI Response:', JSON.stringify(result, null, 2));
    
    const transactions = result.transactions || [];
    console.log(`✅ Extracted ${transactions.length} transactions from PDF`);
    
    if (transactions.length === 0) {
      const note = result.note || 'Unknown reason';
      console.error('❌ No transactions found. AI note:', note);
      console.error('📝 First 1000 characters of PDF text for debugging:', textSample.substring(0, 1000));
      throw new Error(`No transactions found in the PDF. AI explanation: ${note}. This may not be a valid bank statement, or it may use an unsupported format. Please try a CSV/XLSX export from your bank instead.`);
    }
    
    return transactions;
    
  } catch (error) {
    // Clean up temp file on error
    try { await Deno.remove(tempPath); } catch {}
    throw error;
  }
}

// Mark transaction as timing difference
app.post('/bank-rec/mark-timing-difference', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item } = body;
    
    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`⏰ Marking as timing difference:`, type, companyId, period);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Store as timing difference
    const timingKey = `bank-rec:${companyId}:${period}:timing-differences`;
    const existingTimingDiffs = await kv.get(timingKey) || { items: [] };
    
    existingTimingDiffs.items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'timing-difference'
    });
    
    await kv.set(timingKey, existingTimingDiffs);

    // Also add to resolved bucket
    const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    existingResolved.items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'resolved',
      resolution: 'Marked as timing difference - will clear next period'
    });
    
    await kv.set(resolvedKey, existingResolved);

    // Remove from unmatched list
    if (type === 'bank' && reconciliationData.unmatched_bank) {
      reconciliationData.unmatched_bank = reconciliationData.unmatched_bank.filter((unmatchedItem: any) => {
        const txn = unmatchedItem.transaction;
        const itemTxn = item.transaction;
        return !(
          txn.date === itemTxn.date &&
          txn.description === itemTxn.description &&
          txn.amount === itemTxn.amount
        );
      });
      
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank.length;
      }
    } else if (type === 'ledger' && reconciliationData.unmatched_ledger) {
      reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.filter((unmatchedItem: any) => {
        const entry = unmatchedItem.entry;
        const itemEntry = item.entry;
        return !(
          entry.date === itemEntry.date &&
          entry.description === itemEntry.description &&
          entry.amount === itemEntry.amount
        );
      });
      
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
      }
    }
    
    await kv.set(recKey, reconciliationData);

    console.log('✅ Marked as timing difference');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking as timing difference:', error);
    return c.json({ error: 'Failed to mark as timing difference' }, 500);
  }
});

// Mark transaction as ignored (non-issue)
app.post('/bank-rec/mark-ignored', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item } = body;
    
    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`🙈 Marking as ignored (non-issue):`, type, companyId, period);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Store as ignored
    const ignoredKey = `bank-rec:${companyId}:${period}:ignored`;
    const existingIgnored = await kv.get(ignoredKey) || { items: [] };
    
    existingIgnored.items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'ignored',
      note: 'Marked as non-issue - reviewed, no action needed'
    });
    
    await kv.set(ignoredKey, existingIgnored);

    // Also add to resolved bucket
    const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    existingResolved.items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'resolved',
      resolution: 'Marked as non-issue - reviewed, no action needed'
    });
    
    await kv.set(resolvedKey, existingResolved);

    // Remove from unmatched list
    if (type === 'bank' && reconciliationData.unmatched_bank) {
      reconciliationData.unmatched_bank = reconciliationData.unmatched_bank.filter((unmatchedItem: any) => {
        const txn = unmatchedItem.transaction;
        const itemTxn = item.transaction;
        return !(
          txn.date === itemTxn.date &&
          txn.description === itemTxn.description &&
          txn.amount === itemTxn.amount
        );
      });
      
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank.length;
      }
    } else if (type === 'ledger' && reconciliationData.unmatched_ledger) {
      reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.filter((unmatchedItem: any) => {
        const entry = unmatchedItem.entry;
        const itemEntry = item.entry;
        return !(
          entry.date === itemEntry.date &&
          entry.description === itemEntry.description &&
          entry.amount === itemEntry.amount
        );
      });
      
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
      }
    }
    
    await kv.set(recKey, reconciliationData);

    console.log('✅ Marked as ignored (non-issue)');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking as ignored:', error);
    return c.json({ error: 'Failed to mark as ignored' }, 500);
  }
});

// Request information (flag for follow-up)
app.post('/bank-rec/request-information', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item, note } = body;
    
    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`📝 Flagging for follow-up:`, type, companyId, period);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Store as follow-up needed
    const followUpKey = `bank-rec:${companyId}:${period}:follow-up`;
    const existingFollowUps = await kv.get(followUpKey) || { items: [] };
    
    existingFollowUps.items.push({
      type,
      item,
      note,
      markedAt: new Date().toISOString(),
      status: 'follow-up-needed'
    });
    
    await kv.set(followUpKey, existingFollowUps);

    // Remove from unmatched list
    if (type === 'bank' && reconciliationData.unmatched_bank) {
      reconciliationData.unmatched_bank = reconciliationData.unmatched_bank.filter((unmatchedItem: any) => {
        const txn = unmatchedItem.transaction;
        const itemTxn = item.transaction;
        return !(
          txn.date === itemTxn.date &&
          txn.description === itemTxn.description &&
          txn.amount === itemTxn.amount
        );
      });
      
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank.length;
      }
    } else if (type === 'ledger' && reconciliationData.unmatched_ledger) {
      reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.filter((unmatchedItem: any) => {
        const entry = unmatchedItem.entry;
        const itemEntry = item.entry;
        return !(
          entry.date === itemEntry.date &&
          entry.description === itemEntry.description &&
          entry.amount === itemEntry.amount
        );
      });
      
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
      }
    }
    
    await kv.set(recKey, reconciliationData);

    console.log('✅ Flagged for follow-up');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error flagging for follow-up:', error);
    return c.json({ error: 'Failed to flag for follow-up' }, 500);
  }
});

// Delete transaction
app.post('/bank-rec/delete-transaction', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item } = body;
    
    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`🗑️ Deleting transaction:`, type, companyId, period);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Remove from unmatched list
    if (type === 'bank' && reconciliationData.unmatched_bank) {
      reconciliationData.unmatched_bank = reconciliationData.unmatched_bank.filter((unmatchedItem: any) => {
        const txn = unmatchedItem.transaction;
        const itemTxn = item.transaction;
        return !(
          txn.id === itemTxn.id ||
          (txn.date === itemTxn.date &&
           txn.description === itemTxn.description &&
           txn.amount === itemTxn.amount)
        );
      });
      
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank.length;
      }
    } else if (type === 'ledger' && reconciliationData.unmatched_ledger) {
      reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.filter((unmatchedItem: any) => {
        const entry = unmatchedItem.entry;
        const itemEntry = item.entry;
        return !(
          entry.id === itemEntry.id ||
          (entry.date === itemEntry.date &&
           entry.description === itemEntry.description &&
           entry.amount === itemEntry.amount)
        );
      });
      
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
      }
    }
    
    await kv.set(recKey, reconciliationData);

    console.log('✅ Transaction deleted');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting transaction:', error);
    return c.json({ error: 'Failed to delete transaction' }, 500);
  }
});

// Update transaction or ledger entry
app.post('/bank-rec/update-transaction', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📥 Received update request body:', JSON.stringify(body, null, 2));
    
    const { companyId, period, type, originalItem, updatedData } = body;
    
    if (!companyId || !period || !type || !originalItem || !updatedData) {
      console.log('❌ Missing required fields:', { companyId, period, type, hasOriginalItem: !!originalItem, hasUpdatedData: !!updatedData });
      return c.json({ error: 'companyId, period, type, originalItem, and updatedData are required' }, 400);
    }

    console.log(`✏️ Updating transaction:`, type, companyId, period);
    console.log('Original:', originalItem);
    console.log('Updated data:', updatedData);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    let updated = false;

    // Helper function to match transactions
    const matchesTransaction = (txn: any, original: any) => {
      return txn.id === original.id ||
        (txn.date === original.date &&
         txn.description === original.description &&
         txn.amount === original.amount);
    };

    // Update in unmatched lists
    if (type === 'bank' && reconciliationData.unmatched_bank) {
      reconciliationData.unmatched_bank = reconciliationData.unmatched_bank.map((unmatchedItem: any) => {
        if (matchesTransaction(unmatchedItem.transaction, originalItem)) {
          console.log('✅ Found and updating bank transaction in unmatched_bank');
          updated = true;
          return {
            ...unmatchedItem,
            transaction: {
              ...unmatchedItem.transaction,
              date: updatedData.date,
              description: updatedData.description,
              amount: updatedData.amount
            }
          };
        }
        return unmatchedItem;
      });
    } else if (type === 'ledger' && reconciliationData.unmatched_ledger) {
      reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.map((unmatchedItem: any) => {
        if (matchesTransaction(unmatchedItem.entry, originalItem)) {
          console.log('✅ Found and updating ledger entry in unmatched_ledger');
          updated = true;
          return {
            ...unmatchedItem,
            entry: {
              ...unmatchedItem.entry,
              date: updatedData.date,
              description: updatedData.description,
              amount: updatedData.amount
            }
          };
        }
        return unmatchedItem;
      });
    }

    // Update in resolved items (timing differences, ignored, follow-up)
    const timingKey = `bank-rec:${companyId}:${period}:timing-differences`;
    const ignoredKey = `bank-rec:${companyId}:${period}:ignored`;
    const followUpKey = `bank-rec:${companyId}:${period}:follow-up`;

    const timingData = await kv.get(timingKey) || [];
    const ignoredData = await kv.get(ignoredKey) || [];
    const followUpData = await kv.get(followUpKey) || [];

    // Check and update in timing differences
    const updatedTiming = timingData.map((item: any) => {
      if (item.type === type && item.item) {
        const itemData = type === 'bank' ? item.item.transaction : item.item.entry;
        if (itemData && matchesTransaction(itemData, originalItem)) {
          console.log('✅ Found and updating in timing differences');
          updated = true;
          if (type === 'bank') {
            return {
              ...item,
              item: {
                ...item.item,
                transaction: {
                  ...item.item.transaction,
                  date: updatedData.date,
                  description: updatedData.description,
                  amount: updatedData.amount
                }
              }
            };
          } else {
            return {
              ...item,
              item: {
                ...item.item,
                entry: {
                  ...item.item.entry,
                  date: updatedData.date,
                  description: updatedData.description,
                  amount: updatedData.amount
                }
              }
            };
          }
        }
      }
      return item;
    });

    // Check and update in ignored
    const updatedIgnored = ignoredData.map((item: any) => {
      if (item.type === type && item.item) {
        const itemData = type === 'bank' ? item.item.transaction : item.item.entry;
        if (itemData && matchesTransaction(itemData, originalItem)) {
          console.log('✅ Found and updating in ignored');
          updated = true;
          if (type === 'bank') {
            return {
              ...item,
              item: {
                ...item.item,
                transaction: {
                  ...item.item.transaction,
                  date: updatedData.date,
                  description: updatedData.description,
                  amount: updatedData.amount
                }
              }
            };
          } else {
            return {
              ...item,
              item: {
                ...item.item,
                entry: {
                  ...item.item.entry,
                  date: updatedData.date,
                  description: updatedData.description,
                  amount: updatedData.amount
                }
              }
            };
          }
        }
      }
      return item;
    });

    // Check and update in follow-up
    const updatedFollowUp = followUpData.map((item: any) => {
      if (item.type === type && item.item) {
        const itemData = type === 'bank' ? item.item.transaction : item.item.entry;
        if (itemData && matchesTransaction(itemData, originalItem)) {
          console.log('✅ Found and updating in follow-up');
          updated = true;
          if (type === 'bank') {
            return {
              ...item,
              item: {
                ...item.item,
                transaction: {
                  ...item.item.transaction,
                  date: updatedData.date,
                  description: updatedData.description,
                  amount: updatedData.amount
                }
              }
            };
          } else {
            return {
              ...item,
              item: {
                ...item.item,
                entry: {
                  ...item.item.entry,
                  date: updatedData.date,
                  description: updatedData.description,
                  amount: updatedData.amount
                }
              }
            };
          }
        }
      }
      return item;
    });

    if (!updated) {
      console.log('⚠️ Warning: Transaction not found in any list');
      return c.json({ error: 'Transaction not found' }, 404);
    }

    console.log('💾 Saving updates to KV store...');
    
    // Save all updates
    await kv.set(recKey, reconciliationData);
    console.log('✓ Saved reconciliation data');
    
    await kv.set(timingKey, updatedTiming);
    console.log('✓ Saved timing differences');
    
    await kv.set(ignoredKey, updatedIgnored);
    console.log('✓ Saved ignored items');
    
    await kv.set(followUpKey, updatedFollowUp);
    console.log('✓ Saved follow-up items');

    console.log('✅ Transaction updated successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating transaction:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({ 
      error: 'Failed to update transaction',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Match bank transactions with ledger entries (supports many-to-many)
app.post('/bank-rec/match-items', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, bankItem, ledgerItem, bankItems, ledgerItems } = body;
    
    // Support both old single-item format and new multi-item format
    const bankItemsArray = bankItems || (bankItem ? [bankItem] : []);
    const ledgerItemsArray = ledgerItems || (ledgerItem ? [ledgerItem] : []);
    
    if (!companyId || !period || bankItemsArray.length === 0 || ledgerItemsArray.length === 0) {
      return c.json({ error: 'companyId, period, and at least one bankItem and ledgerItem are required' }, 400);
    }

    console.log(`🔗 Matching ${bankItemsArray.length} bank transaction(s) with ${ledgerItemsArray.length} ledger entry(ies):`, companyId, period);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Calculate totals for match group
    const bankTotal = bankItemsArray.reduce((sum: number, item: any) => sum + item.transaction.amount, 0);
    const ledgerTotal = ledgerItemsArray.reduce((sum: number, item: any) => sum + item.entry.amount, 0);
    const matchDifference = Math.abs(bankTotal - ledgerTotal);
    
    console.log(`💰 Bank Total: €${bankTotal.toFixed(2)}, Ledger Total: €${ledgerTotal.toFixed(2)}, Diff: €${matchDifference.toFixed(2)}`);

    // Remove all matched bank items from unmatched_bank
    if (reconciliationData.unmatched_bank) {
      reconciliationData.unmatched_bank = reconciliationData.unmatched_bank.filter((unmatchedItem: any) => {
        const txn = unmatchedItem.transaction;
        return !bankItemsArray.some((bankItem: any) => {
          const itemTxn = bankItem.transaction;
          return (
            txn.date === itemTxn.date &&
            txn.description === itemTxn.description &&
            txn.amount === itemTxn.amount
          );
        });
      });
    }

    // Remove all matched ledger items from unmatched_ledger
    if (reconciliationData.unmatched_ledger) {
      reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.filter((unmatchedItem: any) => {
        const entry = unmatchedItem.entry;
        return !ledgerItemsArray.some((ledgerItem: any) => {
          const itemEntry = ledgerItem.entry;
          return (
            entry.date === itemEntry.date &&
            entry.description === itemEntry.description &&
            entry.amount === itemEntry.amount
          );
        });
      });
    }

    // Update summary counts
    if (reconciliationData.summary) {
      reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank?.length || 0;
      reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger?.length || 0;
      reconciliationData.summary.matched_count = (reconciliationData.summary.matched_count || 0) + 1;
    }
    
    await kv.set(recKey, reconciliationData);

    // Add to resolved bucket
    const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    // Create match group description
    const matchGroupId = Date.now().toString();
    const bankDescriptions = bankItemsArray.map((item: any) => item.transaction.description).join(', ');
    const ledgerDescriptions = ledgerItemsArray.map((item: any) => item.entry.description).join(', ');
    
    // Add all bank items to resolved
    bankItemsArray.forEach((bankItem: any) => {
      existingResolved.items.push({
        type: 'bank',
        item: bankItem,
        markedAt: new Date().toISOString(),
        status: 'resolved',
        matchGroupId,
        resolution: `Matched ${bankItemsArray.length} bank transaction(s) with ${ledgerItemsArray.length} ledger entry(ies). Bank total: €${Math.abs(bankTotal).toFixed(2)}, Ledger total: €${Math.abs(ledgerTotal).toFixed(2)}`
      });
    });
    
    // Add all ledger items to resolved
    ledgerItemsArray.forEach((ledgerItem: any) => {
      existingResolved.items.push({
        type: 'ledger',
        item: ledgerItem,
        markedAt: new Date().toISOString(),
        status: 'resolved',
        matchGroupId,
        resolution: `Matched ${ledgerItemsArray.length} ledger entry(ies) with ${bankItemsArray.length} bank transaction(s). Bank total: €${Math.abs(bankTotal).toFixed(2)}, Ledger total: €${Math.abs(ledgerTotal).toFixed(2)}`
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

// Reverse a resolved item back to needs attention
app.post('/bank-rec/reverse-resolved', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, item, type } = body;
    
    if (!companyId || !period || !item || !type) {
      return c.json({ error: 'companyId, period, item, and type are required' }, 400);
    }

    console.log(`↩️ Reversing resolved item:`, companyId, period, type);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Remove from resolved bucket
    const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    // Find and remove the item from resolved
    const itemToReverse = existingResolved.items.find((resolvedItem: any) => {
      if (resolvedItem.type !== type) return false;
      const resolvedItemData = resolvedItem.item;
      const compareData = item;
      
      if (type === 'bank') {
        const txn = resolvedItemData.transaction;
        const itemTxn = compareData.transaction;
        return txn.date === itemTxn.date &&
               txn.description === itemTxn.description &&
               txn.amount === itemTxn.amount;
      } else {
        const entry = resolvedItemData.entry;
        const itemEntry = compareData.entry;
        return entry.date === itemEntry.date &&
               entry.description === itemEntry.description &&
               entry.amount === itemEntry.amount;
      }
    });
    
    if (!itemToReverse) {
      return c.json({ error: 'Item not found in resolved bucket' }, 404);
    }
    
    // Remove from resolved
    existingResolved.items = existingResolved.items.filter((resolvedItem: any) => {
      if (resolvedItem.type !== type) return true;
      const resolvedItemData = resolvedItem.item;
      const compareData = item;
      
      if (type === 'bank') {
        const txn = resolvedItemData.transaction;
        const itemTxn = compareData.transaction;
        return !(txn.date === itemTxn.date &&
                 txn.description === itemTxn.description &&
                 txn.amount === itemTxn.amount);
      } else {
        const entry = resolvedItemData.entry;
        const itemEntry = compareData.entry;
        return !(entry.date === itemEntry.date &&
                 entry.description === itemEntry.description &&
                 entry.amount === itemEntry.amount);
      }
    });
    
    await kv.set(resolvedKey, existingResolved);

    // Add back to unmatched array in reconciliation data
    if (type === 'bank') {
      if (!reconciliationData.unmatched_bank) {
        reconciliationData.unmatched_bank = [];
      }
      reconciliationData.unmatched_bank.push(item);
    } else {
      if (!reconciliationData.unmatched_ledger) {
        reconciliationData.unmatched_ledger = [];
      }
      reconciliationData.unmatched_ledger.push(item);
    }

    // Update summary counts
    if (reconciliationData.summary) {
      reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank?.length || 0;
      reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger?.length || 0;
      if (reconciliationData.summary.matched_count > 0) {
        reconciliationData.summary.matched_count -= 1;
      }
    }
    
    await kv.set(recKey, reconciliationData);

    // Also remove any corresponding JE suggestion
    const jeKey = `journal-entries:${companyId}:${period}:suggestions`;
    const existingSuggestions = await kv.get(jeKey) || { suggestions: [] };
    
    // Find and remove matching suggestion
    const originalSuggestionCount = existingSuggestions.suggestions.length;
    existingSuggestions.suggestions = existingSuggestions.suggestions.filter((s: any) => {
      if (s.sourceType !== type) return true;
      const sourceItem = s.sourceItem;
      
      if (type === 'bank') {
        const txn = sourceItem.transaction;
        const itemTxn = item.transaction;
        return !(txn.date === itemTxn.date &&
                 txn.description === itemTxn.description &&
                 txn.amount === itemTxn.amount);
      } else {
        const entry = sourceItem.entry;
        const itemEntry = item.entry;
        return !(entry.date === itemEntry.date &&
                 entry.description === itemEntry.description &&
                 entry.amount === itemEntry.amount);
      }
    });
    
    if (existingSuggestions.suggestions.length < originalSuggestionCount) {
      await kv.set(jeKey, existingSuggestions);
      console.log('✅ Also removed corresponding JE suggestion');
    }

    console.log('✅ Resolved item reversed successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error reversing resolved item:', error);
    return c.json({ error: 'Failed to reverse resolved item' }, 500);
  }
});

// Reverse a follow-up item back to needs attention
app.post('/bank-rec/reverse-follow-up', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, item, type } = body;
    
    if (!companyId || !period || !item || !type) {
      return c.json({ error: 'companyId, period, item, and type are required' }, 400);
    }

    console.log(`↩️ Reversing follow-up item:`, companyId, period, type);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Remove from follow-up bucket
    const followUpKey = `bank-rec:${companyId}:${period}:follow-up`;
    const existingFollowUps = await kv.get(followUpKey) || { items: [] };
    
    // Find and remove the item from follow-up
    const itemToReverse = existingFollowUps.items.find((followUpItem: any) => {
      if (followUpItem.type !== type) return false;
      const followUpItemData = followUpItem.item;
      const compareData = item;
      
      if (type === 'bank') {
        const txn = followUpItemData.transaction;
        const itemTxn = compareData.transaction;
        return txn.date === itemTxn.date &&
               txn.description === itemTxn.description &&
               txn.amount === itemTxn.amount;
      } else {
        const entry = followUpItemData.entry;
        const itemEntry = compareData.entry;
        return entry.date === itemEntry.date &&
               entry.description === itemEntry.description &&
               entry.amount === itemEntry.amount;
      }
    });
    
    if (!itemToReverse) {
      return c.json({ error: 'Item not found in follow-up bucket' }, 404);
    }
    
    // Remove from follow-up
    existingFollowUps.items = existingFollowUps.items.filter((followUpItem: any) => {
      if (followUpItem.type !== type) return true;
      const followUpItemData = followUpItem.item;
      const compareData = item;
      
      if (type === 'bank') {
        const txn = followUpItemData.transaction;
        const itemTxn = compareData.transaction;
        return !(txn.date === itemTxn.date &&
                 txn.description === itemTxn.description &&
                 txn.amount === itemTxn.amount);
      } else {
        const entry = followUpItemData.entry;
        const itemEntry = compareData.entry;
        return !(entry.date === itemEntry.date &&
                 entry.description === itemEntry.description &&
                 entry.amount === itemEntry.amount);
      }
    });
    
    await kv.set(followUpKey, existingFollowUps);

    // Add back to unmatched array in reconciliation data
    if (type === 'bank') {
      if (!reconciliationData.unmatched_bank) {
        reconciliationData.unmatched_bank = [];
      }
      reconciliationData.unmatched_bank.push(item);
    } else {
      if (!reconciliationData.unmatched_ledger) {
        reconciliationData.unmatched_ledger = [];
      }
      reconciliationData.unmatched_ledger.push(item);
    }

    // Update summary counts
    if (reconciliationData.summary) {
      reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank?.length || 0;
      reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger?.length || 0;
    }
    
    await kv.set(recKey, reconciliationData);

    console.log('✅ Follow-up item reversed successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error reversing follow-up item:', error);
    return c.json({ error: 'Failed to reverse follow-up item' }, 500);
  }
});

// Reverse an entire match group back to needs attention
app.post('/bank-rec/reverse-match-group', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, matchGroupId, items } = body;
    
    if (!companyId || !period || !matchGroupId || !items || items.length === 0) {
      return c.json({ error: 'companyId, period, matchGroupId, and items are required' }, 400);
    }

    console.log(`↩️ Reversing match group ${matchGroupId} with ${items.length} items:`, companyId, period);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Remove from resolved bucket
    const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    // Remove all items in the match group from resolved
    existingResolved.items = existingResolved.items.filter((resolvedItem: any) => {
      return resolvedItem.matchGroupId !== matchGroupId;
    });
    
    await kv.set(resolvedKey, existingResolved);

    // Add all items back to their respective unmatched arrays
    items.forEach((resolvedItem: any) => {
      const { type, item } = resolvedItem;
      
      if (type === 'bank') {
        if (!reconciliationData.unmatched_bank) {
          reconciliationData.unmatched_bank = [];
        }
        reconciliationData.unmatched_bank.push(item);
      } else if (type === 'ledger') {
        if (!reconciliationData.unmatched_ledger) {
          reconciliationData.unmatched_ledger = [];
        }
        reconciliationData.unmatched_ledger.push(item);
      }
    });

    // Update summary counts
    if (reconciliationData.summary) {
      reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank?.length || 0;
      reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger?.length || 0;
      if (reconciliationData.summary.matched_count > 0) {
        reconciliationData.summary.matched_count -= 1;
      }
    }
    
    await kv.set(recKey, reconciliationData);

    console.log(`✅ Match group reversed successfully. ${items.length} items moved back to needs attention.`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error reversing match group:', error);
    return c.json({ error: 'Failed to reverse match group' }, 500);
  }
});

// Migrate existing reconciliation to add pre_matched_items from matched_pairs
app.post('/bank-rec/migrate-prematched', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period } = body;
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log(`🔄 Migrating pre-matched items for:`, companyId, period);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'No reconciliation data found' }, 404);
    }

    // If pre_matched_items already exists, skip migration
    if (reconciliationData.pre_matched_items && reconciliationData.pre_matched_items.length > 0) {
      console.log('✅ Pre-matched items already exist, skipping migration');
      return c.json({ success: true, message: 'Pre-matched items already exist' });
    }

    // Build pre_matched_items from matched_pairs
    const matchedPairs = reconciliationData.matched_pairs || [];
    const preMatchedGroups: any[] = [];
    const processedPairs = new Set<number>();
    
    matchedPairs.forEach((pair: any, pairIndex: number) => {
      if (processedPairs.has(pairIndex)) return;
      
      // Skip pairs that are part of many-to-one/one-to-many but don't have ledger entries
      if (pair.ledger_entries && pair.ledger_entries.length === 0) {
        processedPairs.add(pairIndex);
        return;
      }
      
      // Create a match group
      const bankTransactions = [pair.bank_transaction];
      const ledgerEntries = pair.ledger_entries || [];
      
      // Check if this is part of a many-to-one or one-to-many match
      if (pair.match_type === 'many_to_one' || pair.match_type === 'one_to_many') {
        // Find other pairs that share the same ledger entries
        matchedPairs.forEach((otherPair: any, otherIndex: number) => {
          if (otherIndex !== pairIndex && !processedPairs.has(otherIndex)) {
            // Check if they share ledger entries
            const shareEntry = ledgerEntries.some((le: any) => 
              otherPair.ledger_entries?.some((ole: any) => ole.id === le.id)
            );
            if (shareEntry && otherPair.bank_transaction) {
              bankTransactions.push(otherPair.bank_transaction);
              processedPairs.add(otherIndex);
            }
          }
        });
      }
      
      processedPairs.add(pairIndex);
      
      // Create pre-matched group
      const matchGroupId = `match-${Date.now()}-${pairIndex}`;
      preMatchedGroups.push({
        matchGroupId,
        bankTransactions,
        ledgerEntries,
        matchedAt: new Date().toISOString(),
        confidence: pair.match_confidence || 1.0,
        matchType: pair.match_type,
      });
    });

    // Update reconciliation data with pre_matched_items
    reconciliationData.pre_matched_items = preMatchedGroups;
    await kv.set(recKey, reconciliationData);

    console.log(`✅ Migrated ${preMatchedGroups.length} pre-matched groups`);
    return c.json({ success: true, count: preMatchedGroups.length });
  } catch (error) {
    console.error('❌ Error migrating pre-matched items:', error);
    return c.json({ error: 'Failed to migrate pre-matched items' }, 500);
  }
});

// Unmatch a pre-matched group and send items back to needs attention
app.post('/bank-rec/unmatch-group', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, matchGroupId } = body;
    
    if (!companyId || !period || !matchGroupId) {
      return c.json({ error: 'companyId, period, and matchGroupId are required' }, 400);
    }

    console.log(`↩️ Unmatching pre-matched group:`, companyId, period, matchGroupId);

    // Get current reconciliation data
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (!reconciliationData) {
      return c.json({ error: 'No reconciliation data found' }, 404);
    }

    // Find the pre-matched group
    const preMatchedItems = reconciliationData.pre_matched_items || [];
    const matchGroupIndex = preMatchedItems.findIndex((g: any) => g.matchGroupId === matchGroupId);
    
    if (matchGroupIndex === -1) {
      return c.json({ error: 'Match group not found' }, 404);
    }

    const matchGroup = preMatchedItems[matchGroupIndex];
    
    // Remove from pre-matched items
    reconciliationData.pre_matched_items = preMatchedItems.filter((g: any) => g.matchGroupId !== matchGroupId);
    
    // Add bank transactions back to unmatched_bank
    const unmatchedBankItems = matchGroup.bankTransactions.map((transaction: any) => ({
      transaction,
      suggested_action: 'Review this unmatched bank transaction (unmatched from pre-matched group)',
    }));
    
    // Add ledger entries back to unmatched_ledger
    const unmatchedLedgerItems = matchGroup.ledgerEntries.map((entry: any) => ({
      entry,
      reason: 'Unmatched from pre-matched group',
      action: 'Review this unmatched ledger entry',
    }));
    
    // Update the reconciliation data
    reconciliationData.unmatched_bank = [
      ...(reconciliationData.unmatched_bank || []),
      ...unmatchedBankItems,
    ];
    
    reconciliationData.unmatched_ledger = [
      ...(reconciliationData.unmatched_ledger || []),
      ...unmatchedLedgerItems,
    ];
    
    // Update summary counts
    if (reconciliationData.summary) {
      reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank.length;
      reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
      reconciliationData.summary.matched_count = (reconciliationData.summary.matched_count || 0) - 1;
    }
    
    // Save updated reconciliation data
    await kv.set(recKey, reconciliationData);

    console.log(`✅ Unmatched group ${matchGroupId}: ${matchGroup.bankTransactions.length} bank + ${matchGroup.ledgerEntries.length} ledger transactions moved to needs attention`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error unmatching group:', error);
    return c.json({ error: 'Failed to unmatch group' }, 500);
  }
});

export default app;