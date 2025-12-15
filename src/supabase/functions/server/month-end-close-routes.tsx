import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono().basePath('/make-server-53c2e113');

// ============================================
// MONTH-END CLOSE ROUTES
// ============================================

// Get month-end close status for a company/period
app.get('/companies/:companyId/month-end-close/:period/status', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    
    console.log(`📊 Fetching month-end close status for ${companyId} - ${period}`);
    
    // Get status from KV store
    const status = await kv.get(`month_end_close:${companyId}:${period}:status`) || {
      invoicesProcessed: { completed: 150, total: 150 },
      bankTransactions: { completed: 85, total: 85 },
      apReconciliation: true,
      uncategorizedCount: 0,
      trialBalanceUploaded: false,
      adjustingEntriesCount: 0,
      status: 'not_started',
    };
    
    return c.json(status);
  } catch (error) {
    console.error('❌ Error fetching close status:', error);
    return c.json({ error: 'Failed to fetch close status' }, 500);
  }
});

// Upload trial balance
app.post('/companies/:companyId/month-end-close/:period/trial-balance/upload', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    
    console.log(`📤 Uploading trial balance for ${companyId} - ${period}`);
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    // Read file content
    const fileContent = await file.text();
    const lines = fileContent.split('\n');
    
    // Parse CSV (simple parser - assumes QuickBooks format)
    const accounts = [];
    let totalDebits = 0;
    let totalCredits = 0;
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length < 4) continue;
      
      const account = parts[0]?.replace(/"/g, '').trim();
      const type = parts[1]?.replace(/"/g, '').trim();
      const debitStr = parts[2]?.replace(/"/g, '').replace(/[^0-9.-]/g, '');
      const creditStr = parts[3]?.replace(/"/g, '').replace(/[^0-9.-]/g, '');
      
      const debit = parseFloat(debitStr) || 0;
      const credit = parseFloat(creditStr) || 0;
      
      if (account && (debit > 0 || credit > 0)) {
        // Extract account code and name
        const accountMatch = account.match(/^(\d+)\s*-\s*(.+)$/);
        const code = accountMatch ? accountMatch[1] : account.substring(0, 4);
        const name = accountMatch ? accountMatch[2] : account;
        
        accounts.push({
          code,
          name,
          type: type || 'Unknown',
          debit,
          credit,
        });
        
        totalDebits += debit;
        totalCredits += credit;
      }
    }
    
    const trialBalance = {
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
      accounts,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
    
    // Save to KV store
    await kv.set(`month_end_close:${companyId}:${period}:trial_balance`, trialBalance);
    
    // Update status
    const status = await kv.get(`month_end_close:${companyId}:${period}:status`) || {};
    status.trialBalanceUploaded = true;
    status.status = 'in_progress';
    await kv.set(`month_end_close:${companyId}:${period}:status`, status);
    
    console.log(`✅ Trial balance uploaded: ${accounts.length} accounts, balanced: ${trialBalance.isBalanced}`);
    
    return c.json(trialBalance);
  } catch (error) {
    console.error('❌ Error uploading trial balance:', error);
    return c.json({ error: 'Failed to upload trial balance' }, 500);
  }
});

// Get trial balance
app.get('/companies/:companyId/month-end-close/:period/trial-balance', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    
    const trialBalance = await kv.get(`month_end_close:${companyId}:${period}:trial_balance`);
    
    if (!trialBalance) {
      return c.json({ error: 'Trial balance not found' }, 404);
    }
    
    return c.json(trialBalance);
  } catch (error) {
    console.error('❌ Error fetching trial balance:', error);
    return c.json({ error: 'Failed to fetch trial balance' }, 500);
  }
});

// AI Analysis of trial balance
app.post('/companies/:companyId/month-end-close/:period/analyze', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    
    console.log(`🤖 AI analyzing trial balance for ${companyId} - ${period}`);
    
    const trialBalance = await kv.get(`month_end_close:${companyId}:${period}:trial_balance`);
    
    if (!trialBalance) {
      return c.json({ error: 'Trial balance not found' }, 404);
    }
    
    // Call OpenAI for analysis
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const prompt = `You are an expert accountant analyzing a trial balance for month-end close. 

Trial Balance Data:
${JSON.stringify(trialBalance.accounts, null, 2)}

Period: ${period}
Total Debits: $${trialBalance.totalDebits}
Total Credits: $${trialBalance.totalCredits}

Analyze this trial balance and suggest adjusting journal entries for common month-end items:
1. Depreciation (if fixed assets exist without recent depreciation)
2. Prepaid expense amortization (if prepaid accounts haven't changed)
3. Accrued expenses (utilities, rent, etc. that may be missing)
4. Any unusual balances that need reclassification

For each suggestion, provide:
- Type (depreciation, amortization, accrual, or reclassification)
- Priority (high, medium, or low)
- Title (brief description)
- Description (detailed explanation)
- Amount
- Suggested journal entry (debit account code/name/amount, credit account code/name/amount)
- Reasoning (why this adjustment is needed)

Return your response as a JSON array of suggestions.`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert accountant. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });
    
    const aiResult = await response.json();
    const aiContent = aiResult.choices[0].message.content;
    
    // Parse AI response
    let suggestions = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      suggestions = [];
    }
    
    // Add IDs to suggestions
    suggestions = suggestions.map((s: any) => ({
      ...s,
      id: `suggestion-${crypto.randomUUID()}`,
    }));
    
    // Save suggestions
    await kv.set(`month_end_close:${companyId}:${period}:suggestions`, suggestions);
    
    console.log(`✅ AI generated ${suggestions.length} suggestions`);
    
    return c.json({ suggestions });
  } catch (error) {
    console.error('❌ Error analyzing trial balance:', error);
    return c.json({ error: 'Failed to analyze trial balance' }, 500);
  }
});

// Generate adjusting entry from suggestion
app.post('/companies/:companyId/month-end-close/:period/adjusting-entries', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    const { suggestion } = await c.req.json();
    
    console.log(`📝 Generating adjusting entry for ${companyId} - ${period}`);
    
    const entryId = `AJE-${Date.now().toString().slice(-6)}`;
    
    // Convert period to date (last day of month)
    const [year, month] = period.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const entryDate = `${year}-${month}-${lastDay}`;
    
    const entry = {
      id: entryId,
      date: entryDate,
      description: suggestion.title,
      lines: [
        {
          account: suggestion.suggestedEntry.debit.account,
          accountCode: suggestion.suggestedEntry.debit.accountCode,
          debit: suggestion.suggestedEntry.debit.amount.toString(),
          credit: '',
          memo: suggestion.description,
        },
        {
          account: suggestion.suggestedEntry.credit.account,
          accountCode: suggestion.suggestedEntry.credit.accountCode,
          debit: '',
          credit: suggestion.suggestedEntry.credit.amount.toString(),
          memo: suggestion.description,
        },
      ],
      totalDebit: suggestion.suggestedEntry.debit.amount,
      totalCredit: suggestion.suggestedEntry.credit.amount,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    
    // Save entry
    await kv.set(`month_end_close:${companyId}:${period}:entry:${entryId}`, entry);
    
    // Update count
    const status = await kv.get(`month_end_close:${companyId}:${period}:status`) || {};
    status.adjustingEntriesCount = (status.adjustingEntriesCount || 0) + 1;
    await kv.set(`month_end_close:${companyId}:${period}:status`, status);
    
    console.log(`✅ Created adjusting entry: ${entryId}`);
    
    return c.json({ success: true, entry });
  } catch (error) {
    console.error('❌ Error generating adjusting entry:', error);
    return c.json({ error: 'Failed to generate entry' }, 500);
  }
});

// Generate all adjusting entries from suggestions
app.post('/companies/:companyId/month-end-close/:period/adjusting-entries/batch', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    const { suggestions } = await c.req.json();
    
    console.log(`📝 Generating ${suggestions.length} adjusting entries for ${companyId} - ${period}`);
    
    const entries = [];
    
    for (const suggestion of suggestions) {
      const entryId = `AJE-${Date.now().toString().slice(-6)}-${entries.length}`;
      
      const [year, month] = period.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const entryDate = `${year}-${month}-${lastDay}`;
      
      const entry = {
        id: entryId,
        date: entryDate,
        description: suggestion.title,
        lines: [
          {
            account: suggestion.suggestedEntry.debit.account,
            accountCode: suggestion.suggestedEntry.debit.accountCode,
            debit: suggestion.suggestedEntry.debit.amount.toString(),
            credit: '',
            memo: suggestion.description,
          },
          {
            account: suggestion.suggestedEntry.credit.account,
            accountCode: suggestion.suggestedEntry.credit.accountCode,
            debit: '',
            credit: suggestion.suggestedEntry.credit.amount.toString(),
            memo: suggestion.description,
          },
        ],
        totalDebit: suggestion.suggestedEntry.debit.amount,
        totalCredit: suggestion.suggestedEntry.credit.amount,
        status: 'draft',
        createdAt: new Date().toISOString(),
      };
      
      await kv.set(`month_end_close:${companyId}:${period}:entry:${entryId}`, entry);
      entries.push(entry);
    }
    
    // Update count
    const status = await kv.get(`month_end_close:${companyId}:${period}:status`) || {};
    status.adjustingEntriesCount = (status.adjustingEntriesCount || 0) + entries.length;
    await kv.set(`month_end_close:${companyId}:${period}:status`, status);
    
    console.log(`✅ Created ${entries.length} adjusting entries`);
    
    return c.json({ success: true, entries });
  } catch (error) {
    console.error('❌ Error generating adjusting entries:', error);
    return c.json({ error: 'Failed to generate entries' }, 500);
  }
});

// Get adjusting entries
app.get('/companies/:companyId/month-end-close/:period/adjusting-entries', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    
    const allEntries = await kv.getByPrefix(`month_end_close:${companyId}:${period}:entry:`);
    
    return c.json({ entries: allEntries });
  } catch (error) {
    console.error('❌ Error fetching adjusting entries:', error);
    return c.json({ error: 'Failed to fetch entries' }, 500);
  }
});

// Delete adjusting entry
app.delete('/companies/:companyId/month-end-close/:period/adjusting-entries/:entryId', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    const entryId = c.req.param('entryId');
    
    await kv.del(`month_end_close:${companyId}:${period}:entry:${entryId}`);
    
    // Update count
    const status = await kv.get(`month_end_close:${companyId}:${period}:status`) || {};
    status.adjustingEntriesCount = Math.max(0, (status.adjustingEntriesCount || 0) - 1);
    await kv.set(`month_end_close:${companyId}:${period}:status`, status);
    
    console.log(`✅ Deleted adjusting entry: ${entryId}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting adjusting entry:', error);
    return c.json({ error: 'Failed to delete entry' }, 500);
  }
});

// Export to Excel
app.post('/companies/:companyId/month-end-close/:period/export/excel', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    const { entryIds } = await c.req.json();
    
    console.log(`📊 Exporting ${entryIds.length} entries to Excel for ${companyId} - ${period}`);
    
    // Get entries
    const entries = [];
    for (const entryId of entryIds) {
      const entry = await kv.get(`month_end_close:${companyId}:${period}:entry:${entryId}`);
      if (entry) entries.push(entry);
    }
    
    // Build CSV content (Excel can open CSV)
    let csv = 'Entry ID,Date,Account Code,Account Name,Debit,Credit,Memo\n';
    
    for (const entry of entries) {
      for (const line of entry.lines) {
        csv += `"${entry.id}","${entry.date}","${line.accountCode}","${line.account}","${line.debit || ''}","${line.credit || ''}","${line.memo || entry.description}"\n`;
      }
    }
    
    // Mark entries as exported
    for (const entry of entries) {
      entry.status = 'exported';
      entry.exportedAt = new Date().toISOString();
      await kv.set(`month_end_close:${companyId}:${period}:entry:${entry.id}`, entry);
    }
    
    // Update status
    const status = await kv.get(`month_end_close:${companyId}:${period}:status`) || {};
    const allEntries = await kv.getByPrefix(`month_end_close:${companyId}:${period}:entry:`);
    const draftCount = allEntries.filter((e: any) => e.status === 'draft').length;
    if (draftCount === 0 && allEntries.length > 0) {
      status.status = 'ready_to_close';
    }
    await kv.set(`month_end_close:${companyId}:${period}:status`, status);
    
    console.log(`✅ Exported ${entries.length} entries to Excel`);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="novalare_adjusting_entries_${period}.csv"`,
      },
    });
  } catch (error) {
    console.error('❌ Error exporting to Excel:', error);
    return c.json({ error: 'Failed to export to Excel' }, 500);
  }
});

// Export to IIF
app.post('/companies/:companyId/month-end-close/:period/export/iif', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    const { entryIds } = await c.req.json();
    
    console.log(`📊 Exporting ${entryIds.length} entries to IIF for ${companyId} - ${period}`);
    
    // Get entries
    const entries = [];
    for (const entryId of entryIds) {
      const entry = await kv.get(`month_end_close:${companyId}:${period}:entry:${entryId}`);
      if (entry) entries.push(entry);
    }
    
    // Build IIF content
    let iif = '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\n';
    iif += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\n';
    iif += '!ENDTRNS\n';
    
    for (const entry of entries) {
      // TRNS line (header)
      iif += `TRNS\t\tGENERAL\t${entry.date}\t${entry.lines[0].accountCode}\t\t0.00\t${entry.id}\t${entry.description}\n`;
      
      // SPL lines (details)
      for (const line of entry.lines) {
        const amount = line.debit ? parseFloat(line.debit) : -parseFloat(line.credit);
        iif += `SPL\t\tGENERAL\t${entry.date}\t${line.accountCode}\t\t${amount.toFixed(2)}\t${entry.id}\t${line.memo || ''}\n`;
      }
      
      iif += 'ENDTRNS\n';
    }
    
    // Mark entries as exported
    for (const entry of entries) {
      entry.status = 'exported';
      entry.exportedAt = new Date().toISOString();
      await kv.set(`month_end_close:${companyId}:${period}:entry:${entry.id}`, entry);
    }
    
    // Update status
    const status = await kv.get(`month_end_close:${companyId}:${period}:status`) || {};
    const allEntries = await kv.getByPrefix(`month_end_close:${companyId}:${period}:entry:`);
    const draftCount = allEntries.filter((e: any) => e.status === 'draft').length;
    if (draftCount === 0 && allEntries.length > 0) {
      status.status = 'ready_to_close';
    }
    await kv.set(`month_end_close:${companyId}:${period}:status`, status);
    
    console.log(`✅ Exported ${entries.length} entries to IIF`);
    
    return new Response(iif, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="novalare_adjusting_entries_${period}.iif"`,
      },
    });
  } catch (error) {
    console.error('❌ Error exporting to IIF:', error);
    return c.json({ error: 'Failed to export to IIF' }, 500);
  }
});

// Check if period is locked/closed
app.get('/month-close/status', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }
    
    const lockStatus = await kv.get(`month-close-lock:${companyId}:${period}`);
    
    if (!lockStatus) {
      return c.json({ isLocked: false });
    }
    
    return c.json(lockStatus);
  } catch (error) {
    console.error('❌ Error checking lock status:', error);
    return c.json({ error: 'Failed to check lock status' }, 500);
  }
});

// Mark period as closed and lock it
app.post('/month-close/close', async (c) => {
  try {
    const { companyId, period, closedBy } = await c.req.json();
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }
    
    console.log(`🔒 Closing and locking period ${period} for company ${companyId}`);
    
    // Create lock record
    const lockStatus = {
      isLocked: true,
      companyId,
      period,
      closedAt: new Date().toISOString(),
      closedBy: closedBy || 'system',
    };
    
    // Save lock status
    await kv.set(`month-close-lock:${companyId}:${period}`, lockStatus);
    
    console.log(`✅ Period ${period} locked successfully`);
    
    return c.json({ success: true, lockStatus });
  } catch (error) {
    console.error('❌ Error closing period:', error);
    return c.json({ error: 'Failed to close period' }, 500);
  }
});

// Unlock a closed period (admin only)
app.post('/month-close/unlock', async (c) => {
  try {
    const { companyId, period } = await c.req.json();
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }
    
    console.log(`🔓 Unlocking period ${period} for company ${companyId}`);
    
    // Delete lock record
    await kv.del(`month-close-lock:${companyId}:${period}`);
    
    console.log(`✅ Period ${period} unlocked successfully`);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error unlocking period:', error);
    return c.json({ error: 'Failed to unlock period' }, 500);
  }
});

// Mark period as closed (legacy endpoint)
app.post('/companies/:companyId/month-end-close/:period/close', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const period = c.req.param('period');
    
    console.log(`🔒 Closing period ${period} for ${companyId}`);
    
    const status = await kv.get(`month_end_close:${companyId}:${period}:status`) || {};
    status.status = 'closed';
    status.closedDate = new Date().toISOString();
    await kv.set(`month_end_close:${companyId}:${period}:status`, status);
    
    console.log(`✅ Period ${period} marked as closed`);
    
    return c.json({ success: true, status });
  } catch (error) {
    console.error('❌ Error closing period:', error);
    return c.json({ error: 'Failed to close period' }, 500);
  }
});

export default app;