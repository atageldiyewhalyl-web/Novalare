import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { classifyDocument, extractReceiptData, extractInvoiceData } from './document-processor.tsx';

const app = new Hono().basePath('/make-server-53c2e113');  // Add basePath to match other routes

// Initialize Supabase client for storage
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const BUCKET_NAME = 'make-53c2e113-documents';

// ============================================
// AUTH CACHE - Performance Optimization
// ============================================
const userCache = new Map<string, { firmId: string; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds

async function getFirmIdFromToken(token: string): Promise<string> {
  // Check cache first
  const cached = userCache.get(token);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.firmId;
  }
  
  // Fetch from database
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (user && !error) {
      const userData = await kv.get(`user:${user.id}`);
      if (userData?.firm_id) {
        // Cache the result
        userCache.set(token, { firmId: userData.firm_id, timestamp: Date.now() });
        return userData.firm_id;
      }
    }
  } catch (error) {
    console.log('⚠️ Not authenticated or token invalid');
  }
  
  // Default firm for backward compatibility
  return 'default-firm-halyl';
}

// ============================================
// RECENTLY VIEWED COMPANIES - User-Specific
// ============================================

/**
 * GET /api/users/:userId/recent-companies
 * Get recently viewed companies for a user
 */
app.get('/api/users/:userId/recent-companies', async (c) => {
  try {
    const userId = c.req.param('userId');
    const recentCompanies = await kv.get(`user:${userId}:recent_companies`) || [];
    
    return c.json({ recentCompanyIds: recentCompanies });
  } catch (error: any) {
    console.error('❌ Error fetching recent companies:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/users/:userId/recent-companies
 * Add a company to user's recently viewed list
 */
app.post('/api/users/:userId/recent-companies', async (c) => {
  try {
    const userId = c.req.param('userId');
    const { companyId } = await c.req.json();
    
    if (!companyId) {
      return c.json({ error: 'companyId is required' }, 400);
    }
    
    // Get current recent companies
    const recentCompanies = await kv.get(`user:${userId}:recent_companies`) || [];
    
    // Remove company if it already exists (to avoid duplicates)
    const filtered = recentCompanies.filter((id: string) => id !== companyId);
    
    // Add to front of list, keep max 5
    const updated = [companyId, ...filtered].slice(0, 5);
    
    // Save back
    await kv.set(`user:${userId}:recent_companies`, updated);
    
    return c.json({ success: true, recentCompanyIds: updated });
  } catch (error: any) {
    console.error('❌ Error updating recent companies:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// CLOUDFLARE EMAIL ROUTING INTEGRATION
// ============================================

/**
 * Generates a unique email address for a company
 * Note: This generates the email format, but requires one-time Cloudflare Email Worker setup
 * The Email Worker will route all *+invoice@novalare.com emails to our webhook
 */
async function createCloudflareEmailAddress(companyId: string, companyName: string): Promise<string | null> {
  try {
    // Generate unique email address
    // Format: {company-name}+invoice@novalare.com
    const sanitizedName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
    
    const emailAddress = `${sanitizedName}+invoice@novalare.com`;
    
    console.log(`📧 Generated email address: ${emailAddress}`);
    console.log(`ℹ️ Email routing handled by Cloudflare Email Worker (one-time setup required)`);
    
    return emailAddress;
  } catch (error) {
    console.error('❌ Error generating email address:', error);
    // Fall back to template-based email
    return `invoices+${companyId}@novalare.com`;
  }
}

/**
 * Deletes email routing rule from Cloudflare when company is deleted
 */
async function deleteCloudflareEmailAddress(emailAddress: string): Promise<boolean> {
  try {
    const CLOUDFLARE_ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID');
    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
    
    if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
      console.warn('⚠️ Cloudflare credentials not configured, skipping email deletion');
      return false;
    }
    
    console.log(`🗑️ Deleting Cloudflare email routing for: ${emailAddress}`);
    
    // First, find the rule ID by listing all rules and matching the email
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/email/routing/rules`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!listResponse.ok) {
      console.error('❌ Failed to list Cloudflare email rules');
      return false;
    }
    
    const listResult = await listResponse.json();
    const rule = listResult.result?.find((r: any) => 
      r.matchers?.some((m: any) => m.value === emailAddress)
    );
    
    if (!rule) {
      console.warn(`⚠️ No Cloudflare rule found for email: ${emailAddress}`);
      return false;
    }
    
    // Delete the rule
    const deleteResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/email/routing/rules/${rule.tag}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!deleteResponse.ok) {
      console.error('❌ Failed to delete Cloudflare email rule');
      return false;
    }
    
    console.log('✅ Cloudflare email routing deleted');
    return true;
  } catch (error) {
    console.error('❌ Error deleting Cloudflare email address:', error);
    return false;
  }
}

// ============================================
// ANALYTICS ROUTES
// ============================================

app.post('/analytics/track', async (c) => {
  try {
    const body = await c.req.json();
    const { demoType, fileName, fileSize, fileType, success, errorMessage, processingTime, metadata } = body;
    
    console.log('📊 Tracking analytics event:', { demoType, fileName, success });
    
    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      demoType,
      fileName,
      fileSize,
      fileType,
      success,
      errorMessage: errorMessage || null,
      processingTime: processingTime || null,
      metadata: metadata || null,
    };
    
    // Store with timestamp-based key for easy querying
    const key = `analytics:demo:${event.timestamp}:${event.id}`;
    
    console.log('💾 Saving to KV store with key:', key);
    await kv.set(key, event);
    
    console.log(`✅ Analytics tracked successfully: ${demoType} - ${fileName} - ${success ? 'SUCCESS' : 'FAILED'}`);
    
    return c.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error('❌ Error tracking analytics:', error);
    return c.json({ error: 'Failed to track analytics' }, 500);
  }
});

app.post('/analytics/track-auth', async (c) => {
  try {
    const body = await c.req.json();
    const { eventType, userId, firmId, firmName, email, success, errorMessage } = body;
    
    console.log('🔐 Tracking auth analytics event:', { eventType, email, success });
    
    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      userId: userId || null,
      firmId: firmId || null,
      firmName: firmName || null,
      email: email || null,
      success,
      errorMessage: errorMessage || null,
    };
    
    // Store with timestamp-based key for easy querying
    const key = `analytics:auth:${event.timestamp}:${event.id}`;
    
    console.log('💾 Saving auth analytics to KV store with key:', key);
    await kv.set(key, event);
    
    console.log(`✅ Auth analytics tracked successfully: ${eventType} - ${email} - ${success ? 'SUCCESS' : 'FAILED'}`);
    
    return c.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error('❌ Error tracking auth analytics:', error);
    return c.json({ error: 'Failed to track auth analytics' }, 500);
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
    // IMPORTANT: Get user's firm_id for data isolation
    const authHeader = c.req.header('Authorization');
    let firmId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Try to get user from token (for authenticated users)
      firmId = await getFirmIdFromToken(token);
    }
    
    // If no firmId found, use default firm for backward compatibility
    if (!firmId) {
      firmId = 'default-firm-halyl';
    }
    
    // Get pagination parameters
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '9');
    const search = c.req.query('search') || '';
    
    // console.log(`📊 Fetching companies for firm: ${firmId}, page: ${page}, pageSize: ${pageSize}, search: ${search}`);
    
    // Fetch companies with pagination
    let allCompanies: any[] = [];
    
    // Also check for legacy companies without firm prefix (backward compatibility)
    if (firmId === 'default-firm-halyl') {
      // For default firm, fetch ALL companies from both sources FIRST, then paginate
      const firmResult = await kv.getByPrefixPaginated(
        `firm:${firmId}:company:`,
        1,
        10000, // Get all firm-scoped companies
        search
      );
      
      const legacyResult = await kv.getByPrefixPaginated(
        'company:',
        1,
        10000, // Get all legacy companies
        search
      );
      
      // Merge all companies from both sources
      const merged = [...firmResult.data, ...legacyResult.data];
      
      // Filter out invalid companies and deduplicate
      const validCompanies = merged.filter((company: any) => {
        if (!company || !company.id || company.id === 'undefined' || company.id === 'null') {
          console.warn('⚠️ Filtering out invalid company from backend:', JSON.stringify(company));
          return false;
        }
        return true;
      });
      
      // Deduplicate by company ID
      const uniqueCompaniesMap = new Map(validCompanies.map(c => [c.id, c]));
      allCompanies = Array.from(uniqueCompaniesMap.values());
    } else {
      // For other firms, just get their companies
      const firmResult = await kv.getByPrefixPaginated(
        `firm:${firmId}:company:`,
        1,
        10000, // Get all companies
        search
      );
      
      // Filter out invalid companies
      allCompanies = firmResult.data.filter((company: any) => {
        if (!company || !company.id || company.id === 'undefined' || company.id === 'null') {
          console.warn('⚠️ Filtering out invalid company from backend:', JSON.stringify(company));
          return false;
        }
        return true;
      });
    }
    
    // Sort companies alphabetically by name
    allCompanies.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB); // A-Z
    });
    
    // Calculate pagination on the complete merged dataset
    const total = allCompanies.length;
    const totalPages = Math.ceil(total / pageSize);
    
    // Apply pagination to get the current page's data
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedCompanies = allCompanies.slice(start, end);
    
    // Build the result
    const result = {
      data: paginatedCompanies,
      total,
      page,
      pageSize,
      totalPages
    };
    
    // No auto-seeding - users start with empty dashboard
    // console.log(`✅ Found ${result.data.length} companies (page ${page} of ${result.totalPages})`);
    
    return c.json({ 
      success: true, 
      data: result.data,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return c.json({ success: false, error: 'Failed to fetch companies' }, 500);
  }
});

app.get('/api/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validate company ID
    if (!id || id === 'undefined' || id === 'null') {
      console.error(`❌ Invalid company ID provided: ${id}`);
      return c.json({ success: false, error: 'Invalid company ID' }, 400);
    }
    
    // Get user's firm_id for data isolation
    const authHeader = c.req.header('Authorization');
    let firmId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          const userData = await kv.get(`user:${user.id}`);
          if (userData) {
            firmId = userData.firm_id;
          }
        }
      } catch (error) {
        console.log('⚠️ Not authenticated, using default firm');
      }
    }
    
    // If no firmId found, use default firm for backward compatibility
    if (!firmId) {
      firmId = 'default-firm-halyl';
    }
    
    console.log(`📊 Fetching company ${id} for firm: ${firmId}`);
    
    // Try firm-scoped key first
    let company = await kv.get(`firm:${firmId}:company:${id}`);
    
    // Fall back to legacy key for backward compatibility
    if (!company && firmId === 'default-firm-halyl') {
      company = await kv.get(`company:${id}`);
    }
    
    if (!company) {
      console.error(`❌ Company ${id} not found for firm ${firmId}`);
      return c.json({ success: false, error: 'Company not found' }, 404);
    }
    
    console.log(`✅ Found company: ${company.name}`);
    return c.json({ success: true, data: company });
  } catch (error) {
    console.error('Error fetching company:', error);
    return c.json({ success: false, error: 'Failed to fetch company' }, 500);
  }
});

app.post('/api/companies', async (c) => {
  try {
    // Get user's firm_id for data isolation
    const authHeader = c.req.header('Authorization');
    let firmId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          const userData = await kv.get(`user:${user.id}`);
          if (userData) {
            firmId = userData.firm_id;
          }
        }
      } catch (error) {
        console.log('⚠️ Not authenticated, using default firm');
      }
    }
    
    // If no firmId found, use default firm for backward compatibility
    if (!firmId) {
      firmId = 'default-firm-halyl';
    }
    
    console.log(`➕ Creating company for firm: ${firmId}`);
    
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const company = {
      id,
      ...body,
      firm_id: firmId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Create Cloudflare email address
    const emailAddress = await createCloudflareEmailAddress(id, body.name);
    if (emailAddress) {
      company.email = emailAddress;
    }
    
    // Store with firm-scoped key
    await kv.set(`firm:${firmId}:company:${id}`, company);
    console.log(`✅ Company created: ${company.name} (ID: ${id})`);
    
    return c.json({ success: true, data: company }, 201);
  } catch (error) {
    console.error('Error creating company:', error);
    return c.json({ success: false, error: 'Failed to create company' }, 500);
  }
});

app.put('/api/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validate company ID
    if (!id || id === 'undefined' || id === 'null') {
      console.error(`❌ Invalid company ID provided: ${id}`);
      return c.json({ success: false, error: 'Invalid company ID' }, 400);
    }
    
    const body = await c.req.json();
    
    // Get user's firm_id for data isolation
    const authHeader = c.req.header('Authorization');
    let firmId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          const userData = await kv.get(`user:${user.id}`);
          if (userData) {
            firmId = userData.firm_id;
          }
        }
      } catch (error) {
        console.log('⚠️ Not authenticated, using default firm');
      }
    }
    
    // If no firmId found, use default firm for backward compatibility
    if (!firmId) {
      firmId = 'default-firm-halyl';
    }
    
    console.log(`✏️ Updating company ${id} for firm: ${firmId}`);
    
    // Try to find the company with firm-scoped key first
    let existing = await kv.get(`firm:${firmId}:company:${id}`);
    let keyToUse = `firm:${firmId}:company:${id}`;
    
    // Fall back to legacy key for backward compatibility
    if (!existing && firmId === 'default-firm-halyl') {
      existing = await kv.get(`company:${id}`);
      if (existing) {
        keyToUse = `company:${id}`;
      }
    }
    
    if (!existing) {
      console.error(`❌ Company ${id} not found for firm ${firmId}`);
      return c.json({ success: false, error: 'Company not found' }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    
    // Update Cloudflare email address if name changes
    if (existing.name !== body.name) {
      const newEmailAddress = await createCloudflareEmailAddress(id, body.name);
      if (newEmailAddress) {
        updated.email = newEmailAddress;
      }
    }
    
    await kv.set(keyToUse, updated);
    console.log(`✅ Company updated: ${updated.name}`);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating company:', error);
    return c.json({ success: false, error: 'Failed to update company' }, 500);
  }
});

app.delete('/api/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validate company ID
    if (!id || id === 'undefined' || id === 'null') {
      console.error(`❌ Invalid company ID provided: ${id}`);
      return c.json({ success: false, error: 'Invalid company ID' }, 400);
    }
    
    // Get user's firm_id for data isolation
    const authHeader = c.req.header('Authorization');
    let firmId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          const userData = await kv.get(`user:${user.id}`);
          if (userData) {
            firmId = userData.firm_id;
          }
        }
      } catch (error) {
        console.log('⚠️ Not authenticated, using default firm');
      }
    }
    
    // If no firmId found, use default firm for backward compatibility
    if (!firmId) {
      firmId = 'default-firm-halyl';
    }
    
    console.log(`🗑️ Deleting company ${id} for firm: ${firmId}`);
    
    // Try to find the company with firm-scoped key first
    let company = await kv.get(`firm:${firmId}:company:${id}`);
    let keyToUse = `firm:${firmId}:company:${id}`;
    
    // Fall back to legacy key for backward compatibility
    if (!company && firmId === 'default-firm-halyl') {
      company = await kv.get(`company:${id}`);
      if (company) {
        keyToUse = `company:${id}`;
      }
    }
    
    if (!company) {
      console.error(`❌ Company ${id} not found for firm ${firmId}`);
      return c.json({ success: false, error: 'Company not found' }, 404);
    }
    
    // Delete Cloudflare email address
    if (company.email) {
      await deleteCloudflareEmailAddress(company.email);
    }
    
    await kv.del(keyToUse);
    console.log(`✅ Company deleted: ${company.name}`);
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
    console.log(`📥 GET /api/companies/${companyId}/invoices`);
    
    // Add pagination to prevent CPU timeout
    const limit = parseInt(c.req.query('limit') || '100'); // Default 100 invoices
    const offset = parseInt(c.req.query('offset') || '0');
    
    console.log(`📊 Fetching invoices with limit=${limit}, offset=${offset}`);
    
    // Use Supabase client directly with pagination instead of getByPrefix
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data, error, count } = await supabase
      .from('kv_store_53c2e113')
      .select('value', { count: 'exact' })
      .like('key', `invoice:${companyId}:%`)
      .range(offset, offset + limit - 1)
      .order('key', { ascending: false }); // Most recent first
    
    if (error) {
      throw new Error(error.message);
    }
    
    const invoices = data?.map((d) => d.value) ?? [];
    
    console.log(`✅ Found ${invoices.length} invoices (total: ${count || 0})`);
    
    return c.json({ 
      success: true, 
      data: invoices,
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    return c.json({ success: false, error: 'Failed to fetch invoices', details: error.message }, 500);
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
    
    // Calculate pending approval count (invoices + receipts with status 'Pending')
    let pendingApprovalCount = 0;
    for (const company of companies) {
      const invoices = await kv.getByPrefix(`invoice:${company.id}:`);
      const receipts = await kv.getByPrefix(`receipt:${company.id}:`);
      
      const pendingInvoices = invoices.filter((inv: any) => inv.status === 'Pending').length;
      const pendingReceipts = receipts.filter((rec: any) => rec.status === 'Pending').length;
      
      pendingApprovalCount += pendingInvoices + pendingReceipts;
    }
    
    const metrics = {
      activeCompanies: activeCompanies.length,
      documentsThisMonth,
      hoursSaved,
      aiUsageCost,
      pendingApprovalCount,
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
    const extractedReceipts = [];
    
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
      
      // If it's a PDF or image, classify and extract data
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        console.log('🔍 Classifying document:', file.name, 'Type:', file.type);
        
        try {
          // STEP 1: Classify document as invoice or receipt
          const classification = await classifyDocument(fileBuffer, file.type, file.name);
          console.log(`🏷️ Document classified as: ${classification.type} (${classification.confidence * 100}% confidence)`);
          console.log(`   Reasoning: ${classification.reasoning}`);
          
          const emailMetadata = {
            emailId,
            emailFrom: from,
            emailSubject: subject,
          };
          
          // STEP 2: Extract data based on classification
          if (classification.type === 'receipt') {
            const receipt = await extractReceiptData(
              fileBuffer,
              file.type,
              file.name,
              signedUrlData.signedUrl,
              companyId,
              emailMetadata,
              filePath
            );
            
            if (receipt) {
              extractedReceipts.push(receipt);
              console.log('✅ Receipt extracted:', receipt.merchant, '-', receipt.total, receipt.currency || 'EUR');
            }
          } else {
            // Default to invoice
            const invoice = await extractInvoiceData(
              fileBuffer,
              file.type,
              file.name,
              signedUrlData.signedUrl,
              filePath,
              companyId,
              emailMetadata
            );
            
            if (invoice) {
              extractedInvoices.push(invoice);
              console.log('✅ Invoice extracted:', invoice.vendor, '-', invoice.invoiceNumber);
            }
          }
          
        } catch (error) {
          console.error('❌ Error classifying/extracting document:', file.name, error);
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
      extractedReceipts: extractedReceipts.length,
      receivedAt: new Date().toISOString(),
      status: (extractedInvoices.length > 0 || extractedReceipts.length > 0) ? 'Processed' : 'Received',
    };
    
    await kv.set(`email:${companyId}:${emailId}`, email);
    
    console.log(`✅ Email processed. Extracted ${extractedInvoices.length} invoices and ${extractedReceipts.length} receipts from ${processedAttachments.length} attachments`);
    
    return c.json({ 
      success: true, 
      data: {
        email,
        invoices: extractedInvoices,
        receipts: extractedReceipts,
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
    
    // Find company by email address - SEARCH EMAIL-SETTINGS (NOT company.email)
    let companyId = body.companyId || null;
    let documentType: 'receipts' | 'invoices' | null = null;
    
    if (!companyId && to) {
      console.log('🔍 Searching for company by forwarding email address...');
      
      // Search email-settings for matching forwardingEmail
      // Get all email settings across all companies
      const allData = await kv.getByPrefix('company:');
      
      // Filter to only email-settings entries and search for matching email
      for (const entry of allData) {
        // Check if this is an email-settings entry (has forwardingEmail field)
        if (entry && typeof entry === 'object' && entry.forwardingEmail) {
          const toEmailLower = to.toLowerCase();
          
          // Check if the "to" email matches the forwarding email
          if (entry.forwardingEmail?.toLowerCase() === toEmailLower) {
            // Find which company this settings belongs to
            const allCompanies = await kv.getByPrefix('company:');
            for (const potentialCompany of allCompanies) {
              if (potentialCompany && potentialCompany.id) {
                const settingsKey = `company:${potentialCompany.id}:email-settings`;
                const companySettings = await kv.get(settingsKey);
                
                if (companySettings && companySettings.forwardingEmail?.toLowerCase() === toEmailLower) {
                  companyId = potentialCompany.id;
                  // Document type will be determined by AI classification
                  documentType = null;
                  console.log(`✅ Found company by forwarding email: ${potentialCompany.name} (ID: ${companyId})`);
                  console.log(`   Forwarding email: ${entry.forwardingEmail}`);
                  console.log(`   📋 AI will automatically classify as invoice or receipt`);
                  break;
                }
              }
            }
            if (companyId) break;
          }
        }
      }
      
      if (!companyId) {
        console.warn(`⚠️ No company found for forwarding email: ${to}`);
        console.warn(`   Make sure the email exists in a company's email settings.`);
        // Return early - don't process emails for non-existent companies
        return c.json({ 
          success: false, 
          error: `No company found with forwarding email ${to}. The email may not be configured in any company's settings.`,
          message: 'Email not processed - company not found'
        }, 404);
      }
    }
    
    console.log('  Company ID:', companyId);
    console.log('  Document Type:', documentType || 'Will be classified by AI');
    
    // Verify company exists
    const company = await kv.get(`company:${companyId}`);
    if (!company) {
      console.error(`❌ Company ${companyId} not found`);
      return c.json({ 
        success: false, 
        error: `Company ${companyId} not found`,
        message: 'Email not processed - company not found'
      }, 404);
    }
    
    console.log(`✅ Found company: ${company.name}`);
    
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
    const extractedReceipts: any[] = [];
    
    for (const attachment of attachments) {
      const fileName = attachment.filename || 'attachment.pdf';
      const fileType = attachment.contentType || 'application/pdf';
      const fileContent = attachment.content; // Base64 encoded content from Cloudflare
      
      console.log(`📄 Processing attachment: ${fileName} (${fileType})`);
      
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
        
        // STEP 1: Classify document type
        const classification = await classifyDocument(fileBuffer, fileType, fileName);
        console.log(`🏷️ Document classified as: ${classification.type} (${classification.confidence * 100}% confidence)`);
        
        const emailMetadata = {
          emailId,
          emailFrom: from,
          emailSubject: subject,
        };
        
        // STEP 2: Extract data based on classification
        if (classification.type === 'receipt') {
          const receipt = await extractReceiptData(
            fileBuffer,
            fileType,
            fileName,
            fileUrl,
            companyId,
            emailMetadata,
            filePath
          );
          
          if (receipt) {
            extractedReceipts.push(receipt);
          }
        } else {
          // Default to invoice
          const invoice = await extractInvoiceData(
            fileBuffer,
            fileType,
            fileName,
            fileUrl,
            filePath,
            companyId,
            emailMetadata
          );
          
          if (invoice) {
            extractedInvoices.push(invoice);
          }
        }
        
      } catch (error) {
        console.error('❌ Error processing attachment:', fileName, error);
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
      extractedReceipts: extractedReceipts.length,
      receivedAt: new Date().toISOString(),
      status: (extractedInvoices.length > 0 || extractedReceipts.length > 0) ? 'Processed' : 'Received',
    };
    
    await kv.set(`email:${companyId}:${emailId}`, email);
    
    console.log(`✅ Cloudflare webhook processed successfully`);
    console.log(`   - Attachments: ${processedAttachments.length}`);
    console.log(`   - Invoices extracted: ${extractedInvoices.length}`);
    console.log(`   - Receipts extracted: ${extractedReceipts.length}`);
    
    return c.json({ 
      success: true,
      message: `Processed ${extractedInvoices.length} invoices and ${extractedReceipts.length} receipts from ${processedAttachments.length} attachments`,
      data: {
        emailId,
        invoicesExtracted: extractedInvoices.length,
        receiptsExtracted: extractedReceipts.length,
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