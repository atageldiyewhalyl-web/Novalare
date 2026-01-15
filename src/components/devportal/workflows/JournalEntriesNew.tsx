import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, Trash2, Download, Clock, CheckCircle2, AlertCircle, Settings, Building2, ChevronDown, Calendar, Send, X, Loader2, Edit, BookOpen, Search } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { Account } from '@/utils/coa-templates';
import { companiesApi, Company } from '@/utils/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/utils/currency';

interface JournalEntriesProps {
  companyId?: string;
  companyName?: string;
  onNavigate?: (view: string, params?: any) => void;
}

interface LineItem {
  account: string;
  accountCode: string;
  debit: string;
  credit: string;
  memo?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  lines: LineItem[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  createdAt: string;
  createdBy: string;
}

export function JournalEntries({ companyId: initialCompanyId, companyName: initialCompanyName, onNavigate }: JournalEntriesProps) {
  const { theme } = useTheme();

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<Account[]>([]);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [accountSearch, setAccountSearch] = useState<{ [key: number]: string }>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [suggestedEntries, setSuggestedEntries] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [isGeneratingJEs, setIsGeneratingJEs] = useState(false);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editedJE, setEditedJE] = useState<any>(null);
  const [debitAccountSearch, setDebitAccountSearch] = useState('');
  const [creditAccountSearch, setCreditAccountSearch] = useState('');
  const [showDebitDropdown, setShowDebitDropdown] = useState(false);
  const [showCreditDropdown, setShowCreditDropdown] = useState(false);
  const [readyEntries, setReadyEntries] = useState<any[]>([]);
  const [isLoadingReady, setIsLoadingReady] = useState(false);
  const [postedEntries, setPostedEntries] = useState<any[]>([]);
  const [isLoadingPosted, setIsLoadingPosted] = useState(false);
  const [activeTab, setActiveTab] = useState('draft');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [activeAccountInput, setActiveAccountInput] = useState<number | null>(null);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  // Export format options (defined outside render for stability)
  const exportFormats = [
    { key: 'csv', label: 'CSV (Universal)', desc: 'Works with any system' },
    { key: 'excel', label: 'Excel (XLSX)', desc: 'Formatted spreadsheet' },
    { key: 'qb-csv', label: 'QuickBooks CSV', desc: 'Ready for QBO import' },
    { key: 'iif', label: 'IIF Format', desc: 'QuickBooks Desktop' },
    { key: 'xero-csv', label: 'Xero CSV', desc: 'Ready for Xero import' },
    { key: 'datev-csv', label: 'DATEV CSV', desc: 'German accounting standard' }
  ];

  // Load companies list
  useEffect(() => {
    if (initialCompanyId) {
      loadCompany(initialCompanyId);
    }

    // Set default period to current month
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    setSelectedPeriod(`${year}-${month}`);
  }, []);

  // Generate period options (current and previous 12 months)
  const generatePeriodOptions = () => {
    const options: { value: string; label: string }[] = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const value = `${year}-${month}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }

    return options;
  };

  const periods = generatePeriodOptions();

  const loadCompany = async (id: string) => {
    try {
      const data = await companiesApi.getById(id);
      setSelectedCompany(data);
    } catch (error) {
      console.error('Failed to load company:', error);
    }
  };

  // Load chart of accounts for selected company - PARALLELIZED
  useEffect(() => {
    if (selectedCompany) {
      // Run both API calls in parallel instead of sequentially
      Promise.all([
        loadChartOfAccounts(),
        loadHistory()
      ]).catch(err => {
        console.error('Error loading company data:', err);
      });
    }
  }, [selectedCompany]);

  // Load suggested entries when company or period changes - PARALLELIZED
  useEffect(() => {
    if (selectedCompany && selectedPeriod) {
      // Run both API calls in parallel instead of sequentially
      Promise.all([
        loadSuggestedEntries(),
        loadReadyEntries()
      ]).catch(err => {
        console.error('Error loading entries:', err);
      });
    }
  }, [selectedCompany, selectedPeriod]);

  // Reload ready entries when switching to the ready tab
  useEffect(() => {
    if (activeTab === 'ready' && selectedCompany && selectedPeriod) {
      console.log('📑 Switching to Ready tab - reloading entries...');
      loadReadyEntries();
    }
  }, [activeTab]);

  // Reload posted entries when switching to the posted tab
  useEffect(() => {
    if (activeTab === 'posted' && selectedCompany && selectedPeriod) {
      console.log('📑 Switching to Posted tab - loading entries...');
      loadPostedEntries();
    }
  }, [activeTab]);

  const loadChartOfAccounts = async () => {
    if (!selectedCompany) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/coa`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setChartOfAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to load chart of accounts for company:', selectedCompany.id, error);
    }
  };

  // Load journal entries for selected company
  const loadHistory = async () => {
    if (!selectedCompany) return;

    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/journal-entries`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to load journal entry history for company:', selectedCompany.id, error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadSuggestedEntries = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/suggestions?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Loaded suggested entries:', data);
        setSuggestedEntries(data.suggestions || []);
      } else {
        console.error('Failed to load suggested entries:', response.status);
        setSuggestedEntries([]);
      }
    } catch (error) {
      console.error('Failed to load suggested entries:', error);
      setSuggestedEntries([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const loadReadyEntries = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingReady(true);
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries?companyId=${selectedCompany.id}&period=${selectedPeriod}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReadyEntries(data.ready || []);
      } else {
        console.error('Failed to load ready entries:', response.status);
        setReadyEntries([]);
      }
    } catch (error) {
      console.error('Failed to load ready entries:', error);
      setReadyEntries([]);
    } finally {
      setIsLoadingReady(false);
    }
  };

  const loadPostedEntries = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingPosted(true);
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries?companyId=${selectedCompany.id}&period=${selectedPeriod}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPostedEntries(data.posted || []);
      } else {
        console.error('Failed to load posted entries:', response.status);
        setPostedEntries([]);
      }
    } catch (error) {
      console.error('Failed to load posted entries:', error);
      setPostedEntries([]);
    } finally {
      setIsLoadingPosted(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: aiPrompt,
            chartOfAccounts: chartOfAccounts,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate journal entry');
      }

      const data = await response.json();

      // Create new entry from AI response
      const newEntry: JournalEntry = {
        id: `je_draft_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        description: data.description,
        lines: data.lines.map((line: any, idx: number) => ({
          account: line.accountName,
          accountCode: line.account,
          debit: line.debit || 0,
          credit: line.credit || 0,
        })),
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
        createdAt: Date.now().toString(),
        createdBy: 'AI',
      };

      setCurrentEntry(newEntry);
      setAiPrompt('');
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Failed to generate journal entry. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addNewLine = () => {
    if (!currentEntry) {
      // Create new blank entry
      const newEntry: JournalEntry = {
        id: `je_draft_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        description: '',
        lines: [{
          account: '',
          accountCode: '',
          debit: '0.00',
          credit: '0.00',
        }],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
        createdAt: Date.now().toString(),
        createdBy: 'User',
      };
      setCurrentEntry(newEntry);
    } else {
      setCurrentEntry({
        ...currentEntry,
        lines: [
          ...currentEntry.lines,
          {
            account: '',
            accountCode: '',
            debit: '0.00',
            credit: '0.00',
          },
        ],
      });
    }
  };

  const removeLine = (lineIndex: number) => {
    if (!currentEntry) return;
    setCurrentEntry({
      ...currentEntry,
      lines: currentEntry.lines.filter((_, index) => index !== lineIndex),
    });
  };

  const updateLine = (lineIndex: number, field: keyof LineItem, value: any) => {
    if (!currentEntry) return;
    setCurrentEntry({
      ...currentEntry,
      lines: currentEntry.lines.map((line, index) =>
        index === lineIndex ? { ...line, [field]: value } : line
      ),
    });
  };

  const selectAccount = (lineIndex: number, accountCode: string) => {
    const account = chartOfAccounts.find(a => a.code === accountCode);
    if (!account) return;

    updateLine(lineIndex, 'account', account.name);
    updateLine(lineIndex, 'accountCode', accountCode);

    // Clear search
    setAccountSearch(prev => ({ ...prev, [lineIndex]: '' }));
    setActiveAccountInput(null);
  };

  const calculateBalance = () => {
    if (!currentEntry) return { debit: 0, credit: 0, balanced: true };

    const debitTotal = currentEntry.lines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0);
    const creditTotal = currentEntry.lines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0);

    return {
      debit: debitTotal,
      credit: creditTotal,
      balanced: Math.abs(debitTotal - creditTotal) < 0.01,
    };
  };

  const postEntry = async () => {
    if (!currentEntry) return;

    const balance = calculateBalance();
    if (!balance.balanced) {
      alert('Entry is not balanced! Debits must equal Credits.');
      return;
    }

    if (!currentEntry.description.trim()) {
      alert('Please add a description for this journal entry.');
      return;
    }

    if (currentEntry.lines.some(line => !line.accountCode)) {
      alert('All lines must have an account selected.');
      return;
    }

    try {
      const postedEntry = {
        ...currentEntry,
        status: 'posted' as const,
        id: `je_${Date.now()}`,
        createdAt: Date.now(),
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany?.id}/journal-entries`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postedEntry),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to post journal entry');
      }

      // Clear current entry and reload history
      setCurrentEntry(null);
      loadHistory();

      alert('Journal entry posted successfully!');
    } catch (error) {
      console.error('Failed to post entry:', error);
      alert('Failed to post journal entry. Please try again.');
    }
  };

  const clearEntry = () => {
    setCurrentEntry(null);
    setAccountSearch({});
  };

  const exportToExcel = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/export`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Export error details:', errorData);
        throw new Error(errorData.details || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Journal_Entries_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export journal entries: ' + error.message);
    }
  };



  // Helper function to get amount from ledger entry (supports both amount and debit/credit fields)
  const getLedgerAmount = (entry: any): number => {
    // If entry has debit field, use it (positive for debits)
    if (entry.debit !== undefined && entry.debit !== null) {
      return entry.debit || 0;
    }
    // If entry has credit field, use it (could be negative)
    if (entry.credit !== undefined && entry.credit !== null) {
      return -(entry.credit || 0); // Negate credits to show as negative
    }
    // Fallback to amount field
    return entry.amount || 0;
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    if (!selectedCompany || !selectedPeriod) return;

    const actionKey = `delete-${suggestionId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from list immediately
    setSuggestedEntries(prev => prev.filter(s => s.id !== suggestionId));

    try {
      // Use reverse-suggestion endpoint to move the item back to bank rec
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/reverse-suggestion`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            suggestionId,
          }),
        }
      );

      if (response.ok) {
        toast.success('Draft deleted and moved back to Bank Rec Review');
      } else {
        const errorText = await response.text();
        console.error('Failed to delete suggestion:', response.status, errorText);
        toast.error('Failed to delete suggestion. Please try again.');
        // Revert optimistic update on error - reload suggestions
        await loadSuggestedEntries();
      }
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      toast.error('Network error. Please check your connection and try again.');
      // Revert optimistic update on error - reload suggestions
      await loadSuggestedEntries();
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleBulkGenerateJEs = async () => {
    if (!selectedCompany || !selectedPeriod || suggestedEntries.length === 0) return;

    setIsGeneratingJEs(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/bulk-generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            transactions: suggestedEntries.map(s => {
              // PRESERVE existing source_account_name from backend if available
              // Only try to find it if not already stored
              let sourceAccountName = s.source_account_name;

              if (!sourceAccountName) {
                // Fallback: try to find source account name from transaction data
                const transaction = s.sourceItem.transaction || s.sourceItem.entry;
                const accountId = transaction?.account_id;
                const sourceAccount = accountId ? chartOfAccounts.find(a => a.id === accountId) : null;
                sourceAccountName = sourceAccount?.name;
              }

              return {
                ...s,
                source_account_name: sourceAccountName
              };
            }),
            chartOfAccounts: chartOfAccounts,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Bulk JE generation result:', data);

        // Update suggested entries with AI-generated JEs
        setSuggestedEntries(data.updatedSuggestions || []);
        toast.success(`Generated ${data.updatedSuggestions?.length || 0} journal entry suggestions`);
      } else {
        const errorText = await response.text();
        console.error('Failed to generate JEs:', response.status, errorText);
        toast.error('Failed to generate journal entries. Please try again.');
      }
    } catch (error) {
      console.error('Error generating JEs:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsGeneratingJEs(false);
    }
  };

  const handleEditSuggestion = (suggestion: any) => {
    setEditingSuggestionId(suggestion.id);

    // Initialize edit state with current JE data or empty values for new manual entries
    const je = suggestion.sourceItem.suggested_je;

    if (je) {
      // Existing AI-generated suggestion - load the data
      setEditedJE({
        debit_account: je.debit_account,
        credit_account: je.credit_account,
        amount: je.amount,
        memo: je.memo || ''
      });
    } else {
      // No suggestion yet - initialize with transaction data for manual entry
      const isBank = suggestion.sourceType === 'bank';
      const transaction = isBank ? suggestion.sourceItem.transaction : suggestion.sourceItem.entry;
      setEditedJE({
        debit_account: '',
        credit_account: '',
        amount: Math.abs(transaction.amount),
        memo: transaction.description || ''
      });
    }

    setDebitAccountSearch('');
    setCreditAccountSearch('');
    setShowDebitDropdown(false);
    setShowCreditDropdown(false);
  };

  const handleCancelEdit = () => {
    setEditingSuggestionId(null);
    setEditedJE(null);
    setDebitAccountSearch('');
    setCreditAccountSearch('');
    setShowDebitDropdown(false);
    setShowCreditDropdown(false);
  };

  const handleSaveEdit = async (suggestionId: string) => {
    if (!selectedCompany || !selectedPeriod || !editedJE) return;

    const actionKey = `save-${suggestionId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/update-suggestion`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            suggestionId,
            updatedJE: editedJE,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update the local state with the saved changes
        setSuggestedEntries(prev => prev.map(s =>
          s.id === suggestionId
            ? { ...s, sourceItem: { ...s.sourceItem, suggested_je: editedJE } }
            : s
        ));

        toast.success('Journal entry updated successfully');
        setEditingSuggestionId(null);
        setEditedJE(null);
      } else {
        const errorText = await response.text();
        console.error('Failed to update suggestion:', response.status, errorText);
        toast.error('Failed to update journal entry. Please try again.');
      }
    } catch (error) {
      console.error('Error updating suggestion:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const selectDebitAccount = (accountString: string) => {
    setEditedJE(prev => ({ ...prev, debit_account: accountString }));
    setShowDebitDropdown(false);
    setDebitAccountSearch('');
  };

  const selectCreditAccount = (accountString: string) => {
    setEditedJE(prev => ({ ...prev, credit_account: accountString }));
    setShowCreditDropdown(false);
    setCreditAccountSearch('');
  };

  const filteredDebitAccounts = () => {
    if (!debitAccountSearch) return chartOfAccounts;
    const searchLower = debitAccountSearch.toLowerCase();
    return chartOfAccounts.filter(
      acc => acc.code.toLowerCase().includes(searchLower) || acc.name.toLowerCase().includes(searchLower)
    );
  };

  const filteredCreditAccounts = () => {
    if (!creditAccountSearch) return chartOfAccounts;
    const searchLower = creditAccountSearch.toLowerCase();
    return chartOfAccounts.filter(
      acc => acc.code.toLowerCase().includes(searchLower) || acc.name.toLowerCase().includes(searchLower)
    );
  };

  const handleApproveJE = async (suggestionId: string) => {
    if (!selectedCompany || !selectedPeriod) return;

    addDebugLog(`🚀 Approving JE: ${suggestionId}`);
    const actionKey = `approve-${suggestionId}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Optimistic update - remove from list immediately
    setSuggestedEntries(prev => prev.filter(s => s.id !== suggestionId));

    try {
      addDebugLog(`📡 Calling /journal-entries/approve`);
      addDebugLog(`📋 POST params: companyId=${selectedCompany.id}, period=${selectedPeriod}`);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            suggestionId,
          }),
        }
      );

      addDebugLog(`📥 Approve response: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        addDebugLog(`✅ Approve success: ${JSON.stringify(result)}`);

        // Display backend debug info if available
        if (result.debug) {
          addDebugLog(`🔍 Backend Debug: Key=${result.debug.key}`);
          addDebugLog(`🔍 Count Before=${result.debug.countBefore}, After=${result.debug.countAfter}`);
          addDebugLog(`🔍 Verify Count=${result.debug.verifyCount}`);
          addDebugLog(`🔍 Saved Successfully=${result.debug.savedSuccessfully}`);
        }

        console.log('✅ Approve response:', result);
        toast.success('Journal entry approved and moved to Ready to Export');

        // Small delay to ensure KV store consistency
        addDebugLog(`⏳ Waiting 100ms for KV store consistency...`);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Reload ready entries to show the new one
        addDebugLog(`🔄 Now reloading ready entries...`);
        await loadReadyEntries();
      } else {
        const errorText = await response.text();
        addDebugLog(`❌ Approve failed: ${response.status} - ${errorText}`);
        console.error('❌ Failed to approve JE:', response.status, errorText);
        toast.error('Failed to approve journal entry. Please try again.');
        // Revert optimistic update on error - reload suggestions
        await loadSuggestedEntries();
      }
    } catch (error) {
      addDebugLog(`❌ Error approving: ${error}`);
      console.error('Error approving JE:', error);
      toast.error('Network error. Please check your connection and try again.');
      // Revert optimistic update on error - reload suggestions
      await loadSuggestedEntries();
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleExport = async (format: string) => {
    if (!selectedCompany || !selectedPeriod || readyEntries.length === 0) {
      toast.error('No entries to export');
      return;
    }

    try {
      console.log(`📥 Exporting ${readyEntries.length} entries as ${format}`);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/export`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            format,
            entries: readyEntries,
          }),
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Determine file extension and name
        const extensions: Record<string, string> = {
          'csv': 'csv',
          'excel': 'xlsx',
          'qb-csv': 'csv',
          'iif': 'iif',
          'xero-csv': 'csv',
          'datev-csv': 'csv'
        };
        const ext = extensions[format] || 'csv';
        const formatNames: Record<string, string> = {
          'csv': 'CSV',
          'excel': 'Excel',
          'qb-csv': 'QuickBooks',
          'iif': 'IIF',
          'xero-csv': 'Xero',
          'datev-csv': 'DATEV'
        };
        const formatName = formatNames[format] || format;

        a.download = `JournalEntries_${selectedCompany.name}_${selectedPeriod}_${formatName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`Exported ${readyEntries.length} entries as ${formatName}`);

        // Track export in backend
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/track-export`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyId: selectedCompany.id,
              period: selectedPeriod,
              format,
              entryIds: readyEntries.map(e => e.id),
            }),
          }
        );

        // Reload entries to show export history
        await loadReadyEntries();
      } else {
        const errorText = await response.text();
        console.error('Export failed:', errorText);
        toast.error('Failed to export entries');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Network error during export');
    }
  };

  const handleMarkAsPosted = async () => {
    if (!selectedCompany || !selectedPeriod || readyEntries.length === 0) {
      toast.error('No entries to mark as posted');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/mark-posted`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
          }),
        }
      );

      if (response.ok) {
        toast.success(`Marked ${readyEntries.length} entries as posted in QB/Xero/DATEV`);
        setReadyEntries([]);
        // TODO: Reload posted entries when we implement that tab
      } else {
        const errorText = await response.text();
        console.error('Mark as posted failed:', errorText);
        toast.error('Failed to mark entries as posted');
      }
    } catch (error) {
      console.error('Mark as posted error:', error);
      toast.error('Network error');
    }
  };

  const handleReExport = async (format: string) => {
    if (!selectedCompany || !selectedPeriod || postedEntries.length === 0) {
      toast.error('No entries to re-export');
      return;
    }

    try {
      console.log(`📥 Re-exporting ${postedEntries.length} posted entries as ${format}`);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/export`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            format,
            entries: postedEntries,
          }),
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Determine file extension and name
        const extensions: Record<string, string> = {
          'csv': 'csv',
          'excel': 'xlsx',
          'qb-csv': 'csv',
          'iif': 'iif',
          'xero-csv': 'csv',
          'datev-csv': 'csv'
        };
        const ext = extensions[format] || 'csv';
        const formatNames: Record<string, string> = {
          'csv': 'CSV',
          'excel': 'Excel',
          'qb-csv': 'QuickBooks',
          'iif': 'IIF',
          'xero-csv': 'Xero',
          'datev-csv': 'DATEV'
        };
        const formatName = formatNames[format] || format;

        a.download = `JournalEntries_Posted_${selectedCompany.name}_${selectedPeriod}_${formatName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`Re-exported ${postedEntries.length} posted entries as ${formatName}`);

        // Track export in backend
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/track-export`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyId: selectedCompany.id,
              period: selectedPeriod,
              format,
              entryIds: postedEntries.map(e => e.id),
            }),
          }
        );

        // Reload entries to show updated export history
        await loadPostedEntries();
      } else {
        const errorText = await response.text();
        console.error('Re-export failed:', errorText);
        toast.error('Failed to re-export entries');
      }
    } catch (error) {
      console.error('Re-export error:', error);
      toast.error('Network error during re-export');
    }
  };

  const handleMoveBackToDraft = async (entry: any) => {
    if (!selectedCompany || !selectedPeriod) {
      toast.error('Please select a company and period');
      return;
    }

    try {
      console.log(`📝 Moving entry ${entry.id} back to draft for editing`);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/journal-entries/move-to-draft`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            entryId: entry.id,
          }),
        }
      );

      if (response.ok) {
        toast.success('Entry moved back to draft - you can now edit it');

        // Optimistically update UI - remove from ready entries
        setReadyEntries(prev => prev.filter(e => e.id !== entry.id));

        // Add to suggested entries with status 'suggested'
        setSuggestedEntries(prev => [...prev, { ...entry, status: 'suggested' }]);

        // Reload both tabs to ensure consistency
        await Promise.all([
          loadSuggestedEntries(),
          loadReadyEntries()
        ]);
      } else {
        const errorText = await response.text();
        console.error('Move to draft failed:', errorText);
        toast.error('Failed to move entry back to draft');
      }
    } catch (error) {
      console.error('Move to draft error:', error);
      toast.error('Network error while moving entry');
    }
  };

  const balance = calculateBalance();
  const filteredAccounts = (lineIndex: number) => {
    const search = accountSearch[lineIndex] || '';
    if (!search) return chartOfAccounts;

    const searchLower = search.toLowerCase();
    return chartOfAccounts.filter(
      acc => acc.code.includes(searchLower) || acc.name.toLowerCase().includes(searchLower)
    );
  };

  return (
    <div className="space-y-6 pb-64">
      {/* Header - Ultra Premium */}
      <div className="relative mb-8">
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-16 bg-[#65D3FD] rounded-full hidden lg:block shadow-[0_0_15px_rgba(101,211,253,0.5)]" />
        <div className="flex justify-between items-end">
          <div>
            <h1
              className={`text-5xl font-black tracking-tighter mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Journal Entries
            </h1>
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400" style={{ fontFamily: "'Manrope', sans-serif" }}>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${theme === 'dark' ? 'bg-[#65D3FD]/10 text-[#65D3FD] border-[#65D3FD]/20' : 'bg-[#65D3FD]/5 text-[#65D3FD] border-[#65D3FD]/10'}`}>
                AI-Powered
              </span>
              <div className="size-1 rounded-full bg-gray-500 opacity-30" />
              <span className="text-sm font-bold tracking-tight">Create & Manage Adjustments</span>
            </div>
          </div>

          {/* Period Selector - Premium Style */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={`
                    h-12 px-6 gap-3 rounded-xl border transition-all duration-300
                    ${theme === 'dark'
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white hover:border-[#65D3FD]/30'
                      : 'bg-white border-gray-200 hover:border-[#65D3FD]/30 text-gray-900'}
                  `}
                >
                  <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-[#65D3FD]/20' : 'bg-[#65D3FD]/10'}`}>
                    <Calendar className="size-4 text-[#65D3FD]" />
                  </div>
                  <span className="font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {periods.find(p => p.value === selectedPeriod)?.label || selectedPeriod}
                  </span>
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={`w-56 p-2 rounded-xl backdrop-blur-xl border ${theme === 'dark' ? 'bg-[#0a0a0f]/90 border-white/10' : 'bg-white/90 border-gray-100'}`}>
                {periods.map((period) => (
                  <DropdownMenuItem
                    key={period.value}
                    onClick={() => setSelectedPeriod(period.value)}
                    className={`
                      rounded-lg py-2.5 px-3 cursor-pointer font-medium transition-colors
                      ${selectedPeriod === period.value
                        ? (theme === 'dark' ? 'bg-[#65D3FD]/20 text-[#65D3FD]' : 'bg-[#65D3FD]/10 text-[#65D3FD]')
                        : (theme === 'dark' ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50')}
                    `}
                  >
                    {period.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedCompany && onNavigate && (
              <Button
                variant="outline"
                className={`
                  h-12 px-4 rounded-xl border transition-all duration-300
                  ${theme === 'dark'
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white hover:border-[#65D3FD]/30'
                    : 'bg-white border-gray-200 hover:border-[#65D3FD]/30 text-gray-900'}
                `}
                onClick={() => onNavigate('company', { companyId: selectedCompany.id, activeTab: 'coa' })}
              >
                <BookOpen className="size-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Magical AI Generator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group rounded-3xl p-1"
      >
        <div className="relative transition-all">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-gradient-to-br from-[#65D3FD]/20 to-[#4F5CFE]/20' : 'bg-gradient-to-br from-[#65D3FD]/10 to-[#4F5CFE]/10'}`}>
                <Sparkles className="size-5 text-[#65D3FD]" />
              </div>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                AI Journal Entry Generator
              </h2>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe the entry (e.g., 'Record $5,000 rent payment for December to Rent Expense')"
                  className={`
                    h-14 pl-6 pr-4 rounded-xl text-base transition-all border-2
                    ${theme === 'dark'
                      ? 'bg-white/5 border-white/5 focus:border-[#65D3FD]/50 text-white placeholder:text-gray-500'
                      : 'bg-gray-50 border-gray-100 focus:border-[#65D3FD]/50 text-gray-900 placeholder:text-gray-400'}
                  `}
                  onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                />
              </div>
              <Button
                onClick={handleAIGenerate}
                disabled={isGenerating || !aiPrompt.trim()}
                className="h-14 px-8 rounded-xl font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 disabled:hover:scale-100 text-gray-900 border-0 shadow-lg shadow-[#65D3FD]/25 hover:shadow-[#65D3FD]/40 hover:scale-[1.02]"
                style={{ backgroundColor: '#65D3FD' }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-5 mr-2" />
                    Generate Entry
                  </>
                )}
              </Button>
            </div>

            {/* Examples Row */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1.5 mr-2">Try:</span>
              {['Record $3500 rent for Jan', 'Accrue $1200 salary', 'Depreciate equipment $500'].map((example) => (
                <button
                  key={example}
                  onClick={() => setAiPrompt(example)}
                  className={`
                    text-xs px-3 py-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95
                    ${theme === 'dark'
                      ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-[#65D3FD] hover:border-[#65D3FD]/30'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-white hover:text-[#65D3FD] hover:border-[#65D3FD]/50'}
                  `}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Manual Entry Editor */}
      {/* Manual Entry Editor - Ultra Premium Redesign */}
      {currentEntry && (
        <Card className={`
          relative border-0 shadow-2xl backdrop-blur-xl transition-all duration-300 mb-8 z-10
          ${theme === 'dark' ? 'bg-[#0a0a0f]/80 shadow-black/20' : 'bg-white/90 shadow-gray-200/50'}
        `}>
          {/* Top Gradient Line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#65D3FD] via-purple-500 to-[#65D3FD] opacity-50 rounded-t-xl" />

          <CardHeader className="pb-6 border-b border-gray-100 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Journal Entry Editor
                </CardTitle>
                <p className={`text-sm mt-1 font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Create or edit complex double-entry journals
                </p>
              </div>
              <div className="flex items-center gap-3">
                {balance.balanced ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20 px-3 py-1.5 h-auto text-xs font-bold gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    BALANCED
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20 px-3 py-1.5 h-auto text-xs font-bold gap-1.5">
                    <AlertCircle className="size-3.5" />
                    OFF BY {formatCurrency(Math.abs(balance.debit - balance.credit))}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-8 px-8">
            {/* Entry Header inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Date
                </label>
                <div className="relative group">
                  <Input
                    type="date"
                    value={currentEntry.date}
                    onChange={(e) => setCurrentEntry({ ...currentEntry, date: e.target.value })}
                    className={`
                      h-12 font-medium transition-all
                      ${theme === 'dark'
                        ? 'bg-white/5 border-white/10 text-white focus:border-[#65D3FD]/50 focus:ring-[#65D3FD]/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#65D3FD] focus:ring-[#65D3FD]/20'}
                    `}
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Description
                </label>
                <Input
                  value={currentEntry.description}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, description: e.target.value })}
                  placeholder="Enter a description for this journal entry..."
                  className={`
                    h-12 font-medium transition-all
                    ${theme === 'dark'
                      ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#65D3FD]/50 focus:ring-[#65D3FD]/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#65D3FD] focus:ring-[#65D3FD]/20'}
                  `}
                />
              </div>
            </div>

            {/* Lines Table */}
            <div className={`
              rounded-xl border relative z-0
              ${theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-white'}
            `}>
              <table className="w-full">
                <thead className={theme === 'dark' ? 'bg-white/5' : 'bg-gray-50/50'}>
                  <tr>
                    <th className={`text-left py-4 px-6 text-xs font-bold uppercase tracking-wider w-[30%] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Account</th>
                    <th className={`text-right py-4 px-6 text-xs font-bold uppercase tracking-wider w-[15%] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Debit</th>
                    <th className={`text-right py-4 px-6 text-xs font-bold uppercase tracking-wider w-[15%] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Credit</th>
                    <th className={`text-left py-4 px-6 text-xs font-bold uppercase tracking-wider w-[30%] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Memo</th>
                    <th className="w-[10%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {currentEntry.lines.map((line, index) => (
                    <tr key={index} className="group hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-6 align-top">
                        {line.accountCode ? (
                          <div className="flex flex-col pt-2 group/selected">
                            <span className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              {line.account}
                            </span>
                            <span className={`text-xs font-mono truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              {line.accountCode}
                            </span>
                            <button
                              onClick={() => updateLine(index, 'accountCode', '')}
                              className="text-[10px] font-bold text-[#65D3FD] hover:text-[#5BC3EB] uppercase tracking-wide text-left mt-1 opacity-0 group-hover/selected:opacity-100 transition-opacity duration-200"
                              style={{ fontFamily: "'Manrope', sans-serif" }}
                            >
                              Change Account
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="relative group/input">
                              <Input
                                value={accountSearch[index] || ''}
                                onChange={(e) => setAccountSearch({ ...accountSearch, [index]: e.target.value })}
                                onFocus={() => setActiveAccountInput(index)}
                                onBlur={() => setTimeout(() => setActiveAccountInput(null), 200)}
                                placeholder="Search by number or name..."
                                className={`
                                  h-10 text-sm transition-all duration-200
                                  ${theme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-[#65D3FD]/50 focus:ring-[#65D3FD]/20 placeholder:text-gray-600'
                                    : 'bg-white border-gray-200 text-gray-900 focus:border-[#65D3FD] focus:ring-[#65D3FD]/20 placeholder:text-gray-400'}
                                `}
                                autoFocus
                                style={{ fontFamily: "'Manrope', sans-serif" }}
                              />
                            </div>

                            {activeAccountInput === index && (
                              <div className={`
                                absolute z-[100] mt-1 w-[400px] rounded-xl shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-200
                                ${theme === 'dark'
                                  ? 'bg-[#1a1a2e] border-white/10 shadow-black/80'
                                  : 'bg-white border-gray-100 shadow-2xl ring-1 ring-black/5'}
                              `}>
                                <div className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b flex items-center gap-2 ${theme === 'dark' ? 'text-gray-500 border-white/5' : 'text-gray-400 border-gray-100'}`}>
                                  <Search className="size-3" />
                                  Select Account
                                </div>
                                <div
                                  className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 overscroll-contain"
                                  style={{ maxHeight: '320px' }}
                                >
                                  {filteredAccounts(index).slice(0, 50).map((acc) => (
                                    <button
                                      key={acc.code}
                                      onClick={() => selectAccount(index, acc.code)}
                                      className={`
                                        w-full text-left px-4 py-2 text-sm transition-all duration-150 border-l-2 border-transparent group/item
                                        ${theme === 'dark'
                                          ? 'hover:bg-white/5 hover:border-[#65D3FD]'
                                          : 'hover:bg-gray-50 hover:border-[#65D3FD]'}
                                      `}
                                    >
                                      <div className="flex items-center justify-between gap-3 mb-0.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={`text-xs font-mono group-hover/item:text-[#65D3FD] transition-colors ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {acc.code}
                                          </span>
                                          <span className={`text-sm font-bold transition-colors ${theme === 'dark' ? 'text-white group-hover/item:text-white' : 'text-gray-900 group-hover/item:text-gray-900'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                            {acc.name}
                                          </span>
                                        </div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${theme === 'dark' ? 'bg-white/10 text-gray-400 group-hover/item:bg-[#65D3FD]/10 group-hover/item:text-[#65D3FD]' : 'bg-gray-100 text-gray-500 group-hover/item:bg-[#65D3FD]/10 group-hover/item:text-[#65D3FD]'}`}>
                                          {acc.type}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                  {filteredAccounts(index).length === 0 && (
                                    <div className="p-8 text-center">
                                      <Search className={`size-8 mx-auto mb-2 opacity-20 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
                                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>No accounts found</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-6 align-top">
                        <Input
                          type="number"
                          step="0.01"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(index, 'debit', e.target.value)}
                          placeholder="0.00"
                          className={`
                            h-10 text-right font-mono font-medium
                            ${theme === 'dark' ? 'bg-transparent border-transparent focus:bg-white/5 focus:border-[#65D3FD]/50 text-white placeholder:text-gray-700' : 'bg-transparent border-transparent focus:bg-white focus:border-[#65D3FD] text-gray-900 placeholder:text-gray-300'}
                          `}
                        />
                      </td>
                      <td className="py-3 px-6 align-top">
                        <Input
                          type="number"
                          step="0.01"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(index, 'credit', e.target.value)}
                          placeholder="0.00"
                          className={`
                            h-10 text-right font-mono font-medium
                            ${theme === 'dark' ? 'bg-transparent border-transparent focus:bg-white/5 focus:border-[#65D3FD]/50 text-white placeholder:text-gray-700' : 'bg-transparent border-transparent focus:bg-white focus:border-[#65D3FD] text-gray-900 placeholder:text-gray-300'}
                          `}
                        />
                      </td>
                      <td className="py-3 px-6 align-top">
                        <Input
                          value={line.memo}
                          onChange={(e) => updateLine(index, 'memo', e.target.value)}
                          placeholder="Memo"
                          className={`
                            h-10 text-sm
                            ${theme === 'dark' ? 'bg-transparent border-transparent focus:bg-white/5 focus:border-[#65D3FD]/50 text-white placeholder:text-gray-700' : 'bg-transparent border-transparent focus:bg-white focus:border-[#65D3FD] text-gray-900 placeholder:text-gray-300'}
                          `}
                        />
                      </td>
                      <td className="py-3 px-6 align-middle text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          className="size-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className={theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}>
                    <td className={`py-4 px-6 text-sm font-bold text-right ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>TOTALS</td>
                    <td className={`py-4 px-6 text-sm font-mono font-bold text-right ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(balance.debit)}</td>
                    <td className={`py-4 px-6 text-sm font-mono font-bold text-right ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(balance.credit)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>

              {/* Add Line Button (Bottom of table) */}
              <div className={`p-2 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                <Button
                  variant="ghost"
                  onClick={addNewLine}
                  className={`w-full h-10 gap-2 border-dashed border ${theme === 'dark' ? 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  <Plus className="size-4" />
                  Add Journal Line
                </Button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-4 pt-4">
              <Button
                variant="ghost"
                onClick={clearEntry}
                className={`text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10`}
              >
                Clear Form
              </Button>
              <Button
                onClick={postEntry}
                disabled={!balance.balanced}
                className={`
                  h-11 px-8 rounded-xl font-bold transition-all active:scale-95 disabled:cursor-not-allowed
                  text-gray-900 border-0 shadow-lg shadow-[#65D3FD]/25 hover:shadow-[#65D3FD]/40 hover:scale-[1.02]
                  disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-white/5 dark:disabled:text-gray-500
                `}
                style={{ backgroundColor: !balance.balanced ? undefined : '#65D3FD' }}
              >
                Post Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {!currentEntry && (
        <div className="flex items-center justify-center pt-6">
          <Button
            onClick={addNewLine}
            variant="outline"
            className="gap-2 h-12"
          >
            <Plus className="size-4" />
            Create Manual Entry
          </Button>
        </div>
      )}

      {/* Journal Entry Tabs - Premium Pill Style */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList className="h-auto p-1 bg-gray-100 dark:bg-white/5 rounded-full border-0">
            {[
              { id: 'draft', label: 'Draft / Suggested' },
              { id: 'ready', label: 'Ready to Export' },
              { id: 'posted', label: 'Posted' }
            ].map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="
                  rounded-full px-6 py-2 text-sm font-medium transition-all
                  data-[state=active]:bg-white dark:data-[state=active]:bg-white/10
                  data-[state=active]:text-gray-900 dark:data-[state=active]:text-white
                  data-[state=active]:shadow-sm
                  text-gray-500 dark:text-gray-400
                  hover:text-gray-700 dark:hover:text-gray-200
                "
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* TAB 1 - Draft / Suggested */}
        <TabsContent value="draft">
          <Card className={`
            overflow-hidden border-0 shadow-xl backdrop-blur-xl
            ${theme === 'dark' ? 'bg-[#0a0a0f]/80 shadow-black/20' : 'bg-white/80 shadow-gray-200/50'}
          `}>
            <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Draft & Suggested Entries
                  </CardTitle>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Review, edit, and approve entries before exporting
                  </p>
                </div>
                {suggestedEntries.length > 0 && (
                  <Badge variant="outline" className={`
                    px-3 py-1 rounded-full text-xs font-bold border
                    ${theme === 'dark'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-amber-50 text-amber-600 border-amber-200'}
                  `}>
                    {suggestedEntries.length} Pending Review
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingSuggestions ? (
                <div className={theme === 'premium-dark' ? 'text-center py-12 text-white/60' : 'text-center py-12 text-gray-500'}>
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto mb-3" />
                  Loading suggested entries...
                </div>
              ) : suggestedEntries.length === 0 ? (
                <div className={theme === 'premium-dark' ? 'text-center py-12 text-white/60' : 'text-center py-12 text-gray-500'}>
                  No draft or suggested entries at this time.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Bulk AI Generation Section */}
                  <div className={theme === 'premium-dark' ? 'border border-white/10 rounded-lg p-4 bg-white/[0.02]' : 'border border-gray-200 rounded-lg p-4 bg-gray-50/50'}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="size-5 text-purple-600" />
                          <h3 className={theme === 'premium-dark' ? 'font-medium text-white' : 'font-medium text-gray-900'}>AI Journal Entry Generator</h3>
                        </div>
                        <p className={theme === 'premium-dark' ? 'text-sm text-white/60' : 'text-sm text-gray-600'}>
                          Generate detailed journal entry suggestions for all {suggestedEntries.length} transaction{suggestedEntries.length !== 1 ? 's' : ''} using AI
                        </p>
                      </div>
                      <Button
                        onClick={handleBulkGenerateJEs}
                        disabled={isGeneratingJEs || chartOfAccounts.length === 0}
                        className={theme === 'premium-dark' ? 'gap-2 bg-white text-black hover:bg-white/90 rounded-xl ml-4' : 'gap-2 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-gray-900 rounded-xl ml-4'}
                      >
                        {isGeneratingJEs ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4" />
                            Generate JE Suggestions for All
                          </>
                        )}
                      </Button>
                    </div>
                    {chartOfAccounts.length === 0 && (
                      <div className="mt-3 flex items-center gap-2 text-orange-600 text-sm">
                        <AlertCircle className="size-4" />
                        <span>Chart of Accounts required for AI generation</span>
                      </div>
                    )}
                  </div>

                  {/* Transaction List */}
                  {suggestedEntries.map((suggestion) => {
                    const sourceItem = suggestion.sourceItem;
                    const isBank = suggestion.sourceType === 'bank';
                    const isCC = suggestion.sourceType === 'cc';
                    const isReversal = suggestion.sourceType === 'ledger-reversal';
                    const isVendor = suggestion.sourceType === 'vendor';
                    const isAP = suggestion.sourceType === 'ap';

                    // Get the base transaction/entry object
                    const baseTransaction = isBank || isCC ? sourceItem.transaction : (isVendor ? sourceItem.transaction : sourceItem.entry);

                    // Normalize transaction to ensure it has an amount field
                    // For ledger entries, use getLedgerAmount helper to handle debit/credit fields
                    const transaction = (isReversal || (!isBank && !isCC && !isVendor))
                      ? { ...baseTransaction, amount: getLedgerAmount(baseTransaction) }
                      : baseTransaction;

                    const hasJESuggestion = sourceItem.suggested_je != null;
                    // For AP/Vendor transactions, reverse color logic (payables = red, payments = green)
                    const isPayable = isVendor || isAP;

                    // Safety check - skip if transaction is undefined
                    if (!transaction) {
                      console.error('Transaction is undefined for suggestion:', suggestion);
                      return null;
                    }

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={suggestion.id}
                        className={`
                          group border rounded-xl p-6 transition-all duration-300 relative overflow-hidden
                          ${theme === 'dark'
                            ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-[#65D3FD]/30 shadow-lg shadow-black/10'
                            : 'bg-white border-gray-100 hover:border-[#65D3FD]/30 shadow-sm hover:shadow-md'}
                        `}
                      >
                        {/* Hover Gradient Border Effect */}
                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[#65D3FD] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={theme === 'premium-dark' ? 'text-xs text-white/40' : 'text-xs text-gray-500'}>
                                {transaction.date}
                              </span>
                              <span className={theme === 'premium-dark' ? 'text-xs text-white/20' : 'text-xs text-gray-300'}>•</span>
                              <span className={theme === 'premium-dark' ? 'text-xs text-white/40' : 'text-xs text-gray-500'}>
                                {isReversal ? 'Ledger Reversal' : isBank ? 'Bank Rec' : isCC ? 'CC Rec' : isVendor ? 'AP Rec (Vendor)' : isAP ? 'AP Rec (AP)' : 'Ledger Rec'}
                              </span>
                              {hasJESuggestion && (
                                <>
                                  <span className={theme === 'premium-dark' ? 'text-xs text-white/20' : 'text-xs text-gray-300'}>•</span>
                                  <span className="text-xs text-purple-600 flex items-center gap-1">
                                    <Sparkles className="size-3" />
                                    AI Generated
                                  </span>
                                </>
                              )}
                            </div>
                            <p className={theme === 'premium-dark' ? 'text-white mb-2' : 'text-gray-900 mb-2'}>{transaction.description}</p>
                            {sourceItem.suggested_action && !hasJESuggestion && (
                              <p className={theme === 'premium-dark' ? 'text-sm text-white/50' : 'text-sm text-gray-600'}>
                                <span className="font-medium">Suggested Action:</span> {sourceItem.suggested_action}
                              </p>
                            )}
                            {hasJESuggestion && (
                              <div className="mt-4">
                                {editingSuggestionId === suggestion.id && editedJE ? (
                                  // EDIT MODE
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-gray-500 text-xs mb-1 block">DEBIT ACCOUNT</label>
                                        <div className="relative">
                                          {editedJE.debit_account && !showDebitDropdown ? (
                                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                              <span className="text-sm text-gray-900">{editedJE.debit_account}</span>
                                              <button
                                                onClick={() => setShowDebitDropdown(true)}
                                                className="text-xs text-purple-600 hover:text-purple-700"
                                              >
                                                Change
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                              <Input
                                                value={debitAccountSearch}
                                                onChange={(e) => setDebitAccountSearch(e.target.value)}
                                                placeholder="Search account..."
                                                className="h-9 text-sm"
                                                onFocus={() => setShowDebitDropdown(true)}
                                              />
                                              {showDebitDropdown && (
                                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                  {filteredDebitAccounts().map((acc) => (
                                                    <button
                                                      key={acc.code}
                                                      onClick={() => selectDebitAccount(`${acc.code} - ${acc.name}`)}
                                                      className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b border-gray-100 last:border-b-0"
                                                    >
                                                      <div className="text-gray-900">{acc.code} - {acc.name}</div>
                                                      <div className="text-xs text-gray-500">{acc.type}</div>
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-gray-500 text-xs mb-1 block">CREDIT ACCOUNT</label>
                                        <div className="relative">
                                          {editedJE.credit_account && !showCreditDropdown ? (
                                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                              <span className="text-sm text-gray-900">{editedJE.credit_account}</span>
                                              <button
                                                onClick={() => setShowCreditDropdown(true)}
                                                className="text-xs text-purple-600 hover:text-purple-700"
                                              >
                                                Change
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                              <Input
                                                value={creditAccountSearch}
                                                onChange={(e) => setCreditAccountSearch(e.target.value)}
                                                placeholder="Search account..."
                                                className="h-9 text-sm"
                                                onFocus={() => setShowCreditDropdown(true)}
                                              />
                                              {showCreditDropdown && (
                                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                  {filteredCreditAccounts().map((acc) => (
                                                    <button
                                                      key={acc.code}
                                                      onClick={() => selectCreditAccount(`${acc.code} - ${acc.name}`)}
                                                      className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b border-gray-100 last:border-b-0"
                                                    >
                                                      <div className="text-gray-900">{acc.code} - {acc.name}</div>
                                                      <div className="text-xs text-gray-500">{acc.type}</div>
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-gray-500 text-xs mb-1 block">AMOUNT</label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editedJE.amount}
                                        readOnly
                                        disabled
                                        className="h-9 text-sm bg-gray-100 cursor-not-allowed"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-gray-500 text-xs mb-1 block">MEMO</label>
                                      <Input
                                        value={editedJE.memo}
                                        onChange={(e) => setEditedJE(prev => ({ ...prev, memo: e.target.value }))}
                                        placeholder="Optional memo"
                                        className="h-9 text-sm"
                                      />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveEdit(suggestion.id)}
                                        disabled={loadingActions[`save-${suggestion.id}`]}
                                        className="gap-2 bg-green-600 hover:bg-green-700"
                                      >
                                        {loadingActions[`save-${suggestion.id}`] ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="size-3" />
                                        )}
                                        Save Changes
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  // VIEW MODE
                                  <div className="bg-gray-50/50 dark:bg-white/5 rounded-xl p-4 mt-3">
                                    <div className="flex flex-col gap-3">
                                      {/* Debit Line */}
                                      <div className="flex items-center justify-between group/line">
                                        <div className="flex items-center gap-3">
                                          <span className={`text-[10px] font-bold uppercase tracking-wider w-8 text-center py-0.5 rounded ${theme === 'premium-dark' ? 'bg-white/10 text-white/70' : 'bg-gray-200 text-gray-600'}`}>
                                            DR
                                          </span>
                                          <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                            {sourceItem.suggested_je.debit_account}
                                          </span>
                                        </div>
                                        <span className={`text-sm font-mono ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                                          {formatCurrency(sourceItem.suggested_je.amount)}
                                        </span>
                                      </div>

                                      {/* Credit Line */}
                                      <div className="flex items-center justify-between group/line">
                                        <div className="flex items-center gap-3">
                                          <span className={`text-[10px] font-bold uppercase tracking-wider w-8 text-center py-0.5 rounded ${theme === 'premium-dark' ? 'bg-white/10 text-white/70' : 'bg-gray-200 text-gray-600'}`}>
                                            CR
                                          </span>
                                          <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                            {sourceItem.suggested_je.credit_account}
                                          </span>
                                        </div>
                                        <span className={`text-sm font-mono ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                                          {formatCurrency(sourceItem.suggested_je.amount)}
                                        </span>
                                      </div>

                                      {/* Memo */}
                                      {sourceItem.suggested_je.memo && (
                                        <div className={`text-xs mt-1 pl-11 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-500'}`}>
                                          {sourceItem.suggested_je.memo}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className={`text-lg font-medium ${isPayable
                              ? (transaction.amount >= 0 ? 'text-red-600' : 'text-green-600')
                              : (transaction.amount >= 0 ? 'text-green-600' : 'text-red-600')
                              }`}>
                              {formatCurrency(Math.abs(transaction.amount))}
                            </div>
                          </div>
                        </div>
                        <div className={`flex gap-2 pt-4 mt-2 ${theme === 'premium-dark' ? 'border-t border-white/5' : 'border-t border-gray-100'}`}>
                          {hasJESuggestion ? (
                            <>
                              <Button
                                size="sm"
                                className="gap-2 !bg-[#10B981] hover:!bg-[#059669] !text-white rounded-lg shadow-sm px-4 h-9 transition-all active:scale-95 border-0"
                                style={{ backgroundColor: '#10B981', color: 'white' }}
                                onClick={() => handleApproveJE(suggestion.id)}
                                disabled={loadingActions[`approve-${suggestion.id}`]}
                              >
                                {loadingActions[`approve-${suggestion.id}`] ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-3" />
                                )}
                                Approve Entry
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={theme === 'premium-dark' ? 'gap-2 border-white/10 hover:bg-white/5 rounded-lg text-white' : 'gap-2 rounded-lg'}
                                onClick={() => handleEditSuggestion(suggestion)}
                                disabled={editingSuggestionId === suggestion.id}
                              >
                                Edit Details
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                className={theme === 'premium-dark' ? 'gap-2 bg-white text-black hover:bg-white/90 rounded-full' : 'gap-2 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-gray-900 rounded-full'}
                                onClick={handleBulkGenerateJEs}
                                disabled={isGeneratingJEs || chartOfAccounts.length === 0}
                              >
                                {isGeneratingJEs ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Sparkles className="size-3" />
                                )}
                                Generate AI Suggestion
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={theme === 'premium-dark' ? 'gap-2 border-white/10 hover:bg-white/5 rounded-full text-white' : 'gap-2 rounded-full'}
                                onClick={() => handleEditSuggestion(suggestion)}
                              >
                                <Edit className="size-3" />
                                Manually Record
                              </Button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2 - Ready to Export */}
        <TabsContent value="ready">
          <Card className={`
            overflow-hidden border-0 shadow-xl backdrop-blur-xl
            ${theme === 'dark' ? 'bg-[#0a0a0f]/80 shadow-black/20' : 'bg-white/80 shadow-gray-200/50'}
          `}>
            <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Ready to Export ({readyEntries.length})
                  </CardTitle>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Approved entries waiting for export to QuickBooks/Xero/DATEV
                  </p>
                </div>
                <div className="flex gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Download className="size-4" />
                        Export to File
                        <ChevronDown className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {exportFormats.map((format) => (
                        <DropdownMenuItem key={format.key} onClick={() => handleExport(format.key)}>
                          <div className="flex flex-col items-start">
                            <span>{format.label}</span>
                            <span className="text-xs text-gray-500">{format.desc}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    className="gap-2 bg-gradient-to-r from-purple-600 to-violet-600"
                    onClick={handleMarkAsPosted}
                    disabled={readyEntries.length === 0}
                  >
                    <CheckCircle2 className="size-4" />
                    Mark as Posted in QB/Xero/DATEV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingReady ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto mb-3" />
                  Loading entries...
                </div>
              ) : readyEntries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No journal entries ready for export.
                </div>
              ) : (
                <div className="space-y-4">
                  {readyEntries.map((entry) => {
                    const entryBalance = {
                      debit: entry.lines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0),
                      credit: entry.lines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0),
                    };

                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={entry.id}
                        className={`
                          group border rounded-xl p-6 transition-all duration-300 relative overflow-hidden
                          ${theme === 'dark'
                            ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-[#65D3FD]/30 shadow-lg shadow-black/10'
                            : 'bg-white border-gray-100 hover:border-[#65D3FD]/30 shadow-sm hover:shadow-md'}
                        `}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                                {entry.createdBy === 'AI' ? 'AI Generated' : 'Manual'}
                              </Badge>
                              <span className="text-sm text-gray-500">{entry.id}</span>
                              <span className="text-sm text-gray-500">
                                {new Date(entry.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                            <p className="text-gray-900 mt-1">{entry.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => handleMoveBackToDraft(entry)}
                            >
                              <Edit className="size-3" />
                              Edit
                            </Button>
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle2 className="size-3 mr-1" />
                              Approved
                            </Badge>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-gray-200">
                              <tr>
                                <th className="text-left py-2 text-gray-600 w-1/2">Account</th>
                                <th className="text-right py-2 text-gray-600 w-[120px]">Debit</th>
                                <th className="text-right py-2 text-gray-600 w-[120px]">Credit</th>
                                <th className="text-left py-2 text-gray-600 pl-3">Memo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map((line, idx) => (
                                <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                                  <td className="py-2 text-gray-900">
                                    {line.accountCode} - {line.account}
                                  </td>
                                  <td className="py-2 text-right text-gray-900">
                                    {line.debit ? formatCurrency(parseFloat(line.debit)) : '-'}
                                  </td>
                                  <td className="py-2 text-right text-gray-900 pr-3">
                                    {line.credit ? formatCurrency(parseFloat(line.credit)) : '-'}
                                  </td>
                                  <td className="py-2 text-gray-600 pl-3">{line.memo || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200">
                              <tr>
                                <td className="py-2 text-gray-600">Total</td>
                                <td className="py-2 text-right text-gray-900">{formatCurrency(entryBalance.debit)}</td>
                                <td className="py-2 text-right text-gray-900">{formatCurrency(entryBalance.credit)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3 - Posted in System */}
        <TabsContent value="posted">
          <Card className={`
            overflow-hidden border-0 shadow-xl backdrop-blur-xl
            ${theme === 'dark' ? 'bg-[#0a0a0f]/80 shadow-black/20' : 'bg-white/80 shadow-gray-200/50'}
          `}>
            <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Posted in Accounting System ({postedEntries.length})
                  </CardTitle>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Entries successfully posted to QuickBooks/Xero/DATEV - read-only audit trail
                  </p>
                </div>
                {postedEntries.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Download className="size-4" />
                        Re-Export
                        <ChevronDown className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {exportFormats.map((format) => (
                        <DropdownMenuItem key={`reexport-${format.key}`} onClick={() => handleReExport(format.key)}>
                          <div className="flex flex-col items-start">
                            <span>{format.label}</span>
                            <span className="text-xs text-gray-500">{format.desc}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPosted ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto mb-3" />
                  Loading entries...
                </div>
              ) : postedEntries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No entries have been posted to the accounting system yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {postedEntries.map((entry) => {
                    const entryBalance = {
                      debit: entry.lines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0),
                      credit: entry.lines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0),
                    };

                    return (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={entry.id}
                        className={`
                          border rounded-xl p-6 transition-all duration-300 relative overflow-hidden
                          ${theme === 'dark'
                            ? 'bg-white/5 border-white/5 shadow-md'
                            : 'bg-gray-50/50 border-gray-200 shadow-sm'}
                        `}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                {entry.createdBy === 'AI' ? 'AI Generated' : 'Manual'}
                              </Badge>
                              <span className="text-sm text-gray-500">{entry.id}</span>
                              <span className="text-sm text-gray-500">
                                {new Date(entry.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                            <p className="text-gray-900 mt-1">{entry.description}</p>
                            {entry.postedAt && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                                <CheckCircle2 className="size-3 text-green-600" />
                                <span>
                                  Posted on {new Date(entry.postedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                  {entry.exportHistory && entry.exportHistory.length > 0 && (
                                    <span className="ml-2">
                                      • Last exported as {entry.exportHistory[entry.exportHistory.length - 1].format.toUpperCase()}
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle2 className="size-3 mr-1" />
                              Posted in System
                            </Badge>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-gray-200">
                              <tr>
                                <th className="text-left py-2 text-gray-600 w-1/2">Account</th>
                                <th className="text-right py-2 text-gray-600 w-[120px]">Debit</th>
                                <th className="text-right py-2 text-gray-600 w-[120px]">Credit</th>
                                <th className="text-left py-2 text-gray-600 pl-3">Memo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map((line, idx) => (
                                <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                                  <td className="py-2 text-gray-900">
                                    {line.accountCode} - {line.account}
                                  </td>
                                  <td className="py-2 text-right text-gray-900">
                                    {line.debit ? formatCurrency(parseFloat(line.debit)) : '-'}
                                  </td>
                                  <td className="py-2 text-right text-gray-900 pr-3">
                                    {line.credit ? formatCurrency(parseFloat(line.credit)) : '-'}
                                  </td>
                                  <td className="py-2 text-gray-600 pl-3">{line.memo || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200">
                              <tr>
                                <td className="py-2 text-gray-600">Total</td>
                                <td className="py-2 text-right text-gray-900">{formatCurrency(entryBalance.debit)}</td>
                                <td className="py-2 text-right text-gray-900">{formatCurrency(entryBalance.credit)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}