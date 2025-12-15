import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono().basePath('/make-server-53c2e113');

// ============================================
// RECEIPTS ROUTES
// ============================================

app.get('/api/companies/:companyId/receipts', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const receipts = await kv.getByPrefix(`receipt:${companyId}:`);
    
    // Sort by uploadedAt descending
    const sorted = receipts.sort((a: any, b: any) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    
    return c.json({ success: true, data: sorted });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return c.json({ success: false, error: 'Failed to fetch receipts' }, 500);
  }
});

app.post('/api/companies/:companyId/receipts', async (c) => {
  try {
    const companyId = c.req.param('companyId');
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
    
    await kv.set(`receipt:${companyId}:${id}`, receipt);
    return c.json({ success: true, data: receipt }, 201);
  } catch (error) {
    console.error('Error creating receipt:', error);
    return c.json({ success: false, error: 'Failed to create receipt' }, 500);
  }
});

app.put('/api/companies/:companyId/receipts/:id', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`receipt:${companyId}:${id}`);
    
    if (!existing) {
      return c.json({ success: false, error: 'Receipt not found' }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      id,
      companyId,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`receipt:${companyId}:${id}`, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating receipt:', error);
    return c.json({ success: false, error: 'Failed to update receipt' }, 500);
  }
});

app.delete('/api/companies/:companyId/receipts/:id', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const id = c.req.param('id');
    
    await kv.del(`receipt:${companyId}:${id}`);
    console.log('✅ Receipt deleted successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return c.json({ success: false, error: 'Failed to delete receipt' }, 500);
  }
});

export default app;
