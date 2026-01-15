import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft, TrendingUp, Clock, ChevronRight, ChevronLeft, ChevronDown, Building, Calendar, Trash2, PlayCircle, FileSpreadsheet, BookOpen, GitCompare, Eye, Check, Landmark, RefreshCw, Save, Lock, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useRef, useEffect, Fragment } from 'react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBankLogo } from '@/utils/bankLogoDetection';
import { useAuth } from '@/contexts/AuthContext';
import novalareLogoImg from 'figma:asset/85a18c0f14d9634898763219441c014da1faf3e8.png';

interface BankAccount {
  id: string;
  name: string;
  code: string;
  subtype?: string;
  balance: number;
  type: string;
  currency?: string;
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  transaction_type?: string;
  currency?: string;
  reference?: string;
  statementName?: string;
}

interface ARLedgerEntry {
  id: string;
  invoice_number: string;
  customer: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  due_date?: string;
  description?: string;
  open_balance?: number;
  // Netting fields - populated when credit memos are applied
  gross_amount?: number;
  applied_credits?: number;
  credit_memo_refs?: string;
  credit_memo_details?: any[];
}

interface ARReconciliationProps {
  companyId?: string;
}

export function ARReconciliation({ companyId = '' }: ARReconciliationProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { session } = useAuth();

  // Period Selection
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  // Bank Accounts (from QuickBooks)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // Bank Inflows (customer payments from bank statements)
  const [bankInflows, setBankInflows] = useState<BankTransaction[]>([]);
  const [isLoadingInflows, setIsLoadingInflows] = useState(false);

  // AR Ledger
  const [arLedger, setARLedger] = useState<ARLedgerEntry[]>([]);
  const [isUploadingAR, setIsUploadingAR] = useState(false);
  const [isSyncingAR, setIsSyncingAR] = useState(false);

  // Reconciliation Tab
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isLockingReconciliation, setIsLockingReconciliation] = useState(false);

  // Current Active Tab
  const [activeTab, setActiveTab] = useState<string>('bank-inflows');

  // Expanded match state for showing details
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);

  // Month-End Close Lock State
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);

  const arFileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to format currency with proper symbol (EUR = €, GBP = £, JPY = ¥, etc.)
  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD', // Fallback to USD if currency is missing
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Generate period options (current and previous 12 months)
  const generatePeriodOptions = () => {
    const options: { value: string; label: string }[] = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthName = date.toLocaleString('default', { month: 'long' });

      options.push({
        value: `${year}-${month}`,
        label: `${monthName} ${year}`
      });
    }

    return options;
  };

  // Set default period to latest month on mount
  useEffect(() => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    setSelectedPeriod(`${year}-${month}`);
  }, []);

  // Load bank accounts on mount
  useEffect(() => {
    if (companyId) {
      loadBankAccounts();
    }
  }, [companyId]);

  // Load data when period changes
  useEffect(() => {
    if (companyId && selectedPeriod) {
      loadLockStatus();
      loadBankInflows();
      loadARLedger();
      loadReconciliationData();
    }
  }, [companyId, selectedPeriod]);

  const loadLockStatus = async () => {
    if (!companyId || !selectedPeriod) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/status?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setIsMonthLocked(data.isLocked || false);
        setLockDetails(data.isLocked ? data : null);
        console.log('Period lock status:', data);
      }
    } catch (error) {
      console.error('Failed to load lock status:', error);
    }
  };

  // Load bank accounts from QuickBooks
  const loadBankAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load bank accounts');
      }

      const { accounts } = await response.json();

      // Find Bank accounts
      const bankAccs = accounts.filter((a: any) => a.type === 'Bank');
      console.log(`✅ Loaded ${bankAccs.length} bank accounts`);
      setBankAccounts(bankAccs);

    } catch (error) {
      console.error('❌ Failed to load bank accounts:', error);
      toast.error('Failed to load bank accounts');
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  // Load bank inflows (customer payments) from existing bank statements
  const loadBankInflows = async () => {
    setIsLoadingInflows(true);
    try {
      // Fetch all bank transactions for the period
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/bank-inflows?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load bank inflows');
      }

      const data = await response.json();
      setBankInflows(data.inflows || []);
      console.log(`✅ Loaded ${data.inflows?.length || 0} customer payments (bank inflows)`);

    } catch (error) {
      console.error('❌ Failed to load bank inflows:', error);
      toast.error('Failed to load customer payments');
    } finally {
      setIsLoadingInflows(false);
    }
  };

  // Load AR Ledger from backend
  const loadARLedger = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/ar-ledger?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load AR ledger');
      }

      const data = await response.json();
      setARLedger(data.entries || []);
      console.log(`✅ Loaded ${data.entries?.length || 0} AR ledger entries`);

    } catch (error) {
      console.error('❌ Failed to load AR ledger:', error);
      // Don't show error toast, just fail silently if no data exists
    }
  };

  // Sync AR Ledger from QuickBooks (Consolidated)
  const handleSyncARFromQuickBooks = async () => {
    if (!companyId || !selectedPeriod) {
      toast.error('Please select a period first');
      return;
    }

    setIsSyncingAR(true);
    const loadingToast = toast.loading('Consolidating and Syncing AR Ledger from QuickBooks...');

    try {
      // 1. Get QuickBooks connection ID from company details
      const companyResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!companyResponse.ok) {
        throw new Error('Failed to fetch company details');
      }

      const companyData = await companyResponse.json();
      const qboConnectionId = companyData.qbo_connection_id;

      if (!qboConnectionId) {
        throw new Error('No QuickBooks connection found for this company. Please connect QuickBooks in the Integrations tab.');
      }

      // 2. Load Chart of Accounts to find all AR accounts
      const coaResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/coa`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!coaResponse.ok) {
        throw new Error('Failed to load Chart of Accounts');
      }

      const { accounts } = await coaResponse.json();
      const arAccountIds = accounts
        .filter((acc: any) => acc.type === 'Accounts Receivable' || acc.subtype === 'AccountsReceivable')
        .map((acc: any) => acc.id);

      if (arAccountIds.length === 0) {
        throw new Error('No Accounts Receivable accounts found in QuickBooks');
      }

      console.log(`🔍 Found ${arAccountIds.length} AR accounts`);

      // 3. Fetch AR Claims (invoices + credit memos with payment detection)
      const [year, month] = selectedPeriod.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

      console.log(`📡 Fetching AR Claims for ${startDate} to ${endDate}...`);

      const arClaimsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/sync/${qboConnectionId}/ar-claims`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate
          })
        }
      );

      if (!arClaimsResponse.ok) {
        const errorData = await arClaimsResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch AR claims');
      }

      const arClaimsData = await arClaimsResponse.json();
      const arClaims = arClaimsData.claims || [];
      const summary = arClaimsData.summary || {};

      console.log(`✅ AR Claims: Received ${arClaims.length} claims`);
      console.log(`   Summary: Invoiced=$${summary.total_invoiced}, Credits=$${summary.total_credits}, Open=$${summary.total_open}, Applied=$${summary.total_applied}`);

      // Transform AR claims to ARLedgerEntry format
      // Key change: amount = original_amount (what was billed), not open_balance
      const allTransformedEntries: ARLedgerEntry[] = arClaims.map((claim: any) => ({
        id: claim.id,
        invoice_number: claim.invoice_number,
        customer: claim.customer,
        date: claim.date,
        // Use ORIGINAL AMOUNT for matching (what was billed)
        amount: claim.original_amount,
        currency: 'USD',
        status: claim.status, // 'Open', 'Partial', or 'Paid'
        description: claim.memo || '',
        // Payment detection fields
        open_balance: claim.open_balance,
        already_applied: claim.already_applied,
        // Netting fields (for credit memos)
        is_credit_memo: claim.is_credit_memo,
        transaction_type: claim.transaction_type,
        // Legacy fields for backward compatibility
        gross_amount: claim.original_amount,
        applied_credits: claim.is_credit_memo ? Math.abs(claim.original_amount) : 0,
      }));

      if (allTransformedEntries.length === 0) {
        toast.dismiss(loadingToast);
        toast.info('No AR ledger entries found for the selected period');
        setIsSyncingAR(false);
        return;
      }

      // 4. Persist consolidated entries to backend
      const saveResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/ar-ledger`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companyId,
            period: selectedPeriod,
            ledger: {
              fileName: `QuickBooks Consolidated Sync (${selectedPeriod})`,
              uploadedAt: Date.now(),
              entryCount: allTransformedEntries.length
            },
            entries: allTransformedEntries
          })
        }
      );

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Failed to save consolidated ledger data to backend (Status: ${saveResponse.status})`);
      }

      toast.dismiss(loadingToast);
      toast.success(`Successfully synced ${allTransformedEntries.length} AR entries`);

      // Refresh UI
      loadARLedger();

    } catch (error) {
      console.error('❌ AR Sync Error:', error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : 'Failed to sync AR Ledger');
    } finally {
      setIsSyncingAR(false);
    }
  };

  // Upload AR Ledger (CSV)
  const handleARLedgerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPeriod) return;

    setIsUploadingAR(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', companyId);
    formData.append('period', selectedPeriod);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/upload-ledger`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        setARLedger(data.entries || []);
        toast.success(`AR Ledger uploaded: ${data.entryCount} invoices`);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('AR ledger upload error:', error);
      toast.error('Failed to upload AR ledger');
    } finally {
      setIsUploadingAR(false);
      if (arFileInputRef.current) {
        arFileInputRef.current.value = '';
      }
    }
  };

  // Load saved reconciliation data
  const loadReconciliationData = async () => {
    if (!companyId || !selectedPeriod) return;

    try {
      console.log('📂 Loading AR reconciliation data for', companyId, selectedPeriod);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/reconciliation?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded AR reconciliation data:', data);
        if (data.reconciliation) {
          setReconciliationResult(data.reconciliation);
          console.log('✅ Set reconciliation result with', data.reconciliation.matched_pairs?.length || 0, 'matches');
        } else {
          console.log('ℹ️ No reconciliation data found');
        }
      } else {
        console.log('⚠️ Response not OK:', response.status);
      }
    } catch (error) {
      console.error('Error loading AR reconciliation:', error);
    }
  };

  // Run AR Reconciliation
  const runReconciliation = async () => {
    if (!companyId || !selectedPeriod) return;
    if (bankInflows.length === 0 || arLedger.length === 0) {
      toast.error('Please upload both bank statements and AR ledger first');
      return;
    }

    setIsReconciling(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/reconcile`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companyId,
            period: selectedPeriod
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Reconciliation failed');
      }

      const data = await response.json();
      setReconciliationResult(data.reconciliation);

      toast.success(
        `Reconciliation complete! ${data.reconciliation.summary.matched_count} matches found (${data.reconciliation.summary.match_rate}% match rate)`
      );

      console.log('✅ Reconciliation result:', data.reconciliation);
      console.log('💱 Sample matched pair currency check:', {
        payment_currency: data.reconciliation.matched_pairs[0]?.payment?.currency,
        invoice_currency: data.reconciliation.matched_pairs[0]?.invoice?.currency
      });
    } catch (error) {
      console.error('❌ Reconciliation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run reconciliation');
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/lock-reconciliation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: companyId,
            period: selectedPeriod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save reconciliation');
      }

      const data = await response.json();
      setReconciliationResult(data.reconciliation);
      toast.success('AR Reconciliation saved and locked successfully!');
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-rec/unlock-reconciliation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: companyId,
            period: selectedPeriod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unlock reconciliation');
      }

      const data = await response.json();
      setReconciliationResult(data.reconciliation);
      toast.success('Reconciliation unlocked successfully!');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to unlock reconciliation';
      toast.error(errorMessage);
      console.error('Unlock reconciliation error:', err);
    } finally {
      setIsLockingReconciliation(false);
    }
  };

  // Export AR Reconciliation Results
  const handleExport = async () => {
    if (!reconciliationResult || !companyId || !selectedPeriod) return;

    setIsExporting(true);
    const loadingToast = toast.loading('Generating Excel report...');

    try {
      const { createARReconciliationExport } = await import('./ARRecExport');
      await createARReconciliationExport(
        reconciliationResult,
        companyId,
        selectedPeriod,
        publicAnonKey,
        projectId,
        novalareLogoImg,
        formatCurrency
      );

      toast.dismiss(loadingToast);
      toast.success('AR Reconciliation exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to export reconciliation');
    } finally {
      setIsExporting(false);
    }
  };



  const periods = generatePeriodOptions();

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-[#65D3FD] rounded-full hidden lg:block shadow-[0_0_15px_rgba(101,211,253,0.5)]" />
          <div className="flex items-center gap-3 mb-2">
            <h1 className={`text-4xl font-black tracking-tighter ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
              AR Reconciliation
            </h1>
          </div>
          <p className="text-gray-500 font-medium text-lg max-w-xl leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Match customer statements with AR ledger entries using AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/company/${companyId}/reconciliations`)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reconciliations
          </Button>

          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={`w-[240px] h-12 rounded-2xl border-2 font-bold ${theme === 'premium-dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'}`}>
              <Calendar className="mr-2 h-4 w-4 text-[#65D3FD]" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bank Accounts Section - Show accounts that have data */}
      {selectedPeriod && bankAccounts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Bank Accounts with Statements
              </h2>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                These accounts have bank statements uploaded for {selectedPeriod}
              </p>
            </div>
            <Button
              onClick={loadBankInflows}
              disabled={isLoadingInflows}
              variant="outline"
              size="sm"
              className={theme === 'dark' ? 'border-zinc-700 text-white hover:bg-zinc-800' : ''}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingInflows ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {isLoadingAccounts ? (
            <div className="text-center py-8">
              <Loader2 className="size-5 animate-spin text-[#023E8A] mx-auto mb-2" />
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Loading accounts...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bankAccounts.map((account) => {
                const bankLogo = getBankLogo(account.name);

                return (
                  <div
                    key={account.id}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg
                      ${theme === 'dark'
                        ? 'bg-zinc-900/50 border border-zinc-800/50'
                        : 'bg-gray-50 border border-gray-200/50'
                      }
                    `}
                  >
                    {/* Bank Logo or Generic Icon */}
                    {bankLogo ? (
                      <div className="w-8 h-8 flex items-center justify-center rounded overflow-hidden bg-white p-1">
                        <img
                          src={bankLogo}
                          alt={account.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className={`p-1.5 rounded ${theme === 'dark' ? 'bg-[#023E8A]/10' : 'bg-[#023E8A]/10'}`}>
                        <Landmark className="w-4 h-4 text-[#023E8A]" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {account.name}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        #{account.code}
                      </p>
                    </div>

                    {/* Balance */}
                    <div className="text-right">
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {formatCurrency(account.balance, account.currency)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      {selectedPeriod ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={theme === 'premium-dark'
            ? 'relative grid w-full grid-cols-3 h-auto p-1.5 gap-1 bg-white/[0.03] border border-white/10 rounded-2xl'
            : 'relative grid w-full grid-cols-3 h-auto p-1.5 gap-1 rounded-2xl bg-gray-100'
          }>
            <TabsTrigger
              value="bank-inflows"
              className={theme === 'premium-dark'
                ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
              }
            >
              {activeTab === 'bank-inflows' && (
                <motion.div
                  layoutId="active-ar-rec-tab"
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
                <TrendingUp className="size-4" />
                Customer Payments
                {bankInflows.length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-0">{bankInflows.length}</Badge>
                )}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="ar-ledger"
              className={theme === 'premium-dark'
                ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
              }
            >
              {activeTab === 'ar-ledger' && (
                <motion.div
                  layoutId="active-ar-rec-tab"
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
                AR Ledger
                {arLedger.length > 0 && <CheckCircle className="size-4 text-green-500 ml-1" />}
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
                  layoutId="active-ar-rec-tab"
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
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Bank Inflows (Customer Payments) */}
          <TabsContent value="bank-inflows" className="space-y-6">
            {/* Month-End Close Lock Alert */}
            {isMonthLocked && (
              <Alert className={theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. Bank statements are read-only while the period is locked.
                </AlertDescription>
              </Alert>
            )}

            {reconciliationResult?.locked && !isMonthLocked && (
              <Alert className={theme === 'dark' ? 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl' : 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl'}>
                <Lock className={theme === 'dark' ? 'size-4 text-[#65D3FD]' : 'size-4 text-[#65D3FD]'} />
                <AlertDescription className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                  This reconciliation has been saved and locked. To make changes, click "Update Reconciliation" in the Reconciliation tab.
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl relative overflow-hidden' : 'bg-white border-gray-100 rounded-2xl relative overflow-hidden'}>
              <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-blue-500/5 blur-3xl' : ''} />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={theme === 'premium-dark' ? 'text-white text-xl font-bold' : 'text-gray-900 text-xl font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                      Customer Payments from Bank Statements
                    </CardTitle>
                    <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                      All inflow transactions from uploaded bank statements for {selectedPeriod}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className={theme === 'premium-dark' ? 'gap-2 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl' : 'gap-2 rounded-xl'}
                    disabled={bankInflows.length === 0}
                  >
                    <Download className="size-4" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingInflows ? (
                  <div className="py-20 text-center">
                    <Loader2 className="mx-auto size-12 text-[#65D3FD] animate-spin mb-4" />
                    <p className="text-gray-500 font-medium">Loading customer payments...</p>
                  </div>
                ) : bankInflows.length === 0 ? (
                  <div className={`rounded-3xl border-2 border-dashed p-12 text-center m-6 ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className={`mx-auto size-16 rounded-2xl flex items-center justify-center mb-4 ${theme === 'premium-dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                      <TrendingUp className="size-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>No Customer Payments</h3>
                    <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">No customer payments found for this period. Upload bank statements in Bank Reconciliation.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className={`border-b ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                          <tr>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Description</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Statement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {bankInflows.map((transaction, index) => (
                            <tr
                              key={transaction.id || index}
                              className={`transition-colors ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}
                            >
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                {transaction.date}
                              </td>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                {transaction.description}
                              </td>
                              <td className="py-4 px-6 text-sm font-bold text-left text-emerald-500">
                                <span className="flex items-center gap-1">
                                  {formatCurrency(transaction.amount, transaction.currency)}
                                  <TrendingUp className="size-3" />
                                </span>
                              </td>
                              <td className={`py-4 px-6 text-xs ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                {transaction.statementName || 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={`px-6 py-4 text-xs font-medium text-center border-t ${theme === 'premium-dark' ? 'border-white/5 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
                      Showing all {bankInflows.length} customer payments for this period
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: AR Ledger */}
          <TabsContent value="ar-ledger" className="space-y-6">
            {/* Month-End Close Lock Alert */}
            {isMonthLocked && (
              <Alert className={theme === 'premium-dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. You cannot upload or modify AR ledger while the period is locked.
                </AlertDescription>
              </Alert>
            )}

            {reconciliationResult?.locked && !isMonthLocked && (
              <Alert className={theme === 'premium-dark' ? 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl' : 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl'}>
                <Lock className={theme === 'premium-dark' ? 'size-4 text-[#65D3FD]' : 'size-4 text-[#65D3FD]'} />
                <AlertDescription className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>
                  To upload a new AR ledger, click "Update Reconciliation" in the Reconciliation tab.
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl relative overflow-hidden' : 'bg-white border-gray-100 rounded-2xl relative overflow-hidden'}>
              <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-purple-500/5 blur-3xl' : ''} />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={theme === 'premium-dark' ? 'text-white text-xl font-bold' : 'text-gray-900 text-xl font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                      Upload AR Ledger
                      {reconciliationResult?.locked && (
                        <Badge variant="secondary" className={theme === 'premium-dark' ? 'ml-2 bg-white/10 text-gray-400 gap-1 border-0' : 'ml-2 bg-gray-100 text-gray-600 gap-1'}>
                          <Lock className="size-3" />
                          Locked
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                      Upload CSV file with invoice data (Invoice #, Customer, Date, Amount)
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      {/* Automated Consolidated Sync - Account selection removed per user request */}
                      <Button
                        variant="outline"
                        className={theme === 'premium-dark' ? 'gap-2 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-full' : 'gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 rounded-full'}
                        onClick={handleSyncARFromQuickBooks}
                        disabled={isSyncingAR || reconciliationResult?.locked || isMonthLocked}
                      >
                        {isSyncingAR ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="size-4" />
                            Sync from QuickBooks
                          </>
                        )}
                      </Button>

                      <div className={`h-4 w-px ${theme === 'premium-dark' ? 'bg-white/10' : 'bg-gray-200'}`} />

                      <Button
                        variant="outline"
                        className={theme === 'premium-dark' ? 'gap-2 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl' : 'gap-2 rounded-xl'}
                        onClick={() => arFileInputRef.current?.click()}
                        disabled={isUploadingAR || isMonthLocked || reconciliationResult?.locked}
                      >
                        {isUploadingAR ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="size-4" />
                            Upload CSV
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <input
                    ref={arFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleARLedgerUpload}
                    className="hidden"
                    disabled={reconciliationResult?.locked ?? false}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {arLedger.length === 0 ? (
                  <div className={`rounded-3xl border-2 border-dashed p-12 text-center m-6 ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className={`mx-auto size-16 rounded-2xl flex items-center justify-center mb-4 ${theme === 'premium-dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                      <FileText className="size-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>No AR Ledger Uploaded</h3>
                    <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">Upload your AR ledger CSV to reconcile invoices.</p>
                  </div>
                ) : (
                  <>
                    <div className="p-6">
                      {/* Netting Summary Card */}
                      {(() => {
                        // Calculate totals using absolute values since invoices should be positive
                        const totalGross = arLedger.reduce((sum, e) => sum + Math.abs(e.gross_amount || e.amount), 0);
                        const totalCredits = arLedger.reduce((sum, e) => sum + Math.abs(e.applied_credits || 0), 0);
                        const totalNet = arLedger.reduce((sum, e) => sum + Math.abs(e.amount), 0);
                        const invoicesWithCredits = arLedger.filter(e => e.applied_credits && e.applied_credits > 0).length;

                        return totalCredits > 0 ? (
                          <div className={`p-5 rounded-2xl border mb-6 ${theme === 'premium-dark' ? 'bg-gradient-to-r from-orange-900/10 to-amber-900/10 border-orange-500/20' : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100'}`}>
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`p-2 rounded-lg ${theme === 'premium-dark' ? 'bg-orange-500/10' : 'bg-orange-100'}`}>
                                <FileSpreadsheet className={`size-4 ${theme === 'premium-dark' ? 'text-orange-400' : 'text-orange-600'}`} />
                              </div>
                              <span className={`text-sm font-bold tracking-tight ${theme === 'premium-dark' ? 'text-orange-300' : 'text-orange-800'}`}>
                                AR Netting Applied
                              </span>
                              <Badge variant="outline" className={`ml-auto ${theme === 'premium-dark' ? 'bg-orange-500/10 text-orange-300 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                {invoicesWithCredits} invoice{invoicesWithCredits !== 1 ? 's' : ''} with credits
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                              <div>
                                <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-400'}`}>Gross Invoices</p>
                                <p className={`text-xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                  {formatCurrency(totalGross, arLedger[0]?.currency || 'USD')}
                                </p>
                              </div>
                              <div>
                                <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-400'}`}>Credits Applied</p>
                                <p className="text-xl font-bold text-orange-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                  −{formatCurrency(totalCredits, arLedger[0]?.currency || 'USD')}
                                </p>
                              </div>
                              <div>
                                <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-400'}`} title="Net amount invoiced (before payments)">Net Invoiced</p>
                                <p className="text-xl font-bold text-emerald-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                  {formatCurrency(totalNet, arLedger[0]?.currency || 'USD')}
                                </p>
                              </div>
                            </div>
                            <p className={`text-[10px] mt-3 ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                              * Net Invoiced = Gross Invoices − Credit Memos (payments matched separately from bank inflows)
                            </p>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* AR Ledger Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className={`border-b ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                          <tr>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Invoice #</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Customer</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                            <th className="text-right py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                            <th className="text-center py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Netting</th>
                            <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Due Date</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {arLedger.map((entry, index) => {
                            const isExpanded = expandedRow === (entry.id || String(index));
                            const hasCredits = entry.applied_credits && entry.applied_credits > 0;
                            const rowId = entry.id || String(index);

                            return (
                              <Fragment key={rowId}>
                                <tr
                                  className={`transition-colors ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'} ${hasCredits ? 'cursor-pointer' : ''}`}
                                  onClick={() => hasCredits && setExpandedRow(isExpanded ? null : rowId)}
                                >
                                  <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {entry.invoice_number || 'N/A'}
                                  </td>
                                  <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {entry.customer || 'N/A'}
                                  </td>
                                  <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {entry.date}
                                  </td>
                                  {/* AR invoices are always green (money owed TO you) */}
                                  <td className="py-4 px-6 text-sm font-bold text-right text-emerald-500">
                                    <div className="flex items-center justify-end gap-2">
                                      {formatCurrency(Math.abs(entry.amount), entry.currency)}
                                      <TrendingUp className="size-4" />
                                    </div>
                                  </td>
                                  {/* Netting Column */}
                                  <td className="py-4 px-6 text-center">
                                    {hasCredits ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${theme === 'premium-dark' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
                                          <span className="text-[10px] font-semibold uppercase tracking-wider">Credit</span>
                                          <span className="text-xs font-bold">
                                            −{formatCurrency(entry.applied_credits || 0, entry.currency)}
                                          </span>
                                        </div>
                                        {entry.credit_memo_refs && (
                                          <span className={`text-[10px] ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-400'} font-medium`}>
                                            Ref: {entry.credit_memo_refs}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className={`text-xs ${theme === 'premium-dark' ? 'text-gray-700' : 'text-gray-300'}`}>—</span>
                                    )}
                                  </td>
                                  <td className={`py-4 px-6 text-sm font-mono ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {entry.due_date || 'N/A'}
                                  </td>
                                  <td className="py-4 px-6 text-center">
                                    {hasCredits && (
                                      <span className="text-gray-400 text-xs text-center block w-full">
                                        {isExpanded ? <ChevronDown className="size-4 rotate-180 transition-transform" /> : <ChevronDown className="size-4 transition-transform" />}
                                      </span>
                                    )}
                                  </td>
                                </tr>

                                {/* Expanded Details Row */}
                                {isExpanded && (
                                  <tr className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <td colSpan={7} className={`p-0 border-b ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                      <div className={`
                                        flex justify-center p-6
                                        ${theme === 'premium-dark'
                                          ? 'bg-zinc-900/20'
                                          : 'bg-gray-50/30'
                                        }
                                      `}>
                                        {/* Payment Breakdown Card */}
                                        <div className={`
                                          w-full max-w-2xl rounded-2xl border shadow-sm
                                          ${theme === 'premium-dark'
                                            ? 'bg-zinc-800/80 border-zinc-700/50 shadow-black/20'
                                            : 'bg-white border-gray-100 shadow-gray-100'
                                          }
                                        `}>
                                          <div className={`px-6 py-4 border-b flex items-center justify-between ${theme === 'premium-dark' ? 'border-zinc-700/50' : 'border-gray-50'}`}>
                                            <p className={`text-xs font-semibold uppercase tracking-wider ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                              Payment Breakdown
                                            </p>
                                          </div>
                                          <div className="p-6 space-y-4">
                                            <div className="flex justify-between items-center group">
                                              <span className={`text-sm ${theme === 'premium-dark' ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-700'}`}>Original Invoice</span>
                                              <span className={`font-mono text-sm ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {formatCurrency(entry.gross_amount || entry.amount + (entry.applied_credits || 0), entry.currency)}
                                              </span>
                                            </div>

                                            <div className="flex justify-between items-center group transition-colors">
                                              <div className="flex items-center gap-3">
                                                <span className={`text-sm ${theme === 'premium-dark' ? 'text-orange-400/80 group-hover:text-orange-400' : 'text-orange-600/80 group-hover:text-orange-600'}`}>
                                                  Less Credits
                                                </span>
                                                <Badge variant="outline" className={`h-5 px-1.5 text-[9px] font-normal ${theme === 'premium-dark' ? 'border-orange-500/20 text-orange-500 bg-orange-500/5' : 'border-orange-200 text-orange-600 bg-orange-50'}`}>
                                                  NETTING
                                                </Badge>
                                                {entry.credit_memo_refs && (
                                                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${theme === 'premium-dark' ? 'bg-zinc-700/50 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                                    Ref: {entry.credit_memo_refs}
                                                  </span>
                                                )}
                                              </div>
                                              <span className={`font-mono text-sm ${theme === 'premium-dark' ? 'text-orange-400' : 'text-orange-600'}`}>
                                                −{formatCurrency(entry.applied_credits || 0, entry.currency)}
                                              </span>
                                            </div>

                                            <div className={`h-px w-full ${theme === 'premium-dark' ? 'bg-zinc-700' : 'bg-gray-100'}`} />

                                            <div className="flex justify-between items-center">
                                              <span className={`font-medium text-sm ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>Net Amount</span>
                                              <span className="font-mono text-lg font-bold text-emerald-500">
                                                {formatCurrency(entry.amount, entry.currency)}
                                              </span>
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
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Reconciliation */}
          <TabsContent value="reconciliation" className="space-y-6">
            {/* Month-End Close Lock Alert */}
            {isMonthLocked && (
              <Alert className={theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. Reconciliation is read-only while the period is locked.
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl relative overflow-hidden' : 'bg-white border-gray-100 rounded-2xl relative overflow-hidden'}>
              <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-emerald-500/5 blur-3xl' : ''} />
              <CardHeader className="relative">
                <CardTitle className={theme === 'premium-dark' ? 'text-white text-xl font-bold' : 'text-gray-900 text-xl font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>Run Reconciliation</CardTitle>
                <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                  Automatically match customer payments with AR ledger entries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Data summary section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                      ${theme === 'premium-dark'
                      ? 'bg-gradient-to-br from-[#65D3FD]/5 to-transparent border-[#65D3FD]/20 hover:border-[#65D3FD]/40'
                      : 'bg-blue-50/50 border-blue-100 hover:border-blue-200'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#65D3FD]/80' : 'text-blue-600'}`}>
                        Customer Payments
                      </span>
                      {bankInflows.length > 0 ? (
                        <div className={`p-1 rounded-full ${theme === 'premium-dark' ? 'bg-[#65D3FD]/20' : 'bg-blue-100'}`}>
                          <CheckCircle className={`size-4 ${theme === 'premium-dark' ? 'text-[#65D3FD]' : 'text-blue-600'}`} />
                        </div>
                      ) : (
                        <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-4xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {bankInflows.length}
                      </p>
                      <p className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#65D3FD]/40' : 'text-gray-500'}`}>transactions</p>
                    </div>
                    <p className={`text-xs mt-2 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                      {bankInflows.length} payment{bankInflows.length !== 1 ? 's' : ''} ready for matching
                    </p>
                  </div>

                  <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                      ${theme === 'premium-dark'
                      ? 'bg-gradient-to-br from-[#4F5CFE]/10 to-transparent border-[#4F5CFE]/20 hover:border-[#4F5CFE]/40'
                      : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-200'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#4F5CFE]/80' : 'text-indigo-600'}`}>
                        AR Ledger
                      </span>
                      {arLedger.length > 0 ? (
                        <div className={`p-1 rounded-full ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/20' : 'bg-indigo-100'}`}>
                          <CheckCircle className={`size-4 ${theme === 'premium-dark' ? 'text-[#4F5CFE]' : 'text-indigo-600'}`} />
                        </div>
                      ) : (
                        <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-4xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {arLedger.length > 0 ? '1' : '0'}
                      </p>
                      <p className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#4F5CFE]/40' : 'text-gray-500'}`}>source</p>
                    </div>
                    <p className={`text-xs mt-2 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                      {arLedger.length} invoices uploaded
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {reconciliationResult?.locked && (
                    <Button
                      onClick={() => navigate(`/company/${companyId}/month-end?tab=ar-rec-review&period=${selectedPeriod}`)}
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
                    onClick={runReconciliation}
                    disabled={isReconciling || bankInflows.length === 0 || arLedger.length === 0 || isMonthLocked || reconciliationResult?.locked}
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
                            {reconciliationResult?.locked ? 'Reconciliation Locked' : isMonthLocked ? 'Period Locked' : bankInflows.length === 0 || arLedger.length === 0
                              ? 'Upload data to reconcile'
                              : 'Run Reconciliation'}
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reconciliation Results - Placeholder for now */}
            {reconciliationResult && (
              <>
                {/* Locked Status Card with Update Reconciliation Button */}
                {reconciliationResult.locked && !isMonthLocked ? (
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
                              This reconciliation has been saved and locked.
                              {reconciliationResult.lockedAt && (
                                <span className="block mt-1">Locked on: {new Date(reconciliationResult.lockedAt).toLocaleString()}</span>
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
                ) : null}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card
                    className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden transition-all duration-200 hover:scale-[1.02]`}
                  >
                    <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-violet-500/5 blur-3xl' : ''} />
                    <CardContent className="pt-6 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Matched</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1' : 'text-3xl text-gray-900 mt-1'} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                            {reconciliationResult.summary.matched_count || 0}
                          </p>
                        </div>
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                          <CheckCircle className="size-6" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden transition-all duration-200 hover:scale-[1.02]`}
                  >
                    <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-orange-500/5 blur-3xl' : ''} />
                    <CardContent className="pt-6 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Unmatched Payments</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1' : 'text-3xl text-gray-900 mt-1'} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                            {reconciliationResult.summary.unmatched_payments_count || 0}
                          </p>
                        </div>
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                          <AlertCircle className="size-6" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden transition-all duration-200 hover:scale-[1.02]`}
                  >
                    <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-blue-500/5 blur-3xl' : ''} />
                    <CardContent className="pt-6 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Unmatched Invoices</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1' : 'text-3xl text-gray-900 mt-1'} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                            {reconciliationResult.summary.unmatched_invoices_count || 0}
                          </p>
                        </div>
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                          <AlertCircle className="size-6" />
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
                            {reconciliationResult.summary.match_rate}%
                          </p>
                        </div>
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-600'}`}>
                          <TrendingUp className="size-6" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons - Export and Save */}
                <div className="flex justify-end gap-4">
                  <Button
                    onClick={handleExport}
                    disabled={isExporting}
                    variant="outline"
                    className={theme === 'dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] rounded-full' : 'gap-2 bg-white border-gray-300 text-gray-900 hover:bg-gray-50 rounded-full'}
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="size-4" />
                        Export Report
                      </>
                    )}
                  </Button>

                  {/* Save Reconciliation Button - Hide if locked */}
                  {!reconciliationResult.locked && !isMonthLocked && (
                    <Button
                      onClick={handleLockReconciliation}
                      disabled={isLockingReconciliation}
                      className="gap-2 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black rounded-full border-0"
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
                  )}
                </div>

                {/* Matched Pairs Details Table */}
                {reconciliationResult.matched_pairs && reconciliationResult.matched_pairs.length > 0 && (
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl relative overflow-hidden' : 'bg-white border-gray-100 rounded-2xl relative overflow-hidden'}>
                    <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-violet-500/5 blur-3xl' : ''} />
                    <CardHeader className={`relative border-b ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                          Matched Transactions
                        </CardTitle>
                        <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/10 text-white border-white/10' : 'bg-gray-100 text-gray-600'}>
                          {reconciliationResult.matched_pairs.length} matches
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 relative">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className={`border-b ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                            <tr>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Description</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Customer</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Type</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Confidence</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {(showAllMatches
                              ? reconciliationResult.matched_pairs
                              : reconciliationResult.matched_pairs.slice(0, 10)
                            ).map((match: any, idx: number) => (
                              <Fragment key={idx}>
                                <tr
                                  className={`transition-colors cursor-pointer ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}
                                  onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
                                >
                                  <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {match.payment?.date || (match.payments && match.payments[0]?.date) || '-'}
                                  </td>
                                  <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {match.payment?.description || (match.payments && `${match.payments.length} payments`) || '-'}
                                  </td>
                                  <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {match.invoice?.customer || (match.invoices && match.invoices[0]?.customer) || '-'}
                                  </td>
                                  <td className="py-4 px-6 text-sm font-bold text-emerald-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    <div className="flex items-center gap-2">
                                      {match.payment ?
                                        formatCurrency(Math.abs(match.payment.amount), match.payment.currency) :
                                        match.payments ?
                                          formatCurrency(match.payments.reduce((sum: number, p: any) => sum + Math.abs(p.amount), 0), match.payments[0]?.currency) :
                                          '-'
                                      }
                                      <TrendingUp className="size-4" />
                                    </div>
                                  </td>
                                  <td className="py-4 px-6">
                                    <Badge
                                      variant="outline"
                                      className={
                                        match.match_type === 'exact'
                                          ? theme === 'premium-dark' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200'
                                          : match.match_type === 'customer_amount' || match.match_type === 'amount'
                                            ? theme === 'premium-dark' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200'
                                            : match.match_type === 'customer_name'
                                              ? theme === 'premium-dark' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-teal-50 text-teal-700 border-teal-200'
                                              : match.match_type === 'fx'
                                                ? theme === 'premium-dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200'
                                                : match.match_type === 'one_to_many'
                                                  ? theme === 'premium-dark' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200'
                                                  : theme === 'premium-dark' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' : 'bg-gray-100 text-gray-600 border-gray-200'
                                      }
                                    >
                                      {match.match_type === 'exact' ? 'Exact' :
                                        match.match_type === 'fx' ? 'FX' :
                                          match.match_type === 'one_to_many' ? '2:1' :
                                            match.match_type === 'customer_amount' ? 'Amount' :
                                              match.match_type?.replace('_', ' ')}
                                    </Badge>
                                  </td>
                                  <td className="py-4 px-6">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        {match.confidence > 1 ? Math.round(match.confidence) : Math.round(match.confidence * 100)}%
                                      </span>
                                      {(match.confidence > 1 ? match.confidence >= 90 : match.confidence >= 0.9) && (
                                        <CheckCircle className="size-3 text-green-500" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-6 text-center">
                                    <ChevronDown className={`size-4 transition-transform duration-200 ${expandedMatch === idx ? 'rotate-180' : ''} ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                                  </td>
                                </tr>

                                {expandedMatch === idx && (
                                  <tr className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <td colSpan={7} className={theme === 'dark' ? 'bg-zinc-800/30 px-6 py-4 border-b border-zinc-800' : 'bg-gray-50 px-6 py-4 border-b'}>
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          {/* Customer Payments */}
                                          <div className="space-y-3">
                                            <p className={`text-xs font-semibold uppercase tracking-wider ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                              CUSTOMER PAYMENT:
                                            </p>
                                            <div className="space-y-2">
                                              {(match.payments || (match.payment ? [match.payment] : [])).map((payment: any, pIdx: number) => (
                                                <div key={pIdx} className={theme === 'premium-dark' ? 'p-3 bg-white/5 border border-white/10 rounded-lg flex justify-between items-center' : 'p-3 bg-white border border-gray-100 rounded-lg flex justify-between items-center shadow-sm'}>
                                                  <div className="flex flex-col gap-1">
                                                    <span className={`font-medium text-sm ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>{payment.description}</span>
                                                    <span className={`text-[10px] font-mono ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                                      {payment.date} • {payment.statement || 'Bank Statement'}
                                                    </span>
                                                  </div>
                                                  <span className="font-mono font-medium text-green-600 text-sm">
                                                    {formatCurrency(Math.abs(payment.amount), payment.currency)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>

                                          {/* Matched Invoices */}
                                          <div className="space-y-3">
                                            <p className={`text-xs font-semibold uppercase tracking-wider ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                              MATCHED INVOICE:
                                            </p>
                                            <div className="space-y-2">
                                              {(match.invoices || (match.invoice ? [match.invoice] : [])).map((invoice: any, invIdx: number) => (
                                                <div key={invIdx} className={theme === 'premium-dark' ? 'p-3 bg-white/5 border border-white/10 rounded-lg flex justify-between items-center' : 'p-3 bg-white border border-gray-100 rounded-lg flex justify-between items-center shadow-sm'}>
                                                  <div className="flex flex-col gap-1">
                                                    <span className={`font-medium text-sm ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>{invoice.customer || 'Client'}</span>
                                                    <span className={`text-[10px] font-mono ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                                      Invoice: {invoice.invoice_number} • {invoice.date}
                                                    </span>
                                                  </div>
                                                  <span className="font-mono font-medium text-blue-600 text-sm">
                                                    {formatCurrency(Math.abs(invoice.amount), invoice.currency)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>

                                        {match.match_reason && (
                                          <div className={`mt-4 px-4 py-3 rounded-lg border flex items-center gap-3 ${theme === 'premium-dark' ? 'bg-violet-500/10 border-violet-500/20' : 'bg-violet-50 border-violet-100'}`}>
                                            <span className={`text-xs font-bold uppercase ${theme === 'premium-dark' ? 'text-violet-400' : 'text-violet-700'}`}>Match Reason:</span>
                                            <span className={`text-sm ${theme === 'premium-dark' ? 'text-violet-200' : 'text-violet-600'}`}>{match.match_reason}</span>
                                          </div>
                                        )}

                                        {match.amount_difference > 0.01 && (
                                          <div className={theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mt-2' : 'bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2'}>
                                            <p className={`text-xs ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                                              <strong>Amount Difference:</strong> {formatCurrency(match.amount_difference, match.payment?.currency || match.payments?.[0]?.currency || match.invoice?.currency || match.invoices?.[0]?.currency)}
                                            </p>
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

                      {/* Show More/Less Button */}
                      {reconciliationResult.matched_pairs.length > 10 && (
                        <div className={`px-6 py-4 border-t ${theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                          <Button
                            variant="ghost"
                            onClick={() => setShowAllMatches(!showAllMatches)}
                            className={`w-full ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-zinc-800' : ''}`}
                          >
                            {showAllMatches ? (
                              <>Show Less</>
                            ) : (
                              <>Show All {reconciliationResult.matched_pairs.length} Matches</>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Unmatched Customer Payments */}
                {reconciliationResult.unmatched_payments && reconciliationResult.unmatched_payments.length > 0 && (
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl relative overflow-hidden' : 'bg-white border-gray-100 rounded-2xl relative overflow-hidden'}>
                    <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-red-500/5 blur-3xl' : ''} />
                    <CardHeader className={`relative border-b ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Unmatched Customer Payments
                          </CardTitle>
                          <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                            {reconciliationResult.unmatched_payments.length} payment{reconciliationResult.unmatched_payments.length !== 1 ? 's' : ''} not matched to any invoice
                          </CardDescription>
                        </div>
                        <span className={`text-2xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                          {reconciliationResult.unmatched_payments.length}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 relative">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className={`border-b ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                            <tr>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Description</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {reconciliationResult.unmatched_payments.map((item: any, idx: number) => (
                              <tr
                                key={idx}
                                className={`transition-colors ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}
                              >
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                  {item.payment.date}
                                </td>
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                  <div>
                                    <div className="font-medium">{item.payment.description}</div>
                                    {item.payment.statement && (
                                      <div className={`text-xs mt-1 ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                        Statement: {item.payment.statement}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-sm font-bold text-emerald-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                  <div className="flex items-center gap-2">
                                    {formatCurrency(Math.abs(item.payment.amount), item.payment.currency)}
                                    <TrendingUp className="size-4 text-emerald-500" />
                                  </div>
                                </td>
                                <td className={`py-4 px-6 text-sm ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {item.reason || 'No matching invoice found'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Unmatched AR Invoices */}
                {reconciliationResult.unmatched_invoices && reconciliationResult.unmatched_invoices.length > 0 && (
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl relative overflow-hidden' : 'bg-white border-gray-100 rounded-2xl relative overflow-hidden'}>
                    <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-blue-500/5 blur-3xl' : ''} />
                    <CardHeader className={`relative border-b ${theme === 'premium-dark' ? 'border-white/5' : 'border-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Unmatched AR Invoices
                          </CardTitle>
                          <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>
                            {reconciliationResult.unmatched_invoices.length} invoice{reconciliationResult.unmatched_invoices.length !== 1 ? 's' : ''} not matched to any payment
                          </CardDescription>
                        </div>
                        <span className={`text-2xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                          {reconciliationResult.unmatched_invoices.length}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 relative">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className={`border-b ${theme === 'premium-dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                            <tr>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Invoice #</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Customer</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                              <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {reconciliationResult.unmatched_invoices.map((item: any, idx: number) => (
                              <tr
                                key={idx}
                                className={`transition-colors ${theme === 'premium-dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/50'}`}
                              >
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                  {item.invoice.invoice_number || 'N/A'}
                                </td>
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>
                                  <div>
                                    <div className="font-medium">{item.invoice.customer || 'N/A'}</div>
                                    {item.invoice.due_date && (
                                      <div className={`text-xs mt-1 ${theme === 'premium-dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                        Due: {item.invoice.due_date}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                  {item.invoice.date}
                                </td>
                                <td className={`py-4 px-6 text-sm font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                  <div className="flex items-center gap-2">
                                    {formatCurrency(Math.abs(item.invoice.amount), item.invoice.currency)}
                                    <TrendingUp className="size-4" />
                                  </div>
                                </td>
                                <td className={`py-4 px-6 text-sm ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {item.reason || 'No matching payment found'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )
            }
          </TabsContent >
        </Tabs >
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a period to view AR reconciliation data
          </AlertDescription>
        </Alert>
      )}
    </div >
  );
}