import * as kv from './kv_store.tsx';

/**
 * Classifies a document as invoice or receipt using OpenAI
 */
export async function classifyDocument(
  fileBuffer: Uint8Array,
  fileType: string,
  fileName: string
): Promise<{ type: 'invoice' | 'receipt' | 'unknown'; confidence: number; reasoning: string }> {
  console.log(`🔍 Classifying document: ${fileName} (${fileType})`);
  
  try {
    // For images, use OpenAI Vision
    if (fileType.startsWith('image/')) {
      console.log('📸 Using Vision API to classify...');
      
      const base64Image = await bufferToBase64(fileBuffer);
      const dataUrl = `data:${fileType};base64,${base64Image}`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Classify this document. Is it an INVOICE or a RECEIPT?

INVOICE characteristics:
- Formal business document sent BEFORE payment
- Contains invoice number, due date, payment terms
- Usually multi-page with detailed line items
- From vendor/supplier to customer
- Shows "Invoice", "Bill", "Payment Due"
- Professional layout with company letterhead

RECEIPT characteristics:
- Proof of payment AFTER transaction
- Shorter, simpler format (single page or small slip)
- Shows items purchased at point of sale
- Often from retail stores, restaurants, gas stations
- Shows "Receipt", "Paid", "Transaction Complete"
- May be handwritten or from cash register/POS
- Common for everyday expenses (meals, supplies, parking)

Return ONLY a JSON object:
{
  "type": "invoice" or "receipt",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`,
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 500,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        const data = JSON.parse(result.choices[0].message.content);
        console.log(`✅ Classified as ${data.type} (confidence: ${data.confidence})`);
        return data;
      }
    }
    // For PDFs, extract text and classify
    else if (fileType === 'application/pdf') {
      console.log('📄 Extracting text from PDF to classify...');
      
      const pdfParseModule = await import('npm:pdf-parse@1.1.1');
      const pdfParse = pdfParseModule.default;
      const pdfData = await pdfParse(fileBuffer);
      const pdfText = pdfData.text.substring(0, 3000); // First 3000 chars
      
      if (pdfText && pdfText.trim().length > 10) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: `Classify this document. Is it an INVOICE or a RECEIPT?

INVOICE: Formal document with invoice number, due date, payment terms
RECEIPT: Proof of payment, simpler format, shows "Paid" or "Receipt"

Document text:
${pdfText}

Return JSON:
{
  "type": "invoice" or "receipt",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`,
              },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 500,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          const data = JSON.parse(result.choices[0].message.content);
          console.log(`✅ Classified as ${data.type} (confidence: ${data.confidence})`);
          return data;
        }
      }
    }
  } catch (error) {
    console.error('❌ Classification error:', error);
  }
  
  // Default to invoice if classification fails
  return { type: 'invoice', confidence: 0.5, reasoning: 'Classification failed, defaulting to invoice' };
}

/**
 * Extracts receipt data from an image or PDF
 */
export async function extractReceiptData(
  fileBuffer: Uint8Array,
  fileType: string,
  fileName: string,
  fileUrl: string,
  companyId: string,
  emailMetadata: {
    emailId: string;
    emailFrom: string;
    emailSubject: string;
  },
  filePath?: string
): Promise<any> {
  console.log(`🧾 Extracting receipt data from: ${fileName}`);
  
  try {
    let receiptData: any = null;
    
    // For images, use Vision API
    if (fileType.startsWith('image/')) {
      const base64Image = await bufferToBase64(fileBuffer);
      const dataUrl = `data:${fileType};base64,${base64Image}`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract receipt information. Return JSON with:
- merchant: string (store/restaurant name)
- total: number (total amount paid)
- subtotal: number (subtotal before tax, if present)
- tax: number (tax/VAT amount, if present)
- taxRate: number (tax rate as percentage, e.g., 8.0 for 8%, if shown on receipt)
- date: string (YYYY-MM-DD)
- category: string (for general retailers like Walmart, Target, Amazon, Costco, Marshalls, categorize based on items purchased. One of: "Office Supplies", "Meals & Entertainment", "Travel & Transportation", "Software & Subscriptions", "Utilities", "Professional Services", "Marketing", "Personal/Non-Deductible", "Other")
- paymentMethod: string ("Cash", "Credit Card", "Debit Card", "Other")
- items: array of line items (if shown), each with:
  - description: string (item description)
  - amount: number (item amount)
  - quantity: number (quantity if shown, optional)

Use null if not found. Extract only numbers for amounts.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1500,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        receiptData = JSON.parse(result.choices[0].message.content);
        console.log('✅ Receipt data extracted from image:', JSON.stringify(receiptData, null, 2));
      } else {
        const errorText = await response.text();
        console.error('❌ OpenAI API error for receipt extraction (image):', response.status, errorText);
      }
    }
    // For PDFs, extract text first
    else if (fileType === 'application/pdf') {
      const pdfParseModule = await import('npm:pdf-parse@1.1.1');
      const pdfParse = pdfParseModule.default;
      const pdfData = await pdfParse(fileBuffer);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: `Extract receipt information from this text. Return JSON with:
- merchant: string
- total: number (total)
- subtotal: number (subtotal before tax, if present)
- tax: number (tax/VAT amount, if present)
- taxRate: number (tax rate as percentage, e.g., 8.0 for 8%, if shown on receipt)
- date: string (YYYY-MM-DD)
- category: string
- paymentMethod: string
- items: array of line items (if shown), each with:
  - description: string (item description)
  - amount: number (item amount)
  - quantity: number (quantity if shown, optional)

Text:
${pdfData.text}`,
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1500,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        receiptData = JSON.parse(result.choices[0].message.content);
        console.log('✅ Receipt data extracted from PDF:', JSON.stringify(receiptData, null, 2));
      } else {
        const errorText = await response.text();
        console.error('❌ OpenAI API error for receipt extraction (PDF):', response.status, errorText);
      }
    }
    
    if (receiptData) {
      const receiptId = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const receipt = {
        id: receiptId,
        companyId,
        merchant: receiptData.merchant || 'Unknown Merchant',
        amount: receiptData.total || 0,  // Changed from 'total' to 'amount' to match frontend interface
        total: receiptData.total || 0,    // Keep 'total' for backwards compatibility
        subtotal: receiptData.subtotal || null,
        tax: receiptData.tax || null,
        taxRate: receiptData.taxRate || null,
        taxAmount: receiptData.tax || null,  // Also set taxAmount for frontend compatibility
        date: receiptData.date || new Date().toISOString().split('T')[0],
        category: receiptData.category || 'Other',
        paymentMethod: receiptData.paymentMethod || 'Unknown',
        items: receiptData.items || [],
        imageUrl: fileUrl,
        filePath: filePath || null,
        fileName: fileName,
        status: 'Pending',
        source: 'email',
        ...emailMetadata,
        emailReceivedAt: new Date().toISOString(),
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      console.log(`💾 Saving receipt to KV store:`, {
        key: `receipt:${companyId}:${receiptId}`,
        merchant: receipt.merchant,
        amount: receipt.amount,
        itemCount: receipt.items?.length || 0
      });
      
      await kv.set(`receipt:${companyId}:${receiptId}`, receipt);
      console.log(`✅ Receipt saved: ${receipt.merchant} - €${receipt.amount} (${receipt.items?.length || 0} items)`);
      
      return receipt;
    }
  } catch (error) {
    console.error('❌ Receipt extraction error:', error);
  }
  
  return null;
}

/**
 * Extracts invoice data from an image or PDF
 */
export async function extractInvoiceData(
  fileBuffer: Uint8Array,
  fileType: string,
  fileName: string,
  fileUrl: string,
  filePath: string,
  companyId: string,
  emailMetadata: {
    emailId: string;
    emailFrom: string;
    emailSubject: string;
  }
): Promise<any> {
  console.log(`📄 Extracting invoice data from: ${fileName}`);
  
  try {
    let invoiceData: any = null;
    
    // For images, use Vision API
    if (fileType.startsWith('image/')) {
      const base64Image = await bufferToBase64(fileBuffer);
      const dataUrl = `data:${fileType};base64,${base64Image}`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract invoice information. Return JSON with:
- invoiceNumber: string
- vendor: string
- date: string (YYYY-MM-DD)
- dueDate: string (YYYY-MM-DD)
- gross: number (total including tax)
- net: number (before tax)
- vat: number (tax amount)
- currency: string ("EUR", "USD", etc.)
- category: string ("Services", "Office Supplies", etc.)

Use null if not found. Extract only numbers for amounts.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1500,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        invoiceData = JSON.parse(result.choices[0].message.content);
      }
    }
    // For PDFs, extract text first
    else if (fileType === 'application/pdf') {
      const pdfParseModule = await import('npm:pdf-parse@1.1.1');
      const pdfParse = pdfParseModule.default;
      const pdfData = await pdfParse(fileBuffer);
      
      if (!pdfData.text || pdfData.text.trim().length < 10) {
        console.error('❌ No text extracted from PDF');
        return null;
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: `Extract invoice information from this text. Return JSON with:
- invoiceNumber: string
- vendor: string
- date: string (YYYY-MM-DD)
- dueDate: string (YYYY-MM-DD)
- gross: number
- net: number
- vat: number
- currency: string
- category: string

Text:
${pdfData.text}`,
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1500,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        invoiceData = JSON.parse(result.choices[0].message.content);
      }
    }
    
    if (invoiceData) {
      // Check for duplicate
      if (invoiceData.vendor && invoiceData.invoiceNumber) {
        const existingInvoices = await kv.getByPrefix(`invoice:${companyId}:`);
        const isDuplicate = existingInvoices.some((inv: any) => 
          inv.vendor === invoiceData.vendor && 
          inv.invoiceNumber === invoiceData.invoiceNumber
        );
        
        if (isDuplicate) {
          console.log(`⚠️ Duplicate invoice: ${invoiceData.vendor} - ${invoiceData.invoiceNumber}`);
          return null;
        }
      }
      
      const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const invoice = {
        id: invoiceId,
        companyId,
        documentName: fileName,
        vendor: invoiceData.vendor || 'Unknown Vendor',
        invoiceNumber: invoiceData.invoiceNumber,
        date: invoiceData.date || new Date().toISOString().split('T')[0],
        dueDate: invoiceData.dueDate,
        gross: invoiceData.gross || 0,
        net: invoiceData.net || 0,
        vat: invoiceData.vat || 0,
        currency: invoiceData.currency || 'EUR',
        category: invoiceData.category || 'General',
        fileUrl,
        filePath,
        status: 'Pending',
        source: 'email',
        ...emailMetadata,
        emailReceivedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await kv.set(`invoice:${companyId}:${invoiceId}`, invoice);
      console.log(`✅ Invoice saved: ${invoice.vendor} - ${invoice.gross} ${invoice.currency}`);
      
      return invoice;
    }
  } catch (error) {
    console.error('❌ Invoice extraction error:', error);
  }
  
  return null;
}

/**
 * Helper: Convert buffer to base64 in chunks to avoid stack overflow
 */
async function bufferToBase64(buffer: Uint8Array): Promise<string> {
  let binaryString = '';
  const chunkSize = 8192;
  
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, i + chunkSize);
    binaryString += String.fromCharCode(...chunk);
  }
  
  return btoa(binaryString);
}