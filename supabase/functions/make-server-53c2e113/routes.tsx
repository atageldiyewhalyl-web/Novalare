import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono();

// Initialize Supabase client for storage
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const BUCKET_NAME = 'make-53c2e113-documents';

// Initialize storage bucket on module load
async function initializeBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      console.log('📦 Creating storage bucket:', BUCKET_NAME);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (error) {
        console.error('❌ Failed to create bucket:', error);
      } else {
        console.log('✅ Storage bucket created successfully');
      }
    } else {
      console.log('✅ Storage bucket already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing storage bucket:', error);
  }
}

// Initialize bucket
initializeBucket();

// ============================================
// ANALYTICS ROUTES
// ============================================

app.post('/analytics/track', async (c) => {
  try {
    const body = await c.req.json();
    const { demoType, fileName, fileSize, fileType, success, errorMessage, processingTime, metadata } = body;
    
    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      demoType,
      fileName,
      fileSize,
      fileType,
      success,
      errorMessage,
      processingTime,
      metadata,
    };
    
    // Store with timestamp-based key for easy querying
    const key = `analytics:demo:${event.timestamp}:${event.id}`;
    await kv.set(key, event);
    
    console.log(`📊 Analytics tracked: ${demoType} - ${fileName} - ${success ? 'SUCCESS' : 'FAILED'}`);
    
    return c.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error('❌ Error tracking analytics:', error);
    return c.json({ error: 'Failed to track analytics' }, 500);
  }
});

app.get('/analytics', async (c) => {
  try {
    const timeRange = c.req.query('timeRange') || '7d';
    
    // Get all analytics events
    const allEvents = await kv.getByPrefix('analytics:demo:');
    
    // Filter by time range
    const now = new Date();
    const cutoffTime = new Date();
    
    switch (timeRange) {
      case '24h':
        cutoffTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoffTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffTime.setDate(now.getDate() - 30);
        break;
      case 'all':
        cutoffTime.setFullYear(2000); // Far in the past
        break;
    }
    
    const filteredEvents = allEvents.filter(event => 
      new Date(event.timestamp) >= cutoffTime
    );
    
    // Calculate stats
    const totalRuns = filteredEvents.length;
    const successfulRuns = filteredEvents.filter(e => e.success).length;
    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
    
    const eventsWithTime = filteredEvents.filter(e => e.processingTime);
    const avgProcessingTime = eventsWithTime.length > 0
      ? eventsWithTime.reduce((sum, e) => sum + e.processingTime, 0) / eventsWithTime.length
      : 0;
    
    const stats = {
      totalRuns,
      successRate,
      avgProcessingTime,
      totalFiles: totalRuns,
    };
    
    // Sort events by timestamp (newest first)
    const sortedEvents = filteredEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return c.json({ events: sortedEvents, stats });
  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

// ============================================
// COMPANIES ROUTES
// ============================================

app.get('/api/companies', async (c) => {
  try {
    let companies = await kv.getByPrefix('company:');
    
    // Auto-seed if no companies exist
    if (companies.length === 0) {
      console.log('🌱 No companies found, auto-seeding database...');
      
      const seedCompanies = [
        {
          id: '1',
          name: 'ABC Bäckerei GmbH',
          country: 'DE',
          status: 'Active',
          tags: ['Bookkeeping', 'DE', 'VAT'],
          docsThisMonth: 520,
          lastActivity: '2 hours ago',
          email: 'invoice_company1@novalare.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'TechNova UG',
          country: 'DE',
          status: 'Active',
          tags: ['Tech', 'DE', 'Startup'],
          docsThisMonth: 1130,
          lastActivity: '1 day ago',
          email: 'invoice_company2@novalare.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'Green Logistics GmbH',
          country: 'DE',
          status: 'Active',
          tags: ['Logistics', 'DE', 'VAT'],
          docsThisMonth: 230,
          lastActivity: '3 days ago',
          email: 'invoice_company3@novalare.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      for (const company of seedCompanies) {
        await kv.set(`company:${company.id}`, company);
      }
      
      companies = seedCompanies;
      console.log('✅ Auto-seeded 3 companies');
    }
    
    return c.json({ success: true, data: companies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return c.json({ success: false, error: 'Failed to fetch companies' }, 500);
  }
});

app.get('/api/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const company = await kv.get(`company:${id}`);
    
    if (!company) {
      return c.json({ success: false, error: 'Company not found' }, 404);
    }
    
    return c.json({ success: true, data: company });
  } catch (error) {
    console.error('Error fetching company:', error);
    return c.json({ success: false, error: 'Failed to fetch company' }, 500);
  }
});

app.post('/api/companies', async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const company = {
      id,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`company:${id}`, company);
    return c.json({ success: true, data: company }, 201);
  } catch (error) {
    console.error('Error creating company:', error);
    return c.json({ success: false, error: 'Failed to create company' }, 500);
  }
});

app.put('/api/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await kv.get(`company:${id}`);
    
    if (!existing) {
      return c.json({ success: false, error: 'Company not found' }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`company:${id}`, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating company:', error);
    return c.json({ success: false, error: 'Failed to update company' }, 500);
  }
});

app.delete('/api/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`company:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting company:', error);
    return c.json({ success: false, error: 'Failed to delete company' }, 500);
  }
});

// ============================================
// DOCUMENTS ROUTES
// ============================================

app.get('/api/companies/:companyId/documents', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const documents = await kv.getByPrefix(`document:${companyId}:`);
    return c.json({ success: true, data: documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return c.json({ success: false, error: 'Failed to fetch documents' }, 500);
  }
});

app.post('/api/companies/:companyId/documents', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const body = await c.req.json();
    const id = crypto.randomUUID();
    
    const document = {
      id,
      companyId,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`document:${companyId}:${id}`, document);
    return c.json({ success: true, data: document }, 201);
  } catch (error) {
    console.error('Error creating document:', error);
    return c.json({ success: false, error: 'Failed to create document' }, 500);
  }
});

app.delete('/api/companies/:companyId/documents/:id', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const id = c.req.param('id');
    
    console.log(`🗑️ Deleting document: ${id} from company: ${companyId}`);
    
    // Delete document record from KV store (succeeds even if key doesn't exist)
    await kv.del(`document:${companyId}:${id}`);
    
    console.log(`✅ Document ${id} deleted successfully`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting document:', error);
    return c.json({ success: false, error: 'Failed to delete document' }, 500);
  }
});

// File upload endpoint
app.post('/api/companies/:companyId/upload-file', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    console.log('📤 Uploading file for company:', companyId);
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }
    
    console.log('📄 File details:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    // Create unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${companyId}/${timestamp}-${sanitizedFileName}`;
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    
    console.log('💾 Uploading to storage:', filePath);
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return c.json({ success: false, error: `Upload failed: ${uploadError.message}` }, 500);
    }
    
    console.log('✅ File uploaded, generating signed URL...');
    
    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 31536000); // 1 year in seconds
    
    if (urlError || !signedUrlData) {
      console.error('❌ Signed URL error:', urlError);
      return c.json({ success: false, error: 'Failed to generate download URL' }, 500);
    }
    
    console.log('✅ Signed URL generated successfully');
    
    return c.json({ 
      success: true, 
      data: { 
        fileUrl: signedUrlData.signedUrl,
        filePath 
      } 
    });
    
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    return c.json({ success: false, error: 'Failed to upload file' }, 500);
  }
});

// ============================================
// ACTIVITIES ROUTES
// ============================================

app.get('/api/companies/:companyId/activities', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const activities = await kv.getByPrefix(`activity:${companyId}:`);
    
    // Sort by date descending
    const sorted = activities.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({ success: true, data: sorted });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return c.json({ success: false, error: 'Failed to fetch activities' }, 500);
  }
});

app.post('/api/companies/:companyId/activities', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const body = await c.req.json();
    const id = crypto.randomUUID();
    
    const activity = {
      id,
      companyId,
      ...body,
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`activity:${companyId}:${id}`, activity);
    return c.json({ success: true, data: activity }, 201);
  } catch (error) {
    console.error('Error creating activity:', error);
    return c.json({ success: false, error: 'Failed to create activity' }, 500);
  }
});

// ============================================
// INVOICES ROUTES
// ============================================

app.get('/api/companies/:companyId/invoices', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const invoices = await kv.getByPrefix(`invoice:${companyId}:`);
    return c.json({ success: true, data: invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return c.json({ success: false, error: 'Failed to fetch invoices' }, 500);
  }
});

app.post('/api/companies/:companyId/invoices', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const body = await c.req.json();
    const id = crypto.randomUUID();
    
    const invoice = {
      id,
      companyId,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`invoice:${companyId}:${id}`, invoice);
    return c.json({ success: true, data: invoice }, 201);
  } catch (error) {
    console.error('Error creating invoice:', error);
    return c.json({ success: false, error: 'Failed to create invoice' }, 500);
  }
});

app.put('/api/companies/:companyId/invoices/:id', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`invoice:${companyId}:${id}`);
    
    if (!existing) {
      return c.json({ success: false, error: 'Invoice not found' }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      id,
      companyId,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`invoice:${companyId}:${id}`, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return c.json({ success: false, error: 'Failed to update invoice' }, 500);
  }
});

app.delete('/api/companies/:companyId/invoices/:id', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const id = c.req.param('id');
    
    // Get the invoice to retrieve the file path
    const invoice: any = await kv.get(`invoice:${companyId}:${id}`);
    
    if (!invoice) {
      return c.json({ success: false, error: 'Invoice not found' }, 404);
    }
    
    // Delete the file from Supabase Storage if filePath exists
    if (invoice.filePath) {
      console.log('🗑️ Deleting file from storage:', invoice.filePath);
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([invoice.filePath]);
      
      if (storageError) {
        console.error('❌ Storage deletion error:', storageError);
        // Continue with invoice deletion even if file deletion fails
      } else {
        console.log('✅ File deleted from storage successfully');
      }
    } else {
      console.log('⚠️ No filePath found in invoice, skipping storage deletion');
    }
    
    // Delete the invoice metadata from KV store
    await kv.del(`invoice:${companyId}:${id}`);
    console.log('✅ Invoice metadata deleted from database');
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return c.json({ success: false, error: 'Failed to delete invoice' }, 500);
  }
});

// ============================================
// METRICS ROUTES
// ============================================

app.get('/api/metrics/dashboard', async (c) => {
  try {
    const companies = await kv.getByPrefix('company:');
    const activeCompanies = companies.filter((c: any) => c.status === 'Active');
    
    // Calculate total documents this month from all companies
    const documentsThisMonth = companies.reduce((sum: number, company: any) => {
      return sum + (company.docsThisMonth || 0);
    }, 0);
    
    // Calculate hours saved (estimate: 3 minutes per document = 0.05 hours)
    const hoursSaved = Math.round(documentsThisMonth * 0.05);
    
    // Calculate AI usage cost (estimate: $0.033 per document)
    const aiUsageCost = Math.round(documentsThisMonth * 0.033);
    
    const metrics = {
      activeCompanies: activeCompanies.length,
      documentsThisMonth,
      hoursSaved,
      aiUsageCost,
    };
    
    return c.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return c.json({ success: false, error: 'Failed to fetch metrics' }, 500);
  }
});

app.get('/api/metrics/company/:companyId', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    
    // Get metrics for specific company
    const documents = await kv.getByPrefix(`document:${companyId}:`);
    const invoices = await kv.getByPrefix(`invoice:${companyId}:`);
    
    const metrics = {
      documentsProcessed: documents.length,
      bankStatements: documents.filter((d: any) => d.type === 'Bank Statement').length,
      invoicesExtracted: invoices.length,
      monthEndClose: 'In Progress',
    };
    
    return c.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error fetching company metrics:', error);
    return c.json({ success: false, error: 'Failed to fetch company metrics' }, 500);
  }
});

// ============================================
// SETTINGS ROUTES
// ============================================

app.get('/api/settings', async (c) => {
  try {
    const settings = await kv.get('settings:firm') || {
      plan: 'Pro',
      price: 149,
      companyLimit: 20,
      billingCycle: 'monthly',
      nextBillingDate: '2024-04-01',
    };
    
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return c.json({ success: false, error: 'Failed to fetch settings' }, 500);
  }
});

app.put('/api/settings', async (c) => {
  try {
    const body = await c.req.json();
    await kv.set('settings:firm', body);
    return c.json({ success: true, data: body });
  } catch (error) {
    console.error('Error updating settings:', error);
    return c.json({ success: false, error: 'Failed to update settings' }, 500);
  }
});

// ============================================
// EMAIL PARSING ROUTES
// ============================================

// Get emails for a company
app.get('/api/companies/:companyId/emails', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const emails = await kv.getByPrefix(`email:${companyId}:`);
    
    // Sort by date descending
    const sorted = emails.sort((a: any, b: any) => 
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
    
    return c.json({ success: true, data: sorted });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return c.json({ success: false, error: 'Failed to fetch emails' }, 500);
  }
});

// Parse incoming email (webhook endpoint)
app.post('/api/companies/:companyId/emails/parse', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    console.log('📧 Parsing email for company:', companyId);
    
    const formData = await c.req.formData();
    const from = formData.get('from') as string;
    const subject = formData.get('subject') as string;
    const body = formData.get('body') as string;
    const attachments = formData.getAll('attachments') as File[];
    
    console.log(`📨 Email from: ${from}, Subject: ${subject}, Attachments: ${attachments.length}`);
    
    const emailId = crypto.randomUUID();
    const processedAttachments = [];
    const extractedInvoices = [];
    
    // Process each attachment
    for (const file of attachments) {
      console.log(`📎 Processing attachment: ${file.name}`);
      
      // Upload file to storage
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${companyId}/emails/${timestamp}-${sanitizedFileName}`;
      
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);
      
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });
      
      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        continue;
      }
      
      // Generate signed URL
      const { data: signedUrlData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, 31536000);
      
      if (!signedUrlData) {
        console.error('❌ Failed to generate signed URL');
        continue;
      }
      
      processedAttachments.push({
        fileName: file.name,
        fileUrl: signedUrlData.signedUrl,
        fileType: file.type,
        fileSize: file.size,
      });
      
      // If it's a PDF or image, extract invoice data
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        console.log('🔍 Extracting invoice data from:', file.name, 'Type:', file.type);
        
        try {
          let extractionSuccessful = false;
          
          // For images, use OpenAI Vision API directly
          if (file.type.startsWith('image/')) {
            console.log('📸 Processing image with OpenAI Vision...');
            const base64 = btoa(String.fromCharCode(...fileBuffer));
            const dataUrl = `data:${file.type};base64,${base64}`;
            
            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                        text: 'Extract invoice information from this image. Return a JSON object with these exact fields: invoiceNumber (string), vendor (string), date (YYYY-MM-DD), dueDate (YYYY-MM-DD), gross (number), net (number), vat (number), currency (string like "EUR" or "USD"), category (string like "Office Supplies" or "Services"). If any field is not found, use null. For amounts, extract only the number without currency symbols.',
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
            
            if (openaiResponse.ok) {
              const result = await openaiResponse.json();
              const invoiceData = JSON.parse(result.choices[0].message.content);
              
              // Create invoice record with proper field mapping
              const invoiceId = crypto.randomUUID();
              const invoice = {
                id: invoiceId,
                companyId,
                documentName: file.name,
                vendor: invoiceData.vendor || 'Unknown Vendor',
                invoiceNumber: invoiceData.invoiceNumber,
                date: invoiceData.date || new Date().toISOString().split('T')[0],
                dueDate: invoiceData.dueDate,
                gross: invoiceData.gross || 0,
                net: invoiceData.net || 0,
                vat: invoiceData.vat || 0,
                currency: invoiceData.currency || 'EUR',
                category: invoiceData.category || 'General',
                fileUrl: signedUrlData.signedUrl,
                filePath,
                fileName: file.name,
                status: 'Pending',
                source: 'email',
                emailId,
                emailFrom: from,
                emailSubject: subject,
                emailReceivedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              await kv.set(`invoice:${companyId}:${invoiceId}`, invoice);
              extractedInvoices.push(invoice);
              extractionSuccessful = true;
              
              console.log('✅ Invoice extracted from image:', invoice.vendor, '-', invoice.invoiceNumber);
            } else {
              const errorText = await openaiResponse.text();
              console.error('❌ OpenAI API error:', openaiResponse.status, errorText);
            }
          } 
          // For PDFs, we need to extract text first, then send to OpenAI
          else if (file.type === 'application/pdf') {
            console.log('📤 Processing PDF with text extraction for invoice data...');
            
            // For PDFs, extract text first using pdf-parse
            try {
              console.log('📦 Loading pdf-parse library...');
              const pdfParseModule = await import('npm:pdf-parse@1.1.1');
              const pdfParse = pdfParseModule.default;
              console.log('✅ pdf-parse loaded');
              
              // Parse PDF to extract text
              console.log('📖 Parsing PDF buffer (size:', fileBuffer.length, 'bytes)...');
              const pdfData = await pdfParse(fileBuffer);
              const pdfText = pdfData.text;
              
              console.log(`📄 Extracted ${pdfText.length} characters from PDF`);
              console.log('📄 Preview (first 500 chars):', pdfText.substring(0, 500));
              
              if (!pdfText || pdfText.trim().length < 10) {
                console.error('❌ No text extracted from PDF, might be image-based or encrypted');
                continue;
              }
              
              // Send extracted text to OpenAI for structured extraction
              console.log('🤖 Sending extracted text to OpenAI for invoice parsing...');
              const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o',
                  messages: [
                    {
                      role: 'user',
                      content: `Extract invoice information from this text from a PDF invoice.

Return a JSON object with these fields:
- invoiceNumber: string (invoice/reference number)
- vendor: string (company issuing the invoice)
- date: string in YYYY-MM-DD format (invoice date)
- dueDate: string in YYYY-MM-DD format (payment due date)
- gross: number (total amount including tax)
- net: number (amount before tax)
- vat: number (tax amount)
- currency: string (e.g., "EUR", "USD")
- category: string (e.g., "Office Supplies", "Services")

Extract ONLY numeric values for amounts (no currency symbols or commas). Use null if field not found.

Invoice text:
${pdfText}`,
                    },
                  ],
                  response_format: { type: 'json_object' },
                  max_tokens: 1500,
                }),
              });
              
              if (!openaiResponse.ok) {
                const errorText = await openaiResponse.text();
                console.error('❌ OpenAI API error:', openaiResponse.status, errorText);
                continue;
              }
              
              const openaiResult = await openaiResponse.json();
              console.log('🤖 Full OpenAI response:', JSON.stringify(openaiResult, null, 2));
              
              const extractedJSON = openaiResult.choices[0]?.message?.content || '{}';
              
              console.log('🤖 OpenAI extracted JSON:', extractedJSON);
              
              // Parse the JSON response
              let invoiceData;
              try {
                invoiceData = JSON.parse(extractedJSON);
                console.log('✅ Successfully parsed invoice data:', invoiceData);
              } catch (parseError) {
                console.error('❌ Failed to parse OpenAI response as JSON:', parseError);
                continue;
              }
              
              // Check for duplicate invoice
              let isDuplicate = false;
              if (invoiceData.vendor && invoiceData.invoiceNumber) {
                const existingInvoices = await kv.getByPrefix(`invoice:${companyId}:`);
                isDuplicate = existingInvoices.some((inv: any) => 
                  inv.vendor === invoiceData.vendor && 
                  inv.invoiceNumber === invoiceData.invoiceNumber
                );
              }
              
              if (isDuplicate) {
                console.log(`⚠️ Duplicate invoice detected: ${invoiceData.vendor} - ${invoiceData.invoiceNumber}`);
                continue;
              }
              
              // Create invoice record
              const invoiceId = crypto.randomUUID();
              const invoice = {
                id: invoiceId,
                companyId,
                documentName: file.name,
                vendor: invoiceData.vendor || 'Unknown Vendor',
                invoiceNumber: invoiceData.invoiceNumber,
                date: invoiceData.date || new Date().toISOString().split('T')[0],
                dueDate: invoiceData.dueDate,
                gross: invoiceData.gross || 0,
                net: invoiceData.net || 0,
                vat: invoiceData.vat || 0,
                currency: invoiceData.currency || 'EUR',
                category: invoiceData.category || 'General',
                fileUrl: signedUrlData.signedUrl,
                filePath,
                fileName: file.name,
                status: 'Pending',
                source: 'email',
                emailId,
                emailFrom: from,
                emailSubject: subject,
                emailReceivedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              await kv.set(`invoice:${companyId}:${invoiceId}`, invoice);
              extractedInvoices.push(invoice);
              extractionSuccessful = true;
              
              console.log('✅ Invoice extracted from PDF:', invoice.vendor, '-', invoice.invoiceNumber, '-', invoice.gross, invoice.currency);
            } catch (pdfError) {
              console.error('❌ PDF parsing error:', pdfError);
              console.error('Stack:', pdfError.stack);
              continue;
            }
          }
          
          if (!extractionSuccessful) {
            console.log('⚠️ Could not extract invoice data from:', file.name);
          }
        } catch (error) {
          console.error('❌ Error extracting invoice from', file.name, ':', error);
        }
      }
    }
    
    // Store email record
    const email = {
      id: emailId,
      companyId,
      from,
      subject,
      body,
      attachments: processedAttachments,
      extractedInvoices: extractedInvoices.length,
      receivedAt: new Date().toISOString(),
      status: extractedInvoices.length > 0 ? 'Processed' : 'Received',
    };
    
    await kv.set(`email:${companyId}:${emailId}`, email);
    
    console.log(`✅ Email processed. Extracted ${extractedInvoices.length} invoices from ${processedAttachments.length} attachments`);
    
    return c.json({ 
      success: true, 
      data: {
        email,
        invoices: extractedInvoices,
      }
    });
    
  } catch (error) {
    console.error('❌ Error parsing email:', error);
    return c.json({ success: false, error: 'Failed to parse email' }, 500);
  }
});

// ============================================
// CLOUDFLARE EMAIL WORKER WEBHOOK ENDPOINT
// ============================================

// Cloudflare Email Worker webhook
app.post('/api/webhook/cloudflare', async (c) => {
  try {
    console.log('📬 Cloudflare Email Worker webhook received');
    
    const body = await c.req.json();
    
    // Extract email data from Cloudflare Worker
    const from = body.from || 'unknown@sender.com';
    const to = body.to || '';
    const subject = body.subject || 'No Subject';
    const rawEmail = body.rawEmail || ''; // Optional: full raw email if needed
    
    console.log('📧 Email Details:');
    console.log('  From:', from);
    console.log('  To:', to);
    console.log('  Subject:', subject);
    
    // Find company by email address
    let companyId = body.companyId || null;
    
    if (!companyId && to) {
      // Search all companies for matching email
      const allCompanies = await kv.getByPrefix('company:');
      const matchingCompany = allCompanies.find((company: any) => 
        company.email && company.email.toLowerCase() === to.toLowerCase()
      );
      
      if (matchingCompany) {
        companyId = matchingCompany.id;
        console.log(`✅ Found company by email: ${matchingCompany.name} (ID: ${companyId})`);
      } else {
        console.warn(`⚠️ No company found for email: ${to}, using default company ID: 1`);
        companyId = '1';
      }
    }
    
    console.log('  Company ID:', companyId);
    
    // Verify company exists
    const company = await kv.get(`company:${companyId}`);
    if (!company) {
      console.warn('⚠️ Company not found, using default company ID: 1');
      companyId = '1';
    }
    
    // Extract attachments from the request (Cloudflare Worker should send these)
    const attachments = body.attachments || [];
    
    console.log(`📎 Found ${attachments.length} attachments`);
    
    if (attachments.length === 0) {
      console.log('⚠️ No attachments found in email, skipping invoice processing');
      return c.json({ 
        success: true, 
        message: 'Email received but no attachments to process' 
      });
    }
    
    // Generate email ID
    const emailId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Process attachments and extract invoices
    const processedAttachments: any[] = [];
    const extractedInvoices: any[] = [];
    
    for (const attachment of attachments) {
      const fileName = attachment.filename || 'attachment.pdf';
      const fileType = attachment.contentType || 'application/pdf';
      const fileContent = attachment.content; // Base64 encoded content from Cloudflare
      
      console.log(`📄 Processing attachment: ${fileName} (${fileType})`);
      
      // Only process PDF files for invoice extraction
      if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        try {
          // Decode base64 content
          const fileBuffer = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));
          const fileSize = fileBuffer.length;
          
          // Upload file to Supabase Storage
          const filePath = `${companyId}/${Date.now()}-${fileName}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, fileBuffer, {
              contentType: fileType,
              upsert: false,
            });
          
          if (uploadError) {
            console.error('❌ Upload error:', uploadError);
            continue;
          }
          
          // Get signed URL for the uploaded file
          const { data: urlData } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year
          
          const fileUrl = urlData?.signedUrl;
          
          if (!fileUrl) {
            console.error('❌ Failed to get signed URL');
            continue;
          }
          
          processedAttachments.push({
            fileName,
            fileUrl,
            fileType,
            fileSize,
          });
          
          console.log('📤 Processing PDF with text extraction for invoice data...');
          
          // For PDFs, extract text first using pdf-parse
          try {
            console.log('📦 Loading pdf-parse library...');
            const pdfParseModule = await import('npm:pdf-parse@1.1.1');
            const pdfParse = pdfParseModule.default;
            console.log('✅ pdf-parse loaded');
            
            // Parse PDF to extract text
            console.log('📖 Parsing PDF buffer (size:', fileBuffer.length, 'bytes)...');
            const pdfData = await pdfParse(fileBuffer);
            const pdfText = pdfData.text;
            
            console.log(`📄 Extracted ${pdfText.length} characters from PDF`);
            console.log('📄 Preview (first 500 chars):', pdfText.substring(0, 500));
            
            if (!pdfText || pdfText.trim().length < 10) {
              console.error('❌ No text extracted from PDF, might be image-based or encrypted');
              continue;
            }
            
            // Send extracted text to OpenAI for structured extraction
            console.log('🤖 Sending extracted text to OpenAI for invoice parsing...');
            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'user',
                    content: `Extract invoice information from this text from a PDF invoice.

Return a JSON object with these fields:
- invoiceNumber: string (invoice/reference number)
- vendor: string (company issuing the invoice)
- date: string in YYYY-MM-DD format (invoice date)
- dueDate: string in YYYY-MM-DD format (payment due date)
- gross: number (total amount including tax)
- net: number (amount before tax)
- vat: number (tax amount)
- currency: string (e.g., "EUR", "USD")
- category: string (e.g., "Office Supplies", "Services")

Extract ONLY numeric values for amounts (no currency symbols or commas). Use null if field not found.

Invoice text:
${pdfText}`,
                  },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 1500,
              }),
            });
            
            if (!openaiResponse.ok) {
              const errorText = await openaiResponse.text();
              console.error('❌ OpenAI API error:', openaiResponse.status, errorText);
              continue;
            }
            
            const openaiResult = await openaiResponse.json();
            console.log('🤖 Full OpenAI response:', JSON.stringify(openaiResult, null, 2));
            
            const extractedJSON = openaiResult.choices[0]?.message?.content || '{}';
            
            console.log('🤖 OpenAI extracted JSON:', extractedJSON);
            
            // Parse the JSON response
            let invoiceData;
            try {
              invoiceData = JSON.parse(extractedJSON);
              console.log('✅ Successfully parsed invoice data:', invoiceData);
            } catch (parseError) {
              console.error('❌ Failed to parse OpenAI response as JSON:', parseError);
              continue;
            }
            
            // Check for duplicate invoice
            let isDuplicate = false;
            if (invoiceData.vendor && invoiceData.invoiceNumber) {
              const existingInvoices = await kv.getByPrefix(`invoice:${companyId}:`);
              isDuplicate = existingInvoices.some((inv: any) => 
                inv.vendor === invoiceData.vendor && 
                inv.invoiceNumber === invoiceData.invoiceNumber
              );
            }
            
            if (isDuplicate) {
              console.log(`⚠️ Duplicate invoice detected: ${invoiceData.vendor} - ${invoiceData.invoiceNumber}`);
              continue;
            }
            
            // Create invoice record
            const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const invoice = {
              id: invoiceId,
              companyId,
              documentName: fileName,
              vendor: invoiceData.vendor || 'Unknown Vendor',
              invoiceNumber: invoiceData.invoiceNumber || null,
              date: invoiceData.date || new Date().toISOString().split('T')[0],
              dueDate: invoiceData.dueDate || null,
              net: invoiceData.net || null,
              vat: invoiceData.vat || '0.00',
              gross: invoiceData.gross || '0.00',
              currency: invoiceData.currency || 'EUR',
              category: invoiceData.category || 'Uncategorized',
              status: 'Pending',
              fileUrl,
              filePath,
              source: 'email',
              emailId,
              emailFrom: from,
              emailSubject: subject,
              emailReceivedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            await kv.set(`invoice:${companyId}:${invoiceId}`, invoice);
            extractedInvoices.push(invoice);
            
            console.log(`✅ Invoice extracted and saved: ${invoice.vendor} - ${invoice.gross} ${invoice.currency}`);
            
          } catch (pdfError) {
            console.error('❌ PDF parsing error:', pdfError);
            console.error('Stack:', pdfError.stack);
            continue;
          }
        } catch (error) {
          console.error('❌ Error processing attachment:', fileName, error);
        }
      } else {
        console.log(`⏭️ Skipping non-PDF attachment: ${fileName}`);
      }
    }
    
    // Store email record
    const email = {
      id: emailId,
      companyId,
      from,
      subject,
      body: rawEmail ? 'Full email stored' : 'No body',
      attachments: processedAttachments,
      extractedInvoices: extractedInvoices.length,
      receivedAt: new Date().toISOString(),
      status: extractedInvoices.length > 0 ? 'Processed' : 'Received',
    };
    
    await kv.set(`email:${companyId}:${emailId}`, email);
    
    console.log(`✅ Cloudflare webhook processed successfully`);
    console.log(`   - Attachments: ${processedAttachments.length}`);
    console.log(`   - Invoices extracted: ${extractedInvoices.length}`);
    
    return c.json({ 
      success: true,
      message: `Processed ${extractedInvoices.length} invoices from ${processedAttachments.length} attachments`,
      data: {
        emailId,
        invoicesExtracted: extractedInvoices.length,
        attachmentsProcessed: processedAttachments.length,
      }
    });
    
  } catch (error) {
    console.error('❌ Cloudflare webhook error:', error);
    // Return 200 to Cloudflare to prevent retries
    return c.json({ 
      success: false, 
      error: 'Internal processing error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 200);
  }
});

export default app;