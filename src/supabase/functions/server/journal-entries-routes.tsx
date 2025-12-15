import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono().basePath('/make-server-53c2e113');

// ============================================
// JOURNAL ENTRIES ROUTES
// ============================================

// Approve a transaction for journal entry creation
// This sends unmatched transactions to the Draft/Suggested tab
// where AI will generate recommended journal entries
app.post('/journal-entries/approve-suggestion', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, type, item, source } = body;
    
    if (!companyId || !period || !type || !item) {
      return c.json({ error: 'companyId, period, type, and item are required' }, 400);
    }

    console.log(`📝 Approving ${type} transaction for JE generation:`, companyId, period, source);

    // Generate a unique ID for this suggested JE
    const suggestionId = `${companyId}-${period}-${type}-${Date.now()}`;
    
    // Create a suggested journal entry record
    const suggestedJE = {
      id: suggestionId,
      companyId,
      period,
      sourceType: type, // 'bank', 'ledger', 'cc', 'vendor', 'ap'
      source: source || 'bank-rec', // 'bank-rec', 'cc-rec', 'ap-rec'
      sourceItem: item,
      status: 'draft', // 'draft', 'approved', 'posted'
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      suggestedEntry: null, // Will be populated by AI
    };

    // Store in KV store for journal entries
    const jeKey = `journal-entries:${companyId}:${period}:suggestions`;
    const existingSuggestions = await kv.get(jeKey) || { suggestions: [] };
    
    existingSuggestions.suggestions.push(suggestedJE);
    
    await kv.set(jeKey, existingSuggestions);

    // Remove the item from the reconciliation unmatched list
    // Determine reconciliation type based on source parameter
    let recKey: string;
    if (source === 'cc-rec') {
      recKey = `cc-rec:${companyId}:${period}:reconciliation`;
    } else if (source === 'ap-rec' || type === 'vendor' || type === 'ap') {
      recKey = `ap-rec:${companyId}:${period}:reconciliation`;
    } else {
      recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    }
    
    const reconciliationData = await kv.get(recKey);
    
    if (reconciliationData) {
      // Handle CC reconciliation items
      if (source === 'cc-rec') {
        if (type === 'cc' && reconciliationData.unmatched_cc) {
          // Find and remove the item from unmatched_cc
          reconciliationData.unmatched_cc = reconciliationData.unmatched_cc.filter((unmatchedItem: any) => {
            const txn = unmatchedItem.transaction;
            const itemTxn = item.transaction;
            return !(
              txn.id === itemTxn.id ||
              (txn.date === itemTxn.date &&
               txn.description === itemTxn.description &&
               txn.amount === itemTxn.amount)
            );
          });
          
          // Update summary counts
          if (reconciliationData.summary) {
            reconciliationData.summary.unmatched_cc_count = reconciliationData.unmatched_cc.length;
          }
        } else if (type === 'ledger' && reconciliationData.unmatched_ledger) {
          // Find and remove the item from unmatched_ledger (CC rec ledger entries)
          reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.filter((unmatchedItem: any) => {
            const entry = unmatchedItem.entry;
            const itemEntry = item.entry;
            return !(
              entry.id === itemEntry.id ||
              (entry.date === itemEntry.date &&
               (entry.vendor === itemEntry.vendor || entry.description === itemEntry.description) &&
               (entry.debit === itemEntry.debit || entry.amount === itemEntry.amount))
            );
          });
          
          // Update summary counts
          if (reconciliationData.summary) {
            reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
          }
        }
      }
      // Handle Bank reconciliation items
      else if (type === 'bank' && reconciliationData.unmatched_bank) {
        // Find and remove the item from unmatched_bank
        reconciliationData.unmatched_bank = reconciliationData.unmatched_bank.filter((unmatchedItem: any) => {
          // Compare the transaction details to find the match
          const txn = unmatchedItem.transaction;
          const itemTxn = item.transaction;
          return !(
            txn.date === itemTxn.date &&
            txn.description === itemTxn.description &&
            txn.amount === itemTxn.amount
          );
        });
        
        // Update summary counts
        if (reconciliationData.summary) {
          reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank.length;
        }
      } else if (type === 'ledger' && reconciliationData.unmatched_ledger) {
        // Find and remove the item from unmatched_ledger
        reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.filter((unmatchedItem: any) => {
          // Compare the entry details to find the match
          const entry = unmatchedItem.entry;
          const itemEntry = item.entry;
          return !(
            entry.date === itemEntry.date &&
            entry.description === itemEntry.description &&
            entry.amount === itemEntry.amount
          );
        });
        
        // Update summary counts
        if (reconciliationData.summary) {
          reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
        }
      } else if (type === 'vendor' && reconciliationData.unmatched_vendor) {
        // Find and remove the item from unmatched_vendor
        reconciliationData.unmatched_vendor = reconciliationData.unmatched_vendor.filter((unmatchedItem: any) => {
          // Compare the transaction details to find the match
          const txn = unmatchedItem.transaction;
          const itemTxn = item.transaction;
          return !(
            txn.date === itemTxn.date &&
            txn.description === itemTxn.description &&
            txn.amount === itemTxn.amount
          );
        });
        
        // Update summary counts
        if (reconciliationData.summary) {
          reconciliationData.summary.unmatched_vendor_count = reconciliationData.unmatched_vendor.length;
        }
      } else if (type === 'ap' && reconciliationData.unmatched_ap) {
        // Find and remove the item from unmatched_ap
        reconciliationData.unmatched_ap = reconciliationData.unmatched_ap.filter((unmatchedItem: any) => {
          // Compare the entry details to find the match
          const entry = unmatchedItem.entry;
          const itemEntry = item.entry;
          return !(
            entry.date === itemEntry.date &&
            entry.description === itemEntry.description &&
            entry.amount === itemEntry.amount
          );
        });
        
        // Update summary counts
        if (reconciliationData.summary) {
          reconciliationData.summary.unmatched_ap_count = reconciliationData.unmatched_ap.length;
        }
      }
      
      // Save the updated reconciliation data
      await kv.set(recKey, reconciliationData);
      console.log(`✅ Removed approved item from reconciliation ${type} list`);
      
      // Add to resolved bucket
      const isAPRec = source === 'ap-rec' || type === 'vendor' || type === 'ap';
      const isCCRec = source === 'cc-rec';
      
      let resolvedKey: string;
      if (isCCRec) {
        resolvedKey = `cc-rec:${companyId}:${period}:resolved`;
      } else if (isAPRec) {
        resolvedKey = `ap-rec:${companyId}:${period}:resolved`;
      } else {
        resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
      }
      
      const existingResolved = await kv.get(resolvedKey) || { items: [] };
      
      existingResolved.items.push({
        type,
        item,
        markedAt: new Date().toISOString(),
        status: 'resolved',
        resolution: 'Transaction sent to Journal Entries section to be recorded'
      });
      
      await kv.set(resolvedKey, existingResolved);
    }

    console.log('✅ Transaction approved for JE generation:', suggestionId);

    return c.json({ 
      success: true, 
      suggestionId,
      message: 'Transaction approved for journal entry generation' 
    });
  } catch (error) {
    console.error('❌ Error approving transaction for JE:', error);
    return c.json({ error: 'Failed to approve transaction' }, 500);
  }
});

// Get suggested journal entries for a company/period
app.get('/journal-entries/suggestions', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    const key = `journal-entries:${companyId}:${period}:suggestions`;
    const data = await kv.get(key);
    
    return c.json({
      suggestions: data?.suggestions || []
    });
  } catch (error) {
    console.error('❌ Error fetching suggested JEs:', error);
    return c.json({ error: 'Failed to fetch suggested journal entries' }, 500);
  }
});

// Get all journal entries for a company/period (all statuses)
app.get('/journal-entries', async (c) => {
  try {
    const companyId = c.req.query('companyId');
    const period = c.req.query('period');
    
    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log('📊 ============================================');
    console.log('📊 GET /journal-entries called');
    console.log('📊 Company:', companyId);
    console.log('📊 Period:', period);

    // Get suggestions (draft/suggested)
    const suggestionsKey = `journal-entries:${companyId}:${period}:suggestions`;
    const suggestionsData = await kv.get(suggestionsKey);
    console.log('📊 Suggestions key:', suggestionsKey);
    console.log('📊 Suggestions count:', suggestionsData?.suggestions?.length || 0);
    
    // Get ready to export
    const readyKey = `journal-entries:${companyId}:${period}:ready`;
    console.log('📊 Fetching ready key:', readyKey);
    const readyData = await kv.get(readyKey);
    console.log('📊 Ready data from KV:', JSON.stringify(readyData, null, 2));
    console.log('📊 Ready entries count:', readyData?.entries?.length || 0);
    if (readyData?.entries) {
      console.log('📊 Ready entries:', JSON.stringify(readyData.entries, null, 2));
    }
    
    // Get posted
    const postedKey = `journal-entries:${companyId}:${period}:posted`;
    const postedData = await kv.get(postedKey);
    console.log('📊 Posted count:', postedData?.entries?.length || 0);
    console.log('📊 ============================================');
    
    const responseData = {
      suggestions: suggestionsData?.suggestions || [],
      ready: readyData?.entries || [],
      posted: postedData?.entries || []
    };
    
    console.log('📤 RESPONSE BEING SENT:');
    console.log('📤 Suggestions:', responseData.suggestions.length);
    console.log('📤 Ready:', responseData.ready.length);
    console.log('📤 Posted:', responseData.posted.length);
    console.log('📤 Ready entries:', JSON.stringify(responseData.ready, null, 2));
    
    return c.json(responseData);
  } catch (error) {
    console.error('❌ Error fetching journal entries:', error);
    return c.json({ error: 'Failed to fetch journal entries' }, 500);
  }
});

// Reverse a journal entry suggestion back to bank rec review
app.post('/journal-entries/reverse-suggestion', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, suggestionId } = body;
    
    if (!companyId || !period || !suggestionId) {
      return c.json({ error: 'companyId, period, and suggestionId are required' }, 400);
    }

    console.log(`↩️ Reversing JE suggestion:`, suggestionId);

    // Get the suggestion data
    const jeKey = `journal-entries:${companyId}:${period}:suggestions`;
    const existingSuggestions = await kv.get(jeKey) || { suggestions: [] };
    
    // Find the suggestion to reverse
    const suggestionToReverse = existingSuggestions.suggestions.find((s: any) => s.id === suggestionId);
    
    if (!suggestionToReverse) {
      return c.json({ error: 'Suggestion not found' }, 404);
    }
    
    // Remove from suggestions
    existingSuggestions.suggestions = existingSuggestions.suggestions.filter((s: any) => s.id !== suggestionId);
    await kv.set(jeKey, existingSuggestions);

    // Add back to bank rec unmatched list
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (reconciliationData) {
      const sourceType = suggestionToReverse.sourceType;
      const sourceItem = suggestionToReverse.sourceItem;
      
      if (sourceType === 'bank') {
        if (!reconciliationData.unmatched_bank) {
          reconciliationData.unmatched_bank = [];
        }
        reconciliationData.unmatched_bank.push(sourceItem);
        
        if (reconciliationData.summary) {
          reconciliationData.summary.unmatched_bank_count = reconciliationData.unmatched_bank.length;
        }
      } else if (sourceType === 'ledger') {
        if (!reconciliationData.unmatched_ledger) {
          reconciliationData.unmatched_ledger = [];
        }
        reconciliationData.unmatched_ledger.push(sourceItem);
        
        if (reconciliationData.summary) {
          reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
        }
      }
      
      await kv.set(recKey, reconciliationData);
      
      // Remove from resolved bucket
      const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
      const existingResolved = await kv.get(resolvedKey) || { items: [] };
      
      // Remove the corresponding resolved item
      existingResolved.items = existingResolved.items.filter((resolvedItem: any) => {
        if (resolvedItem.type !== sourceType) return true;
        const resolvedItemData = resolvedItem.item;
        
        if (sourceType === 'bank') {
          const txn = resolvedItemData.transaction;
          const itemTxn = sourceItem.transaction;
          return !(txn.date === itemTxn.date &&
                   txn.description === itemTxn.description &&
                   txn.amount === itemTxn.amount);
        } else {
          const entry = resolvedItemData.entry;
          const itemEntry = sourceItem.entry;
          return !(entry.date === itemEntry.date &&
                   entry.description === itemEntry.description &&
                   entry.amount === itemEntry.amount);
        }
      });
      
      await kv.set(resolvedKey, existingResolved);
    }

    console.log('✅ JE suggestion reversed successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error reversing JE suggestion:', error);
    return c.json({ error: 'Failed to reverse JE suggestion' }, 500);
  }
});

// Delete a journal entry suggestion permanently
app.post('/journal-entries/delete-suggestion', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, suggestionId } = body;
    
    if (!companyId || !period || !suggestionId) {
      return c.json({ error: 'companyId, period, and suggestionId are required' }, 400);
    }

    console.log(`🗑️ Deleting JE suggestion:`, suggestionId);

    // Get the suggestion data
    const jeKey = `journal-entries:${companyId}:${period}:suggestions`;
    const existingSuggestions = await kv.get(jeKey) || { suggestions: [] };
    
    // Find the suggestion to delete
    const suggestionToDelete = existingSuggestions.suggestions.find((s: any) => s.id === suggestionId);
    
    if (!suggestionToDelete) {
      return c.json({ error: 'Suggestion not found' }, 404);
    }
    
    // Remove from suggestions
    existingSuggestions.suggestions = existingSuggestions.suggestions.filter((s: any) => s.id !== suggestionId);
    await kv.set(jeKey, existingSuggestions);

    // Also remove from resolved bucket if it exists there
    const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
    const existingResolved = await kv.get(resolvedKey) || { items: [] };
    
    const sourceType = suggestionToDelete.sourceType;
    const sourceItem = suggestionToDelete.sourceItem;
    
    // Remove the corresponding resolved item
    existingResolved.items = existingResolved.items.filter((resolvedItem: any) => {
      if (resolvedItem.type !== sourceType) return true;
      const resolvedItemData = resolvedItem.item;
      
      if (sourceType === 'bank') {
        const txn = resolvedItemData.transaction;
        const itemTxn = sourceItem.transaction;
        return !(txn.date === itemTxn.date &&
                 txn.description === itemTxn.description &&
                 txn.amount === itemTxn.amount);
      } else {
        const entry = resolvedItemData.entry;
        const itemEntry = sourceItem.entry;
        return !(entry.date === itemEntry.date &&
                 entry.description === itemEntry.description &&
                 entry.amount === itemEntry.amount);
      }
    });
    
    await kv.set(resolvedKey, existingResolved);

    console.log('✅ JE suggestion deleted successfully');
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting JE suggestion:', error);
    return c.json({ error: 'Failed to delete JE suggestion' }, 500);
  }
});

// Bulk generate AI journal entry suggestions for all transactions
app.post('/journal-entries/bulk-generate', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, transactions, chartOfAccounts } = body;
    
    if (!companyId || !period || !transactions || !chartOfAccounts) {
      return c.json({ error: 'companyId, period, transactions, and chartOfAccounts are required' }, 400);
    }

    console.log(`🔮 Bulk generating JE suggestions for ${transactions.length} transactions`);

    // Get OpenAI API key from environment
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return c.json({ error: 'OpenAI API key not configured' }, 500);
    }

    // Prepare transactions for AI
    const transactionsForAI = transactions.map((suggestion: any) => {
      const isBank = suggestion.sourceType === 'bank';
      const isCC = suggestion.sourceType === 'cc';
      const isVendor = suggestion.sourceType === 'vendor';
      const isAP = suggestion.sourceType === 'ap';
      const transaction = isBank || isCC ? suggestion.sourceItem.transaction : (isVendor ? suggestion.sourceItem.transaction : suggestion.sourceItem.entry);
      
      return {
        id: suggestion.id,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        type: isBank ? 'bank' : isCC ? 'credit-card' : isVendor || isAP ? 'ap-vendor' : 'ledger',
        suggestedAction: suggestion.sourceItem.suggested_action || ''
      };
    });

    // Prepare chart of accounts for AI
    const accountsForAI = chartOfAccounts.map((acc: any) => ({
      code: acc.code,
      name: acc.name,
      type: acc.type
    }));

    // Call OpenAI API for bulk JE generation
    const prompt = `You are an expert accountant. I will provide you with a list of transactions and a chart of accounts. For each transaction, generate a balanced journal entry with appropriate debit and credit accounts.

CHART OF ACCOUNTS:
${JSON.stringify(accountsForAI, null, 2)}

TRANSACTIONS:
${JSON.stringify(transactionsForAI, null, 2)}

For each transaction, respond with a JSON object containing:
- transactionId: the ID of the transaction
- debitAccount: the account code for debit
- debitAccountName: the account name for debit
- creditAccount: the account code for credit
- creditAccountName: the account name for credit
- amount: the absolute amount
- memo: a brief memo explaining the entry

Return your response as a JSON array of these objects, one for each transaction. Ensure the response is valid JSON only, no markdown or explanations.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert accountant who generates accurate journal entries. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      return c.json({ error: 'Failed to generate journal entries with AI' }, 500);
    }

    const aiData = await aiResponse.json();
    const generatedJEs = JSON.parse(aiData.choices[0].message.content);

    console.log(`✅ Generated ${generatedJEs.length} JE suggestions`);

    // Update the suggestions with AI-generated JE data
    const jeKey = `journal-entries:${companyId}:${period}:suggestions`;
    const existingSuggestions = await kv.get(jeKey) || { suggestions: [] };
    
    const updatedSuggestions = existingSuggestions.suggestions.map((suggestion: any) => {
      const generatedJE = generatedJEs.find((je: any) => je.transactionId === suggestion.id);
      
      if (generatedJE) {
        return {
          ...suggestion,
          sourceItem: {
            ...suggestion.sourceItem,
            suggested_je: {
              debit_account: `${generatedJE.debitAccount} - ${generatedJE.debitAccountName}`,
              credit_account: `${generatedJE.creditAccount} - ${generatedJE.creditAccountName}`,
              amount: generatedJE.amount,
              memo: generatedJE.memo
            }
          }
        };
      }
      
      return suggestion;
    });

    // Save updated suggestions
    existingSuggestions.suggestions = updatedSuggestions;
    await kv.set(jeKey, existingSuggestions);

    return c.json({
      success: true,
      updatedSuggestions: updatedSuggestions,
      count: generatedJEs.length
    });
  } catch (error) {
    console.error('❌ Error in bulk JE generation:', error);
    return c.json({ error: `Failed to generate journal entries: ${error.message}` }, 500);
  }
});

// Update an AI-generated journal entry suggestion
app.post('/journal-entries/update-suggestion', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, suggestionId, updatedJE } = body;
    
    if (!companyId || !period || !suggestionId || !updatedJE) {
      return c.json({ error: 'companyId, period, suggestionId, and updatedJE are required' }, 400);
    }

    console.log(`✏️ Updating JE suggestion:`, suggestionId);

    // Get the suggestions
    const jeKey = `journal-entries:${companyId}:${period}:suggestions`;
    const existingSuggestions = await kv.get(jeKey) || { suggestions: [] };
    
    // Find and update the suggestion
    const suggestionIndex = existingSuggestions.suggestions.findIndex((s: any) => s.id === suggestionId);
    
    if (suggestionIndex === -1) {
      return c.json({ error: 'Suggestion not found' }, 404);
    }
    
    // Update the suggested_je data
    existingSuggestions.suggestions[suggestionIndex] = {
      ...existingSuggestions.suggestions[suggestionIndex],
      sourceItem: {
        ...existingSuggestions.suggestions[suggestionIndex].sourceItem,
        suggested_je: updatedJE
      }
    };
    
    // Save updated suggestions
    await kv.set(jeKey, existingSuggestions);

    console.log('✅ JE suggestion updated successfully');
    return c.json({ success: true, updated: existingSuggestions.suggestions[suggestionIndex] });
  } catch (error) {
    console.error('❌ Error updating JE suggestion:', error);
    return c.json({ error: 'Failed to update JE suggestion' }, 500);
  }
});

// Approve a journal entry suggestion and move it to Ready to Export
app.post('/journal-entries/approve', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, suggestionId } = body;
    
    if (!companyId || !period || !suggestionId) {
      return c.json({ error: 'companyId, period, and suggestionId are required' }, 400);
    }

    console.log(`✅ Approving JE suggestion:`, suggestionId);

    // Get the suggestion
    const jeKey = `journal-entries:${companyId}:${period}:suggestions`;
    const existingSuggestions = await kv.get(jeKey) || { suggestions: [] };
    
    // Find the suggestion to approve
    const suggestionToApprove = existingSuggestions.suggestions.find((s: any) => s.id === suggestionId);
    
    if (!suggestionToApprove) {
      return c.json({ error: 'Suggestion not found' }, 404);
    }
    
    console.log('📋 Suggestion to approve:', JSON.stringify(suggestionToApprove, null, 2));
    
    if (!suggestionToApprove.sourceItem.suggested_je) {
      return c.json({ error: 'No journal entry suggestion to approve' }, 400);
    }
    
    // Remove from suggestions
    existingSuggestions.suggestions = existingSuggestions.suggestions.filter((s: any) => s.id !== suggestionId);
    await kv.set(jeKey, existingSuggestions);

    // Create a ready-to-export journal entry
    const je = suggestionToApprove.sourceItem.suggested_je;
    const isBank = suggestionToApprove.sourceType === 'bank';
    
    // Extract transaction data based on source type
    let transaction;
    if (isBank) {
      transaction = suggestionToApprove.sourceItem.transaction;
    } else {
      // For ledger/AP entries, the entry might be at different levels
      transaction = suggestionToApprove.sourceItem.entry || suggestionToApprove.sourceItem;
    }
    
    console.log('📝 Transaction data:', JSON.stringify(transaction, null, 2));
    
    if (!transaction || !transaction.date) {
      console.error('❌ Invalid transaction structure:', suggestionToApprove);
      return c.json({ error: 'Invalid transaction data structure' }, 400);
    }
    
    const readyJE = {
      id: `je_ready_${Date.now()}`,
      date: transaction.date,
      description: transaction.description,
      lines: [
        {
          account: je.debit_account.split(' - ')[1] || je.debit_account,
          accountCode: je.debit_account.split(' - ')[0] || je.debit_account,
          debit: je.amount.toString(),
          credit: '0',
          memo: je.memo || ''
        },
        {
          account: je.credit_account.split(' - ')[1] || je.credit_account,
          accountCode: je.credit_account.split(' - ')[0] || je.credit_account,
          debit: '0',
          credit: je.amount.toString(),
          memo: je.memo || ''
        }
      ],
      totalDebit: je.amount,
      totalCredit: je.amount,
      isBalanced: true,
      createdAt: new Date().toISOString(),
      createdBy: 'AI',
      status: 'ready'
    };
    
    // Add to ready-to-export
    const readyKey = `journal-entries:${companyId}:${period}:ready`;
    const existingReady = await kv.get(readyKey) || { entries: [] };
    const countBefore = existingReady.entries.length;
    existingReady.entries.push(readyJE);
    const countAfter = existingReady.entries.length;
    await kv.set(readyKey, existingReady);

    console.log('✅ JE approved and moved to Ready to Export');
    console.log('Ready JE created:', JSON.stringify(readyJE, null, 2));
    console.log('Total ready entries now:', existingReady.entries.length);
    console.log('🔑 Saved to key:', readyKey);
    console.log('💾 Data saved to KV:', JSON.stringify(existingReady, null, 2));
    
    // Verify the save by reading it back immediately
    const verifyRead = await kv.get(readyKey);
    console.log('🔍 Verification read from KV:', JSON.stringify(verifyRead, null, 2));
    console.log('🔍 Verification count:', verifyRead?.entries?.length || 0);
    
    return c.json({ 
      success: true, 
      ready_je_id: readyJE.id,
      debug: {
        key: readyKey,
        countBefore,
        countAfter,
        verifyCount: verifyRead?.entries?.length || 0,
        savedSuccessfully: (verifyRead?.entries?.length || 0) === countAfter
      }
    });
  } catch (error) {
    console.error('❌ Error approving JE:', error);
    return c.json({ error: 'Failed to approve journal entry' }, 500);
  }
});

// Create a reversing journal entry from a ledger transaction
// This flips the debits and credits to effectively cancel out the original JE
app.post('/journal-entries/reverse-je', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, item } = body;
    
    if (!companyId || !period || !item) {
      return c.json({ error: 'companyId, period, and item are required' }, 400);
    }

    console.log(`🔄 Creating reversing JE for ledger entry:`, companyId, period);

    // Generate a unique ID for this reversing JE suggestion
    const suggestionId = `${companyId}-${period}-reverse-${Date.now()}`;
    
    // Extract the ledger entry details
    const ledgerEntry = item.entry;
    
    // Create a suggested journal entry record WITHOUT AI suggestion initially
    // User will choose to either generate AI suggestion or manually record
    const suggestedJE = {
      id: suggestionId,
      companyId,
      period,
      sourceType: 'ledger-reversal',
      sourceItem: {
        entry: item.entry,
        reason: item.reason,
        action: item.action,
        // Explicitly exclude suggested_je - no AI suggestion initially
        // User will generate or manually create the reversal entry
      },
      status: 'draft',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      suggestedEntry: null, // Will be populated when user generates AI suggestion
    };

    // Store in KV store for journal entries
    const jeKey = `journal-entries:${companyId}:${period}:suggestions`;
    const existingSuggestions = await kv.get(jeKey) || { suggestions: [] };
    
    existingSuggestions.suggestions.push(suggestedJE);
    
    await kv.set(jeKey, existingSuggestions);

    // Remove the item from the reconciliation unmatched ledger list
    const recKey = `bank-rec:${companyId}:${period}:reconciliation`;
    const reconciliationData = await kv.get(recKey);
    
    if (reconciliationData && reconciliationData.unmatched_ledger) {
      // Find and remove the item from unmatched_ledger
      reconciliationData.unmatched_ledger = reconciliationData.unmatched_ledger.filter((unmatchedItem: any) => {
        const entry = unmatchedItem.entry;
        const itemEntry = item.entry;
        return !(
          entry.date === itemEntry.date &&
          entry.description === itemEntry.description &&
          entry.amount === itemEntry.amount
        );
      });
      
      // Update summary counts
      if (reconciliationData.summary) {
        reconciliationData.summary.unmatched_ledger_count = reconciliationData.unmatched_ledger.length;
      }
      
      // Save the updated reconciliation data
      await kv.set(recKey, reconciliationData);
      console.log(`✅ Removed ledger item from reconciliation list for reversal`);
      
      // Add to resolved bucket
      const resolvedKey = `bank-rec:${companyId}:${period}:resolved`;
      const existingResolved = await kv.get(resolvedKey) || { items: [] };
      
      existingResolved.items.push({
        type: 'ledger',
        item,
        markedAt: new Date().toISOString(),
        status: 'resolved',
        resolution: 'Reversing journal entry sent to Journal Entries section'
      });
      
      await kv.set(resolvedKey, existingResolved);
    }

    console.log('✅ Reversing JE created and sent to Draft/Suggested tab');
    return c.json({ 
      success: true, 
      message: 'Reversing JE created successfully',
      suggestionId 
    });
  } catch (error) {
    console.error('❌ Error creating reversing JE:', error);
    return c.json({ error: 'Failed to create reversing JE' }, 500);
  }
});

// Export journal entries to various formats
app.post('/journal-entries/export', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, format, entries } = body;

    if (!companyId || !period || !format || !entries || entries.length === 0) {
      return c.json({ error: 'companyId, period, format, and entries are required' }, 400);
    }

    console.log(`📤 Exporting ${entries.length} entries as ${format}`);

    let fileContent: string | Uint8Array;
    let contentType: string;
    let fileExtension: string;
    
    try {
      switch (format) {
        case 'csv':
          fileContent = generateCSV(entries);
          contentType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'excel':
          console.log('🔧 Generating Excel file with ExcelJS...');
          fileContent = await generateExcel(entries);
          console.log('✅ Excel file generated successfully');
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'xlsx';
          break;
        case 'qb-csv':
          fileContent = generateQuickBooksCSV(entries);
          contentType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'iif':
          fileContent = generateIIF(entries);
          contentType = 'text/plain';
          fileExtension = 'iif';
          break;
        case 'xero-csv':
          fileContent = generateXeroCSV(entries);
          contentType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'datev-csv':
          fileContent = generateDATEVCSV(entries);
          contentType = 'text/csv';
          fileExtension = 'csv';
          break;
        default:
          return c.json({ error: 'Unsupported format' }, 400);
      }

      console.log(`📦 Returning ${format} file (${fileExtension})`);
      return new Response(fileContent, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="journal_entries.${fileExtension}"`,
        },
      });
    } catch (formatError) {
      console.error(`❌ Error generating ${format} file:`, formatError);
      console.error('Error stack:', formatError.stack);
      throw formatError;
    }
  } catch (error) {
    console.error('❌ Error exporting entries:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return c.json({ error: `Failed to export entries: ${error.message}` }, 500);
  }
});

// Track export history
app.post('/journal-entries/track-export', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, format, entryIds } = body;

    if (!companyId || !period || !format || !entryIds) {
      return c.json({ error: 'companyId, period, format, and entryIds are required' }, 400);
    }

    console.log(`📊 Tracking export: ${entryIds.length} entries as ${format}`);

    const readyKey = `journal-entries:${companyId}:${period}:ready`;
    const readyData = await kv.get(readyKey) || { entries: [] };

    // Add export history to each entry
    const exportRecord = {
      format,
      exportedAt: new Date().toISOString(),
      exportedBy: 'user'
    };

    readyData.entries = readyData.entries.map((entry: any) => {
      if (entryIds.includes(entry.id)) {
        return {
          ...entry,
          exportHistory: [...(entry.exportHistory || []), exportRecord]
        };
      }
      return entry;
    });

    await kv.set(readyKey, readyData);

    return c.json({ message: 'Export tracked successfully' });
  } catch (error) {
    console.error('❌ Error tracking export:', error);
    return c.json({ error: 'Failed to track export' }, 500);
  }
});

// Mark entries as posted in QB/Xero/DATEV
app.post('/journal-entries/mark-posted', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period } = body;

    if (!companyId || !period) {
      return c.json({ error: 'companyId and period are required' }, 400);
    }

    console.log(`✅ Marking entries as posted for ${companyId} ${period}`);

    const readyKey = `journal-entries:${companyId}:${period}:ready`;
    const postedKey = `journal-entries:${companyId}:${period}:posted`;

    const readyData = await kv.get(readyKey) || { entries: [] };
    const postedData = await kv.get(postedKey) || { entries: [] };

    // Move all entries from ready to posted
    const entriesToPost = readyData.entries.map((entry: any) => ({
      ...entry,
      postedAt: new Date().toISOString(),
      postedBy: 'user'
    }));

    postedData.entries = [...postedData.entries, ...entriesToPost];

    // Clear ready entries
    readyData.entries = [];

    await kv.set(readyKey, readyData);
    await kv.set(postedKey, postedData);

    console.log(`✅ Moved ${entriesToPost.length} entries to Posted`);

    return c.json({ 
      message: 'Entries marked as posted successfully',
      count: entriesToPost.length 
    });
  } catch (error) {
    console.error('❌ Error marking entries as posted:', error);
    return c.json({ error: 'Failed to mark entries as posted' }, 500);
  }
});

// Move entry back to draft for editing
app.post('/journal-entries/move-to-draft', async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, period, entryId } = body;

    console.log(`📝 Moving entry ${entryId} back to draft for company ${companyId}, period ${period}`);

    // Get the entry from ready status
    const readyKey = `je_ready_${companyId}_${period}`;
    const readyEntries = await kv.get(readyKey) || [];
    
    const entryToMove = readyEntries.find((e: any) => e.id === entryId);
    
    if (!entryToMove) {
      console.log('⚠️ Entry not found in ready entries');
      return c.json({ error: 'Entry not found' }, 404);
    }

    // Important: Preserve the createdBy field (AI or Manual)
    const draftEntry = {
      ...entryToMove,
      status: 'suggested',
      movedBackAt: new Date().toISOString(),
    };

    // Remove from ready entries
    const updatedReadyEntries = readyEntries.filter((e: any) => e.id !== entryId);
    await kv.set(readyKey, updatedReadyEntries);

    // Add back to suggested entries
    const suggestedKey = `je_suggested_${companyId}_${period}`;
    const suggestedEntries = await kv.get(suggestedKey) || [];
    const updatedSuggestedEntries = [...suggestedEntries, draftEntry];
    await kv.set(suggestedKey, updatedSuggestedEntries);

    console.log(`✅ Entry ${entryId} moved back to draft successfully (createdBy: ${draftEntry.createdBy})`);

    return c.json({ 
      message: 'Entry moved back to draft successfully',
      entry: draftEntry
    });
  } catch (error) {
    console.error('❌ Error moving entry to draft:', error);
    return c.json({ error: 'Failed to move entry to draft' }, 500);
  }
});

// Helper functions for export formats

function generateCSV(entries: any[]): string {
  let csv = 'JE ID,Date,Description,Account Code,Account Name,Debit,Credit,Memo\n';
  
  entries.forEach(entry => {
    entry.lines.forEach((line: any) => {
      csv += `"${entry.id}","${entry.date}","${entry.description}","${line.accountCode}","${line.account}","${line.debit || ''}","${line.credit || ''}","${line.memo || ''}"\n`;
    });
  });
  
  return csv;
}

function generateQuickBooksCSV(entries: any[]): string {
  let csv = 'Journal No.,Journal Date,Memo,Account,Debits,Credits,Name,Description\n';
  
  entries.forEach(entry => {
    entry.lines.forEach((line: any) => {
      csv += `"${entry.id}","${entry.date}","${entry.description}","${line.accountCode}:${line.account}","${line.debit || ''}","${line.credit || ''}","","${line.memo || ''}"\n`;
    });
  });
  
  return csv;
}

function generateIIF(entries: any[]): string {
  let iif = '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\n';
  iif += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\n';
  iif += '!ENDTRNS\n';
  
  entries.forEach(entry => {
    const firstLine = entry.lines[0];
    const headerAmount = firstLine.debit ? `-${firstLine.debit}` : firstLine.credit;
    iif += `TRNS\t${entry.id}\tGENERAL JOURNAL\t${entry.date}\t${firstLine.accountCode}\t\t\t${headerAmount}\t${entry.id}\t${entry.description}\n`;
    
    entry.lines.slice(1).forEach((line: any) => {
      const amount = line.debit ? line.debit : `-${line.credit}`;
      iif += `SPL\t${entry.id}\tGENERAL JOURNAL\t${entry.date}\t${line.accountCode}\t\t\t${amount}\t${entry.id}\t${line.memo || ''}\n`;
    });
    
    iif += 'ENDTRNS\n';
  });
  
  return iif;
}

function generateXeroCSV(entries: any[]): string {
  let csv = '*JournalNumber,*Date,*AccountCode,Description,*Debit,*Credit,TaxType,TaxAmount,TrackingName1,TrackingOption1,TrackingName2,TrackingOption2\n';
  
  entries.forEach(entry => {
    entry.lines.forEach((line: any) => {
      csv += `"${entry.id}","${entry.date}","${line.accountCode}","${entry.description} - ${line.memo || ''}","${line.debit || ''}","${line.credit || ''}","","","","","",""\n`;
    });
  });
  
  return csv;
}

function generateDATEVCSV(entries: any[]): string {
  // DATEV ASCII format for German accounting
  // Format: Semicolon-separated with specific column order
  // Required columns: Umsatz (amount), Soll/Haben-Kennzeichen (S/H), Konto (account), 
  // Gegenkonto (contra account), Belegdatum (date), Buchungstext (description), Belegfeld 1 (document number)
  
  let csv = 'Umsatz;Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto;BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;Postensperre;Diverse Adressnummer;Geschäftspartnerbank;Sachverhalt;Zinssperre;Beleglink;Beleginfo - Art 1;Beleginfo - Inhalt 1;Beleginfo - Art 2;Beleginfo - Inhalt 2;Beleginfo - Art 3;Beleginfo - Inhalt 3;Beleginfo - Art 4;Beleginfo - Inhalt 4;Beleginfo - Art 5;Beleginfo - Inhalt 5;Beleginfo - Art 6;Beleginfo - Inhalt 6;Beleginfo - Art 7;Beleginfo - Inhalt 7;Beleginfo - Art 8;Beleginfo - Inhalt 8;KOST1;KOST2;Kost-Menge;EU-Land u. UStID;EU-Steuersatz;Abw. Versteuerungsart;Sachverhalt L+L;Funktionsergänzung L+L;BU 49 Hauptfunktionstyp;BU 49 Hauptfunktionsnummer;BU 49 Funktionsergänzung;Zusatzinformation - Art 1;Zusatzinformation - Inhalt 1;Zusatzinformation - Art 2;Zusatzinformation - Inhalt 2;Zusatzinformation - Art 3;Zusatzinformation - Inhalt 3;Zusatzinformation - Art 4;Zusatzinformation - Inhalt 4;Zusatzinformation - Art 5;Zusatzinformation - Inhalt 5;Zusatzinformation - Art 6;Zusatzinformation - Inhalt 6;Zusatzinformation - Art 7;Zusatzinformation - Inhalt 7;Zusatzinformation - Art 8;Zusatzinformation - Inhalt 8;Zusatzinformation - Art 9;Zusatzinformation - Inhalt 9;Zusatzinformation - Art 10;Zusatzinformation - Inhalt 10;Zusatzinformation - Art 11;Zusatzinformation - Inhalt 11;Zusatzinformation - Art 12;Zusatzinformation - Inhalt 12;Zusatzinformation - Art 13;Zusatzinformation - Inhalt 13;Zusatzinformation - Art 14;Zusatzinformation - Inhalt 14;Zusatzinformation - Art 15;Zusatzinformation - Inhalt 15;Zusatzinformation - Art 16;Zusatzinformation - Inhalt 16;Zusatzinformation - Art 17;Zusatzinformation - Inhalt 17;Zusatzinformation - Art 18;Zusatzinformation - Inhalt 18;Zusatzinformation - Art 19;Zusatzinformation - Inhalt 19;Zusatzinformation - Art 20;Zusatzinformation - Inhalt 20;Stück;Gewicht;Zahlweise;Forderungsart;Veranlagungsjahr;Zugeordnete Fälligkeit;Skontotyp;Auftragsnummer;Buchungstyp;Ust-Schlüssel (Anzahlungen);EU-Land (Anzahlungen);Sachverhalt L+L (Anzahlungen);EU-Steuersatz (Anzahlungen);Erlöskonto (Anzahlungen);Herkunft-Kz;Buchungs GUID;KOST-Datum;SEPA-Mandatsreferenz;Skontosperre;Gesellschaftername;Beteiligtennummer;Identifikationsnummer;Zeichnernummer;Postensperre bis;Bezeichnung SoBil-Sachverhalt;Kennzeichen SoBil-Buchung;Festschreibung;Leistungsdatum;Datum Zuord. Steuerperiode\n';
  
  entries.forEach(entry => {
    // Convert date from YYYY-MM-DD to DDMM format for DATEV
    const dateParts = entry.date.split('-');
    const datevDate = dateParts.length === 3 ? `${dateParts[2]}${dateParts[1]}` : entry.date;
    
    entry.lines.forEach((line: any) => {
      // Determine if this is debit (S) or credit (H)
      const amount = line.debit && parseFloat(line.debit) > 0 ? line.debit : line.credit;
      const sollHaben = line.debit && parseFloat(line.debit) > 0 ? 'S' : 'H';
      
      // In DATEV, we need the account and contra account
      // For simplified export, we use the line account as Konto
      const konto = line.accountCode;
      
      // Find the corresponding contra account (opposite side of the journal entry)
      const contraLine = entry.lines.find((l: any) => l !== line);
      const gegenkonto = contraLine ? contraLine.accountCode : '';
      
      // Build DATEV row with minimal required fields
      // Most optional fields are left empty (represented by empty strings between semicolons)
      csv += `${amount};${sollHaben};EUR;;;EUR;${konto};${gegenkonto};;${datevDate};${entry.id};;;"${entry.description}${line.memo ? ' - ' + line.memo : ''}";;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;\n`;
    });
  });
  
  return csv;
}

async function generateExcel(entries: any[]): Promise<Uint8Array> {
  const ExcelJS = await import('npm:exceljs@4.4.0');
  
  // Create a new workbook and worksheet
  const workbook = new ExcelJS.default.Workbook();
  const worksheet = workbook.addWorksheet('Journal Entries');
  
  // Define columns with proper widths
  worksheet.columns = [
    { header: 'JE ID', key: 'jeId', width: 25 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Account Code', key: 'accountCode', width: 15 },
    { header: 'Account Name', key: 'accountName', width: 30 },
    { header: 'Debit', key: 'debit', width: 15 },
    { header: 'Credit', key: 'credit', width: 15 },
    { header: 'Memo', key: 'memo', width: 40 }
  ];
  
  // Style the header row - BOLD with purple background
  const headerRow = worksheet.getRow(1);
  headerRow.height = 20;
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF475569' }  // Calm slate gray
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };
  
  // Add data rows
  entries.forEach(entry => {
    entry.lines.forEach((line: any, index: number) => {
      const row = worksheet.addRow({
        jeId: index === 0 ? entry.id : '',
        date: index === 0 ? entry.date : '',
        description: index === 0 ? entry.description : '',
        accountCode: line.accountCode,
        accountName: line.account,
        debit: line.debit ? parseFloat(line.debit) : '',
        credit: line.credit ? parseFloat(line.credit) : '',
        memo: line.memo || ''
      });
      
      row.height = 18;
      row.font = { size: 11, name: 'Calibri' };
      
      // Apply borders to all cells
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
        
        // Center align date column
        if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        // Right align and format currency columns (Debit and Credit)
        else if (colNumber === 6 || colNumber === 7) {
          if (cell.value) {
            cell.numFmt = '$#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          }
        }
        // Left align text columns
        else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });
    
    // Add a blank row between entries for visual separation
    const blankRow = worksheet.addRow({});
    blankRow.height = 10;
  });
  
  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export default app;