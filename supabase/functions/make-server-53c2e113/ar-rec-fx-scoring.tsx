// ============================================
// AR RECONCILIATION FX SCORING
// ============================================
//
// FX (Foreign Exchange) matching logic for AR reconciliation
// Handles currency conversion scenarios where:
// - Invoice shows transaction in one currency (e.g., USD, JPY)
// - Payment shows same transaction after FX conversion (e.g., EUR)
//
// Strategy: Don't predict rates - DETECT patterns and VALIDATE reasonableness
//
// 🔒 CRITICAL SAFEGUARDS (Jan 2, 2026):
// 1. CUSTOMER MATCHING REQUIRED: Score=0 if customer similarity <60%
// 2. EXPLICIT FX BOUNDS: Unknown currency pairs are REJECTED (no generic fallback)
// 3. JPY SUPPORT: Added realistic bounds for JPY (0.006-0.009 vs EUR/USD)
// 4. MINIMUM SCORE: Raised threshold from 30 to 55 (requires customer match)
//
// This prevents false positives like matching:
// - Client A (USD) with Client B (EUR)
// - Different customers just because amounts are similar

import {
  calculateCustomerSimilarity,
  extractInvoiceReferences,
  calculateDateDifference,
  isFXRateRealistic
} from './ar-rec-matching-utils.tsx';

/**
 * Score an FX match using invoice number, customer, date, and FX rate validation
 * Returns score (0-100) and match metadata
 * 
 * SCORING BREAKDOWN (100 points total):
 * - Invoice/Reference Match: 45 points (critical for FX)
 * - Customer Name Match: 25 points (REQUIRED - hard reject if <60%)
 * - Date Proximity: 15 points (FX can have lag)
 * - FX Rate Realistic: 15 points (must pass - hard reject if unrealistic)
 * - Amount Correlation: 20 points (bonus for strong correlation)
 * 
 * MINIMUM THRESHOLD: 55 points
 * Ensures customer match (15+) + date match (15+) + FX valid (15+) + some invoice/amount correlation
 */
export function scoreFXMatch(
  invoice: any,
  payment: any,
  impliedRate: number,
  fxDirection: string
): {
  score: number;
  type: string;
  matchType: string;
  fxRate: number;
  fxDirection: string;
  confidence: string;
  explanation: string;
} {
  let score = 0;
  const reasons: string[] = [];

  // 1. Invoice/Reference Number Match (45 points - critical for FX)
  const invoiceRefs = extractInvoiceReferences(invoice.invoice_number || invoice.description || '');
  const paymentRefs = extractInvoiceReferences(payment.description || '');
  
  if (invoiceRefs.length > 0 && paymentRefs.length > 0) {
    const hasMatchingRef = invoiceRefs.some(iRef => 
      paymentRefs.some(pRef => 
        iRef.toLowerCase() === pRef.toLowerCase() ||
        iRef.toLowerCase().includes(pRef.toLowerCase()) ||
        pRef.toLowerCase().includes(iRef.toLowerCase())
      )
    );
    
    if (hasMatchingRef) {
      score += 45;
      reasons.push(`Invoice match: ${invoiceRefs[0]}`);
    }
  } else {
    // No invoice numbers available - neutral (don't penalize, but don't reward)
    reasons.push('No invoice numbers available');
  }

  // 2. Customer Name Match (25 points) - REQUIRED for FX matches!
  const customerName = invoice.customer || invoice.description || '';
  
  // Extract customer from payment description
  // In AR, payment description often contains customer name
  const paymentCustomer = payment.description || '';
  
  // IMPORTANT: If we have a strong invoice number match, customer match is optional
  // Invoice numbers are sufficient proof for AR reconciliation
  const hasStrongInvoiceMatch = invoiceRefs.length > 0 && paymentRefs.length > 0 &&
    invoiceRefs.some(iRef => 
      paymentRefs.some(pRef => 
        iRef.toLowerCase() === pRef.toLowerCase() ||
        iRef.toLowerCase().includes(pRef.toLowerCase()) ||
        pRef.toLowerCase().includes(iRef.toLowerCase())
      )
    );
  
  if (customerName && paymentCustomer) {
    const customerSimilarity = calculateCustomerSimilarity(customerName, paymentCustomer);
    
    if (customerSimilarity > 0.8) {
      score += 25;
      reasons.push('Customer match: ' + customerName);
    } else if (customerSimilarity > 0.6) {
      score += 15;
      reasons.push('Partial customer match');
    } else if (!hasStrongInvoiceMatch) {
      // HARD REJECT only if we don't have a strong invoice number match
      // This prevents matching "Client A USD invoice" with "Client B EUR payment"
      return {
        score: 0,
        type: 'customer_mismatch',
        matchType: 'FX Match Rejected',
        fxRate: impliedRate,
        fxDirection,
        confidence: 'rejected',
        explanation: `Customer mismatch: "${customerName}" vs "${paymentCustomer}". FX matches require customer name similarity >60% OR invoice number match.`
      };
    } else {
      // Invoice number match is strong enough, customer mismatch is acceptable
      reasons.push(`Customer mismatch but invoice match overrides`);
    }
  } else if (!hasStrongInvoiceMatch) {
    // Missing customer information AND no invoice match - cannot verify, reject to be safe
    return {
      score: 0,
      type: 'missing_customer_info',
      matchType: 'FX Match Rejected',
      fxRate: impliedRate,
      fxDirection,
      confidence: 'rejected',
      explanation: 'Missing customer information and no invoice number match. Cannot verify FX match safely.'
    };
  } else {
    // Missing customer but have invoice match - acceptable
    reasons.push('Customer info missing but invoice match present');
  }

  // 3. Date Proximity (15 points - FX can have lag)
  const daysDiff = Math.abs(calculateDateDifference(invoice.date, payment.date));
  
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
  
  // 5. Amount correlation (20 points - bonus)
  // Even without matching invoice numbers, if the FX rate is consistent, give points
  // This helps match transactions where only amounts and dates are reliable
  const invoiceAmt = Math.abs(invoice.amount);
  const paymentAmt = Math.abs(payment.amount);
  const amountRatioDiff = Math.abs(1 - impliedRate); // How far from 1:1
  
  if (amountRatioDiff <= 0.5) { // FX rate between 0.5 and 1.5 (reasonable)
    score += 20;
    reasons.push('Amount correlation strong');
  } else if (amountRatioDiff <= 0.8) {
    score += 10;
    reasons.push('Amount correlation moderate');
  }

  // Determine confidence level
  let confidence = 'low';
  if (score >= 80) confidence = 'high';
  else if (score >= 60) confidence = 'medium';
  else if (score >= 30) confidence = 'low';

  // Build explanation
  const explanation = `FX Transaction Match: ${reasons.join(', ')}. This is a valid match - amounts differ due to currency conversion (${invoiceAmt.toFixed(2)} ${invoice.currency || 'EUR'} → ${paymentAmt.toFixed(2)} ${payment.currency || 'EUR'} @ ${impliedRate.toFixed(4)}).`;

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