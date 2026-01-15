import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { crypto as cryptoNode } from 'https://deno.land/std@0.224.0/crypto/mod.ts';

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================================================
// QUICKBOOKS API CONFIGURATION
// Set QBO_ENVIRONMENT to 'production' in Supabase secrets to use production API
// Default is 'sandbox' for development mode apps
// ============================================================================
const QBO_ENVIRONMENT = Deno.env.get('QBO_ENVIRONMENT') || 'sandbox';
const QBO_API_BASE_URL = QBO_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

console.log(`🔧 QuickBooks API Environment: ${QBO_ENVIRONMENT} → ${QBO_API_BASE_URL}`);

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface QBOConnection {
  id: string;
  firm_id: string;
  realm_id: string; // QuickBooks company ID
  company_name: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  token_expires_at: string;
  created_at: string;
  last_synced_at?: string;
  sync_status: 'active' | 'error' | 'disconnected';
  error_message?: string;
}

interface XeroConnection {
  id: string;
  firm_id: string;
  tenant_id: string; // Xero organization ID
  tenant_name: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  token_expires_at: string;
  created_at: string;
  last_synced_at?: string;
  sync_status: 'active' | 'error' | 'disconnected';
  error_message?: string;
}

interface SyncState {
  connection_id: string;
  last_cdc_timestamp?: string; // For QuickBooks CDC
  last_sync_timestamp?: string; // For Xero modified-since
  accounts_synced: boolean;
  company_info_synced: boolean;
  vendors_synced: boolean;
  customers_synced: boolean;
  gl_last_sync_date?: string;
}

interface ChartOfAccount {
  id: string;
  connection_id: string;
  qbo_id?: string; // QuickBooks account ID
  xero_id?: string; // Xero account ID
  name: string;
  type: string; // Bank, Expense, Income, Asset, Liability, Equity
  account_number?: string;
  description?: string;
  is_active: boolean;
  balance?: number;
  parent_account_id?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

/**
 * Simple encryption/decryption using AES-GCM
 * NOTE: In production, use a proper key management service
 * For now, we'll derive a key from SUPABASE_SERVICE_ROLE_KEY
 */

async function getEncryptionKey(): Promise<CryptoKey> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Use first 32 bytes of service key hash as encryption key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(serviceKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptToken(token: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(token);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // Combine IV and encrypted data, encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

async function decryptToken(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

// ============================================================================
// AUTHENTICATION HELPER
// ============================================================================

async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ Missing or invalid authorization header');
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('❌ Supabase auth error:', error);
      throw new Error('Invalid authentication token');
    }

    if (!user) {
      console.error('❌ No user found for token');
      throw new Error('User not found');
    }

    console.log(`✅ User authenticated: ${user.id}`);

    // Get user record with firm_id
    const userRecord = await kv.get(`user:${user.id}`);

    if (!userRecord) {
      console.error(`❌ User record not found in KV store for user ${user.id}`);
      throw new Error('User record not found. Please complete signup process.');
    }

    if (!userRecord.firm_id) {
      console.error(`❌ User ${user.id} has no firm_id`);
      throw new Error('User not associated with a firm');
    }

    console.log(`✅ User ${user.id} belongs to firm ${userRecord.firm_id}`);

    return { userId: user.id, firmId: userRecord.firm_id };
  } catch (error: any) {
    console.error('❌ getUserFromToken error:', error);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a proper email address based on company name
 */
function generateCompanyEmail(companyName: string): string {
  // Clean company name: lowercase, remove special chars, limit length
  const cleanName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 30);

  // If empty after cleaning, use a fallback
  if (!cleanName || cleanName === 'unknowncompany') {
    return `company${crypto.randomUUID().substring(0, 8)}@novalare.com`;
  }

  return `${cleanName}@novalare.com`;
}

// ============================================================================
// QUICKBOOKS OAUTH ENDPOINTS
// ============================================================================

/**
 * GET /accounting/health
 * Health check for accounting integration routes
 */
app.get('/accounting/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'Accounting integration routes are working',
    timestamp: new Date().toISOString(),
    callback_route_status: 'GET endpoint active (no auth required)'
  });
});

/**
 * GET /accounting/qbo/callback-test
 * Test endpoint to verify routing works
 */
app.get('/accounting/qbo/callback-test', (c) => {
  return c.json({
    status: 'success',
    message: 'Callback test route is working - GET method, no auth required',
    timestamp: new Date().toISOString(),
    query_params: Object.fromEntries(c.req.url.searchParams || [])
  });
});

/**
 * GET /accounting/qbo/auth-url
 * Returns the QuickBooks OAuth authorization URL
 */
app.get('/accounting/qbo/auth-url', async (c) => {
  try {
    const { userId, firmId } = await getUserFromToken(c.req.header('Authorization'));

    console.log(`🔐 Generating QBO auth URL for firm ${firmId}`);

    const clientId = Deno.env.get('QBO_CLIENT_ID');
    const redirectUri = Deno.env.get('QBO_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      return c.json({
        error: 'QuickBooks OAuth not configured. Please set QBO_CLIENT_ID and QBO_REDIRECT_URI environment variables.'
      }, 500);
    }

    // Generate state parameter to prevent CSRF
    const state = crypto.randomUUID();
    const stateData = {
      firmId,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
    };

    await kv.set(`qbo_oauth_state:${state}`, stateData);

    console.log(`✅ Created OAuth state ${state} - expires at ${stateData.expiresAt}`);

    const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('scope', 'com.intuit.quickbooks.accounting');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);

    return c.json({
      authUrl: authUrl.toString(),
      state
    });
  } catch (error: any) {
    console.error('❌ Error generating QBO auth URL:', error);
    return c.json({ error: error.message }, 401);
  }
});

/**
 * GET /accounting/qbo/callback
 * Handles OAuth callback from QuickBooks
 * Updated: 2024-12-25 - Fixed to handle GET with query params (no auth required)
 */
app.get('/accounting/qbo/callback', async (c) => {
  try {
    console.log('🔵 OAuth callback route hit - timestamp:', new Date().toISOString());
    console.log('🔍 Query params:', Object.fromEntries(c.req.url.searchParams || []));
    console.log('🔍 Full URL:', c.req.url);

    // Get parameters from URL query string (not body)
    const code = c.req.query('code');
    const realmId = c.req.query('realmId');
    const state = c.req.query('state');
    const error = c.req.query('error');

    console.log(`📥 QBO OAuth callback - realmId: ${realmId}, state: ${state}, code: ${code ? 'present' : 'missing'}, error: ${error || 'none'}`);

    // Check for OAuth error
    if (error) {
      console.error(`❌ OAuth error: ${error}`);
      // Redirect to frontend with error
      return c.html(`
        <html>
          <head><title>QuickBooks Connection Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'qbo-oauth-error', 
                error: '${error}' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    if (!code || !realmId || !state) {
      console.error('❌ Missing required OAuth parameters');
      return c.html(`
        <html>
          <head><title>QuickBooks Connection Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'qbo-oauth-error', 
                error: 'Missing required parameters' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    // Verify state parameter
    const stateData = await kv.get(`qbo_oauth_state:${state}`);
    if (!stateData) {
      console.error('❌ Invalid or expired OAuth state');
      return c.html(`
        <html>
          <head><title>QuickBooks Connection Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'qbo-oauth-error', 
                error: 'Invalid or expired OAuth state. Please try connecting again.' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    // Check if state has expired
    const now = new Date();
    const expiresAt = new Date(stateData.expiresAt);
    if (now > expiresAt) {
      console.error(`❌ OAuth state expired. Created at ${stateData.createdAt}, expired at ${stateData.expiresAt}, now is ${now.toISOString()}`);
      await kv.del(`qbo_oauth_state:${state}`); // Clean up expired state
      return c.html(`
        <html>
          <head><title>QuickBooks Connection Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'qbo-oauth-error', 
                error: 'OAuth session expired (timeout after 15 minutes). Please try connecting again.' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    console.log(`✅ OAuth state valid - created at ${stateData.createdAt}, expires at ${stateData.expiresAt}`);

    const { firmId, userId } = stateData;
    await kv.del(`qbo_oauth_state:${state}`);

    // Exchange code for tokens
    const clientId = Deno.env.get('QBO_CLIENT_ID');
    const clientSecret = Deno.env.get('QBO_CLIENT_SECRET');
    const redirectUri = Deno.env.get('QBO_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('❌ QuickBooks OAuth not configured');
      return c.html(`
        <html>
          <head><title>QuickBooks Connection Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'qbo-oauth-error', 
                error: 'QuickBooks OAuth not configured' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    console.log('🔄 Exchanging authorization code for tokens...');

    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('❌ QBO token exchange failed:', error);
      return c.html(`
        <html>
          <head><title>QuickBooks Connection Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'qbo-oauth-error', 
                error: 'Failed to exchange authorization code for tokens' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Tokens received successfully');

    // Try to fetch company name from QuickBooks immediately
    // Falls back to 'Unknown Company' if the API call fails (e.g., 403 during authorization propagation)
    let companyName = 'Unknown Company';
    try {
      console.log(`🏢 Attempting to fetch company info for realm ${realmId}...`);

      const companyInfoResponse = await fetch(
        `${QBO_API_BASE_URL}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`,
        {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (companyInfoResponse.ok) {
        const companyData = await companyInfoResponse.json();
        companyName = companyData.CompanyInfo?.CompanyName || 'Unknown Company';
        console.log(`✅ Retrieved company name: ${companyName}`);
      } else {
        console.log(`⚠️ Company info fetch returned ${companyInfoResponse.status} - using fallback name`);
        console.log(`   Note: QuickBooks authorization may take 30-60 seconds to propagate`);
        console.log(`   User can use "Refresh Name" button to update later`);
      }
    } catch (companyInfoError: any) {
      console.log(`⚠️ Company info fetch failed: ${companyInfoError.message} - using fallback name`);
    }


    // Create connection record
    const connectionId = crypto.randomUUID();
    const connection: QBOConnection = {
      id: connectionId,
      firm_id: firmId,
      realm_id: realmId,
      company_name: companyName,
      encrypted_access_token: await encryptToken(tokens.access_token),
      encrypted_refresh_token: await encryptToken(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      created_at: new Date().toISOString(),
      sync_status: 'active'
    };

    // Store connection
    await kv.set(`qbo_connection:${connectionId}`, connection);
    await kv.set(`firm:${firmId}:qbo_connection:${realmId}`, connectionId);

    // Add to firm's connections list
    const existingConnections = await kv.get(`firm:${firmId}:accounting_connections`) || [];
    existingConnections.push({
      id: connectionId,
      type: 'quickbooks',
      realm_id: realmId,
      company_name: companyName,
      connected_at: connection.created_at
    });
    await kv.set(`firm:${firmId}:accounting_connections`, existingConnections);

    // Initialize sync state
    const syncState: SyncState = {
      connection_id: connectionId,
      accounts_synced: false,
      company_info_synced: false,
      vendors_synced: false,
      customers_synced: false
    };
    await kv.set(`sync_state:${connectionId}`, syncState);

    console.log(`✅ QuickBooks connection created: ${connectionId} for firm ${firmId}`);

    // ✅ AUTO-CREATE NOVALARE COMPANY
    // When QB is connected, automatically create a company in Novalare
    const companyId = crypto.randomUUID();
    const companyEmail = generateCompanyEmail(companyName);
    const novalareCompany = {
      id: companyId,
      name: companyName,
      email: companyEmail,
      country: 'US', // Default to US, can be updated later
      status: 'Active',
      firm_id: firmId,
      qbo_connection_id: connectionId,
      realm_id: realmId,
      source: 'quickbooks',
      created_at: new Date().toISOString(),
      docsThisMonth: 0,
      lastActivity: 'Just now'
    };

    console.log(`📧 Generated email for company: ${companyEmail}`);

    // Store company with firm-scoped key (IMPORTANT: matches GET /api/companies lookup pattern)
    await kv.set(`firm:${firmId}:company:${companyId}`, novalareCompany);

    // Add to firm's companies list
    const firmCompanies = await kv.get(`firm:${firmId}:companies`) || [];
    firmCompanies.push({
      id: companyId,
      name: companyName,
      source: 'quickbooks',
      qbo_connection_id: connectionId,
      created_at: novalareCompany.created_at
    });
    await kv.set(`firm:${firmId}:companies`, firmCompanies);

    console.log(`✅ Novalare company auto-created: ${companyId} for QuickBooks company "${companyName}"`);

    // Return HTML that closes the popup and notifies parent window
    return c.html(`
      <html>
        <head><title>QuickBooks Connected</title></head>
        <body>
          <script>
            window.opener?.postMessage({ 
              type: 'qbo-oauth-success', 
              connection: {
                id: '${connectionId}',
                company_name: '${companyName.replace(/'/g, "\\'")}',
                realm_id: '${realmId}',
                type: 'quickbooks'
              }
            }, '*');
            window.close();
          </script>
          <p>QuickBooks connected successfully! This window should close automatically...</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('❌ QBO callback error:', error);
    return c.html(`
      <html>
        <head><title>QuickBooks Connection Failed</title></head>
        <body>
          <script>
            window.opener?.postMessage({ 
              type: 'qbo-oauth-error', 
              error: '${error.message.replace(/'/g, "\\'")}' 
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * GET /accounting/connections
 * List all accounting system connections for the firm
 */
app.get('/accounting/connections', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));

    console.log(`📋 Fetching accounting connections for firm ${firmId}`);

    const connections = await kv.get(`firm:${firmId}:accounting_connections`) || [];

    // Enrich with sync status
    const enrichedConnections = await Promise.all(
      connections.map(async (conn: any) => {
        const fullConnection = await kv.get(`qbo_connection:${conn.id}`) || await kv.get(`xero_connection:${conn.id}`);
        const syncState = await kv.get(`sync_state:${conn.id}`);

        return {
          ...conn,
          sync_status: fullConnection?.sync_status || 'unknown',
          last_synced_at: fullConnection?.last_synced_at,
          sync_progress: syncState ? {
            company_info: syncState.company_info_synced,
            accounts: syncState.accounts_synced,
            vendors: syncState.vendors_synced,
            customers: syncState.customers_synced
          } : null
        };
      })
    );

    return c.json({ connections: enrichedConnections });
  } catch (error: any) {
    console.error('❌ Error fetching connections:', error);
    return c.json({ error: error.message }, 401);
  }
});

/**
 * DELETE /accounting/connections/:connectionId
 * Disconnect an accounting system
 */
app.delete('/accounting/connections/:connectionId', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');

    console.log(`🗑️ Disconnecting accounting connection ${connectionId}`);

    // Get connection to verify ownership
    const connection = await kv.get(`qbo_connection:${connectionId}`) || await kv.get(`xero_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      return c.json({ error: 'Connection not found or unauthorized' }, 404);
    }

    // Delete connection data
    await kv.del(`qbo_connection:${connectionId}`);
    await kv.del(`xero_connection:${connectionId}`);
    await kv.del(`sync_state:${connectionId}`);

    if (connection.realm_id) {
      await kv.del(`firm:${firmId}:qbo_connection:${connection.realm_id}`);
    }
    if (connection.tenant_id) {
      await kv.del(`firm:${firmId}:xero_connection:${connection.tenant_id}`);
    }

    // Remove from firm's connections list
    const connections = await kv.get(`firm:${firmId}:accounting_connections`) || [];
    const updated = connections.filter((c: any) => c.id !== connectionId);
    await kv.set(`firm:${firmId}:accounting_connections`, updated);

    console.log(`✅ Connection ${connectionId} disconnected`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error disconnecting:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * PATCH /accounting/connections/:connectionId/refresh-company-name
 * Refresh company name for a connection (useful for "Unknown Company" entries)
 */
app.patch('/accounting/connections/:connectionId/refresh-company-name', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');

    console.log(`🔄 Refreshing company name for connection ${connectionId}`);

    // Get connection to verify ownership
    let connection = await kv.get(`qbo_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      return c.json({ error: 'Connection not found or unauthorized' }, 404);
    }

    // Refresh token if needed
    connection = await refreshQBOToken(connection);
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Fetch company info with timeout
    let companyName = connection.company_name;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Company info fetch timed out after 10 seconds')), 10000)
      );

      const fetchPromise = fetch(
        `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/companyinfo/${connection.realm_id}?minorversion=65`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      const companyInfoResponse = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      if (companyInfoResponse.ok) {
        const companyData = await companyInfoResponse.json();
        companyName = companyData.CompanyInfo?.CompanyName || companyName;
        console.log(`✅ Company name refreshed: ${companyName}`);
      } else {
        const errorText = await companyInfoResponse.text();
        console.error(`⚠️ Company info fetch failed with status ${companyInfoResponse.status}:`, errorText);

        // Parse error details
        if (companyInfoResponse.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            const errorCode = errorData.fault?.error?.[0]?.code;

            if (errorCode === '3100') {
              console.error('   ❌ QuickBooks authorization still propagating or invalid');
              console.error('   💡 This usually resolves within 60 seconds of connecting');
              console.error('   💡 Wait 30-60 seconds after connecting before syncing data');
              console.error('');
              console.error('   🔍 TROUBLESHOOTING PERSISTENT 403 ERRORS:');
              console.error('   1. Check if your QuickBooks app is in the correct environment:');
              console.error('      - Sandbox app can only access Sandbox companies');
              console.error('      - Production app can only access Production companies');
              console.error('   2. Verify OAuth scopes include "com.intuit.quickbooks.accounting"');
              console.error('   3. Ensure the company you connected matches the app environment');
              console.error('   4. Try disconnecting and reconnecting with the correct company');
              console.error('');
              return c.json({
                error: 'QuickBooks authorization is still processing. Please wait 30-60 seconds after connecting and try again.'
              }, 403);
            }
          } catch (parseError) {
            // Couldn't parse error, fall through to generic message
          }
        }

        return c.json({ error: `Failed to fetch company name from QuickBooks (HTTP ${companyInfoResponse.status})` }, 500);
      }
    } catch (error: any) {
      console.error(`⚠️ Error fetching company info:`, error.message);
      return c.json({ error: error.message }, 500);
    }

    // Update connection with new company name
    connection.company_name = companyName;
    await kv.set(`qbo_connection:${connectionId}`, connection);

    // Update in firm's connections list
    const connections = await kv.get(`firm:${firmId}:accounting_connections`) || [];
    const updatedConnections = connections.map((c: any) =>
      c.id === connectionId ? { ...c, company_name: companyName } : c
    );
    await kv.set(`firm:${firmId}:accounting_connections`, updatedConnections);

    // 🆕 UPDATE NOVALARE COMPANY RECORD
    // Find and update the Novalare company linked to this QB connection
    const firmCompanies = await kv.get(`firm:${firmId}:companies`) || [];
    const linkedCompanyRef = firmCompanies.find((c: any) => c.qbo_connection_id === connectionId);

    if (linkedCompanyRef) {
      const novalareCompany = await kv.get(`company:${linkedCompanyRef.id}`);
      if (novalareCompany) {
        // Update company name and email
        novalareCompany.name = companyName;
        novalareCompany.email = generateCompanyEmail(companyName);
        novalareCompany.lastActivity = new Date().toISOString();

        await kv.set(`company:${linkedCompanyRef.id}`, novalareCompany);
        console.log(`✅ Updated Novalare company ${linkedCompanyRef.id} with name: ${companyName} and email: ${novalareCompany.email}`);

        // Update in firm's companies list too
        const updatedFirmCompanies = firmCompanies.map((c: any) =>
          c.id === linkedCompanyRef.id ? { ...c, name: companyName } : c
        );
        await kv.set(`firm:${firmId}:companies`, updatedFirmCompanies);
      }
    }

    console.log(`✅ Company name updated to: ${companyName}`);

    return c.json({
      success: true,
      company_name: companyName
    });
  } catch (error: any) {
    console.error('❌ Error refreshing company name:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// TOKEN REFRESH MIDDLEWARE
// ============================================================================

/**
 * Refresh QBO access token if expired
 */
async function refreshQBOToken(connection: QBOConnection): Promise<QBOConnection> {
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();

  // Refresh if token expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection; // Token still valid
  }

  console.log(`🔄 Refreshing QBO token for connection ${connection.id}`);

  const clientId = Deno.env.get('QBO_CLIENT_ID');
  const clientSecret = Deno.env.get('QBO_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks OAuth not configured');
  }

  const refreshToken = await decryptToken(connection.encrypted_refresh_token);

  const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('❌ QBO token refresh failed:', error);

    // Mark connection as error
    connection.sync_status = 'error';
    connection.error_message = 'Token refresh failed - please reconnect';
    await kv.set(`qbo_connection:${connection.id}`, connection);

    throw new Error('Failed to refresh token');
  }

  const tokens = await tokenResponse.json();

  // Update connection with new tokens
  connection.encrypted_access_token = await encryptToken(tokens.access_token);
  connection.encrypted_refresh_token = await encryptToken(tokens.refresh_token);
  connection.token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  connection.sync_status = 'active';
  connection.error_message = undefined;

  await kv.set(`qbo_connection:${connection.id}`, connection);

  console.log(`✅ QBO token refreshed for connection ${connection.id}`);

  return connection;
}

// ============================================================================
// INITIAL SYNC ENDPOINTS (PULL-ONLY)
// ============================================================================

/**
 * POST /accounting/sync/:connectionId/company-info
 * Pull company information from QuickBooks
 */
app.post('/accounting/sync/:connectionId/company-info', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');

    console.log(`🏢 Syncing company info for connection ${connectionId}`);

    let connection = await kv.get(`qbo_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      return c.json({ error: 'Connection not found' }, 404);
    }

    // Refresh token if needed
    connection = await refreshQBOToken(connection);
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Fetch company info
    const response = await fetch(
      `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/companyinfo/${connection.realm_id}?minorversion=65`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.status}`);
    }

    const data = await response.json();
    const companyInfo = data.CompanyInfo;

    // Store company info
    await kv.set(`connection:${connectionId}:company_info`, {
      company_name: companyInfo.CompanyName,
      legal_name: companyInfo.LegalName,
      country: companyInfo.Country,
      fiscal_year_start: companyInfo.FiscalYearStartMonth,
      created_at: new Date().toISOString()
    });

    // Update sync state
    const syncState = await kv.get(`sync_state:${connectionId}`);
    syncState.company_info_synced = true;
    await kv.set(`sync_state:${connectionId}`, syncState);

    console.log(`✅ Company info synced for ${companyInfo.CompanyName}`);

    return c.json({
      success: true,
      company_info: {
        company_name: companyInfo.CompanyName,
        country: companyInfo.Country
      }
    });
  } catch (error: any) {
    console.error('❌ Company info sync error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /accounting/sync/:connectionId/accounts
 * Pull chart of accounts from QuickBooks
 */
app.post('/accounting/sync/:connectionId/accounts', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');

    console.log(`📊 Syncing chart of accounts for connection ${connectionId}`);

    let connection = await kv.get(`qbo_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      return c.json({ error: 'Connection not found' }, 404);
    }

    // Refresh token if needed
    connection = await refreshQBOToken(connection);
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Fetch all accounts
    const response = await fetch(
      `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/query?query=SELECT * FROM Account MAXRESULTS 1000&minorversion=65`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ QuickBooks API error ${response.status}:`, errorText);
      console.error(`   Realm ID: ${connection.realm_id}`);
      console.error(`   Token expires at: ${connection.token_expires_at}`);

      // Parse error details if available
      if (response.status === 403) {
        try {
          const errorData = JSON.parse(errorText);
          const errorCode = errorData.fault?.error?.[0]?.code;

          if (errorCode === '3100') {
            console.error('   ❌ QuickBooks authorization still propagating or invalid');
            console.error('   💡 This usually resolves within 60 seconds of connecting');
            console.error('   💡 Wait 30-60 seconds after connecting before syncing data');
            console.error('');
            console.error('   🔍 TROUBLESHOOTING PERSISTENT 403 ERRORS:');
            console.error('   1. Check if your QuickBooks app is in the correct environment:');
            console.error('      - Sandbox app can only access Sandbox companies');
            console.error('      - Production app can only access Production companies');
            console.error('   2. Verify OAuth scopes include "com.intuit.quickbooks.accounting"');
            console.error('   3. Ensure the company you connected matches the app environment');
            console.error('   4. Try disconnecting and reconnecting with the correct company');
            console.error('');
            return c.json({
              error: 'QuickBooks authorization is still processing. Please wait 30-60 seconds after connecting and try again.'
            }, 403);
          }
        } catch (parseError) {
          // Couldn't parse error, fall through
        }
      }

      try {
        const errorData = JSON.parse(errorText);
        throw new Error(`QuickBooks API error ${response.status}: ${errorData.Fault?.Error?.[0]?.Message || errorText}`);
      } catch {
        throw new Error(`QuickBooks API error ${response.status}: ${errorText}`);
      }
    }

    const data = await response.json();
    const accounts = data.QueryResponse?.Account || [];

    console.log(`📥 Retrieved ${accounts.length} accounts from QuickBooks`);

    // Transform and store accounts
    const transformedAccounts: ChartOfAccount[] = accounts.map((acc: any) => ({
      id: crypto.randomUUID(),
      connection_id: connectionId,
      qbo_id: acc.Id,
      name: acc.Name,
      type: acc.AccountType,
      account_number: acc.AcctNum,
      description: acc.Description,
      is_active: acc.Active,
      balance: acc.CurrentBalance,
      parent_account_id: acc.ParentRef?.value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Store accounts in connection-specific location (for QB sync endpoint)
    await kv.set(`connection:${connectionId}:accounts`, transformedAccounts);

    // 🆕 ALSO STORE IN COMPANY COA (for Chart of Accounts page)
    // Find the Novalare company linked to this connection
    const firmCompanies = await kv.get(`firm:${firmId}:companies`) || [];
    const linkedCompanyRef = firmCompanies.find((c: any) => c.qbo_connection_id === connectionId);

    if (linkedCompanyRef) {
      // Transform to COA format (simpler schema for Chart of Accounts page)
      const coaAccounts = accounts.map((acc: any) => ({
        code: acc.AcctNum || acc.Id,
        name: acc.Name,
        type: acc.AccountType,
        subtype: acc.AccountSubType || '',
        description: acc.Description || '',
        isActive: acc.Active !== false,
        qbo_id: acc.Id,  // Keep reference to QB account
        balance: acc.CurrentBalance
      }));

      await kv.set(`company_coa_${linkedCompanyRef.id}`, { accounts: coaAccounts });
      console.log(`✅ Synced ${coaAccounts.length} accounts to company ${linkedCompanyRef.id} COA`);
    } else {
      console.warn(`⚠️ No company found linked to connection ${connectionId}`);
    }

    // Update sync state
    const syncState = await kv.get(`sync_state:${connectionId}`);
    syncState.accounts_synced = true;
    await kv.set(`sync_state:${connectionId}`, syncState);

    console.log(`✅ ${transformedAccounts.length} accounts synced`);

    return c.json({
      success: true,
      accounts_count: transformedAccounts.length,
      accounts: transformedAccounts
    });
  } catch (error: any) {
    console.error('❌ Accounts sync error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /accounting/sync/:connectionId/bank-transactions
 * Pull transactions for a specific bank account using TransactionList Report API
 * This captures ALL transactions including bank-feed-derived ones that GeneralLedger Report misses
 */
app.post('/accounting/sync/:connectionId/bank-transactions', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');
    const { account_id, start_date, end_date } = await c.req.json();

    console.log('════════════════════════════════════════════════════════════');
    console.log('🏦 BANK TRANSACTION LIST REPORT SYNC REQUEST');
    console.log(`   Connection ID: ${connectionId}`);
    console.log(`   Account ID: "${account_id}"`);
    console.log(`   Date Range: ${start_date} to ${end_date}`);
    console.log('════════════════════════════════════════════════════════════');

    let connection = await kv.get(`qbo_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      console.log('❌ Connection not found or firm mismatch');
      return c.json({ error: 'Connection not found' }, 404);
    }

    // Refresh token if needed
    connection = await refreshQBOToken(connection);
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Use TransactionList Report API - this returns ALL transactions including bank-feed-derived ones
    // Unlike the Transaction Query which doesn't support AccountRef filtering
    const params = new URLSearchParams({
      start_date,
      end_date,
      account: account_id.toString(),  // TransactionList uses 'account' parameter
      minorversion: '65'
    });

    console.log(`🔍 Fetching TransactionList report for account ${account_id}...`);

    const response = await fetch(
      `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/reports/TransactionList?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ TransactionList Report API error ${response.status}:`, errorText);
      throw new Error(`QuickBooks API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse TransactionList report - structure is different from GeneralLedger
    const columns = data.Columns?.Column || [];
    const rows = data.Rows?.Row || [];

    console.log(`📊 TransactionList has ${columns.length} columns and ${rows.length} top-level rows`);

    // Build column index map using ColTitle (more reliable than ColType for TransactionList)
    const columnMap: Record<string, number> = {};
    columns.forEach((col: any, idx: number) => {
      // Use ColTitle as primary, normalize to lowercase for consistent matching
      const title = (col.ColTitle || col.ColType || '').toLowerCase().trim();
      columnMap[title] = idx;
      // Also log each column for debugging
      console.log(`   Column [${idx}]: "${col.ColTitle || col.ColType}" => "${title}"`);
    });

    console.log('📋 Full column map:', JSON.stringify(columnMap));

    // Parse helper for amounts
    const parseAmount = (str: string | number): number => {
      if (typeof str === 'number') return str;
      if (!str) return 0;
      const isNegative = str.includes('(') || str.includes('-');
      const numeric = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
      return isNegative ? -numeric : numeric;
    };

    // Helper to get value from cols using column name variations
    const getValue = (cols: any[], ...keys: string[]): string => {
      for (const key of keys) {
        const idx = columnMap[key.toLowerCase()];
        if (idx !== undefined && cols[idx]?.value) {
          return cols[idx].value;
        }
      }
      return '';
    };

    // Extract transactions from report rows
    const ledgerEntries: any[] = [];
    let processedRows = 0;
    let skippedRows = 0;
    let zeroAmountRows = 0;

    const extractTransactions = (rowArray: any[]) => {
      if (!Array.isArray(rowArray)) rowArray = [rowArray];

      rowArray.forEach((row: any, idx: number) => {
        if (row.type === 'Data' && row.ColData) {
          processedRows++;
          const cols = row.ColData;

          // Get values using flexible column name matching
          const date = getValue(cols, 'date', 'tx date', 'txn date', 'transaction date') || cols[0]?.value || '';
          const txnType = getValue(cols, 'transaction type', 'type', 'txn type', 'txn_type') || cols[1]?.value || '';
          const num = getValue(cols, 'num', 'no.', 'doc number', 'doc_num', 'ref no.');
          const name = getValue(cols, 'name', 'customer/vendor', 'payee');
          const memo = getValue(cols, 'memo', 'memo/description', 'description');
          // 'split' is the offset/contra account (column 7), 'account' is the main account (column 6)
          const splitAcct = getValue(cols, 'split');
          const account = getValue(cols, 'account');

          // Amount handling - try 'amount', then 'debit'/'credit'
          let amount = 0;
          const amountStr = getValue(cols, 'amount', 'total', 'amt');
          if (amountStr) {
            amount = parseAmount(amountStr);
          } else {
            const debit = parseAmount(getValue(cols, 'debit'));
            const credit = parseAmount(getValue(cols, 'credit'));
            amount = debit - credit;
          }

          // Skip balance/total rows AND zero-amount rows (like Opening Inventory)
          if (txnType.toLowerCase().includes('balance') ||
            txnType.toLowerCase().includes('total') ||
            (date === '' && amount === 0) ||
            amount === 0) {
            skippedRows++;
            // Log skipped zero amount rows (optional, but good for summary stats)
            if (amount === 0) zeroAmountRows++;
            return;
          }

          ledgerEntries.push({
            id: `qbo-txl-${cols[0]?.id || processedRows}`,
            date,
            type: 'transaction',
            txn_type: txnType,
            num,
            name,
            // For bank registers: use name (payee) as primary, memo as fallback
            description: name || memo || txnType || 'Unknown Transaction',
            amount,
            balance: 0,
            // Use split column (column 7) for the offset/contra account
            split_account: splitAcct || '',
            // Populate 'account' for frontend compatibility (displays in 'Split' column)
            account: splitAcct || '',
            source: 'qbo_transaction_list'
          });
        }

        // Recurse into nested rows
        if (row.Rows?.Row) {
          extractTransactions(row.Rows.Row);
        }
      });
    };

    extractTransactions(rows);

    console.log(`📊 TransactionList Extraction Summary:`);
    console.log(`   - Processed rows: ${processedRows}`);
    console.log(`   - Zero amount rows: ${zeroAmountRows}`);
    console.log(`   - Skipped rows: ${skippedRows}`);
    console.log(`   - Extracted entries: ${ledgerEntries.length}`);

    // Sort by date
    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Store entries with same key format as gl-report for compatibility
    const glKey = `connection:${connectionId}:gl:${account_id}:${start_date}_${end_date}`;
    await kv.set(glKey, {
      account_id,
      start_date,
      end_date,
      entries: ledgerEntries,
      fetched_at: new Date().toISOString(),
      source: 'transaction_list_report'
    });

    return c.json({
      success: true,
      entry_count: ledgerEntries.length,
      entries: ledgerEntries,
      source: 'transaction_list_report'
    });

  } catch (error: any) {
    console.error('❌ Bank transaction sync error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /accounting/sync/:connectionId/gl-report
 * Pull General Ledger report for a specific account (for bank reconciliation)
 * UPDATED: Uses TransactionList report API for reliable account-specific data
 */
app.post('/accounting/sync/:connectionId/gl-report', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');
    const { account_id, start_date, end_date } = await c.req.json();

    console.log('════════════════════════════════════════════════════════════');
    console.log('📑 GL SYNC REQUEST RECEIVED');
    console.log(`   Connection ID: ${connectionId}`);
    console.log(`   Account ID: "${account_id}" (type: ${typeof account_id})`);
    console.log(`   Date Range: ${start_date} to ${end_date}`);
    console.log(`   QBO Environment: ${QBO_ENVIRONMENT}`);
    console.log(`   API Base URL: ${QBO_API_BASE_URL}`);
    console.log('════════════════════════════════════════════════════════════');

    let connection = await kv.get(`qbo_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      console.log('❌ Connection not found or firm mismatch');
      return c.json({ error: 'Connection not found' }, 404);
    }

    console.log(`   Realm ID: ${connection.realm_id}`);
    console.log(`   Company: ${connection.company_name}`);

    // Refresh token if needed
    connection = await refreshQBOToken(connection);
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // 🔥 Switch to GeneralLedger report which ALWAYS returns both debit and credit columns
    // TransactionList only returns whichever column has data, causing parsing issues
    const params = new URLSearchParams({
      start_date,
      end_date,
      account_list: account_id,  // Note: param name is account_list for GeneralLedger
      minorversion: '65'
    });

    console.log(`🔍 Fetching GeneralLedger report for account ${account_id}...`);

    const response = await fetch(
      `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/reports/GeneralLedger?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ GeneralLedger API error ${response.status}:`, errorText);
      throw new Error(`QuickBooks API error: ${response.status}`);
    }

    const reportData = await response.json();
    console.log('📊 GeneralLedger response:', JSON.stringify(reportData, null, 2));

    // Parse GeneralLedger report
    const ledgerEntries: any[] = [];
    const rows = reportData.Rows?.Row || [];

    // 🔥 DYNAMICALLY DETECT COLUMN POSITIONS from the API response
    const columns = reportData.Columns?.Column || [];
    const columnMap: any = {};
    columns.forEach((col: any, index: number) => {
      const colKey = col.MetaData?.find((m: any) => m.Name === 'ColKey')?.Value;
      if (colKey) {
        columnMap[colKey] = index;
      }
    });

    console.log(`🔍 Column mapping:`, columnMap);
    console.log(`🔍 Processing ${rows.length} top-level rows...`);
    console.log(`🎯 Target account ID: "${account_id}" - will only capture entries from this account's section`);

    // 🔥 TRACK WHICH ACCOUNT SECTION WE'RE IN
    // The GeneralLedger report has sections for each account
    // Each section has a Header with the account name and ID
    // We only want entries from the section matching our target account
    // Helper to parse accounting numbers (handles parentheses for negatives)
    const parseAmount = (val: any): number => {
      if (val === null || val === undefined) return 0;
      const str = val.toString();
      const isNegative = str.includes('(') || str.includes('-');
      const numeric = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
      return isNegative ? -numeric : numeric;
    };

    // 🔥 FIXED: Restore account filtering with FLEXIBLE ID matching
    // The QB GeneralLedger report can contain multiple account sections even when account_list is passed
    // We need to filter to only the target account, but be flexible about ID format (string vs number)
    let skippedBalanceRows = 0;
    let skippedARFilterRows = 0;
    let skippedWrongAccountRows = 0;
    let processedDataRows = 0;

    // Normalize account ID for comparison (handles "36" vs 36 vs "36.0" etc)
    const normalizeId = (id: any): string => {
      if (id === null || id === undefined) return '';
      const str = id.toString().trim();
      // Try to parse as number and back to remove leading zeros, decimals, etc
      const num = parseFloat(str);
      return isNaN(num) ? str : num.toString();
    };

    const targetAccountId = normalizeId(account_id);
    console.log(`🎯 Target account ID (normalized): "${targetAccountId}"`);

    // Recursive function to extract transaction data with FLEXIBLE account matching
    const extractTransactions = (rowArray: any[], depth = 0, isInsideTarget = false, sectionAccountName = '') => {
      if (!Array.isArray(rowArray)) {
        rowArray = [rowArray];
      }

      rowArray.forEach((row: any, idx: number) => {
        let currentlyInsideTarget = isInsideTarget;
        let currentAccountName = sectionAccountName;

        // Check for Section headers to track which account we're in
        if (row.type === 'Section' && row.Header?.ColData) {
          const headerData = row.Header.ColData[0];
          const sectionId = normalizeId(headerData?.id);
          currentAccountName = headerData?.value || sectionAccountName;

          // 🔥 FLEXIBLE MATCHING: Compare normalized IDs
          if (sectionId && depth === 0) {
            if (sectionId === targetAccountId) {
              currentlyInsideTarget = true;
              console.log(`✅ MATCHED target account section: "${currentAccountName}" (ID: ${sectionId})`);
            } else {
              currentlyInsideTarget = false;
              console.log(`⏭️ Skipping non-target account section: "${currentAccountName}" (ID: ${sectionId})`);
            }
          }
          // Sub-sections (like customer groupings) inherit parent's target status
        }

        // Look for Data rows (actual transactions)
        if (row.type === 'Data' && row.ColData) {
          // Skip if not in target account section
          if (!currentlyInsideTarget) {
            skippedWrongAccountRows++;
            return;
          }

          processedDataRows++;
          const cols = row.ColData;

          // Get transaction type and name for filtering FIRST
          const nameIdx = columnMap['name'] ?? 3;
          const typeIdx = columnMap['txn_type'] ?? 1;
          const txnType = (cols[typeIdx]?.value || '').toString().toLowerCase();
          const name = (cols[nameIdx]?.value || '').toString().toLowerCase();
          const dateValue = (cols[columnMap['tx_date'] ?? 0]?.value || '').toString().toLowerCase();

          // skip Beginning Balance, Opening Balance, and Total rows
          if (dateValue.includes('beginning') || dateValue.includes('opening') || dateValue.includes('total') ||
            txnType.includes('opening') || txnType.includes('beginning') ||
            txnType.includes('balance') || txnType.includes('total')) {
            skippedBalanceRows++;
            return;
          }

          const lowerAccName = (currentAccountName || '').toLowerCase();
          const isARAccount = lowerAccName.includes('accounts receivable') || lowerAccName.includes('a/r');
          const isAPAccount = lowerAccName.includes('accounts payable') || lowerAccName.includes('a/p');

          // 🔥 STRICT AR FILTERING: Only include Invoices and Credit Memos (AR source of truth)
          // Payments, Refunds, and non-linked Journals are ignored for AR sync as they are matched from bank inflows.
          if (isARAccount) {
            const allowedTypes = ['invoice', 'credit memo', 'creditmemo'];
            if (!allowedTypes.includes(txnType)) {
              skippedARFilterRows++;
              console.log(`⏩ Skipping AR row: ${txnType} (Only Invoices and Credit Memos allowed)`);
              return;
            }
          }

          // 🔥 FIX: Check multiple potential amount columns
          const subtIdx = columnMap['subt_nat_amount'];
          const amtIdx = columnMap['amount'];
          const debIdx = columnMap['debit_amt'];
          const creIdx = columnMap['credit_amt'];

          let amount = 0;
          let amountSource = '';

          if (subtIdx !== undefined && cols[subtIdx]?.value) {
            amount = parseAmount(cols[subtIdx].value);
            amountSource = 'subt_nat_amount';
          } else if (amtIdx !== undefined && cols[amtIdx]?.value) {
            amount = parseAmount(cols[amtIdx].value);
            amountSource = 'amount';
          } else if (debIdx !== undefined || creIdx !== undefined) {
            const d = parseAmount(cols[debIdx]?.value);
            const c = parseAmount(cols[creIdx]?.value);
            // For GL reports: Debit and Credit are separate columns
            // We use Debit - Credit to get the natural balance change
            amount = d - c;  // 🔥 FIXED: Was c - d, now d - c for correct AR signs
            amountSource = 'debit-credit';
          }

          // Special case: zero-amount linking rows (like linking a credit to an invoice)
          // We capture them if they have a date and name, as they appear in the ledger
          if (amount === 0 && !dateValue && !txnType) {
            return;
          }

          // 🔥 DEBUG: Log amount calculation for AR accounts
          if (isARAccount) {
            console.log(`   📊 AR Entry: ${txnType} | Raw amount: ${amount} (from ${amountSource}) | Name: ${cols[nameIdx]?.value || 'N/A'}`);
          }

          // Sign Adjustments for Novalare Reconciliation views
          // 🔥 FIXED: For AR accounts using subt_nat_amount or amount columns,
          // QuickBooks may already return signed values. We need to ensure:
          // - Invoices = POSITIVE (amounts owed TO the company)
          // - Credit Memos = NEGATIVE (reductions to amounts owed)
          if (isARAccount) {
            // For AR: Invoices increase AR (positive), Credit Memos decrease AR (negative)
            // If amount came from d - c:
            //   - Invoices: d > 0, c = 0 → positive ✅
            //   - Credit Memos: d = 0, c > 0 → negative ✅
            // If amount came from subt_nat_amount or amount:
            //   - These are typically the natural account balance change (positive = increase)
            //   - For AR asset account, increase = debit = invoice, so positive is correct
            // No inversion needed after the d-c fix!
          } else if (isAPAccount) {
            // For AP: Bills increase AP (Credit), Payments decrease AP (Debit)
            // d - c gives: Bill (Credit) = Negative, Payment (Debit) = Positive
            // We want: Bills = negative (amounts owed BY the company), Payments = positive
            // This is already correct after d - c calculation!
          }

          const dateIdx = columnMap['tx_date'] ?? 0;
          const numIdx = columnMap['doc_num'] ?? 2;
          const memoIdx = columnMap['memo'] ?? 4;
          const accountIdx = columnMap['account_name'] ?? 5;
          const splitIdx = columnMap['split_acc'] ?? -1;
          const balanceIdx = columnMap['balance'] ?? -1;

          const entry = {
            date: cols[dateIdx]?.value || '',
            transaction_type: cols[typeIdx]?.value || '',
            num: cols[numIdx]?.value || '',
            name: cols[nameIdx]?.value || '',
            memo: cols[memoIdx]?.value || '',
            account: cols[accountIdx]?.value || account_id,
            debit: amount < 0 ? Math.abs(amount) : 0,
            credit: amount > 0 ? amount : 0,
            amount,
            balance: balanceIdx >= 0 ? parseAmount(cols[balanceIdx]?.value) : 0,
            split_account: splitIdx >= 0 ? (cols[splitIdx]?.value || '') : ''
          };

          ledgerEntries.push(entry);
        }

        // Process nested rows - pass currentlyInsideTarget to maintain account context
        if (row.Rows?.Row) {
          extractTransactions(row.Rows.Row, depth + 1, currentlyInsideTarget, currentAccountName);
        }
      });
    };

    extractTransactions(rows);

    // 🔥 Enhanced debug logging to help diagnose entry counts
    console.log(`📊 GL Extraction Summary:`);
    console.log(`   - Total Data rows processed: ${processedDataRows}`);
    console.log(`   - Skipped wrong account rows: ${skippedWrongAccountRows}`);
    console.log(`   - Skipped balance/total rows: ${skippedBalanceRows}`);
    console.log(`   - Skipped AR-filtered rows: ${skippedARFilterRows}`);
    console.log(`✅ Extracted ${ledgerEntries.length} transactions from GeneralLedger report`);

    // Sort by date
    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Store GL entries
    const glKey = `connection:${connectionId}:gl:${account_id}:${start_date}_${end_date}`;
    await kv.set(glKey, {
      account_id,
      start_date,
      end_date,
      entries: ledgerEntries,
      synced_at: new Date().toISOString()
    });

    // Update sync state
    const syncState = await kv.get(`sync_state:${connectionId}`);
    syncState.gl_last_sync_date = new Date().toISOString();
    await kv.set(`sync_state:${connectionId}`, syncState);

    return c.json({
      success: true,
      entries_count: ledgerEntries.length,
      entries: ledgerEntries
    });
  } catch (error: any) {
    console.error('❌ GL report sync error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /accounting/sync/:connectionId/bank-register
 * Pull TRANSACTION-LEVEL bank data (one row per bank transaction)
 * Uses QuickBooks entity queries instead of reports for accurate bank reconciliation
 * Queries: Purchase, Deposit, Transfer, BillPayment, SalesReceipt, RefundReceipt
 */
app.post('/accounting/sync/:connectionId/bank-register', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');
    const { account_id, start_date, end_date } = await c.req.json();

    console.log('════════════════════════════════════════════════════════════');
    console.log('🏦 BANK REGISTER SYNC REQUEST RECEIVED');
    console.log(`   Connection ID: ${connectionId}`);
    console.log(`   Bank Account ID: "${account_id}"`);
    console.log(`   Date Range: ${start_date} to ${end_date}`);
    console.log('════════════════════════════════════════════════════════════');

    let connection = await kv.get(`qbo_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      console.log('❌ Connection not found or firm mismatch');
      return c.json({ error: 'Connection not found' }, 404);
    }

    // Refresh token if needed
    connection = await refreshQBOToken(connection);
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Helper: Execute paginated query for any entity type
    const fetchAllEntities = async (entityName: string, whereClause: string): Promise<any[]> => {
      const allResults: any[] = [];
      let startPosition = 1;
      const maxResults = 1000;

      while (true) {
        const query = `SELECT * FROM ${entityName} WHERE ${whereClause} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
        console.log(`   📡 Query: ${query}`);

        const response = await fetch(
          `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(query)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`   ❌ ${entityName} query error ${response.status}:`, errorText);
          // Don't throw - some entities might not exist, just return empty
          break;
        }

        const data = await response.json();
        const entities = data.QueryResponse?.[entityName] || [];
        allResults.push(...entities);

        console.log(`   ✅ Fetched ${entities.length} ${entityName} (total: ${allResults.length})`);

        if (entities.length < maxResults) break;
        startPosition += maxResults;
      }

      return allResults;
    };

    // Normalize account ID for comparison
    // The frontend may send either the account NUMBER (like "1150040001") or the QBO internal ID (like "35")
    // QBO entities use internal ID in AccountRef.value, so we need to translate if needed
    let bankIdStr = String(account_id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 ACCOUNT LOOKUP: Raw account_id = "${account_id}"`);

    // Look up the stored accounts to find the correct QBO internal ID
    const storedAccounts = await kv.get(`connection:${connectionId}:accounts`) || [];
    console.log(`   Stored accounts count: ${storedAccounts.length}`);

    // Try to find the account - could match by qbo_id, account_number, or id
    const matchedAccount = storedAccounts.find((acc: any) =>
      String(acc.qbo_id) === bankIdStr ||
      String(acc.account_number) === bankIdStr ||
      String(acc.id) === bankIdStr
    );

    if (matchedAccount) {
      // Use the QBO internal ID for filtering
      const qboInternalId = matchedAccount.qbo_id;
      console.log(`   ✅ FOUND in stored accounts: "${matchedAccount.name}"`);
      console.log(`      Account Number: ${matchedAccount.account_number}`);
      console.log(`      QBO ID: ${qboInternalId}`);
      bankIdStr = String(qboInternalId);
    } else {
      console.log(`   ⚠️ NOT FOUND in stored accounts`);

      // Log sample stored accounts for debugging
      if (storedAccounts.length > 0) {
        console.log(`   Sample stored accounts:`);
        storedAccounts.slice(0, 5).forEach((a: any) => {
          console.log(`      - ${a.name} | num: ${a.account_number} | qbo_id: ${a.qbo_id}`);
        });
      }

      // FALLBACK: Query QBO API directly for this account
      console.log(`   🔄 Attempting direct QBO API lookup...`);
      try {
        // Try to find account by AcctNum (account number)
        const accountQuery = `SELECT * FROM Account WHERE AcctNum = '${bankIdStr}'`;
        console.log(`   Query: ${accountQuery}`);

        const accountResponse = await fetch(
          `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(accountQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        );

        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          const foundAccounts = accountData.QueryResponse?.Account || [];
          console.log(`   QBO API returned ${foundAccounts.length} accounts`);

          if (foundAccounts.length > 0) {
            const qboAccount = foundAccounts[0];
            console.log(`   ✅ FOUND via QBO API: "${qboAccount.Name}"`);
            console.log(`      AcctNum: ${qboAccount.AcctNum}`);
            console.log(`      QBO Id: ${qboAccount.Id}`);
            bankIdStr = String(qboAccount.Id);
          } else {
            console.log(`   ❌ No account found with AcctNum = "${bankIdStr}"`);
          }
        } else {
          console.log(`   ❌ QBO API query failed: ${accountResponse.status}`);
        }
      } catch (err) {
        console.log(`   ❌ QBO API lookup error: ${err}`);
      }
    }

    console.log(`   📍 FINAL bankIdStr for filtering: "${bankIdStr}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const dateFilter = `TxnDate >= '${start_date}' AND TxnDate <= '${end_date}'`;

    // Unified transaction type
    interface BankRegisterTransaction {
      id: string;
      date: string;
      type: 'purchase' | 'deposit' | 'transfer' | 'billpayment' | 'salesreceipt' | 'refund' | 'journalentry' | 'vendorcredit' | 'creditmemo';
      txn_type: string;
      ref_number: string;
      payee: string;
      memo: string;
      amount: number;  // Positive = IN, Negative = OUT
      account: string;
      account_details?: string[];
      cleared_status?: 'Cleared' | 'Reconciled' | null;
    }

    const allTransactions: BankRegisterTransaction[] = [];

    // Helper to get account string (handles splits)
    const getAccountString = (lines: any[]): { primary: string; details: string[] } => {
      if (!lines || lines.length === 0) return { primary: 'Unknown', details: [] };

      const accountNames = lines
        .map(l => l.AccountRef?.name || l.DepositToAccountRef?.name || '')
        .filter(n => n);

      if (accountNames.length === 0) return { primary: 'Unknown', details: [] };
      if (accountNames.length === 1) return { primary: accountNames[0], details: accountNames };

      // Find the largest amount line for primary
      let maxLine = lines[0];
      lines.forEach(l => {
        if (Math.abs(l.Amount || 0) > Math.abs(maxLine?.Amount || 0)) {
          maxLine = l;
        }
      });

      return {
        primary: `Split (${accountNames.length} accounts)`,
        details: accountNames
      };
    };

    // 1. PURCHASES (Checks, Expenses, Cash purchases) - Money OUT
    // NOTE: QBO API doesn't support AccountRef filtering in query, so we fetch by date and filter client-side
    console.log('📤 Fetching Purchase transactions...');
    const allPurchases = await fetchAllEntities('Purchase', dateFilter);

    // Debug: Log sample AccountRef values to check format
    if (allPurchases.length > 0) {
      const sampleRefs = allPurchases.slice(0, 5).map(p => ({
        id: p.Id,
        accountRefValue: p.AccountRef?.value,
        accountRefName: p.AccountRef?.name
      }));
      console.log(`   🔍 DEBUG - Bank ID we're looking for: "${bankIdStr}"`);
      console.log(`   🔍 DEBUG - Sample AccountRef values from Purchases:`, JSON.stringify(sampleRefs));
    }

    // Filter to only purchases from this bank account
    const purchases = allPurchases.filter(p => String(p.AccountRef?.value) === bankIdStr);
    console.log(`   Filtered ${allPurchases.length} -> ${purchases.length} matching bank account`);

    purchases.forEach(p => {
      const lines = p.Line || [];
      const expenseLines = lines.filter((l: any) => l.DetailType === 'AccountBasedExpenseLineDetail' || l.DetailType === 'ItemBasedExpenseLineDetail');
      const accountInfo = getAccountString(expenseLines.map((l: any) => ({
        AccountRef: l.AccountBasedExpenseLineDetail?.AccountRef || { name: l.ItemBasedExpenseLineDetail?.ItemRef?.name || 'Item' }
      })));

      allTransactions.push({
        id: `purchase-${p.Id}`,
        date: p.TxnDate || '',
        type: 'purchase',
        txn_type: p.PaymentType === 'Check' ? 'Check' : (p.PaymentType === 'CreditCard' ? 'Expense (CC)' : 'Expense'),
        ref_number: p.DocNumber || '',
        payee: p.EntityRef?.name || '',
        memo: p.PrivateNote || lines[0]?.Description || '',
        amount: -(Math.abs(p.TotalAmt || 0)),  // Always negative (money out)
        account: accountInfo.primary,
        account_details: accountInfo.details,
        cleared_status: p.LinkedTxn?.some((t: any) => t.TxnType === 'ReimburseCharge') ? 'Reconciled' : null
      });
    });

    // 2. DEPOSITS - Money IN
    // NOTE: QBO API doesn't support DepositToAccountRef filtering, fetch all and filter client-side
    console.log('📥 Fetching Deposit transactions...');
    const allDeposits = await fetchAllEntities('Deposit', dateFilter);
    const deposits = allDeposits.filter(d => String(d.DepositToAccountRef?.value) === bankIdStr);
    console.log(`   Filtered ${allDeposits.length} -> ${deposits.length} matching bank account`);

    deposits.forEach(d => {
      const lines = d.Line || [];
      const accountInfo = getAccountString(lines.map((l: any) => ({
        AccountRef: l.DepositLineDetail?.AccountRef || { name: 'Deposit' }
      })));

      allTransactions.push({
        id: `deposit-${d.Id}`,
        date: d.TxnDate || '',
        type: 'deposit',
        txn_type: 'Deposit',
        ref_number: d.DocNumber || '',
        payee: lines[0]?.DepositLineDetail?.Entity?.Name || '',
        memo: d.PrivateNote || lines[0]?.Description || '',
        amount: Math.abs(d.TotalAmt || 0),  // Always positive (money in)
        account: accountInfo.primary,
        account_details: accountInfo.details,
        cleared_status: null
      });
    });

    // 3. TRANSFERS - Can be IN or OUT depending on direction
    // NOTE: QBO API doesn't support FromAccountRef/ToAccountRef filtering, fetch all and filter
    console.log('🔄 Fetching Transfer transactions...');
    const allTransfers = await fetchAllEntities('Transfer', dateFilter);

    // Transfers FROM this bank account (money out)
    const transfersFrom = allTransfers.filter(t => String(t.FromAccountRef?.value) === bankIdStr);
    console.log(`   Transfers OUT: ${transfersFrom.length}`);
    transfersFrom.forEach(t => {
      allTransactions.push({
        id: `transfer-out-${t.Id}`,
        date: t.TxnDate || '',
        type: 'transfer',
        txn_type: 'Transfer Out',
        ref_number: t.DocNumber || '',
        payee: `To: ${t.ToAccountRef?.name || 'Unknown'}`,
        memo: t.PrivateNote || '',
        amount: -(Math.abs(t.Amount || 0)),  // Negative (money out)
        account: t.ToAccountRef?.name || 'Unknown',
        cleared_status: null
      });
    });

    // Transfers TO this bank account (money in)
    const transfersTo = allTransfers.filter(t => String(t.ToAccountRef?.value) === bankIdStr);
    console.log(`   Transfers IN: ${transfersTo.length}`);
    transfersTo.forEach(t => {
      allTransactions.push({
        id: `transfer-in-${t.Id}`,
        date: t.TxnDate || '',
        type: 'transfer',
        txn_type: 'Transfer In',
        ref_number: t.DocNumber || '',
        payee: `From: ${t.FromAccountRef?.name || 'Unknown'}`,
        memo: t.PrivateNote || '',
        amount: Math.abs(t.Amount || 0),  // Positive (money in)
        account: t.FromAccountRef?.name || 'Unknown',
        cleared_status: null
      });
    });

    // 4. BILL PAYMENTS (by check/cash from bank) - Money OUT
    // NOTE: PayType is not queryable in QBO API, fetch all and filter client-side
    console.log('💸 Fetching BillPayment transactions...');
    const allBillPayments = await fetchAllEntities('BillPayment', dateFilter);
    console.log(`   Fetched ${allBillPayments.length} BillPayments`);

    // Filter to only Check/Cash payments from this bank account
    const filteredBillPayments = allBillPayments.filter(bp => {
      // Only Check or Cash payments (not CreditCard)
      if (bp.PayType !== 'Check' && bp.PayType !== 'Cash') return false;

      const checkDetail = bp.CheckPayment;
      const bankAccountRef = checkDetail?.BankAccountRef?.value;
      return String(bankAccountRef) === bankIdStr;
    });
    console.log(`   Filtered to ${filteredBillPayments.length} matching bank account`);

    filteredBillPayments.forEach(bp => {
      const lines = bp.Line || [];
      const vendorName = bp.VendorRef?.name || '';

      // Get the bill references for context
      const billRefs = lines
        .filter((l: any) => l.LinkedTxn)
        .flatMap((l: any) => l.LinkedTxn || [])
        .filter((lt: any) => lt.TxnType === 'Bill')
        .map((lt: any) => lt.TxnId);

      allTransactions.push({
        id: `billpayment-${bp.Id}`,
        date: bp.TxnDate || '',
        type: 'billpayment',
        txn_type: bp.PayType === 'Check' ? 'Bill Payment (Check)' : 'Bill Payment',
        ref_number: bp.CheckPayment?.PrintStatus === 'NeedToPrint' ? 'To Print' : (bp.DocNumber || ''),
        payee: vendorName,
        memo: bp.PrivateNote || `Bills: ${billRefs.join(', ')}`,
        amount: -(Math.abs(bp.TotalAmt || 0)),  // Negative (money out)
        account: 'Accounts Payable',
        cleared_status: null
      });
    });

    // 5. SALES RECEIPTS (Cash sales deposited directly) - Money IN
    // NOTE: QBO API doesn't support DepositToAccountRef filtering, fetch all and filter
    console.log('💰 Fetching SalesReceipt transactions...');
    const allSalesReceipts = await fetchAllEntities('SalesReceipt', dateFilter);
    const salesReceipts = allSalesReceipts.filter(sr => String(sr.DepositToAccountRef?.value) === bankIdStr);
    console.log(`   Filtered ${allSalesReceipts.length} -> ${salesReceipts.length} matching bank account`);

    salesReceipts.forEach((sr, index) => {
      const lines = sr.Line || [];

      // Debug: Log the first SalesReceipt to see what CustomerRef contains
      if (index === 0) {
        console.log('🔍 DEBUG SalesReceipt sample:', {
          id: sr.Id,
          CustomerRef: sr.CustomerRef,
          CustomerMemo: sr.CustomerMemo,
          BillEmail: sr.BillEmail,
          ShipAddr: sr.ShipAddr?.Line1,
          DocNumber: sr.DocNumber,
          firstLineName: lines[0]?.SalesItemLineDetail?.ItemRef?.name
        });
      }

      allTransactions.push({
        id: `salesreceipt-${sr.Id}`,
        date: sr.TxnDate || '',
        type: 'salesreceipt',
        txn_type: 'Sales Receipt',
        ref_number: sr.DocNumber || '',
        payee: sr.CustomerRef?.name || '',
        memo: sr.CustomerRef?.name || sr.PrivateNote || sr.CustomerMemo?.value || '',
        amount: Math.abs(sr.TotalAmt || 0),  // Positive (money in)
        account: 'Sales',
        cleared_status: null
      });
    });

    // 6. REFUND RECEIPTS (Customer refunds from bank) - Money OUT
    // NOTE: QBO API doesn't support DepositToAccountRef filtering, fetch all and filter
    console.log('↩️ Fetching RefundReceipt transactions...');
    const allRefundReceipts = await fetchAllEntities('RefundReceipt', dateFilter);
    const refundReceipts = allRefundReceipts.filter(rr => String(rr.DepositToAccountRef?.value) === bankIdStr);
    console.log(`   Filtered ${allRefundReceipts.length} -> ${refundReceipts.length} matching bank account`);

    refundReceipts.forEach(rr => {
      allTransactions.push({
        id: `refund-${rr.Id}`,
        date: rr.TxnDate || '',
        type: 'refund',
        txn_type: 'Refund',
        ref_number: rr.DocNumber || '',
        payee: rr.CustomerRef?.name || '',
        memo: rr.PrivateNote || '',
        amount: -(Math.abs(rr.TotalAmt || 0)),  // Negative (money out - refund to customer)
        account: 'Sales Returns',
        cleared_status: null
      });
    });

    // 7. JOURNAL ENTRIES - Can be IN or OUT depending on debit/credit to bank
    console.log('📝 Fetching JournalEntry transactions...');
    const allJournalEntries = await fetchAllEntities('JournalEntry', dateFilter);

    // Filter to journal entries that have a line hitting this bank account
    const journalEntriesForBank: BankRegisterTransaction[] = [];
    allJournalEntries.forEach(je => {
      const lines = je.Line || [];
      lines.forEach((line: any) => {
        const accountRef = line.JournalEntryLineDetail?.AccountRef;
        if (String(accountRef?.value) === bankIdStr) {
          const isDebit = line.JournalEntryLineDetail?.PostingType === 'Debit';
          const amount = line.Amount || 0;

          journalEntriesForBank.push({
            id: `je-${je.Id}-${line.Id || Math.random().toString(36).substr(2, 9)}`,
            date: je.TxnDate || '',
            type: 'journalentry',
            txn_type: 'Journal Entry',
            ref_number: je.DocNumber || '',
            payee: line.Description || je.PrivateNote || 'Journal Entry',
            memo: je.PrivateNote || line.Description || '',
            amount: isDebit ? Math.abs(amount) : -Math.abs(amount),  // Debit = IN, Credit = OUT for bank
            account: accountRef?.name || 'Unknown',
            cleared_status: null
          });
        }
      });
    });
    console.log(`   Found ${journalEntriesForBank.length} JE lines hitting bank account`);
    allTransactions.push(...journalEntriesForBank);

    // 8. VENDOR CREDITS (Refunds from vendors) - Money IN when deposited to bank
    console.log('💵 Fetching VendorCredit transactions...');
    const allVendorCredits = await fetchAllEntities('VendorCredit', dateFilter);

    // VendorCredits affect AP, but if they have a linked deposit to bank, we'd see it as a Deposit
    // For now, log them but typically they don't directly hit bank (they reduce AP)
    // Only include if there's a direct bank account reference (unusual for VendorCredit)
    const vendorCreditsForBank = allVendorCredits.filter(vc => {
      const lines = vc.Line || [];
      return lines.some((line: any) =>
        String(line.AccountBasedExpenseLineDetail?.AccountRef?.value) === bankIdStr
      );
    });

    vendorCreditsForBank.forEach(vc => {
      allTransactions.push({
        id: `vendorcredit-${vc.Id}`,
        date: vc.TxnDate || '',
        type: 'vendorcredit',
        txn_type: 'Vendor Credit',
        ref_number: vc.DocNumber || '',
        payee: vc.VendorRef?.name || '',
        memo: vc.PrivateNote || '',
        amount: Math.abs(vc.TotalAmt || 0),  // Positive (money in - refund from vendor)
        account: 'Accounts Payable',
        cleared_status: null
      });
    });
    console.log(`   Found ${vendorCreditsForBank.length} VendorCredits hitting bank account`);

    // 9. CREDIT MEMOS (Customer credits) - Typically don't directly hit bank
    console.log('📋 Fetching CreditMemo transactions...');
    const allCreditMemos = await fetchAllEntities('CreditMemo', dateFilter);

    // Credit memos reduce AR, but if deposited to a specific account (rare), include it
    const creditMemosForBank = allCreditMemos.filter(cm =>
      String(cm.DepositToAccountRef?.value) === bankIdStr
    );

    creditMemosForBank.forEach(cm => {
      allTransactions.push({
        id: `creditmemo-${cm.Id}`,
        date: cm.TxnDate || '',
        type: 'creditmemo',
        txn_type: 'Credit Memo',
        ref_number: cm.DocNumber || '',
        payee: cm.CustomerRef?.name || '',
        memo: cm.PrivateNote || '',
        amount: -(Math.abs(cm.TotalAmt || 0)),  // Negative (reduces revenue/bank)
        account: 'Accounts Receivable',
        cleared_status: null
      });
    });
    console.log(`   Found ${creditMemosForBank.length} CreditMemos hitting bank account`);

    // 10. PAYMENTS (Customer invoice payments) - Money IN when deposited to bank
    console.log('💳 Fetching Payment transactions...');
    const allPayments = await fetchAllEntities('Payment', dateFilter);

    // Filter payments that are deposited to this bank account
    const paymentsForBank = allPayments.filter(p =>
      String(p.DepositToAccountRef?.value) === bankIdStr
    );

    paymentsForBank.forEach(p => {
      allTransactions.push({
        id: `payment-${p.Id}`,
        date: p.TxnDate || '',
        type: 'deposit' as const,  // Treat as deposit type since it's money in
        txn_type: 'Payment',
        ref_number: p.PaymentRefNum || p.DocNumber || '',
        payee: p.CustomerRef?.name || '',
        memo: p.PrivateNote || '',
        amount: Math.abs(p.TotalAmt || 0),  // Positive (money in from customer)
        account: 'Accounts Receivable',
        cleared_status: null
      });
    });
    console.log(`   Found ${paymentsForBank.length} Payments hitting bank account`);

    // Sort by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log('════════════════════════════════════════════════════════════');
    console.log(`✅ BANK REGISTER SYNC COMPLETE`);
    console.log(`   Total transactions: ${allTransactions.length}`);
    console.log(`   - Purchases: ${purchases.length}`);
    console.log(`   - Deposits: ${deposits.length}`);
    console.log(`   - Transfers: ${transfersFrom.length + transfersTo.length}`);
    console.log(`   - Bill Payments: ${filteredBillPayments.length}`);
    console.log(`   - Sales Receipts: ${salesReceipts.length}`);
    console.log(`   - Refunds: ${refundReceipts.length}`);
    console.log(`   - Journal Entries: ${journalEntriesForBank.length}`);
    console.log(`   - Vendor Credits: ${vendorCreditsForBank.length}`);
    console.log(`   - Credit Memos: ${creditMemosForBank.length}`);
    console.log(`   - Customer Payments: ${paymentsForBank.length}`);
    console.log('════════════════════════════════════════════════════════════');

    // Store in KV with same format as gl-report for compatibility
    const bankRegKey = `connection:${connectionId}:bank_register:${account_id}:${start_date}_${end_date}`;
    await kv.set(bankRegKey, {
      account_id,
      start_date,
      end_date,
      entries: allTransactions.map(t => ({
        // Map to existing LedgerEntry format for frontend compatibility
        date: t.date,
        transaction_type: t.txn_type,
        num: t.ref_number,
        name: t.payee,
        memo: t.memo,
        account: t.account,
        debit: t.amount < 0 ? Math.abs(t.amount) : 0,
        credit: t.amount > 0 ? t.amount : 0,
        amount: t.amount,
        balance: 0,  // Not available from entity queries
        split_account: t.account_details?.join(', ') || ''
      })),
      synced_at: new Date().toISOString()
    });

    // Also store in gl: key for backwards compatibility with existing frontend
    const glKey = `connection:${connectionId}:gl:${account_id}:${start_date}_${end_date}`;
    await kv.set(glKey, {
      account_id,
      start_date,
      end_date,
      entries: allTransactions.map(t => ({
        date: t.date,
        transaction_type: t.txn_type,
        num: t.ref_number,
        name: t.payee,
        memo: t.memo,
        account: t.account,
        debit: t.amount < 0 ? Math.abs(t.amount) : 0,
        credit: t.amount > 0 ? t.amount : 0,
        amount: t.amount,
        balance: 0,
        split_account: t.account_details?.join(', ') || ''
      })),
      synced_at: new Date().toISOString()
    });

    return c.json({
      success: true,
      entries_count: allTransactions.length,
      entries: allTransactions.map(t => ({
        date: t.date,
        transaction_type: t.txn_type,
        num: t.ref_number,
        name: t.payee,
        memo: t.memo,
        account: t.account,
        debit: t.amount < 0 ? Math.abs(t.amount) : 0,
        credit: t.amount > 0 ? t.amount : 0,
        amount: t.amount,
        balance: 0,
        split_account: t.account_details?.join(', ') || ''
      })),
      breakdown: {
        purchases: purchases.length,
        deposits: deposits.length,
        transfers: transfersFrom.length + transfersTo.length,
        bill_payments: filteredBillPayments.length,
        sales_receipts: salesReceipts.length,
        refunds: refundReceipts.length
      }
    });
  } catch (error: any) {
    console.error('❌ Bank register sync error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /accounting/sync/:connectionId/ar-aging
 * Pull AR Aging Detail report for accurate open balances
 * This is the SOURCE OF TRUTH for AR reconciliation - shows open balances after payments
 */
app.post('/accounting/sync/:connectionId/ar-aging', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');
    const { report_date } = await c.req.json();

    console.log('════════════════════════════════════════════════════════════');
    console.log('📑 AR AGING SYNC REQUEST RECEIVED');
    console.log(`   Connection ID: ${connectionId}`);
    console.log(`   Report Date: ${report_date}`);
    console.log('════════════════════════════════════════════════════════════');

    let connection = await kv.get(`qbo_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      console.log('❌ Connection not found or firm mismatch');
      return c.json({ error: 'Connection not found' }, 404);
    }

    // Refresh token if needed
    connection = await refreshQBOToken(connection);
    const accessToken = await decryptToken(connection.encrypted_access_token);

    // Use AgedReceivableDetail report - this shows OPEN BALANCES after payments
    const params = new URLSearchParams({
      report_date: report_date || new Date().toISOString().split('T')[0],
      minorversion: '65'
    });

    console.log(`🔍 Fetching AgedReceivableDetail report...`);

    const response = await fetch(
      `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/reports/AgedReceivableDetail?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ AgedReceivableDetail API error ${response.status}:`, errorText);
      throw new Error(`QuickBooks API error: ${response.status}`);
    }

    const reportData = await response.json();
    console.log('📊 AgedReceivableDetail response received');

    // Parse the aging report
    const arEntries: any[] = [];
    const rows = reportData.Rows?.Row || [];

    // Get column mapping
    const columns = reportData.Columns?.Column || [];
    const columnMap: any = {};
    columns.forEach((col: any, index: number) => {
      const colKey = col.ColType || col.ColTitle;
      if (colKey) {
        columnMap[colKey.toLowerCase()] = index;
      }
    });

    console.log(`🔍 AR Aging Column mapping:`, columnMap);

    // Helper to parse amounts
    const parseAmount = (val: any): number => {
      if (val === null || val === undefined || val === '') return 0;
      const str = val.toString();
      const isNegative = str.includes('(') || str.includes('-');
      const numeric = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
      return isNegative ? -numeric : numeric;
    };

    // Recursive function to extract AR entries from the aging report
    const extractAREntries = (rowArray: any[], customerName = '') => {
      if (!Array.isArray(rowArray)) {
        rowArray = [rowArray];
      }

      rowArray.forEach((row: any) => {
        let currentCustomer = customerName;

        // Check for Section headers (customer names)
        if (row.type === 'Section' && row.Header?.ColData) {
          currentCustomer = row.Header.ColData[0]?.value || customerName;
        }

        // Data rows contain actual invoice entries
        if (row.type === 'Data' && row.ColData) {
          const cols = row.ColData;

          // Extract data based on column positions
          const date = cols[0]?.value || '';
          const txnType = cols[1]?.value || '';
          const docNum = cols[2]?.value || '';
          const dueDate = cols[4]?.value || '';
          const openBalance = parseAmount(cols[cols.length - 1]?.value);
          const amount = parseAmount(cols[5]?.value) || openBalance;

          // Skip if no open balance (fully paid)
          if (openBalance <= 0 && txnType.toLowerCase() !== 'credit memo') {
            return;
          }

          // Only include invoices and credit memos
          const lowerType = txnType.toLowerCase();
          if (lowerType.includes('invoice') || lowerType.includes('credit')) {
            const entry = {
              date,
              transaction_type: txnType,
              num: docNum,
              name: currentCustomer,
              memo: '',
              amount: openBalance,
              original_amount: amount,
              open_balance: openBalance,
              due_date: dueDate,
              is_credit: lowerType.includes('credit')
            };

            console.log(`   📊 AR Entry: ${txnType} #${docNum} | Customer: ${currentCustomer} | Open Balance: $${openBalance}`);
            arEntries.push(entry);
          }
        }

        // Process nested rows
        if (row.Rows?.Row) {
          extractAREntries(row.Rows.Row, currentCustomer);
        }
      });
    };

    extractAREntries(rows);

    console.log(`✅ Extracted ${arEntries.length} AR entries from AgedReceivableDetail report`);

    // Sort by date
    arEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Store AR aging entries
    const arKey = `connection:${connectionId}:ar_aging:${report_date}`;
    await kv.set(arKey, {
      report_date,
      entries: arEntries,
      synced_at: new Date().toISOString()
    });

    return c.json({
      success: true,
      entries_count: arEntries.length,
      entries: arEntries
    });
  } catch (error: any) {
    console.error('❌ AR Aging sync error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /accounting/sync/:connectionId/ar-claims
 * Unified AR Claims endpoint - returns invoices + credit memos with payment detection
 */
app.post('/accounting/sync/:connectionId/ar-claims', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');
    const { start_date, end_date } = await c.req.json();

    console.log('📑 AR CLAIMS SYNC REQUEST');
    console.log(`   Date Range: ${start_date} to ${end_date}`);

    let connection = await kv.get(`qbo_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      return c.json({ error: 'Connection not found' }, 404);
    }

    connection = await refreshQBOToken(connection);
    const accessToken = await decryptToken(connection.encrypted_access_token);

    const parseAmount = (val: any): number => {
      if (val === null || val === undefined || val === '') return 0;
      const str = val.toString();
      const isNegative = str.includes('(') || str.includes('-');
      const numeric = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
      return isNegative ? -numeric : numeric;
    };

    // STEP 1: Fetch GL Report for invoices + credit memos
    // NOTE: COA is stored at :accounts, not :coa
    const coaData = await kv.get(`connection:${connectionId}:accounts`);
    const accountsList = coaData?.accounts || coaData || [];
    const arAccounts = accountsList.filter((acc: any) =>
      acc.type === 'Accounts Receivable' ||
      acc.account_type === 'Accounts Receivable' ||
      acc.AccountType === 'Accounts Receivable' ||
      acc.subtype === 'AccountsReceivable'
    );

    if (arAccounts.length === 0) {
      return c.json({ error: 'No AR accounts found' }, 400);
    }

    // Use qbo_id for QuickBooks native account ID, fall back to Id for raw QB data
    const arAccountIds = arAccounts.map((acc: any) => acc.qbo_id || acc.Id);
    const invoicesMap = new Map<string, any>();

    for (const accountId of arAccountIds) {
      console.log(`   📊 Fetching GL for account: ${accountId}`);

      const glParams = new URLSearchParams({
        start_date,
        end_date,
        account: accountId,
        columns: 'tx_date,txn_type,doc_num,name,memo,subt_nat_amount,debt_amt,credit_amt,amount',
        minorversion: '65'
      });

      const glUrl = `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/reports/GeneralLedger?${glParams}`;
      console.log(`   📍 GL URL: ${glUrl}`);

      const glResponse = await fetch(glUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!glResponse.ok) {
        const errorBody = await glResponse.text();
        console.log(`   ❌ GL response failed: ${glResponse.status}`);
        console.log(`   ❌ Error body: ${errorBody.substring(0, 500)}`);
        continue;
      }

      const glData = await glResponse.json();
      const rows = glData.Rows?.Row || [];
      const columns = glData.Columns?.Column || [];

      console.log(`   📊 GL Response for account ${accountId}: ${rows.length} rows, ${columns.length} columns`);
      console.log(`   Columns: ${columns.map((c: any) => c.ColType || c.ColTitle).join(', ')}`);

      const colMap: Record<string, number> = {};
      columns.forEach((col: any, i: number) => {
        const key = (col.ColType || col.ColTitle || '').toLowerCase();
        colMap[key] = i;
      });
      console.log(`   Column map: ${JSON.stringify(colMap)}`);

      const extractEntries = (rowArray: any[]) => {
        if (!Array.isArray(rowArray)) rowArray = [rowArray];

        rowArray.forEach((row: any) => {
          if (row.type === 'Data' && row.ColData) {
            const cols = row.ColData;
            const txnType = cols[colMap['txn_type']]?.value || cols[1]?.value || '';
            const lowerType = txnType.toLowerCase();

            // Debug: log all transaction types we see
            console.log(`   GL Row: type="${txnType}" docNum="${cols[colMap['doc_num']]?.value || cols[2]?.value || 'N/A'}"`);

            if (!lowerType.includes('invoice') && !lowerType.includes('credit')) return;
            if (lowerType.includes('payment') || lowerType.includes('deposit')) return;

            console.log(`   ✅ Including: ${txnType}`);

            const docNum = cols[colMap['doc_num']]?.value || cols[2]?.value || '';
            const date = cols[colMap['tx_date']]?.value || cols[0]?.value || '';
            const name = cols[colMap['name']]?.value || cols[3]?.value || '';
            const memo = cols[colMap['memo']]?.value || cols[4]?.value || '';

            let amount = 0;
            // QB returns 8 columns: tx_date(0), txn_type(1), doc_num(2), name(3), memo(4), debt_amt(5), credit_amt(6), amount/balance(7)
            // Note: subt_nat_amount is NOT returned, so indices shift down
            const debtIdx = colMap['debt_amt'] ?? colMap['money'] ?? 5;
            const creditIdx = colMap['credit_amt'] ?? 6;
            const balanceIdx = 7; // Last column is usually the running balance/amount

            const debitVal = cols[debtIdx]?.value;
            const creditVal = cols[creditIdx]?.value;
            const balanceVal = cols[balanceIdx]?.value;

            console.log(`   🔍 Column values: debit[${debtIdx}]="${debitVal}" credit[${creditIdx}]="${creditVal}" balance[${balanceIdx}]="${balanceVal}"`);

            // Use balance column as primary source (it has correct sign for both invoices and credit memos)
            if (balanceVal && balanceVal !== '') {
              amount = parseAmount(balanceVal);
            } else {
              // Fallback to debit - credit if balance is empty
              const debit = parseAmount(debitVal);
              const credit = parseAmount(creditVal);
              amount = debit - credit;
            }

            console.log(`   💰 Amount: balance="${balanceVal}" parsed=${amount}`);

            if (lowerType.includes('credit')) {
              amount = -Math.abs(amount);
              console.log(`   📋 CREDIT MEMO DETECTED: ${docNum} | Customer: ${name} | Amount: $${Math.abs(amount).toFixed(2)}`);
            } else {
              amount = Math.abs(amount);
            }

            const key = `${docNum}_${name}`;
            if (!invoicesMap.has(key)) {
              invoicesMap.set(key, {
                invoice_number: docNum || 'N/A',
                customer: name || 'Unknown',
                date,
                memo,
                original_amount: amount,
                transaction_type: txnType,
                is_credit_memo: lowerType.includes('credit')
              });
            }
          }
          if (row.Rows?.Row) extractEntries(row.Rows.Row);
        });
      };

      extractEntries(rows);
    }

    // STEP 2: Fetch AR Aging for open balances
    const agingParams = new URLSearchParams({
      report_date: end_date,
      minorversion: '65'
    });

    const agingResponse = await fetch(
      `${QBO_API_BASE_URL}/v3/company/${connection.realm_id}/reports/AgedReceivableDetail?${agingParams}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const openBalanceMap = new Map<string, number>();

    if (agingResponse.ok) {
      const agingData = await agingResponse.json();
      const agingRows = agingData.Rows?.Row || [];

      const extractAgingBalances = (rowArray: any[], customerName = '') => {
        if (!Array.isArray(rowArray)) rowArray = [rowArray];

        rowArray.forEach((row: any) => {
          let currentCustomer = customerName;
          if (row.type === 'Section' && row.Header?.ColData) {
            currentCustomer = row.Header.ColData[0]?.value || customerName;
          }
          if (row.type === 'Data' && row.ColData) {
            const cols = row.ColData;
            const docNum = cols[2]?.value || '';
            const openBalance = parseAmount(cols[cols.length - 1]?.value);
            if (docNum) {
              openBalanceMap.set(`${docNum}_${currentCustomer}`, openBalance);
              openBalanceMap.set(docNum, openBalance);
            }
          }
          if (row.Rows?.Row) extractAgingBalances(row.Rows.Row, currentCustomer);
        });
      };

      extractAgingBalances(agingRows);
    }

    // STEP 3: Merge and calculate already_applied
    const arClaims: any[] = [];
    let index = 0;

    invoicesMap.forEach((invoice, key) => {
      let openBalance = openBalanceMap.get(key) ?? openBalanceMap.get(invoice.invoice_number);
      if (openBalance === undefined) {
        openBalance = invoice.is_credit_memo ? invoice.original_amount : 0;
      }

      const originalAmount = invoice.original_amount;
      const alreadyApplied = originalAmount - openBalance;

      arClaims.push({
        id: `ar_claim_${index++}`,
        invoice_number: invoice.invoice_number,
        customer: invoice.customer,
        date: invoice.date,
        memo: invoice.memo,
        transaction_type: invoice.transaction_type,
        is_credit_memo: invoice.is_credit_memo,
        original_amount: originalAmount,
        open_balance: openBalance,
        already_applied: alreadyApplied,
        status: openBalance === 0 ? 'Paid' : (alreadyApplied > 0 ? 'Partial' : 'Open')
      });
    });

    arClaims.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return c.json({
      success: true,
      claims_count: arClaims.length,
      claims: arClaims,
      summary: {
        total_invoiced: arClaims.filter(c => !c.is_credit_memo).reduce((sum, c) => sum + c.original_amount, 0),
        total_credits: arClaims.filter(c => c.is_credit_memo).reduce((sum, c) => sum + Math.abs(c.original_amount), 0),
        total_open: arClaims.reduce((sum, c) => sum + c.open_balance, 0),
        total_applied: arClaims.reduce((sum, c) => sum + c.already_applied, 0)
      }
    });
  } catch (error: any) {
    console.error('❌ AR Claims sync error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /accounting/:connectionId/accounts
 * Get synced chart of accounts
 */
app.get('/accounting/:connectionId/accounts', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));
    const connectionId = c.req.param('connectionId');

    const connection = await kv.get(`qbo_connection:${connectionId}`) || await kv.get(`xero_connection:${connectionId}`);
    if (!connection || connection.firm_id !== firmId) {
      return c.json({ error: 'Connection not found' }, 404);
    }

    const accounts = await kv.get(`connection:${connectionId}:accounts`) || [];

    return c.json({ accounts });
  } catch (error: any) {
    console.error('❌ Error fetching accounts:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /companies/list
 * List all QuickBooks-synced companies for the firm
 */
app.get('/companies/list', async (c) => {
  try {
    const { firmId } = await getUserFromToken(c.req.header('Authorization'));

    console.log(`📋 Fetching QuickBooks companies for firm ${firmId}`);

    const firmCompanies = await kv.get(`firm:${firmId}:companies`) || [];

    // Get full company details
    const companies = await Promise.all(
      firmCompanies.map(async (companyRef: any) => {
        const company = await kv.get(`company:${companyRef.id}`);
        return company;
      })
    );

    // Filter out any null values
    const validCompanies = companies.filter(c => c !== null);

    console.log(`✅ Found ${validCompanies.length} QuickBooks companies`);

    return c.json({ companies: validCompanies });
  } catch (error: any) {
    console.error('❌ Error fetching companies:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Removed duplicate /companies/:id route - use the one in index.tsx instead
// That route doesn't require authentication and is accessible with publicAnonKey

export default app;