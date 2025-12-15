import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft, TrendingUp, Clock, ChevronRight, Building, Calendar, Trash2, PlayCircle, FileSpreadsheet, BookOpen, GitCompare, Eye, Lock, Unlock, AlertTriangle, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useRef, useEffect, Fragment } from 'react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { ProcessingStages } from '@/components/ProcessingStages';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { companiesApi, Company } from '@/utils/api-client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTheme } from '@/contexts/ThemeContext';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
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
  bank_transaction: BankTransaction;
  ledger_entries: LedgerEntry[];
  match_confidence: number;
  match_type: string;
  explanation?: string;
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
  };
  locked?: boolean;
  lockedAt?: string;
  unlockedAt?: string;
}

export function BankReconciliation() {
  const { theme } = useTheme();
  // Company and Period Selection
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  
  // Bank Statements Tab
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [isUploadingBank, setIsUploadingBank] = useState(false);
  const [isLoadingBankData, setIsLoadingBankData] = useState(false);
  
  // General Ledger Tab
  const [generalLedger, setGeneralLedger] = useState<GeneralLedger | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isUploadingLedger, setIsUploadingLedger] = useState(false);
  const [isLoadingLedgerData, setIsLoadingLedgerData] = useState(false);
  
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
  
  const bankFileInputRef = useRef<HTMLInputElement>(null);
  const ledgerFileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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
    loadCompanies();
    
    // Set default period to current month
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    setSelectedPeriod(`${year}-${month}`);
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Load data when company or period changes
  useEffect(() => {
    if (selectedCompanyId && selectedPeriod) {
      loadLockStatus();
      loadBankData();
      loadLedgerData();
      loadReconciliationData();
    }
  }, [selectedCompanyId, selectedPeriod]);
  
  const loadLockStatus = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/status?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
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
  
  const loadCompanies = async () => {
    try {
      setIsLoadingCompanies(true);
      const companiesData = await companiesApi.getAll();
      setCompanies(companiesData);
      
      // Auto-select first active company if available
      const activeCompany = companiesData.find(c => c.status === 'Active');
      if (activeCompany) {
        setSelectedCompanyId(activeCompany.id);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
      toast.error('Failed to load companies');
    } finally {
      setIsLoadingCompanies(false);
    }
  };
  
  // Load bank statements and transactions
  const loadBankData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      setIsLoadingBankData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/bank-data?company_id=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBankStatements(data.statements || []);
        setBankTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error('Failed to load bank data:', err);
    } finally {
      setIsLoadingBankData(false);
    }
  };
  
  // Load general ledger and entries
  const loadLedgerData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      setIsLoadingLedgerData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/ledger-data?company_id=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setGeneralLedger(data.ledger || null);
        setLedgerEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setIsLoadingLedgerData(false);
    }
  };
  
  // Load reconciliation results
  const loadReconciliationData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation-data?company_id=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReconciliationResult(data.result || null);
      }
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
    }
  };

  // Upload bank statement
  const handleBankStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!selectedCompanyId || !selectedPeriod) {
      toast.error('Please select a company and period first');
      return;
    }

    setIsUploadingBank(true);

    const formData = new FormData();
    formData.append('bank_file', file);
    formData.append('company_id', selectedCompanyId);
    formData.append('period', selectedPeriod);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/upload-bank-statement`,
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
        throw new Error(errorData.error || 'Failed to upload bank statement');
      }

      const data = await response.json();
      toast.success(`Uploaded ${file.name} - ${data.transactionCount} transactions extracted`);
      
      // Reload bank data
      await loadBankData();
      
      // Clear file input
      if (bankFileInputRef.current) {
        bankFileInputRef.current.value = '';
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload bank statement';
      toast.error(errorMessage);
      console.error('Bank statement upload error:', err);
    } finally {
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/bank-statement/${statementId}?company_id=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Bank statement deleted');
        await loadBankData();
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
    
    if (!selectedCompanyId || !selectedPeriod) {
      toast.error('Please select a company and period first');
      return;
    }

    setIsUploadingLedger(true);

    const formData = new FormData();
    formData.append('ledger_file', file);
    formData.append('company_id', selectedCompanyId);
    formData.append('period', selectedPeriod);

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
      
      // Reload ledger data
      await loadLedgerData();
      
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
  
  // Delete general ledger
  const handleDeleteLedger = async () => {
    if (!confirm('Are you sure you want to delete the general ledger and all its entries?')) {
      return;
    }
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/ledger?company_id=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        toast.success('General ledger deleted');
        await loadLedgerData();
      } else {
        toast.error('Failed to delete general ledger');
      }
    } catch (err) {
      console.error('Failed to delete general ledger:', err);
      toast.error('Failed to delete general ledger');
    }
  };

  // Run reconciliation
  const handleRunReconciliation = async () => {
    if (bankTransactions.length === 0) {
      toast.error('Please upload at least one bank statement first');
      return;
    }
    
    if (ledgerEntries.length === 0) {
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
            company_id: selectedCompanyId,
            period: selectedPeriod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run reconciliation');
      }

      const data = await response.json();
      setReconciliationResult(data);
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
            company_id: selectedCompanyId,
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/unlock-reconciliation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_id: selectedCompanyId,
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
      toast.success('Reconciliation unlocked. You can now update it.');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to unlock reconciliation';
      toast.error(errorMessage);
      console.error('Unlock reconciliation error:', err);
    } finally {
      setIsLockingReconciliation(false);
    }
  };

  // Export bank transactions
  const handleExportTransactions = async (format: 'csv' | 'xlsx') => {
    try {
      if (bankTransactions.length === 0) {
        toast.error('No transactions to export');
        return;
      }

      if (format === 'csv') {
        // Generate CSV
        const headers = ['Date', 'Description', 'Amount', 'Balance', 'Statement'];
        const rows = bankTransactions.map(txn => [
          txn.date,
          `"${txn.description.replace(/"/g, '""')}"`, // Escape quotes
          txn.amount.toString(),
          txn.balance?.toString() || '',
          txn.statementName
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bank-transactions-${selectedCompanyId}-${selectedPeriod}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        toast.success('Transactions exported as CSV');
      } else {
        // Generate XLSX
        const XLSX = await import('xlsx');
        
        const worksheetData = [
          ['Date', 'Description', 'Amount', 'Balance', 'Statement'],
          ...bankTransactions.map(txn => [
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
        
        XLSX.writeFile(workbook, `bank-transactions-${selectedCompanyId}-${selectedPeriod}.xlsx`);
        
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
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        
        // 1. SUMMARY SHEET
        const summaryData = [
          ['BANK RECONCILIATION SUMMARY'],
          [''],
          ['Company', companies.find(c => c.id === selectedCompanyId)?.name || ''],
          ['Period', generatePeriodOptions().find(p => p.value === selectedPeriod)?.label || ''],
          ['Report Date', new Date().toISOString()],
          [''],
          ['Total Bank Transactions', reconciliationResult.summary.total_bank_transactions],
          ['Total Ledger Entries', reconciliationResult.summary.total_ledger_entries],
          ['Matched Count', reconciliationResult.summary.matched_count],
          ['Unmatched Bank', reconciliationResult.summary.unmatched_bank_count],
          ['Unmatched Ledger', reconciliationResult.summary.unmatched_ledger_count],
          ['Match Rate', `${reconciliationResult.summary.match_rate.toFixed(1)}%`],
          [''],
          ['Total Bank Amount', `€${reconciliationResult.summary.total_bank_amount.toFixed(2)}`],
          ['Total Ledger Amount', `€${reconciliationResult.summary.total_ledger_amount.toFixed(2)}`],
          ['Difference', `€${reconciliationResult.summary.difference.toFixed(2)}`],
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
        
        // 2. MATCHED TRANSACTIONS SHEET
        const matchedData: any[] = [
          ['Bank Date', 'Bank Description', 'Bank Amount', 'Ledger Date', 'Ledger Description', 'Ledger Amount', 'Match Type', 'Confidence', 'Explanation']
        ];
        
        reconciliationResult.matched_pairs.forEach((pair: any) => {
          const bankTxn = pair.bank_transaction || {};
          const ledgerEntries = Array.isArray(pair.ledger_entries) ? pair.ledger_entries : [];
          const matchType = pair.match_type || '';
          const confidence = typeof pair.match_confidence === 'number' 
            ? `${(pair.match_confidence * 100).toFixed(0)}%` 
            : '';
          const explanation = pair.explanation || '';
          
          if (ledgerEntries.length === 1) {
            const ledger = ledgerEntries[0] || {};
            matchedData.push([
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
          } else {
            ledgerEntries.forEach((ledger: any, idx: number) => {
              if (idx === 0) {
                matchedData.push([
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
              } else {
                matchedData.push([
                  '', '', '',
                  ledger.date || '',
                  ledger.description || '',
                  typeof ledger.amount === 'number' ? ledger.amount : '',
                  '', '', ''
                ]);
              }
            });
          }
        });
        
        const matchedSheet = XLSX.utils.aoa_to_sheet(matchedData);
        matchedSheet['!cols'] = [
          { wch: 12 }, { wch: 35 }, { wch: 12 },
          { wch: 12 }, { wch: 35 }, { wch: 12 },
          { wch: 20 }, { wch: 12 }, { wch: 50 }
        ];
        XLSX.utils.book_append_sheet(wb, matchedSheet, 'Matched Transactions');
        
        // 3. UNMATCHED BANK TRANSACTIONS SHEET
        const unmatchedBankData: any[] = [
          ['Date', 'Description', 'Amount', 'Suggested Action', 'Debit Account', 'Credit Account']
        ];
        
        reconciliationResult.unmatched_bank.forEach((txn: any) => {
          unmatchedBankData.push([
            txn.transaction?.date || '',
            txn.transaction?.description || '',
            txn.transaction?.amount || '',
            txn.suggested_action || '',
            txn.suggested_je?.debit_account || '',
            txn.suggested_je?.credit_account || ''
          ]);
        });
        
        const unmatchedBankSheet = XLSX.utils.aoa_to_sheet(unmatchedBankData);
        unmatchedBankSheet['!cols'] = [
          { wch: 12 }, { wch: 35 }, { wch: 12 },
          { wch: 40 }, { wch: 20 }, { wch: 20 }
        ];
        XLSX.utils.book_append_sheet(wb, unmatchedBankSheet, 'Unmatched Bank');
        
        // 4. UNMATCHED LEDGER ENTRIES SHEET
        const unmatchedLedgerData: any[] = [
          ['Date', 'Description', 'Amount', 'Reason', 'Action']
        ];
        
        reconciliationResult.unmatched_ledger.forEach((entry: any) => {
          unmatchedLedgerData.push([
            entry.entry?.date || '',
            entry.entry?.description || '',
            entry.entry?.amount || '',
            entry.reason || '',
            entry.action || ''
          ]);
        });
        
        const unmatchedLedgerSheet = XLSX.utils.aoa_to_sheet(unmatchedLedgerData);
        unmatchedLedgerSheet['!cols'] = [
          { wch: 12 }, { wch: 35 }, { wch: 12 },
          { wch: 30 }, { wch: 30 }
        ];
        XLSX.utils.book_append_sheet(wb, unmatchedLedgerSheet, 'Unmatched Ledger');
        
        const filename = `bank-reconciliation-${selectedCompanyId}-${selectedPeriod}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        toast.dismiss(loadingToast);
        toast.success('Excel report exported successfully!');
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Failed to export report');
        console.error('Export error:', error);
      }
    }, 100);
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Header - Ultra Minimal */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={theme === 'premium-dark' ? 'text-4xl tracking-tight text-white' : 'text-4xl tracking-tight text-gray-900'}>Bank Reconciliation</h1>
          <p className={theme === 'premium-dark' ? 'text-purple-300/40 text-sm mt-2' : 'text-gray-400 text-sm mt-2'}>
            Match bank transactions with ledger entries using AI
          </p>
        </div>
      </div>

      {/* Company and Period Selection - Minimal Toggles */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <Select 
            value={selectedCompanyId} 
            onValueChange={setSelectedCompanyId}
            disabled={isLoadingCompanies}
          >
            <SelectTrigger className={theme === 'premium-dark' 
              ? 'bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl' 
              : 'bg-gray-50/50 border-gray-200 h-11 rounded-xl'
            }>
              <Building className="size-4 mr-2" />
              <SelectValue placeholder={isLoadingCompanies ? "Loading companies..." : "Select a company"} />
            </SelectTrigger>
            <SelectContent className={theme === 'premium-dark' ? 'bg-gray-900 border-white/10' : ''}>
              {companies
                .filter(c => c.status === 'Active')
                .map((company) => (
                  <SelectItem key={company.id} value={company.id} className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>
                    {company.name} ({company.country})
                  </SelectItem>
                ))}
              {companies.filter(c => c.status === 'Active').length === 0 && !isLoadingCompanies && (
                <div className={theme === 'premium-dark' ? 'text-sm text-gray-400 p-2 text-center' : 'text-sm text-gray-500 p-2 text-center'}>
                  No active companies. Add one first.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={theme === 'premium-dark' 
              ? 'bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl' 
              : 'bg-gray-50/50 border-gray-200 h-11 rounded-xl'
            }>
              <Calendar className="size-4 mr-2" />
              <SelectValue placeholder="Select a period" />
            </SelectTrigger>
            <SelectContent className={theme === 'premium-dark' ? 'bg-gray-900 border-white/10' : ''}>
              {generatePeriodOptions().map((option) => (
                <SelectItem key={option.value} value={option.value} className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Uploads Locked Warning - Green and Above Tabs */}


      {/* 3-Tab Structure */}
      {selectedCompanyId && selectedPeriod ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={theme === 'premium-dark' 
            ? 'grid w-full grid-cols-3 h-auto p-1.5 gap-1 bg-white/[0.03] border border-white/10 rounded-2xl' 
            : 'grid w-full grid-cols-3 h-auto p-1.5 gap-1 rounded-2xl bg-gray-100'
          }>
            <TabsTrigger 
              value="bank-statements" 
              className={theme === 'premium-dark' 
                ? 'gap-2 py-3 px-4 rounded-xl data-[state=active]:bg-white/[0.08] data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-white/[0.03] transition-all' 
                : 'gap-2 py-3 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm'
              }
            >
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
            </TabsTrigger>
            <TabsTrigger 
              value="general-ledger" 
              className={theme === 'premium-dark' 
                ? 'gap-2 py-3 px-4 rounded-xl data-[state=active]:bg-white/[0.08] data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-white/[0.03] transition-all' 
                : 'gap-2 py-3 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm'
              }
            >
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
            </TabsTrigger>
            <TabsTrigger 
              value="reconciliation" 
              className={theme === 'premium-dark' 
                ? 'gap-2 py-3 px-4 rounded-xl data-[state=active]:bg-white/[0.08] data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-white/[0.03] transition-all' 
                : 'gap-2 py-3 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm'
              }
            >
              <GitCompare className="size-4" />
              Reconciliation
              {reconciliationResult && (
                <Badge variant="secondary" className={theme === 'premium-dark' 
                  ? 'ml-auto bg-purple-500/20 text-purple-400 border-0 px-2 py-0.5 text-xs' 
                  : 'ml-auto bg-violet-100 text-violet-700 px-2 py-0.5 text-xs'
                }>
                  {reconciliationResult.summary.match_rate.toFixed(0)}%
                </Badge>
              )}
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
              <Alert className={theme === 'premium-dark' ? 'bg-green-500/10 border-green-500/30 rounded-xl' : 'bg-green-50 border-green-200 rounded-xl'}>
                <Lock className={theme === 'premium-dark' ? 'size-4 text-green-400' : 'size-4 text-green-600'} />
                <AlertDescription className={theme === 'premium-dark' ? 'text-green-400' : 'text-green-700'}>
                  To upload more bank statements, click "Update Reconciliation" in the Reconciliation tab
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>Upload Bank Statements</CardTitle>
                    <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>
                      Upload PDFs, CSV, or Excel files - AI will automatically extract all transactions
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {bankTransactions.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setShowExportDialog(true)}
                        className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05]' : 'gap-2'}
                      >
                        <Download className="size-4" />
                        Export
                      </Button>
                    )}
                    <Button
                      onClick={() => bankFileInputRef.current?.click()}
                      disabled={isUploadingBank || isMonthLocked || reconciliationResult?.locked}
                      className={theme === 'premium-dark' ? 'gap-2 bg-white text-black hover:bg-white/90 rounded-full' : 'gap-2 rounded-full'}
                    >
                      {isUploadingBank ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          Upload Statement
                        </>
                      )}
                    </Button>
                  </div>
                  <input
                    ref={bankFileInputRef}
                    type="file"
                    onChange={handleBankStatementUpload}
                    accept=".csv,.xlsx,.xls,.pdf"
                    className="hidden"
                  />
                </div>
              </CardHeader>
              {bankStatements.length > 0 && (
                <CardContent className="p-0">
                  <div className={theme === 'premium-dark' ? 'divide-y divide-purple-500/20' : 'divide-y'}>
                    {bankStatements.map((statement) => (
                      <div key={statement.id} className={theme === 'premium-dark' ? 'p-4 flex items-center justify-between hover:bg-purple-500/5' : 'p-4 flex items-center justify-between hover:bg-gray-50'}>
                        <div className="flex items-center gap-3">
                          <div className={theme === 'premium-dark' ? 'h-10 w-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center' : 'h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center'}>
                            <FileSpreadsheet className={theme === 'premium-dark' ? 'size-5 text-blue-400' : 'size-5 text-blue-600'} />
                          </div>
                          <div>
                            <p className={theme === 'premium-dark' ? 'text-sm font-medium text-white' : 'text-sm font-medium text-gray-900'}>{statement.fileName}</p>
                            <p className={theme === 'premium-dark' ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                              {statement.transactionCount} transactions • {new Date(statement.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {statement.fileUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(statement.fileUrl, '_blank')}
                              className={theme === 'premium-dark' ? 'gap-2 text-gray-400 hover:text-white hover:bg-purple-500/10' : 'gap-2'}
                            >
                              <Eye className="size-4" />
                              View
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBankStatement(statement.id)}
                            disabled={isMonthLocked || reconciliationResult?.locked}
                            className={theme === 'premium-dark' ? 'gap-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'gap-2 text-red-600 hover:text-red-700 hover:bg-red-50'}
                          >
                            <Trash2 className="size-4" />
                            Delete
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
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                <CardContent className="py-12 text-center">
                  <Loader2 className={theme === 'premium-dark' ? 'size-8 text-purple-400 animate-spin mx-auto mb-3' : 'size-8 text-gray-400 animate-spin mx-auto mb-3'} />
                  <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Loading transactions...</p>
                </CardContent>
              </Card>
            ) : bankTransactions.length > 0 ? (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>All Bank Transactions</CardTitle>
                    <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : ''}>
                      {bankTransactions.length} transactions
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={theme === 'premium-dark' ? 'bg-gray-800/50 border-b border-purple-500/20' : 'bg-gray-50 border-b'}>
                        <tr>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Date</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Description</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Amount</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Balance</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Statement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bankTransactions.map((txn) => (
                          <tr key={txn.id} className={theme === 'premium-dark' ? 'border-b border-purple-500/20 hover:bg-purple-500/5' : 'border-b hover:bg-gray-50'}>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-gray-400' : 'py-3 px-6 text-sm text-gray-600'}>{txn.date}</td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-white' : 'py-3 px-6 text-sm text-gray-900'}>{txn.description}</td>
                            <td className={`py-3 px-6 text-sm font-medium ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              €{formatCurrency(Math.abs(txn.amount))}
                            </td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-gray-400' : 'py-3 px-6 text-sm text-gray-600'}>
                              {txn.balance ? `€${formatCurrency(txn.balance)}` : '-'}
                            </td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-xs text-gray-400' : 'py-3 px-6 text-xs text-gray-500'}>{txn.statementName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                <CardContent className="py-12 text-center">
                  <FileSpreadsheet className={theme === 'premium-dark' ? 'size-12 text-white/10 mx-auto mb-3' : 'size-12 text-gray-300 mx-auto mb-3'} />
                  <p className={theme === 'premium-dark' ? 'text-sm text-white/60 mb-2' : 'text-sm text-gray-600 mb-2'}>No bank statements uploaded yet</p>
                  <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/40' : 'text-xs text-gray-400'}>Upload your first bank statement to get started</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: General Ledger */}
          <TabsContent value="general-ledger" className="space-y-4 mt-6">
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
              <Alert className={theme === 'premium-dark' ? 'bg-green-500/10 border-green-500/30 rounded-xl' : 'bg-green-50 border-green-200 rounded-xl'}>
                <Lock className={theme === 'premium-dark' ? 'size-4 text-green-400' : 'size-4 text-green-600'} />
                <AlertDescription className={theme === 'premium-dark' ? 'text-green-400' : 'text-green-700'}>
                  To upload more bank statements, click "Update Reconciliation" in the Reconciliation tab
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>Upload General Ledger</CardTitle>
                    <CardDescription className={theme === 'premium-dark' ? 'text-purple-300/40' : 'text-gray-400'}>
                      Upload CSV or Excel file - AI will automatically extract all ledger entries
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {generalLedger && (
                      <Button
                        variant="outline"
                        onClick={handleDeleteLedger}
                        disabled={reconciliationResult?.locked}
                        className={theme === 'premium-dark' ? 'gap-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 bg-white/[0.03] border-white/10' : 'gap-2 text-red-600 hover:text-red-700'}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    )}
                    <Button
                      onClick={() => ledgerFileInputRef.current?.click()}
                      disabled={isUploadingLedger || isMonthLocked || reconciliationResult?.locked}
                      className={theme === 'premium-dark' ? 'gap-2 bg-white text-black hover:bg-white/90 rounded-full' : 'gap-2 bg-black text-white hover:bg-gray-900 rounded-full'}
                    >
                      {isUploadingLedger ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          {generalLedger ? 'Replace Ledger' : 'Upload Ledger'}
                        </>
                      )}
                    </Button>
                  </div>
                  <input
                    ref={ledgerFileInputRef}
                    type="file"
                    onChange={handleLedgerUpload}
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                  />
                </div>
              </CardHeader>
              {generalLedger && (
                <CardContent>
                  <div className={theme === 'premium-dark' ? 'p-4 bg-white/[0.03] rounded-lg border border-white/10 flex items-center justify-between' : 'p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between'}>
                    <div className="flex items-center gap-3">
                      <div className={theme === 'premium-dark' ? 'h-10 w-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center' : 'h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center'}>
                        <BookOpen className={theme === 'premium-dark' ? 'size-5 text-white' : 'size-5 text-gray-600'} />
                      </div>
                      <div>
                        <p className={theme === 'premium-dark' ? 'text-sm font-medium text-white' : 'text-sm font-medium text-gray-900'}>{generalLedger.fileName}</p>
                        <p className={theme === 'premium-dark' ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                          {generalLedger.entryCount} entries • {new Date(generalLedger.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <CheckCircle className={theme === 'premium-dark' ? 'size-5 text-white' : 'size-5 text-gray-600'} />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Ledger Entries Table */}
            {isLoadingLedgerData ? (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                <CardContent className="py-12 text-center">
                  <Loader2 className={theme === 'premium-dark' ? 'size-8 text-purple-400 animate-spin mx-auto mb-3' : 'size-8 text-gray-400 animate-spin mx-auto mb-3'} />
                  <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Loading entries...</p>
                </CardContent>
              </Card>
            ) : ledgerEntries.length > 0 ? (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>All Ledger Entries</CardTitle>
                    <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : ''}>
                      {ledgerEntries.length} entries
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={theme === 'premium-dark' ? 'bg-gray-800/50 border-b border-purple-500/20' : 'bg-gray-50 border-b'}>
                        <tr>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Date</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Description</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Amount</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Account</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-gray-400 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerEntries.map((entry) => (
                          <tr key={entry.id} className={theme === 'premium-dark' ? 'border-b border-purple-500/20 hover:bg-purple-500/5' : 'border-b hover:bg-gray-50'}>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-gray-400' : 'py-3 px-6 text-sm text-gray-600'}>{entry.date}</td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-white' : 'py-3 px-6 text-sm text-gray-900'}>{entry.description}</td>
                            <td className={`py-3 px-6 text-sm font-medium ${entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              €{formatCurrency(Math.abs(entry.amount))}
                            </td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-gray-400' : 'py-3 px-6 text-sm text-gray-600'}>{entry.account || '-'}</td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-xs text-gray-400' : 'py-3 px-6 text-xs text-gray-500'}>{entry.reference || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                <CardContent className="py-12 text-center">
                  <BookOpen className={theme === 'premium-dark' ? 'size-12 text-white/10 mx-auto mb-3' : 'size-12 text-gray-300 mx-auto mb-3'} />
                  <p className={theme === 'premium-dark' ? 'text-sm text-white/60 mb-2' : 'text-sm text-gray-600 mb-2'}>No general ledger uploaded yet</p>
                  <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/40' : 'text-xs text-gray-400'}>Upload your general ledger to continue</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 3: Reconciliation */}
          <TabsContent value="reconciliation" className="space-y-4 mt-6">
            {/* Locked Status Alert */}
            {isMonthLocked && (
              <Alert className={theme === 'premium-dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. You cannot run or update the reconciliation while the period is locked.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Warnings and Run Button */}
            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
              <CardHeader>
                <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>Run Reconciliation</CardTitle>
                <CardDescription className={theme === 'premium-dark' ? 'text-purple-300/40' : 'text-gray-500'}>
                  Automatically match bank transactions with general ledger entries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Warnings */}
                {bankTransactions.length === 0 && (
                  <Alert className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-xl' : 'rounded-xl'}>
                    <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/40' : 'size-4'} />
                    <AlertDescription className={theme === 'premium-dark' ? 'text-white/60' : ''}>
                      Please upload at least one bank statement in the "Bank Statements" tab before running reconciliation.
                    </AlertDescription>
                  </Alert>
                )}
                
                {ledgerEntries.length === 0 && (
                  <Alert className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-xl' : 'rounded-xl'}>
                    <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/40' : 'size-4'} />
                    <AlertDescription className={theme === 'premium-dark' ? 'text-white/60' : ''}>
                      Please upload a general ledger in the "General Ledger" tab before running reconciliation.
                    </AlertDescription>
                  </Alert>
                )}
                
                {bankTransactions.length > 0 && ledgerEntries.length === 0 && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      <strong>Error:</strong> General ledger is missing. Please upload it in the "General Ledger" tab.
                    </AlertDescription>
                  </Alert>
                )}

                {bankTransactions.length > 0 && ledgerEntries.length > 0 && !reconciliationResult && (
                  <Alert className={theme === 'premium-dark' ? 'bg-blue-500/10 border-blue-500/30 rounded-xl' : 'bg-blue-50 border-blue-200 rounded-xl'}>
                    <CheckCircle className={theme === 'premium-dark' ? 'size-4 text-blue-400' : 'size-4 text-blue-600'} />
                    <AlertDescription className={theme === 'premium-dark' ? 'text-blue-400' : 'text-blue-900'}>
                      <strong>Ready to reconcile:</strong> {bankTransactions.length} bank transactions and {ledgerEntries.length} ledger entries.
                      <br />
                      <span className={theme === 'premium-dark' ? 'text-sm text-blue-400/70' : 'text-sm text-blue-700'}>Make sure you've uploaded all bank statements before proceeding.</span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Status Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={theme === 'premium-dark' ? 'p-5 bg-white/[0.02] border border-white/5 rounded-2xl' : 'p-5 bg-gray-50/50 border border-gray-100 rounded-2xl'}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Bank Statements</span>
                      {bankStatements.length > 0 ? (
                        <CheckCircle className={theme === 'premium-dark' ? 'size-4 text-green-400' : 'size-4 text-green-600'} />
                      ) : (
                        <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                      )}
                    </div>
                    <p className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{bankStatements.length}</p>
                    <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/30 mt-1' : 'text-xs text-gray-400 mt-1'}>{bankTransactions.length} transactions</p>
                  </div>
                  
                  <div className={theme === 'premium-dark' ? 'p-5 bg-white/[0.02] border border-white/5 rounded-2xl' : 'p-5 bg-gray-50/50 border border-gray-100 rounded-2xl'}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>General Ledger</span>
                      {generalLedger ? (
                        <CheckCircle className={theme === 'premium-dark' ? 'size-4 text-green-400' : 'size-4 text-green-600'} />
                      ) : (
                        <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                      )}
                    </div>
                    <p className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{generalLedger ? '1' : '0'}</p>
                    <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/30 mt-1' : 'text-xs text-gray-400 mt-1'}>{ledgerEntries.length} entries</p>
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={handleRunReconciliation}
                  disabled={isReconciling || bankTransactions.length === 0 || ledgerEntries.length === 0 || isMonthLocked || reconciliationResult?.locked}
                  className={theme === 'premium-dark' ? 'w-full gap-2 h-12 bg-white text-black hover:bg-white/90 rounded-full' : 'w-full gap-2 h-12 bg-black text-white hover:bg-gray-900 rounded-full'}
                  size="lg"
                >
                  {isReconciling ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Running Reconciliation...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="size-5" />
                      {reconciliationResult?.locked ? 'Reconciliation Locked' : isMonthLocked ? 'Period Locked' : 'Run Bank Reconciliation'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Processing State */}
            {isReconciling && (
              <Card>
                <CardContent className="py-12">
                  <ProcessingStages type="bank-rec" />
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {reconciliationResult && !isReconciling && (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Matched</p>
                          <p className="text-3xl text-gray-900 mt-1">
                            {reconciliationResult.summary?.matched_count ?? 0}
                          </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center">
                          <CheckCircle className="size-6 text-violet-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Unmatched Bank</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1 tracking-tight' : 'text-3xl text-gray-900 mt-1 tracking-tight'}>
                            {reconciliationResult.summary?.unmatched_bank_count ?? 0}
                          </p>
                        </div>
                        <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-full bg-white/5 flex items-center justify-center' : 'h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center'}>
                          <AlertCircle className={theme === 'premium-dark' ? 'size-6 text-white/30' : 'size-6 text-gray-500'} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Unmatched Ledger</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1 tracking-tight' : 'text-3xl text-gray-900 mt-1 tracking-tight'}>
                            {reconciliationResult.summary?.unmatched_ledger_count ?? 0}
                          </p>
                        </div>
                        <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-full bg-white/5 flex items-center justify-center' : 'h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center'}>
                          <AlertCircle className={theme === 'premium-dark' ? 'size-6 text-white/30' : 'size-6 text-gray-500'} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Match Rate</p>
                          <p className="text-3xl text-violet-500 mt-1 tracking-tight">
                            {reconciliationResult.summary?.match_rate.toFixed(1) ?? 0}%
                          </p>
                        </div>
                        <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center' : 'h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center'}>
                          <TrendingUp className="size-6 text-violet-500" />
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
                              This reconciliation has been saved and locked for {companies.find(c => c.id === selectedCompanyId)?.name} - {selectedPeriod}.
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
                  <Card className={theme === 'premium-dark' ? 'bg-amber-500/10 border-amber-500/30 rounded-2xl' : 'bg-amber-50 border-amber-200 rounded-2xl'}>
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0' : 'h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0'}>
                            <AlertTriangle className={theme === 'premium-dark' ? 'size-5 text-amber-400' : 'size-5 text-amber-700'} />
                          </div>
                          <div>
                            <h3 className={theme === 'premium-dark' ? 'text-amber-400' : 'text-amber-900'}>Please Review Before Saving</h3>
                            <p className={theme === 'premium-dark' ? 'text-sm text-amber-400/70 mt-1' : 'text-sm text-amber-700 mt-1'}>
                              Carefully review the reconciliation results above to ensure accuracy. Once locked, this reconciliation will be saved for this company and period.
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={handleLockReconciliation}
                          disabled={isLockingReconciliation}
                          className={theme === 'premium-dark' ? 'gap-2 bg-white text-black hover:bg-white/90 rounded-full flex-shrink-0' : 'gap-2 bg-black text-white hover:bg-gray-900 rounded-full flex-shrink-0'}
                        >
                          {isLockingReconciliation ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="size-4" />
                              Save Reconciliation
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Export Button */}
                <div className="flex justify-end">
                  <Button onClick={exportReport} variant="outline" className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] rounded-full' : 'gap-2 rounded-full'}>
                    <Download className="size-4" />
                    Export Report
                  </Button>
                </div>

                {/* Matched Transactions */}
                {(reconciliationResult.matched_pairs?.length ?? 0) > 0 && (
                  <Card>
                    <CardHeader className="border-b bg-white">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Matched Transactions
                        </CardTitle>
                        <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200">
                          {reconciliationResult.matched_pairs.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Date</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Description</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Amount</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Type</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Confidence</th>
                              <th className="text-center py-3 px-6 text-xs text-gray-500 font-medium"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(showAllMatches 
                              ? reconciliationResult.matched_pairs 
                              : reconciliationResult.matched_pairs.slice(0, 10)
                            ).map((match, idx) => (
                              <Fragment key={idx}>
                                <tr 
                                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                                  onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
                                >
                                  <td className="py-4 px-6 text-sm text-gray-600">
                                    {match.bank_transaction.date}
                                  </td>
                                  <td className="py-4 px-6 text-sm text-gray-900">
                                    {match.bank_transaction.description}
                                  </td>
                                  <td className="py-4 px-6 text-sm text-gray-900 font-medium">
                                    €{Math.abs(match.bank_transaction.amount).toFixed(2)}
                                  </td>
                                  <td className="py-4 px-6">
                                    <Badge 
                                      variant="outline" 
                                      className={
                                        match.match_type === 'exact' 
                                          ? 'bg-violet-50 text-violet-700 border-violet-200' 
                                          : match.match_type === 'tolerance'
                                          ? 'bg-green-50 text-green-700 border-green-200'
                                          : match.match_type === 'fee_adjusted'
                                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                                          : match.match_type === 'fx_adjusted' || match.match_type === 'fx'
                                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                                          : 'bg-gray-50 text-gray-600 border-gray-200'
                                      }
                                    >
                                      {match.match_type === 'fx_adjusted' || match.match_type === 'fx' ? 'FX' 
                                        : match.match_type === 'tolerance' ? 'Tolerance'
                                        : match.match_type === 'fee_adjusted' ? 'Fee'
                                        : match.match_type}
                                    </Badge>
                                  </td>
                                  <td className="py-4 px-6 text-sm text-gray-600">
                                    {(match.match_confidence * 100).toFixed(0)}%
                                  </td>
                                  <td className="py-4 px-6 text-center">
                                    <span className="text-gray-400 text-xs">
                                      {expandedMatch === idx ? '▲' : '▼'}
                                    </span>
                                  </td>
                                </tr>
                                <AnimatePresence>
                                  {expandedMatch === idx && (
                                    <motion.tr
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                    >
                                      <td colSpan={6} className="bg-gray-50 px-6 py-4 border-b">
                                        <div className="space-y-2">
                                          <p className="text-xs text-gray-500 font-medium mb-2">Matched Ledger Entries:</p>
                                          {match.ledger_entries.map((entry, ledgerIdx) => (
                                            <div key={ledgerIdx} className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">
                                              <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                  <p className="text-gray-900">{entry.description}</p>
                                                  <p className="text-xs text-gray-500 mt-1">
                                                    {entry.date}
                                                    {entry.account && ` • Account: ${entry.account}`}
                                                  </p>
                                                </div>
                                                <p className="text-gray-900 font-medium ml-4">
                                                  €{Math.abs(entry.amount).toFixed(2)}
                                                </p>
                                              </div>
                                            </div>
                                          ))}
                                          {match.match_type === 'fx_adjusted' && match.fx_rate && (
                                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                                              <p className="font-medium text-blue-900 mb-1">🌍 FX Transaction Details:</p>
                                              <div className="space-y-1 text-blue-700">
                                                <p>Exchange Rate: <span className="font-mono">{match.fx_rate.toFixed(4)}</span></p>
                                                <p>FX Fee: <span className="font-mono">€{match.fx_fee?.toFixed(2) || '0.00'}</span></p>
                                                <p className="text-blue-600 mt-2">{match.explanation}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </motion.tr>
                                  )}
                                </AnimatePresence>
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {reconciliationResult.matched_pairs.length > 10 && (
                        <div className="border-t bg-gray-50 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllMatches(!showAllMatches)}
                            className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                          >
                            {showAllMatches 
                              ? 'Show Less' 
                              : `Show ${reconciliationResult.matched_pairs.length - 10} More Transaction${reconciliationResult.matched_pairs.length - 10 !== 1 ? 's' : ''}`
                            }
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Unmatched Bank Transactions */}
                {(reconciliationResult.unmatched_bank?.length ?? 0) > 0 && (
                  <Card>
                    <CardHeader className="border-b bg-white">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Unmatched Bank Transactions
                        </CardTitle>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                          {reconciliationResult.unmatched_bank.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Date</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Description</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Amount</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Suggested Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reconciliationResult.unmatched_bank.map((item, idx) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="py-4 px-6 text-sm text-gray-600">
                                  {item.transaction.date}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-900">
                                  {item.transaction.description}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-900 font-medium">
                                  €{Math.abs(item.transaction.amount).toFixed(2)}
                                </td>
                                <td className="py-4 px-6">
                                  <div className="space-y-1">
                                    <p className="text-sm text-gray-600">{item.suggested_action}</p>
                                    {item.suggested_je && (
                                      <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mt-1 inline-block">
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
                )}

                {/* Unmatched Ledger Entries */}
                {(reconciliationResult.unmatched_ledger?.length ?? 0) > 0 && (
                  <Card>
                    <CardHeader className="border-b bg-white">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Unmatched Ledger Entries
                        </CardTitle>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                          {reconciliationResult.unmatched_ledger.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Date</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Description</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Amount</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Reason</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reconciliationResult.unmatched_ledger.map((item, idx) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="py-4 px-6 text-sm text-gray-600">
                                  {item.entry.date}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-900">
                                  {item.entry.description}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-900 font-medium">
                                  €{Math.abs(item.entry.amount).toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-600">
                                  {item.reason}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-600">
                                  {item.action}
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
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="size-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Please select a company and period to get started</p>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
