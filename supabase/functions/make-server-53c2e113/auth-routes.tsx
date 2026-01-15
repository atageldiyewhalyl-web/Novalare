import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-53c2e113');  // Add basePath to match other routes

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Initialize Resend API key
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

// Helper function to send verification email via Resend
async function sendVerificationEmail(email: string, verificationLink: string) {
  try {
    console.log('📧 Preparing to send email via Resend...');
    console.log('   To:', email);
    console.log('   From: Novalare <noreply@novalare.com>');
    console.log('   Link:', verificationLink.substring(0, 50) + '...');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Novalare <noreply@novalare.com>',
        to: [email],
        subject: 'Verify your Novalare account',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #000; font-size: 24px; font-weight: 600; margin: 0;">Novalare</h1>
              </div>
              
              <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
                <h2 style="margin-top: 0; font-size: 20px; font-weight: 600;">Verify your email address</h2>
                <p style="margin: 15px 0;">Thanks for signing up for Novalare! Click the button below to verify your email address and activate your 30-day free trial.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationLink}" style="background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Verify Email Address</a>
                </div>
                
                <p style="font-size: 14px; color: #666; margin: 15px 0;">Or copy and paste this link into your browser:</p>
                <p style="font-size: 12px; color: #999; word-break: break-all;">${verificationLink}</p>
              </div>
              
              <p style="font-size: 12px; color: #999; text-align: center;">If you didn't create a Novalare account, you can safely ignore this email.</p>
            </body>
          </html>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Resend API error response:', data);
      console.error('   Status:', response.status);
      throw new Error(`Resend API error: ${JSON.stringify(data)}`);
    }

    console.log('✅ Email sent via Resend successfully!');
    console.log('   Email ID:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Failed to send email via Resend:', error);
    throw error;
  }
}

// ============================================
// DATABASE HEALTH CHECK
// ============================================

// Check email status from Resend
app.get('/auth/email-status', async (c) => {
  try {
    const emailId = c.req.query('id');

    if (!RESEND_API_KEY) {
      return c.json({ error: 'RESEND_API_KEY missing' }, 500);
    }

    console.log(`🔍 Checking status for email ${emailId}...`);

    const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
    });

    const data = await response.json();

    console.log('   Resend status response:', JSON.stringify(data));

    return c.json(data);
  } catch (error) {
    console.error('❌ Status check failed:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Test Resend API connection
app.get('/auth/test-resend', async (c) => {
  try {
    const targetEmail = c.req.query('email') || 'delivered@resend.dev';

    console.log('🧪 Testing Resend API...');
    console.log('   Target:', targetEmail);
    console.log('   API Key present:', !!RESEND_API_KEY);
    console.log('   API Key prefix:', RESEND_API_KEY?.substring(0, 7));

    // Return info to frontend first
    const apiKeyInfo = {
      present: !!RESEND_API_KEY,
      prefix: RESEND_API_KEY?.substring(0, 7) || 'none',
      validFormat: RESEND_API_KEY?.startsWith('re_'),
    };

    if (!RESEND_API_KEY || !RESEND_API_KEY.startsWith('re_')) {
      return c.json({
        success: false,
        error: 'RESEND_API_KEY is missing or invalid',
        apiKeyInfo
      });
    }

    // Send a test email
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Novalare <noreply@novalare.com>',
        to: [targetEmail],
        subject: 'Diagnostic Test Email from Novalare',
        html: `
          <h1>Email System Test</h1>
          <p>This is a diagnostic email to verify delivery settings.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Target:</strong> ${targetEmail}</p>
          <hr/>
          <p>If you received this, your DNS and API Key configuration is correct!</p>
          <p>Sender: noreply@novalare.com (Root Domain)</p>
        `,
      }),
    });

    const data = await response.json();

    console.log('   Response status:', response.status);
    console.log('   Response data:', JSON.stringify(data));

    return c.json({
      success: response.ok,
      status: response.status,
      targetEmail,
      resendResponse: data,
      apiKeyInfo,
    });
  } catch (error) {
    console.error('❌ Resend test failed:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Test database connection
app.get('/auth/db-health', async (c) => {
  try {
    console.log('🏥 Testing database connection...');

    // Try to query the kv_store table
    const testKey = `health-check-${Date.now()}`;
    const testValue = { timestamp: new Date().toISOString(), test: true };

    // Test write
    await kv.set(testKey, testValue);
    console.log('✅ Write test passed');

    // Test read
    const readValue = await kv.get(testKey);
    console.log('✅ Read test passed');

    // Test delete
    await kv.del(testKey);
    console.log('✅ Delete test passed');

    return c.json({
      status: 'healthy',
      message: 'Database connection is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return c.json({
      status: 'unhealthy',
      error: error.message,
      details: 'Check that kv_store_53c2e113 table exists and RLS is disabled'
    }, 500);
  }
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Sign up - Creates firm and user
app.post('/auth/signup', async (c) => {
  try {
    const { email, password, fullName, firmName } = await c.req.json();

    console.log(`📝 Sign up request for ${email} at firm ${firmName}`);

    // Create user in Supabase Auth
    // Auto-confirm email since email server may not be configured in development
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email verification
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      console.error('❌ Auth error:', authError);

      // Handle specific error cases
      let errorMessage = authError.message;

      if (authError.message?.includes('already been registered') || authError.code === 'email_exists') {
        errorMessage = 'An account with this email already exists. Please try logging in instead.';
      }

      // Track failed signup
      const eventId = crypto.randomUUID();
      await kv.set(`event:${Date.now()}:${eventId}`, {
        eventId,
        timestamp: new Date().toISOString(),
        eventType: 'signup_failed',
        email,
        errorMessage: authError.message,
      });

      return c.json({ error: errorMessage }, 400);
    }

    const userId = authData.user.id;

    console.log(`✅ User created in Supabase Auth, creating firm and user data...`);

    // Create firm with 30-day free trial
    const firmId = crypto.randomUUID();
    const firm = {
      id: firmId,
      name: firmName,
      firmName: firmName, // Alias for compatibility
      industry: 'Accounting Firm',
      created_at: new Date().toISOString(),
      plan: 'pro',
      subscriptionPlan: 'trial', // Current subscription plan for seat limits
      billing_status: 'trial',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      company_limit: 20,
      owner_user_id: userId,
      teamMembers: [
        {
          userId: userId,
          email: email,
          fullName: fullName,
          role: 'owner',
          joinedAt: new Date().toISOString()
        }
      ]
    };

    await kv.set(`firm:${firmId}`, firm);

    // Create user record
    const userRecord = {
      id: userId,
      firm_id: firmId,
      email,
      full_name: fullName,
      role: 'owner',
      created_at: new Date().toISOString(),
      is_active: true,
    };

    await kv.set(`user:${userId}`, userRecord);
    await kv.set(`firm:${firmId}:user:${userId}`, userRecord);
    await kv.set(`user:${userId}:firm`, firmId); // Add this for team routes

    // Track successful signup
    const eventId = crypto.randomUUID();
    await kv.set(`event:${Date.now()}:${eventId}`, {
      eventId,
      timestamp: new Date().toISOString(),
      eventType: 'signup',
      userId,
      email,
      firmId,
      success: true,
    });

    console.log(`✅ Firm ${firmId} and user ${userId} created successfully`);

    // Generate verification link using Supabase
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      redirectTo: `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/auth-callback`,
    });

    if (linkError) {
      console.error('❌ Error generating verification link:', linkError);
      console.error('   linkError.message:', linkError.message);
      console.error('   linkError.status:', linkError.status);
      // Don't fail the whole signup, but log it
      return c.json({
        success: true,
        userId,
        emailSent: false,
        emailError: 'Failed to generate verification link: ' + linkError.message,
        message: 'Account created. Email verification link could not be generated. Please use "Resend Verification" option.'
      });
    } else {
      // Send verification email via Resend
      try {
        console.log('📧 Attempting to send email to:', email);
        console.log('   Link to send:', linkData.properties.action_link?.substring(0, 50) + '...');
        await sendVerificationEmail(email, linkData.properties.action_link);
        console.log(`✅ Verification email sent to ${email} via Resend`);
        return c.json({
          success: true,
          userId,
          emailSent: true,
          message: 'Account created successfully. Please check your email to verify your account.'
        });
      } catch (emailError) {
        console.error('❌ Failed to send verification email:', emailError);
        console.error('   emailError details:', JSON.stringify(emailError));
        // Don't fail the whole signup, user can request resend
        return c.json({
          success: true,
          userId,
          emailSent: false,
          emailError: 'Email sending failed: ' + (emailError.message || 'Unknown error'),
          message: 'Account created. Verification email failed to send. Please use "Resend Verification" option.'
        });
      }
    }

    return c.json({
      success: true,
      userId,
      message: 'Account created successfully. Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    return c.json({ error: 'Failed to create account' }, 500);
  }
});

// Get user data
app.get('/auth/user/:userId', async (c) => {
  let userId;
  try {
    userId = c.req.param('userId');

    console.log(`🔍 Fetching user data for userId: ${userId}`);

    // Validate userId format
    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      console.error('❌ Invalid userId format:', userId);
      return c.json({ error: 'Invalid user ID format' }, 400);
    }

    // Get user data with timeout
    let user;
    try {
      user = await kv.get(`user:${userId}`);
    } catch (kvError) {
      console.error('❌ KV error fetching user:', kvError);
      throw new Error(`Database error: ${kvError.message}`);
    }

    if (!user) {
      console.log(`⚠️ User not found: ${userId}`);
      return c.json({ error: 'User not found' }, 404);
    }

    // Get firm data with timeout
    let firm;
    try {
      if (user.firm_id) {
        firm = await kv.get(`firm:${user.firm_id}`);
      }
    } catch (kvError) {
      console.error('❌ KV error fetching firm:', kvError);
      // Continue without firm data rather than failing
      firm = null;
    }

    console.log(`✅ User data fetched successfully for ${userId}`);

    return c.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      firmId: user.firm_id,
      firmName: firm?.name || 'Unknown',
      role: user.role,
    });
  } catch (error) {
    console.error('❌ CRITICAL ERROR in /auth/user/:userId endpoint');
    console.error('   User ID:', userId);
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);

    return c.json({
      error: 'Failed to fetch user data',
      details: error.message,
      userId: userId
    }, 500);
  }
});

// Complete email verification - Create firm and user after verification
app.post('/auth/complete-verification', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];

    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    // Verify the user's token
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error('❌ Failed to verify user:', userError);
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const userId = user.id;

    console.log(`✅ Email verified for user ${userId}, creating firm and user data...`);

    // Check if user already exists in database
    const existingUser = await kv.get(`user:${userId}`);
    if (existingUser) {
      console.log(`✅ User ${userId} already has firm data`);
      return c.json({ success: true, message: 'Account already activated' });
    }

    // Get temporary signup data
    let tempData = await kv.get(`temp_signup:${userId}`);

    // If no temp data, try to get from user metadata (fallback for old accounts)
    if (!tempData) {
      console.log('⚠️ No temp signup data found, using user metadata as fallback...');

      // Get user data from Supabase Auth
      const email = user.email;
      const fullName = user.user_metadata?.full_name || 'User';
      const firmName = user.user_metadata?.firm_name || `${fullName}'s Firm`;

      tempData = {
        userId,
        email,
        fullName,
        firmName,
        createdAt: new Date().toISOString(),
      };

      console.log(`📋 Using fallback data: ${email} at ${firmName}`);
    }

    const { email, fullName, firmName } = tempData;

    // Create firm with 30-day free trial
    const firmId = crypto.randomUUID();
    const firm = {
      id: firmId,
      name: firmName,
      firmName: firmName, // Alias for compatibility
      industry: 'Accounting Firm',
      created_at: new Date().toISOString(),
      plan: 'pro',
      subscriptionPlan: 'trial', // Current subscription plan for seat limits
      billing_status: 'trial',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      company_limit: 20,
      owner_user_id: userId,
      teamMembers: [
        {
          userId: userId,
          email: email,
          fullName: fullName,
          role: 'owner',
          joinedAt: new Date().toISOString()
        }
      ]
    };

    await kv.set(`firm:${firmId}`, firm);

    // Create user record
    const userRecord = {
      id: userId,
      firm_id: firmId,
      email,
      full_name: fullName,
      role: 'owner',
      created_at: new Date().toISOString(),
      is_active: true,
    };

    await kv.set(`user:${userId}`, userRecord);
    await kv.set(`firm:${firmId}:user:${userId}`, userRecord);
    await kv.set(`user:${userId}:firm`, firmId); // Add this for team routes

    // Delete temporary signup data if it exists
    await kv.del(`temp_signup:${userId}`);

    // Track successful signup
    const eventId = crypto.randomUUID();
    await kv.set(`event:${Date.now()}:${eventId}`, {
      eventId,
      timestamp: new Date().toISOString(),
      eventType: 'signup',
      userId,
      email,
      firmId,
      success: true,
    });

    console.log(`✅ Firm ${firmId} and user ${userId} created successfully after verification`);

    return c.json({
      success: true,
      firmId,
      userId,
      message: 'Account activated successfully'
    });
  } catch (error) {
    console.error('❌ Verification completion error:', error);
    return c.json({ error: 'Failed to complete verification' }, 500);
  }
});

// Check user status in Supabase Auth
app.post('/auth/check-user-status', async (c) => {
  try {
    const { email } = await c.req.json();

    console.log(`🔍 Checking user status for ${email}`);

    // Get all users and find by email
    const { data: { users }, error: getUserError } = await supabase.auth.admin.listUsers();

    if (getUserError) {
      console.error('❌ Error listing users:', getUserError);
      return c.json({ error: 'Failed to check user status' }, 500);
    }

    const user = users?.find(u => u.email === email);

    if (!user) {
      return c.json({
        exists: false,
        message: 'User not found in Supabase Auth'
      });
    }

    // Check if user exists in our database
    const dbUser = await kv.get(`user:${user.id}`);

    return c.json({
      exists: true,
      userId: user.id,
      email: user.email,
      emailConfirmed: !!user.email_confirmed_at,
      emailConfirmedAt: user.email_confirmed_at,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      hasDbRecord: !!dbUser,
      metadata: user.user_metadata,
    });
  } catch (error) {
    console.error('❌ Check user status error:', error);
    return c.json({ error: 'Failed to check user status' }, 500);
  }
});

// Resend verification email
app.post('/auth/resend-verification', async (c) => {
  try {
    const { email } = await c.req.json();

    console.log(`📧 Resending verification email to ${email}`);

    // Get user by email
    const { data: { users }, error: getUserError } = await supabase.auth.admin.listUsers();

    if (getUserError) {
      console.error('❌ Error listing users:', getUserError);
      return c.json({ error: 'Failed to find user' }, 500);
    }

    const user = users?.find(u => u.email === email);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.email_confirmed_at) {
      return c.json({ error: 'Email already verified' }, 400);
    }

    // Generate verification link using Supabase
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      redirectTo: `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/auth-callback`,
    });

    if (linkError) {
      console.error('❌ Error generating verification link:', linkError);
      return c.json({ error: 'Failed to generate verification link' }, 500);
    }

    // Send verification email via Resend
    try {
      await sendVerificationEmail(email, linkData.properties.action_link);
      console.log(`✅ Verification email resent to ${email} via Resend`);
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError);
      return c.json({ error: 'Failed to send verification email' }, 500);
    }

    return c.json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return c.json({ error: 'Failed to resend verification email' }, 500);
  }
});

export default app;