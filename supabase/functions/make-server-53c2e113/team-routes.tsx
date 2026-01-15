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

// Define seat limits by plan
const SEAT_LIMITS = {
  trial: 3,
  starter: 5,
  professional: 15,
  enterprise: 999999 // Unlimited
};

// Helper function to get user from access token
async function getUserFromToken(authHeader: string | null) {
  if (!authHeader) {
    return { error: 'No authorization header', user: null };
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return { error: 'No token provided', user: null };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: 'Invalid token', user: null };
  }

  return { error: null, user };
}

// Helper function to send team invitation email
async function sendInvitationEmail(
  invitedEmail: string,
  inviterName: string,
  firmName: string,
  invitationToken: string
) {
  try {
    // Use the frontend URL for the invitation link (production or local)
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';
    const invitationLink = `${frontendUrl}/accept-invitation?token=${invitationToken}`;
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Novalare <noreply@novalare.com>',
        to: [invitedEmail],
        subject: `${inviterName} invited you to join ${firmName} on Novalare`,
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
                <h2 style="margin-top: 0; font-size: 20px; font-weight: 600;">You've been invited to join ${firmName}</h2>
                <p style="margin: 15px 0;"><strong>${inviterName}</strong> has invited you to join <strong>${firmName}</strong> on Novalare.</p>
                <p style="margin: 15px 0;">Novalare is an AI copilot that helps accountants work 10x faster with automated invoice extraction, bank reconciliation, and month-end close workflows.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${invitationLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
                </div>
                
                <p style="margin: 15px 0; font-size: 14px; color: #666;">This invitation will expire in 7 days.</p>
              </div>
              
              <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                <p style="margin-top: 10px;">© ${new Date().getFullYear()} Novalare. All rights reserved.</p>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Resend API error:', errorData);
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('✅ Team invitation email sent successfully via Resend:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to send team invitation email:', error);
    throw error;
  }
}

// Get team members for a firm
app.get('/team/members', async (c) => {
  try {
    const { error: authError, user } = await getUserFromToken(c.req.header('Authorization'));
    if (authError || !user) {
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }

    // Get user's firm - try multiple methods for backward compatibility
    let firmId = null;
    
    // Method 1: Try the new user:firm key
    const userFirms = await kv.getByPrefix(`user:${user.id}:firm`);
    if (userFirms && userFirms.length > 0) {
      firmId = userFirms[0].value;
    }
    
    // Method 2: If not found, get from user record
    if (!firmId) {
      const userRecord = await kv.get(`user:${user.id}`);
      if (userRecord && userRecord.firm_id) {
        firmId = userRecord.firm_id;
        // Backfill the user:firm key for future requests
        await kv.set(`user:${user.id}:firm`, userRecord.firm_id);
      }
    }
    
    if (!firmId) {
      return c.json({ error: 'No firm found for user' }, 404);
    }

    // Get firm data
    const firmData = await kv.get(`firm:${firmId}`);
    if (!firmData) {
      return c.json({ error: 'Firm not found' }, 404);
    }

    // Ensure teamMembers array exists (backfill for old firms)
    if (!firmData.teamMembers) {
      // Create initial team member from owner
      firmData.teamMembers = [
        {
          userId: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || user.email,
          role: 'owner',
          joinedAt: firmData.created_at || new Date().toISOString()
        }
      ];
      await kv.set(`firm:${firmId}`, firmData);
    }

    // Get all team members
    const teamMembers = firmData.teamMembers || [];
    
    // Get pending invitations
    const pendingInvitations = await kv.getByPrefix(`invitation:firm:${firmId}`);

    // Determine subscription plan for seat limits
    const subscriptionPlan = firmData.subscriptionPlan || firmData.billing_status || 'trial';

    return c.json({
      teamMembers,
      pendingInvitations: pendingInvitations.map(inv => inv.value),
      currentPlan: subscriptionPlan,
      seatLimit: SEAT_LIMITS[subscriptionPlan as keyof typeof SEAT_LIMITS] || SEAT_LIMITS.trial,
      seatsUsed: teamMembers.length,
      seatsAvailable: (SEAT_LIMITS[subscriptionPlan as keyof typeof SEAT_LIMITS] || SEAT_LIMITS.trial) - teamMembers.length
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Invite a team member
app.post('/team/invite', async (c) => {
  try {
    const { error: authError, user } = await getUserFromToken(c.req.header('Authorization'));
    if (authError || !user) {
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }

    const { email, role = 'member' } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Get user's firm - try multiple methods for backward compatibility
    let firmId = null;
    
    const userFirms = await kv.getByPrefix(`user:${user.id}:firm`);
    if (userFirms && userFirms.length > 0) {
      firmId = userFirms[0].value;
    }
    
    if (!firmId) {
      const userRecord = await kv.get(`user:${user.id}`);
      if (userRecord && userRecord.firm_id) {
        firmId = userRecord.firm_id;
        await kv.set(`user:${user.id}:firm`, userRecord.firm_id);
      }
    }
    
    if (!firmId) {
      return c.json({ error: 'No firm found for user' }, 404);
    }

    // Get firm data
    const firmData = await kv.get(`firm:${firmId}`);
    if (!firmData) {
      return c.json({ error: 'Firm not found' }, 404);
    }

    // Ensure teamMembers exists
    if (!firmData.teamMembers) {
      firmData.teamMembers = [{
        userId: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || user.email,
        role: 'owner',
        joinedAt: firmData.created_at || new Date().toISOString()
      }];
      await kv.set(`firm:${firmId}`, firmData);
    }

    // Check if user is owner or admin
    const currentUserMember = firmData.teamMembers?.find((m: any) => m.userId === user.id);
    if (!currentUserMember || (currentUserMember.role !== 'owner' && currentUserMember.role !== 'admin')) {
      return c.json({ error: 'Only owners and admins can invite team members' }, 403);
    }

    // Check seat availability
    const currentPlan = firmData.subscriptionPlan || firmData.billing_status || 'trial';
    const seatLimit = SEAT_LIMITS[currentPlan as keyof typeof SEAT_LIMITS] || SEAT_LIMITS.trial;
    const seatsUsed = (firmData.teamMembers || []).length;

    if (seatsUsed >= seatLimit) {
      return c.json({ 
        error: 'Seat limit reached',
        message: `Your ${currentPlan} plan allows ${seatLimit} seats. Please upgrade to add more team members.`,
        currentPlan,
        seatLimit,
        seatsUsed
      }, 403);
    }

    // Check if user is already a member
    const isAlreadyMember = firmData.teamMembers?.some((m: any) => m.email === email);
    if (isAlreadyMember) {
      return c.json({ error: 'User is already a team member' }, 400);
    }

    // Check if invitation already exists
    const existingInvitation = await kv.get(`invitation:${email}:${firmId}`);
    if (existingInvitation) {
      return c.json({ error: 'Invitation already sent to this email' }, 400);
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Store invitation
    const invitation = {
      token: invitationToken,
      email,
      firmId,
      firmName: firmData.firmName || firmData.name,
      role,
      invitedBy: user.id,
      inviterName: user.user_metadata?.full_name || user.email,
      invitedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending'
    };

    await kv.set(`invitation:${email}:${firmId}`, invitation);
    await kv.set(`invitation:token:${invitationToken}`, invitation);
    await kv.set(`invitation:firm:${firmId}:${email}`, invitation);

    // Send invitation email
    await sendInvitationEmail(
      email,
      invitation.inviterName,
      firmData.firmName || firmData.name,
      invitationToken
    );

    console.log(`✅ Team invitation sent to ${email} for firm ${firmId}`);

    return c.json({
      success: true,
      message: 'Invitation sent successfully',
      invitation: {
        email,
        role,
        invitedAt: invitation.invitedAt,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Error inviting team member:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Accept team invitation
app.post('/team/accept-invitation', async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return c.json({ error: 'Invitation token is required' }, 400);
    }

    // Get invitation by token
    const invitation = await kv.get(`invitation:token:${token}`);
    if (!invitation) {
      return c.json({ error: 'Invalid or expired invitation' }, 404);
    }

    // Check if invitation has expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return c.json({ error: 'Invitation has expired' }, 400);
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return c.json({ error: 'Invitation has already been accepted or cancelled' }, 400);
    }

    // Get user (they must be logged in to accept)
    const { error: authError, user } = await getUserFromToken(c.req.header('Authorization'));
    if (authError || !user) {
      return c.json({ error: 'You must be logged in to accept an invitation' }, 401);
    }

    // Verify the invitation email matches the logged-in user
    if (user.email !== invitation.email) {
      return c.json({ error: 'This invitation was sent to a different email address' }, 403);
    }

    // Get firm data
    const firmData = await kv.get(`firm:${invitation.firmId}`);
    if (!firmData) {
      return c.json({ error: 'Firm not found' }, 404);
    }

    // Add user to firm's team members
    const teamMembers = firmData.teamMembers || [];
    teamMembers.push({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name || user.email,
      role: invitation.role,
      joinedAt: new Date().toISOString()
    });

    firmData.teamMembers = teamMembers;
    await kv.set(`firm:${invitation.firmId}`, firmData);

    // Add firm to user's firms
    await kv.set(`user:${user.id}:firm`, invitation.firmId);

    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date().toISOString();
    invitation.acceptedBy = user.id;
    
    await kv.set(`invitation:token:${token}`, invitation);
    await kv.set(`invitation:${invitation.email}:${invitation.firmId}`, invitation);
    await kv.set(`invitation:firm:${invitation.firmId}:${invitation.email}`, invitation);

    console.log(`✅ User ${user.id} accepted invitation to join firm ${invitation.firmId}`);

    return c.json({
      success: true,
      message: 'Invitation accepted successfully',
      firmId: invitation.firmId,
      firmName: invitation.firmName
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Remove team member (owner/admin only)
app.delete('/team/members/:userId', async (c) => {
  try {
    const { error: authError, user } = await getUserFromToken(c.req.header('Authorization'));
    if (authError || !user) {
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }

    const userIdToRemove = c.req.param('userId');

    // Get user's firm
    const userFirms = await kv.getByPrefix(`user:${user.id}:firm`);
    if (!userFirms || userFirms.length === 0) {
      return c.json({ error: 'No firm found for user' }, 404);
    }

    const firmId = userFirms[0].value;

    // Get firm data
    const firmData = await kv.get(`firm:${firmId}`);
    if (!firmData) {
      return c.json({ error: 'Firm not found' }, 404);
    }

    // Check if current user is owner or admin
    const currentUserMember = firmData.teamMembers?.find((m: any) => m.userId === user.id);
    if (!currentUserMember || (currentUserMember.role !== 'owner' && currentUserMember.role !== 'admin')) {
      return c.json({ error: 'Only owners and admins can remove team members' }, 403);
    }

    // Check if trying to remove the owner
    const memberToRemove = firmData.teamMembers?.find((m: any) => m.userId === userIdToRemove);
    if (!memberToRemove) {
      return c.json({ error: 'Team member not found' }, 404);
    }

    if (memberToRemove.role === 'owner') {
      return c.json({ error: 'Cannot remove the firm owner' }, 403);
    }

    // Remove team member
    firmData.teamMembers = firmData.teamMembers.filter((m: any) => m.userId !== userIdToRemove);
    await kv.set(`firm:${firmId}`, firmData);

    // Remove firm from user's associations
    await kv.del(`user:${userIdToRemove}:firm`);

    console.log(`✅ Removed user ${userIdToRemove} from firm ${firmId}`);

    return c.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('Error removing team member:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Cancel pending invitation (owner/admin only)
app.delete('/team/invitations/:email', async (c) => {
  try {
    const { error: authError, user } = await getUserFromToken(c.req.header('Authorization'));
    if (authError || !user) {
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }

    const emailToCancel = c.req.param('email');

    // Get user's firm
    const userFirms = await kv.getByPrefix(`user:${user.id}:firm`);
    if (!userFirms || userFirms.length === 0) {
      return c.json({ error: 'No firm found for user' }, 404);
    }

    const firmId = userFirms[0].value;

    // Get firm data
    const firmData = await kv.get(`firm:${firmId}`);
    if (!firmData) {
      return c.json({ error: 'Firm not found' }, 404);
    }

    // Check if current user is owner or admin
    const currentUserMember = firmData.teamMembers?.find((m: any) => m.userId === user.id);
    if (!currentUserMember || (currentUserMember.role !== 'owner' && currentUserMember.role !== 'admin')) {
      return c.json({ error: 'Only owners and admins can cancel invitations' }, 403);
    }

    // Get and cancel invitation
    const invitation = await kv.get(`invitation:${emailToCancel}:${firmId}`);
    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    // Delete invitation
    await kv.del(`invitation:${emailToCancel}:${firmId}`);
    await kv.del(`invitation:token:${invitation.token}`);
    await kv.del(`invitation:firm:${firmId}:${emailToCancel}`);

    console.log(`✅ Cancelled invitation for ${emailToCancel} from firm ${firmId}`);

    return c.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;