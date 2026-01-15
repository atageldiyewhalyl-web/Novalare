import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();  // Remove basePath - it's added during route mounting in index.tsx

/**
 * Generate email address based on company name
 * Format: companyname+invoice@novalare.com
 * 
 * NOTE: Users send BOTH invoices and receipts to this single email.
 * The AI automatically classifies and separates them into the correct workflows.
 */
function generateCompanyBasedEmail(companyName: string): string {
  // Clean company name: lowercase, remove special chars, replace spaces with hyphens
  const cleanName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars but keep spaces
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .substring(0, 30);
  
  // If empty after cleaning, use a fallback with random string
  if (!cleanName || cleanName === 'unknown-company') {
    const randomString = crypto.randomUUID().substring(0, 8);
    return `company-${randomString}+invoice@novalare.com`;
  }
  
  return `${cleanName}+invoice@novalare.com`;
}

/**
 * Check if an email already exists in ANY company's email settings
 * CRITICAL: Prevents duplicate email assignments across companies
 */
async function isEmailUnique(email: string): Promise<boolean> {
  try {
    // Get all email settings across all companies
    const allEmailSettings = await kv.getByPrefix('company:');
    
    // Filter to only email-settings entries
    const emailSettingsEntries = allEmailSettings.filter((entry: any) => 
      entry && typeof entry === 'object' && entry.forwardingEmail
    );
    
    // Check if this email exists in any company's settings
    const emailExists = emailSettingsEntries.some((settings: any) => {
      return settings.forwardingEmail?.toLowerCase() === email.toLowerCase();
    });
    
    return !emailExists; // Return true if email is unique (doesn't exist)
  } catch (error) {
    console.error('Error checking email uniqueness:', error);
    return false; // Fail safe - assume not unique if error
  }
}

/**
 * Generate a guaranteed unique email with retry logic
 * Will retry up to 10 times if collision is detected
 */
async function generateUniqueEmail(companyId: string, companyName: string): Promise<string> {
  const maxRetries = 10;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let email: string;
    
    if (attempt === 0) {
      // First attempt: use company name
      email = generateCompanyBasedEmail(companyName);
    } else {
      // Subsequent attempts: add incrementing number
      const cleanName = companyName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 28); // Leave room for number
      email = `${cleanName}-${attempt}+invoice@novalare.com`;
    }
    
    // Check if this email is unique
    const isUnique = await isEmailUnique(email);
    
    if (isUnique) {
      console.log(`✅ Generated unique forwarding email for company ${companyId}: ${email}`);
      return email;
    }
    
    // Collision detected - log warning and retry
    console.warn(`⚠️ Email collision detected (attempt ${attempt + 1}/${maxRetries}): ${email}`);
  }
  
  // This should be extremely rare - fallback to UUID
  const uuid = crypto.randomUUID().substring(0, 8);
  const fallbackEmail = `company-${uuid}+invoice@novalare.com`;
  console.error(`❌ Failed to generate unique email after ${maxRetries} attempts. Using fallback: ${fallbackEmail}`);
  return fallbackEmail;
}

// Get email settings for a company
app.get('/companies/:companyId/email-settings', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    
    // Get firmId from header (set by frontend)
    const firmId = c.req.header('x-firm-id') || 'default-firm-halyl';
    
    // Get company info to get the name - try firm-scoped key first
    let company = await kv.get(`firm:${firmId}:company:${companyId}`);
    
    // Fall back to legacy key for backward compatibility
    if (!company && firmId === 'default-firm-halyl') {
      company = await kv.get(`company:${companyId}`);
    }
    
    const companyName = company?.name || 'UnknownCompany';
    
    // Get or create email settings
    const settingsKey = `company:${companyId}:email-settings`;
    let settings = await kv.get(settingsKey);
    
    if (!settings) {
      console.log(`📧 Creating new email settings for company ${companyId} (${companyName})`);
      
      // Create default settings with guaranteed unique emails based on company name
      settings = {
        forwardingEmail: await generateUniqueEmail(companyId, companyName),
        receiptsProcessed: 0,
        invoicesProcessed: 0,
        createdAt: new Date().toISOString(),
      };
      
      await kv.set(settingsKey, settings);
      console.log(`✅ Email settings created:`, {
        forwardingEmail: settings.forwardingEmail
      });
    }
    
    return c.json(settings);
  } catch (error: any) {
    console.error('❌ Error fetching email settings:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Regenerate email address
app.post('/companies/:companyId/email-settings/regenerate', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    
    console.log(`🔄 Regenerating forwarding email for company ${companyId}`);
    
    // Get firmId from header (set by frontend)
    const firmId = c.req.header('x-firm-id') || 'default-firm-halyl';
    
    // Get company info to get the name - try firm-scoped key first
    let company = await kv.get(`firm:${firmId}:company:${companyId}`);
    
    // Fall back to legacy key for backward compatibility
    if (!company && firmId === 'default-firm-halyl') {
      company = await kv.get(`company:${companyId}`);
    }
    
    const companyName = company?.name || 'UnknownCompany';
    
    const settingsKey = `company:${companyId}:email-settings`;
    let settings = await kv.get(settingsKey);
    
    if (!settings) {
      settings = {
        forwardingEmail: await generateUniqueEmail(companyId, companyName),
        receiptsProcessed: 0,
        invoicesProcessed: 0,
        createdAt: new Date().toISOString(),
      };
    }
    
    // Get old email for logging
    const oldEmail = settings.forwardingEmail;
    
    // Generate new unique email with collision protection using company name
    const newEmail = await generateUniqueEmail(companyId, companyName);
    settings.forwardingEmail = newEmail;
    settings.updatedAt = new Date().toISOString();
    
    await kv.set(settingsKey, settings);
    
    console.log(`✅ Email regenerated for company ${companyId}:`, {
      oldEmail,
      newEmail
    });
    
    return c.json({ email: newEmail });
  } catch (error: any) {
    console.error('❌ Error regenerating email:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Increment processed count (called when email is processed)
app.post('/companies/:companyId/email-settings/increment', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const body = await c.req.json();
    const { type } = body;
    
    if (type !== 'receipts' && type !== 'invoices') {
      return c.json({ error: 'Invalid type' }, 400);
    }
    
    const settingsKey = `company:${companyId}:email-settings`;
    const settings = await kv.get(settingsKey);
    
    if (settings) {
      const fieldName = type === 'receipts' ? 'receiptsProcessed' : 'invoicesProcessed';
      settings[fieldName] = (settings[fieldName] || 0) + 1;
      settings.lastProcessedAt = new Date().toISOString();
      
      await kv.set(settingsKey, settings);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error incrementing count:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update emails when company name changes
app.post('/companies/:companyId/email-settings/update-from-name', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    
    console.log(`📝 Updating email settings for company ${companyId} based on new company name`);
    
    // Get firmId from header (set by frontend)
    const firmId = c.req.header('x-firm-id') || 'default-firm-halyl';
    
    // Get company info to get the name - try firm-scoped key first
    let company = await kv.get(`firm:${firmId}:company:${companyId}`);
    
    // Fall back to legacy key for backward compatibility
    if (!company && firmId === 'default-firm-halyl') {
      company = await kv.get(`company:${companyId}`);
    }
    
    if (!company) {
      return c.json({ error: 'Company not found' }, 404);
    }
    
    const companyName = company.name || 'UnknownCompany';
    
    const settingsKey = `company:${companyId}:email-settings`;
    let settings = await kv.get(settingsKey);
    
    if (!settings) {
      // Create new settings with company name
      settings = {
        forwardingEmail: await generateUniqueEmail(companyId, companyName),
        receiptsProcessed: 0,
        invoicesProcessed: 0,
        createdAt: new Date().toISOString(),
      };
    } else {
      // Update existing settings
      const oldEmail = settings.forwardingEmail;
      
      settings.forwardingEmail = await generateUniqueEmail(companyId, companyName);
      settings.updatedAt = new Date().toISOString();
      
      console.log(`✅ Email settings updated:`, {
        oldEmail,
        newEmail: settings.forwardingEmail
      });
    }
    
    await kv.set(settingsKey, settings);
    
    return c.json(settings);
  } catch (error: any) {
    console.error('❌ Error updating email settings:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;