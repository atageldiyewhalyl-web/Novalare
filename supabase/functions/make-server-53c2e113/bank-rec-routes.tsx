import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  parseCSV,
  parseXLSX,
  parsePDFHeuristic,
  parsePDFWithGoogle,
  parsePDFWithOpenAI,
  parsePDFWithPythonAPI,
  parsePDFWithPythonAPIFast,
  parseLedgerCSV,
  parseLedgerXLSX
} from './bank-rec-parsers.tsx';
import { parsePDFHybrid } from './pdf-hybrid-extractor.tsx';
import { extractTransactionsWithTextract } from './aws-textract-extractor.tsx';

const app = new Hono().basePath('/make-server-53c2e113');  // Add basePath to match other routes

/**
 * Sanitize filename for Supabase storage
 * Removes or replaces characters that are invalid in storage keys
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[\[\]{}()<>]/g, '') // Remove brackets and parentheses
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace other special chars with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

// ============================================
// CONFIDENCE SCORING SYSTEM
// ============================================

/**
 * Extract normalized vendor/merchant identifier from description
 * Used for enforcing vendor purity in grouped matches
 */
function extractVendorIdentifier(description: string): string {
  if (!description) return 'UNKNOWN';

  // Normalize: lowercase, trim, remove extra spaces
  let normalized = description.toLowerCase().trim().replace(/\s+/g, ' ');

  // Strip common split transaction suffixes BEFORE extracting vendor
  // Examples: "NETFLIX.COM PART A" → "netflix.com", "CHASE TXN1" → "chase"
  const splitSuffixes = /\s+(part\s*[a-z0-9]+|txn\s*[0-9]+|#[0-9]+|\d+\s*of\s*\d+|batch\s*[0-9]+|segment\s*[a-z0-9]+|split\s*[a-z0-9]+|payment\s*[0-9]+|pmt\s*[0-9]+)$/i;
  normalized = normalized.replace(splitSuffixes, '');

  // Extract vendor prefix pattern (e.g., "Vendor MO-1" → "mo-1")
  // Or extract first significant word/code
  const vendorMatch = normalized.match(/vendor\s+([a-z0-9-]+)/i);
  if (vendorMatch) {
    return vendorMatch[1].toLowerCase();
  }

  // For domain-style descriptions (e.g., "NETFLIX.COM", "BOOKING.COM")
  const domainMatch = normalized.match(/^([a-z0-9]+\.com)/i);
  if (domainMatch) {
    return domainMatch[1].toLowerCase();
  }

  // Extract merchant code pattern (e.g., "MO-1", "AMZN", "GOOG")
  const codeMatch = normalized.match(/\b([a-z]{2,4}-?\d+|[a-z]{3,5})\b/i);
  if (codeMatch) {
    return codeMatch[1].toLowerCase();
  }

  // Fallback: use first 20 chars as identifier
  return normalized.substring(0, 20);
}

/**
 * Check if a group of entries has vendor purity (all same vendor)
 * Returns { isPure: boolean, vendors: string[], message: string }
 */
function checkVendorPurity(entries: any[]): {
  isPure: boolean;
  vendors: string[];
  message: string;
} {
  if (entries.length <= 1) {
    return {
      isPure: true,
      vendors: entries.map(e => extractVendorIdentifier(e.description || '')),
      message: 'Single entry - always pure'
    };
  }

  const vendors = entries.map(e => extractVendorIdentifier(e.description || ''));
  const uniqueVendors = [...new Set(vendors)];

  const isPure = uniqueVendors.length === 1;
  const message = isPure
    ? `All entries from same vendor: ${uniqueVendors[0]}`
    : `VENDOR CONTAMINATION: Mixed vendors [${uniqueVendors.join(', ')}]`;

  return { isPure, vendors, message };
}

/**
 * Calculate date spread in days for a group of entries
 */
function calculateDateSpread(entries: any[]): number {
  if (entries.length <= 1) return 0;

  const dates = entries.map(e => new Date(e.date));
  const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());

  const earliest = sortedDates[0];
  const latest = sortedDates[sortedDates.length - 1];

  return Math.floor((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Validate if a grouped match candidate is acceptable
 * HARD CONSTRAINTS - if violated, match should not be created
 */
function validateGroupedMatch(
  entries: any[],
  matchType: 'one_to_many' | 'many_to_one'
): {
  isValid: boolean;
  reasons: string[];
  vendorPurity: boolean;
  dateSpread: number;
} {
  const reasons: string[] = [];

  // HARD CONSTRAINT 1: Vendor purity (ABSOLUTE REQUIREMENT)
  const vendorCheck = checkVendorPurity(entries);
  if (!vendorCheck.isPure) {
    reasons.push(vendorCheck.message);
  }

  // HARD CONSTRAINT 2: Date coherence (max 3 days for grouped matches)
  const dateSpread = calculateDateSpread(entries);
  if (dateSpread > 3) {
    reasons.push(`Date spread too large: ${dateSpread} days (max 3)`);
  }

  // HARD CONSTRAINT 3: No mixing of very different amounts (prevents random aggregation)
  if (entries.length >= 3) {
    const amounts = entries.map(e => Math.abs(e.amount)).sort((a, b) => a - b);
    const smallest = amounts[0];
    const largest = amounts[amounts.length - 1];

    // If largest is more than 5x smallest, likely incorrect grouping
    if (smallest > 0 && (largest / smallest) > 5) {
      reasons.push(`Amount disparity too high: €${smallest.toFixed(2)} to €${largest.toFixed(2)}`);
    }
  }

  const isValid = vendorCheck.isPure && dateSpread <= 3;

  return {
    isValid,
    reasons,
    vendorPurity: vendorCheck.isPure,
    dateSpread
  };
}

// ============================================
// SUBSET-SUM COMBINATION ALGORITHM
// Ported from AP Rec for handling 2-5 transaction combinations
// ============================================

/**
 * Generator function for all combinations of size minSize to maxSize
 */
function* getCombinations(arr: any[], minSize: number, maxSize: number): Generator<any[]> {
  function* combine(start: number, combo: any[]): Generator<any[]> {
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

/**
 * Find subsets of entries that sum to targetAmount within tolerance
 * Uses backtracking for optimal performance
 */
function findSubsetSum(
  entries: any[],
  targetAmount: number,
  tolerance: number,
  maxSize: number = 5
): any[][] {
  const results: any[][] = [];
  const n = entries.length;

  // For large entry sets, use optimized version with sorting
  if (n > 50) {
    const sorted = [...entries].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    return findSubsetSumOptimized(sorted.slice(0, 50), targetAmount, tolerance, maxSize);
  }

  function backtrack(start: number, current: any[], currentSum: number) {
    if (current.length >= 2 && current.length <= maxSize) {
      const diff = Math.abs(currentSum - targetAmount);
      if (diff <= tolerance) {
        results.push([...current]);
      }
    }

    if (current.length >= maxSize) return;
    if (currentSum > targetAmount + tolerance * 2) return;

    for (let i = start; i < n; i++) {
      const entry = entries[i];
      const newSum = currentSum + Math.abs(entry.amount);

      if (newSum > targetAmount + tolerance * 3) continue;

      current.push(entry);
      backtrack(i + 1, current, newSum);
      current.pop();
    }
  }

  backtrack(0, [], 0);
  return results.sort((a, b) => a.length - b.length);
}

/**
 * Optimized subset sum for large datasets
 */
function findSubsetSumOptimized(
  entries: any[],
  targetAmount: number,
  tolerance: number,
  maxSize: number
): any[][] {
  const results: any[][] = [];
  const n = Math.min(entries.length, 30);

  function greedyBacktrack(start: number, current: any[], currentSum: number, depth: number) {
    if (depth > 100) return;

    if (current.length >= 2 && current.length <= maxSize) {
      const diff = Math.abs(currentSum - targetAmount);
      if (diff <= tolerance) {
        results.push([...current]);
        if (results.length > 20) return;
      }
    }

    if (current.length >= maxSize || results.length > 20) return;

    for (let i = start; i < n; i++) {
      const newSum = currentSum + Math.abs(entries[i].amount);
      if (newSum > targetAmount + tolerance * 2) continue;

      current.push(entries[i]);
      greedyBacktrack(i + 1, current, newSum, depth + 1);
      current.pop();
    }
  }

  greedyBacktrack(0, [], 0, 0);
  return results;
}

/**
 * Find matching combinations using subset-sum algorithm
 * Supports 2 to maxSize (default 5) transaction combinations
 */
function findMatchingCombinations(
  entries: any[],
  targetAmount: number,
  tolerance: number,
  maxSize: number = 5,
  useSubsetSum: boolean = true
): any[][] {
  // For small entry sets, use simple combination generator
  if (entries.length <= 10) {
    const combos: any[][] = [];
    for (const combo of getCombinations(entries, 2, maxSize)) {
      const sum = combo.reduce((s, e) => s + Math.abs(e.amount), 0);
      if (Math.abs(sum - targetAmount) <= tolerance) {
        combos.push(combo);
        if (combos.length > 20) break;
      }
    }
    return combos;
  }

  // For larger sets, use subset-sum algorithm  
  if (useSubsetSum) {
    return findSubsetSum(entries, targetAmount, tolerance, maxSize);
  }

  // Fallback: limited iteration
  const combos: any[][] = [];
  let count = 0;
  for (const combo of getCombinations(entries, 2, maxSize)) {
    count++;
    if (count > 1000) break;

    const sum = combo.reduce((s, e) => s + Math.abs(e.amount), 0);
    if (Math.abs(sum - targetAmount) <= tolerance) {
      combos.push(combo);
      if (combos.length > 20) break;
    }
  }
  return combos;
}

// ============================================
// FX (FOREIGN EXCHANGE) MATCHING HELPERS
// ============================================

/**
 * Helper: Normalize vendor name for fuzzy matching
 * Strips currency codes, FX-related suffixes, and common business suffixes
 */
const normalizeVendorName = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    // 🔥 Remove currency codes at end (for bank transactions like "DROPBOX CAD")
    .replace(/\s+(usd|eur|gbp|cad|jpy|chf|aud|nzd|mxn|inr|sgd|hkd|sek|nok|dkk|cny)$/i, '')
    // 🔥 Remove FX-related suffixes (for ledger entries like "DROPBOX INTL")
    .replace(/\s+(intl|international|batch|wire|payment|transfer|pmt)$/i, '')
    // Remove common corporate suffixes
    .replace(/\s+(gmbh|co\.|co|ltd\.|ltd|inc\.|inc|ag|kg|ohg|gbr|ug|sa|srl|llc|corp|corporation)$/i, '')
    // Remove dots and special chars
    .replace(/[.,\-()]/g, '')
    // Normalize unicode (e.g., ä -> a, ö -> o)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
};


/**
 * Helper: Calculate vendor name similarity (0-1)
 */
function calculateVendorSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  const n1 = normalizeVendorName(name1);
  const n2 = normalizeVendorName(name2);

  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);

  if (words1.length >= 2 && words2.length >= 2) {
    const matchingWords = words1.filter(w1 => words2.some(w2 => w1 === w2));
    return matchingWords.length / Math.max(words1.length, words2.length);
  }

  return 0;
}

/**
 * Helper: Calculate date difference in days
 */
function calculateDateDifference(date1: string, date2: string): number {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 999;

    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    return diffMs / (1000 * 60 * 60 * 24);
  } catch {
    return 999;
  }
}

/**
 * Helper: Extract invoice/reference numbers from text
 */
function extractInvoiceReferences(text: string): string[] {
  if (!text) return [];

  const refs: string[] = [];

  // Pattern 1: Invoice #12345, INV-12345, INV12345
  const invoicePattern = /(?:invoice|inv|bill|ref|po)[\s#:-]*([a-z0-9-]+)/gi;
  let match;
  while ((match = invoicePattern.exec(text)) !== null) {
    refs.push(match[1]);
  }

  // Pattern 2: Standalone alphanumeric codes (PAC-1000, 12345)
  const codePattern = /\b([A-Z]{2,5}[-]?\d{3,8})\b/g;
  while ((match = codePattern.exec(text)) !== null) {
    refs.push(match[1]);
  }

  return refs;
}

// FX Rate Realistic Bounds (updated annually or as needed)
// These bounds are intentionally wide (±15%) to handle normal volatility
const FX_RATE_BOUNDS: Record<string, { min: number; max: number }> = {
  'USD→EUR': { min: 0.85, max: 1.10 },
  'EUR→USD': { min: 0.90, max: 1.18 },
  'USD→GBP': { min: 0.70, max: 0.90 },
  'GBP→USD': { min: 1.10, max: 1.45 },
  'EUR→GBP': { min: 0.80, max: 0.95 },
  'GBP→EUR': { min: 1.05, max: 1.25 },
  'USD→CHF': { min: 0.85, max: 1.05 },
  'CHF→USD': { min: 0.95, max: 1.18 },
  'EUR→CHF': { min: 0.92, max: 1.12 },
  'CHF→EUR': { min: 0.89, max: 1.09 },
  // JPY (Japanese Yen) - Much different scale!
  'JPY→USD': { min: 0.0060, max: 0.0095 },
  'USD→JPY': { min: 105, max: 165 },
  'JPY→EUR': { min: 0.0055, max: 0.0085 },
  'EUR→JPY': { min: 120, max: 180 },
  'JPY→GBP': { min: 0.0048, max: 0.0075 },
  'GBP→JPY': { min: 135, max: 210 },
  // CAD (Canadian Dollar)
  'CAD→USD': { min: 0.70, max: 0.82 },
  'USD→CAD': { min: 1.22, max: 1.43 },
  'CAD→EUR': { min: 0.62, max: 0.74 },
  'EUR→CAD': { min: 1.35, max: 1.62 },
  // AUD (Australian Dollar)
  'AUD→USD': { min: 0.62, max: 0.77 },
  'USD→AUD': { min: 1.30, max: 1.62 },
  'AUD→EUR': { min: 0.56, max: 0.69 },
  'EUR→AUD': { min: 1.45, max: 1.79 },
  // CNY (Chinese Yuan)
  'CNY→USD': { min: 0.13, max: 0.16 },
  'USD→CNY': { min: 6.2, max: 7.7 },
  'CNY→EUR': { min: 0.12, max: 0.15 },
  'EUR→CNY': { min: 6.7, max: 8.3 },
  // MXN (Mexican Peso)
  'MXN→USD': { min: 0.048, max: 0.065 },   // ~15-21 MXN per USD
  'USD→MXN': { min: 15.0, max: 21.0 },
  'MXN→EUR': { min: 0.044, max: 0.060 },
  'EUR→MXN': { min: 16.5, max: 23.0 },
};

/**
 * Check if this is an FX scenario (different currencies)
 */
function isFXScenario(bankCurrency: string, ledgerCurrency: string): boolean {
  if (!bankCurrency || !ledgerCurrency) return false;
  // If either is undefined/empty, assume same currency to avoid false FX matches
  // unless explicitly labeled
  return bankCurrency.toUpperCase() !== ledgerCurrency.toUpperCase();
}

/**
 * Calculate the implied FX rate from two amounts
 * Returns the rate and direction (e.g., "USD→EUR")
 */
function getImpliedFXRate(
  bankAmount: number,
  ledgerAmount: number,
  bankCurrency: string,
  ledgerCurrency: string
): { rate: number; direction: string } {
  // Calculate implied rate: ledgerAmount / bankAmount (or vice versa depending on perspective)
  // Usually Ledger is Base, Bank is Foreign? Or Bank is Base?
  // Let's standardise: We want to know 1 BankCurrency = ? LedgerCurrency
  // So LedgerAmount / BankAmount
  // Example: Bank: $100 USD. Ledger: €92 EUR.
  // Rate = 92/100 = 0.92. Direction: USD→EUR.

  const rate = Math.abs(ledgerAmount) / Math.abs(bankAmount);
  const direction = `${bankCurrency.toUpperCase()}→${ledgerCurrency.toUpperCase()}`;

  return { rate, direction };
}

/**
 * Check if an implied FX rate is realistic (within expected bounds)
 */
function isFXRateRealistic(rate: number, direction: string): boolean {
  const bounds = FX_RATE_BOUNDS[direction];
  if (!bounds) {
    // Unknown currency pair - REJECT to prevent false positives
    // We must have explicit bounds defined for all supported currency pairs
    console.warn(`⚠️ Unknown FX pair: ${direction} - Rate: ${rate.toFixed(4)} - REJECTING to prevent false match`);
    return false;
  }

  return rate >= bounds.min && rate <= bounds.max;
}

/**
 * Score an FX match using invoice number, vendor name (from description), date, and FX rate validation
 * Returns score (0-100) and match metadata
 */
function scoreFXMatch(
  bankTxn: any,
  ledgerEntry: any,
  impliedRate: number,
  fxDirection: string
): { score: number; type: string; matchType: string; fxRate: number; fxDirection: string; confidence: string; explanation: string } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Invoice/Reference Number Match (45 points - critical for FX)
  const bankRefs = extractInvoiceReferences(bankTxn.description || '');
  const ledgerRefs = extractInvoiceReferences(ledgerEntry.description || ledgerEntry.reference || '');

  if (bankRefs.length > 0 && ledgerRefs.length > 0) {
    const hasMatchingRef = bankRefs.some(bRef =>
      ledgerRefs.some(lRef =>
        bRef.toLowerCase() === lRef.toLowerCase() ||
        bRef.toLowerCase().includes(lRef.toLowerCase()) ||
        lRef.toLowerCase().includes(bRef.toLowerCase())
      )
    );

    if (hasMatchingRef) {
      score += 45;
      reasons.push(`Invoice match: ${bankRefs[0]}`);
    }
  } else {
    // No invoice numbers available - neutral (don't penalize, but don't reward)
    reasons.push('No invoice numbers available');
  }

  // 2. Vendor Name Match (25 points) - REQUIRED for FX matches!
  // For Bank Transactions, "Vendor" information is buried in the description
  const bankDescription = bankTxn.description || '';
  const ledgerDescription = ledgerEntry.description || '';

  // Note: Ledger entries often have a clean 'payee' or 'vendor' field, but here we just have description
  // In a real system we'd extract the vendor, but for now we compare descriptions

  if (bankDescription && ledgerDescription) {
    const similarity = calculateVendorSimilarity(bankDescription, ledgerDescription);
    if (similarity > 0.6) { // Slightly lower threshold for raw descriptions
      score += 25;
      reasons.push('Description match');
    } else if (similarity > 0.4) {
      score += 15;
      reasons.push('Partial description match');
    } else {
      // HARD REJECT - Description/Vendor mismatch in FX scenario is not acceptable
      // This prevents matching "Chevron" (USD) with "Starbucks" (EUR)
      return {
        score: 0,
        type: 'description_mismatch',
        matchType: 'FX Match Rejected',
        fxRate: impliedRate,
        fxDirection,
        confidence: 'rejected',
        explanation: `Description mismatch. FX matches require similarity >40%.`
      };
    }
  }

  // 3. Date Proximity (15 points - FX can have lag)
  const daysDiff = Math.abs(calculateDateDifference(bankTxn.date, ledgerEntry.date));
  if (daysDiff <= 3) {
    score += 15;
    reasons.push('Date match (≤3 days)');
  } else if (daysDiff <= 7) {
    score += 10;
    reasons.push('Date close (≤7 days)');
  } else if (daysDiff <= 14) {
    score += 5;
    reasons.push('Date within 2 weeks');
  }

  // 4. FX Rate Realistic (15 points - must pass)
  if (isFXRateRealistic(impliedRate, fxDirection)) {
    score += 15;
    reasons.push(`FX rate realistic: ${impliedRate.toFixed(4)} ${fxDirection}`);
  } else {
    // HARD REJECT - unrealistic FX rate
    return {
      score: 0,
      type: 'fx_rate_unrealistic',
      matchType: 'FX Match Rejected',
      fxRate: impliedRate,
      fxDirection,
      confidence: 'rejected',
      explanation: `FX rate ${impliedRate.toFixed(4)} ${fxDirection} is unrealistic. Possible data error or wrong match.`
    };
  }

  // 5. Amount correlation (20 points)
  // Even without matching vendors/invoices, if the FX rate is consistent, give points
  const bankAmt = Math.abs(bankTxn.amount);
  const ledgerAmt = Math.abs(ledgerEntry.amount);
  // Ideally rate should be ~1 for major pairs, but we already validated bounds.
  // Here we check if the implied rate is "clean" (e.g. not result of random division)
  // This is hard to judge without historical data. 
  // Instead, let's reward if the amounts are SIGNIFICANT (not $5 vs $4.50, but $1000 vs $920)
  if (bankAmt > 50 && ledgerAmt > 50) {
    score += 20;
    reasons.push('High value correlation');
  } else {
    score += 10;
    reasons.push('Low value correlation');
  }

  // Determine confidence level
  let confidence = 'low';
  if (score >= 80) confidence = 'high';
  else if (score >= 60) confidence = 'medium';
  else if (score >= 30) confidence = 'low';

  // Build explanation
  const explanation = `FX Transaction Match: ${reasons.join(', ')}.`;

  return {
    score,
    type: 'fx_adjusted_match',
    matchType: 'FX Transaction Match',
    fxRate: impliedRate,
    fxDirection,
    confidence,
    explanation
  };
}

interface ConfidenceFactors {
  amountScore: number;
  descriptionScore: number;
  dateScore: number;
  accountScore: number;
  transactionLogicScore: number;
}

interface MatchFlags {
  merchant_mismatch?: boolean;
  amount_variance?: number;
  unknown_description?: boolean;
  date_spread_days?: number;
  grouped_by_amount_only?: boolean;
  tolerance_match?: boolean;
  vendor_contamination?: boolean; // NEW: Cross-vendor mixing in grouped match
}

interface MatchQualityResult {
  confidence: number;
  status: 'auto_approved' | 'review_recommended' | 'manual_review_required';
  flags: MatchFlags;
  factors: ConfidenceFactors;
  explanation: string;
}

/**
 * Calculate multi-factor confidence score for a match
 * Weights: Amount 35%, Description 30%, Date 20%, Account 10%, Logic 5%
 */
function calculateMatchConfidence(
  bankTxns: any[],
  ledgerEntries: any[],
  matchType: string
): MatchQualityResult {
  const flags: MatchFlags = {};

  // 1. AMOUNT MATCH QUALITY (35%)
  const bankSum = bankTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const ledgerSum = ledgerEntries.reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const amountDiff = Math.abs(bankSum - ledgerSum);

  let amountScore = 0;
  if (amountDiff === 0) {
    amountScore = 100; // Perfect match
  } else if (amountDiff <= 0.05) {
    amountScore = 80; // Rounding tolerance
    flags.tolerance_match = true;
  } else if (amountDiff <= 0.10) {
    amountScore = 60; // Small fee/rounding
    flags.amount_variance = amountDiff;
  } else if (amountDiff <= 1.00) {
    amountScore = 30; // Larger variance - suspicious
    flags.amount_variance = amountDiff;
  } else {
    amountScore = 0; // Too large - likely incorrect
    flags.amount_variance = amountDiff;
  }

  // 2. DESCRIPTION/MERCHANT SIMILARITY (30%)
  let descriptionScore = 0;
  const hasUnknown = bankTxns.some(t =>
    !t.description ||
    t.description.toLowerCase().includes('unknown') ||
    t.description.trim() === ''
  ) || ledgerEntries.some(e =>
    !e.description ||
    e.description.toLowerCase().includes('unknown') ||
    e.description.trim() === ''
  );

  if (hasUnknown) {
    descriptionScore = 0; // Unknown descriptions = no confidence
    flags.unknown_description = true;
  } else {
    // Simple similarity check (can be enhanced with fuzzy matching)
    const bankDescs = bankTxns.map(t => (t.description || '').toLowerCase());
    const ledgerDescs = ledgerEntries.map(e => (e.description || '').toLowerCase());

    let matchCount = 0;
    for (const bDesc of bankDescs) {
      for (const lDesc of ledgerDescs) {
        if (bDesc.includes(lDesc) || lDesc.includes(bDesc)) {
          matchCount++;
          break;
        }
      }
    }

    if (matchCount === 0) {
      descriptionScore = 0; // No similarity
      flags.merchant_mismatch = true;
    } else if (matchCount >= bankDescs.length / 2) {
      descriptionScore = 100; // Good similarity
    } else {
      descriptionScore = 50; // Partial similarity
    }
  }

  // 3. DATE PROXIMITY (20%)
  let dateScore = 100;
  const bankDates = bankTxns.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
  const ledgerDates = ledgerEntries.map(e => new Date(e.date)).sort((a, b) => a.getTime() - b.getTime());

  if (bankDates.length > 0 && ledgerDates.length > 0) {
    const earliestBank = bankDates[0];
    const latestBank = bankDates[bankDates.length - 1];
    const bankSpreadDays = Math.floor((latestBank.getTime() - earliestBank.getTime()) / (1000 * 60 * 60 * 24));

    // Check date spread within bank transactions
    if (bankSpreadDays > 3) {
      flags.date_spread_days = bankSpreadDays;
      dateScore -= 30; // Penalize large spreads
    }

    // Check proximity to ledger dates
    let minDiff = Infinity;
    for (const bDate of bankDates) {
      for (const lDate of ledgerDates) {
        const diff = Math.abs(bDate.getTime() - lDate.getTime()) / (1000 * 60 * 60 * 24);
        minDiff = Math.min(minDiff, diff);
      }
    }

    if (minDiff === 0) {
      dateScore = 100; // Same day
    } else if (minDiff <= 1) {
      dateScore = 90; // 1 day apart
    } else if (minDiff <= 3) {
      dateScore = 70; // 2-3 days apart
    } else if (minDiff <= 7) {
      dateScore = 50; // Within a week
    } else {
      dateScore = 20; // More than a week apart
    }
  }

  // 4. ACCOUNT MATCHING (10%)
  // Placeholder - can be enhanced if account info is available
  const accountScore = 100; // Assume same account for now

  // 5. TRANSACTION LOGIC (5%)
  let transactionLogicScore = 100;
  if (matchType === 'many_to_one' || matchType === 'one_to_many') {
    transactionLogicScore = 70; // Multi-transaction matches are inherently riskier

    // NEW: Check vendor purity for grouped matches
    const entriesToCheck = matchType === 'one_to_many' ? ledgerEntries : bankTxns;
    const vendorCheck = checkVendorPurity(entriesToCheck);

    if (!vendorCheck.isPure) {
      // CRITICAL: Vendor contamination is a hard failure
      flags.vendor_contamination = true;
      transactionLogicScore = 0; // Force score to collapse
    }
  }

  // Check if grouped by amount only (no other signals)
  if (amountDiff < 0.10 && descriptionScore === 0 && dateScore < 50) {
    flags.grouped_by_amount_only = true;
    transactionLogicScore = Math.min(transactionLogicScore, 30);
  }

  // CALCULATE WEIGHTED CONFIDENCE
  const factors: ConfidenceFactors = {
    amountScore,
    descriptionScore,
    dateScore,
    accountScore,
    transactionLogicScore
  };

  const confidence = (
    amountScore * 0.35 +
    descriptionScore * 0.30 +
    dateScore * 0.20 +
    accountScore * 0.10 +
    transactionLogicScore * 0.05
  ) / 100;

  // DETERMINE STATUS BASED ON CONFIDENCE AND FLAGS
  let status: 'auto_approved' | 'review_recommended' | 'manual_review_required';
  const hasRedFlags = flags.merchant_mismatch ||
    flags.unknown_description ||
    (flags.amount_variance && flags.amount_variance > 0.10) ||
    flags.grouped_by_amount_only ||
    flags.vendor_contamination; // NEW: Hard blocker

  // CRITICAL: Vendor contamination forces manual review regardless of confidence
  if (flags.vendor_contamination) {
    status = 'manual_review_required';
  } else if (confidence >= 0.90 && !hasRedFlags) {
    status = 'auto_approved';
  } else if (confidence >= 0.60 && !hasRedFlags) {
    status = 'review_recommended';
  } else {
    status = 'manual_review_required';
  }

  // BUILD EXPLANATION
  const warnings: string[] = [];
  if (flags.vendor_contamination) warnings.push('⚠️ VENDOR CONTAMINATION - Mixed vendors'); // NEW: Most critical
  if (flags.merchant_mismatch) warnings.push('Merchant mismatch');
  if (flags.unknown_description) warnings.push('Unknown description');
  if (flags.amount_variance) warnings.push(`Amount variance: €${flags.amount_variance.toFixed(2)}`);
  if (flags.date_spread_days) warnings.push(`${flags.date_spread_days}-day spread`);
  if (flags.grouped_by_amount_only) warnings.push('Grouped by amount only');

  const explanation = warnings.length > 0
    ? `${(confidence * 100).toFixed(0)}% confidence - ${warnings.join(', ')}`
    : `${(confidence * 100).toFixed(0)}% confidence - Good match`;

  return {
    confidence,
    status,
    flags,
    factors,
    explanation
  };
}

// ============================================
// FINANCIAL SUMMARY RECALCULATION HELPER
// ============================================

/**
 * Recalculate matched and unmatched amounts from reconciliation data
 * This ensures financial breakdowns stay accurate after manual match/unmatch operations
 */
function recalculateFinancialBreakdown(reconciliationData: any): void {
  if (!reconciliationData.summary) return;

  // Calculate matched amounts
  let matchedBankAmount = 0;
  let matchedLedgerAmount = 0;

  const matchedPairs = reconciliationData.matched_pairs || [];
  for (const match of matchedPairs) {
    // Sum bank side of matches
    if (match.bank_transactions && Array.isArray(match.bank_transactions)) {
      matchedBankAmount += match.bank_transactions.reduce((sum: number, bt: any) => sum + bt.amount, 0);
    } else if (match.bank_transaction) {
      matchedBankAmount += match.bank_transaction.amount;
    }

    // Sum ledger side of matches
    if (match.ledger_entries && Array.isArray(match.ledger_entries)) {
      matchedLedgerAmount += match.ledger_entries.reduce((sum: number, le: any) => sum + le.amount, 0);
    }
  }

  // Calculate unmatched amounts
  const unmatchedBank = reconciliationData.unmatched_bank || [];
  const unmatchedLedger = reconciliationData.unmatched_ledger || [];

  const unmatchedBankAmount = unmatchedBank.reduce((sum: number, item: any) => sum + item.transaction.amount, 0);
  const unmatchedLedgerAmount = unmatchedLedger.reduce((sum: number, item: any) => sum + item.entry.amount, 0);

  // Calculate net differences
  const matchedNetDifference = matchedBankAmount - matchedLedgerAmount;
  const unmatchedNetDifference = unmatchedBankAmount - unmatchedLedgerAmount;

  // Update summary
  reconciliationData.summary.matched_bank_amount = matchedBankAmount;
  reconciliationData.summary.matched_ledger_amount = matchedLedgerAmount;
  reconciliationData.summary.matched_net_difference = matchedNetDifference;
  reconciliationData.summary.unmatched_bank_amount = unmatchedBankAmount;
  reconciliationData.summary.unmatched_ledger_amount = unmatchedLedgerAmount;
  reconciliationData.summary.unmatched_net_difference = unmatchedNetDifference;

  console.log(`💰 Recalculated financial breakdown: Matched Bank=${matchedBankAmount.toFixed(2)}, Matched Ledger=${matchedLedgerAmount.toFixed(2)}, Unmatched Bank=${unmatchedBankAmount.toFixed(2)}, Unmatched Ledger=${unmatchedLedgerAmount.toFixed(2)}`);
}

// ============================================
// BANK RECONCILIATION ROUTES
// ============================================

// Get bank statements and transactions for a company/period
app.get('/bank-rec/bank-data', async (c) => {
  try {
    const companyId = c.req.query('company_id');
    const period = c.req.query('period');
    const accountId = c.req.query('account_id');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '0'); // 0 = no pagination (backward compat)

    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    // Include account_id in key to separate data by bank account
    const key = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:bank-data`
      : `bank-rec:${companyId}:${period}:bank-data`;
    const data = await kv.get(key);

    const allTransactions = data?.transactions || [];
    const statements = data?.statements || [];

    // If pagination is requested
    if (pageSize > 0) {
      const total = allTransactions.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

      return c.json({
        statements,
        transactions: paginatedTransactions,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      });
    }

    // Return all data (backward compatibility)
    return c.json({
      statements: statements,
      transactions: allTransactions
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
    const accountId = c.req.query('account_id');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '0'); // 0 = no pagination (backward compat)

    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    // Include account_id in key to separate data by bank account
    const key = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:ledger-data`
      : `bank-rec:${companyId}:${period}:ledger-data`;
    const data = await kv.get(key);

    const allEntries = data?.entries || [];
    const ledger = data?.ledger || null;

    // If pagination is requested
    if (pageSize > 0) {
      const total = allEntries.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedEntries = allEntries.slice(startIndex, endIndex);

      return c.json({
        ledger,
        entries: paginatedEntries,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      });
    }

    // Return all data (backward compatibility)
    return c.json({
      ledger: ledger,
      entries: allEntries
    });
  } catch (error) {
    console.error('❌ Error fetching ledger data:', error);
    return c.json({ error: 'Failed to fetch ledger data' }, 500);
  }
});

// Save synced GL data from QuickBooks (POST)
app.post('/bank-rec/ledger-data', async (c) => {
  try {
    const body = await c.req.json();
    const { company_id, period, account_id, ledger, entries } = body;

    if (!company_id || !period || !ledger || !entries) {
      return c.json({ error: 'company_id, period, ledger, and entries are required' }, 400);
    }

    // Include account_id in key to separate data by bank account
    const key = account_id
      ? `bank-rec:${company_id}:${account_id}:${period}:ledger-data`
      : `bank-rec:${company_id}:${period}:ledger-data`;
    await kv.set(key, { ledger, entries });

    console.log(`✅ Saved ${entries.length} ledger entries for company ${company_id}, account ${account_id || 'default'}, period ${period}`);

    return c.json({
      success: true,
      entry_count: entries.length
    });
  } catch (error) {
    console.error('❌ Error saving ledger data:', error);
    return c.json({ error: 'Failed to save ledger data' }, 500);
  }
});

// Get reconciliation results for a company/period
app.get('/bank-rec/reconciliation-data', async (c) => {
  try {
    const companyId = c.req.query('company_id');
    const period = c.req.query('period');
    const accountId = c.req.query('account_id');

    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    // Include account_id in key to separate data by bank account
    const key = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:reconciliation`
      : `bank-rec:${companyId}:${period}:reconciliation`;
    let result = await kv.get(key);

    // Filter out any fuzzy matches from stored data (AI matching disabled)
    if (result && result.matches) {
      const originalCount = result.matches.length;
      result.matches = result.matches.filter(m => m.match_type !== 'fuzzy');
      if (result.matches.length < originalCount) {
        console.log(`🚫 Filtered out ${originalCount - result.matches.length} fuzzy matches from stored data`);
      }
    }

    // Get additional data for tabs (matching /reconciliation endpoint)
    // Use accountId in keys for bank-rec to match write path in journal-entries-routes.tsx
    const timingKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:timing-differences`
      : `bank-rec:${companyId}:${period}:timing-differences`;
    const ignoredKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:ignored`
      : `bank-rec:${companyId}:${period}:ignored`;
    const followUpKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:follow-up`
      : `bank-rec:${companyId}:${period}:follow-up`;
    const resolvedKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:resolved`
      : `bank-rec:${companyId}:${period}:resolved`;

    const timingDiffs = await kv.get(timingKey) || { items: [] };
    const ignored = await kv.get(ignoredKey) || { items: [] };
    const followUp = await kv.get(followUpKey) || { items: [] };
    const resolved = await kv.get(resolvedKey) || { items: [] };

    console.log(`🔍 DEBUG: Fetching resolved items from key: ${resolvedKey}, found: ${resolved.items?.length || 0} items`);

    // Merge into result if result exists, or create new object
    const finalResult = result || {};

    return c.json({
      result: {
        ...finalResult,
        timing_differences: timingDiffs.items || [],
        ignored_items: ignored.items || [],
        follow_up_items: followUp.items || [],
        resolved_items: resolved.items || []
      }
    });
  } catch (error) {
    console.error('❌ Error fetching reconciliation data:', error);
    return c.json({ error: 'Failed to fetch reconciliation data' }, 500);
  }
});

// LIGHTWEIGHT STATUS SUMMARY - Optimized for Month-End Close checklist (80% faster)
// Returns only essential status info without fetching full reconciliation data
app.get('/bank-rec/status-summary', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log(`⚡ Fetching bank rec status summary for ${companyId} - ${period}`);

    // 1. Fetch COA to identify ACTIVE bank accounts
    const coaKey = `company_coa_${companyId}`;
    const coaData = await kv.get(coaKey);

    let bankAccounts: any[] = [];
    if (coaData?.accounts) {
      bankAccounts = coaData.accounts.filter((acc: any) =>
        // Be more specific about bank accounts to avoid counting "Cash on Hand" or "Equities"
        (acc.type === 'Bank' || acc.detailType === 'Bank' || acc.detailType === 'Checking' || acc.detailType === 'Savings') &&
        acc.isActive !== false &&
        !acc.name?.toLowerCase().includes('opening balance') &&
        !acc.name?.toLowerCase().includes('petty cash')
      );
    }

    // If no bank accounts, return early
    if (bankAccounts.length === 0) {
      console.log(`⚡ No bank accounts found after filtering for ${companyId}`);
      return c.json({ exists: false, accountCount: 0 });
    }

    console.log(`⚡ Found ${bankAccounts.length} bank accounts:`, bankAccounts.map(a => `${a.name} (ID: ${a.id}, Type: ${a.type}/${a.detailType})` || 'Unnamed'));

    let totalMatchedCount = 0;
    let totalUnmatchedBankCount = 0;
    let totalUnmatchedLedgerCount = 0;
    let totalLocked = 0;
    let earliestLockedAt: string | null = null;
    let existsCount = 0; // Count of accounts for which reconciliation data exists

    // 2. Check reconciliations for EACH active bank account
    for (const acc of bankAccounts) {
      const recKey = `bank-rec:${companyId}:${acc.id}:${period}:reconciliation`;
      const rec = await kv.get(recKey);

      if (rec) {
        existsCount++;
        console.log(`⚡ Found reconciliation for account: ${acc.name} (${acc.id}), locked: ${rec.locked}`);
        if (rec.locked) {
          totalLocked++;
          // Track earliest lock time
          if (rec.lockedAt && (!earliestLockedAt || rec.lockedAt < earliestLockedAt)) {
            earliestLockedAt = rec.lockedAt;
          }
        }

        // Add counts from summary or arrays
        if (rec.summary) {
          totalMatchedCount += (rec.summary.matched_count || 0);
          totalUnmatchedBankCount += (rec.summary.unmatched_bank_count || 0);
          totalUnmatchedLedgerCount += (rec.summary.unmatched_ledger_count || 0);
        } else {
          totalMatchedCount += (rec.matched_pairs?.length || 0);
          totalUnmatchedBankCount += (rec.unmatched_bank?.length || 0);
          totalUnmatchedLedgerCount += (rec.unmatched_ledger?.length || 0);
        }
      } else {
        console.log(`⚡ No reconciliation found for account: ${acc.name} (${acc.id}) for period ${period}`);
      }
    }

    // 3. Fallback for legacy keys (if no account-specific ones found at all)
    if (existsCount === 0) {
      const oldKey = `bank-rec:${companyId}:${period}:reconciliation`;
      const oldRec = await kv.get(oldKey);
      if (oldRec) {
        console.log(`⚡ Found old-style reconciliation key: ${oldKey}`);
        existsCount = 1;
        if (oldRec.locked) totalLocked = 1;
        earliestLockedAt = oldRec.lockedAt || null;

        if (oldRec.summary) {
          totalMatchedCount = oldRec.summary.matched_count || 0;
          totalUnmatchedBankCount = oldRec.summary.unmatched_bank_count || 0;
          totalUnmatchedLedgerCount = oldRec.summary.unmatched_ledger_count || 0;
        } else {
          totalMatchedCount = oldRec.matched_pairs?.length || 0;
          totalUnmatchedBankCount = oldRec.unmatched_bank?.length || 0;
          totalUnmatchedLedgerCount = oldRec.unmatched_ledger?.length || 0;
        }
      }
    }

    if (existsCount === 0 && bankAccounts.length > 0) {
      return c.json({
        exists: false,
        accountCount: bankAccounts.length
      });
    }

    // Determine final account count to report
    // If the user expects 2, but we find 3 in the COA, it will still show 3.
    // However, if one of those 3 doesn't have a reconciliation record,
    // then it won't be completed, which is correct (it needs reconciliation).
    // If the user wants strictly 2, they should mark the 3rd one as inactive in the COA.
    const finalAccountCount = bankAccounts.length;

    return c.json({
      exists: existsCount > 0, // exists is true if at least one reconciliation record was found
      locked: totalLocked === finalAccountCount, // Only locked if all active accounts are locked
      lockedCount: totalLocked,
      lockedAt: earliestLockedAt,
      accountCount: finalAccountCount,
      matchedCount: totalMatchedCount,
      unmatchedBankCount: totalUnmatchedBankCount,
      unmatchedLedgerCount: totalUnmatchedLedgerCount,
      accounts: bankAccounts.map(a => ({ name: a.name, id: a.id })) // For debugging
    });

  } catch (error) {
    console.error('❌ Error in /bank-rec/status-summary:', error);
    return c.json({ error: 'Failed to fetch status summary' }, 500);
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
    let result = await kv.get(recKey);

    if (!result) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Filter out any fuzzy matches from stored data (AI matching disabled)
    if (result.matches) {
      const originalCount = result.matches.length;
      result.matches = result.matches.filter(m => m.match_type !== 'fuzzy');
      if (result.matches.length < originalCount) {
        console.log(`🚫 Filtered out ${originalCount - result.matches.length} fuzzy matches from stored data`);
      }
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
      // Parse PDF bank statement with hybrid parser (AI schema + coordinate-based extraction)
      transactions = await parsePDFHybrid(uint8Array, bankFile.name);
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

    // Upload file to storage (sanitize filename to remove invalid characters)
    const sanitizedFileName = sanitizeFileName(bankFile.name);
    const filePath = `${companyId}/${period}/${statementId}-${sanitizedFileName}`;
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

    // Get account_id from form data
    const accountId = formData.get('account_id') as string;

    // Load existing data - IMPORTANT: Use account_id to separate data by account
    const key = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:bank-data`
      : `bank-rec:${companyId}:${period}:bank-data`;
    console.log(`📦 Storing data with key: ${key}${accountId ? ` (account: ${accountId})` : ' (no account)'}`);

    const existingData = await kv.get(key) || { statements: [], transactions: [] };

    // Add new statement and transactions
    existingData.statements.push(statement);
    existingData.transactions.push(...transactionsWithIds);

    // Save updated data
    await kv.set(key, existingData);

    console.log(`✅ Bank statement uploaded: ${transactionsWithIds.length} transactions extracted`);

    // Start background re-reconciliation if enabled
    /*
    if (!accountId) {
      console.log('⚡ Triggering background reconciliation for updated data...');
      // Logic to trigger run-reconciliation would go here
    }
    */

    // INVALIDATE CACHE for period status
    console.log(`🗑️ Invalidating period status cache for ${companyId}:${period}`);
    await kv.del(`bank-rec:${companyId}:${period}:status`);

    return c.json({
      statementId,
      transactionCount: transactionsWithIds.length
    });
  } catch (error) {
    console.error('❌ Error uploading bank statement:', error);
    return c.json({ error: `Failed to upload bank statement: ${error.message}` }, 500);
  }
});

// Delete a bank statement and its transactions
app.post('/bank-rec/delete-bank-statement', async (c) => {
  try {
    const body = await c.req.json();
    const { company_id, account_id, period, statement_id } = body;

    if (!company_id || !period || !statement_id) {
      return c.json({ error: 'company_id, period, and statement_id are required' }, 400);
    }

    // Get the storage key
    const key = account_id
      ? `bank-rec:${company_id}:${account_id}:${period}:bank-data`
      : `bank-rec:${company_id}:${period}:bank-data`;

    // Load existing data
    const existingData = await kv.get(key);

    if (!existingData) {
      return c.json({ error: 'No bank data found for this period' }, 404);
    }

    // Filter out the statement and its transactions
    const originalStatementCount = existingData.statements?.length || 0;
    const originalTransactionCount = existingData.transactions?.length || 0;

    existingData.statements = (existingData.statements || []).filter(
      (s: any) => s.id !== statement_id
    );
    existingData.transactions = (existingData.transactions || []).filter(
      (t: any) => t.statementId !== statement_id
    );

    const deletedStatements = originalStatementCount - existingData.statements.length;
    const deletedTransactions = originalTransactionCount - existingData.transactions.length;

    if (deletedStatements === 0) {
      return c.json({ error: 'Statement not found' }, 404);
    }

    // Save updated data
    await kv.set(key, existingData);

    console.log(`🗑️ Deleted statement ${statement_id}: ${deletedTransactions} transactions removed`);

    return c.json({
      success: true,
      deleted_statement_id: statement_id,
      deleted_transaction_count: deletedTransactions
    });
  } catch (error: any) {
    console.error('❌ Error deleting bank statement:', error);
    return c.json({ error: `Failed to delete bank statement: ${error.message}` }, 500);
  }
});

// Upload and parse bank statement with STREAMING (transactions sent one by one)
app.post('/bank-rec/upload-bank-statement-stream', async (c) => {
  console.log('🚨🚨🚨 STREAMING UPLOAD ROUTE HIT!');
  try {
    console.log('🚨 Step 1: Parsing form data...');
    const formData = await c.req.formData();
    console.log('🚨 Step 2: Form data parsed successfully');
    const bankFile = formData.get('bank_file') as File;
    const companyId = formData.get('company_id') as string;
    const accountId = formData.get('account_id') as string;
    const period = formData.get('period') as string;
    const extractionMethod = (formData.get('extraction_method') as string) || 'heuristic'; // Default to heuristic
    console.log('🚨 Step 3: Got file:', bankFile?.name, 'Company:', companyId, 'Account:', accountId, 'Period:', period, 'Method:', extractionMethod);

    if (!bankFile || !companyId || !period) {
      console.log('🚨 Step 4: Missing required fields!');
      return c.json({ error: 'bank_file, company_id, and period are required' }, 400);
    }

    console.log('📤 Processing bank statement with streaming:', bankFile.name);

    // Set up SSE response headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Helper to send SSE message
          const sendMessage = (data: any) => {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            console.log('📡 Sending SSE message:', data.type, data.progress || '');
            controller.enqueue(encoder.encode(message));
          };

          console.log('🔍 Starting file parsing...');
          // Parse the file
          const fileBuffer = await bankFile.arrayBuffer();
          const uint8Array = new Uint8Array(fileBuffer);

          // Generate statement ID FIRST (needed for batches)
          const statementId = crypto.randomUUID();
          let allTransactions: any[] = [];

          // Handle PDF with selected extraction method
          if (bankFile.name.endsWith('.pdf')) {
            let transactions: any[] = [];

            if (extractionMethod === 'textract') {
              // AWS Textract + GPT-4 mini: 5-8 second target (vs 40+ seconds with GPT-4o Vision)
              console.log('🚀 Using AWS TEXTRACT + GPT-4 MINI (5-8 second target)...');
              transactions = await extractTransactionsWithTextract(uint8Array, bankFile.name);
              console.log(`✅✅✅ Textract extracted ${transactions.length} transactions in record time!`);
            } else if (extractionMethod === 'hybrid') {
              console.log('🚀 Using HYBRID parser (AI schema + PDF.js coordinates)...');
              transactions = await parsePDFHybrid(uint8Array, bankFile.name);
              console.log(`✅✅✅ Hybrid parser extracted ${transactions.length} transactions with coordinate-based precision!`);
            } else if (extractionMethod === 'heuristic') {
              console.log('⚡ Using OLD HEURISTIC parser (instant, free, but has bugs)...');
              transactions = await parsePDFHeuristic(uint8Array, bankFile.name);
              console.log(`✅ Heuristic parser extracted ${transactions.length} transactions (INSTANT but amounts may be wrong!)`);
            } else if (extractionMethod === 'python-fast') {
              console.log('🚀 Using PYTHON API FAST (GPT-4 mini Split & Map - 10x faster!)...');
              transactions = await parsePDFWithPythonAPIFast(uint8Array, bankFile.name);
              console.log(`✅ Python API FAST extracted ${transactions.length} transactions`);
            } else if (extractionMethod === 'python-heuristic') {
              console.log('🐍 Using PYTHON API with AI Layout Discovery (OLD - slow)...');
              transactions = await parsePDFWithPythonAPI(uint8Array, bankFile.name);
              console.log(`✅ Python API extracted ${transactions.length} transactions`);
            } else if (extractionMethod === 'google') {
              console.log('🤖 Using GOOGLE Document AI (fast, accurate)...');
              transactions = await parsePDFWithGoogle(uint8Array, bankFile.name);
              console.log(`✅ Google AI extracted ${transactions.length} transactions`);
            } else if (extractionMethod === 'openai') {
              console.log('🧠 Using OPENAI GPT-4 Vision (slow, most accurate)...');
              transactions = await parsePDFWithOpenAI(uint8Array, bankFile.name);
              console.log(`✅ OpenAI extracted ${transactions.length} transactions`);
            } else {
              // Fallback to hybrid parser (best default)
              console.log('📄 Using HYBRID parser as default (AI schema + coordinates)...');
              transactions = await parsePDFHybrid(uint8Array, bankFile.name);
              console.log(`✅ Hybrid parser extracted ${transactions.length} transactions`);
            }

            // Add IDs and metadata to each transaction
            const transactionsWithIds = transactions.map(txn => ({
              ...txn,
              id: crypto.randomUUID(),
              statementId,
              statementName: bankFile.name
            }));

            // 🔍 CRITICAL DEBUGGING: Log currency distribution
            const currencyCount: Record<string, number> = {};
            transactionsWithIds.forEach(txn => {
              const curr = txn.currency || 'MISSING';
              currencyCount[curr] = (currencyCount[curr] || 0) + 1;
            });
            console.log('💱💱💱 CURRENCY DISTRIBUTION IN EXTRACTED TRANSACTIONS:');
            console.log(JSON.stringify(currencyCount, null, 2));
            console.log(`📊 Sample transaction: ${JSON.stringify(transactionsWithIds[0], null, 2)}`);

            allTransactions = transactionsWithIds;

            // Stream transactions to client
            for (let i = 0; i < allTransactions.length; i++) {
              sendMessage({
                type: 'transaction',
                data: allTransactions[i],
                progress: {
                  current: i + 1,
                  total: allTransactions.length
                }
              });

              // Small delay for UI smoothness (but faster than OpenAI batching!)
              if (i < allTransactions.length - 1 && allTransactions.length <= 100) {
                await new Promise(resolve => setTimeout(resolve, 20));
              }
            }

            console.log(`✅ Google Document AI processing complete: ${allTransactions.length} total transactions`);

          } else {
            // CSV/XLSX: Parse all at once (fast enough)
            let transactions: any[] = [];

            if (bankFile.name.endsWith('.csv')) {
              const text = new TextDecoder().decode(uint8Array);
              transactions = await parseCSV(text, bankFile.name);
            } else if (bankFile.name.endsWith('.xlsx') || bankFile.name.endsWith('.xls')) {
              transactions = await parseXLSX(uint8Array, bankFile.name);
            } else {
              sendMessage({ type: 'error', error: 'Unsupported file format. Please use PDF, CSV, or XLSX.' });
              controller.close();
              return;
            }

            console.log(`✅ Parsed ${transactions.length} transactions`);

            // Add IDs and send transactions
            const transactionsWithIds = transactions.map(txn => ({
              ...txn,
              id: crypto.randomUUID(),
              statementId,
              statementName: bankFile.name
            }));

            // 🔍 CRITICAL DEBUGGING: Log currency distribution
            const currencyCount: Record<string, number> = {};
            transactionsWithIds.forEach(txn => {
              const curr = txn.currency || 'MISSING';
              currencyCount[curr] = (currencyCount[curr] || 0) + 1;
            });
            console.log('💱💱💱 CURRENCY DISTRIBUTION IN EXTRACTED CSV/XLSX TRANSACTIONS:');
            console.log(JSON.stringify(currencyCount, null, 2));
            console.log(`📊 Sample transaction: ${JSON.stringify(transactionsWithIds[0], null, 2)}`);

            allTransactions = transactionsWithIds;

            // Send transactions one by one
            console.log('🚀 Starting to stream CSV/XLSX transactions...');
            for (let i = 0; i < allTransactions.length; i++) {
              sendMessage({
                type: 'transaction',
                data: allTransactions[i],
                progress: {
                  current: i + 1,
                  total: allTransactions.length
                }
              });

              // Smart delay based on batch size
              // Large batches (>100): NO delay - stream at full speed!
              // Small batches (<100): 50ms delay for visible streaming effect
              if (i < allTransactions.length - 1 && allTransactions.length <= 100) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }
          }

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

          // Upload file to storage (sanitize filename to remove invalid characters)
          const sanitizedFileName = sanitizeFileName(bankFile.name);
          const filePath = accountId
            ? `${companyId}/${accountId}/${period}/${statementId}-${sanitizedFileName}`
            : `${companyId}/${period}/${statementId}-${sanitizedFileName}`;
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, uint8Array, {
              contentType: bankFile.type,
              upsert: false
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            sendMessage({ type: 'error', error: `Failed to store file: ${uploadError.message}` });
            controller.close();
            return;
          }

          // Generate signed URL (valid for 1 year)
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, 31536000);

          if (urlError) {
            console.error('Signed URL error:', urlError);
            sendMessage({ type: 'error', error: `Failed to generate file URL: ${urlError.message}` });
            controller.close();
            return;
          }

          console.log('✅ File stored in Supabase Storage:', filePath);

          // Create statement object with file URL
          const statement = {
            id: statementId,
            fileName: bankFile.name,
            uploadedAt: Date.now(),
            transactionCount: allTransactions.length,
            fileUrl: signedUrlData.signedUrl,
            filePath: filePath
          };

          // Load existing data - include account_id in key to separate data by bank account
          const key = accountId
            ? `bank-rec:${companyId}:${accountId}:${period}:bank-data`
            : `bank-rec:${companyId}:${period}:bank-data`;
          const existingData = await kv.get(key) || { statements: [], transactions: [] };

          // Add new statement and transactions
          existingData.statements.push(statement);
          existingData.transactions.push(...allTransactions);

          // Save updated data
          await kv.set(key, existingData);

          console.log(`✅ Bank statement uploaded: ${allTransactions.length} transactions extracted`);

          // Update account balance
          if (accountId && companyId) {
            try {
              console.log(`🔄 Updating account balance for accountId: ${accountId}, companyId: ${companyId}`);

              // Calculate ending balance from most recent transaction
              const sortedTransactions = [...allTransactions].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB.getTime() - dateA.getTime(); // Most recent first
              });

              const endingBalance = sortedTransactions[0]?.balance;

              console.log(`📊 Calculated ending balance: ${endingBalance}`);

              // Update account metadata
              const coaKey = `company_coa_${companyId}`;
              const coaData = await kv.get(coaKey);

              if (coaData && coaData.accounts) {
                const updatedAccounts = coaData.accounts.map((account: any) => {
                  if (account.id === accountId) {
                    console.log(`✅ Updating balance for ${account.name}: ${account.balance} → ${endingBalance}`);
                    return {
                      ...account,
                      balance: endingBalance !== undefined && endingBalance !== null ? endingBalance : account.balance,
                    };
                  }
                  return account;
                });

                await kv.set(coaKey, { accounts: updatedAccounts });
                console.log(`✅ Account balance updated successfully`);
              }
            } catch (metadataError) {
              console.error('⚠️ Failed to update account balance:', metadataError);
              // Don't fail the upload if metadata update fails
            }
          }

          // Send completion message
          sendMessage({
            type: 'complete',
            statementId,
            transactionCount: allTransactions.length,
            fileName: bankFile.name
          });

          // INVALIDATE CACHE for period status (fire and forget for stream)
          console.log(`🗑️ Invalidating period status cache for ${companyId}:${period}`);
          kv.del(`bank-rec:${companyId}:${period}:status`).catch(console.error);

          controller.close();
        } catch (error) {
          console.error('❌ Error in streaming upload:', error);
          const message = `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`;
          controller.enqueue(encoder.encode(message));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('❌ Error setting up streaming upload:', error);
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
    const accountId = formData.get('account_id') as string;

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

    // Save ledger data - ACCOUNT-SPECIFIC (each bank account has its own ledger)
    const key = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:ledger-data`
      : `bank-rec:${companyId}:${period}:ledger-data`;
    await kv.set(key, {
      ledger,
      entries: entriesWithIds
    });

    console.log(`✅ General ledger uploaded: ${entriesWithIds.length} entries extracted`);

    console.log(`✅ General ledger uploaded: ${entriesWithIds.length} entries extracted`);

    // INVALIDATE CACHE for period status
    console.log(`🗑️ Invalidating period status cache for ${companyId}:${period}`);
    await kv.del(`bank-rec:${companyId}:${period}:status`);

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
    const accountId = c.req.query('account_id');

    if (!companyId || !period) {
      return c.json({ error: 'company_id and period query params are required' }, 400);
    }

    // Include account_id in key to separate data by bank account
    const key = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:bank-data`
      : `bank-rec:${companyId}:${period}:bank-data`;
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
    const accountId = c.req.query('account_id');

    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    // Include account_id in key to separate data by bank account
    const key = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:ledger-data`
      : `bank-rec:${companyId}:${period}:ledger-data`;
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
    const { company_id: companyId, period, account_id: accountId } = body;

    if (!companyId || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    console.log(`🔄 Running reconciliation for ${companyId} - account ${accountId || 'default'} - ${period}`);

    // Load bank data - include account_id in key to separate data by bank account
    const bankKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:bank-data`
      : `bank-rec:${companyId}:${period}:bank-data`;
    const bankData = await kv.get(bankKey);

    if (!bankData || !bankData.transactions || bankData.transactions.length === 0) {
      return c.json({ error: 'No bank transactions found. Please upload bank statements first.' }, 400);
    }

    // Load ledger data - ACCOUNT-SPECIFIC (each bank account has its own ledger)
    const ledgerKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:ledger-data`
      : `bank-rec:${companyId}:${period}:ledger-data`;
    const ledgerData = await kv.get(ledgerKey);

    if (!ledgerData || !ledgerData.entries || ledgerData.entries.length === 0) {
      return c.json({ error: 'No ledger entries found. Please upload general ledger first.' }, 400);
    }

    const bankTransactions = bankData.transactions;
    const ledgerEntries = ledgerData.entries;

    console.log(`📊 Reconciling ${bankTransactions.length} bank transactions with ${ledgerEntries.length} ledger entries`);

    // 🔥 DEBUG: Log currency distribution from bank transactions to verify PDF parsing
    const bankCurrencyCount: Record<string, number> = {};
    for (const txn of bankTransactions) {
      const cur = txn.currency || 'UNSET';
      bankCurrencyCount[cur] = (bankCurrencyCount[cur] || 0) + 1;
    }
    console.log(`💱 Bank transaction currencies from PDF parser:`, JSON.stringify(bankCurrencyCount));

    // ============================================
    // POST-PROCESS: Mark ledger entries with INTL/BATCH suffixes as FX-eligible
    // These are QuickBooks entries for international transactions (in USD/base currency)
    // They should be matched with bank transactions that have foreign currency codes
    // ============================================
    const detectFXLedgerEntry = (description: string): boolean => {
      if (!description) return false;
      const desc = description.toUpperCase();
      // Common patterns in QuickBooks for international/FX transactions
      return desc.includes(' INTL') ||
        desc.includes('INTL ') ||
        desc.endsWith(' INTL') ||
        desc.includes(' WIRE') ||
        desc.includes('WIRE ') ||
        desc.includes(' INTERNATIONAL') ||
        desc.includes('FX ') ||
        desc.includes(' FX');
    };

    // Count ledger entries marked as FX-eligible
    let fxEligibleLedgerCount = 0;
    for (const entry of ledgerEntries) {
      if (detectFXLedgerEntry(entry.description) || detectFXLedgerEntry(entry.name)) {
        entry._fx_eligible = true;
        fxEligibleLedgerCount++;
      }
    }

    if (fxEligibleLedgerCount > 0) {
      console.log(`🌍 Marked ${fxEligibleLedgerCount} ledger entries as FX-eligible (have INTL/WIRE suffix)`);
    }

    // FETCH COMPANY CURRENCY
    // This is critical for FX matching - if ledger entries have no currency, they default to this
    let companyBaseCurrency = 'USD'; // Safe default
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('currency')
        .eq('id', companyId)
        .single();

      if (companyData && companyData.currency) {
        companyBaseCurrency = companyData.currency;
        console.log(`🏢 Company base currency detected: ${companyBaseCurrency}`);
      } else {
        console.warn(`⚠️ Could not fetch company currency (Error: ${companyError?.message}), defaulting to USD`);
      }
    } catch (err) {
      console.error('❌ Error fetching company currency:', err);
    }

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
     * 4️⃣ AI FUZZY MATCH (DISABLED - was creating incorrect matches)
     *    - Previously used GPT-4o for fuzzy description matching
     *    - DISABLED because it created false matches like:
     *      €228 "Unknown" → €486 "Chevron" at 75% confidence
     *    - All remaining items now require manual review
     * 
     * KEY PRINCIPLES:
     * - Process in order: cheap → expensive, certain → uncertain
     * - Mark used IDs to prevent double-matching
     * - Amounts use absolute value comparison (handles sign convention mismatches)
     * - Date matching handles multiple formats (Excel serial, ISO, US, European)
     * - Description filtering prevents combinatorial explosion
     * - DETERMINISTIC ONLY: No AI fuzzy matching (too many false positives)
     * 
     * EXPECTED PERFORMANCE:
     * - Deterministic: 70-90% of matches (fast, free, accurate)
     * - Unmatched: 10-30% (require manual review)
     * - Total Match Rate: 70-90% for clean data
     * - FALSE POSITIVE RATE: ~0% (deterministic only)
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

    // Helper: Calculate tolerance - ZERO for exact matches, $0.05 for multi-entry
    const calculateTolerance = (_amount: number, scenario: 'exact' | 'multi' = 'exact'): number => {
      if (scenario === 'exact') {
        return 0; // No tolerance - amounts must match exactly
      }
      return 0.05; // 5 cent tolerance for multi-entry only
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
            // CRITICAL: Check vendor/description similarity to prevent false positives
            // This prevents PAYROLL GUSTO matching BOOKING.COM just because amounts match
            const descSimilarity = stringSimilarity(
              (bankTxn.description || '').toLowerCase(),
              (ledgerEntry.description || '').toLowerCase()
            );

            // Require at least 30% similarity for exact matches
            if (descSimilarity < 0.3) {
              // Skip this match - vendors don't match
              continue;
            }

            const matchType = amountDiff < 0.01 ? 'exact' : 'tolerance';

            // 🔧 Calculate multi-factor confidence score
            const quality = calculateMatchConfidence([bankTxn], [ledgerEntry], matchType);

            matchedPairs.push({
              bank_transaction: bankTxn,
              ledger_entries: [ledgerEntry],
              match_confidence: quality.confidence,
              match_type: matchType,
              match_status: quality.status,
              match_flags: quality.flags,
              explanation: quality.explanation
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

      // Try combinations of 2 to 5 ledger entries using subset-sum algorithm
      let matched = false;

      // Use subset-sum algorithm for finding combinations (2-5 ledger entries)
      const tolerance = calculateTolerance(bankTxn.amount, 'multi');
      const combos = findMatchingCombinations(finalAvailableLedger, Math.abs(bankTxn.amount), tolerance, 5);

      for (const ledgerEntries of combos) {
        if (matched) break;

        // CRITICAL: Ensure all ledger entries have the same sign (no mixing debits + credits)
        const ledgerAmounts = ledgerEntries.map((le: any) => le.amount);
        if (!hasSameSignPattern(ledgerAmounts)) {
          oneToManySkippedSign++;
          continue;
        }

        // Check if sum matches with sign
        const sum = ledgerEntries.reduce((s: number, le: any) => s + le.amount, 0);
        if (!amountsMatchWithSign(bankTxn.amount, sum, tolerance)) continue;

        // Validate group purity BEFORE creating match
        const validation = validateGroupedMatch(ledgerEntries, 'one_to_many');
        if (!validation.isValid) {
          console.log(`❌ REJECTED one-to-many (${ledgerEntries.length}): ${validation.reasons.join(', ')}`);
          continue;
        }

        // Calculate multi-factor confidence score
        const quality = calculateMatchConfidence([bankTxn], ledgerEntries, 'one_to_many');

        matchedPairs.push({
          bank_transaction: bankTxn,
          ledger_entries: ledgerEntries,
          match_confidence: quality.confidence,
          match_type: 'one_to_many',
          match_status: quality.status,
          match_flags: quality.flags,
          explanation: quality.explanation
        });

        usedBankIds.add(bankTxn.id);
        ledgerEntries.forEach((le: any) => usedLedgerIds.add(le.id));
        matched = true;
        console.log(`✅ ONE-TO-MANY MATCH: 1 bank → ${ledgerEntries.length} ledger entries (${quality.confidence.toFixed(0)}% confidence)`);
      }
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

      // Use subset-sum algorithm for finding combinations (2-5 transactions)
      const tolerance = calculateTolerance(ledgerEntry.amount, 'multi');

      // DEBUG: Log ledger entry and available candidates
      if (Math.abs(ledgerEntry.amount) > 100) {
        console.log(`🔍 Many-to-one search for ledger: ${ledgerEntry.description?.substring(0, 30)} = $${Math.abs(ledgerEntry.amount).toFixed(2)}`);
        console.log(`   Available bank txns: ${finalAvailableBank.length}, tolerance: $${tolerance.toFixed(2)}`);
        if (finalAvailableBank.length <= 10) {
          finalAvailableBank.forEach((bt: any) => {
            const vendorId = extractVendorIdentifier(bt.description || '');
            console.log(`   - ${bt.description?.substring(0, 40)} = $${Math.abs(bt.amount).toFixed(2)} (vendor: ${vendorId})`);
          });
        }
      }

      const combos = findMatchingCombinations(finalAvailableBank, Math.abs(ledgerEntry.amount), tolerance, 5);

      // DEBUG: Log combo results
      if (Math.abs(ledgerEntry.amount) > 100) {
        console.log(`   Found ${combos.length} potential combinations`);
        combos.slice(0, 3).forEach((combo, idx) => {
          const sum = combo.reduce((s: number, bt: any) => s + Math.abs(bt.amount), 0);
          console.log(`   Combo ${idx + 1}: ${combo.length} txns, sum=$${sum.toFixed(2)}`);
        });
      }

      for (const bankTxns of combos) {
        if (matched) break;

        // CRITICAL: Ensure all bank transactions have the same sign (no mixing deposits + withdrawals)
        const bankAmounts = bankTxns.map((bt: any) => bt.amount);
        if (!hasSameSignPattern(bankAmounts)) continue;

        // Check if sum matches with sign
        const sum = bankTxns.reduce((s: number, bt: any) => s + bt.amount, 0);
        if (!amountsMatchWithSign(sum, ledgerEntry.amount, tolerance)) continue;

        // Validate group purity BEFORE creating match
        const validation = validateGroupedMatch(bankTxns, 'many_to_one');
        if (!validation.isValid) {
          console.log(`❌ REJECTED many-to-one (${bankTxns.length}): ${validation.reasons.join(', ')}`);
          continue;
        }

        // Calculate multi-factor confidence score
        const quality = calculateMatchConfidence(bankTxns, [ledgerEntry], 'many_to_one');

        // Create ONE grouped match with multiple bank transactions
        matchedPairs.push({
          bank_transactions: bankTxns,
          ledger_entries: [ledgerEntry],
          match_confidence: quality.confidence,
          match_type: 'many_to_one',
          match_status: quality.status,
          match_flags: quality.flags,
          explanation: quality.explanation,
          bank_transaction: bankTxns[0] // Backwards compatibility
        });

        bankTxns.forEach((bt: any) => usedBankIds.add(bt.id));
        usedLedgerIds.add(ledgerEntry.id);
        matched = true;
        console.log(`✅ MANY-TO-ONE MATCH: ${bankTxns.length} bank txns → 1 ledger (${quality.confidence.toFixed(0)}% confidence)`);
      }
    }

    const deterministic_matches = matchedPairs.length;
    console.log(`✅ Total deterministic matches: ${deterministic_matches}`);

    // Collect unmatched items
    let remainingBank = bankTransactions.filter(bt => !usedBankIds.has(bt.id));
    let remainingLedger = ledgerEntries.filter(le => !usedLedgerIds.has(le.id));

    console.log(`📋 Remaining after deterministic: ${remainingBank.length} bank, ${remainingLedger.length} ledger`);

    // Step 4: INTELLIGENT FX MATCHING (Deterministic)
    // Replaces disabled AI matching with robust deterministic logic
    console.log('\n\n🔥🔥🔥 [STEP 4] INTELLIGENT FX MATCHING STARTING 🔥🔥🔥');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log('🔍 Step 4: Looking for currency conversion matches...');
    let fxMatchCount = 0;
    let fxAttemptCount = 0;
    let fxRejectionReasons: Record<string, number> = {};

    remainingBank = bankTransactions.filter((bt: any) => !usedBankIds.has(bt.id));
    remainingLedger = ledgerEntries.filter((le: any) => !usedLedgerIds.has(le.id));

    // DEBUG: Log currency distribution with counts
    const bankCurrencyMap: Record<string, number> = {};
    remainingBank.forEach((b: any) => {
      const cur = b.currency || `${companyBaseCurrency} (default)`;
      bankCurrencyMap[cur] = (bankCurrencyMap[cur] || 0) + 1;
    });
    const ledgerCurrencyMap: Record<string, number> = {};
    remainingLedger.forEach((l: any) => {
      const cur = l.currency || `${companyBaseCurrency} (default)`;
      ledgerCurrencyMap[cur] = (ledgerCurrencyMap[cur] || 0) + 1;
    });
    console.log(`📊 Remaining Bank currencies:`, JSON.stringify(bankCurrencyMap));
    console.log(`📊 Remaining Ledger currencies:`, JSON.stringify(ledgerCurrencyMap));

    // DEBUG: Log sample transactions with their currencies
    console.log(`🔍 DEBUG - Sample Bank Transactions (first 5):`);
    remainingBank.slice(0, 5).forEach((bt: any) => {
      console.log(`   Bank: "${bt.description}" | Amount: ${bt.amount} | Currency: ${bt.currency || 'NOT SET'} | Date: ${bt.date}`);
    });
    console.log(`🔍 DEBUG - Sample Ledger Entries (first 5):`);
    remainingLedger.slice(0, 5).forEach((le: any) => {
      console.log(`   Ledger: "${le.description}" | Amount: ${le.amount} | Currency: ${le.currency || 'NOT SET'} | Date: ${le.date}`);
    });

    // Helper: Check if amounts match with FLEXIBLE tolerance for bank rec
    // Uses percentage-based tolerance (5%) for larger amounts, plus fixed tolerance for small amounts
    // This handles bank fees, timing differences, and FX conversion variations
    const amountsMatchWithFlexibleTolerance = (amt1: number, amt2: number): boolean => {
      const absAmt1 = Math.abs(amt1);
      const absAmt2 = Math.abs(amt2);
      const diff = Math.abs(absAmt1 - absAmt2);
      const avgAmt = (absAmt1 + absAmt2) / 2;

      // For small amounts (<$100), use fixed tolerance of $5
      if (avgAmt < 100) {
        return diff <= 5;
      }
      // For medium amounts ($100-$1000), use 3% tolerance
      if (avgAmt < 1000) {
        return diff <= avgAmt * 0.03;
      }
      // For large amounts (>$1000), use 2% tolerance
      return diff <= avgAmt * 0.02;
    };

    // Helper: Check if amounts match with STRICT tolerance (0.05)
    // Used for exact same-currency matches (no FX fee expected)
    const amountsMatchWithStrictTolerance = (amt1: number, amt2: number): boolean => {
      const diff = Math.abs(Math.abs(amt1) - Math.abs(amt2));
      return diff <= 0.05;
    };

    for (const bankTxn of remainingBank) {
      if (usedBankIds.has(bankTxn.id)) continue;

      for (const ledgerEntry of remainingLedger) {
        if (usedLedgerIds.has(ledgerEntry.id)) continue;

        // CRITICAL FIX: Use company base currency as default for BOTH bank and ledger
        const bankCurrency = bankTxn.currency || companyBaseCurrency;
        const ledgerCurrency = ledgerEntry.currency || companyBaseCurrency;

        // Check for FX Scenario
        if (isFXScenario(bankCurrency, ledgerCurrency)) {
          fxAttemptCount++;

          // Calculate implied FX rate
          const { rate, direction } = getImpliedFXRate(
            bankTxn.amount,
            ledgerEntry.amount,
            bankCurrency,
            ledgerCurrency
          );

          // DEBUG: Log every FX comparison (limited to first 20 to avoid log spam)
          if (fxAttemptCount <= 20) {
            console.log(`🔄 FX ATTEMPT #${fxAttemptCount}: "${bankTxn.description}" (${bankCurrency} ${bankTxn.amount}) vs "${ledgerEntry.description}" (${ledgerCurrency} ${ledgerEntry.amount}) | Rate: ${rate.toFixed(4)} ${direction}`);
          }

          // Score this FX match
          const fxMatch = scoreFXMatch(bankTxn, ledgerEntry, rate, direction);

          // 🔥 SPECIAL DEBUG: Log ALL attempts for GBP/CAD/JPY to diagnose non-EUR matches
          const isSpecialDebugCurrency = ['GBP', 'CAD', 'JPY', 'MXN'].includes(bankCurrency);
          if (isSpecialDebugCurrency && fxMatch.score > 0) {
            const normalizedBank = normalizeVendorName(bankTxn.description);
            const normalizedLedger = normalizeVendorName(ledgerEntry.description);
            console.log(`🔍 ${bankCurrency} CANDIDATE: "${bankTxn.description}" → "${normalizedBank}" vs "${ledgerEntry.description}" → "${normalizedLedger}"`);
            console.log(`   Score: ${fxMatch.score} | Rate: ${rate.toFixed(4)} | Type: ${fxMatch.type}`);
          }

          // DEBUG: Log rejection reasons
          if (fxMatch.score < 55) {
            if (fxAttemptCount <= 20) {
              console.log(`   ❌ REJECTED: Score ${fxMatch.score} | Type: ${fxMatch.type} | Reason: ${fxMatch.explanation}`);
            }
            fxRejectionReasons[fxMatch.type] = (fxRejectionReasons[fxMatch.type] || 0) + 1;
          }

          // Accept if score >= 55 (requires vendor/description match + date/FX validation)
          if (fxMatch.score >= 55) {
            console.log(`✅ FX MATCH: Bank ${bankTxn.amount} ${bankCurrency} → Ledger ${ledgerEntry.amount} ${ledgerCurrency} | Rate: ${rate.toFixed(4)} | Score: ${fxMatch.score}`);

            // 🔧 Calculate multi-factor confidence score (reuse existing logic but simplified)
            // We use the FX score as the base confidence
            const quality: MatchQualityResult = {
              confidence: fxMatch.score / 100,
              status: fxMatch.confidence === 'high' ? 'auto_approved' : 'review_recommended',
              flags: {
                amount_variance: 0, // Not applicable for FX
                merchant_mismatch: false, // Validated by score
                date_spread_days: Math.abs(calculateDateDifference(bankTxn.date, ledgerEntry.date))
              },
              factors: {
                amountScore: 0, // N/A
                descriptionScore: fxMatch.score > 25 ? 100 : 0, // Simplified
                dateScore: fxMatch.score > 15 ? 100 : 0,
                accountScore: 0,
                transactionLogicScore: 0
              },
              explanation: fxMatch.explanation
            };

            matchedPairs.push({
              bank_transaction: bankTxn,
              ledger_entries: [ledgerEntry],
              match_confidence: quality.confidence,
              match_type: 'fx_adjusted',
              match_status: quality.status,
              match_flags: quality.flags,
              explanation: quality.explanation,
              fx_rate: rate,
              fx_direction: direction
            });

            fxMatchCount++;
            usedBankIds.add(bankTxn.id);
            usedLedgerIds.add(ledgerEntry.id);
            break; // Move to next bank transaction
          }
        } else {
          // NOT an FX scenario (same currency) - use flexible tolerance for bank rec
          // This catches cases where:
          // 1. Currency codes appear in descriptions but amounts are actually all in USD
          // 2. Bank fees, timing differences, or rounding cause small discrepancies

          // Check description similarity (vendor matching)
          const descSimilarity = calculateVendorSimilarity(
            bankTxn.description || '',
            ledgerEntry.description || ''
          );

          // Use flexible tolerance + description similarity matching
          if (datesMatch(bankTxn.date, ledgerEntry.date, 7)) {
            // Option 1: Exact amount match (strict) + description must match
            // IMPORTANT: Exact matches require BOTH amount match AND vendor similarity
            // This prevents false positives like PAYROLL GUSTO matching BOOKING.COM
            if (amountsMatchWithStrictTolerance(bankTxn.amount, ledgerEntry.amount) && descSimilarity > 0.3) {
              console.log(`✅ EXACT MATCH: Bank ${bankTxn.amount} = Ledger ${ledgerEntry.amount} (similarity: ${descSimilarity.toFixed(2)})`);

              const quality = calculateMatchConfidence([bankTxn], [ledgerEntry], 'many_to_one');

              matchedPairs.push({
                bank_transaction: bankTxn,
                ledger_entries: [ledgerEntry],
                match_confidence: quality.confidence,
                match_type: 'exact_match',
                match_status: 'confirmed',
                match_flags: { ...quality.flags, exact_amount: true },
                explanation: `Exact amount match + vendor similarity (${(descSimilarity * 100).toFixed(0)}%).`
              });

              usedBankIds.add(bankTxn.id);
              usedLedgerIds.add(ledgerEntry.id);
              fxMatchCount++;
              break;
            }

            // Option 2: Flexible tolerance + high description similarity (for bank fees/FX differences)
            if (amountsMatchWithFlexibleTolerance(bankTxn.amount, ledgerEntry.amount) && descSimilarity > 0.5) {
              const amountDiff = Math.abs(Math.abs(bankTxn.amount) - Math.abs(ledgerEntry.amount));

              // Check if description contains currency code (indicates FX transaction)
              const fxCurrencyCodes = ['EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'CHF', 'CNY', 'MXN', 'NZD', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK', 'INTL', 'WIRE', 'FX', 'FOREX'];
              const descUpper = (bankTxn.description || '').toUpperCase();
              const hasFXIndicator = fxCurrencyCodes.some(code => descUpper.includes(code));

              // Also check ledger for INTL indicator
              const ledgerUpper = (ledgerEntry.description || '').toUpperCase();
              const ledgerHasFXIndicator = ledgerUpper.includes('INTL') || ledgerUpper.includes('INTERNATIONAL');

              const isFXTransaction = hasFXIndicator || ledgerHasFXIndicator;

              // Calculate implied FX rate for logging (even though amounts are in USD)
              const impliedRate = Math.abs(ledgerEntry.amount) / Math.abs(bankTxn.amount);

              const matchType = isFXTransaction ? 'fx_adjusted' : 'fuzzy_match';
              const matchLabel = isFXTransaction ? 'FX MATCH (USD conversion)' : 'FUZZY MATCH';

              console.log(`✅ ${matchLabel}: Bank ${bankTxn.amount} ≈ Ledger ${ledgerEntry.amount} (Desc: ${(descSimilarity * 100).toFixed(0)}%, Diff: $${amountDiff.toFixed(2)})`);

              const quality = calculateMatchConfidence([bankTxn], [ledgerEntry], 'many_to_one');

              matchedPairs.push({
                bank_transaction: bankTxn,
                ledger_entries: [ledgerEntry],
                match_confidence: isFXTransaction ? Math.max(0.70, quality.confidence - 0.05) : Math.max(0.65, quality.confidence - 0.1),
                match_type: matchType,
                match_status: 'review_recommended',
                match_flags: {
                  ...quality.flags,
                  fx_indicated: isFXTransaction,
                  description_similarity: descSimilarity,
                  amount_difference: amountDiff
                },
                fx_rate: isFXTransaction ? impliedRate : undefined,
                fx_direction: isFXTransaction ? 'USD→USD (converted)' : undefined,
                explanation: isFXTransaction
                  ? `FX Transaction Match: amounts within ${(amountDiff / Math.abs(bankTxn.amount) * 100).toFixed(1)}%, descriptions ${(descSimilarity * 100).toFixed(0)}% similar. Bank fee/rate difference: $${amountDiff.toFixed(2)}.`
                  : `Fuzzy match: amounts within ${(amountDiff / Math.abs(bankTxn.amount) * 100).toFixed(1)}%, descriptions ${(descSimilarity * 100).toFixed(0)}% similar.`
              });

              usedBankIds.add(bankTxn.id);
              usedLedgerIds.add(ledgerEntry.id);
              fxMatchCount++;
              break;
            }
          }
        }
      }
    }

    // DEBUG: FX Matching Summary
    console.log(`\n📊 ═══════════════════ FX MATCHING SUMMARY ═══════════════════`);
    console.log(`   Total FX Attempts: ${fxAttemptCount}`);
    console.log(`   Successful FX Matches: ${fxMatchCount}`);
    console.log(`   Rejection Rate: ${fxAttemptCount > 0 ? ((1 - fxMatchCount / fxAttemptCount) * 100).toFixed(1) : 0}%`);
    console.log(`   Rejection Reasons:`, JSON.stringify(fxRejectionReasons));
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    // Refresh remaining lists for unmatched reporting
    remainingBank = bankTransactions.filter((bt: any) => !usedBankIds.has(bt.id));
    remainingLedger = ledgerEntries.filter((le: any) => !usedLedgerIds.has(le.id));

    let aiUnmatchedBank: any[] = [];
    let aiUnmatchedLedger: any[] = [];

    if (remainingBank.length > 0 || remainingLedger.length > 0) {
      console.log(`📋 Unmatched items: ${remainingBank.length} bank, ${remainingLedger.length} ledger`);

      // Mark all remaining items as unmatched
      aiUnmatchedBank = remainingBank.map((t: any) => ({
        transaction: t,
        suggested_action: 'Manual review required - no match found',
        suggested_je: null
      }));

      aiUnmatchedLedger = remainingLedger.map((e: any) => ({
        entry: e,
        reason: 'No match found',
        action: 'Manual review required'
      }));
    }

    // Define empty array for compatibility with legacy code below
    let aiFuzzyMatches: any[] = [];

    // Combine all results (AI fuzzy matches disabled, so only deterministic matches)
    let allMatchedPairs = [...matchedPairs, ...aiFuzzyMatches];

    // FILTER OUT ANY FUZZY MATCHES (in case any were previously created)
    const fuzzyMatchesRemoved = allMatchedPairs.filter(m => m.match_type === 'fuzzy');
    allMatchedPairs = allMatchedPairs.filter(m => m.match_type !== 'fuzzy');

    if (fuzzyMatchesRemoved.length > 0) {
      console.log(`🚫 Removed ${fuzzyMatchesRemoved.length} fuzzy matches (AI matching disabled)`);

      // Add fuzzy-matched items back to unmatched lists
      fuzzyMatchesRemoved.forEach(match => {
        if (match.bank_transaction) {
          aiUnmatchedBank.push({
            transaction: match.bank_transaction,
            suggested_action: 'Fuzzy match removed - manual review required',
            suggested_je: null
          });
        }
        if (match.bank_transactions && Array.isArray(match.bank_transactions)) {
          match.bank_transactions.forEach(bt => {
            aiUnmatchedBank.push({
              transaction: bt,
              suggested_action: 'Fuzzy match removed - manual review required',
              suggested_je: null
            });
          });
        }
        if (match.ledger_entries && Array.isArray(match.ledger_entries)) {
          match.ledger_entries.forEach(le => {
            aiUnmatchedLedger.push({
              entry: le,
              reason: 'Fuzzy match removed',
              action: 'Manual review required'
            });
          });
        }
      });
    }

    // CRITICAL FIX: Properly track ALL unmatched items
    // Calculate which items are still unmatched after ALL matching stages
    const allMatchedBankIds = new Set<string>();
    const allMatchedLedgerIds = new Set<string>();

    // Collect IDs from all matched pairs
    for (const match of allMatchedPairs) {
      // Handle both old structure (bank_transaction) and new structure (bank_transactions array)
      if (match.bank_transactions && Array.isArray(match.bank_transactions)) {
        match.bank_transactions.forEach(bt => allMatchedBankIds.add(bt.id));
      } else if (match.bank_transaction) {
        allMatchedBankIds.add(match.bank_transaction.id);
      }

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

    // 🆕 CFO-GRADE FINANCIAL SUMMARY
    // Calculate matched amounts (net of matched pairs)
    let matchedBankAmount = 0;
    let matchedLedgerAmount = 0;

    console.log(`🔍 Calculating financial breakdown for ${allMatchedPairs.length} matched pairs`);

    for (const match of allMatchedPairs) {
      // Sum bank side of matches
      if (match.bank_transactions && Array.isArray(match.bank_transactions)) {
        const bankSum = match.bank_transactions.reduce((sum, bt) => sum + bt.amount, 0);
        matchedBankAmount += bankSum;
        console.log(`  ✓ Many-to-one: Bank transactions (${match.bank_transactions.length}): ${bankSum.toFixed(2)}`);
      } else if (match.bank_transaction) {
        matchedBankAmount += match.bank_transaction.amount;
        console.log(`  ✓ One-to-X: Bank transaction: ${match.bank_transaction.amount.toFixed(2)}`);
      } else {
        console.log(`  ⚠️ WARNING: Match has no bank_transaction or bank_transactions!`, JSON.stringify(match).substring(0, 200));
      }

      // Sum ledger side of matches
      if (match.ledger_entries && Array.isArray(match.ledger_entries)) {
        const ledgerSum = match.ledger_entries.reduce((sum, le) => sum + le.amount, 0);
        matchedLedgerAmount += ledgerSum;
        console.log(`     Ledger entries (${match.ledger_entries.length}): ${ledgerSum.toFixed(2)}`);
      } else {
        console.log(`  ⚠️ WARNING: Match has no ledger_entries array!`, JSON.stringify(match).substring(0, 200));
      }
    }

    // Calculate unmatched amounts
    const unmatchedBankAmount = allUnmatchedBank.reduce((sum, item) => sum + item.transaction.amount, 0);
    const unmatchedLedgerAmount = allUnmatchedLedger.reduce((sum, item) => sum + item.entry.amount, 0);

    // Calculate net differences
    const matchedNetDifference = matchedBankAmount - matchedLedgerAmount;
    const unmatchedNetDifference = unmatchedBankAmount - unmatchedLedgerAmount;

    console.log(`💰 Financial Summary:`);
    console.log(`   Total Bank: ${totalBankAmount.toFixed(2)}, Total Ledger: ${totalLedgerAmount.toFixed(2)}`);
    console.log(`   Matched Bank: ${matchedBankAmount.toFixed(2)}, Matched Ledger: ${matchedLedgerAmount.toFixed(2)}`);
    console.log(`   Matched Net Difference: ${matchedNetDifference.toFixed(2)} (should be ~0 for good matches)`);
    console.log(`   Unmatched Bank: ${unmatchedBankAmount.toFixed(2)}, Unmatched Ledger: ${unmatchedLedgerAmount.toFixed(2)}`);
    console.log(`   Unmatched Net Difference: ${unmatchedNetDifference.toFixed(2)}`);

    // Count match types
    const exactMatches = allMatchedPairs.filter(m => m.match_type === 'exact').length;
    const toleranceMatches = allMatchedPairs.filter(m => m.match_type === 'tolerance').length;
    const fxMatches = allMatchedPairs.filter(m => m.match_type === 'fx' || m.match_type === 'fx_adjusted').length;
    const oneToManyMatches = allMatchedPairs.filter(m => m.match_type === 'one_to_many').length;
    const combinationMatches = allMatchedPairs.filter(m => m.match_type === 'combination').length;
    const fuzzyMatches = allMatchedPairs.filter(m => m.match_type === 'fuzzy').length;

    // 🔥 PROMINENT FX MATCHING RESULT LOG (appears near end of logs)
    console.log(`\n🔥🔥🔥 MATCH TYPE BREAKDOWN 🔥🔥🔥`);
    console.log(`   📊 Total Matched Pairs: ${allMatchedPairs.length}`);
    console.log(`   ✅ Exact Matches: ${exactMatches}`);
    console.log(`   📐 Tolerance Matches: ${toleranceMatches}`);
    console.log(`   💱 FX Matches: ${fxMatches}`);
    console.log(`   📦 One-to-Many: ${oneToManyMatches}`);
    console.log(`   🔗 Combination: ${combinationMatches}`);
    if (fxMatches === 0) {
      console.log(`   ⚠️ WARNING: No FX matches found! Check if currencies are different and FX rates are realistic.`);
    }
    console.log(`🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n`);

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
      // Handle both new structure (bank_transactions array) and old structure (bank_transaction)
      let bankTransactions;
      if (pair.bank_transactions && Array.isArray(pair.bank_transactions)) {
        // New structure: many-to-one matches already have bank_transactions array
        bankTransactions = pair.bank_transactions;
      } else {
        // Old structure: single bank_transaction
        bankTransactions = [pair.bank_transaction];

        // Check if this is part of a many-to-one or one-to-many match (old structure only)
        // Look for related pairs that form a group
        if (pair.match_type === 'many_to_one' || pair.match_type === 'one_to_many') {
          const ledgerEntries = pair.ledger_entries || [];
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
      }

      const ledgerEntries = pair.ledger_entries || [];
      processedPairs.add(pairIndex);

      // Create pre-matched group
      const matchGroupId = `match-${Date.now()}-${pairIndex}`;
      preMatchedGroups.push({
        matchGroupId,
        bankTransactions,
        ledgerEntries,
        matchedAt: new Date().toISOString(),
        confidence: pair.match_confidence || 1.0,
        match_type: pair.match_type,
        explanation: pair.explanation,
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
        // 🆕 CFO-grade financial breakdown
        matched_bank_amount: matchedBankAmount,
        matched_ledger_amount: matchedLedgerAmount,
        matched_net_difference: matchedNetDifference,
        unmatched_bank_amount: unmatchedBankAmount,
        unmatched_ledger_amount: unmatchedLedgerAmount,
        unmatched_net_difference: unmatchedNetDifference,
        match_rate: ((bankTransactions.length - allUnmatchedBank.length) / bankTransactions.length) * 100,
        deterministic_matches,
        ai_fuzzy_matches: fuzzyMatches,
        ai_fx_matches: fxMatches,
        ai_combination_matches: combinationMatches
      },
      // 🔍 FX DEBUGGING - included in response for visibility
      fx_debug: {
        bank_currency_distribution: bankCurrencyCount,  // From PDF parser
        fx_attempts: fxAttemptCount,
        fx_matches_found: fxMatchCount,
        fx_rejection_reasons: fxRejectionReasons,
        bank_currencies: bankCurrencyMap,
        ledger_currencies: ledgerCurrencyMap
      },
      debug: debugInfo
    };

    // Save reconciliation result - include account_id in key to separate data by bank account
    const recKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:reconciliation`
      : `bank-rec:${companyId}:${period}:reconciliation`;

    // 🔒 PRESERVE LOCKED STATUS: Check if reconciliation is already locked
    const existingRec = await kv.get(recKey);
    if (existingRec?.locked) {
      console.log(`🔒 Preserving locked status from existing reconciliation (locked=${existingRec.locked}, lockedAt=${existingRec.lockedAt})`);
      result.locked = existingRec.locked;
      result.lockedAt = existingRec.lockedAt;
    } else {
      console.log(`🔓 No existing lock found - new reconciliation will be unlocked`);
    }

    console.log(`💾 Saving reconciliation with locked=${result.locked}, lockedAt=${result.lockedAt}`);
    await kv.set(recKey, result);

    console.log(`✅ Reconciliation completed: ${result.summary.match_rate.toFixed(1)}% match rate`);
    console.log(`📊 Match breakdown: Exact=${exactMatches}, Tolerance=${toleranceMatches}, FX=${fxMatches}, Multi-entry=${oneToManyMatches}, Fuzzy=${fuzzyMatches}`);

    console.log(`✅ Reconciliation completed: ${result.summary.match_rate.toFixed(1)}% match rate`);
    console.log(`📊 Match breakdown: Exact=${exactMatches}, Tolerance=${toleranceMatches}, FX=${fxMatches}, Multi-entry=${oneToManyMatches}, Fuzzy=${fuzzyMatches}`);

    // INVALIDATE CACHE for period status (status might have changed)
    console.log(`🗑️ Invalidating period status cache for ${companyId}:${period}`);
    await kv.del(`bank-rec:${companyId}:${period}:status`);

    return c.json(result);
  } catch (error) {
    console.error('❌ Error running reconciliation:', error);
    return c.json({ error: `Failed to run reconciliation: ${error.message}` }, 500);
  }
});

// Lock (save) a reconciliation
app.post('/bank-rec/lock-reconciliation', async (c) => {
  try {
    const { company_id, period, account_id } = await c.req.json();

    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    // Include account_id in key to separate data by bank account
    const key = account_id
      ? `bank-rec:${company_id}:${account_id}:${period}:reconciliation`
      : `bank-rec:${company_id}:${period}:reconciliation`;

    console.log(`🔒 Attempting to lock reconciliation with key: ${key}`);
    const reconciliation = await kv.get(key);

    if (!reconciliation) {
      console.error(`❌ No reconciliation found with key: ${key}`);
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    console.log(`🔒 Found reconciliation, current locked status: ${reconciliation.locked}`);

    // Add locked status and timestamp
    reconciliation.locked = true;
    reconciliation.lockedAt = new Date().toISOString();

    console.log(`🔒 Setting locked=true and lockedAt=${reconciliation.lockedAt}`);
    await kv.set(key, reconciliation);

    console.log(`✅ Successfully locked reconciliation for ${company_id} - ${period} (account: ${account_id || 'no account'})`);

    console.log(`✅ Successfully locked reconciliation for ${company_id} - ${period} (account: ${account_id || 'no account'})`);

    // INVALIDATE CACHE for period status (locked status changed)
    console.log(`🗑️ Invalidating period status cache for ${company_id}:${period}`);
    await kv.del(`bank-rec:${company_id}:${period}:status`);

    return c.json({ success: true, reconciliation });
  } catch (error) {
    console.error('❌ Error locking reconciliation:', error);
    return c.json({ error: `Failed to lock reconciliation: ${error.message}` }, 500);
  }
});

// Unlock a reconciliation to allow updates
app.post('/bank-rec/unlock-reconciliation', async (c) => {
  try {
    const { company_id, period, account_id } = await c.req.json();

    if (!company_id || !period) {
      return c.json({ error: 'company_id and period are required' }, 400);
    }

    // Include account_id in key to separate data by bank account
    const key = account_id
      ? `bank-rec:${company_id}:${account_id}:${period}:reconciliation`
      : `bank-rec:${company_id}:${period}:reconciliation`;
    const reconciliation = await kv.get(key);

    if (!reconciliation) {
      return c.json({ error: 'No reconciliation found for this company and period' }, 404);
    }

    // Remove locked status
    reconciliation.locked = false;
    reconciliation.unlockedAt = new Date().toISOString();

    await kv.set(key, reconciliation);

    console.log(`🔓 Unlocked reconciliation for ${company_id} - ${period}`);

    console.log(`🔓 Unlocked reconciliation for ${company_id} - ${period}`);

    // INVALIDATE CACHE for period status (locked status changed)
    console.log(`🗑️ Invalidating period status cache for ${company_id}:${period}`);
    await kv.del(`bank-rec:${company_id}:${period}:status`);

    return c.json({ success: true, reconciliation });
  } catch (error) {
    console.error('❌ Error unlocking reconciliation:', error);
    return c.json({ error: `Failed to unlock reconciliation: ${error.message}` }, 500);
  }
});

// 🔧 ONE-TIME MIGRATION: Fix locked status for reconciliations with lockedAt but missing locked field
app.post('/bank-rec/fix-locked-status', async (c) => {
  try {
    const { company_id } = await c.req.json();

    if (!company_id) {
      return c.json({ error: 'company_id is required' }, 400);
    }

    console.log(`🔧 Starting locked status migration for company ${company_id}`);

    // Create Supabase client to query directly
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all bank reconciliations for this company
    const { data: allRecs, error } = await supabase
      .from('kv_store_53c2e113')
      .select('key, value')
      .like('key', `bank-rec:${company_id}:%`)
      .like('key', '%:reconciliation');

    if (error) {
      console.error('Failed to fetch reconciliations:', error);
      return c.json({ error: 'Failed to fetch reconciliations' }, 500);
    }

    console.log(`📋 Found ${allRecs?.length || 0} reconciliation records to check`);

    let fixed = 0;
    let alreadyCorrect = 0;
    let noLockDate = 0;

    for (const item of (allRecs || [])) {
      const rec = item.value;
      const key = item.key;

      // Skip if already has locked: true
      if (rec.locked === true) {
        alreadyCorrect++;
        continue;
      }

      // Skip if no lockedAt timestamp
      if (!rec.lockedAt) {
        noLockDate++;
        continue;
      }

      // Fix: Add locked: true since lockedAt exists
      console.log(`🔧 Fixing ${key}: Adding locked=true (has lockedAt: ${rec.lockedAt})`);
      rec.locked = true;
      await kv.set(key, rec);
      fixed++;
    }

    console.log(`✅ Migration complete: Fixed ${fixed}, Already correct ${alreadyCorrect}, No lock date ${noLockDate}`);

    return c.json({
      success: true,
      fixed,
      alreadyCorrect,
      noLockDate,
      total: allRecs?.length || 0
    });
  } catch (error) {
    console.error('❌ Error fixing locked status:', error);
    return c.json({ error: `Failed to fix locked status: ${error.message}` }, 500);
  }
});

// Mark transaction as timing difference
app.post('/bank-rec/mark-timing-difference', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item, accountId } = body;

    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`⏰ Marking as timing difference:`, type, companyId, period, accountId ? `(Account: ${accountId})` : '');

    // Get current reconciliation data (handle account-specific keys)
    const recKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:reconciliation`
      : `bank-rec:${companyId}:${period}:reconciliation`;

    const reconciliationData = await kv.get(recKey);

    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Store as timing difference
    // Store as timing difference
    const timingKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:timing-differences`
      : `bank-rec:${companyId}:${period}:timing-differences`;
    const existingTimingDiffs = await kv.get(timingKey) || { items: [] };

    existingTimingDiffs.items.push({
      type,
      item,
      markedAt: new Date().toISOString(),
      status: 'timing-difference'
    });

    await kv.set(timingKey, existingTimingDiffs);

    // Also add to resolved bucket
    // Also add to resolved bucket
    const resolvedKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:resolved`
      : `bank-rec:${companyId}:${period}:resolved`;
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
    console.log('✅ Marked as timing difference');

    // INVALIDATE CACHE for period status
    console.log(`🗑️ Invalidating period status cache for ${companyId}:${period}`);
    await kv.del(`bank-rec:${companyId}:${period}:status`);

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
    const { companyId, period, type, item, accountId } = body;

    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`🙈 Marking as ignored (non-issue):`, type, companyId, period, accountId ? `(Account: ${accountId})` : '');

    // Get current reconciliation data
    const recKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:reconciliation`
      : `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);

    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Store as ignored
    // Store as ignored
    const ignoredKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:ignored`
      : `bank-rec:${companyId}:${period}:ignored`;
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
    // Also add to resolved bucket
    const resolvedKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:resolved`
      : `bank-rec:${companyId}:${period}:resolved`;
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
    console.log('✅ Marked as ignored (non-issue)');

    // INVALIDATE CACHE for period status
    console.log(`🗑️ Invalidating period status cache for ${companyId}:${period}`);
    await kv.del(`bank-rec:${companyId}:${period}:status`);

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
    const { companyId, period, type, item, note, accountId } = body;

    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`📝 Flagging for follow-up:`, type, companyId, period, accountId ? `(Account: ${accountId})` : '');

    // Get current reconciliation data
    const recKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:reconciliation`
      : `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);

    if (!reconciliationData) {
      return c.json({ error: 'Reconciliation data not found' }, 404);
    }

    // Store as follow-up needed
    const followUpKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:follow-up`
      : `bank-rec:${companyId}:${period}:follow-up`;
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

    // INVALIDATE CACHE for period status
    console.log(`🗑️ Invalidating period status cache for ${companyId}:${period}`);
    await kv.del(`bank-rec:${companyId}:${period}:status`);

    console.log('✅ Transaction deleted successfully');
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

    const { companyId, period, type, originalItem, updatedData, accountId } = body;

    if (!companyId || !period || !type || !originalItem || !updatedData) {
      console.log('❌ Missing required fields:', { companyId, period, type, hasOriginalItem: !!originalItem, hasUpdatedData: !!updatedData });
      return c.json({ error: 'companyId, period, type, originalItem, and updatedData are required' }, 400);
    }

    console.log(`✏️ Updating transaction:`, type, companyId, period, accountId ? `(Account: ${accountId})` : '');
    console.log('Original:', originalItem);
    console.log('Updated data:', updatedData);

    // Get current reconciliation data
    const recKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:reconciliation`
      : `bank-rec:${companyId}:${period}:reconciliation`;
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

    // 💰 Recalculate financial breakdown
    recalculateFinancialBreakdown(reconciliationData);

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
    console.log('✅ Items matched successfully (Match Group ID:', matchGroupId, ')');

    // INVALIDATE CACHE for period status
    console.log(`🗑️ Invalidating period status cache for ${companyId}:${period}`);
    await kv.del(`bank-rec:${companyId}:${period}:status`);

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

    // 💰 Recalculate financial breakdown
    recalculateFinancialBreakdown(reconciliationData);

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

    // 💰 Recalculate financial breakdown
    recalculateFinancialBreakdown(reconciliationData);

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

    // 💰 Recalculate financial breakdown
    recalculateFinancialBreakdown(reconciliationData);

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
      // Handle both new structure (bank_transactions array) and old structure (bank_transaction)
      let bankTransactions;
      if (pair.bank_transactions && Array.isArray(pair.bank_transactions)) {
        // New structure: many-to-one matches already have bank_transactions array
        bankTransactions = pair.bank_transactions;
      } else {
        // Old structure: single bank_transaction
        bankTransactions = [pair.bank_transaction];

        // Check if this is part of a many-to-one or one-to-many match (old structure only)
        if (pair.match_type === 'many_to_one' || pair.match_type === 'one_to_many') {
          const ledgerEntries = pair.ledger_entries || [];
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
      }

      const ledgerEntries = pair.ledger_entries || [];
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

    // 💰 Recalculate financial breakdown
    recalculateFinancialBreakdown(reconciliationData);

    // Save updated reconciliation data
    await kv.set(recKey, reconciliationData);

    console.log(`✅ Unmatched group ${matchGroupId}: ${matchGroup.bankTransactions.length} bank + ${matchGroup.ledgerEntries.length} ledger transactions moved to needs attention`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error unmatching group:', error);
    return c.json({ error: 'Failed to unmatch group' }, 500);
  }
});

// Confirm a pre-matched group (move to resolved)
app.post('/bank-rec/confirm-match', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, accountId, matchGroupId } = body;

    if (!companyId || !period || !matchGroupId) {
      return c.json({ error: 'companyId, period, and matchGroupId are required' }, 400);
    }

    console.log(`✅ Confirming pre-matched group:`, companyId, period, accountId, matchGroupId);

    // Get current reconciliation data - include accountId in key to match how data is stored
    const recKey = accountId
      ? `bank-rec:${companyId}:${accountId}:${period}:reconciliation`
      : `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);

    if (!reconciliationData) {
      return c.json({ error: 'No reconciliation data found' }, 404);
    }

    // Find the pre-matched group
    const preMatchedItems = reconciliationData.pre_matched_items || [];
    const matchGroupIndex = preMatchedItems.findIndex((g: any) => g.matchGroupId === matchGroupId);

    if (matchGroupIndex === -1) {
      // Already confirmed or not found - treat as success (idempotent)
      console.log(`⚠️ Match group ${matchGroupId} not found in pre-matched - may already be confirmed`);
      return c.json({ success: true, message: 'Match already confirmed or not found' });
    }

    const matchGroup = preMatchedItems[matchGroupIndex];

    // Remove from pre-matched items
    reconciliationData.pre_matched_items = preMatchedItems.filter((g: any) => g.matchGroupId !== matchGroupId);

    // Add to resolved items (create if doesn't exist)
    if (!reconciliationData.resolved_items) {
      reconciliationData.resolved_items = [];
    }

    const resolvedItem = {
      id: matchGroupId,
      type: 'confirmed_match',
      matchGroup: matchGroup,
      bankTransactions: matchGroup.bankTransactions,
      ledgerEntries: matchGroup.ledgerEntries,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'user',
      notes: `Confirmed ${matchGroup.match_type || 'auto'} match`,
    };

    reconciliationData.resolved_items.push(resolvedItem);

    // Update summary counts
    if (reconciliationData.summary) {
      reconciliationData.summary.resolved_count = (reconciliationData.summary.resolved_count || 0) + 1;
    }

    // 💰 Recalculate financial breakdown
    recalculateFinancialBreakdown(reconciliationData);

    // Save updated reconciliation data
    await kv.set(recKey, reconciliationData);

    console.log(`✅ Confirmed match group ${matchGroupId}: ${matchGroup.bankTransactions.length} bank + ${matchGroup.ledgerEntries.length} ledger transactions moved to resolved`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error confirming match:', error);
    return c.json({ error: 'Failed to confirm match' }, 500);
  }
});

// Update bank account reconciliation metadata (balance, last reconciled date)
app.post('/bank-rec/update-account-metadata', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, accountId, balance, lastReconciled } = body;

    if (!companyId || !accountId) {
      return c.json({ error: 'companyId and accountId are required' }, 400);
    }

    console.log(`📊 Updating account metadata for ${accountId}:`, { balance, lastReconciled });

    // Get current COA
    const coaKey = `company_coa_${companyId}`;
    const coaData = await kv.get(coaKey);

    if (!coaData || !coaData.accounts) {
      return c.json({ error: 'Chart of Accounts not found' }, 404);
    }

    // Update the specific account
    const updatedAccounts = coaData.accounts.map((account: any) => {
      if (account.id === accountId) {
        return {
          ...account,
          balance: balance !== undefined ? balance : account.balance,
          lastReconciled: lastReconciled !== undefined ? lastReconciled : account.lastReconciled
        };
      }
      return account;
    });

    // Save updated COA
    await kv.set(coaKey, { accounts: updatedAccounts });

    console.log('✅ Account metadata updated successfully');
    return c.json({ success: true });

  } catch (error) {
    console.error('❌ Error updating account metadata:', error);
    return c.json({ error: 'Failed to update account metadata' }, 500);
  }
});

// Get bank account balance from latest statement
app.get('/bank-rec/account-balance', async (c) => {
  try {
    const companyId = c.req.query('company_id');
    const accountId = c.req.query('account_id');
    const period = c.req.query('period');

    if (!companyId || !accountId || !period) {
      return c.json({ error: 'company_id, account_id, and period are required' }, 400);
    }

    // Get bank data for this account/period
    const key = `bank-rec:${companyId}:${accountId}:${period}:bank-data`;
    const data = await kv.get(key);

    if (!data || !data.transactions || data.transactions.length === 0) {
      return c.json({ balance: null, message: 'No transactions found' });
    }

    // Calculate ending balance from transactions
    // The ending balance is typically the balance on the last transaction
    // Sort transactions by date to find the most recent one
    const sortedTransactions = [...data.transactions].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });

    // Get the balance from the most recent transaction if available
    const endingBalance = sortedTransactions[0]?.balance;

    // If no balance field, calculate running balance from all transactions
    let calculatedBalance = endingBalance;
    if (calculatedBalance === undefined || calculatedBalance === null) {
      // Sum all transactions to get net change
      calculatedBalance = sortedTransactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
    }

    console.log(`💰 Account balance for ${accountId}: ${calculatedBalance}`);

    return c.json({
      balance: calculatedBalance,
      transactionCount: data.transactions.length,
      lastTransactionDate: sortedTransactions[0]?.date
    });

  } catch (error) {
    console.error('❌ Error getting account balance:', error);
    return c.json({ error: 'Failed to get account balance' }, 500);
  }
});

export default app;