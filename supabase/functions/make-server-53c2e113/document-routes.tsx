import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-53c2e113');

// Get all documents for a company
app.get('/documents/:companyId', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    console.log(`📄 Fetching all documents for company ${companyId}`);

    // Collect all documents from different sources
    const documents: any[] = [];

    // 1. Get bank statements from all periods
    const bankRecKeys = await kv.getByPrefix(`bank-rec:${companyId}:`);
    for (const item of bankRecKeys) {
      const data = item.value;
      if (data?.statements && Array.isArray(data.statements)) {
        for (const statement of data.statements) {
          documents.push({
            id: statement.id,
            name: statement.fileName,
            type: 'Bank Statement',
            documentType: 'bank',
            date: new Date(statement.uploadedAt).toLocaleDateString(),
            uploadedAt: statement.uploadedAt,
            status: 'Processed',
            transactionCount: statement.transactionCount,
            fileUrl: statement.fileUrl,
            filePath: statement.filePath,
            period: item.key.split(':')[2] // Extract period from key
          });
        }
      }
    }

    // 2. Get AP statements
    const apRecKeys = await kv.getByPrefix(`ap-rec:${companyId}:`);
    for (const item of apRecKeys) {
      const data = item.value;
      if (data?.statements && Array.isArray(data.statements)) {
        for (const statement of data.statements) {
          documents.push({
            id: statement.id,
            name: statement.fileName,
            type: 'AP Statement',
            documentType: 'vendor',
            date: new Date(statement.uploadedAt).toLocaleDateString(),
            uploadedAt: statement.uploadedAt,
            status: 'Processed',
            transactionCount: statement.transactionCount,
            fileUrl: statement.fileUrl,
            filePath: statement.filePath,
            period: item.key.split(':')[2]
          });
        }
      }
    }

    // 3. Get AR statements
    const arRecKeys = await kv.getByPrefix(`ar-rec:${companyId}:`);
    for (const item of arRecKeys) {
      const data = item.value;
      if (data?.statements && Array.isArray(data.statements)) {
        for (const statement of data.statements) {
          documents.push({
            id: statement.id,
            name: statement.fileName,
            type: 'AR Statement',
            documentType: 'customer',
            date: new Date(statement.uploadedAt).toLocaleDateString(),
            uploadedAt: statement.uploadedAt,
            status: 'Processed',
            transactionCount: statement.transactionCount,
            fileUrl: statement.fileUrl,
            filePath: statement.filePath,
            period: item.key.split(':')[2]
          });
        }
      }
    }

    // 4. Get CC statements
    const ccRecKeys = await kv.getByPrefix(`cc-rec:${companyId}:`);
    for (const item of ccRecKeys) {
      const data = item.value;
      if (data?.statements && Array.isArray(data.statements)) {
        for (const statement of data.statements) {
          documents.push({
            id: statement.id,
            name: statement.fileName,
            type: 'Credit Card Statement',
            documentType: 'credit-card',
            date: new Date(statement.uploadedAt).toLocaleDateString(),
            uploadedAt: statement.uploadedAt,
            status: 'Processed',
            transactionCount: statement.transactionCount,
            fileUrl: statement.fileUrl,
            filePath: statement.filePath,
            period: item.key.split(':')[2]
          });
        }
      }
    }

    // 5. Get receipts
    const receiptsKey = `receipts:${companyId}`;
    const receiptsData = await kv.get(receiptsKey);
    if (receiptsData && Array.isArray(receiptsData)) {
      for (const receipt of receiptsData) {
        documents.push({
          id: receipt.id,
          name: receipt.fileName || `Receipt-${receipt.id}.pdf`,
          type: 'Receipt',
          documentType: 'receipt',
          date: receipt.date || new Date(receipt.uploadedAt).toLocaleDateString(),
          uploadedAt: receipt.uploadedAt || Date.now(),
          status: receipt.status || 'Processed',
          amount: receipt.total,
          vendor: receipt.vendor,
          fileUrl: receipt.fileUrl,
          filePath: receipt.filePath
        });
      }
    }

    // 6. Get invoices
    const invoicesKey = `invoices:${companyId}`;
    const invoicesData = await kv.get(invoicesKey);
    if (invoicesData && Array.isArray(invoicesData)) {
      for (const invoice of invoicesData) {
        documents.push({
          id: invoice.id,
          name: invoice.fileName || `Invoice-${invoice.invoiceNumber}.pdf`,
          type: 'Invoice',
          documentType: 'invoice',
          date: invoice.date || new Date(invoice.uploadedAt).toLocaleDateString(),
          uploadedAt: invoice.uploadedAt || Date.now(),
          status: invoice.status || 'Processed',
          amount: invoice.total,
          customer: invoice.customer,
          invoiceNumber: invoice.invoiceNumber,
          fileUrl: invoice.fileUrl,
          filePath: invoice.filePath
        });
      }
    }

    // Sort documents by upload date (newest first)
    documents.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));

    console.log(`✅ Found ${documents.length} documents for company ${companyId}`);

    return c.json({
      documents,
      total: documents.length
    });
  } catch (error: any) {
    console.error('❌ Error fetching documents:', error);
    return c.json({ error: error.message || 'Failed to fetch documents' }, 500);
  }
});

// Download a document (generate fresh signed URL)
app.get('/documents/:companyId/download/:documentId', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const documentId = c.req.param('documentId');
    
    console.log(`📥 Generating download URL for document ${documentId} in company ${companyId}`);

    // Find the document to get its filePath
    let filePath: string | null = null;
    let bucketName: string | null = null;

    // Search through all reconciliation data
    const prefixes = [
      `bank-rec:${companyId}:`,
      `ap-rec:${companyId}:`,
      `ar-rec:${companyId}:`,
      `cc-rec:${companyId}:`
    ];

    const bucketMap: Record<string, string> = {
      'bank-rec': 'make-53c2e113-bank-statements',
      'ap-rec': 'make-53c2e113-ap-statements',
      'ar-rec': 'make-53c2e113-ar-statements',
      'cc-rec': 'make-53c2e113-cc-statements'
    };

    for (const prefix of prefixes) {
      const keys = await kv.getByPrefix(prefix);
      for (const item of keys) {
        const data = item.value;
        if (data?.statements) {
          const statement = data.statements.find((s: any) => s.id === documentId);
          if (statement) {
            filePath = statement.filePath;
            const recType = prefix.split(':')[0];
            bucketName = bucketMap[recType];
            break;
          }
        }
      }
      if (filePath) break;
    }

    if (!filePath || !bucketName) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Generate a fresh signed URL
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600); // 1 hour

    if (urlError) {
      console.error('Signed URL error:', urlError);
      return c.json({ error: 'Failed to generate download URL' }, 500);
    }

    console.log(`✅ Generated download URL for ${filePath}`);

    return c.json({
      url: signedUrlData.signedUrl,
      expiresIn: 3600
    });
  } catch (error: any) {
    console.error('❌ Error generating download URL:', error);
    return c.json({ error: error.message || 'Failed to generate download URL' }, 500);
  }
});

export default app;
