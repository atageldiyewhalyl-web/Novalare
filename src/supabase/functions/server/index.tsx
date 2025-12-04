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

    // Handle PDFs - extract text first
    if (file.type === 'application/pdf') {
      console.log('📖 Extracting text from PDF...');
      
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const tempPath = `/tmp/invoice-${Date.now()}.pdf`;
      
      await Deno.writeFile(tempPath, bytes);
      
      try {
        const pdfParse = (await import('npm:pdf-parse@1.1.1')).default;
        const dataBuffer = await Deno.readFile(tempPath);
        const data = await pdfParse(dataBuffer);
        
        invoiceText = data.text;
        console.log('✅ Extracted', invoiceText.length, 'characters from PDF');
        
        await Deno.remove(tempPath);
      } catch (parseError) {
        console.error('❌ PDF parsing error:', parseError);
        try { await Deno.remove(tempPath); } catch {}
        return c.json({ 
          error: 'Failed to parse PDF file',
          details: parseError.message 
        }, 500);
      }
    } else {
      // For images, use GPT-4o Vision
      console.log('🖼️ Processing image file for vision analysis...');
      useVision = true;
      
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
        model: 'gpt-4o',
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
    const bankFile = formData.get('bank_file') as File;
    const ledgerFile = formData.get('ledger_file') as File;

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

        console.log(`📊 Excel data: ${jsonData.length} rows`);
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

    // 🤖 AI-POWERED MATCHING (OpenAI GPT-4o)
    console.log('🤖 Using OpenAI GPT-4o for intelligent reconciliation...');
    
    // Check if API key is available
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      throw new Error('OpenAI API key not configured');
    }

    console.log(`🔑 Sending ${bankTransactions.length} bank txns + ${ledgerEntries.length} ledger entries to AI...`);
    
    // Prepare comprehensive prompt for AI
    const reconciliationPrompt = `You are a SENIOR ACCOUNTING SYSTEM performing bank reconciliation. You must handle complex matching scenarios including partial payments, FX conversions, and timing differences.

## 🚨 CRITICAL INSTRUCTION - READ THIS FIRST:

You will classify ${bankTransactions.length} bank transactions into TWO categories:
1. **matched_pairs**: Bank transactions that HAVE a corresponding ledger entry (exact, fuzzy, grouped, fx_conversion, timing_difference)
2. **unmatched_bank**: Bank transactions that DO NOT have any ledger entry (fees, interest, unknown transactions)

⚠️ THESE ARRAYS MUST NOT OVERLAP! Each bank transaction goes into EXACTLY ONE array.
⚠️ matched_pairs.length + unmatched_bank.length MUST EQUAL ${bankTransactions.length}
⚠️ DO NOT use match_type "unmatched" in the matched_pairs array!

## BANK TRANSACTIONS (${bankTransactions.length} total):
${JSON.stringify(bankTransactions.slice(0, 40), null, 2)}${bankTransactions.length > 40 ? '\n... (showing first 40)' : ''}

## LEDGER ENTRIES (${ledgerEntries.length} total):
${JSON.stringify(ledgerEntries.slice(0, 40), null, 2)}${ledgerEntries.length > 40 ? '\n... (showing first 40)' : ''}

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

    // Call OpenAI API
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
            content: 'You are a SENIOR ACCOUNTANT with 20+ years of reconciliation experience. You excel at: (1) MANY-TO-ONE matching (multiple bank txns → one ledger), (2) FX conversions with gain/loss adjustments, (3) Identifying timing differences vs true unmatched items. NEVER suggest creating a JE when the ledger entry already exists. Return ONLY valid JSON.'
          },
          {
            role: 'user',
            content: reconciliationPrompt
          }
        ],
        temperature: 0.2, // Slightly higher for better pattern recognition
        max_tokens: 2000,
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
    
    if (!gptResponse) {
      console.error('❌ No response from OpenAI');
      throw new Error('OpenAI returned no content');
    }

    console.log('✅ AI response received (length:', gptResponse.length, 'chars)');

    // Parse AI response (remove markdown if present)
    let aiResult;
    try {
      let cleaned = gptResponse.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }
      
      aiResult = JSON.parse(cleaned);
      console.log('✅ Parsed AI result:', {
        matched: aiResult.matched_pairs?.length || 0,
        unmatched_bank: aiResult.unmatched_bank?.length || 0,
        unmatched_ledger: aiResult.unmatched_ledger?.length || 0
      });
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Raw response:', gptResponse.substring(0, 500));
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

    console.log('✅ Normalized results:', {
      matched: matched.length,
      unmatched_bank: unmatchedBankWithSuggestions.length,
      unmatched_ledger: unmatchedLedger.length
    });

    // 🔍 Validate AI results for common errors
    const totalClassified = matched.length + unmatchedBankWithSuggestions.length;
    if (totalClassified !== bankTransactions.length) {
      console.warn(`⚠️ Classification mismatch: ${matched.length} matched + ${unmatchedBankWithSuggestions.length} unmatched = ${totalClassified}, but expected ${bankTransactions.length}`);
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

    console.log('✅ After validation:', {
      matched: finalMatched.length,
      unmatched_bank: unmatchedBankWithSuggestions.length,
      total: finalMatched.length + unmatchedBankWithSuggestions.length
    });

    // Calculate summary
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
    return c.json({ 
      error: 'Failed to process bank reconciliation',
      details: error.message 
    }, 500);
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
      const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
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

PDF content: ${base64Pdf.substring(0, 50000)}`
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
    
    const apEntries = apData.map((row: any) => ({
      invoice_number: String(row['Invoice #'] || row['Invoice'] || row['invoice_number'] || row['Invoice Number'] || '').trim(),
      date: row['Date'] || row['date'] || row['Invoice Date'] || '',
      amount: parseFloat(row['Amount'] || row['amount'] || row['Total'] || 0),
      status: row['Status'] || row['status'] || 'Pending',
      vendor: row['Vendor'] || row['vendor'] || ''
    }));

    console.log(`✅ Parsed ${apEntries.length} AP ledger entries`);

    // Send to OpenAI for intelligent reconciliation
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const reconciliationPrompt = `You are a SENIOR ACCOUNTANT performing AP vendor statement reconciliation.

## VENDOR INVOICES (${vendorInvoices.length} from vendor statement):
${JSON.stringify(vendorInvoices, null, 2)}

## INTERNAL AP LEDGER (${apEntries.length} entries):
${JSON.stringify(apEntries, null, 2)}

## YOUR TASK:

Reconcile the vendor statement with the internal AP ledger. Identify:

1. **MATCHED INVOICES**: Invoice numbers that appear in BOTH vendor statement AND internal ledger with matching amounts
2. **AMOUNT MISMATCHES**: Invoice numbers in both but with different amounts
3. **MISSING INVOICES**: Invoices on vendor statement but NOT in internal ledger (company needs to record them)
4. **INTERNAL ONLY**: Invoices in internal ledger but NOT on vendor statement (vendor may not have issued, or already credited)
5. **DUPLICATES**: Same invoice number appears multiple times in internal ledger

## MATCHING RULES:
- Match on invoice_number (exact match, case-insensitive)
- If amounts differ by more than €0.01, it's an amount mismatch
- Credits are typically negative amounts

## OUTPUT FORMAT (STRICT JSON):
{
  "summary": {
    "vendor_name": "Extract from data or use 'Vendor'",
    "statement_date": "Extract from data or use today's date",
    "total_vendor_invoices": number,
    "total_internal_entries": number,
    "matched_count": number,
    "amount_mismatches_count": number,
    "missing_invoices_count": number,
    "internal_only_count": number,
    "duplicates_count": number,
    "vendor_total": sum of all vendor invoice amounts,
    "internal_total": sum of all internal entry amounts,
    "difference": vendor_total - internal_total
  },
  "matched_invoices": [
    {
      "vendor_invoice": {...vendor invoice object},
      "internal_entry": {...internal AP entry object},
      "match_type": "exact"
    }
  ],
  "amount_mismatches": [
    {
      "invoice_number": "INV-123",
      "vendor_amount": 100.00,
      "internal_amount": 95.00,
      "difference": 5.00,
      "notes": "Investigate reason for €5 difference"
    }
  ],
  "missing_invoices": [
    {
      "invoice": {...vendor invoice object},
      "reason": "Not recorded in AP ledger",
      "action": "Record this invoice in AP system"
    }
  ],
  "internal_only_invoices": [
    {
      "invoice": {...internal entry object},
      "reason": "Not on vendor statement",
      "action": "Verify with vendor or check if already credited"
    }
  ],
  "duplicates": [
    {
      "invoice_number": "INV-123",
      "occurrences": 2,
      "entries": [...array of duplicate internal entries]
    }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

    console.log('🤖 Sending to OpenAI for reconciliation...');

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

    return c.json(result);

  } catch (error) {
    console.error('❌ AP reconciliation error:', error);
    return c.json({ 
      error: 'Failed to process AP reconciliation',
      details: error.message 
    }, 500);
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

    // Create a new workbook
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
    
    // Set column widths for summary sheet
    summarySheet['!cols'] = [
      { wch: 30 },
      { wch: 30 }
    ];

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
      
      // Set column widths
      mismatchSheet['!cols'] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 30 },
        { wch: 50 }
      ];

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
      
      // Set column widths
      missingSheet['!cols'] = [
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
        { wch: 40 },
        { wch: 50 }
      ];

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
      
      // Set column widths
      internalSheet['!cols'] = [
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 20 },
        { wch: 40 },
        { wch: 50 }
      ];

      XLSX.utils.book_append_sheet(workbook, internalSheet, 'Internal Only');
    }

    // Sheet 5: Duplicate Invoices
    if (result.duplicates && result.duplicates.length > 0) {
      const duplicateData = [
        ['Invoice Number', 'Occurrences', 'Entry Details', 'Recommended Action']
      ];
      
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
      
      // Set column widths
      duplicateSheet['!cols'] = [
        { wch: 15 },
        { wch: 12 },
        { wch: 60 },
        { wch: 50 }
      ];

      XLSX.utils.book_append_sheet(workbook, duplicateSheet, 'Duplicates');
    }

    // Sheet 6: Matched Invoices (optional, can be large)
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
      
      // Set column widths
      matchedSheet['!cols'] = [
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, matchedSheet, 'Matched Invoices');
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log('✅ Excel file generated successfully');

    // Return as downloadable file
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="AP_Reconciliation_${result.summary.vendor_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx"`,
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
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
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

Deno.serve(app.fetch);