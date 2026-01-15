import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft, TrendingUp, Clock, ChevronRight, ChevronLeft, Building, Calendar, Trash2, PlayCircle, FileSpreadsheet, BookOpen, GitCompare, Eye, Lock, Unlock, AlertTriangle, Save, Landmark, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useRef, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { ProcessingStages } from '@/components/ProcessingStages';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { companiesApi, Company } from '@/utils/api-client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProcessingAnimation } from '@/components/ProcessingAnimation';
import { getBankLogo } from '@/utils/bankLogoDetection';
import novalareLogoImg from 'figma:asset/85a18c0f14d9634898763219441c014da1faf3e8.png';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase/client';
import { ReconciliationLoading } from './ReconciliationLoading';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency?: string;
  balance?: number;
  statementId: string;
  statementName: string;
}

interface BankStatement {
  id: string;
  fileName: string;
  uploadedAt: number;
  transactionCount: number;
  fileUrl?: string;
  filePath?: string;
}

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency?: string;
  account?: string;
  reference?: string;
}

interface GeneralLedger {
  id: string;
  fileName: string;
  uploadedAt: number;
  entryCount: number;
}

interface MatchedPair {
  bank_transaction?: BankTransaction;
  bank_transactions?: BankTransaction[];
  ledger_entries: LedgerEntry[];
  match_confidence: number;
  match_type: string;
  match_status?: 'auto_approved' | 'review_recommended' | 'manual_review_required';
  explanation?: string;
  match_flags?: {
    merchant_mismatch?: boolean;
    unknown_description?: boolean;
    amount_variance?: number;
    date_spread_days?: number;
    grouped_by_amount_only?: boolean;
  };
  fx_rate?: number;
  fx_fee?: number;
}

interface UnmatchedBank {
  transaction: BankTransaction;
  suggested_action: string;
  suggested_je?: {
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
  };
}

interface UnmatchedLedger {
  entry: LedgerEntry;
  reason: string;
  action: string;
}

interface ReconciliationResult {
  matched_pairs: MatchedPair[];
  unmatched_bank: UnmatchedBank[];
  unmatched_ledger: UnmatchedLedger[];
  summary: {
    total_bank_transactions: number;
    total_ledger_entries: number;
    matched_count: number;
    unmatched_bank_count: number;
    unmatched_ledger_count: number;
    total_bank_amount: number;
    total_ledger_amount: number;
    difference: number;
    match_rate: number;
    matched_bank_amount?: number;
    matched_ledger_amount?: number;
    matched_net_difference?: number;
    unmatched_bank_amount?: number;
    unmatched_ledger_amount?: number;
    unmatched_net_difference?: number;
  };
  locked?: boolean;
  lockedAt?: string;
  unlockedAt?: string;
}

interface BankReconciliationProps {
  companyId: string;
}

export function BankReconciliation({ companyId }: BankReconciliationProps) {
  const { theme } = useTheme();
  const { session } = useAuth();
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Bank Account Info (from URL param)
  const [bankAccount, setBankAccount] = useState<any>(null);
  const [isLoadingBankAccount, setIsLoadingBankAccount] = useState(true);

  // Period Selection only (company is passed as prop)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  // QuickBooks GL Account Selection
  const [qboAccounts, setQboAccounts] = useState<any[]>([]);
  const [selectedGLAccount, setSelectedGLAccount] = useState<string>('');
  const [isLoadingQBAccounts, setIsLoadingQBAccounts] = useState(false);
  const [companyQBOConnectionId, setCompanyQBOConnectionId] = useState<string>('');

  // Extraction Method Selection - Only Fast AI (Split & Map) is available
  const [extractionMethod, setExtractionMethod] = useState<'python-fast' | 'python-heuristic' | 'textract'>('python-fast');
  const [pythonApiStatus, setPythonApiStatus] = useState<'checking' | 'online' | 'offline' | 'unknown'>('unknown');
  const [checkingPythonApi, setCheckingPythonApi] = useState(false);

  // Bank Statements Tab - statements remain in local state, transactions use React Query
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [isUploadingBank, setIsUploadingBank] = useState(false);
  const [deletingStatementId, setDeletingStatementId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [streamingTransactions, setStreamingTransactions] = useState<BankTransaction[]>([]);
  const [processingStage, setProcessingStage] = useState<string>(''); // For animated messages
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);

  // Server-side pagination for bank transactions
  const [transactionPage, setTransactionPage] = useState(1);
  const TRANSACTIONS_PER_PAGE = 100;

  // General Ledger Tab
  const [generalLedger, setGeneralLedger] = useState<GeneralLedger | null>(null);
  // ledgerEntries and isLoadingLedgerData now come from React Query
  const [isUploadingLedger, setIsUploadingLedger] = useState(false);
  const [isSyncingGL, setIsSyncingGL] = useState(false);

  // Server-side pagination for ledger entries
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_ENTRIES_PER_PAGE = 100;

  // Reconciliation Tab
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [isLockingReconciliation, setIsLockingReconciliation] = useState(false);

  // Month-End Close Lock State
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);

  // Current Active Tab
  const [activeTab, setActiveTab] = useState<string>('bank-statements');

  // Export Dialog
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Company Currency - used for consistent display (ignores per-transaction currency detection)
  const [displayCurrency, setDisplayCurrency] = useState<string>('USD');

  // Flying dot animation for Month End notification
  const [showFlyingDot, setShowFlyingDot] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Missing Helper Functions & State
  const [showTextractTroubleshooting, setShowTextractTroubleshooting] = useState(false);

  // Mapping missing variable names to existing state
  const isLoadingLedgerUpload = isUploadingLedger;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'bank' | 'ledger') => {
    // Placeholder - actual implementation logic should be here or moved from where it was lost
    if (!event.target.files?.length) return;
    const file = event.target.files[0];

    if (type === 'bank') {
      setIsUploadingBank(true);
      // Simulate upload for now or implement actual upload logic if needed
      setTimeout(() => {
        setIsUploadingBank(false);
        toast.success('Bank statement uploaded (Simulation)');
        queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      }, 1500);
    } else {
      setIsUploadingLedger(true);
      setTimeout(() => {
        setIsUploadingLedger(false);
        toast.success('Ledger uploaded (Simulation)');
        queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      }, 1500);
    }
  };

  const handleDeleteStatement = async (statementId: string) => {
    if (!companyId || !selectedPeriod) {
      toast.error('Missing company or period information');
      return;
    }

    // Optimistic update - remove from UI immediately
    setDeletingStatementId(statementId);
    const previousStatements = [...bankStatements];
    setBankStatements(prev => prev.filter(s => s.id !== statementId));

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/delete-bank-statement`,
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
            statement_id: statementId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete statement');
      }

      toast.success('Statement deleted successfully');

      // Refresh transactions data
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
    } catch (error: any) {
      console.error('Failed to delete statement:', error);
      toast.error(error.message || 'Failed to delete statement');
      // Rollback on error
      setBankStatements(previousStatements);
    } finally {
      setDeletingStatementId(null);
    }
  };



  const bankFileInputRef = useRef<HTMLInputElement>(null);
  const ledgerFileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Helper function to format currency - ALWAYS uses company base currency for bank rec
  // (Bank statements for US companies are in USD regardless of transaction descriptions like "DROPBOX GBP")
  const formatCurrency = (amount: number, _currency?: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: displayCurrency, // Always use company base currency, ignore per-transaction currency
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const matchedSectionRef = useRef<HTMLDivElement>(null);
  const unmatchedBankSectionRef = useRef<HTMLDivElement>(null);
  const unmatchedLedgerSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // Reset to page 1 when period changes
  useEffect(() => {
    setTransactionPage(1);
    setLedgerPage(1);
  }, [selectedPeriod]);

  // Fetch bank transactions with server-side pagination using React Query
  const { data: bankDataResponse, isLoading: isLoadingBankData, error: bankDataError } = useQuery({
    queryKey: ['bank-transactions', companyId, accountId, selectedPeriod, transactionPage, TRANSACTIONS_PER_PAGE],
    queryFn: async () => {
      if (!companyId || !selectedPeriod || !accountId) {
        return { statements: [], transactions: [], pagination: null };
      }

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || publicAnonKey;

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/bank-data?company_id=${companyId}&period=${selectedPeriod}&account_id=${accountId}&page=${transactionPage}&pageSize=${TRANSACTIONS_PER_PAGE}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { statements: [], transactions: [], pagination: null };
        }
        throw new Error('Failed to fetch bank data');
      }

      const data = await response.json();
      return {
        statements: data.statements || [],
        transactions: data.transactions || [],
        pagination: data.pagination || null
      };
    },
    enabled: !!companyId && !!selectedPeriod && !!accountId,
    placeholderData: keepPreviousData,
  });

  // Extract data from React Query response
  const bankTransactions = bankDataResponse?.transactions || [];
  const transactionPagination = bankDataResponse?.pagination;

  // Update statements when data changes (statements don't change per page, only transactions)
  useEffect(() => {
    if (bankDataResponse?.statements) {
      setBankStatements(bankDataResponse.statements);
    }
  }, [bankDataResponse?.statements]);

  // Fetch ledger entries with server-side pagination using React Query
  const { data: ledgerDataResponse, isLoading: isLoadingLedgerData, error: ledgerDataError } = useQuery({
    queryKey: ['ledger-entries', companyId, accountId, selectedPeriod, ledgerPage, LEDGER_ENTRIES_PER_PAGE],
    queryFn: async () => {
      if (!companyId || !selectedPeriod || !accountId) {
        return { ledger: null, entries: [], pagination: null };
      }

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || publicAnonKey;

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/ledger-data?company_id=${companyId}&period=${selectedPeriod}&account_id=${accountId}&page=${ledgerPage}&pageSize=${LEDGER_ENTRIES_PER_PAGE}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { ledger: null, entries: [], pagination: null };
        }
        throw new Error('Failed to fetch ledger data');
      }

      const data = await response.json();
      return {
        ledger: data.ledger || null,
        entries: data.entries || [],
        pagination: data.pagination || null
      };
    },
    enabled: !!companyId && !!selectedPeriod && !!accountId,
    placeholderData: keepPreviousData,
  });

  // Extract ledger data from React Query response
  const ledgerEntries = ledgerDataResponse?.entries || [];
  const ledgerPagination = ledgerDataResponse?.pagination;

  // Update general ledger when data changes (ledger doesn't change per page, only entries)
  useEffect(() => {
    if (ledgerDataResponse?.ledger) {
      setGeneralLedger(ledgerDataResponse.ledger);
    }
  }, [ledgerDataResponse?.ledger]);

  // Load bank account details from Chart of Accounts
  useEffect(() => {
    const loadBankAccount = async () => {
      if (!accountId || !companyId) return;

      try {
        setIsLoadingBankAccount(true);
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
            setBankAccount(account);
          } else {
            toast.error('Bank account not found');
            navigate(`/company/${companyId}/reconciliations/bank`);
          }
        }
      } catch (error) {
        console.error('Failed to load bank account:', error);
        toast.error('Failed to load bank account');
      } finally {
        setIsLoadingBankAccount(false);
      }
    };

    loadBankAccount();
  }, [accountId, companyId]);

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

  // Load QB accounts when company changes and when bankAccount loads
  useEffect(() => {
    if (companyId) {
      loadQBAccounts(companyId);
    }
  }, [companyId, bankAccount]); // Re-run when bankAccount is loaded to set correct selectedGLAccount

  // Load data when company or period changes
  useEffect(() => {
    if (companyId && selectedPeriod) {
      // Load data sequentially to avoid overwhelming the backend
      const loadAllData = async () => {
        console.log('🔄 Loading all data for company and period...');
        await loadLockStatus();
        // Bank data and ledger data load via React Query automatically
        // Load reconciliation data
        await loadReconciliationData();
        console.log('✅ All data loaded');
      };

      loadAllData();
    }
  }, [companyId, selectedPeriod]);

  // Auto-check Python API when extraction method changes to python-heuristic
  useEffect(() => {
    if (extractionMethod === 'python-heuristic' && pythonApiStatus === 'unknown') {
      checkPythonApiStatus();
    }
  }, [extractionMethod]);

  // Animated processing messages
  useEffect(() => {
    if (!isUploadingBank || streamingTransactions.length > 0) {
      setProcessingStage('');
      return;
    }

    const messages = [
      '🔍 Splitting PDF into individual pages...',
      '🧠 Analyzing page layouts with AI...',
      '📊 Extracting transaction data...',
      '⚡ Processing pages in parallel...',
      '🎯 Mapping transactions to schema...',
      '✨ Almost there! Finalizing results...',
    ];

    let currentIndex = 0;
    setProcessingStage(messages[0]);

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % messages.length;
      setProcessingStage(messages[currentIndex]);
    }, 2000); // Change message every 2 seconds

    return () => clearInterval(interval);
  }, [isUploadingBank, streamingTransactions.length]);

  const loadLockStatus = async () => {
    if (!companyId || !selectedPeriod) return;

    try {
      console.log('🔒 Checking period lock status...');

      // Add timeout to prevent hanging - increased to 8 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/status?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setIsMonthLocked(data.isLocked || false);
        setLockDetails(data.isLocked ? data : null);
        console.log('✅ Period lock status:', data.isLocked ? 'Locked' : 'Unlocked');
      } else {
        console.log('⚠️ Lock status check returned non-ok response, defaulting to unlocked');
        setIsMonthLocked(false);
        setLockDetails(null);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Timeout - just silently default to unlocked (non-critical)
        console.log('Lock status check timed out, defaulting to unlocked');
      } else {
        console.log('Failed to check lock status, defaulting to unlocked');
      }
      // Default to unlocked if check fails - this is non-critical
      setIsMonthLocked(false);
      setLockDetails(null);
    }
  };

  // No longer needed - company is passed as prop
  // Removed loadCompanies function

  // Load QuickBooks accounts for the selected company
  const loadQBAccounts = async (companyId: string) => {
    if (!session?.access_token) {
      console.log('⚠️ No session available, skipping QB accounts load');
      return;
    }

    try {
      setIsLoadingQBAccounts(true);
      console.log(`📊 Loading QuickBooks accounts for company ${companyId}...`);

      // Get company to find QB connection ID
      const companyResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!companyResponse.ok) {
        console.log('⚠️ Company not found in QB system (might be a manual company)');
        setQboAccounts([]);
        setCompanyQBOConnectionId('');
        return;
      }

      const company = await companyResponse.json();

      if (!company.qbo_connection_id) {
        console.log('⚠️ This company is not connected to QuickBooks');
        setQboAccounts([]);
        setCompanyQBOConnectionId('');
        return;
      }

      setCompanyQBOConnectionId(company.qbo_connection_id);
      // Set company currency for consistent display (ignores per-transaction currency detection)
      if (company.currency) {
        setDisplayCurrency(company.currency);
        console.log(`💱 Company display currency set: ${company.currency}`);
      }
      console.log(`✅ Found QB connection: ${company.qbo_connection_id}`);

      // Fetch QB accounts from company COA
      const accountsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!accountsResponse.ok) {
        throw new Error('Failed to load QuickBooks accounts');
      }

      const { accounts } = await accountsResponse.json();

      // Filter to Bank accounts only
      const bankAccounts = accounts.filter((a: any) => a.type === 'Bank');
      console.log(`✅ Loaded ${bankAccounts.length} bank accounts from QuickBooks`);
      setQboAccounts(bankAccounts);

      // Use the specific bank account from URL parameter
      // The bankAccount state is loaded from COA and should have qbo_id
      if (bankAccount?.qbo_id) {
        // Find the matching account in the QB accounts list
        const matchingAccount = bankAccounts.find((a: any) => a.qbo_id === bankAccount.qbo_id);
        if (matchingAccount) {
          setSelectedGLAccount(matchingAccount.qbo_id);
          console.log(`📌 Selected account from URL: ${matchingAccount.name} (QBO ID: ${matchingAccount.qbo_id})`);
        } else {
          // Account exists in COA but not in QBO bank accounts - use the qbo_id directly
          setSelectedGLAccount(bankAccount.qbo_id);
          console.log(`📌 Using account QBO ID from URL: ${bankAccount.qbo_id} (name: ${bankAccount.name})`);
        }
      } else if (bankAccounts.length > 0) {
        // Fallback: auto-select first bank account if no URL account
        setSelectedGLAccount(bankAccounts[0].qbo_id);
        console.log(`📌 Auto-selected first account: ${bankAccounts[0].name} (QBO ID: ${bankAccounts[0].qbo_id})`);
      }

      // Debug: Log what we have in bankAccount
      console.log('🔍 Bank account from URL:', bankAccount ? {
        name: bankAccount.name,
        code: bankAccount.code,
        qbo_id: bankAccount.qbo_id,
        type: bankAccount.type
      } : 'null');
    } catch (error) {
      console.error('❌ Failed to load QB accounts:', error);
      setQboAccounts([]);
      setCompanyQBOConnectionId('');
      // Don't show error toast - this is optional feature
    } finally {
      setIsLoadingQBAccounts(false);
    }
  };

  // Check Python API status
  const checkPythonApiStatus = async () => {
    setCheckingPythonApi(true);
    setPythonApiStatus('checking');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/test-python-api`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPythonApiStatus(data.status === 'online' ? 'online' : 'offline');

        if (data.status === 'online') {
          toast.success(`Python API is online! ${data.message || ''}`);
        } else {
          toast.error(`Python API is offline: ${data.error || 'Unknown error'}`);
        }
      } else {
        setPythonApiStatus('offline');
        toast.error('Failed to connect to Python API');
      }
    } catch (error) {
      console.error('Python API check failed:', error);
      setPythonApiStatus('offline');
      toast.error('Python API is unreachable');
    } finally {
      setCheckingPythonApi(false);
    }
  };



  // Sync GL from QuickBooks
  const handleSyncGLFromQuickBooks = async () => {
    if (!companyId || !selectedPeriod || !selectedGLAccount || !companyQBOConnectionId) {
      toast.error('Please select a period and GL account first');
      return;
    }

    if (!session?.access_token) {
      toast.error('Please log in to sync from QuickBooks');
      return;
    }

    try {
      setIsSyncingGL(true);
      toast.loading('Syncing ledger from QuickBooks... (this may take up to 90 seconds)', { id: 'gl-sync' });

      // Reload company to ensure we have the latest connection ID
      const companyResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!companyResponse.ok) {
        throw new Error('Company not found');
      }

      const company = await companyResponse.json();

      if (!company.qbo_connection_id) {
        throw new Error('This company is not connected to QuickBooks');
      }

      const currentConnectionId = company.qbo_connection_id;
      console.log(`✅ Using connection ID: ${currentConnectionId}`);

      // Calculate start and end dates from selected period (YYYY-MM)
      const [year, month] = selectedPeriod.split('-');
      const startDate = `${year}-${month}-01`;
      // Get last day of the month: day 0 of the next month = last day of current month
      // Note: month from period is 1-indexed (11 = November), so we use it directly
      // new Date(2025, 11, 0) = Nov 30 (day 0 of Dec = last day of Nov)
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      console.log(`📊 Syncing GL for account ${selectedGLAccount}, period ${startDate} to ${endDate}`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

      try {
        // Call the bank register sync endpoint (transaction-level data, not split-level GL entries)
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/sync/${currentConnectionId}/bank-register`,
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
            }),
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Sync failed with status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Synced ${data.entries_count} GL entries from QuickBooks`);

        // Now store the entries in the bank-rec ledger format
        const glEntries = data.entries || [];

        // Transform QB GL entries to ledger format
        const transformedEntries: LedgerEntry[] = glEntries.map((entry: any, index: number) => ({
          id: `qb-${index}`,
          date: entry.date,
          description: entry.memo || entry.name || entry.transaction_type || '',
          amount: entry.amount || 0,
          account: entry.account || '',
          reference: entry.num || ''
        }));

        // Save to bank-rec ledger storage
        const saveResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/ledger-data`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              company_id: companyId,
              period: selectedPeriod,
              account_id: accountId, // Include account_id for account-specific ledger
              ledger: {
                id: `qb-sync-${Date.now()}`,
                fileName: `QuickBooks GL - ${selectedGLAccount}`,
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

        // Update local state
        setGeneralLedger({
          id: `qb-sync-${Date.now()}`,
          fileName: `QuickBooks GL - ${selectedGLAccount}`,
          uploadedAt: Date.now(),
          entryCount: transformedEntries.length
        });
        // We need to invalidate the query to refresh the data
        queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });

        toast.success(`✅ Synced ${transformedEntries.length} entries from QuickBooks!`, { id: 'gl-sync' });
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
          console.error('❌ GL sync timed out');
          toast.error('The request timed out. The General Ledger report is taking too long to generate. Please try a shorter date range or check your internet connection.', { id: 'gl-sync', duration: 8000 });
        } else if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
          console.error('❌ Network error during GL sync');
          toast.error('Network error. Please check your internet connection and try again.', { id: 'gl-sync' });
        } else {
          throw err; // Re-throw to be caught by outer catch
        }
      }
    } catch (err: any) {
      console.error('❌ GL sync error:', err);
      toast.error(err.message || 'Failed to sync GL from QuickBooks', { id: 'gl-sync' });
    } finally {
      setIsSyncingGL(false);
    }
  };

  // Load reconciliation results
  const loadReconciliationData = async () => {
    if (!companyId || !selectedPeriod) return;

    try {
      console.log('🔍 Loading reconciliation data...');

      // Add timeout to prevent hanging - increased to 30s for large datasets
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Include account_id to get account-specific reconciliation data
      const url = accountId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation-data?company_id=${companyId}&period=${selectedPeriod}&account_id=${accountId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation-data?company_id=${companyId}&period=${selectedPeriod}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setReconciliationResult(data.result || null);
        console.log(`✅ Loaded reconciliation data`);
      } else {
        console.log('⚠️ No reconciliation data found for this period');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error('❌ Reconciliation data load timed out after 30 seconds');
        toast.error('Reconciliation data load timed out. The server may be slow with large datasets. Please try again.');
      } else {
        console.error('❌ Failed to load reconciliation data:', err);
        toast.error('Failed to load reconciliation data');
      }
    }
  };

  // Upload bank statement with streaming
  const handleBankStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('🔥🔥🔥 UPLOAD FUNCTION CALLED! File:', file?.name, 'Size:', file?.size);
    if (!file) return;

    if (!companyId || !selectedPeriod) {
      console.log('❌ Missing company or period:', { companyId, selectedPeriod });
      toast.error('Please select a period first');
      return;
    }

    console.log('✅ Validation passed. Setting upload state...');
    setIsUploadingBank(true);
    setStreamingTransactions([]);
    setUploadProgress(null);
    setProcessingStartTime(Date.now());

    const formData = new FormData();
    formData.append('bank_file', file);
    formData.append('company_id', companyId);
    formData.append('account_id', accountId || '');
    formData.append('period', selectedPeriod);
    formData.append('extraction_method', extractionMethod);
    console.log('📦 FormData prepared:', { fileName: file.name, companyId: companyId, accountId: accountId, period: selectedPeriod, extractionMethod });

    // Show processing message for large files
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 0.5) {
      toast.info('Processing large PDF... This may take 1-3 minutes.', { duration: 5000 });
    }

    try {
      console.log('🚀 Starting streaming upload...');
      console.log('🌐 URL:', `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/upload-bank-statement-stream`);

      // Large PDFs can take 2-5 minutes to process with OpenAI - set timeout to 5 minutes
      const fetchWithTimeout = (url: string, options: RequestInit, timeout = 300000) => {
        return Promise.race([
          fetch(url, options),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out after 5 minutes. Large PDF files may take longer to process. Please try a smaller file or contact support.')), timeout)
          )
        ]);
      };

      console.log('⏱️ Waiting for server response (5 min timeout)...');
      console.log('💡 Large PDFs may take 1-3 minutes to process with AI...');
      console.log('🌐 Making fetch request NOW...');
      toast.info('Connecting to server...', { id: 'upload-status' });

      const response = await fetchWithTimeout(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/upload-bank-statement-stream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📡 RESPONSE RECEIVED FROM SERVER!');
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      toast.success('Server connected! Processing PDF...', { id: 'upload-status' });

      if (!response.ok) {
        throw new Error('Failed to upload bank statement');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No response body');
      }

      console.log('📖 Starting to read stream...');

      // Batch transactions for better performance with large datasets
      let transactionBatch: any[] = [];
      let lastBatchUpdate = Date.now();
      const BATCH_SIZE = 50; // Update UI every 50 transactions
      const BATCH_TIME_MS = 100; // Or every 100ms, whichever comes first

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('✅ Stream complete');
          // Flush remaining batch
          if (transactionBatch.length > 0) {
            setStreamingTransactions(prev => [...prev, ...transactionBatch]);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            console.log('📦 Received message:', data.type, data);

            if (data.type === 'transaction') {
              // Add to batch instead of updating immediately for better performance
              transactionBatch.push(data.data);
              setUploadProgress(data.progress);

              // Flush batch if size or time threshold reached
              const now = Date.now();
              if (transactionBatch.length >= BATCH_SIZE || (now - lastBatchUpdate) >= BATCH_TIME_MS) {
                console.log(`📦 Batching ${transactionBatch.length} transactions (${data.progress.current}/${data.progress.total})`);
                setStreamingTransactions(prev => [...prev, ...transactionBatch]);
                transactionBatch = [];
                lastBatchUpdate = now;
              }
            } else if (data.type === 'complete') {
              console.log('🎉 Upload complete!');
              const processingTime = ((Date.now() - processingStartTime) / 1000).toFixed(1);
              toast.success(`✨ Extracted ${data.transactionCount} transactions in ${processingTime}s! 🚀`);

              // Invalidate React Query cache to refetch bank data
              queryClient.invalidateQueries({ queryKey: ['bank-transactions', companyId, accountId, selectedPeriod] });

              // Clear streaming state
              setStreamingTransactions([]);
              setUploadProgress(null);
              setProcessingStage('');
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }

      // Clear file input
      if (bankFileInputRef.current) {
        bankFileInputRef.current.value = '';
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload bank statement';
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌❌❌ ERROR IN UPLOAD!');
      console.error('Error message:', errorMessage);
      console.error('Full error:', err);
      console.error('Stack trace:', err.stack);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Show error message to user
      if (errorMessage.includes('💡 Try:')) {
        // Show detailed error with option to switch
        toast.error(
          <div className="space-y-2">
            <div className="whitespace-pre-wrap">{errorMessage}</div>
            <button
              onClick={() => {
                setExtractionMethod('python-heuristic');
                toast.dismiss();
                toast.success('Switched to Heuristic extraction - try uploading again');
              }}
              className="mt-2 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
            >
              ⚡ Switch to Heuristic & Retry
            </button>
          </div>,
          { duration: 15000 }
        );
      } else if (errorMessage.includes('AWS_TEXTRACT_NOT_ACTIVATED')) {
        // AWS Textract setup required
        toast.error(
          <div className="space-y-3 max-w-lg">
            <div className="font-bold text-orange-600">⚠️ AWS Textract Not Activated</div>
            <div className="text-sm">
              Your AWS account needs full setup before Textract can be used.
              <br />
              <span className="font-semibold">📌 Already have payment? Click the troubleshooting guide below!</span>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  toast.dismiss();
                  setShowTextractTroubleshooting(true);
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                🔍 Full Troubleshooting Guide (RECOMMENDED)
              </button>
              <a
                href="https://console.aws.amazon.com/billing/home#/paymentmethods"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm text-center"
              >
                💳 Add Payment Method
              </a>
              <button
                onClick={() => {
                  setExtractionMethod('python-heuristic');
                  toast.dismiss();
                  toast.info('Switched to Python API - requires deployment on Render');
                }}
                className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
              >
                🐍 Use Python API Instead (Works Now)
              </button>
            </div>
            <div className="text-xs text-gray-600">
              If you already added payment but it's still not working, use the troubleshooting guide to find the exact issue.
            </div>
          </div>,
          { duration: 30000 }
        );
      } else if (errorMessage.includes('📋 SETUP REQUIRED:') || errorMessage.includes('CONSUMER_INVALID')) {
        // Google Document AI setup required
        toast.error(
          <div className="space-y-3 max-w-md">
            <div className="font-bold text-red-600">Google Document AI Not Enabled</div>
            <div className="text-sm whitespace-pre-wrap">{errorMessage}</div>
            <div className="flex gap-2">
              <a
                href={`https://console.cloud.google.com/apis/library/documentai.googleapis.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
              >
                🔧 Open Setup Guide
              </a>
              <button
                onClick={() => {
                  setExtractionMethod('python-heuristic');
                  toast.dismiss();
                  toast.success('Switched to Heuristic extraction - no setup needed!');
                }}
                className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
              >
                ⚡ Use Heuristic Instead
              </button>
            </div>
          </div>,
          { duration: 20000 }
        );
      } else {
        // Show regular error
        toast.error(errorMessage, { duration: 10000 });
      }

      // Clear streaming state on error
      setStreamingTransactions([]);
      setUploadProgress(null);
    } finally {
      console.log('🏁 Upload process finished. Cleaning up...');
      setIsUploadingBank(false);
    }
  };

  // Delete bank statement
  const handleDeleteBankStatement = async (statementId: string) => {
    if (!confirm('Are you sure you want to delete this bank statement and all its transactions?')) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/bank-statement/${statementId}?company_id=${companyId}&period=${selectedPeriod}&account_id=${accountId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Bank statement deleted');
        queryClient.invalidateQueries({ queryKey: ['bank-transactions', companyId, accountId, selectedPeriod] });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete bank statement');
      }
    } catch (err) {
      console.error('Failed to delete bank statement:', err);
      toast.error('Failed to delete bank statement');
    }
  };

  // Upload general ledger
  const handleLedgerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!companyId || !selectedPeriod) {
      toast.error('Please select a period first');
      return;
    }

    setIsUploadingLedger(true);

    const formData = new FormData();
    formData.append('ledger_file', file);
    formData.append('company_id', companyId);
    formData.append('period', selectedPeriod);
    // Include account_id to make ledger account-specific
    if (accountId) {
      formData.append('account_id', accountId);
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/upload-ledger`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload general ledger');
      }

      const data = await response.json();
      toast.success(`Uploaded ${file.name} - ${data.entryCount} entries extracted`);

      // Reload ledger data via React Query
      queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });

      // Clear file input
      if (ledgerFileInputRef.current) {
        ledgerFileInputRef.current.value = '';
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload general ledger';
      toast.error(errorMessage);
      console.error('Ledger upload error:', err);
    } finally {
      setIsUploadingLedger(false);
    }
  };

  // Export general ledger to XLSX
  const handleExportLedger = () => {
    if (!ledgerEntries || ledgerEntries.length === 0) {
      toast.error('No ledger entries to export');
      return;
    }

    try {
      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(ledgerEntries.map((entry: LedgerEntry) => ({
        ID: entry.id,
        Date: entry.date,
        Description: entry.description,
        Amount: entry.amount,
        Account: entry.account,
        Reference: entry.reference
      })));

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "General Ledger");

      // Generate filename
      const filename = `General_Ledger_${selectedPeriod}_${bankAccount?.name || 'Account'}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      toast.success('Ledger exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export ledger');
    }
  };

  // Run reconciliation
  const handleRunReconciliation = async () => {
    // Use total counts from pagination if available, otherwise use length
    const totalBankTransactions = transactionPagination?.total || bankTransactions.length;
    const totalLedgerEntries = ledgerPagination?.total || ledgerEntries.length;

    if (totalBankTransactions === 0) {
      toast.error('Please upload at least one bank statement first');
      return;
    }

    if (totalLedgerEntries === 0) {
      toast.error('Please upload a general ledger first');
      return;
    }

    setIsReconciling(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/run-reconciliation`,
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
        throw new Error(errorData.error || 'Failed to run reconciliation');
      }

      const data = await response.json();

      // 🔍 DEBUG: Check match quality
      const manyToOneMatches = data.matched_pairs?.filter((m: any) => m.match_type === 'many_to_one') || [];
      console.log('🔍 Many-to-one matches:', manyToOneMatches.length);
      manyToOneMatches.forEach((m: any, i: number) => {
        console.log(`  Match ${i}:`, {
          confidence: (m.match_confidence * 100).toFixed(0) + '%',
          status: m.match_status,
          flags: m.match_flags,
          bankTransactionsCount: m.bank_transactions?.length || 0,
        });
      });

      // Summary of match quality
      const autoApproved = data.matched_pairs?.filter((m: any) => m.match_status === 'auto_approved').length || 0;
      const reviewRecommended = data.matched_pairs?.filter((m: any) => m.match_status === 'review_recommended').length || 0;
      const manualRequired = data.matched_pairs?.filter((m: any) => m.match_status === 'manual_review_required').length || 0;
      console.log('📊 Match Quality:', {
        autoApproved,
        reviewRecommended,
        manualRequired,
        total: data.matched_pairs?.length || 0
      });

      setReconciliationResult(data);
      setActiveTab('reconciliation');
      toast.success('Reconciliation completed successfully!');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to run reconciliation';
      toast.error(errorMessage);
      console.error('Reconciliation error:', err);
    } finally {
      setIsReconciling(false);
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/lock-reconciliation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: companyId,
            period: selectedPeriod,
            account_id: accountId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save reconciliation');
      }

      const data = await response.json();
      setReconciliationResult(data.reconciliation);
      toast.success('Reconciliation saved and locked successfully!');

      // Trigger flying dot animation
      setShowFlyingDot(true);

      // Set notification in localStorage so it persists
      localStorage.setItem(`month-end-notification-${companyId}`, 'true');

      // Hide the flying dot after animation completes
      setTimeout(() => {
        setShowFlyingDot(false);
      }, 1500);
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/unlock-reconciliation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: companyId,
            period: selectedPeriod,
            account_id: accountId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unlock reconciliation');
      }

      const data = await response.json();
      setReconciliationResult(data.reconciliation);
      toast.success('Reconciliation unlocked. You can now update it.');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to unlock reconciliation';
      toast.error(errorMessage);
      console.error('Unlock reconciliation error:', err);
    } finally {
      setIsLockingReconciliation(false);
    }
  };

  // Export bank transactions (fetch all transactions without pagination)
  const handleExportTransactions = async (format: 'csv' | 'xlsx') => {
    try {
      // Fetch all transactions for export (without pagination)
      const { data: { session: sessionData } } = await supabase.auth.getSession();
      const accessToken = sessionData?.access_token || publicAnonKey;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/bank-data?company_id=${companyId}&period=${selectedPeriod}&account_id=${accountId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        toast.error('Failed to fetch transactions for export');
        return;
      }

      const data = await response.json();
      const allTransactions = data.transactions || [];

      if (allTransactions.length === 0) {
        toast.error('No transactions to export');
        return;
      }

      if (format === 'csv') {
        // Generate CSV
        const headers = ['Date', 'Description', 'Amount', 'Balance', 'Statement'];
        const rows = allTransactions.map((txn: BankTransaction) => [
          txn.date,
          `"${txn.description.replace(/"/g, '""')}"`, // Escape quotes
          txn.amount.toString(),
          txn.balance?.toString() || '',
          txn.statementName
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map((row: string[]) => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bank-transactions-${companyId}-${selectedPeriod}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        toast.success('Transactions exported as CSV');
      } else {
        // Generate XLSX
        const XLSX = await import('xlsx');

        const worksheetData = [
          ['Date', 'Description', 'Amount', 'Balance', 'Statement'],
          ...allTransactions.map((txn: BankTransaction) => [
            txn.date,
            txn.description,
            txn.amount,
            txn.balance || '',
            txn.statementName
          ])
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Bank Transactions');

        XLSX.writeFile(workbook, `bank-transactions-${companyId}-${selectedPeriod}.xlsx`);

        toast.success('Transactions exported as Excel');
      }

      setShowExportDialog(false);
    } catch (err: any) {
      toast.error('Failed to export transactions');
      console.error('Export error:', err);
    }
  };

  const exportReport = () => {
    if (!reconciliationResult) return;

    const loadingToast = toast.loading('Generating Excel report...');

    setTimeout(async () => {
      try {
        // 🔄 CRITICAL: Fetch fresh reconciliation data from backend before exporting
        // This ensures the Excel export includes the latest financial breakdown after manual matches/unmatches
        console.log('📊 Fetching latest reconciliation data before Excel export...');
        let freshReconciliationResult = reconciliationResult;

        try {
          const recDataResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation-data?company_id=${companyId}&period=${selectedPeriod}${accountId ? `&account_id=${accountId}` : ''}`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (recDataResponse.ok) {
            const recData = await recDataResponse.json();
            if (recData.result) {
              freshReconciliationResult = recData.result;
              console.log('✅ Fresh reconciliation data fetched for Excel export');
              console.log('💰 Financial breakdown:', {
                matched_bank: freshReconciliationResult.summary.matched_bank_amount,
                matched_ledger: freshReconciliationResult.summary.matched_ledger_amount,
                unmatched_bank: freshReconciliationResult.summary.unmatched_bank_amount,
                unmatched_ledger: freshReconciliationResult.summary.unmatched_ledger_amount
              });
            }
          } else {
            console.warn('⚠️ Failed to fetch fresh reconciliation data, using cached data');
          }
        } catch (fetchErr) {
          console.error('Failed to fetch fresh reconciliation data:', fetchErr);
          // Continue with cached data
        }

        // Use ExcelJS for advanced formatting
        const { default: ExcelJS } = await import('exceljs');
        const workbook = new ExcelJS.Workbook();

        // Fetch company details for proper company name and currency
        let companyName = companyId;
        let companyCurrency = 'USD'; // Default currency
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
            // Use company name, fallback to email or ID if not available
            companyName = companyData.name || companyData.email || companyId;
            // Get company currency, default to USD
            companyCurrency = companyData.currency || 'USD';
            console.log('✅ Company name fetched:', companyName);
            console.log('💱 Company currency:', companyCurrency);
          } else {
            console.error('Failed to fetch company:', companyResponse.status, await companyResponse.text());
            // Fallback to company ID if fetch fails
            companyName = companyId;
          }
        } catch (err) {
          console.error('Failed to fetch company name:', err);
          // Fallback to company ID if fetch fails
          companyName = companyId;
        }

        // Helper to get Excel number format for currency
        const getCurrencyNumFmt = (currency: string): string => {
          const formats: Record<string, string> = {
            'USD': '$#,##0.00',
            'EUR': '€#,##0.00',
            'GBP': '£#,##0.00',
            'JPY': '¥#,##0',
            'CAD': 'C$#,##0.00',
            'AUD': 'A$#,##0.00',
            'CHF': 'CHF #,##0.00',
            'MXN': 'MX$#,##0.00',
            'CNY': 'CN¥#,##0.00',
          };
          return formats[currency] || `${currency} #,##0.00`;
        };
        const currencyFmt = getCurrencyNumFmt(companyCurrency);

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

          // Position logo centered at top
          summarySheet.addImage(logoId, {
            tl: { col: 0.8, row: 0.5 },  // Centered position
            ext: { width: 150, height: 100 }  // Larger logo
          });

          // Adjust first rows height for logo
          summarySheet.getRow(1).height = 45;
          summarySheet.getRow(2).height = 45;
          summarySheet.getRow(3).height = 10;
        } catch (err) {
          console.error('Failed to add logo:', err);
        }

        // Title row with Novalare branding (shifted down to row 4)
        summarySheet.mergeCells('A4:B4');
        const titleCell = summarySheet.getCell('A4');
        titleCell.value = 'BANK RECONCILIATION SUMMARY';
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

        // Empty row
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
        addInfoRow('Account', bankAccount?.name || 'N/A', true);
        addInfoRow('Account Type', bankAccount?.account_type || 'Bank Account');
        if (bankAccount?.bank_name) {
          addInfoRow('Bank', bankAccount.bank_name);
        }
        addInfoRow('Period', generatePeriodOptions().find(p => p.value === selectedPeriod)?.label || '', true);
        addInfoRow('Report Date', new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }));

        // Empty row
        summarySheet.addRow([]);

        // Reconciliation Statistics
        const statsHeaderRow = summarySheet.addRow(['RECONCILIATION STATISTICS']);
        statsHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
        statsHeaderRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F0F0F0' }
        };

        addInfoRow('Total Bank Transactions', freshReconciliationResult.summary.total_bank_transactions, true);
        addInfoRow('Total Ledger Entries', freshReconciliationResult.summary.total_ledger_entries, true);
        addInfoRow('Matched Count', freshReconciliationResult.summary.matched_count, true);
        addInfoRow('Unmatched Bank', freshReconciliationResult.summary.unmatched_bank_count, true);
        addInfoRow('Unmatched Ledger', freshReconciliationResult.summary.unmatched_ledger_count, true);

        const matchRateRow = addInfoRow('Match Rate', `${freshReconciliationResult.summary.match_rate.toFixed(1)}%`, true);
        const matchRateValue = freshReconciliationResult.summary.match_rate;
        matchRateRow.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: matchRateValue >= 90 ? 'C6EFCE' : matchRateValue >= 70 ? 'FFEB9C' : 'FFC7CE' }
        };

        // Empty row
        summarySheet.addRow([]);

        // Financial Summary - CFO Grade
        const financialHeaderRow = summarySheet.addRow(['FINANCIAL SUMMARY']);
        financialHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: darkColor } };
        financialHeaderRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F0F0F0' }
        };

        // Overall Totals
        const bankAmountRow = addInfoRow('Total Bank Amount', freshReconciliationResult.summary.total_bank_amount, true);
        bankAmountRow.getCell(2).numFmt = currencyFmt;

        const ledgerAmountRow = addInfoRow('Total Ledger Amount', freshReconciliationResult.summary.total_ledger_amount, true);
        ledgerAmountRow.getCell(2).numFmt = currencyFmt;

        const differenceRow = addInfoRow('Gross Difference', freshReconciliationResult.summary.difference, true);
        differenceRow.getCell(2).numFmt = currencyFmt;
        differenceRow.getCell(2).font = { bold: true, size: 11, color: { argb: 'FF6600' } };

        // Empty row separator
        summarySheet.addRow([]);

        // 🆕 CFO-GRADE BREAKDOWN: Matched vs Unmatched
        const matchedBreakdownRow = summarySheet.addRow(['Matched Transactions Breakdown']);
        matchedBreakdownRow.getCell(1).font = { bold: true, size: 10, italic: true, color: { argb: '666666' } };

        const matchedBankRow = addInfoRow('  Matched Bank Amount', freshReconciliationResult.summary.matched_bank_amount || 0);
        matchedBankRow.getCell(2).numFmt = currencyFmt;
        matchedBankRow.getCell(1).font = { italic: true };

        const matchedLedgerRow = addInfoRow('  Matched Ledger Amount', freshReconciliationResult.summary.matched_ledger_amount || 0);
        matchedLedgerRow.getCell(2).numFmt = currencyFmt;
        matchedLedgerRow.getCell(1).font = { italic: true };

        const matchedNetRow = addInfoRow('  Matched Net Difference', freshReconciliationResult.summary.matched_net_difference || 0, true);
        matchedNetRow.getCell(2).numFmt = currencyFmt;
        matchedNetRow.getCell(1).font = { bold: true, italic: true };
        const matchedNetValue = Math.abs(freshReconciliationResult.summary.matched_net_difference || 0);
        matchedNetRow.getCell(2).font = {
          bold: true,
          color: { argb: matchedNetValue < 100 ? '00AA00' : matchedNetValue < 1000 ? 'FF6600' : 'FF0000' }
        };
        matchedNetRow.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: matchedNetValue < 100 ? 'E8F5E9' : 'FFF3E0' }
        };

        // Empty row separator
        summarySheet.addRow([]);

        const unmatchedBreakdownRow = summarySheet.addRow(['Unmatched Transactions Breakdown']);
        unmatchedBreakdownRow.getCell(1).font = { bold: true, size: 10, italic: true, color: { argb: '666666' } };

        const unmatchedBankRow = addInfoRow('  Unmatched Bank Amount', freshReconciliationResult.summary.unmatched_bank_amount || 0);
        unmatchedBankRow.getCell(2).numFmt = currencyFmt;
        unmatchedBankRow.getCell(1).font = { italic: true };

        const unmatchedLedgerRow = addInfoRow('  Unmatched Ledger Amount', freshReconciliationResult.summary.unmatched_ledger_amount || 0);
        unmatchedLedgerRow.getCell(2).numFmt = currencyFmt;
        unmatchedLedgerRow.getCell(1).font = { italic: true };

        const unmatchedNetRow = addInfoRow('  Unmatched Net Difference', freshReconciliationResult.summary.unmatched_net_difference || 0, true);
        unmatchedNetRow.getCell(2).numFmt = currencyFmt;
        unmatchedNetRow.getCell(1).font = { bold: true, italic: true };
        unmatchedNetRow.getCell(2).font = { bold: true, color: { argb: 'CC0000' } };

        // 2. MATCHED TRANSACTIONS SHEET
        const matchedSheet = workbook.addWorksheet('Matched Transactions', {
          properties: { tabColor: { argb: 'C6EFCE' } }
        });

        matchedSheet.columns = [
          { width: 12 }, { width: 35 }, { width: 14 },
          { width: 12 }, { width: 35 }, { width: 14 },
          { width: 15 }, { width: 12 }, { width: 50 }
        ];

        // Header row
        const matchedHeaders = ['Bank Date', 'Bank Description', 'Bank Amount', 'Ledger Date', 'Ledger Description', 'Ledger Amount', 'Match Type', 'Confidence', 'Explanation'];
        const matchedHeaderRow = matchedSheet.addRow(matchedHeaders);
        matchedHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        matchedHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: novalareColor }
        };
        matchedHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        matchedHeaderRow.height = 25;

        // Data rows
        freshReconciliationResult.matched_pairs.forEach((pair: any) => {
          const bankTxn = pair.bank_transaction || {};
          const ledgerEntries = Array.isArray(pair.ledger_entries) ? pair.ledger_entries : [];
          const matchType = pair.match_type || '';
          const confidence = typeof pair.match_confidence === 'number'
            ? pair.match_confidence
            : 0;
          const explanation = pair.explanation || '';

          if (ledgerEntries.length === 1) {
            const ledger = ledgerEntries[0] || {};
            const dataRow = matchedSheet.addRow([
              bankTxn.date || '',
              bankTxn.description || '',
              typeof bankTxn.amount === 'number' ? bankTxn.amount : '',
              ledger.date || '',
              ledger.description || '',
              typeof ledger.amount === 'number' ? ledger.amount : '',
              matchType,
              confidence,
              explanation
            ]);
            dataRow.getCell(3).numFmt = currencyFmt;
            dataRow.getCell(6).numFmt = currencyFmt;
            dataRow.getCell(8).numFmt = '0%';
          } else {
            ledgerEntries.forEach((ledger: any, idx: number) => {
              if (idx === 0) {
                const dataRow = matchedSheet.addRow([
                  bankTxn.date || '',
                  bankTxn.description || '',
                  typeof bankTxn.amount === 'number' ? bankTxn.amount : '',
                  ledger.date || '',
                  ledger.description || '',
                  typeof ledger.amount === 'number' ? ledger.amount : '',
                  matchType,
                  confidence,
                  explanation
                ]);
                dataRow.getCell(3).numFmt = currencyFmt;
                dataRow.getCell(6).numFmt = currencyFmt;
                dataRow.getCell(8).numFmt = '0%';
              } else {
                const dataRow = matchedSheet.addRow([
                  '', '', '',
                  ledger.date || '',
                  ledger.description || '',
                  typeof ledger.amount === 'number' ? ledger.amount : '',
                  '', '', ''
                ]);
                dataRow.getCell(6).numFmt = currencyFmt;
              }
            });
          }
        });

        // Freeze header row
        matchedSheet.views = [{ state: 'frozen', ySplit: 1 }];

        // 3. UNMATCHED BANK TRANSACTIONS SHEET
        const unmatchedBankSheet = workbook.addWorksheet('Unmatched Bank', {
          properties: { tabColor: { argb: 'FFEB9C' } }
        });

        unmatchedBankSheet.columns = [
          { width: 12 }, { width: 35 }, { width: 14 },
          { width: 40 }, { width: 25 }, { width: 25 }
        ];

        const unmatchedBankHeaders = ['Date', 'Description', 'Amount', 'Suggested Action', 'Debit Account', 'Credit Account'];
        const unmatchedBankHeaderRow = unmatchedBankSheet.addRow(unmatchedBankHeaders);
        unmatchedBankHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        unmatchedBankHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: novalareColor }
        };
        unmatchedBankHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        unmatchedBankHeaderRow.height = 25;

        freshReconciliationResult.unmatched_bank.forEach((txn: any) => {
          const dataRow = unmatchedBankSheet.addRow([
            txn.transaction?.date || '',
            txn.transaction?.description || '',
            txn.transaction?.amount || '',
            txn.suggested_action || '',
            txn.suggested_je?.debit_account || '',
            txn.suggested_je?.credit_account || ''
          ]);
          dataRow.getCell(3).numFmt = currencyFmt;
        });

        unmatchedBankSheet.views = [{ state: 'frozen', ySplit: 1 }];

        // 4. UNMATCHED LEDGER ENTRIES SHEET
        const unmatchedLedgerSheet = workbook.addWorksheet('Unmatched Ledger', {
          properties: { tabColor: { argb: 'FFC7CE' } }
        });

        unmatchedLedgerSheet.columns = [
          { width: 12 }, { width: 35 }, { width: 14 },
          { width: 35 }, { width: 35 }
        ];

        const unmatchedLedgerHeaders = ['Date', 'Description', 'Amount', 'Reason', 'Action'];
        const unmatchedLedgerHeaderRow = unmatchedLedgerSheet.addRow(unmatchedLedgerHeaders);
        unmatchedLedgerHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        unmatchedLedgerHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: novalareColor }
        };
        unmatchedLedgerHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        unmatchedLedgerHeaderRow.height = 25;

        freshReconciliationResult.unmatched_ledger.forEach((entry: any) => {
          const dataRow = unmatchedLedgerSheet.addRow([
            entry.entry?.date || '',
            entry.entry?.description || '',
            entry.entry?.amount || '',
            entry.reason || '',
            entry.action || ''
          ]);
          dataRow.getCell(3).numFmt = currencyFmt;
        });

        unmatchedLedgerSheet.views = [{ state: 'frozen', ySplit: 1 }];

        // Write to file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bank-reconciliation-${companyName.replace(/\s+/g, '-')}-${selectedPeriod}.xlsx`;
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

  // No longer need loading state for companies since it's passed as prop

  // Show loading state while bank account is being fetched
  if (isLoadingBankAccount) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className={`w-8 h-8 animate-spin mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Loading bank account...
          </p>
        </div>
      </div>
    );
  }

  // Show error if account not found
  if (!bankAccount) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className={`w-12 h-12 mx-auto ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Bank account not found
          </p>
          <Button
            onClick={() => navigate(`/company/${companyId}/reconciliations/bank`)}
            variant="outline"
          >
            Back to Bank Accounts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20">
      {/* Background Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className={`absolute -top-1/4 -right-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'premium-dark' ? 'bg-[#65D3FD]/20' : 'bg-[#65D3FD]/30'}`} />
        <div className={`absolute -bottom-1/4 -left-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/10' : 'bg-[#4F5CFE]/20'}`} />
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-[#65D3FD] rounded-full hidden lg:block shadow-[0_0_15px_rgba(101,211,253,0.5)]" />
          <div className="flex items-center gap-3 mb-2">
            <h1 className={`text-4xl font-black tracking-tighter ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
              Bank Reconciliation
            </h1>
            {bankAccount && (
              <Badge variant="outline" className={theme === 'premium-dark' ? 'border-[#65D3FD]/30 text-[#65D3FD] bg-[#65D3FD]/10' : 'border-[#65D3FD]/30 text-[#65D3FD] bg-[#65D3FD]/5'}>
                {bankAccount.name}
              </Badge>
            )}
          </div>
          <p className="text-gray-500 font-medium text-lg max-w-xl leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Automated transaction matching with AI-powered suggestions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/company/${companyId}/reconciliations/bank`)}
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
      {/* Uploads Locked Warning - Green and Above Tabs */}


      {/* 3-Tab Structure */}
      {
        companyId && selectedPeriod ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={theme === 'premium-dark'
              ? 'relative grid w-full grid-cols-3 h-auto p-1.5 gap-1 bg-white/[0.03] border border-white/10 rounded-2xl'
              : 'relative grid w-full grid-cols-3 h-auto p-1.5 gap-1 rounded-2xl bg-gray-100'
            }>
              <TabsTrigger
                value="bank-statements"
                className={theme === 'premium-dark'
                  ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                  : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
                }
              >
                {activeTab === 'bank-statements' && (
                  <motion.div
                    layoutId="active-bank-rec-tab"
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
                  <FileSpreadsheet className="size-4" />
                  Bank Statements
                  {bankStatements.length > 0 && (
                    <Badge variant="secondary" className={theme === 'premium-dark'
                      ? 'ml-auto bg-blue-500/20 text-blue-400 border-0 px-2 py-0.5 text-xs'
                      : 'ml-auto bg-blue-100 text-blue-700 px-2 py-0.5 text-xs'
                    }>
                      {bankStatements.length}
                    </Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="general-ledger"
                className={theme === 'premium-dark'
                  ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                  : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
                }
              >
                {activeTab === 'general-ledger' && (
                  <motion.div
                    layoutId="active-bank-rec-tab"
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
                  <BookOpen className="size-4" />
                  General Ledger
                  {generalLedger && (
                    <Badge variant="secondary" className={theme === 'premium-dark'
                      ? 'ml-auto bg-green-500/20 text-green-400 border-0 px-2 py-0.5 text-xs flex items-center gap-1'
                      : 'ml-auto bg-green-100 text-green-700 px-2 py-0.5 text-xs flex items-center gap-1'
                    }>
                      <CheckCircle className="size-3" />
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
                    layoutId="active-bank-rec-tab"
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
                  {reconciliationResult?.summary?.match_rate != null && (
                    <Badge variant="secondary" className={theme === 'premium-dark'
                      ? 'ml-auto bg-purple-500/20 text-purple-400 border-0 px-2 py-0.5 text-xs'
                      : 'ml-auto bg-violet-100 text-violet-700 px-2 py-0.5 text-xs'
                    }>
                      {reconciliationResult.summary.match_rate.toFixed(0)}%
                    </Badge>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Bank Statements */}
            <TabsContent value="bank-statements" className="space-y-4 mt-6">
              {/* Month-End Close Lock Alert */}
              {isMonthLocked && (
                <Alert className={theme === 'premium-dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                  <Lock className="size-4 text-white" />
                  <AlertDescription className="text-white">
                    <strong>Period is locked.</strong> This period has been closed and locked. You cannot upload or modify bank statements while the period is locked.
                  </AlertDescription>
                </Alert>
              )}

              {reconciliationResult?.locked && !isMonthLocked && (
                <Alert className={theme === 'premium-dark' ? 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl' : 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl'}>
                  <Lock className={theme === 'premium-dark' ? 'size-4 text-[#65D3FD]' : 'size-4 text-[#65D3FD]'} />
                  <AlertDescription className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>
                    To upload more bank statements, click "Update Reconciliation" in the Reconciliation tab
                  </AlertDescription>
                </Alert>
              )}

              {/* Python API Status Indicator */}
              {extractionMethod === 'python-heuristic' && (
                <Alert className={theme === 'premium-dark' ? 'bg-purple-500/10 border-purple-500/30 rounded-xl' : 'bg-purple-50 border-purple-200 rounded-xl'}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {pythonApiStatus === 'checking' && <Loader2 className={theme === 'premium-dark' ? 'size-4 text-purple-400 animate-spin' : 'size-4 text-purple-600 animate-spin'} />}
                      {pythonApiStatus === 'online' && <CheckCircle className={theme === 'premium-dark' ? 'size-4 text-green-400' : 'size-4 text-green-600'} />}
                      {pythonApiStatus === 'offline' && <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-red-400' : 'size-4 text-red-600'} />}
                      {pythonApiStatus === 'unknown' && <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-yellow-400' : 'size-4 text-yellow-600'} />}
                      <AlertDescription className={theme === 'premium-dark' ? 'text-purple-400' : 'text-purple-700'}>
                        {pythonApiStatus === 'checking' && <strong>Checking Python API status...</strong>}
                        {pythonApiStatus === 'online' && <strong>🐍 Python AI Microservice is Online! Ready to extract bank statements with AI layout discovery.</strong>}
                        {pythonApiStatus === 'offline' && <strong>⚠️ Python API is offline. Please check Render deployment.</strong>}
                        {pythonApiStatus === 'unknown' && <strong>🐍 Python AI Microservice - Click "Test API" to verify it's online</strong>}
                      </AlertDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkPythonApiStatus}
                      disabled={checkingPythonApi}
                      className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05]' : 'gap-2'}
                    >
                      {checkingPythonApi ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="size-4" />
                          Test API
                        </>
                      )}
                    </Button>
                  </div>
                </Alert>
              )}

              {extractionMethod === 'textract' && (
                <Alert className={theme === 'premium-dark' ? 'bg-orange-500/10 border-orange-500/30 mb-4' : 'bg-orange-50 border-orange-200 mb-4'}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-2xl">⚠️</div>
                    <div className="flex-1">
                      <div className={theme === 'premium-dark' ? 'font-semibold text-orange-300 mb-2' : 'font-semibold text-orange-900 mb-2'}>
                        AWS Textract Setup Required
                      </div>
                      <div className={theme === 'premium-dark' ? 'text-sm text-orange-200 space-y-2' : 'text-sm text-orange-800 space-y-2'}>
                        <p>Your AWS account needs full setup before Textract can be used (even though first 1,000 pages/month are free).</p>
                        <p className="text-xs italic">📌 Already have payment info but still getting errors? Click the troubleshooting guide below.</p>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setShowTextractTroubleshooting(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            🔍 Full Troubleshooting Guide
                          </Button>
                          <a
                            href="https://console.aws.amazon.com/billing/home#/paymentmethods"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 text-xs font-medium inline-flex items-center"
                          >
                            💳 Add Payment Method
                          </a>
                          <a
                            href="https://console.aws.amazon.com/support/home"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium inline-flex items-center"
                          >
                            📞 AWS Support
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </Alert>
              )}

              {/* Upload Area */}
              <Card className={theme === 'premium-dark'
                ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10 backdrop-blur-xl'
                : 'bg-white border-gray-100 shadow-sm'
              }>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>Upload Bank Statements</CardTitle>
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                        Upload PDF or Excel statements - AI will automatically split and extract transactions
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => bankFileInputRef.current?.click()}
                        disabled={isUploadingBank || isMonthLocked || reconciliationResult?.locked}
                        className="h-10 px-6 rounded-xl bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black font-bold shadow-lg shadow-[#65D3FD]/20 transition-all hover:scale-105 active:scale-95"
                      >
                        {isUploadingBank ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 size-4 stroke-[3px]" />
                            Upload Statement
                          </>
                        )}
                      </Button>
                      <input
                        ref={bankFileInputRef}
                        type="file"
                        multiple
                        onChange={handleBankStatementUpload}
                        accept=".pdf,.csv,.xlsx,.xls"
                        className="hidden"
                      />
                    </div>
                  </div>
                </CardHeader>
                {isUploadingBank && (
                  <CardContent>
                    <ProcessingAnimation
                      currentStage={processingStage}
                      progress={uploadProgress?.current && uploadProgress?.total ? (uploadProgress.current / uploadProgress.total) * 100 : undefined}
                      startTime={processingStartTime}
                    />
                  </CardContent>
                )}
                {bankStatements.length > 0 && (
                  <CardContent>
                    <div className="flex flex-col space-y-3">
                      {bankStatements.map((statement, idx) => (
                        <div
                          key={idx}
                          className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05]' : 'bg-gray-50 border-gray-100 hover:bg-gray-100/80'}`}
                        >
                          {/* File Info */}
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`p-2.5 rounded-xl ${theme === 'premium-dark' ? 'bg-[#65D3FD]/10' : 'bg-white shadow-sm'}`}>
                              <FileText className="size-5 text-[#65D3FD]" />
                            </div>
                            <div>
                              <h4 className={`font-bold text-sm ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>{statement.fileName}</h4>
                              <p className={`text-xs ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                {new Date().toLocaleDateString()} • PDF
                              </p>
                            </div>
                          </div>

                          {/* Stats Badge */}
                          <div className="flex items-center gap-6">
                            <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/5 text-gray-300 border-white/10 px-3 py-1.5' : 'bg-white text-gray-700 border-gray-200 px-3 py-1.5'}>
                              {statement.transactionCount} txns
                            </Badge>

                            {/* View Action */}
                            {statement.fileUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-blue-500 hover:bg-blue-500/10"
                                onClick={() => window.open(statement.fileUrl, '_blank')}
                                title="View Statement"
                              >
                                <Eye className="size-4" />
                              </Button>
                            )}

                            {/* Delete Action */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => handleDeleteStatement(statement.id)}
                              disabled={isMonthLocked || reconciliationResult?.locked || deletingStatementId === statement.id}
                              title="Delete Statement"
                            >
                              {deletingStatementId === statement.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Bank Transactions Table */}
              {isLoadingBankData ? (
                <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'}>
                  <CardContent className="py-20 text-center">
                    <Loader2 className="mx-auto size-12 text-[#65D3FD] animate-spin mb-4" />
                    <p className="text-gray-500 font-medium">Loading transactions...</p>
                  </CardContent>
                </Card>
              ) : bankTransactions.length > 0 ? (
                <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100 shadow-sm'}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>All Transactions</CardTitle>
                        {transactionPagination && transactionPagination.total > TRANSACTIONS_PER_PAGE && (
                          <CardDescription className="text-gray-500 mt-1">
                            Server-side pagination with {TRANSACTIONS_PER_PAGE} items per page
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary" className={`px-3 py-1 rounded-lg ${theme === 'premium-dark' ? 'bg-[#65D3FD]/10 text-[#65D3FD]' : 'bg-blue-50 text-blue-700'}`}>
                        {transactionPagination?.total || bankTransactions.length} items
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
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Running Balance</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {bankTransactions.map((txn: BankTransaction, i: number) => (
                            <tr key={txn.id || i} className={`transition-colors ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>{txn.date}</td>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                {txn.description}
                              </td>
                              <td className={`py-4 px-6 text-sm font-bold ${txn.amount >= 0
                                ? (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')
                                : (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')
                                }`}>
                                {formatCurrency(Math.abs(txn.amount), undefined)}
                                {txn.amount >= 0 ? <TrendingUp className="inline ml-1 w-3 h-3" /> : null}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-500 font-mono">
                                {txn.balance !== undefined ? formatCurrency(txn.balance, undefined) : '-'}
                              </td>
                              <td className="py-4 px-6 text-xs text-gray-400 max-w-[150px] truncate" title={txn.statementName}>
                                {txn.statementName}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Server-side Pagination Controls */}
                    {transactionPagination && transactionPagination.totalPages > 1 && (
                      <div className={`px-6 py-4 flex items-center justify-between border-t ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-100'}`}>
                        <div className="text-sm text-gray-500 font-medium">
                          Showing {((transactionPage - 1) * TRANSACTIONS_PER_PAGE) + 1} - {Math.min(transactionPage * TRANSACTIONS_PER_PAGE, transactionPagination.total)} of {transactionPagination.total} items
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTransactionPage(p => Math.max(1, p - 1))}
                            disabled={transactionPage === 1 || isLoadingBankData}
                            className={`rounded-lg ${theme === 'premium-dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : ''}`}
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Previous
                          </Button>
                          <div className={`px-4 py-2 text-sm font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                            Page {transactionPage} of {transactionPagination.totalPages}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTransactionPage(p => Math.min(transactionPagination.totalPages, p + 1))}
                            disabled={transactionPage >= transactionPagination.totalPages || isLoadingBankData}
                            className={`rounded-lg ${theme === 'premium-dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : ''}`}
                          >
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className={`rounded-3xl border-2 border-dashed p-12 text-center ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className={`mx-auto size-16 rounded-2xl flex items-center justify-center mb-4 ${theme === 'premium-dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                    <FileText className="size-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>No Transactions Yet</h3>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">Upload a bank statement above to extract transaction data automatically.</p>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: General Ledger */}
            {/* TAB 2: General Ledger */}
            <TabsContent value="general-ledger" className="space-y-6 mt-6">
              {/* Month-End Close Lock Alert */}
              {isMonthLocked && (
                <Alert className={theme === 'premium-dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                  <Lock className="size-4 text-white" />
                  <AlertDescription className="text-white">
                    <strong>Period is locked.</strong> This period has been closed and locked. You cannot upload or modify the general ledger while the period is locked.
                  </AlertDescription>
                </Alert>
              )}

              {reconciliationResult?.locked && !isMonthLocked && (
                <Alert className={theme === 'premium-dark' ? 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl' : 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl'}>
                  <Lock className={theme === 'premium-dark' ? 'size-4 text-[#65D3FD]' : 'size-4 text-[#65D3FD]'} />
                  <AlertDescription className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>
                    To upload more bank statements, click "Update Reconciliation" in the Reconciliation tab
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
                          General Ledger
                        </h2>
                      </div>
                      <p className={`max-w-lg ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Upload your general ledger export (Excel or CSV) to reconcile against bank transactions.
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-3 self-center">
                      <div className="flex items-center gap-3">

                        <Button
                          onClick={handleSyncGLFromQuickBooks}
                          disabled={isSyncingGL || isMonthLocked || reconciliationResult?.locked}
                          variant="outline"
                          className={`${theme === 'premium-dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} transition-all duration-300 h-11 px-6 rounded-xl font-medium`}
                        >
                          <RefreshCw className={`mr-2 size-4 ${isSyncingGL ? 'animate-spin' : ''}`} />
                          {isSyncingGL ? 'Syncing...' : 'Sync from QB'}
                        </Button>

                        <Button
                          onClick={() => ledgerFileInputRef.current?.click()}
                          variant="outline"
                          className={`${theme === 'premium-dark'
                            ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white hover:border-white/20'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            } transition-all duration-300 h-11 px-6 rounded-xl font-medium`}
                          disabled={isLoadingLedgerUpload || isMonthLocked || reconciliationResult?.locked}
                        >
                          {isLoadingLedgerUpload ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 size-4" />
                              {generalLedger ? 'Replace Ledger' : 'Upload Ledger'}
                            </>
                          )}
                        </Button>
                      </div>

                      {generalLedger && (
                        <div className={`flex items-center justify-end gap-2 text-xs ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'} w-full text-right`}>
                          <CheckCircle className="size-3 text-green-500" />
                          <span className="text-green-500 font-medium">Uploaded</span>
                          <span className="opacity-30">|</span>
                          <span>{generalLedger.fileName}</span>
                          <span className="opacity-30">•</span>
                          <span>{generalLedger.entryCount} entries</span>
                        </div>
                      )}

                      <input
                        ref={ledgerFileInputRef}
                        type="file"
                        onChange={handleLedgerUpload}
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* General Ledger Transactions Table */}
              {isLoadingLedgerData ? (
                <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'}>
                  <CardContent className="py-20 text-center">
                    <div className="relative mx-auto size-16 mb-4">
                      <div className="absolute inset-0 rounded-full border-t-2 border-[#4F5CFE] animate-spin"></div>
                      <Loader2 className="absolute inset-0 m-auto size-8 text-[#4F5CFE] animate-pulse" />
                    </div>
                    <p className="text-gray-500 font-medium">Loading ledger entries...</p>
                  </CardContent>
                </Card>
              ) : ledgerEntries.length > 0 ? (
                <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100 shadow-sm'}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>Ledger Entries</CardTitle>
                        {ledgerPagination && ledgerPagination.total > LEDGER_ENTRIES_PER_PAGE && (
                          <CardDescription className="text-gray-500 mt-1">
                            Server-side pagination with {LEDGER_ENTRIES_PER_PAGE} items per page
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary" className={`px-3 py-1 rounded-lg ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/10 text-[#4F5CFE]' : 'bg-blue-50 text-blue-700'}`}>
                        {ledgerPagination?.total || ledgerEntries.length} items
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
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Account</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {ledgerEntries.map((entry: LedgerEntry, i: number) => (
                            <tr key={entry.id || i} className={`transition-colors ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>{entry.date}</td>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                {entry.description}
                              </td>
                              <td className={`py-4 px-6 text-sm font-bold ${entry.amount >= 0
                                ? (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')
                                : (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')
                                }`}>
                                {formatCurrency(Math.abs(entry.amount), undefined)}
                                {entry.amount >= 0 ? <TrendingUp className="inline ml-1 w-3 h-3" /> : null}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-500 font-mono">
                                {entry.account}
                              </td>
                              <td className="py-4 px-6 text-xs text-gray-400 max-w-[150px] truncate">
                                {entry.reference || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Server-side Pagination Controls */}
                    {ledgerPagination && ledgerPagination.totalPages > 1 && (
                      <div className={`px-6 py-4 flex items-center justify-between border-t ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-100'}`}>
                        <div className="text-sm text-gray-500 font-medium">
                          Showing {((ledgerPage - 1) * LEDGER_ENTRIES_PER_PAGE) + 1} - {Math.min(ledgerPage * LEDGER_ENTRIES_PER_PAGE, ledgerPagination.total)} of {ledgerPagination.total} items
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                            disabled={ledgerPage === 1 || isLoadingLedgerData}
                            className={`rounded-lg ${theme === 'premium-dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : ''}`}
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Previous
                          </Button>
                          <div className={`px-4 py-2 text-sm font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                            Page {ledgerPage} of {ledgerPagination.totalPages}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLedgerPage(p => Math.min(ledgerPagination.totalPages, p + 1))}
                            disabled={ledgerPage >= ledgerPagination.totalPages || isLoadingLedgerData}
                            className={`rounded-lg ${theme === 'premium-dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : ''}`}
                          >
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}

            </TabsContent>

            {/* TAB 3: Reconciliation */}
            <TabsContent value="reconciliation" className="space-y-6 mt-6">
              {/* Month-End Close Lock Alert */}
              {isMonthLocked && (
                <Alert className={theme === 'premium-dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                  <Lock className="size-4 text-white" />
                  <AlertDescription className="text-white">
                    <strong>Period is locked.</strong> This period has been closed and locked. You cannot run or update the reconciliation while the period is locked.
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings and Run Button */}
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
                        Automatically match bank transactions with general ledger entries
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 relative z-10">
                  {/* Warnings */}
                  {(transactionPagination?.total || bankTransactions.length) === 0 && (
                    <Alert className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-xl' : 'rounded-xl'}>
                      <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/40' : 'size-4'} />
                      <AlertDescription className={theme === 'premium-dark' ? 'text-white/60' : ''}>
                        Please upload at least one bank statement in the "Bank Statements" tab before running reconciliation.
                      </AlertDescription>
                    </Alert>
                  )}

                  {(ledgerPagination?.total || ledgerEntries.length) === 0 && (
                    <Alert className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-xl' : 'rounded-xl'}>
                      <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/40' : 'size-4'} />
                      <AlertDescription className={theme === 'premium-dark' ? 'text-white/60' : ''}>
                        Please upload a general ledger in the "General Ledger" tab before running reconciliation.
                      </AlertDescription>
                    </Alert>
                  )}

                  {(transactionPagination?.total || bankTransactions.length) > 0 && (ledgerPagination?.total || ledgerEntries.length) === 0 && (
                    <Alert variant="destructive" className="rounded-xl">
                      <AlertCircle className="size-4" />
                      <AlertDescription>
                        <strong>Error:</strong> General ledger is missing. Please upload it in the "General Ledger" tab.
                      </AlertDescription>
                    </Alert>
                  )}

                  {(transactionPagination?.total || bankTransactions.length) > 0 && (ledgerPagination?.total || ledgerEntries.length) > 0 && !reconciliationResult && (
                    <div className="hidden"> {/* Hidden as per minimalist request, kept in DOM just in case logic needs it later */} </div>
                  )}

                  {/* Status Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bank Statements Status */}
                    <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                      ${theme === 'premium-dark'
                        ? 'bg-gradient-to-br from-[#65D3FD]/10 to-transparent border-[#65D3FD]/20 hover:border-[#65D3FD]/40'
                        : 'bg-blue-50/50 border-blue-100 hover:border-blue-200'}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#65D3FD]/80' : 'text-blue-600'}`}>
                          Bank Statements
                        </span>
                        {bankStatements.length > 0 ? (
                          <div className={`p-1 rounded-full ${theme === 'premium-dark' ? 'bg-[#65D3FD]/20' : 'bg-blue-100'}`}>
                            <CheckCircle className={`size-4 ${theme === 'premium-dark' ? 'text-[#65D3FD]' : 'text-blue-600'}`} />
                          </div>
                        ) : (
                          <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-4xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                          {bankStatements.length}
                        </p>
                        <p className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#65D3FD]/40' : 'text-gray-500'}`}>files</p>
                      </div>
                      <p className={`text-xs mt-2 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                        {transactionPagination?.total ?? bankTransactions.length} transactions ready
                      </p>
                    </div>

                    {/* General Ledger Status */}
                    <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                      ${theme === 'premium-dark'
                        ? 'bg-gradient-to-br from-[#4F5CFE]/10 to-transparent border-[#4F5CFE]/20 hover:border-[#4F5CFE]/40'
                        : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-200'}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#4F5CFE]/80' : 'text-indigo-600'}`}>
                          General Ledger
                        </span>
                        {generalLedger ? (
                          <div className={`p-1 rounded-full ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/20' : 'bg-indigo-100'}`}>
                            <CheckCircle className={`size-4 ${theme === 'premium-dark' ? 'text-[#4F5CFE]' : 'text-indigo-600'}`} />
                          </div>
                        ) : (
                          <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-4xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                          {generalLedger ? '1' : '0'}
                        </p>
                        <p className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#4F5CFE]/40' : 'text-gray-500'}`}>source</p>
                      </div>
                      <p className={`text-xs mt-2 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                        {ledgerPagination?.total ?? ledgerEntries.length} entries ready
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {reconciliationResult?.locked && (
                      <Button
                        onClick={() => navigate(`/company/${companyId}/month-end?tab=bank-rec-review&accountId=${accountId}&period=${selectedPeriod}`)}
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
                      disabled={isReconciling || bankTransactions.length === 0 || ledgerEntries.length === 0 || isMonthLocked || reconciliationResult?.locked}
                      className={`${reconciliationResult?.locked ? 'flex-1' : 'w-full'} gap-2 h-14 rounded-2xl font-bold text-lg transition-all duration-300 transform shadow-lg group
                      ${reconciliationResult?.locked
                          ? theme === 'premium-dark' ? 'bg-white/5 text-white/50 border border-white/10' : 'bg-gray-100 text-gray-400 border border-gray-200'
                          : theme === 'premium-dark'
                            ? 'bg-[#65D3FD] text-black hover:bg-[#65D3FD]/90 hover:scale-[1.01] hover:shadow-[#65D3FD]/25'
                            : 'bg-[#65D3FD] text-black hover:bg-[#65D3FD]/90 hover:shadow-blue-200 hover:-translate-y-0.5'}`}
                      size="lg"
                    >
                      {isReconciling ? (
                        <>
                          <Loader2 className="size-6 animate-spin" />
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
                              <PlayCircle className="size-6 stroke-[2.5px]" />
                              {reconciliationResult?.locked ? 'Reconciliation Locked' : isMonthLocked ? 'Period Locked' : 'Run Bank Reconciliation'}
                            </>
                          )}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Processing State */}
              {/* Processing State */}
              {isReconciling && (
                <ReconciliationLoading theme={theme === 'premium-dark' ? 'premium-dark' : 'light'} />
              )}

              {/* Results */}
              {reconciliationResult && !isReconciling && (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card
                      onClick={() => scrollToSection(matchedSectionRef)}
                      className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform duration-200`}
                    >
                      <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-violet-500/5 blur-3xl' : ''} />
                      <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Matched</p>
                            <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1' : 'text-3xl text-gray-900 mt-1'} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                              {reconciliationResult.summary?.matched_count ?? 0}
                            </p>
                          </div>
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                            <CheckCircle className="size-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      onClick={() => scrollToSection(unmatchedBankSectionRef)}
                      className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform duration-200`}
                    >
                      <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-blue-500/5 blur-3xl' : ''} />
                      <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Unmatched Bank</p>
                            <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1' : 'text-3xl text-gray-900 mt-1'} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                              {reconciliationResult.summary?.unmatched_bank_count ?? 0}
                            </p>
                          </div>
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            <Landmark className="size-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      onClick={() => scrollToSection(unmatchedLedgerSectionRef)}
                      className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform duration-200`}
                    >
                      <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-purple-500/5 blur-3xl' : ''} />
                      <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Unmatched Ledger</p>
                            <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1' : 'text-3xl text-gray-900 mt-1'} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                              {reconciliationResult.summary?.unmatched_ledger_count ?? 0}
                            </p>
                          </div>
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                            <BookOpen className="size-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl relative overflow-hidden' : 'bg-white border-gray-100 rounded-2xl relative overflow-hidden'}>
                      <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-green-500/5 blur-3xl' : ''} />
                      <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Match Rate</p>
                            <p className={theme === 'premium-dark' ? 'text-3xl text-green-400 mt-1' : 'text-3xl text-green-600 mt-1'} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                              {(reconciliationResult.summary?.match_rate ?? 0).toFixed(1)}%
                            </p>
                          </div>
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-600'}`}>
                            <TrendingUp className="size-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Lock/Unlock Status and Actions */}
                  {!isMonthLocked && reconciliationResult?.locked ? (
                    <Card className={theme === 'premium-dark' ? 'bg-green-500/10 border-green-500/20 rounded-2xl' : 'bg-green-50 border-green-200 rounded-2xl'}>
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0' : 'h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0'}>
                              <Lock className={theme === 'premium-dark' ? 'size-5 text-green-400' : 'size-5 text-green-700'} />
                            </div>
                            <div>
                              <h3 className={theme === 'premium-dark' ? 'text-green-400 font-bold' : 'text-green-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>Reconciliation Locked</h3>
                              <p className={theme === 'premium-dark' ? 'text-sm text-green-400/70 mt-1' : 'text-sm text-green-700 mt-1'}>
                                This reconciliation has been saved and locked for {selectedPeriod}.
                                {reconciliationResult?.lockedAt && (
                                  <span className="block mt-1">Locked on: {new Date(reconciliationResult?.lockedAt).toLocaleString()}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">

                            <Button
                              onClick={handleUnlockReconciliation}
                              disabled={isLockingReconciliation || isMonthLocked}
                              variant="outline"
                              className={theme === 'premium-dark' ? 'gap-2 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-xl flex-shrink-0' : 'gap-2 border-green-300 hover:bg-green-100 rounded-xl flex-shrink-0'}
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
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <Button onClick={exportReport} variant="outline" className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] rounded-xl h-11 px-5' : 'gap-2 rounded-xl h-11 px-5'}>
                        <Download className="size-4" />
                        Export Report
                      </Button>
                      <Button
                        ref={saveButtonRef}
                        onClick={handleLockReconciliation}
                        disabled={isLockingReconciliation}
                        className="gap-2 bg-[#65D3FD] text-black hover:bg-[#65D3FD]/90 rounded-xl h-11 px-6 font-medium shadow-[0_0_20px_rgba(101,211,253,0.3)] transition-all hover:shadow-[0_0_30px_rgba(101,211,253,0.5)]"
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

                  {/* Match Quality Summary */}
                  {(reconciliationResult?.matched_pairs?.length ?? 0) > 0 && (() => {
                    const autoApproved = reconciliationResult?.matched_pairs.filter(m => m.match_status === 'auto_approved').length;
                    const reviewRecommended = reconciliationResult?.matched_pairs.filter(m => m.match_status === 'review_recommended').length;
                    const manualRequired = reconciliationResult?.matched_pairs.filter(m => m.match_status === 'manual_review_required').length;

                    return manualRequired > 0 || reviewRecommended > 0 ? (
                      <div className={theme === 'premium-dark' ? 'rounded-2xl bg-white/[0.03] border border-white/10 p-6' : 'rounded-2xl bg-white border border-gray-100 p-6'}>
                        <div className="flex items-start justify-between mb-6">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <div className={theme === 'premium-dark' ? 'p-2 rounded-lg bg-amber-500/20' : 'p-2 rounded-lg bg-amber-100'}>
                                <AlertTriangle className={theme === 'premium-dark' ? 'size-5 text-amber-400' : 'size-5 text-amber-600'} />
                              </div>
                              <h3 className={theme === 'premium-dark' ? 'text-white text-lg font-bold' : 'text-gray-900 text-lg font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>Match Quality Breakdown</h3>
                            </div>
                            <p className={theme === 'premium-dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-500'}>
                              Quality review of the {reconciliationResult.summary?.matched_count ?? 0} matched transactions
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {autoApproved > 0 && (
                            <div className={theme === 'premium-dark' ? 'bg-green-500/10 border border-green-500/20 rounded-xl p-4' : 'bg-green-50 border border-green-100 rounded-xl p-4'}>
                              <div className={theme === 'premium-dark' ? 'text-green-400 text-2xl font-bold mb-1' : 'text-green-700 text-2xl font-bold mb-1'} style={{ fontFamily: "'Outfit', sans-serif" }}>{autoApproved}</div>
                              <div className={theme === 'premium-dark' ? 'text-green-400/70 text-sm font-medium' : 'text-green-700 text-sm font-medium'}>Auto-approved</div>
                            </div>
                          )}
                          {reviewRecommended > 0 && (
                            <div className={theme === 'premium-dark' ? 'bg-amber-500/10 border border-amber-500/20 rounded-xl p-4' : 'bg-amber-50 border border-amber-100 rounded-xl p-4'}>
                              <div className={theme === 'premium-dark' ? 'text-amber-400 text-2xl font-bold mb-1' : 'text-amber-700 text-2xl font-bold mb-1'} style={{ fontFamily: "'Outfit', sans-serif" }}>{reviewRecommended}</div>
                              <div className={theme === 'premium-dark' ? 'text-amber-400/70 text-sm font-medium' : 'text-amber-700 text-sm font-medium'}>Review recommended</div>
                            </div>
                          )}
                          {manualRequired > 0 && (
                            <div className={theme === 'premium-dark' ? 'bg-red-500/10 border border-red-500/20 rounded-xl p-4' : 'bg-red-50 border border-red-100 rounded-xl p-4'}>
                              <div className={theme === 'premium-dark' ? 'text-red-400 text-2xl font-bold mb-1' : 'text-red-700 text-2xl font-bold mb-1'} style={{ fontFamily: "'Outfit', sans-serif" }}>{manualRequired}</div>
                              <div className={theme === 'premium-dark' ? 'text-red-400/70 text-sm font-medium' : 'text-red-700 text-sm font-medium'}>Manual review required</div>
                            </div>
                          )}
                        </div>
                        <div className={theme === 'premium-dark' ? 'mt-6 pt-6 border-t border-white/10' : 'mt-6 pt-6 border-t border-gray-100'}>
                          <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'}>
                            <span className="font-semibold text-blue-400">Note:</span> The {reconciliationResult.summary?.unmatched_bank_count ?? 0} unmatched bank and {reconciliationResult.summary?.unmatched_ledger_count ?? 0} unmatched ledger transactions shown above are separate and require manual matching or investigation.
                          </p>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Matched Transactions */}
                  {(reconciliationResult?.matched_pairs?.length ?? 0) > 0 && (
                    <div ref={matchedSectionRef}>
                      <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-2xl overflow-hidden' : 'bg-white border-gray-100 rounded-2xl overflow-hidden'}>
                        <CardHeader className={theme === 'premium-dark' ? 'border-b border-white/10 bg-white/[0.02]' : 'border-b border-gray-100 bg-gray-50/50'}>
                          <div className="flex items-center justify-between">
                            <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              Matched Transactions
                            </CardTitle>
                            <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-violet-50 text-violet-700 border-violet-200'}>
                              {reconciliationResult?.matched_pairs.length} Matches
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className={theme === 'premium-dark' ? 'bg-white/[0.02] border-b border-white/5' : 'bg-gray-50/50 border-b border-gray-100'}>
                                <tr>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Date</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Description</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Amount</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Type</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Confidence</th>
                                  <th className={theme === 'premium-dark' ? 'text-center py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-center py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}></th>
                                </tr>
                              </thead>
                              <tbody className={theme === 'premium-dark' ? 'divide-y divide-white/5' : 'divide-y divide-gray-100'}>
                                {(showAllMatches
                                  ? reconciliationResult?.matched_pairs
                                  : reconciliationResult?.matched_pairs.slice(0, 10)
                                ).map((match, idx) => (
                                  <Fragment key={idx}>
                                    <tr
                                      className={theme === 'premium-dark' ? 'hover:bg-white/[0.02] transition-colors cursor-pointer group' : 'hover:bg-gray-50/80 transition-colors cursor-pointer group'}
                                      onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
                                    >
                                      <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-300 font-medium' : 'py-4 px-6 text-sm text-gray-600 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                        {match.bank_transaction?.date || match.bank_transactions?.[0]?.date}
                                      </td>
                                      <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white font-medium' : 'py-4 px-6 text-sm text-gray-900 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                        {/* Show grouped description for many-to-one */}
                                        {match.match_type === 'many_to_one' && (match.bank_transactions?.length ?? 0) > 1 ? (
                                          <div>
                                            <span className={theme === 'premium-dark' ? 'font-semibold text-amber-400' : 'font-semibold text-amber-600'}>{(match.bank_transactions?.length ?? 0)} Combined Transactions</span>
                                            <div className={theme === 'premium-dark' ? 'text-xs text-gray-500 mt-1' : 'text-xs text-gray-500 mt-1'}>
                                              {match.bank_transactions?.map((bt, i) => (
                                                <div key={i}>• {bt.description?.substring(0, 40) || 'Unknown'}</div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          match.bank_transaction?.description || match.bank_transactions?.[0]?.description
                                        )}
                                      </td>
                                      <td className="py-4 px-6 text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        {/* Show sum for many-to-one */}
                                        {match.match_type === 'many_to_one' && (match.bank_transactions?.length ?? 0) > 1 ? (
                                          <div>
                                            <div className={(match.bank_transactions?.reduce((sum, bt) => sum + bt.amount, 0) ?? 0) >= 0 ? (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600') : (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')}>
                                              {formatCurrency(Math.abs(match.bank_transactions?.reduce((sum, bt) => sum + bt.amount, 0) ?? 0), match.bank_transactions?.[0]?.currency)}
                                            </div>
                                            <div className="text-xs font-normal mt-1 space-y-0.5">
                                              {match.bank_transactions?.map((bt, i) => (
                                                <div key={i} className={`flex items-center gap-1 ${bt.amount >= 0 ? (theme === 'premium-dark' ? 'text-emerald-400/70' : 'text-emerald-600/70') : (theme === 'premium-dark' ? 'text-red-400/70' : 'text-red-600/70')}`}>
                                                  {formatCurrency(Math.abs(bt.amount), bt.currency)}
                                                  {bt.amount >= 0 && <TrendingUp className="size-3" />}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          <span className={`flex items-center gap-1 ${(match.bank_transaction?.amount ?? match.bank_transactions?.[0]?.amount ?? 0) >= 0 ? (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600') : (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')}`}>
                                            {formatCurrency(Math.abs(match.bank_transaction?.amount ?? match.bank_transactions?.[0]?.amount ?? 0), match.bank_transaction?.currency || match.bank_transactions?.[0]?.currency)}
                                            {(match.bank_transaction?.amount ?? match.bank_transactions?.[0]?.amount ?? 0) >= 0 && <TrendingUp className="size-3" />}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-4 px-6">
                                        <Badge
                                          variant="outline"
                                          className={
                                            match.match_type === 'exact'
                                              ? (theme === 'premium-dark' ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200')
                                              : match.match_type === 'tolerance'
                                                ? (theme === 'premium-dark' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                                                : match.match_type === 'fee_adjusted'
                                                  ? (theme === 'premium-dark' ? 'bg-orange-500/10 text-orange-300 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200')
                                                  : match.match_type === 'fx_adjusted' || match.match_type === 'fx'
                                                    ? (theme === 'premium-dark' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200')
                                                    : match.match_type === 'many_to_one'
                                                      ? (theme === 'premium-dark' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200')
                                                      : (theme === 'premium-dark' ? 'bg-white/5 text-gray-300 border-white/10' : 'bg-gray-50 text-gray-600 border-gray-200')
                                          }
                                        >
                                          {match.match_type === 'fx_adjusted' || match.match_type === 'fx' ? 'FX'
                                            : match.match_type === 'tolerance' ? 'Tolerance'
                                              : match.match_type === 'fee_adjusted' ? 'Fee'
                                                : match.match_type === 'many_to_one' ? `${match.bank_transactions?.length || 2}:1`
                                                  : match.match_type}
                                        </Badge>
                                      </td>
                                      <td className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                          <span className={theme === 'premium-dark' ? 'text-sm text-gray-400 font-bold' : 'text-sm text-gray-600 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                            {(match.match_confidence * 100).toFixed(0)}%
                                          </span>
                                          {/* Status badge */}
                                          {match.match_status === 'manual_review_required' && (
                                            <Badge variant="outline" className={theme === 'premium-dark' ? 'bg-red-500/10 text-red-300 border-red-500/20 text-[10px]' : 'bg-red-50 text-red-700 border-red-200 text-[10px]'}>
                                              Review Required
                                            </Badge>
                                          )}
                                          {match.match_status === 'review_recommended' && (
                                            <Badge variant="outline" className={theme === 'premium-dark' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 text-[10px]' : 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'}>
                                              Review
                                            </Badge>
                                          )}
                                          {match.match_status === 'auto_approved' && (
                                            <Badge variant="outline" className={theme === 'premium-dark' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px]' : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'}>
                                              ✓
                                            </Badge>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-4 px-6 text-center">
                                        <span className={theme === 'premium-dark' ? 'text-gray-500 text-xs group-hover:text-white transition-colors' : 'text-gray-400 text-xs group-hover:text-gray-600 transition-colors'}>
                                          {expandedMatch === idx ? '▲' : '▼'}
                                        </span>
                                      </td>
                                    </tr>
                                    {expandedMatch === idx && (
                                      <tr className="animate-in fade-in slide-in-from-top-2 duration-200">
                                        <td colSpan={6} className={theme === 'premium-dark' ? 'bg-white/[0.02] px-8 py-6 border-b border-dashed border-white/10' : 'bg-blue-50/50 px-8 py-6 border-b border-dashed border-blue-200'}>
                                          <div className="space-y-4">
                                            {/* Show detailed bank transactions for many-to-one */}
                                            {match.match_type === 'many_to_one' && (match.bank_transactions?.length ?? 0) > 1 && (
                                              <div className="mb-4">
                                                <p className={theme === 'premium-dark' ? 'text-xs text-gray-400 font-bold uppercase tracking-wider mb-2' : 'text-xs text-gray-500 font-bold uppercase tracking-wider mb-2'}>Bank Transactions ({(match.bank_transactions?.length ?? 0)}):</p>
                                                {match.bank_transactions?.map((bt, btIdx) => (
                                                  <div key={btIdx} className={theme === 'premium-dark' ? 'bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-sm mb-2 backdrop-blur-sm' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm mb-2'}>
                                                    <div className="flex items-center justify-between">
                                                      <div className="flex-1">
                                                        <p className={theme === 'premium-dark' ? 'text-gray-200 font-medium' : 'text-gray-900 font-medium'}>{bt.description}</p>
                                                        <p className={theme === 'premium-dark' ? 'text-xs text-gray-500 mt-1' : 'text-xs text-gray-500 mt-1'}>{bt.date}</p>
                                                      </div>
                                                      <p className={`font-bold ml-4 flex items-center gap-1 ${bt.amount >= 0 ? (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600') : (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                        {formatCurrency(Math.abs(bt.amount), bt.currency)}
                                                        {bt.amount >= 0 && <TrendingUp className="size-3" />}
                                                      </p>
                                                    </div>
                                                  </div>
                                                ))}
                                                <div className={theme === 'premium-dark' ? 'border-t border-white/10 pt-3 mt-3' : 'border-t border-gray-200 pt-3 mt-3'}>
                                                  <div className="flex items-center justify-between px-3">
                                                    <p className={theme === 'premium-dark' ? 'text-sm font-bold text-gray-400' : 'text-sm font-bold text-gray-700'}>Total:</p>
                                                    <p className={`text-sm font-bold ${(match.bank_transactions?.reduce((sum, bt) => sum + bt.amount, 0) ?? 0) >= 0
                                                      ? (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')
                                                      : (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')
                                                      }`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                      {formatCurrency(Math.abs(match.bank_transactions?.reduce((sum, bt) => sum + bt.amount, 0) ?? 0), match.bank_transactions?.[0]?.currency)}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            <p className={theme === 'premium-dark' ? 'text-xs text-gray-400 font-bold uppercase tracking-wider mb-2' : 'text-xs text-gray-500 font-bold uppercase tracking-wider mb-2'}>Matched Ledger Entries:</p>
                                            {match.ledger_entries && match.ledger_entries.length > 0 ? (
                                              match.ledger_entries.map((entry, ledgerIdx) => (
                                                <div key={ledgerIdx} className={theme === 'premium-dark' ? 'bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-sm backdrop-blur-sm' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm'}>
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                      <p className={theme === 'premium-dark' ? 'text-gray-200 font-medium' : 'text-gray-900 font-medium'}>{entry.description}</p>
                                                      <div className={theme === 'premium-dark' ? 'flex items-center gap-2 mt-1' : 'flex items-center gap-2 mt-1'}>
                                                        <p className="text-xs text-gray-500">{entry.date}</p>
                                                        {entry.account && (
                                                          <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/5 text-gray-400 text-[10px] h-5' : 'bg-gray-100 text-gray-600 text-[10px] h-5'}>
                                                            {entry.account}
                                                          </Badge>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <p className={theme === 'premium-dark' ? 'text-white font-bold ml-4' : 'text-gray-900 font-bold ml-4'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                      {formatCurrency(Math.abs(entry.amount), entry.currency)}
                                                    </p>
                                                  </div>
                                                </div>
                                              ))
                                            ) : (
                                              <div className={theme === 'premium-dark' ? 'bg-white/[0.03] border border-white/5 rounded-lg px-4 py-3 text-sm text-gray-500 italic' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500 italic'}>
                                                {match.explanation || 'Part of a combined match'}
                                              </div>
                                            )}

                                            {/* Warning flags section */}
                                            {match.match_flags && Object.keys(match.match_flags).length > 0 && (
                                              <div className={theme === 'premium-dark' ? 'mt-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs' : 'mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs'}>
                                                <p className={theme === 'premium-dark' ? 'font-bold text-amber-400 mb-2 uppercase tracking-wide' : 'font-bold text-amber-900 mb-2 uppercase tracking-wide'}>⚠️ Review Factors:</p>
                                                <div className={theme === 'premium-dark' ? 'space-y-1 text-amber-200/80' : 'space-y-1 text-amber-700'}>
                                                  {match.match_flags.merchant_mismatch && (
                                                    <p>• Merchant/description mismatch detected</p>
                                                  )}
                                                  {match.match_flags.unknown_description && (
                                                    <p>• Unknown or missing description</p>
                                                  )}
                                                  {match.match_flags.amount_variance && (
                                                    <p>• Amount variance: {formatCurrency(match.match_flags.amount_variance, match.bank_transaction?.currency || match.bank_transactions?.[0]?.currency)}</p>
                                                  )}
                                                  {match.match_flags.date_spread_days && (
                                                    <p>• {match.match_flags.date_spread_days}-day date spread</p>
                                                  )}
                                                  {match.match_flags.grouped_by_amount_only && (
                                                    <p>• Grouped by amount only (no description/date match)</p>
                                                  )}
                                                </div>
                                              </div>
                                            )}

                                            {match.match_type === 'fx_adjusted' && match.fx_rate && (
                                              <div className={theme === 'premium-dark' ? 'mt-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs' : 'mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs'}>
                                                <p className={theme === 'premium-dark' ? 'font-bold text-blue-400 mb-2 uppercase tracking-wide' : 'font-bold text-blue-900 mb-2 uppercase tracking-wide'}>🌍 FX Transaction Details:</p>
                                                <div className={theme === 'premium-dark' ? 'space-y-1 text-blue-200/80' : 'space-y-1 text-blue-700'}>
                                                  <p>Exchange Rate: <span className="font-mono">{match.fx_rate.toFixed(4)}</span></p>
                                                  <p>FX Fee: <span className="font-mono">{formatCurrency(match.fx_fee || 0, match.bank_transaction?.currency || match.bank_transactions?.[0]?.currency)}</span></p>
                                                  <p className={theme === 'premium-dark' ? 'text-blue-300 mt-2 italic' : 'text-blue-600 mt-2 italic'}>{match.explanation}</p>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {reconciliationResult?.matched_pairs.length > 10 && (
                            <div className={theme === 'premium-dark' ? 'border-t border-white/5 bg-white/[0.02] py-4 text-center' : 'border-t border-gray-100 bg-gray-50 py-4 text-center'}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAllMatches(!showAllMatches)}
                                className={theme === 'premium-dark' ? 'text-violet-300 hover:text-violet-200 hover:bg-violet-500/10' : 'text-violet-600 hover:text-violet-700 hover:bg-violet-50'}
                              >
                                {showAllMatches
                                  ? 'Show Less'
                                  : `Show ${reconciliationResult?.matched_pairs.length - 10} More Transaction${reconciliationResult?.matched_pairs.length - 10 !== 1 ? 's' : ''}`
                                }
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Unmatched Bank Transactions */}
                  {(reconciliationResult?.unmatched_bank?.length ?? 0) > 0 && (
                    <div ref={unmatchedBankSectionRef}>
                      <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-2xl overflow-hidden' : 'bg-white border-gray-100 rounded-2xl overflow-hidden'}>
                        <CardHeader className={theme === 'premium-dark' ? 'border-b border-white/10 bg-white/[0.02]' : 'border-b border-gray-100 bg-gray-50/50'}>
                          <div className="flex items-center justify-between">
                            <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              Unmatched Bank Transactions
                            </CardTitle>
                            <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/10 text-gray-300 border-white/10' : 'bg-gray-100 text-gray-700 border-gray-200'}>
                              {reconciliationResult?.unmatched_bank.length} Pending
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className={theme === 'premium-dark' ? 'bg-white/[0.02] border-b border-white/5' : 'bg-gray-50/50 border-b border-gray-100'}>
                                <tr>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Date</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Description</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Amount</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Suggested Action</th>
                                </tr>
                              </thead>
                              <tbody className={theme === 'premium-dark' ? 'divide-y divide-white/5' : 'divide-y divide-gray-100'}>
                                {reconciliationResult?.unmatched_bank.map((item, idx) => (
                                  <tr key={idx} className={theme === 'premium-dark' ? 'hover:bg-white/[0.02] transition-colors' : 'hover:bg-gray-50 transition-colors'}>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-400 font-medium' : 'py-4 px-6 text-sm text-gray-600 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                      {item.transaction.date}
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white font-medium' : 'py-4 px-6 text-sm text-gray-900 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                      {item.transaction.description}
                                    </td>
                                    <td className="py-4 px-6 text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                      <span className={`flex items-center gap-1 ${item.transaction.amount >= 0 ? (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600') : (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')}`}>
                                        {formatCurrency(Math.abs(item.transaction.amount), item.transaction.currency)}
                                        {item.transaction.amount >= 0 && <TrendingUp className="size-3" />}
                                      </span>
                                    </td>
                                    <td className="py-4 px-6">
                                      <div className="space-y-1">
                                        <p className={theme === 'premium-dark' ? 'text-sm text-gray-300' : 'text-sm text-gray-600'}>{item.suggested_action}</p>
                                        {item.suggested_je && (
                                          <div className={theme === 'premium-dark' ? 'text-[10px] text-gray-400 bg-white/5 border border-white/5 rounded px-2 py-1 mt-1 inline-block' : 'text-[10px] text-gray-500 bg-gray-100 border border-gray-200 rounded px-2 py-1 mt-1 inline-block'}>
                                            DR: {item.suggested_je.debit_account} • CR: {item.suggested_je.credit_account}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Unmatched Ledger Entries */}
                  {(reconciliationResult?.unmatched_ledger?.length ?? 0) > 0 && (
                    <div ref={unmatchedLedgerSectionRef}>
                      <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-2xl overflow-hidden' : 'bg-white border-gray-100 rounded-2xl overflow-hidden'}>
                        <CardHeader className={theme === 'premium-dark' ? 'border-b border-white/10 bg-white/[0.02]' : 'border-b border-gray-100 bg-gray-50/50'}>
                          <div className="flex items-center justify-between">
                            <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              Unmatched Ledger Entries
                            </CardTitle>
                            <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/10 text-gray-300 border-white/10' : 'bg-gray-100 text-gray-700 border-gray-200'}>
                              {reconciliationResult?.unmatched_ledger.length} Pending
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className={theme === 'premium-dark' ? 'bg-white/[0.02] border-b border-white/5' : 'bg-gray-50/50 border-b border-gray-100'}>
                                <tr>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Date</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Description</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Amount</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Reason</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Action</th>
                                </tr>
                              </thead>
                              <tbody className={theme === 'premium-dark' ? 'divide-y divide-white/5' : 'divide-y divide-gray-100'}>
                                {reconciliationResult?.unmatched_ledger.map((item, idx) => (
                                  <tr key={idx} className={theme === 'premium-dark' ? 'hover:bg-white/[0.02] transition-colors' : 'hover:bg-gray-50 transition-colors'}>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-400 font-medium' : 'py-4 px-6 text-sm text-gray-600 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                      {item.entry.date}
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white font-medium' : 'py-4 px-6 text-sm text-gray-900 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                      {item.entry.description}
                                    </td>
                                    <td className="py-4 px-6 text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                      <span className={`flex items-center gap-1 ${item.entry.amount >= 0 ? (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600') : (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')}`}>
                                        {formatCurrency(Math.abs(item.entry.amount), item.entry.currency)}
                                        {item.entry.amount >= 0 && <TrendingUp className="size-3" />}
                                      </span>
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-400' : 'py-4 px-6 text-sm text-gray-600'}>
                                      {item.reason}
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-400' : 'py-4 px-6 text-sm text-gray-600'}>
                                      {item.action}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                </div>
              )}

            </TabsContent>
          </Tabs >
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="size-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">Please select a period to get started</p>
            </CardContent>
          </Card>
        )
      }

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Bank Transactions</DialogTitle>
            <DialogDescription>
              Choose the format for exporting {bankTransactions.length} transaction{bankTransactions.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Button
              onClick={() => handleExportTransactions('csv')}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
            >
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <FileText className="size-5 text-green-600" />
              </div>
              <div className="text-left">
                <div className="text-sm">CSV Format</div>
                <div className="text-xs text-gray-500">Compatible with Excel, Google Sheets, and most software</div>
              </div>
            </Button>

            <Button
              onClick={() => handleExportTransactions('xlsx')}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileSpreadsheet className="size-5 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="text-sm">Excel Format (.xlsx)</div>
                <div className="text-xs text-gray-500">Native Excel format with formatting preserved</div>
              </div>
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flying Dot Animation to Month End Tab */}
      <AnimatePresence>
        {showFlyingDot && (
          <motion.div
            initial={{
              position: 'fixed',
              left: saveButtonRef.current?.getBoundingClientRect().left ?? 0,
              top: saveButtonRef.current?.getBoundingClientRect().top ?? 0,
              opacity: 1,
              scale: 1
            }}
            animate={{
              left: window.innerWidth / 2,
              top: 60,
              opacity: 0,
              scale: 0.3
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.2,
              ease: [0.4, 0.0, 0.2, 1]
            }}
            className="pointer-events-none z-[9999]"
          >
            <div className="w-4 h-4 rounded-full bg-[#65D3FD] shadow-lg shadow-[#65D3FD]/50" />
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}
