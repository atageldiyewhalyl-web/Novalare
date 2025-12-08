import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-53c2e113');

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Sign up - Creates firm and user
app.post('/auth/signup', async (c) => {
  try {
    const { email, password, fullName, firmName } = await c.req.json();
    
    console.log(`📝 Sign up request for ${email} at firm ${firmName}`);
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return c.json({ error: authError.message }, 400);
    }
    
    const userId = authData.user.id;
    
    // Create firm
    const firmId = crypto.randomUUID();
    const firm = {
      id: firmId,
      name: firmName,
      industry: 'Accounting Firm',
      created_at: new Date().toISOString(),
      plan: 'pro', // Start with pro plan for 14-day trial
      billing_status: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      company_limit: 20,
      owner_user_id: userId,
    };
    
    await kv.set(`firm:${firmId}`, firm);
    
    // Create user record
    const user = {
      id: userId,
      firm_id: firmId,
      email,
      full_name: fullName,
      role: 'owner',
      created_at: new Date().toISOString(),
      is_active: true,
    };
    
    await kv.set(`user:${userId}`, user);
    await kv.set(`firm:${firmId}:user:${userId}`, user);
    
    console.log(`✅ Created firm ${firmId} and user ${userId}`);
    
    return c.json({ 
      success: true, 
      firmId, 
      userId,
      message: 'Account created successfully'
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    return c.json({ error: 'Failed to create account' }, 500);
  }
});

// Get user data
app.get('/auth/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    
    const user = await kv.get(`user:${userId}`);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Get firm data
    const firm = await kv.get(`firm:${user.firm_id}`);
    
    return c.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      firmId: user.firm_id,
      firmName: firm?.name || 'Unknown',
      role: user.role,
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Initialize default user (for migration of existing data)
app.post('/auth/init-default-user', async (c) => {
  try {
    const { email, password, fullName, firmName } = await c.req.json();
    
    console.log(`🔧 Initializing default user: ${email}`);
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return c.json({ error: authError.message }, 400);
    }
    
    const userId = authData.user.id;
    
    // Create firm
    const firmId = 'default-firm-halyl';
    const firm = {
      id: firmId,
      name: firmName,
      industry: 'Accounting Firm',
      created_at: new Date().toISOString(),
      plan: 'pro',
      billing_status: 'active',
      company_limit: 50,
      owner_user_id: userId,
    };
    
    await kv.set(`firm:${firmId}`, firm);
    
    // Create user record
    const user = {
      id: userId,
      firm_id: firmId,
      email,
      full_name: fullName,
      role: 'owner',
      created_at: new Date().toISOString(),
      is_active: true,
    };
    
    await kv.set(`user:${userId}`, user);
    await kv.set(`firm:${firmId}:user:${userId}`, user);
    
    // Migrate existing company to this firm
    // Get Müller & Partner company
    const existingCompany = await kv.get('company:1');
    if (existingCompany) {
      existingCompany.firm_id = firmId;
      await kv.set('company:1', existingCompany);
      console.log('✅ Migrated existing company to new firm');
    }
    
    // Update all company prefixes to include firm_id
    await kv.set(`firm:${firmId}:company:1`, existingCompany);
    
    console.log(`✅ Default user initialized with firm ${firmId}`);
    
    return c.json({ 
      success: true, 
      firmId, 
      userId,
      message: 'Default user created and data migrated'
    });
  } catch (error) {
    console.error('❌ Init error:', error);
    return c.json({ error: 'Failed to initialize user' }, 500);
  }
});

export default app;