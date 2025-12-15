// ============================================
// NOVALARE EMAIL WORKER - CLOUDFLARE
// ============================================
// This worker receives ALL emails to @novalare.com
// and forwards invoice emails to the backend webhook
// ============================================

export default {
  // Fetch handler for HTTP requests (health check)
  async fetch(request, env, ctx) {
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Novalare Email Worker is running',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },

  // Email handler for incoming emails
  async email(message, env, ctx) {
    try {
      const to = message.to;
      const from = message.from;
      const subject = message.headers.get('subject') || 'No Subject';

      console.log('📧 Incoming email');
      console.log('  To:', to);
      console.log('  From:', from);
      console.log('  Subject:', subject);

      // ============================================
      // FILTER: Only process invoice emails
      // ============================================
      // Format: {company-name}+invoice@novalare.com
      // Examples:
      //   ✅ abc-backerei-gmbh+invoice@novalare.com
      //   ✅ technova-ug+invoice@novalare.com
      //   ❌ info@novalare.com
      //   ❌ support@novalare.com
      // ============================================

      if (!to.includes('+invoice@novalare.com')) {
        console.log('⏭️ Skipping - not an invoice email');
        console.log('  Expected format: {company-name}+invoice@novalare.com');
        return; // Ignore non-invoice emails
      }

      console.log('✅ Invoice email detected - processing...');

      // ============================================
      // EXTRACT ATTACHMENTS USING RAW EMAIL
      // ============================================
      // Cloudflare Email Workers provide the raw email stream
      // We need to parse MIME to extract attachments

      const attachments = [];
      
      // Get raw email as stream
      const rawEmail = await streamToString(message.raw);
      
      console.log('📧 Raw email length:', rawEmail.length);
      
      // Parse MIME email to extract attachments
      const parsedAttachments = await parseEmailAttachments(rawEmail);
      
      for (const attachment of parsedAttachments) {
        console.log('📎 Attachment found:', attachment.filename);
        
        attachments.push({
          filename: attachment.filename,
          contentType: attachment.contentType,
          content: attachment.content, // Already base64 encoded
        });
        
        console.log('✅ Attachment processed:', attachment.filename);
      }

      console.log(`📎 Total attachments processed: ${attachments.length}`);

      if (attachments.length === 0) {
        console.log('⚠️ No attachments found - skipping webhook call');
        return;
      }

      // ============================================
      // FORWARD TO BACKEND WEBHOOK
      // ============================================

      const webhookUrl = 'https://kkmybbvhinqfhglbkzbj.supabase.co/functions/v1/make-server-53c2e113/api/webhook/cloudflare';
      
      console.log('📤 Calling webhook:', webhookUrl);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrbXliYnZoaW5xZmhnbGJremJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNTA0MjYsImV4cCI6MjA3OTgyNjQyNn0.E8eDAnwNtYihLl2y10rzwgjMwl7yhKnicr_QL2zodwc', // Supabase Anon Key
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          attachments,
        }),
      });

      if (!response.ok) {
        console.error('❌ Webhook failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        return;
      }

      const result = await response.json();
      console.log('✅ Webhook response:', JSON.stringify(result, null, 2));
      console.log('✅ Email processing complete!');

      return; // Email processed successfully
      
    } catch (error) {
      console.error('❌ Email processing error:', error);
      console.error('Stack trace:', error.stack);
      // Don't throw - this would bounce the email back to sender
      return;
    }
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function streamToString(stream) {
  const chunks = [];
  const reader = stream.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  const blob = new Blob(chunks);
  return await blob.text();
}

function parseEmailAttachments(rawEmail) {
  // Robust MIME parser for attachments
  const attachments = [];
  
  // Find the boundary
  const boundaryMatch = rawEmail.match(/boundary[=:][\s"]*([^\s";]+)/i);
  if (!boundaryMatch) {
    console.log('⚠️ No MIME boundary found');
    return attachments;
  }
  
  const boundary = boundaryMatch[1].replace(/"/g, '');
  console.log('📦 Using boundary:', boundary);
  
  const parts = rawEmail.split('--' + boundary);
  console.log(`📦 Found ${parts.length} MIME parts`);
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Skip if not an attachment
    if (!part.includes('Content-Disposition:')) continue;
    if (!part.toLowerCase().includes('attachment') && !part.toLowerCase().includes('filename')) continue;
    
    console.log(`\n🔍 Analyzing part ${i}...`);
    
    // Extract filename - try multiple patterns
    let filename = null;
    const filenamePatterns = [
      /filename[=:][\s"]*([^"\r\n;]+)/i,
      /name[=:][\s"]*([^"\r\n;]+)/i,
    ];
    
    for (const pattern of filenamePatterns) {
      const match = part.match(pattern);
      if (match) {
        filename = match[1].replace(/"/g, '').trim();
        break;
      }
    }
    
    if (!filename) {
      console.log('⚠️ No filename found in this part');
      continue;
    }
    
    console.log('📎 Filename:', filename);
    
    // Extract content type
    const contentTypeMatch = part.match(/Content-Type:\s*([^\s;]+)/i);
    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
    console.log('📄 Content-Type:', contentType);
    
    // Check if base64 encoded
    const isBase64 = part.toLowerCase().includes('base64');
    console.log('🔐 Base64 encoded:', isBase64);
    
    if (!isBase64) {
      console.log('⚠️ Not base64 encoded - skipping');
      continue;
    }
    
    // Extract base64 content - find content after double newline
    // This is more robust than looking for specific patterns
    const lines = part.split(/\r?\n/);
    let inContent = false;
    let contentLines = [];
    
    for (const line of lines) {
      // Empty line after headers means content starts
      if (!inContent && line.trim() === '') {
        inContent = true;
        continue;
      }
      
      // If we're in content section
      if (inContent) {
        // Stop at boundary or end markers
        if (line.startsWith('--') || line.trim() === '') {
          // Empty lines within content are OK, but consecutive empty lines might indicate end
          if (line.trim() === '' && contentLines.length > 0) {
            // Check if next lines are also empty (end of content)
            continue;
          }
          if (line.startsWith('--')) break;
        }
        
        // Add to content if it looks like base64
        const trimmed = line.trim();
        if (trimmed && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
          contentLines.push(trimmed);
        }
      }
    }
    
    if (contentLines.length === 0) {
      console.log('⚠️ Could not extract base64 content');
      continue;
    }
    
    // Join all base64 lines
    const content = contentLines.join('');
    console.log(`✅ Extracted ${content.length} chars of base64 content`);
    
    attachments.push({
      filename,
      contentType,
      content,
    });
    
    console.log(`✅ Successfully parsed: ${filename}`);
  }
  
  return attachments;
}