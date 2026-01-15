import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, CreditCard, Trash2, FileSpreadsheet, Building, Calendar, Eye, ChevronDown, GitCompare, TrendingUp, Lock, Unlock, Save, AlertTriangle, PlayCircle, BookOpen, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useRef, useEffect, Fragment } from 'react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getCreditCardLogo } from '@/utils/creditCardLogoDetection';
import { ProcessingStages } from '@/components/ProcessingStages';
import novalareLogoImg from 'figma:asset/85a18c0f14d9634898763219441c014da1faf3e8.png';

interface CCTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  merchant?: string;
  currency?: string;
  statementId: string;
  cardName: string;
  cardLast4?: string;
  isPayment?: boolean;
}

interface CCStatement {
  id: string;
  fileName: string;
  uploadedAt: number;
  transactionCount: number;
  fileUrl?: string;
  filePath?: string;
  cardName?: string;
  cardLast4?: string;
  statementBalance?: number;
  paymentDueDate?: string;
  paymentMinimum?: number;
  previousBalance?: number;
  newCharges?: number;
  creditsRefunds?: number;
}

interface CCPayment {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  merchant?: string;
  statementId: string;
  cardName: string;
  cardLast4?: string;
  isPayment: boolean;
}

interface CCLedgerEntry {
  id: string;
  date: string;
  vendor: string;
  memo?: string;
  debit: number;
  credit: number;
  currency?: string;
  glAccount?: string;
  cardAccount?: string;
  reference?: string;
}

interface CreditCardReconciliationProps {
  companyId: string;
}

export function CreditCardReconciliation({ companyId }: CreditCardReconciliationProps) {
  const { theme } = useTheme();
  const { session } = useAuth();
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();

  // Credit Card Account Info (from URL param)
  const [ccAccount, setCCAccount] = useState<any>(null);
  const [isLoadingCCAccount, setIsLoadingCCAccount] = useState(true);

  // Period Selection only (company is passed as prop)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  // QuickBooks GL Sync
  const [qboAccounts, setQboAccounts] = useState<any[]>([]);
  const [selectedGLAccount, setSelectedGLAccount] = useState<string>('');
  const [isLoadingQBAccounts, setIsLoadingQBAccounts] = useState(false);
  const [companyQBOConnectionId, setCompanyQBOConnectionId] = useState<string>('');
  const [isSyncingGL, setIsSyncingGL] = useState(false);

  // Credit Card Statements Tab
  const [ccStatements, setCCStatements] = useState<CCStatement[]>([]);
  const [ccTransactions, setCCTransactions] = useState<CCTransaction[]>([]);
  const [ccPayments, setCCPayments] = useState<CCPayment[]>([]);
  const [isUploadingCC, setIsUploadingCC] = useState(false);
  const [isLoadingCCData, setIsLoadingCCData] = useState(false);
  const [isExportingCC, setIsExportingCC] = useState(false);
  const [viewingStatementId, setViewingStatementId] = useState<string | null>(null);

  // Collapsible sections state
  const [isPaymentTransactionsExpanded, setIsPaymentTransactionsExpanded] = useState(false);
  const [isSettlementCheckExpanded, setIsSettlementCheckExpanded] = useState(false);

  // Credit Card Ledger Tab
  const [ccLedgerEntries, setCCLedgerEntries] = useState<CCLedgerEntry[]>([]);

  // Reconciliation Tab - state for matched/unmatched transactions
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [isUploadingLedger, setIsUploadingLedger] = useState(false);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [isRunningReconciliation, setIsRunningReconciliation] = useState(false);
  const [isLockingReconciliation, setIsLockingReconciliation] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<{
    matchedPairs: Array<{
      transaction: CCTransaction,
      ledgerEntry: CCLedgerEntry,
      ledgerEntries?: CCLedgerEntry[],
      matchType?: string,
      matchConfidence?: number,
      explanation?: string
    }>;
    unmatchedTransactions: CCTransaction[];
    unmatchedLedger: CCLedgerEntry[];
    totalStatementAmount: number;
    totalLedgerAmount: number;
    matchRate: number;
    summary?: {
      exact_matches?: number;
      one_to_many_matches?: number;
      many_to_one_matches?: number;
      fx_matches?: number;
      fuzzy_matches?: number;
      total_cc_transactions?: number;
      total_ledger_entries?: number;
      matched_count?: number;
      unmatched_cc_count?: number;
      unmatched_ledger_count?: number;
      match_rate?: number;
      total_cc_amount?: number;
      total_ledger_amount?: number;
      difference?: number;
    };
    reconciledAt?: string;
    locked?: boolean;
    lockedAt?: string;
    unlockedAt?: string;
  } | null>(null);

  // Current Active Tab
  const [activeTab, setActiveTab] = useState<string>('cc-statements');

  // Month-End Close Lock State
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);

  const ccFileInputRef = useRef<HTMLInputElement>(null);
  const ledgerFileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Helper function to get currency symbol
  const getCurrencySymbol = (currency?: string): string => {
    if (!currency) return '$'; // Default to USD

    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'CHF': 'CHF ',
      'INR': '₹',
      'MXN': 'MX$',
      'SGD': 'S$',
      'HKD': 'HK$',
      'NZD': 'NZ$',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr',
      'PLN': 'zł',
      'CZK': 'Kč',
      'HUF': 'Ft',
      'RON': 'lei',
      'BGN': 'лв',
      'RUB': '₽',
      'TRY': '₺',
      'BRL': 'R$',
      'ZAR': 'R',
      'KRW': '₩',
      'THB': '฿',
      'IDR': 'Rp',
      'MYR': 'RM',
      'PHP': '₱',
      'VND': '₫',
      'ILS': '₪',
      'AED': 'AED ',
      'SAR': 'SAR ',
    };

    return symbols[currency.toUpperCase()] || currency + ' ';
  };

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

  useEffect(() => {
    isMountedRef.current = true;

    // Set default period to current month
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    setSelectedPeriod(`${year}-${month}`);

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load credit card account info from COA
  useEffect(() => {
    const loadCCAccountInfo = async () => {
      if (!companyId || !accountId) return;

      try {
        setIsLoadingCCAccount(true);
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const account = data.accounts?.find((acc: any) => acc.id === accountId);
          if (account) {
            setCCAccount(account);
          } else {
            toast.error('Credit card account not found');
            navigate(`/company/${companyId}/reconciliations/cc`);
          }
        }
      } catch (error) {
        console.error('Failed to load credit card account:', error);
        toast.error('Failed to load credit card account');
      } finally {
        setIsLoadingCCAccount(false);
      }
    };

    loadCCAccountInfo();
  }, [companyId, accountId]);

  // Load QuickBooks accounts when company changes
  useEffect(() => {
    if (companyId) {
      loadQBAccounts(companyId);
    }
  }, [companyId]);

  // Load data when company, account, or period changes
  useEffect(() => {
    if (companyId && accountId && selectedPeriod) {
      loadCCData();
      loadLedgerData();
      loadReconciliationData(); // Load saved reconciliation
      loadLockStatus(); // Load month-end close lock status
    }
  }, [companyId, accountId, selectedPeriod]);

  // Load QuickBooks CC accounts
  const loadQBAccounts = async (cid: string) => {
    if (!session?.access_token) return;

    try {
      setIsLoadingQBAccounts(true);

      // Get company to find QB connection ID
      const companyResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${cid}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      if (!companyResponse.ok) {
        setQboAccounts([]);
        setCompanyQBOConnectionId('');
        return;
      }

      const company = await companyResponse.json();
      if (!company.qbo_connection_id) {
        setQboAccounts([]);
        setCompanyQBOConnectionId('');
        return;
      }

      setCompanyQBOConnectionId(company.qbo_connection_id);

      // Fetch COA and filter to Credit Card accounts
      const accountsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${cid}/coa`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (!accountsResponse.ok) return;

      const { accounts } = await accountsResponse.json();
      const ccAccounts = accounts.filter((a: any) => a.type === 'Credit Card');
      setQboAccounts(ccAccounts);

      // Auto-select the current account if it's in the list
      if (accountId && ccAccounts.some((a: any) => a.qbo_id === accountId || a.id === accountId)) {
        const matchingAccount = ccAccounts.find((a: any) => a.qbo_id === accountId || a.id === accountId);
        setSelectedGLAccount(matchingAccount?.qbo_id || '');
      } else if (ccAccounts.length > 0) {
        setSelectedGLAccount(ccAccounts[0].qbo_id);
      }
    } catch (error) {
      console.error('Failed to load QB accounts:', error);
    } finally {
      setIsLoadingQBAccounts(false);
    }
  };

  // Sync CC Ledger from QuickBooks
  const handleSyncGLFromQuickBooks = async () => {
    if (!companyId || !accountId || !selectedPeriod || !selectedGLAccount || !companyQBOConnectionId) {
      toast.error('Please select a period and ensure QuickBooks is connected');
      return;
    }

    if (!session?.access_token) {
      toast.error('Please log in to sync from QuickBooks');
      return;
    }

    try {
      setIsSyncingGL(true);
      const syncToastId = toast.loading('Syncing CC ledger from QuickBooks...');

      const [year, month] = selectedPeriod.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/sync/${companyQBOConnectionId}/gl-report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            account_id: selectedGLAccount,
            start_date: startDate,
            end_date: endDate
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Sync failed');
      }

      const data = await response.json();
      const glEntries = data.entries || [];

      // Transform to CC ledger format
      const transformedEntries: CCLedgerEntry[] = glEntries.map((entry: any, index: number) => ({
        id: `qb-${index}`,
        date: entry.date,
        vendor: entry.name || entry.memo || '',
        memo: entry.memo || '',
        debit: entry.amount < 0 ? Math.abs(entry.amount) : 0,
        credit: entry.amount > 0 ? entry.amount : 0,
        currency: 'USD',
        glAccount: entry.account || '',
        reference: entry.num || ''
      }));

      // Save to backend
      const saveResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/ledger`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companyId,
            accountId,
            period: selectedPeriod,
            ledger: {
              id: `qb-sync-${Date.now()}`,
              fileName: 'QuickBooks Sync',
              uploadedAt: Date.now(),
              entryCount: transformedEntries.length
            },
            entries: transformedEntries
          })
        }
      );

      if (!saveResponse.ok) {
        throw new Error('Failed to save synced ledger data');
      }

      toast.dismiss(syncToastId);
      toast.success(`✅ Synced ${transformedEntries.length} entries from QuickBooks!`);

      // Refresh ledger data
      await loadLedgerData();
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Failed to sync from QuickBooks');
    } finally {
      setIsSyncingGL(false);
    }
  };

  // Load credit card statements and transactions
  const loadCCData = async () => {
    if (!companyId || !accountId || !selectedPeriod) return;

    try {
      setIsLoadingCCData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/statements?companyId=${companyId}&accountId=${accountId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📊 CC Data loaded:', {
          statements: data.statements?.length || 0,
          transactions: data.transactions?.length || 0,
          payments: data.payments?.length || 0,
          sampleStatement: data.statements?.[0],
          samplePayment: data.payments?.[0]
        });
        if (isMountedRef.current) {
          setCCStatements(data.statements || []);
          setCCTransactions(data.transactions || []);
          setCCPayments(data.payments || []);
        }
      } else if (response.status === 404) {
        // No data found yet - this is expected
        if (isMountedRef.current) {
          setCCStatements([]);
          setCCTransactions([]);
          setCCPayments([]);
        }
      }
    } catch (error) {
      // Silently handle - endpoint may not have data yet
      if (isMountedRef.current) {
        setCCStatements([]);
        setCCTransactions([]);
        setCCPayments([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingCCData(false);
      }
    }
  };

  // Load credit card ledger entries
  const loadLedgerData = async () => {
    if (!companyId || !accountId || !selectedPeriod) return;

    try {
      setIsLoadingLedger(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/ledger?companyId=${companyId}&accountId=${accountId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Ledger Data loaded:', {
          entries: data.entries?.length || 0,
          sampleEntry: data.entries?.[0]
        });
        if (isMountedRef.current) {
          setCCLedgerEntries(data.entries || []);
        }
      } else if (response.status === 404) {
        // No data found yet - this is expected
        if (isMountedRef.current) {
          setCCLedgerEntries([]);
        }
      }
    } catch (error) {
      // Silently handle - endpoint may not have data yet
      if (isMountedRef.current) {
        setCCLedgerEntries([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingLedger(false);
      }
    }
  };

  // Load saved reconciliation data
  const loadReconciliationData = async () => {
    if (!companyId || !accountId || !selectedPeriod) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/reconciliation?companyId=${companyId}&accountId=${accountId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const reconciliation = data.reconciliation;

        if (reconciliation && reconciliation.matched_pairs) {
          console.log('📊 Loaded saved reconciliation:', {
            matchedPairs: reconciliation.matched_pairs?.length || 0,
            matchRate: reconciliation.summary?.match_rate
          });

          // Transform server result to match frontend interface
          const matchedPairs = reconciliation.matched_pairs.map((pair: any) => ({
            transaction: pair.cc_transaction,
            ledgerEntry: pair.ledger_entries[0], // For display purposes, use first entry
            ledgerEntries: pair.ledger_entries, // Keep all entries for multi-match display
            matchType: pair.match_type,
            matchConfidence: pair.match_confidence,
            explanation: pair.explanation
          }));

          const unmatchedTransactions = reconciliation.unmatched_cc.map((item: any) => item.transaction);
          const unmatchedLedger = reconciliation.unmatched_ledger.map((item: any) => item.entry);

          if (isMountedRef.current) {
            setReconciliationResult({
              matchedPairs,
              unmatchedTransactions,
              unmatchedLedger,
              totalStatementAmount: reconciliation.summary.total_cc_amount,
              totalLedgerAmount: reconciliation.summary.total_ledger_amount,
              matchRate: reconciliation.summary.match_rate,
              summary: reconciliation.summary, // Include full summary for breakdown display
              reconciledAt: reconciliation.reconciled_at,
              locked: reconciliation.locked,
              lockedAt: reconciliation.locked_at,
              unlockedAt: reconciliation.unlocked_at
            });
          }
        }
      } else if (response.status === 404) {
        // No reconciliation found yet - this is expected
        if (isMountedRef.current) {
          setReconciliationResult(null);
        }
      }
    } catch (error) {
      // Silently handle - endpoint may not have data yet
      console.log('No saved reconciliation found');
      if (isMountedRef.current) {
        setReconciliationResult(null);
      }
    }
  };

  // Load month-end close lock status
  const loadLockStatus = async () => {
    if (!companyId || !accountId || !selectedPeriod) return;

    try {
      console.log('🔒 [CC Rec Review] Loading lock status for:', { companyId, accountId, selectedPeriod });
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/status?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('🔒 [CC Rec Review] Lock status loaded:', data);
        if (isMountedRef.current) {
          setIsMonthLocked(data.isLocked || false);
          setLockDetails(data.lockDetails || null);
          console.log('🔒 [CC Rec Review] State updated - isMonthLocked:', data.isLocked);
        }
      } else {
        console.log('🔒 [CC Rec Review] Lock status response not OK:', response.status);
        if (isMountedRef.current) {
          setIsMonthLocked(false);
          setLockDetails(null);
        }
      }
    } catch (error) {
      console.log('🔒 [CC Rec Review] Failed to load lock status:', error);
      if (isMountedRef.current) {
        setIsMonthLocked(false);
        setLockDetails(null);
      }
    }
  };

  // Handle credit card statement upload
  const handleCCFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !companyId || !accountId || !selectedPeriod) return;

    setIsUploadingCC(true);

    const fileCount = files.length;
    const loadingToastId = toast.info(`Uploading ${fileCount} ${fileCount === 1 ? 'statement' : 'statements'}...`);

    try {
      let successCount = 0;
      let totalTransactions = 0;
      const errors: string[] = [];

      // Upload each file sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        toast.info(`Processing ${i + 1}/${fileCount}: ${file.name}`, { id: loadingToastId });

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('companyId', companyId);
          formData.append('accountId', accountId);
          formData.append('period', selectedPeriod);

          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/upload-statement`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
              body: formData,
            }
          );

          if (response.ok) {
            const data = await response.json();
            console.log(`✅ Upload successful for ${file.name}:`, data);
            successCount++;
            totalTransactions += data.transactionCount || 0;
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error(`❌ Upload failed for ${file.name}:`, errorData);
            errors.push(`${file.name}: ${errorData.details || errorData.error}`);
          }
        } catch (error) {
          console.error(`❌ Upload error for ${file.name}:`, error);
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Show final result
      toast.dismiss(loadingToastId);

      if (successCount === fileCount) {
        toast.success(`✅ Successfully uploaded ${fileCount} ${fileCount === 1 ? 'statement' : 'statements'} with ${totalTransactions} transactions!`);
      } else if (successCount > 0) {
        toast.warning(`⚠️ Uploaded ${successCount}/${fileCount} statements. ${errors.length} failed.`);
        errors.forEach(err => toast.error(err, { duration: 5000 }));
      } else {
        toast.error(`❌ All uploads failed`);
        errors.forEach(err => toast.error(err, { duration: 5000 }));
      }

      // Reload data to show new statements
      await loadCCData();
    } catch (error) {
      console.error('❌ Batch upload error:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingCC(false);
      if (ccFileInputRef.current) {
        ccFileInputRef.current.value = '';
      }
    }
  };

  // Handle delete credit card statement
  const handleDeleteCCStatement = async (statementId: string) => {
    if (!companyId || !selectedPeriod) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/statement/${statementId}?companyId=${companyId}&period=${selectedPeriod}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Credit card statement deleted');
        await loadCCData();
      } else {
        toast.error('Failed to delete credit card statement');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete credit card statement');
    }
  };

  // Handle view credit card statement
  const handleViewCCStatement = async (statement: CCStatement) => {
    if (!statement.filePath) {
      toast.error('File not found');
      return;
    }

    // Show loading toast
    const loadingToastId = toast.loading('Opening statement...', {
      description: 'Preparing your document for viewing'
    });

    // Set viewing state
    setViewingStatementId(statement.id);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/view-statement?filePath=${encodeURIComponent(statement.filePath)}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        window.open(data.signedUrl, '_blank');
        toast.success('Statement opened!', {
          id: loadingToastId,
          description: 'Check your new browser tab'
        });
      } else {
        toast.error('Failed to load statement', { id: loadingToastId });
      }
    } catch (error) {
      console.error('View error:', error);
      toast.error('Failed to load statement', {
        id: loadingToastId,
        description: 'Please try again'
      });
    } finally {
      setViewingStatementId(null);
    }
  };

  // Export credit card statements
  const handleExportCCStatements = async () => {
    if (!companyId || !selectedPeriod || ccTransactions.length === 0) return;

    setIsExportingCC(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/export-cc-statements`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: companyId,
            period: selectedPeriod,
            statements: ccStatements,
            transactions: ccTransactions,
          }),
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const fileName = `CC_Statements_${selectedPeriod}.xlsx`;
        a.download = fileName;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success('Credit card statements exported successfully');
      } else {
        toast.error('Failed to export credit card statements');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export credit card statements');
    } finally {
      setIsExportingCC(false);
    }
  };

  // Handle run reconciliation
  const handleRunReconciliation = async () => {
    // Filter out payment transactions from matching
    const nonPaymentTransactions = ccTransactions.filter(t => !t.isPayment);

    if (nonPaymentTransactions.length === 0) {
      toast.error('Please upload credit card statements with transactions first');
      return;
    }

    if (ccLedgerEntries.length === 0) {
      toast.error('Please upload credit card ledger entries first');
      return;
    }

    setIsRunningReconciliation(true);

    try {
      // Call server-side reconciliation API with 5-stage matching
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/run-reconciliation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: companyId,
            accountId: accountId,
            period: selectedPeriod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run reconciliation');
      }

      const data = await response.json();

      // Transform server result to match frontend interface
      const matchedPairs = data.matched_pairs.map((pair: any) => {
        // Ensure ledger_entries is an array
        const ledgerEntries = pair.ledger_entries || [];

        return {
          transaction: pair.cc_transaction,
          ledgerEntry: ledgerEntries[0] || null, // For display purposes, use first entry
          ledgerEntries: ledgerEntries, // Keep all entries for multi-match display
          matchType: pair.match_type,
          matchConfidence: pair.match_confidence,
          explanation: pair.explanation
        };
      });


      const unmatchedTransactions = data.unmatched_cc.map((item: any) => item.transaction);
      const unmatchedLedger = data.unmatched_ledger.map((item: any) => item.entry);

      setReconciliationResult({
        matchedPairs,
        unmatchedTransactions,
        unmatchedLedger,
        totalStatementAmount: data.summary.total_cc_amount,
        totalLedgerAmount: data.summary.total_ledger_amount,
        matchRate: data.summary.match_rate,
        summary: data.summary, // Include full summary for breakdown display
        reconciledAt: data.reconciled_at
      });

      // Reset expanded match state when reconciliation runs
      setExpandedMatch(null);

      toast.success('Credit card reconciliation completed successfully!');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to run reconciliation';
      toast.error(errorMessage);
      console.error('Reconciliation error:', err);
    } finally {
      setIsRunningReconciliation(false);
    }
  };

  // Lock (save) the reconciliation
  const handleLockReconciliation = async () => {
    if (!reconciliationResult) {
      toast.error('No reconciliation to save');
      return;
    }

    setIsLockingReconciliation(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/lock-reconciliation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: companyId,
            account_id: accountId,
            period: selectedPeriod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save reconciliation');
      }

      const data = await response.json();

      // Transform server result to match frontend interface
      const reconciliation = data.reconciliation;
      const matchedPairs = reconciliation.matched_pairs.map((pair: any) => ({
        transaction: pair.cc_transaction,
        ledgerEntry: pair.ledger_entries[0], // For display purposes, use first entry
        ledgerEntries: pair.ledger_entries, // Keep all entries for multi-match display
        matchType: pair.match_type,
        matchConfidence: pair.match_confidence,
        explanation: pair.explanation
      }));

      const unmatchedTransactions = reconciliation.unmatched_cc.map((item: any) => item.transaction);
      const unmatchedLedger = reconciliation.unmatched_ledger.map((item: any) => item.entry);

      setReconciliationResult({
        matchedPairs,
        unmatchedTransactions,
        unmatchedLedger,
        totalStatementAmount: reconciliation.summary.total_cc_amount,
        totalLedgerAmount: reconciliation.summary.total_ledger_amount,
        matchRate: reconciliation.summary.match_rate,
        summary: reconciliation.summary,
        reconciledAt: reconciliation.reconciled_at,
        locked: reconciliation.locked,
        lockedAt: reconciliation.locked_at,
        unlockedAt: reconciliation.unlocked_at
      });

      toast.success('Reconciliation saved and locked successfully!');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save reconciliation';
      toast.error(errorMessage);
      console.error('Lock reconciliation error:', err);
    } finally {
      setIsLockingReconciliation(false);
    }
  };

  // Unlock the reconciliation to allow updates
  const handleUnlockReconciliation = async () => {
    if (!reconciliationResult) {
      toast.error('No reconciliation to unlock');
      return;
    }

    setIsLockingReconciliation(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/unlock-reconciliation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: companyId,
            account_id: accountId,
            period: selectedPeriod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unlock reconciliation');
      }

      const data = await response.json();

      // Transform server result to match frontend interface
      const reconciliation = data.reconciliation;
      const matchedPairs = reconciliation.matched_pairs.map((pair: any) => ({
        transaction: pair.cc_transaction,
        ledgerEntry: pair.ledger_entries[0], // For display purposes, use first entry
        ledgerEntries: pair.ledger_entries, // Keep all entries for multi-match display
        matchType: pair.match_type,
        matchConfidence: pair.match_confidence,
        explanation: pair.explanation
      }));

      const unmatchedTransactions = reconciliation.unmatched_cc.map((item: any) => item.transaction);
      const unmatchedLedger = reconciliation.unmatched_ledger.map((item: any) => item.entry);

      setReconciliationResult({
        matchedPairs,
        unmatchedTransactions,
        unmatchedLedger,
        totalStatementAmount: reconciliation.summary.total_cc_amount,
        totalLedgerAmount: reconciliation.summary.total_ledger_amount,
        matchRate: reconciliation.summary.match_rate,
        summary: reconciliation.summary,
        reconciledAt: reconciliation.reconciled_at,
        locked: reconciliation.locked,
        lockedAt: reconciliation.locked_at,
        unlockedAt: reconciliation.unlocked_at
      });

      toast.success('Reconciliation unlocked. You can now update it.');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to unlock reconciliation';
      toast.error(errorMessage);
      console.error('Unlock reconciliation error:', err);
    } finally {
      setIsLockingReconciliation(false);
    }
  };

  // Export CC reconciliation report to Excel
  const exportReport = () => {
    if (!reconciliationResult) return;

    const loadingToast = toast.loading('Generating Excel report...');

    setTimeout(async () => {
      try {
        // Use ExcelJS for advanced formatting
        const { default: ExcelJS } = await import('exceljs');
        const workbook = new ExcelJS.Workbook();

        // Fetch company details for proper company name
        let companyName = companyId;
        try {
          const companyResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json'
              }
            }
          );
          if (companyResponse.ok) {
            const companyData = await companyResponse.json();
            companyName = companyData.name || companyData.email || companyId;
          }
        } catch (err) {
          console.error('Failed to fetch company name:', err);
        }

        // Novalare brand color
        const novalareColor = '65D3FD';
        const darkColor = '1a1a1a';

        // 1. SUMMARY SHEET
        const summarySheet = workbook.addWorksheet('Summary', {
          properties: { tabColor: { argb: novalareColor } }
        });

        // Set column widths
        summarySheet.columns = [
          { width: 28 },
          { width: 35 }
        ];

        // Add Novalare logo (centered at top)
        try {
          const logoResponse = await fetch(novalareLogoImg);
          const logoBlob = await logoResponse.blob();
          const logoBuffer = await logoBlob.arrayBuffer();
          const logoId = workbook.addImage({
            buffer: logoBuffer,
            extension: 'png',
          });

          summarySheet.addImage(logoId, {
            tl: { col: 0.8, row: 0.5 },
            ext: { width: 150, height: 100 }
          });

          summarySheet.getRow(1).height = 45;
          summarySheet.getRow(2).height = 45;
          summarySheet.getRow(3).height = 10;
        } catch (err) {
          console.error('Failed to add logo:', err);
        }

        // Title row with Novalare branding
        summarySheet.mergeCells('A4:B4');
        const titleCell = summarySheet.getCell('A4');
        titleCell.value = 'CREDIT CARD RECONCILIATION SUMMARY';
        titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: novalareColor }
        };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        summarySheet.getRow(4).height = 30;

        // Powered by Novalare
        summarySheet.mergeCells('A5:B5');
        const poweredCell = summarySheet.getCell('A5');
        poweredCell.value = 'Powered by Novalare';
        poweredCell.font = { size: 9, italic: true, color: { argb: '666666' } };
        poweredCell.alignment = { horizontal: 'center' };

        summarySheet.addRow([]);

        // Company Information Section
        const companyHeaderRow = summarySheet.addRow(['COMPANY INFORMATION']);
        companyHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
        companyHeaderRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F0F0F0' }
        };

        const addInfoRow = (label: string, value: any, boldValue = false) => {
          const row = summarySheet.addRow([label, value]);
          row.getCell(1).font = { bold: true };
          if (boldValue) {
            row.getCell(2).font = { bold: true, size: 11 };
          }
          return row;
        };

        addInfoRow('Company', companyName, true);
        addInfoRow('Credit Card Account', ccAccount?.name || 'N/A', true);
        if (ccAccount?.card_brand) {
          addInfoRow('Card Brand', ccAccount.card_brand);
        }
        if (ccAccount?.last_four) {
          addInfoRow('Card Last 4', `••${ccAccount.last_four}`);
        }
        addInfoRow('Period', new Date(selectedPeriod + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), true);
        addInfoRow('Report Date', new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }));

        summarySheet.addRow([]);

        // Reconciliation Statistics
        const statsHeaderRow = summarySheet.addRow(['RECONCILIATION STATISTICS']);
        statsHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
        statsHeaderRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F0F0F0' }
        };

        addInfoRow('Total CC Transactions', reconciliationResult.summary?.total_cc_transactions || 0, true);
        addInfoRow('Total Ledger Entries', reconciliationResult.summary?.total_ledger_entries || 0, true);
        addInfoRow('Matched Count', reconciliationResult.summary?.matched_count || 0, true);
        addInfoRow('Unmatched CC', reconciliationResult.summary?.unmatched_cc_count || 0, true);
        addInfoRow('Unmatched Ledger', reconciliationResult.summary?.unmatched_ledger_count || 0, true);

        const matchRateRow = addInfoRow('Match Rate', `${(reconciliationResult.summary?.match_rate || 0).toFixed(1)}%`, true);
        const matchRateValue = reconciliationResult.summary?.match_rate || 0;
        matchRateRow.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: matchRateValue >= 90 ? 'C6EFCE' : matchRateValue >= 70 ? 'FFEB9C' : 'FFC7CE' }
        };

        summarySheet.addRow([]);

        // Financial Summary
        const financialHeaderRow = summarySheet.addRow(['FINANCIAL SUMMARY']);
        financialHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
        financialHeaderRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F0F0F0' }
        };

        const ccAmountRow = addInfoRow('Total CC Amount', reconciliationResult.summary?.total_cc_amount || 0, true);
        ccAmountRow.getCell(2).numFmt = '$#,##0.00';

        const ledgerAmountRow = addInfoRow('Total Ledger Amount', reconciliationResult.summary?.total_ledger_amount || 0, true);
        ledgerAmountRow.getCell(2).numFmt = '$#,##0.00';

        const differenceRow = addInfoRow('Gross Difference', reconciliationResult.summary?.difference || 0, true);
        differenceRow.getCell(2).numFmt = '$#,##0.00';
        differenceRow.getCell(2).font = { bold: true, size: 11, color: { argb: 'FF6600' } };

        // 2. MATCHED TRANSACTIONS SHEET
        const matchedSheet = workbook.addWorksheet('Matched Transactions', {
          properties: { tabColor: { argb: 'C6EFCE' } }
        });

        matchedSheet.columns = [
          { width: 12 }, { width: 35 }, { width: 14 }, { width: 15 },
          { width: 12 }, { width: 30 }, { width: 14 },
          { width: 12 }, { width: 12 }
        ];

        const matchedHeaders = ['CC Date', 'Description', 'Amount', 'Merchant', 'Ledger Date', 'Vendor', 'Ledger Debit', 'Match Type', 'Confidence'];
        const matchedHeaderRow = matchedSheet.addRow(matchedHeaders);
        matchedHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        matchedHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: novalareColor }
        };
        matchedHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        matchedHeaderRow.height = 25;

        reconciliationResult.matchedPairs?.forEach((match: any) => {
          const txn = match.transaction || {};
          const ledgerEntries = match.ledgerEntries || (match.ledgerEntry ? [match.ledgerEntry] : []);

          ledgerEntries.forEach((entry: any) => {
            const dataRow = matchedSheet.addRow([
              txn.date || '',
              txn.description || '',
              Math.abs(txn.amount || 0),
              txn.merchant || '',
              entry.date || '',
              entry.vendor || '',
              entry.debit || 0,
              match.matchType || '',
              `${(match.matchConfidence || 0).toFixed(0)}%`
            ]);
            dataRow.getCell(3).numFmt = '$#,##0.00';
            dataRow.getCell(7).numFmt = '$#,##0.00';
          });
        });

        matchedSheet.views = [{ state: 'frozen', ySplit: 1 }];

        // 3. UNMATCHED CC TRANSACTIONS SHEET
        const unmatchedCCSheet = workbook.addWorksheet('Unmatched CC', {
          properties: { tabColor: { argb: 'FFC7CE' } }
        });

        unmatchedCCSheet.columns = [
          { width: 12 }, { width: 35 }, { width: 14 }, { width: 15 }, { width: 15 }
        ];

        const unmatchedCCHeaders = ['Date', 'Description', 'Amount', 'Merchant', 'Card'];
        const unmatchedCCHeaderRow = unmatchedCCSheet.addRow(unmatchedCCHeaders);
        unmatchedCCHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        unmatchedCCHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: novalareColor }
        };
        unmatchedCCHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        unmatchedCCHeaderRow.height = 25;

        reconciliationResult.unmatchedTransactions?.forEach((txn: any) => {
          const dataRow = unmatchedCCSheet.addRow([
            txn.date || '',
            txn.description || '',
            Math.abs(txn.amount || 0),
            txn.merchant || '',
            txn.cardName || ''
          ]);
          dataRow.getCell(3).numFmt = '$#,##0.00';
        });

        unmatchedCCSheet.views = [{ state: 'frozen', ySplit: 1 }];

        // 4. UNMATCHED LEDGER ENTRIES SHEET
        const unmatchedLedgerSheet = workbook.addWorksheet('Unmatched Ledger', {
          properties: { tabColor: { argb: 'FFEB9C' } }
        });

        unmatchedLedgerSheet.columns = [
          { width: 12 }, { width: 30 }, { width: 14 }, { width: 20 }, { width: 30 }
        ];

        const unmatchedLedgerHeaders = ['Date', 'Vendor', 'Debit', 'GL Account', 'Memo'];
        const unmatchedLedgerHeaderRow = unmatchedLedgerSheet.addRow(unmatchedLedgerHeaders);
        unmatchedLedgerHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        unmatchedLedgerHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: novalareColor }
        };
        unmatchedLedgerHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        unmatchedLedgerHeaderRow.height = 25;

        reconciliationResult.unmatchedLedger?.forEach((entry: any) => {
          const dataRow = unmatchedLedgerSheet.addRow([
            entry.date || '',
            entry.vendor || '',
            entry.debit || 0,
            entry.glAccount || '',
            entry.memo || ''
          ]);
          dataRow.getCell(3).numFmt = '$#,##0.00';
        });

        unmatchedLedgerSheet.views = [{ state: 'frozen', ySplit: 1 }];

        // Write to file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cc-reconciliation-${companyName.replace(/\s+/g, '-')}-${selectedPeriod}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);

        toast.dismiss(loadingToast);
        toast.success('Excel report exported successfully!');
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Failed to export report');
        console.error('Export error:', error);
      }
    }, 100);
  };

  // Handle credit card ledger upload
  const handleLedgerFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId || !accountId || !selectedPeriod) return;

    setIsUploadingLedger(true);
    const loadingToastId = toast.loading('Uploading ledger file...', {
      description: 'Processing your credit card ledger CSV'
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('accountId', accountId);
      formData.append('period', selectedPeriod);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/upload-ledger`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Ledger upload successful:`, data);
        toast.success('Credit card ledger uploaded successfully', {
          id: loadingToastId,
          description: `${data.entryCount || 0} entries processed`
        });

        // Reload ledger data
        await loadLedgerData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`❌ Ledger upload failed:`, errorData);
        toast.error('Failed to upload ledger', {
          id: loadingToastId,
          description: errorData.details || errorData.error
        });
      }
    } catch (error) {
      console.error('❌ Ledger upload error:', error);
      toast.error('Upload failed', {
        id: loadingToastId,
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsUploadingLedger(false);
      if (ledgerFileInputRef.current) {
        ledgerFileInputRef.current.value = '';
      }
    }
  };

  const periods = generatePeriodOptions();

  // Group transactions by card
  const transactionsByCard = ccTransactions.reduce((acc, txn) => {
    const key = txn.cardName || 'Unknown Card';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(txn);
    return acc;
  }, {} as Record<string, CCTransaction[]>);

  // Show loading while account is being fetched
  if (isLoadingCCAccount) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className={`w-8 h-8 animate-spin mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Loading credit card account...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-20">
      {/* Premium Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <h1 className={`text-3xl font-bold tracking-tight ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                {ccAccount?.name || 'Credit Card Reconciliation'}
              </h1>
              {ccAccount?.name && <Badge variant="secondary" className="bg-[#65D3FD]/10 text-[#65D3FD] border-0">Credit Card</Badge>}
            </div>
            <p className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
              Automated transaction matching with AI-powered suggestions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate(`/company/${companyId}/reconciliations/cc`)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Accounts
            </Button>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className={`w-[240px] h-12 rounded-2xl border-2 font-bold ${theme === 'premium-dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'}`}>
                <Calendar className="mr-2 h-4 w-4 text-[#65D3FD]" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {generatePeriodOptions().map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {selectedPeriod ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={theme === 'premium-dark'
            ? 'relative grid w-full grid-cols-3 h-auto p-1.5 gap-1 bg-white/[0.03] border border-white/10 rounded-2xl'
            : 'relative grid w-full grid-cols-3 h-auto p-1.5 gap-1 rounded-2xl bg-gray-100'
          }>
            <TabsTrigger
              value="cc-statements"
              className={theme === 'premium-dark'
                ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
              }
            >
              {activeTab === 'cc-statements' && (
                <motion.div
                  layoutId="active-cc-rec-tab"
                  layout
                  className={theme === 'premium-dark'
                    ? 'absolute inset-0 rounded-xl bg-white/[0.08]'
                    : 'absolute inset-0 rounded-xl bg-white shadow-sm'
                  }
                  transition={{
                    type: "spring",
                    stiffness: 150,
                    damping: 20,
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <FileText className="size-4" />
                Credit Card Statements
                {(ccStatements.length > 0) && (
                  <Badge variant="secondary" className={theme === 'premium-dark'
                    ? 'ml-auto bg-blue-500/20 text-blue-400 border-0 px-2 py-0.5 text-xs'
                    : 'ml-auto bg-blue-100 text-blue-700 px-2 py-0.5 text-xs'
                  }>
                    {ccStatements.length}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="cc-ledger"
              className={theme === 'premium-dark'
                ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
              }
            >
              {activeTab === 'cc-ledger' && (
                <motion.div
                  layoutId="active-cc-rec-tab"
                  layout
                  className={theme === 'premium-dark'
                    ? 'absolute inset-0 rounded-xl bg-white/[0.08]'
                    : 'absolute inset-0 rounded-xl bg-white shadow-sm'
                  }
                  transition={{
                    type: "spring",
                    stiffness: 150,
                    damping: 20,
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <CreditCard className="size-4" />
                Credit Card Ledger
                {ccLedgerEntries.length > 0 && (
                  <Badge variant="secondary" className={theme === 'premium-dark'
                    ? 'ml-auto bg-green-500/20 text-green-400 border-0 px-2 py-0.5 text-xs flex items-center gap-1'
                    : 'ml-auto bg-green-100 text-green-700 px-2 py-0.5 text-xs flex items-center gap-1'
                  }>
                    {ccLedgerEntries.length}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="reconciliation"
              className={theme === 'premium-dark'
                ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
              }
            >
              {activeTab === 'reconciliation' && (
                <motion.div
                  layoutId="active-cc-rec-tab"
                  layout
                  className={theme === 'premium-dark'
                    ? 'absolute inset-0 rounded-xl bg-white/[0.08]'
                    : 'absolute inset-0 rounded-xl bg-white shadow-sm'
                  }
                  transition={{
                    type: "spring",
                    stiffness: 150,
                    damping: 20,
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <GitCompare className="size-4" />
                Reconciliation
                {reconciliationResult && (
                  <Badge variant="secondary" className={theme === 'premium-dark'
                    ? 'ml-auto bg-purple-500/20 text-purple-400 border-0 px-2 py-0.5 text-xs'
                    : 'ml-auto bg-violet-100 text-violet-700 px-2 py-0.5 text-xs'
                  }>
                    {reconciliationResult.matchRate?.toFixed(0) || 0}%
                  </Badge>
                )}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Credit Card Statements (what we just worked on) */}
          <TabsContent value="cc-statements" className="space-y-6">
            {/* Month-End Close Lock Alert */}
            {isMonthLocked && (
              <Alert className="bg-gray-900 border-gray-800">
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. You cannot upload or modify credit card statements while the period is locked.
                </AlertDescription>
              </Alert>
            )}

            {/* Reconciliation Lock Alert (only show if NOT month locked) */}
            {!isMonthLocked && reconciliationResult?.locked && (
              <Alert className="bg-amber-50 border-amber-200">
                <Lock className="size-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <strong>Uploads are locked.</strong> This company's reconciliation for {selectedPeriod} is locked. To upload more credit card statements, click "Update Reconciliation" in the Reconciliation tab to unlock it.
                </AlertDescription>
              </Alert>
            )}

            {/* Upload Statements Card */}
            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-white' : 'flex items-center gap-2'}>
                      <Upload className={theme === 'premium-dark' ? 'size-5 text-purple-300/60' : 'size-5 text-purple-600'} />
                      Upload Credit Card Statements
                    </CardTitle>
                    <CardDescription className={theme === 'premium-dark' ? 'mt-1 text-gray-400' : 'mt-1'}>
                      Upload credit card statements (PDF, Excel, or CSV). AI will automatically extract all transactions.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => ccFileInputRef.current?.click()}
                      disabled={isUploadingCC || isMonthLocked || reconciliationResult?.locked}
                      className={theme === 'premium-dark'
                        ? 'bg-white text-black hover:bg-white/90 rounded-xl'
                        : 'bg-[#65D3FD] text-black hover:bg-[#52B8E8] rounded-xl'}
                    >
                      {isUploadingCC ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4 mr-2" />
                          Upload Statement
                        </>
                      )}
                    </Button>
                    <input
                      ref={ccFileInputRef}
                      type="file"
                      onChange={handleCCFileUpload}
                      accept=".pdf,.csv,.xlsx,.xls"
                      multiple
                      className="hidden"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCCData ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-purple-600" />
                  </div>
                ) : ccStatements.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="size-12 text-gray-300 mx-auto mb-3" />
                    <p>No credit card statements uploaded yet.</p>
                    <p className="text-sm mt-1">Upload your first statement to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ccStatements.map((statement) => (
                      <motion.div
                        key={statement.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        {/* Statement Header */}
                        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 border-b border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="size-12 rounded-lg bg-blue-100 flex items-center justify-center shadow-sm">
                                <CreditCard className="size-6 text-[#65D3FD]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg text-gray-900">{statement.cardName || 'Unknown Card'}</h3>
                                  {statement.cardLast4 && (
                                    <Badge variant="secondary" className="text-xs">
                                      ••{statement.cardLast4}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <FileText className="size-3" />
                                    {statement.fileName}
                                  </span>
                                  <span>•</span>
                                  <span>{statement.transactionCount} transactions</span>
                                  <span>•</span>
                                  <span>{new Date(statement.uploadedAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:shadow-sm transition-all"
                                  onClick={() => handleViewCCStatement(statement)}
                                  disabled={viewingStatementId === statement.id}
                                >
                                  {viewingStatementId === statement.id ? (
                                    <>
                                      <Loader2 className="size-4 animate-spin" />
                                      Opening...
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="size-4" />
                                      View
                                    </>
                                  )}
                                </Button>
                              </motion.div>
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 hover:shadow-sm transition-all"
                                  onClick={() => handleDeleteCCStatement(statement.id)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete
                                </Button>
                              </motion.div>
                            </div>
                          </div>
                        </div>

                        {/* Statement Details Grid */}
                        <div className="bg-white px-6 py-5">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                            {statement.statementBalance !== null && statement.statementBalance !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Statement Balance</p>
                                <p className="text-lg text-gray-900">${formatCurrency(statement.statementBalance)}</p>
                              </div>
                            )}
                            {statement.paymentDueDate && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Payment Due</p>
                                <p className="text-lg text-gray-900">
                                  {new Date(statement.paymentDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                            )}
                            {statement.paymentMinimum !== null && statement.paymentMinimum !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Minimum Payment</p>
                                <p className="text-lg text-gray-900">${formatCurrency(statement.paymentMinimum)}</p>
                              </div>
                            )}
                            {statement.previousBalance !== null && statement.previousBalance !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Previous Balance</p>
                                <p className="text-lg text-gray-900">${formatCurrency(statement.previousBalance)}</p>
                              </div>
                            )}
                            {statement.newCharges !== null && statement.newCharges !== undefined && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">New Charges</p>
                                <p className="text-lg text-gray-900">${formatCurrency(statement.newCharges)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settlement Check - Liability Clearance */}
            {ccPayments.length > 0 && (
              <Card className={theme === 'premium-dark' ? 'border-2 border-white/10 bg-white/[0.03] rounded-2xl' : 'border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl'}>
                <CardHeader className={theme === 'premium-dark' ? 'cursor-pointer hover:bg-white/[0.05] transition-colors' : 'cursor-pointer hover:bg-blue-100/50 transition-colors'} onClick={() => setIsSettlementCheckExpanded(!isSettlementCheckExpanded)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-lg text-white' : 'flex items-center gap-2 text-lg'}>
                        <CheckCircle className={theme === 'premium-dark' ? 'size-5 text-purple-300/60' : 'size-5 text-[#65D3FD]'} />
                        Settlement Check - Liability Clearance
                      </CardTitle>
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>
                        Verify that credit card liability reconciles correctly after payments
                      </CardDescription>
                    </div>
                    <motion.div
                      animate={{ rotate: isSettlementCheckExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="size-5 text-[#65D3FD]" />
                    </motion.div>
                  </div>
                </CardHeader>
                <AnimatePresence>
                  {isSettlementCheckExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                    >
                      <CardContent>
                        {(() => {
                          // Calculate settlement summary
                          const openingBalance = ccStatements.reduce((sum, stmt) =>
                            sum + (stmt.previousBalance || 0), 0
                          );
                          const newCharges = ccStatements.reduce((sum, stmt) =>
                            sum + (stmt.newCharges || 0), 0
                          );
                          const paymentsMade = ccPayments.reduce((sum, payment) =>
                            sum + Math.abs(payment.amount), 0
                          );
                          // Calculate refunds from transactions with negative amounts
                          const refundsMade = ccTransactions
                            .filter(txn => txn.amount < 0)
                            .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

                          const expectedEndingBalance = openingBalance + newCharges - paymentsMade - refundsMade;
                          const ledgerEndingBalance = ccStatements.reduce((sum, stmt) =>
                            sum + (stmt.statementBalance || 0), 0
                          );

                          const isReconciled = Math.abs(expectedEndingBalance - ledgerEndingBalance) < 0.01;
                          const difference = ledgerEndingBalance - expectedEndingBalance;

                          return (
                            <div className="space-y-4">
                              {/* Settlement Calculation */}
                              <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                    <span className="text-sm text-gray-600">Opening Credit Card Balance</span>
                                    <span className="text-gray-900">${formatCurrency(openingBalance)}</span>
                                  </div>

                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">+ New Charges</span>
                                    <span className="text-gray-900">${formatCurrency(newCharges)}</span>
                                  </div>

                                  <div className="flex justify-between items-center">
                                    <span className={theme === 'premium-dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>- Payments Made</span>
                                    <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>($${formatCurrency(paymentsMade)})</span>
                                  </div>

                                  <div className={theme === 'premium-dark' ? 'flex justify-between items-center pb-3 border-b border-white/10' : 'flex justify-between items-center pb-3 border-b border-gray-200'}>
                                    <span className={theme === 'premium-dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>- Refunds & Credits</span>
                                    <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>($${formatCurrency(refundsMade)})</span>
                                  </div>

                                  <div className="flex justify-between items-center pt-2">
                                    <span className="text-gray-900">Expected Ending Balance</span>
                                    <span className="text-lg text-gray-900">${formatCurrency(expectedEndingBalance)}</span>
                                  </div>

                                  <div className="flex justify-between items-center pb-3 border-b-2 border-gray-300">
                                    <span className="text-gray-900">Ledger Ending Balance</span>
                                    <span className="text-lg text-gray-900">${formatCurrency(ledgerEndingBalance)}</span>
                                  </div>

                                  {/* Reconciliation Result */}
                                  <div className={`flex justify-between items-center pt-3 ${isReconciled ? 'bg-green-50' : 'bg-red-50'} -mx-6 -mb-6 px-6 py-4 rounded-b-lg`}>
                                    <div className="flex items-center gap-2">
                                      {isReconciled ? (
                                        <>
                                          <CheckCircle className={theme === 'premium-dark' ? 'size-5 text-white' : 'size-5 text-gray-900'} />
                                          <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>Credit Card Liability Reconciles Correctly</span>
                                        </>
                                      ) : (
                                        <>
                                          <AlertCircle className="size-5 text-red-600" />
                                          <span className="text-red-900">Credit Card Liability Does Not Reconcile - Review Required</span>
                                        </>
                                      )}
                                    </div>
                                    {!isReconciled && (
                                      <div className="text-right">
                                        <div className="text-xs text-red-600">Difference</div>
                                        <div className="text-red-900">${formatCurrency(Math.abs(difference))}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )}

            {/* Card Payments - Payment Transactions */}
            {ccPayments.length > 0 && (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                <CardHeader className={theme === 'premium-dark' ? 'cursor-pointer hover:bg-white/[0.05] transition-colors' : 'cursor-pointer hover:bg-gray-50 transition-colors'} onClick={() => setIsPaymentTransactionsExpanded(!isPaymentTransactionsExpanded)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-white' : 'flex items-center gap-2'}>
                        <CreditCard className={theme === 'premium-dark' ? 'size-5 text-purple-300/60' : 'size-5 text-gray-600'} />
                        Payment Transactions
                        <Badge variant="secondary" className="ml-2">
                          {ccPayments.length}
                        </Badge>
                      </CardTitle>
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>
                        Track credit card payments to verify that cards were paid correctly each month.
                      </CardDescription>
                    </div>
                    <motion.div
                      animate={{ rotate: isPaymentTransactionsExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="size-5 text-gray-500" />
                    </motion.div>
                  </div>
                </CardHeader>
                <AnimatePresence>
                  {isPaymentTransactionsExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                    >
                      <CardContent>
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-gray-700">Date</th>
                                <th className="px-4 py-3 text-left text-gray-700">Card</th>
                                <th className="px-4 py-3 text-left text-gray-700">Description</th>
                                <th className="px-4 py-3 text-right text-gray-700">Payment Amount</th>
                                <th className="px-4 py-3 text-center text-gray-700">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ccPayments.map((payment, idx) => (
                                <tr key={payment.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3 text-gray-900">
                                    {new Date(payment.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div>
                                      <p className="text-gray-900">{payment.cardName || 'Unknown'}</p>
                                      {payment.cardLast4 && (
                                        <p className="text-xs text-gray-500">••{payment.cardLast4}</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className={theme === 'premium-dark' ? 'px-4 py-3 text-white' : 'px-4 py-3 text-gray-900'}>{payment.description}</td>
                                  <td className={theme === 'premium-dark' ? 'px-4 py-3 text-right text-white' : 'px-4 py-3 text-right text-gray-900'}>
                                    ${formatCurrency(Math.abs(payment.amount))}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                      Pending Match
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-100">
                              <tr>
                                <td colSpan={3} className={theme === 'premium-dark' ? 'px-4 py-3 text-right text-gray-300' : 'px-4 py-3 text-right text-gray-700'}>
                                  Total Payments:
                                </td>
                                <td className={theme === 'premium-dark' ? 'px-4 py-3 text-right text-white' : 'px-4 py-3 text-right text-gray-900'}>
                                  ${formatCurrency(
                                    ccPayments.reduce((sum, payment) => sum + Math.abs(payment.amount), 0)
                                  )}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )}

            {/* Expense Transactions Review */}
            {ccTransactions.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="size-5 text-purple-600" />
                        Expenses & Transactions
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Review all expense transactions extracted from credit card statements (excluding payments).
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleExportCCStatements}
                      disabled={isExportingCC}
                      variant="outline"
                      size="sm"
                    >
                      {isExportingCC ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="size-4 mr-2" />
                          Export to Excel
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Transactions by Card */}
                    <div>
                      <h4 className="text-sm text-gray-700 mb-3">
                        Expense Transactions ({ccTransactions.length})
                      </h4>

                      {Object.entries(transactionsByCard).map(([cardName, transactions]) => (
                        <div key={cardName} className="mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <CreditCard className="size-4 text-purple-600" />
                            <h5 className="text-gray-900">{cardName}</h5>
                            <Badge variant="secondary">{transactions.length} transactions</Badge>
                          </div>

                          <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-gray-700">Date</th>
                                  <th className="px-4 py-3 text-left text-gray-700">Description</th>
                                  <th className="px-4 py-3 text-left text-gray-700">Merchant</th>
                                  <th className="px-4 py-3 text-left text-gray-700">Category</th>
                                  <th className="px-4 py-3 text-right text-gray-700">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transactions.map((txn, idx) => (
                                  <tr key={txn.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-3 text-gray-900">
                                      {new Date(txn.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-900">{txn.description}</td>
                                    <td className="px-4 py-3 text-gray-600">{txn.merchant || '-'}</td>
                                    <td className="px-4 py-3">
                                      {txn.category && (
                                        <Badge variant="outline" className="text-xs">
                                          {txn.category}
                                        </Badge>
                                      )}
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'px-4 py-3 text-right text-white' : 'px-4 py-3 text-right text-gray-900'}>
                                      ${formatCurrency(Math.abs(txn.amount))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-100">
                                <tr>
                                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">
                                    Total:
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900">
                                    ${formatCurrency(
                                      transactions.reduce((sum, txn) => sum + Math.abs(txn.amount), 0)
                                    )}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: Credit Card Ledger */}
          <TabsContent value="cc-ledger" className="space-y-6">
            {/* Month-End Close Lock Alert */}
            {isMonthLocked && (
              <Alert className={theme === 'premium-dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. You cannot upload or modify the credit card ledger while the period is locked.
                </AlertDescription>
              </Alert>
            )}

            {/* Reconciliation Lock Alert (only show if NOT month locked) */}
            {!isMonthLocked && reconciliationResult?.locked && (
              <Alert className={theme === 'premium-dark' ? 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl' : 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl'}>
                <Lock className={theme === 'premium-dark' ? 'size-4 text-[#65D3FD]' : 'size-4 text-[#65D3FD]'} />
                <AlertDescription className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>
                  To upload a new ledger, click "Update Reconciliation" in the Reconciliation tab
                </AlertDescription>
              </Alert>
            )}

            {/* Ledger Upload Card */}
            <div className={theme === 'premium-dark'
              ? 'relative p-1 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 shadow-xl overflow-hidden'
              : 'rounded-2xl border border-gray-200 bg-white shadow-sm'
            }>
              <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-[#4F5CFE]/10 blur-3xl' : ''} />
              <div className={theme === 'premium-dark' ? 'relative bg-[#0A0A0A]/90 backdrop-blur-xl rounded-xl p-8' : 'p-8'}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/20 text-[#4F5CFE]' : 'bg-blue-50 text-blue-600'}`}>
                        <BookOpen className="size-5" />
                      </div>
                      <h2 className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Credit Card Ledger
                      </h2>
                    </div>
                    <p className={`max-w-lg ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Upload your credit card ledger export (Excel or CSV) to reconcile against statement transactions.
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3 self-center">
                    <div className="flex items-center gap-3">
                      {companyQBOConnectionId && (
                        <Button
                          onClick={handleSyncGLFromQuickBooks}
                          disabled={isSyncingGL || isMonthLocked || reconciliationResult?.locked || !selectedGLAccount}
                          variant="outline"
                          className={`${theme === 'premium-dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} transition-all duration-300 h-11 px-6 rounded-xl font-medium`}
                        >
                          <RefreshCw className={`mr-2 size-4 ${isSyncingGL ? 'animate-spin' : ''}`} />
                          {isSyncingGL ? 'Syncing...' : 'Sync from QB'}
                        </Button>
                      )}

                      <Button
                        onClick={() => ledgerFileInputRef.current?.click()}
                        variant="outline"
                        className={`${theme === 'premium-dark'
                          ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white hover:border-white/20'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          } transition-all duration-300 h-11 px-6 rounded-xl font-medium`}
                        disabled={isUploadingLedger || isMonthLocked || reconciliationResult?.locked}
                      >
                        {isUploadingLedger ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 size-4" />
                            {ccLedgerEntries.length > 0 ? 'Replace Ledger' : 'Upload Ledger'}
                          </>
                        )}
                      </Button>
                      <input
                        ref={ledgerFileInputRef}
                        type="file"
                        onChange={handleLedgerFileUpload}
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                      />
                    </div>

                    {ccLedgerEntries.length > 0 && (
                      <div className={`flex items-center justify-end gap-2 text-xs ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'} w-full text-right`}>
                        <CheckCircle className="size-3 text-green-500" />
                        <span className="text-green-500 font-medium">Uploaded</span>
                        <span className="opacity-30">|</span>
                        <span>{ccLedgerEntries.length} entries</span>
                        <span className="opacity-30">•</span>
                        <span>Last upload: {new Date().toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Ledger Transactions Table */}
            {isLoadingLedger ? (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'}>
                <CardContent className="py-20 text-center">
                  <div className="relative mx-auto size-16 mb-4">
                    <div className="absolute inset-0 rounded-full border-t-2 border-[#4F5CFE] animate-spin"></div>
                    <Loader2 className="absolute inset-0 m-auto size-8 text-[#4F5CFE] animate-pulse" />
                  </div>
                  <p className="text-gray-500 font-medium">Loading ledger entries...</p>
                </CardContent>
              </Card>
            ) : ccLedgerEntries.length > 0 ? (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100 shadow-sm'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>Ledger Entries</CardTitle>
                      {/* Pagination subtitle would go here if we implemented pagination (future) */}
                    </div>
                    <Badge variant="secondary" className={`px-3 py-1 rounded-lg ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/10 text-[#4F5CFE]' : 'bg-blue-50 text-blue-700'}`}>
                      {ccLedgerEntries.length} items
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={`border-b ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                        <tr>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Description</th>
                          <th className="text-right py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Debit</th>
                          <th className="text-right py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Credit</th>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Account</th>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {ccLedgerEntries.map((entry, i) => {
                          return (
                            <tr key={entry.id || i} className={`transition-colors ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                {new Date(entry.date).toLocaleDateString()}
                              </td>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                {entry.vendor || entry.memo || 'No Description'}
                              </td>
                              {/* Debit Column */}
                              <td className={`py-4 px-6 text-sm font-medium text-right ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                {entry.debit > 0 ? `${getCurrencySymbol(entry.currency)}${formatCurrency(entry.debit)}` : '-'}
                              </td>
                              {/* Credit Column */}
                              <td className={`py-4 px-6 text-sm font-medium text-right ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                {entry.credit > 0 ? `${getCurrencySymbol(entry.currency)}${formatCurrency(entry.credit)}` : '-'}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-500 font-mono">
                                {entry.glAccount || '-'}
                              </td>
                              <td className="py-4 px-6 text-xs text-gray-400 max-w-[150px] truncate">
                                {entry.reference || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className={`rounded-3xl border-2 border-dashed p-12 text-center ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'}`}>
                <div className={`mx-auto size-16 rounded-2xl flex items-center justify-center mb-4 ${theme === 'premium-dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                  <FileText className="size-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>No Ledger Entries</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">Upload a credit card ledger above to reconcile.</p>
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Reconciliation */}
          <TabsContent value="reconciliation" className="space-y-6">
            {/* Locked Status Alert */}
            {isMonthLocked && (
              <Alert className="bg-gray-900 border-gray-800">
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. You cannot run or update the reconciliation while the period is locked.
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-3xl relative overflow-hidden backdrop-blur-xl' : 'bg-white border-gray-100 rounded-3xl shadow-sm'}>
              {theme === 'premium-dark' && <div className="absolute inset-0 bg-gradient-to-br from-[#65D3FD]/5 to-[#4F5CFE]/5 pointer-events-none" />}

              <CardHeader className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-xl ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/20 text-[#4F5CFE]' : 'bg-indigo-50 text-indigo-600'}`}>
                    <PlayCircle className="size-5" />
                  </div>
                  <div>
                    <CardTitle className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                      Run Reconciliation
                    </CardTitle>
                    <CardDescription className={theme === 'premium-dark' ? 'text-purple-300/60' : 'text-gray-500'}>
                      Automatically match credit card transactions with ledger entries
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 relative z-10">
                {/* Warnings */}
                {ccTransactions.filter(t => !t.isPayment).length === 0 && (
                  <Alert className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-xl' : 'rounded-xl'}>
                    <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/40' : 'size-4'} />
                    <AlertDescription className={theme === 'premium-dark' ? 'text-white/60' : ''}>
                      Please upload credit card statements in the "Credit Card Statements" tab before running reconciliation.
                    </AlertDescription>
                  </Alert>
                )}

                {ccLedgerEntries.length === 0 && (
                  <Alert className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-xl' : 'rounded-xl'}>
                    <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/40' : 'size-4'} />
                    <AlertDescription className={theme === 'premium-dark' ? 'text-white/60' : ''}>
                      Please upload a credit card ledger in the "Credit Card Ledger" tab before running reconciliation.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Status Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CC Transactions Status */}
                  <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                    ${theme === 'premium-dark'
                      ? 'bg-gradient-to-br from-[#65D3FD]/10 to-transparent border-[#65D3FD]/20 hover:border-[#65D3FD]/40'
                      : 'bg-blue-50/50 border-blue-100 hover:border-blue-200'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#65D3FD]/80' : 'text-blue-600'}`}>
                        Statement Transactions
                      </span>
                      {ccTransactions.filter(t => !t.isPayment).length > 0 ? (
                        <div className={`p-1 rounded-full ${theme === 'premium-dark' ? 'bg-[#65D3FD]/20' : 'bg-blue-100'}`}>
                          <CheckCircle className={`size-4 ${theme === 'premium-dark' ? 'text-[#65D3FD]' : 'text-blue-600'}`} />
                        </div>
                      ) : (
                        <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-4xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {ccTransactions.filter(t => !t.isPayment).length}
                      </p>
                      <p className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#65D3FD]/40' : 'text-gray-500'}`}>items</p>
                    </div>
                    <p className={`text-xs mt-2 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                      Excluding payments
                    </p>
                  </div>

                  {/* Ledger Status */}
                  <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                    ${theme === 'premium-dark'
                      ? 'bg-gradient-to-br from-[#4F5CFE]/10 to-transparent border-[#4F5CFE]/20 hover:border-[#4F5CFE]/40'
                      : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-200'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#4F5CFE]/80' : 'text-indigo-600'}`}>
                        Ledger Entries
                      </span>
                      {ccLedgerEntries.length > 0 ? (
                        <div className={`p-1 rounded-full ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/20' : 'bg-indigo-100'}`}>
                          <CheckCircle className={`size-4 ${theme === 'premium-dark' ? 'text-[#4F5CFE]' : 'text-indigo-600'}`} />
                        </div>
                      ) : (
                        <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-4xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {ccLedgerEntries.length}
                      </p>
                      <p className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#4F5CFE]/40' : 'text-gray-500'}`}>entries</p>
                    </div>
                    <p className={`text-xs mt-2 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                      Ready to match
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {reconciliationResult?.locked && (
                    <Button
                      onClick={() => navigate(`/company/${companyId}/month-end?tab=cc-rec-review&period=${selectedPeriod}`)}
                      className={`flex-1 h-14 rounded-2xl font-bold text-lg transition-all duration-300 transform shadow-lg group
                      ${theme === 'premium-dark' || theme === 'dark'
                          ? 'bg-[#65D3FD] text-black hover:bg-[#65D3FD]/90 hover:scale-[1.01] hover:shadow-[#65D3FD]/25'
                          : 'bg-[#65D3FD] text-black hover:bg-[#65D3FD]/90 hover:shadow-blue-200 hover:-translate-y-0.5'}`}
                      size="lg"
                    >
                      <Eye className="size-6 mr-2 stroke-[2.5px]" />
                      Review Reconciliation Results
                    </Button>
                  )}

                  {/* Run Reconciliation Button */}
                  <Button
                    onClick={handleRunReconciliation}
                    disabled={isRunningReconciliation || ccTransactions.filter(t => !t.isPayment).length === 0 || ccLedgerEntries.length === 0 || isMonthLocked || reconciliationResult?.locked}
                    className={`${reconciliationResult?.locked ? 'flex-1' : 'w-full'} gap-2 h-14 rounded-2xl font-bold text-lg transition-all duration-300 transform shadow-lg group
                    ${reconciliationResult?.locked
                        ? theme === 'premium-dark' ? 'bg-white/5 text-white/50 border border-white/10' : 'bg-gray-100 text-gray-400 border border-gray-200'
                        : theme === 'premium-dark'
                          ? 'bg-[#65D3FD] text-black hover:bg-[#65D3FD]/90 hover:scale-[1.01] hover:shadow-[#65D3FD]/25'
                          : 'bg-[#65D3FD] text-black hover:bg-[#65D3FD]/90 hover:shadow-blue-200 hover:-translate-y-0.5'}`}
                    size="lg"
                  >
                    {isRunningReconciliation ? (
                      <>
                        <Loader2 className="size-5 animate-spin" />
                        Running Reconciliation...
                      </>
                    ) : (
                      <>
                        {reconciliationResult?.locked ? (
                          <>
                            <Lock className="size-5 mr-2" />
                            Reconciliation Locked
                          </>
                        ) : (
                          <>
                            <PlayCircle className="size-5 group-hover:scale-110 transition-transform" />
                            {reconciliationResult?.locked ? 'Reconciliation Locked' : isMonthLocked ? 'Period Locked' : 'Run Reconciliation'}
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Processing State */}
            {isRunningReconciliation && (
              <Card>
                <CardContent className="py-12">
                  <ProcessingStages type="cc-rec" />
                </CardContent>
              </Card>
            )}

            {/* Reconciliation Results */}
            {reconciliationResult && !isRunningReconciliation && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Matched Card */}
                  <Card className={`relative overflow-hidden border transition-all duration-300 group
                    ${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 hover:border-violet-500/30' : 'bg-white border-gray-100 hover:border-violet-200'}`}>
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
                      ${theme === 'premium-dark' ? 'bg-gradient-to-br from-violet-500/10 to-transparent' : 'bg-gradient-to-br from-violet-50/50 to-transparent'}`} />
                    <CardContent className="pt-6 relative z-10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm font-medium text-violet-300/60' : 'text-sm font-medium text-gray-500'}>Matched</p>
                          <div className="flex items-baseline gap-1 mt-1">
                            <p className={theme === 'premium-dark' ? 'text-3xl font-bold text-white tracking-tight' : 'text-3xl font-bold text-gray-900 tracking-tight'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              {reconciliationResult.matchedPairs?.length ?? 0}
                            </p>
                            <span className={theme === 'premium-dark' ? 'text-sm text-violet-300/40' : 'text-sm text-gray-400'}>pairs</span>
                          </div>
                        </div>
                        <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-xl bg-violet-500/20 flex items-center justify-center' : 'h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center'}>
                          <CheckCircle className="size-6 text-violet-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Unmatched CC Card */}
                  <Card className={`relative overflow-hidden border transition-all duration-300 group
                    ${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 hover:border-blue-500/30' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
                      ${theme === 'premium-dark' ? 'bg-gradient-to-br from-blue-500/10 to-transparent' : 'bg-gradient-to-br from-blue-50/50 to-transparent'}`} />
                    <CardContent className="pt-6 relative z-10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm font-medium text-blue-300/60' : 'text-sm font-medium text-gray-500'}>Unmatched CC</p>
                          <div className="flex items-baseline gap-1 mt-1">
                            <p className={theme === 'premium-dark' ? 'text-3xl font-bold text-white tracking-tight' : 'text-3xl font-bold text-gray-900 tracking-tight'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              {reconciliationResult.unmatchedTransactions?.length ?? 0}
                            </p>
                            <span className={theme === 'premium-dark' ? 'text-sm text-blue-300/40' : 'text-sm text-gray-400'}>items</span>
                          </div>
                        </div>
                        <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center' : 'h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center'}>
                          <AlertCircle className="size-6 text-blue-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Unmatched Ledger Card */}
                  <Card className={`relative overflow-hidden border transition-all duration-300 group
                    ${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 hover:border-indigo-500/30' : 'bg-white border-gray-100 hover:border-indigo-200'}`}>
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
                      ${theme === 'premium-dark' ? 'bg-gradient-to-br from-indigo-500/10 to-transparent' : 'bg-gradient-to-br from-indigo-50/50 to-transparent'}`} />
                    <CardContent className="pt-6 relative z-10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm font-medium text-indigo-300/60' : 'text-sm font-medium text-gray-500'}>Unmatched Ledger</p>
                          <div className="flex items-baseline gap-1 mt-1">
                            <p className={theme === 'premium-dark' ? 'text-3xl font-bold text-white tracking-tight' : 'text-3xl font-bold text-gray-900 tracking-tight'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              {reconciliationResult.unmatchedLedger?.length ?? 0}
                            </p>
                            <span className={theme === 'premium-dark' ? 'text-sm text-indigo-300/40' : 'text-sm text-gray-400'}>entries</span>
                          </div>
                        </div>
                        <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center' : 'h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center'}>
                          <AlertCircle className="size-6 text-indigo-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Match Rate Card */}
                  <Card className={`relative overflow-hidden border transition-all duration-300 group
                    ${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 hover:border-emerald-500/30' : 'bg-white border-gray-100 hover:border-emerald-200'}`}>
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
                      ${theme === 'premium-dark' ? 'bg-gradient-to-br from-emerald-500/10 to-transparent' : 'bg-gradient-to-br from-emerald-50/50 to-transparent'}`} />
                    <CardContent className="pt-6 relative z-10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm font-medium text-emerald-300/60' : 'text-sm font-medium text-gray-500'}>Match Rate</p>
                          <div className="flex items-baseline gap-1 mt-1">
                            <p className={theme === 'premium-dark' ? 'text-3xl font-bold text-emerald-400 tracking-tight' : 'text-3xl font-bold text-emerald-600 tracking-tight'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              {reconciliationResult.matchRate?.toFixed(0) ?? 0}%
                            </p>
                            <span className={theme === 'premium-dark' ? 'text-sm text-emerald-300/40' : 'text-sm text-gray-400'}>complete</span>
                          </div>
                        </div>
                        <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center' : 'h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center'}>
                          <TrendingUp className="size-6 text-emerald-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Lock/Unlock Status and Actions */}
                {!isMonthLocked && reconciliationResult.locked ? (
                  <Card className={theme === 'premium-dark' ? 'bg-green-500/10 border-green-500/30 rounded-2xl' : 'bg-green-50 border-green-200 rounded-2xl'}>
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0' : 'h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0'}>
                            <Lock className={theme === 'premium-dark' ? 'size-5 text-green-400' : 'size-5 text-green-700'} />
                          </div>
                          <div>
                            <h3 className={theme === 'premium-dark' ? 'text-green-400' : 'text-green-900'}>Reconciliation Locked</h3>
                            <p className={theme === 'premium-dark' ? 'text-sm text-green-400/70 mt-1' : 'text-sm text-green-700 mt-1'}>
                              This reconciliation has been saved and locked for {selectedPeriod}.
                              {reconciliationResult.lockedAt && (
                                <span className="block mt-1">Locked on: {new Date(reconciliationResult.lockedAt).toLocaleString()}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={handleUnlockReconciliation}
                          disabled={isLockingReconciliation || isMonthLocked}
                          variant="outline"
                          className={theme === 'premium-dark' ? 'gap-2 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-full flex-shrink-0' : 'gap-2 border-green-300 hover:bg-green-100 rounded-full flex-shrink-0'}
                        >
                          {isLockingReconciliation ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Unlocking...
                            </>
                          ) : (
                            <>
                              <Unlock className="size-4" />
                              Update Reconciliation
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex justify-end gap-4">
                    <Button onClick={exportReport} variant="outline" className="gap-2 rounded-full border-gray-300 hover:bg-gray-100">
                      <Download className="size-4" />
                      Export Report
                    </Button>
                    <Button
                      onClick={handleLockReconciliation}
                      disabled={isLockingReconciliation}
                      className="gap-2 bg-[#65D3FD] text-black hover:bg-[#4fc3ed] rounded-full flex-shrink-0"
                    >
                      {isLockingReconciliation ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Lock className="size-4" />
                          Save & Lock
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Matched Transactions Card */}
                {(reconciliationResult.matchedPairs?.length ?? 0) > 0 && (
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-3xl overflow-hidden' : 'bg-white border-gray-100 rounded-3xl shadow-sm'}>
                    <CardHeader className={`border-b pb-4 ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Matched Transactions
                          </CardTitle>
                          <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                            Review and confirm matched pairs
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className={`px-3 py-1 rounded-lg ${theme === 'premium-dark' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                          {reconciliationResult.matchedPairs?.length ?? 0} matches
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto" key={reconciliationResult.reconciledAt || 'initial'}>
                        <table className="w-full">
                          <thead className={`border-b ${theme === 'premium-dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50/50 border-gray-100'}`}>
                            <tr>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Date</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Description</th>
                              <th className="text-right py-3 px-6 text-xs text-gray-500 font-medium">Charge</th>
                              <th className="text-right py-3 px-6 text-xs text-gray-500 font-medium">Payment</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Card</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Type</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Confidence</th>
                              <th className="text-center py-3 px-6 text-xs text-gray-500 font-medium"></th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${theme === 'premium-dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                            {(showAllMatches
                              ? reconciliationResult.matchedPairs ?? []
                              : reconciliationResult.matchedPairs?.slice(0, 10) ?? []
                            ).map((match, idx) => {
                              const matchId = match.transaction?.id || `match-${idx}`;
                              return (
                                <Fragment key={matchId}>
                                  <tr
                                    className={`cursor-pointer transition-colors group ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}
                                    onClick={() => setExpandedMatch(expandedMatch === matchId ? null : matchId)}
                                  >
                                    <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                      {match.transaction.date}
                                    </td>
                                    <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                      {match.transaction.description}
                                    </td>
                                    {/* Charge Column */}
                                    <td className={`py-4 px-6 text-sm font-medium text-right ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                      {!match.transaction.isPayment
                                        ? `${getCurrencySymbol(match.transaction.currency)}${formatCurrency(Math.abs(match.transaction.amount))}`
                                        : '-'
                                      }
                                    </td>
                                    {/* Payment Column */}
                                    <td className={`py-4 px-6 text-sm font-medium text-right ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-700'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                      {match.transaction.isPayment
                                        ? `${getCurrencySymbol(match.transaction.currency)}${formatCurrency(Math.abs(match.transaction.amount))}`
                                        : '-'
                                      }
                                    </td>
                                    <td className={`py-4 px-6 text-sm ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                      <div className="flex items-center gap-2">
                                        <CreditCard className="size-3 opacity-70" />
                                        {match.transaction.cardName}
                                        {match.transaction.cardLast4 && <span className="opacity-50">• {match.transaction.cardLast4}</span>}
                                      </div>
                                    </td>
                                    <td className="py-4 px-6">
                                      <Badge
                                        variant="outline"
                                        className={`uppercase text-[10px] tracking-wider font-bold px-2 py-0.5
                                        ${match.matchType === 'exact'
                                            ? (theme === 'premium-dark' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200')
                                            : match.matchType === 'one_to_many'
                                              ? (theme === 'premium-dark' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200')
                                              : match.matchType === 'many_to_one'
                                                ? (theme === 'premium-dark' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200')
                                                : (theme === 'premium-dark' ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-gray-100 text-gray-600 border-gray-200')
                                          }`}
                                      >
                                        {match.matchType === 'exact' ? 'EXACT'
                                          : match.matchType === 'one_to_many' ? 'SPLIT'
                                            : match.matchType === 'many_to_one' ? 'BATCH'
                                              : match.matchType}
                                      </Badge>
                                    </td>
                                    <td className="py-4 px-6">
                                      <span className={`text-xs font-bold ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {Math.round((match.matchConfidence ?? 0) > 1 ? (match.matchConfidence ?? 0) : (match.matchConfidence ?? 0) * 100)}%
                                      </span>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      <motion.div
                                        animate={{ rotate: expandedMatch === matchId ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                      >
                                        <ChevronDown className={`size-4 ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                                      </motion.div>
                                    </td>
                                  </tr>
                                  {/* Temporarily disabled animation to test rendering issue */}
                                  {expandedMatch === matchId && (
                                    <tr>
                                      <td colSpan={8} className={`p-0 ${theme === 'premium-dark' ? 'bg-white/[0.02]' : 'bg-gray-50/50'}`}>
                                        <div className={theme === 'premium-dark' ? 'bg-white/[0.02] px-8 py-6 border-b border-dashed border-white/10' : 'bg-blue-50/50 px-8 py-6 border-b border-dashed border-blue-200'}>
                                          <div className="space-y-4">
                                            {/* Ledger Entries */}
                                            <div>
                                              <p className={theme === 'premium-dark' ? 'text-xs text-gray-400 font-bold uppercase tracking-wider mb-2' : 'text-xs text-gray-500 font-bold uppercase tracking-wider mb-2'}>Matched Ledger Entries:</p>
                                              <div className="space-y-2">
                                                {match.ledgerEntries && match.ledgerEntries.length > 0 ? (
                                                  <>
                                                    {match.ledgerEntries.map((entry, i) => (
                                                      <div key={i} className={theme === 'premium-dark' ? 'bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-sm backdrop-blur-sm' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm'}>
                                                        <div className="flex justify-between items-center">
                                                          <div className="flex flex-col gap-0.5">
                                                            <span className={`font-medium ${theme === 'premium-dark' ? 'text-gray-200' : 'text-gray-900'}`}>{entry.vendor || 'No Vendor'}</span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                              <span className="text-xs text-gray-500">{entry.date}</span>
                                                              {entry.glAccount && (
                                                                <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/5 text-gray-400 text-[10px] h-5' : 'bg-gray-100 text-gray-600 text-[10px] h-5'}>
                                                                  {entry.glAccount}
                                                                </Badge>
                                                              )}
                                                            </div>
                                                          </div>
                                                          <span className={`font-bold ml-4 ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                            {getCurrencySymbol(entry.currency || 'USD')}{formatCurrency(Math.max(entry.debit || 0, entry.credit || 0))}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    ))}
                                                    {match.ledgerEntries.length > 1 && (
                                                      <div className={theme === 'premium-dark' ? 'border-t border-white/10 pt-3 mt-3' : 'border-t border-gray-200 pt-3 mt-3'}>
                                                        <div className="flex items-center justify-between px-3">
                                                          <p className={theme === 'premium-dark' ? 'text-sm font-bold text-gray-400' : 'text-sm font-bold text-gray-700'}>Total:</p>
                                                          <p className={`text-sm font-bold ${theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                            {getCurrencySymbol(match.ledgerEntries[0]?.currency || 'USD')}
                                                            {match.ledgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0).toFixed(2)}
                                                          </p>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </>
                                                ) : match.ledgerEntry ? (
                                                  <div className={theme === 'premium-dark' ? 'bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-sm backdrop-blur-sm' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm'}>
                                                    <div className="flex justify-between items-center">
                                                      <div className="flex flex-col gap-0.5">
                                                        <span className={`font-medium ${theme === 'premium-dark' ? 'text-gray-200' : 'text-gray-900'}`}>{match.ledgerEntry.vendor || 'No Vendor'}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                          <span className="text-xs text-gray-500">{match.ledgerEntry.date}</span>
                                                          {match.ledgerEntry.glAccount && (
                                                            <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/5 text-gray-400 text-[10px] h-5' : 'bg-gray-100 text-gray-600 text-[10px] h-5'}>
                                                              {match.ledgerEntry.glAccount}
                                                            </Badge>
                                                          )}
                                                        </div>
                                                      </div>
                                                      <span className={`font-bold ml-4 ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                        {getCurrencySymbol(match.ledgerEntry.currency || 'USD')}{formatCurrency(Math.max(match.ledgerEntry.debit || 0, match.ledgerEntry.credit || 0))}
                                                      </span>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className={theme === 'premium-dark' ? 'bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-sm backdrop-blur-sm' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm'}>
                                                    <p className="text-gray-500 text-sm">No ledger entry data available</p>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {(reconciliationResult.matchedPairs?.length ?? 0) > 10 && (
                        <div className={`border-t py-4 text-center ${theme === 'premium-dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50/50 border-gray-100'}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllMatches(!showAllMatches)}
                            className={theme === 'premium-dark' ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}
                          >
                            {showAllMatches
                              ? 'Show Less'
                              : `Show ${(reconciliationResult.matchedPairs?.length ?? 0) - 10} More Transaction${(reconciliationResult.matchedPairs?.length ?? 0) - 10 !== 1 ? 's' : ''}`
                            }
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Unmatched Statement Transactions */}
                {(reconciliationResult.unmatchedTransactions?.length ?? 0) > 0 && (
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-3xl overflow-hidden' : 'bg-white border-gray-100 rounded-3xl shadow-sm'}>
                    <CardHeader className={`border-b pb-4 ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Unmatched Statement Transactions
                          </CardTitle>
                          <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                            Transactions from statement not present in ledger
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className={`px-3 py-1 rounded-lg ${theme === 'premium-dark' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {reconciliationResult.unmatchedTransactions?.length ?? 0} items
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className={`border-b ${theme === 'premium-dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50/50 border-gray-100'}`}>
                            <tr>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Description</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Card</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${theme === 'premium-dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                            {(reconciliationResult.unmatchedTransactions ?? []).map((txn) => (
                              <tr key={txn.id} className={`transition-colors group ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}>
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>{txn.date}</td>
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>{txn.description}</td>
                                <td className={`py-4 px-6 text-sm font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                  <div className="flex items-center gap-1">
                                    {getCurrencySymbol(txn.currency)}{Math.abs(txn.amount).toFixed(2)}
                                    <TrendingUp className={`size-3 ${theme === 'premium-dark' ? 'text-amber-400' : 'text-amber-600'}`} />
                                  </div>
                                </td>
                                <td className={`py-4 px-6 text-sm ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {txn.cardName}
                                  {txn.cardLast4 && <span className="opacity-50">• {txn.cardLast4}</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Unmatched Ledger Entries */}
                {(reconciliationResult.unmatchedLedger?.length ?? 0) > 0 && (
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-3xl overflow-hidden' : 'bg-white border-gray-100 rounded-3xl shadow-sm'}>
                    <CardHeader className={`border-b pb-4 ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Unmatched Ledger Entries
                          </CardTitle>
                          <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                            Ledger entries not present in statement
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className={`px-3 py-1 rounded-lg ${theme === 'premium-dark' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {reconciliationResult.unmatchedLedger?.length ?? 0} items
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className={`border-b ${theme === 'premium-dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50/50 border-gray-100'}`}>
                            <tr>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Vendor</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Memo</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">GL Account</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${theme === 'premium-dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                            {(reconciliationResult.unmatchedLedger ?? []).map((entry) => (
                              <tr key={entry.id} className={`transition-colors group ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}>
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>{entry.date}</td>
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>{entry.vendor}</td>
                                <td className={`py-4 px-6 text-sm ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-600'}`}>{entry.memo || '-'}</td>
                                <td className={`py-4 px-6 text-sm font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                  <div className="flex items-center gap-1">
                                    {getCurrencySymbol(entry.currency)}{entry.debit.toFixed(2)}
                                    <TrendingUp className={`size-3 ${theme === 'premium-dark' ? 'text-red-400' : 'text-red-600'}`} />
                                  </div>
                                </td>
                                <td className={`py-4 px-6 text-sm ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-600'}`}>{entry.glAccount || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <CreditCard className="size-12 mx-auto mb-3 text-gray-400" />
              <p>Select a company and period to begin</p>
            </div>
          </CardContent>
        </Card>
      )
      }
    </div >
  );
}