// ============================================
// AR RECONCILIATION MATCHING UTILITIES
// ============================================
//
// Extracted from AP Rec and Bank Rec for AR Reconciliation
// Universal functions for matching, scoring, and validation
//
// Date: January 2, 2026
// Phase 1 of AR Matching Engine Enhancement

/* ==========================================
 * SUBSET-SUM AND COMBINATION MATCHING
 * ==========================================
 * Finds combinations of 2-5 entries that sum to target amount ± tolerance
 * Uses optimized subset-sum algorithm for large datasets
 */

/**
 * Find subset combinations using backtracking algorithm
 * Optimized for datasets up to 50 entries
 */
function findSubsetSum(
  entries: any[],
  targetAmount: number,
  tolerance: number,
  maxSize: number = 5
): any[][] {
  const results: any[][] = [];
  const n = entries.length;
  
  // For large datasets, limit to top 50 entries by amount
  if (n > 50) {
    const sorted = [...entries].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    return findSubsetSumOptimized(sorted.slice(0, 50), targetAmount, tolerance, maxSize);
  }
  
  function backtrack(start: number, current: any[], currentSum: number) {
    // Check if current combination is valid (2-5 entries)
    if (current.length >= 2 && current.length <= maxSize) {
      const diff = Math.abs(currentSum - targetAmount);
      if (diff <= tolerance) {
        results.push([...current]);
      }
    }
    
    // Pruning conditions
    if (current.length >= maxSize) return;
    if (currentSum > targetAmount + tolerance * 2) return;
    
    // Try adding each remaining entry
    for (let i = start; i < n; i++) {
      const entry = entries[i];
      const newSum = currentSum + Math.abs(entry.amount);
      
      // Skip if this would overshoot too much
      if (newSum > targetAmount + tolerance * 3) continue;
      
      current.push(entry);
      backtrack(i + 1, current, newSum);
      current.pop();
    }
  }
  
  backtrack(0, [], 0);
  
  // Sort by combination size (prefer smaller combinations)
  return results.sort((a, b) => a.length - b.length);
}

/**
 * Optimized subset-sum for very large datasets (>50 entries)
 * Uses greedy pruning to limit search space
 */
function findSubsetSumOptimized(
  entries: any[],
  targetAmount: number,
  tolerance: number,
  maxSize: number
): any[][] {
  const results: any[][] = [];
  const n = Math.min(entries.length, 30); // Hard limit for performance
  
  function greedyBacktrack(start: number, current: any[], currentSum: number, depth: number) {
    // Depth limit to prevent runaway recursion
    if (depth > 100) return;
    
    // Check if valid combination found
    if (current.length >= 2 && current.length <= maxSize) {
      const diff = Math.abs(currentSum - targetAmount);
      if (diff <= tolerance) {
        results.push([...current]);
        if (results.length > 20) return; // Limit total results
      }
    }
    
    // Pruning conditions
    if (current.length >= maxSize || results.length > 20) return;
    
    // Try adding remaining entries
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
 * Main entry point: Find combinations of entries that sum to target amount
 * Intelligently switches between brute-force and subset-sum based on dataset size
 */
export function findMatchingCombinations(
  entries: any[],
  targetAmount: number,
  tolerance: number,
  maxSize: number = 5,
  useSubsetSum: boolean = true
): any[][] {
  // For small datasets (<= 10 entries), use simple brute-force
  if (entries.length <= 10) {
    const combos: any[][] = [];
    
    // Try all 2-entry combinations
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const combo = [entries[i], entries[j]];
        const sum = combo.reduce((s, e) => s + Math.abs(e.amount), 0);
        if (Math.abs(sum - targetAmount) <= tolerance) {
          combos.push(combo);
          if (combos.length > 20) return combos;
        }
      }
    }
    
    // Try 3-entry combinations if amount is large enough
    if (Math.abs(targetAmount) > 200 && entries.length >= 3) {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          for (let k = j + 1; k < entries.length; k++) {
            const combo = [entries[i], entries[j], entries[k]];
            const sum = combo.reduce((s, e) => s + Math.abs(e.amount), 0);
            if (Math.abs(sum - targetAmount) <= tolerance) {
              combos.push(combo);
              if (combos.length > 20) return combos;
            }
          }
        }
      }
    }
    
    return combos;
  }
  
  // For medium/large datasets, use subset-sum algorithm
  if (useSubsetSum) {
    return findSubsetSum(entries, targetAmount, tolerance, maxSize);
  }
  
  // Fallback: limited brute-force with early exit
  const combos: any[][] = [];
  let count = 0;
  
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      count++;
      if (count > 1000) return combos; // Safety limit
      
      const combo = [entries[i], entries[j]];
      const sum = combo.reduce((s, e) => s + Math.abs(e.amount), 0);
      if (Math.abs(sum - targetAmount) <= tolerance) {
        combos.push(combo);
        if (combos.length > 20) return combos;
      }
    }
  }
  
  return combos;
}

/* ==========================================
 * TOLERANCE CALCULATION
 * ==========================================
 * Dynamic tolerance based on amount size and scenario
 * Stricter for multi-entry matches to prevent false positives
 */

export function calculateTolerance(amount: number, scenario: 'exact' | 'multi' = 'exact'): number {
  const absAmount = Math.abs(amount);
  
  // For exact matches: be more lenient (handles rounding, fees)
  if (scenario === 'exact') {
    // Small amounts (< €50): Allow up to €2 difference
    if (absAmount < 50) return 2.0;
    
    // Medium amounts (€50 - €1000): Allow €5 difference
    if (absAmount < 1000) return 5.0;
    
    // Large amounts (€1000 - €10,000): Allow 0.5% tolerance
    if (absAmount < 10000) return absAmount * 0.005;
    
    // Very large amounts (>= €10,000): Allow 0.25% tolerance
    return absAmount * 0.0025;
  }
  
  // For multi-entry matches: be STRICT (prevents cross-customer contamination)
  // Learned from AP Rec "vendor contamination" issues (Dec 31, 2025)
  if (absAmount < 100) return 0.50;   // Tightened from 2.0 to 0.50
  if (absAmount < 1000) return 1.00;  // Tightened from 5.0 to 1.00
  if (absAmount < 10000) return absAmount * 0.001;  // Tightened from 0.005 to 0.001
  return absAmount * 0.0005;  // Tightened from 0.0025 to 0.0005
}

/* ==========================================
 * CUSTOMER NAME NORMALIZATION & FUZZY MATCHING
 * ==========================================
 * Handles variations: "ABC Corp." vs "ABC Corporation"
 * Removes suffixes, normalizes unicode, fuzzy comparison
 */

/**
 * Normalize customer name for fuzzy matching
 * Removes common suffixes, special chars, normalizes unicode
 */
export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes (GmbH, Ltd., Inc., Corp., etc.)
    .replace(/\s+(gmbh|co\.|co|ltd\.|ltd|inc\.|inc|ag|kg|ohg|gbr|ug|sa|srl|llc|corp|corporation)$/i, '')
    // Remove dots and special chars
    .replace(/[.,\-()]/g, '')
    // Normalize unicode (e.g., ä → a, ö → o)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if customer names match (fuzzy)
 * Returns true if names are similar enough
 */
export function customerNamesMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  
  const n1 = normalizeCustomerName(name1);
  const n2 = normalizeCustomerName(name2);
  
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
}

/**
 * Calculate customer name similarity score (0-1)
 * Used for weighted scoring in FX matching
 */
export function calculateCustomerSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  
  const n1 = normalizeCustomerName(name1);
  const n2 = normalizeCustomerName(name2);
  
  // Exact match
  if (n1 === n2) return 1.0;
  
  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;
  
  // Word-based similarity
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  
  if (words1.length >= 2 && words2.length >= 2) {
    const matchingWords = words1.filter(w1 => words2.some(w2 => w1 === w2));
    return matchingWords.length / Math.max(words1.length, words2.length);
  }
  
  return 0;
}

/* ==========================================
 * DATE COMPARISON UTILITIES
 * ==========================================
 * Handles multiple date formats (ISO, US, European, Excel serial)
 * Calculates date differences in days
 */

/**
 * Parse a date string handling multiple formats
 */
function parseDate(dateStr: string): Date | null {
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
}

/**
 * Check if dates match within N days threshold
 */
export function datesMatch(date1: string, date2: string, daysThreshold: number = 7): boolean {
  try {
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
}

/**
 * Calculate date difference in days
 * Returns absolute difference
 */
export function calculateDateDifference(date1: string, date2: string): number {
  try {
    const d1 = parseDate(date1);
    const d2 = parseDate(date2);
    
    if (!d1 || !d2) return 999; // Large number if parsing fails
    
    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

/* ==========================================
 * FX (FOREIGN EXCHANGE) RATE BOUNDS
 * ==========================================
 * Realistic FX rate bounds for 20+ currency pairs
 * Updated: January 2026
 * Bounds are intentionally wide (±15%) to handle normal volatility
 */

export const FX_RATE_BOUNDS: Record<string, { min: number; max: number }> = {
  // Major pairs (USD, EUR, GBP)
  'USD→EUR': { min: 0.85, max: 1.10 },
  'EUR→USD': { min: 0.90, max: 1.18 },
  'USD→GBP': { min: 0.70, max: 0.90 },
  'GBP→USD': { min: 1.10, max: 1.45 },
  'EUR→GBP': { min: 0.80, max: 0.95 },
  'GBP→EUR': { min: 1.05, max: 1.25 },
  
  // Swiss Franc (CHF)
  'USD→CHF': { min: 0.85, max: 1.05 },
  'CHF→USD': { min: 0.95, max: 1.18 },
  'EUR→CHF': { min: 0.92, max: 1.12 },
  'CHF→EUR': { min: 0.89, max: 1.09 },
  
  // Japanese Yen (JPY) - Much different scale!
  'JPY→USD': { min: 0.0060, max: 0.0095 },
  'USD→JPY': { min: 105, max: 165 },
  'JPY→EUR': { min: 0.0055, max: 0.0085 },
  'EUR→JPY': { min: 120, max: 180 },
  'JPY→GBP': { min: 0.0048, max: 0.0075 },
  'GBP→JPY': { min: 135, max: 210 },
  
  // Canadian Dollar (CAD)
  'CAD→USD': { min: 0.70, max: 0.82 },
  'USD→CAD': { min: 1.22, max: 1.43 },
  'CAD→EUR': { min: 0.62, max: 0.74 },
  'EUR→CAD': { min: 1.35, max: 1.62 },
  
  // Australian Dollar (AUD)
  'AUD→USD': { min: 0.62, max: 0.77 },
  'USD→AUD': { min: 1.30, max: 1.62 },
  'AUD→EUR': { min: 0.56, max: 0.69 },
  'EUR→AUD': { min: 1.45, max: 1.79 },
  
  // Chinese Yuan (CNY)
  'CNY→USD': { min: 0.13, max: 0.16 },
  'USD→CNY': { min: 6.2, max: 7.7 },
  'CNY→EUR': { min: 0.12, max: 0.15 },
  'EUR→CNY': { min: 6.7, max: 8.3 },
};

/**
 * Check if this is an FX scenario (different currencies)
 */
export function isFXScenario(currency1: string, currency2: string): boolean {
  if (!currency1 || !currency2) return false;
  return currency1.toUpperCase() !== currency2.toUpperCase();
}

/**
 * Calculate the implied FX rate from two amounts
 * Returns the rate and direction (e.g., "USD→EUR")
 */
export function getImpliedFXRate(
  invoiceAmount: number,
  paymentAmount: number,
  invoiceCurrency: string,
  paymentCurrency: string
): { rate: number; direction: string } {
  // Calculate implied rate: paymentAmount / invoiceAmount
  // Example: 649.12 EUR / 705.57 USD = 0.9200 (means 1 USD = 0.92 EUR)
  const rate = Math.abs(paymentAmount) / Math.abs(invoiceAmount);
  const direction = `${invoiceCurrency.toUpperCase()}→${paymentCurrency.toUpperCase()}`;
  
  return { rate, direction };
}

/**
 * Check if an implied FX rate is realistic (within expected bounds)
 */
export function isFXRateRealistic(rate: number, direction: string): boolean {
  const bounds = FX_RATE_BOUNDS[direction];
  
  if (!bounds) {
    // Unknown currency pair - REJECT to prevent false positives
    // We must have explicit bounds defined for all supported currency pairs
    console.warn(`⚠️ Unknown FX pair: ${direction} - Rate: ${rate.toFixed(4)} - REJECTING to prevent false match`);
    return false;
  }
  
  return rate >= bounds.min && rate <= bounds.max;
}

/* ==========================================
 * INVOICE/REFERENCE NUMBER EXTRACTION
 * ==========================================
 * Extract invoice numbers from payment descriptions
 * Patterns: INV-123, Invoice 123, #123, Inv123, etc.
 */

export function extractInvoiceReferences(description: string): string[] {
  if (!description) return [];
  
  const desc = description.toLowerCase();
  const matches: string[] = [];
  
  // Common patterns for invoice references - capture full invoice number including prefix
  const patterns = [
    /\b(inv[oice]*[-\s#]*[a-z0-9]+)\b/gi,      // INV-123, Invoice-123, Inv 123, INV2021
    /\b([a-z]+[-][0-9]+)\b/gi,                  // ABC-123, XYZ-456
    /#([a-z0-9]+)/g,                            // #123
    /ref[erence]*[-:\s]*([a-z0-9]+)/gi,        // REF-123, Reference: 123
    /order[-\s#]*([a-z0-9]+)/gi,                // Order #123
    /po[-\s#]*([a-z0-9]+)/gi                    // PO-123
  ];
  
  for (const pattern of patterns) {
    const found = desc.matchAll(pattern);
    for (const match of found) {
      if (match[1] && match[1].length >= 2) {
        // Clean up the match - remove spaces, normalize
        const cleaned = match[1].replace(/\s+/g, '-').replace(/[-]+/g, '-').trim();
        matches.push(cleaned.toLowerCase());
      }
    }
  }
  
  // Remove duplicates
  return [...new Set(matches)];
}

/* ==========================================
 * AMOUNT COMPARISON UTILITIES
 * ==========================================
 * Universal amount matching using absolute values
 * Handles all sign conventions
 */

/**
 * Check if amounts match (with intelligent tolerance)
 * Uses absolute values to handle all sign conventions
 */
export function amountsMatch(amount1: number, amount2: number, customTolerance?: number): boolean {
  const tolerance = customTolerance ?? calculateTolerance(amount1, 'exact');
  const diff = Math.abs(Math.abs(amount1) - Math.abs(amount2));
  return diff <= tolerance;
}

/* ==========================================
 * SIGN PATTERN VALIDATION
 * ==========================================
 * Ensures grouped entries have consistent signs
 * Prevents mixing debits + credits
 */

export function hasSameSignPattern(amounts: number[]): boolean {
  if (amounts.length === 0) return true;
  const allPositive = amounts.every(a => a >= 0);
  const allNegative = amounts.every(a => a < 0);
  return allPositive || allNegative;
}

/* ==========================================
 * CUSTOMER IDENTIFIER EXTRACTION
 * ==========================================
 * Extract normalized customer identifier for purity checking
 */

export function extractCustomerIdentifier(description: string): string {
  if (!description) return 'unknown';
  
  const normalized = description.toLowerCase().trim();
  
  // Extract customer code pattern (e.g., "CUST-1", "ABC", "XYZ")
  const codeMatch = normalized.match(/\b([a-z]{2,4}-?\d+|[a-z]{3,5})\b/i);
  if (codeMatch) {
    return codeMatch[1].toLowerCase();
  }
  
  // Fallback: use first 20 chars as identifier
  return normalized.substring(0, 20);
}

/**
 * Check if a group of entries has customer purity (all same customer)
 */
export function checkCustomerPurity(entries: any[]): { 
  isPure: boolean; 
  customers: string[]; 
  message: string;
} {
  if (entries.length <= 1) {
    return { 
      isPure: true, 
      customers: entries.map(e => extractCustomerIdentifier(e.customer || e.description || '')), 
      message: 'Single entry - always pure' 
    };
  }
  
  const customers = entries.map(e => extractCustomerIdentifier(e.customer || e.description || ''));
  const uniqueCustomers = [...new Set(customers)];
  
  const isPure = uniqueCustomers.length === 1;
  const message = isPure 
    ? `All entries from same customer: ${uniqueCustomers[0]}`
    : `CUSTOMER CONTAMINATION: Mixed customers [${uniqueCustomers.join(', ')}]`;
  
  return { isPure, customers, message };
}

/**
 * Calculate date spread in days for a group of entries
 */
export function calculateDateSpread(entries: any[]): number {
  if (entries.length <= 1) return 0;
  
  const dates = entries.map(e => new Date(e.date));
  const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
  
  const earliest = sortedDates[0];
  const latest = sortedDates[sortedDates.length - 1];
  
  return Math.floor((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
}

/* ==========================================
 * GROUPED MATCH VALIDATION
 * ==========================================
 * Validate if a grouped match candidate is acceptable
 * Prevents false positives from customer contamination
 */

export function validateGroupedMatch(
  entries: any[], 
  matchType: 'one_to_many' | 'many_to_one'
): {
  isValid: boolean;
  reasons: string[];
  customerPurity: boolean;
  dateSpread: number;
} {
  const reasons: string[] = [];
  
  // HARD CONSTRAINT 1: Customer purity (ABSOLUTE REQUIREMENT)
  const customerCheck = checkCustomerPurity(entries);
  if (!customerCheck.isPure) {
    reasons.push(customerCheck.message);
  }
  
  // HARD CONSTRAINT 2: Date coherence
  // For AR: batch payments typically within 30 days, partial payments within 60 days (relaxed)
  const maxDateSpread = matchType === 'one_to_many' ? 30 : 60;
  const dateSpread = calculateDateSpread(entries);
  if (dateSpread > maxDateSpread) {
    reasons.push(`Date spread too large: ${dateSpread} days (max ${maxDateSpread})`);
  }
  
  // HARD CONSTRAINT 3: No mixing of very different amounts
  if (entries.length >= 2) {
    const amounts = entries.map(e => Math.abs(e.amount)).sort((a, b) => a - b);
    const smallest = amounts[0];
    const largest = amounts[amounts.length - 1];
    
    // Reject if largest is more than 3x smallest for 2-entry groups
    // Reject if largest is more than 5x smallest for 3+ entry groups
    const maxRatio = entries.length === 2 ? 3 : 5;
    
    if (smallest > 0 && (largest / smallest) > maxRatio) {
      reasons.push(`Amount disparity too high: €${smallest.toFixed(2)} to €${largest.toFixed(2)} (${(largest/smallest).toFixed(1)}x ratio, max ${maxRatio}x)`);
    }
  }
  
  const isValid = customerCheck.isPure && dateSpread <= maxDateSpread && reasons.length === 0;
  
  return {
    isValid,
    reasons,
    customerPurity: customerCheck.isPure,
    dateSpread
  };
}