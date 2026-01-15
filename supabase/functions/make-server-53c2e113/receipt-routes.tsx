import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-53c2e113');

// Initialize Supabase client for auth validation
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================
// RECEIPTS ROUTES
// ============================================

app.get('/api/companies/:companyId/receipts', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    console.log(`📥 Fetching receipts for company ${companyId}`);
    
    let receipts;
    try {
      receipts = await kv.getByPrefix(`receipt:${companyId}:`);
    } catch (kvError) {
      console.error('❌ KV Store error:', kvError);
      console.log('⚠️ Returning empty array due to KV error');
      // Return empty array instead of failing completely
      return c.json({ success: true, data: [] });
    }
    
    // Handle null/undefined response
    if (!receipts) {
      console.log('⚠️ No receipts found, returning empty array');
      receipts = [];
    }
    
    // Ensure receipts is an array
    if (!Array.isArray(receipts)) {
      console.error('❌ getByPrefix did not return an array:', receipts);
      return c.json({ success: true, data: [] });
    }
    
    // Sort by uploadedAt descending (safely)
    const sorted = receipts.sort((a: any, b: any) => {
      const dateA = a?.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const dateB = b?.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    console.log(`✅ Returning ${sorted.length} receipts`);
    return c.json({ success: true, data: sorted });
  } catch (error) {
    console.error('❌ Error fetching receipts:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error details:', errorMsg);
    return c.json({ success: false, error: 'Failed to fetch receipts', details: errorMsg }, 500);
  }
});

app.post('/api/companies/:companyId/receipts', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    console.log(`📤 Creating receipt for company ${companyId}`);
    
    const body = await c.req.json();
    const id = crypto.randomUUID();
    
    const receipt = {
      id,
      companyId,
      ...body,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await kv.set(`receipt:${companyId}:${id}`, receipt);
      console.log(`✅ Receipt created: ${id}`);
      return c.json({ success: true, data: receipt }, 201);
    } catch (kvError) {
      console.error('❌ KV Store error during creation:', kvError);
      return c.json({ success: false, error: 'Failed to save receipt to database', details: String(kvError) }, 500);
    }
  } catch (error) {
    console.error('❌ Error creating receipt:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error details:', errorMsg);
    return c.json({ success: false, error: 'Failed to create receipt', details: errorMsg }, 500);
  }
});

app.put('/api/companies/:companyId/receipts/:id', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const id = c.req.param('id');
    console.log(`✏️ Updating receipt ${id} for company ${companyId}`);
    
    const body = await c.req.json();
    
    let existing;
    try {
      existing = await kv.get(`receipt:${companyId}:${id}`);
    } catch (kvError) {
      console.error('❌ KV Store error during get:', kvError);
      return c.json({ success: false, error: 'Database error while fetching receipt', details: String(kvError) }, 500);
    }
    
    if (!existing) {
      console.log(`⚠️ Receipt not found: ${id}`);
      return c.json({ success: false, error: 'Receipt not found' }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      id,
      companyId,
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await kv.set(`receipt:${companyId}:${id}`, updated);
      console.log(`✅ Receipt updated: ${id}`);
      return c.json({ success: true, data: updated });
    } catch (kvError) {
      console.error('❌ KV Store error during update:', kvError);
      return c.json({ success: false, error: 'Failed to save updated receipt', details: String(kvError) }, 500);
    }
  } catch (error) {
    console.error('❌ Error updating receipt:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error details:', errorMsg);
    return c.json({ success: false, error: 'Failed to update receipt', details: errorMsg }, 500);
  }
});

app.delete('/api/companies/:companyId/receipts/:id', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const id = c.req.param('id');
    console.log(`🗑️ Deleting receipt ${id} for company ${companyId}`);
    
    try {
      await kv.del(`receipt:${companyId}:${id}`);
      console.log('✅ Receipt deleted successfully');
      return c.json({ success: true });
    } catch (kvError) {
      console.error('❌ KV Store error during delete:', kvError);
      return c.json({ success: false, error: 'Failed to delete receipt from database', details: String(kvError) }, 500);
    }
  } catch (error) {
    console.error('❌ Error deleting receipt:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error details:', errorMsg);
    return c.json({ success: false, error: 'Failed to delete receipt', details: errorMsg }, 500);
  }
});

export default app;