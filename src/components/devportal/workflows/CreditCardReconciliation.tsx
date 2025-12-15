import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, CreditCard, Trash2, FileSpreadsheet, Building, Calendar, Eye, ChevronDown, GitCompare, TrendingUp, Lock, Unlock, Save, AlertTriangle, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useRef, useEffect, Fragment } from 'react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { companiesApi, Company } from '@/utils/api-client';
import { useTheme } from '@/contexts/ThemeContext';

interface CCTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  merchant?: string;
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
  glAccount?: string;
  cardAccount?: string;
  reference?: string;
}

export function CreditCardReconciliation() {
  const { theme } = useTheme();
  
  // Company and Period Selection
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  
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
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
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
      loadCCData();
      loadLedgerData();
      loadReconciliationData(); // Load saved reconciliation
      loadLockStatus(); // Load month-end close lock status
    }
  }, [selectedCompanyId, selectedPeriod]);
  
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
  
  // Load credit card statements and transactions
  const loadCCData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      setIsLoadingCCData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/statements?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
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
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      setIsLoadingLedger(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/ledger?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
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
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/reconciliation?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
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
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      console.log('🔒 [CC Rec Review] Loading lock status for:', { selectedCompanyId, selectedPeriod });
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
    if (!files || files.length === 0 || !selectedCompanyId || !selectedPeriod) return;
    
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
          formData.append('companyId', selectedCompanyId);
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
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/statement/${statementId}?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
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
    if (!selectedCompanyId || !selectedPeriod || ccTransactions.length === 0) return;
    
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
            companyId: selectedCompanyId,
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
        
        const company = companies.find(c => c.id === selectedCompanyId);
        const fileName = `CC_Statements_${company?.name || 'Company'}_${selectedPeriod}.xlsx`;
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
            companyId: selectedCompanyId,
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
      const matchedPairs = data.matched_pairs.map((pair: any) => ({
        transaction: pair.cc_transaction,
        ledgerEntry: pair.ledger_entries[0], // For display purposes, use first entry
        ledgerEntries: pair.ledger_entries, // Keep all entries for multi-match display
        matchType: pair.match_type,
        matchConfidence: pair.match_confidence,
        explanation: pair.explanation
      }));

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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/unlock-reconciliation`,
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
  
  // Handle credit card ledger upload
  const handleLedgerFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCompanyId || !selectedPeriod) return;
    
    setIsUploadingLedger(true);
    const loadingToastId = toast.loading('Uploading ledger file...', {
      description: 'Processing your credit card ledger CSV'
    });
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', selectedCompanyId);
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
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // Group transactions by card
  const transactionsByCard = ccTransactions.reduce((acc, txn) => {
    const key = txn.cardName || 'Unknown Card';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(txn);
    return acc;
  }, {} as Record<string, CCTransaction[]>);

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Header - Ultra Minimal */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={theme === 'premium-dark' ? 'text-4xl tracking-tight text-white' : 'text-4xl tracking-tight text-gray-900'}>Credit Card Reconciliation</h1>
          <p className={theme === 'premium-dark' ? 'text-purple-300/40 text-sm mt-2' : 'text-gray-400 text-sm mt-2'}>
            Upload and review company credit card statements
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
              : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 h-11 rounded-xl'}>
              <div className="flex items-center gap-2">
                <Building className={theme === 'premium-dark' ? 'size-4 text-purple-300/40' : 'size-4 text-gray-400'} />
                <SelectValue placeholder="Select a company" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name} ({company.country})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex-1">
          <Select 
            value={selectedPeriod} 
            onValueChange={setSelectedPeriod}
          >
            <SelectTrigger className={theme === 'premium-dark' 
              ? 'bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl' 
              : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 h-11 rounded-xl'}>
              <div className="flex items-center gap-2">
                <Calendar className={theme === 'premium-dark' ? 'size-4 text-purple-300/40' : 'size-4 text-gray-400'} />
                <SelectValue placeholder="Select period" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      {selectedCompanyId && selectedPeriod ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={theme === 'premium-dark' ? 'grid w-full grid-cols-3 h-auto p-1 bg-white/[0.03] border border-white/5' : 'grid w-full grid-cols-3 h-auto p-1'}>
            <TabsTrigger value="cc-statements" className="gap-2 py-3">
              <FileText className="size-4" />
              Credit Card Statements
              {(ccTransactions.length > 0 || ccPayments.length > 0) && (
                <CheckCircle className="size-4 ml-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="cc-ledger" className="gap-2 py-3">
              <CreditCard className="size-4" />
              Credit Card Ledger
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2 py-3">
              <CheckCircle className="size-4" />
              Reconciliation
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
                        : 'bg-black text-white hover:bg-black/90 rounded-xl'}
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
                        className="border border-gray-200 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-md transition-all"
                      >
                        {/* Statement Header */}
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="size-12 rounded-lg bg-purple-100 flex items-center justify-center shadow-sm">
                                <CreditCard className="size-6 text-purple-600" />
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

            {/* Card Payments & Settlement Section - MOVED HERE */}
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

            {/* Settlement Check - Liability Clearance */}
            {ccPayments.length > 0 && (
              <Card className={theme === 'premium-dark' ? 'border-2 border-white/10 bg-white/[0.03] rounded-2xl' : 'border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl'}>
                <CardHeader className={theme === 'premium-dark' ? 'cursor-pointer hover:bg-white/[0.05] transition-colors' : 'cursor-pointer hover:bg-purple-100/50 transition-colors'} onClick={() => setIsSettlementCheckExpanded(!isSettlementCheckExpanded)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-lg text-white' : 'flex items-center gap-2 text-lg'}>
                        <CheckCircle className={theme === 'premium-dark' ? 'size-5 text-purple-300/60' : 'size-5 text-purple-600'} />
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
                      <ChevronDown className="size-5 text-purple-600" />
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
              <Alert className="bg-gray-900 border-gray-800">
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. You cannot upload or modify the credit card ledger while the period is locked.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Reconciliation Lock Alert (only show if NOT month locked) */}
            {!isMonthLocked && reconciliationResult?.locked && (
              <Alert className="bg-amber-50 border-amber-200">
                <Lock className="size-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <strong>Uploads are locked.</strong> This company's reconciliation for {selectedPeriod} is locked. To upload or modify the credit card ledger, click "Update Reconciliation" in the Reconciliation tab to unlock it.
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-white' : 'flex items-center gap-2'}>
                      <Upload className={theme === 'premium-dark' ? 'size-5 text-purple-300/60' : 'size-5 text-teal-600'} />
                      Upload Credit Card Ledger
                    </CardTitle>
                    <CardDescription className={theme === 'premium-dark' ? 'mt-1 text-gray-400' : 'mt-1'}>
                      Upload your credit card ledger from QuickBooks, Xero, or DATEV (CSV format). This contains the accounting entries for your credit card account.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => ledgerFileInputRef.current?.click()}
                      disabled={isUploadingLedger || isMonthLocked || reconciliationResult?.locked}
                      className={theme === 'premium-dark' 
                        ? 'bg-white text-black hover:bg-white/90 rounded-xl' 
                        : 'bg-black text-white hover:bg-black/90 rounded-xl'}
                    >
                      {isUploadingLedger ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4 mr-2" />
                          Upload Ledger CSV
                        </>
                      )}
                    </Button>
                    <input
                      ref={ledgerFileInputRef}
                      type="file"
                      onChange={handleLedgerFileUpload}
                      accept=".csv"
                      className="hidden"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingLedger ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-teal-600" />
                  </div>
                ) : ccLedgerEntries.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileSpreadsheet className="size-12 text-gray-300 mx-auto mb-3" />
                    <p>No credit card ledger uploaded yet.</p>
                    <p className="text-sm mt-1">Upload a CSV file from your accounting system to get started.</p>
                    <div className="mt-6 text-left max-w-md mx-auto bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-900 mb-2">Expected CSV format:</p>
                      <div className="bg-white rounded px-3 py-2 text-xs">
                        <code className="text-gray-700">
                          Date, Description, Debit, Credit, Balance, Reference<br/>
                          2025-10-01, Opening Balance, 0.00, 0.00, 150.00, -<br/>
                          2025-10-05, Amazon Purchase, 45.23, 0.00, 195.23, INV-001<br/>
                          2025-10-15, Payment, 0.00, 150.00, 45.23, PMT-001
                        </code>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm text-gray-700">
                        Ledger Entries ({ccLedgerEntries.length})
                      </h4>
                      <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-300">
                        Last upload: {new Date().toLocaleDateString()}
                      </Badge>
                    </div>
                    
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-gray-700">Posting Date</th>
                            <th className="px-4 py-3 text-left text-gray-700">Vendor</th>
                            <th className="px-4 py-3 text-left text-gray-700">Memo</th>
                            <th className="px-4 py-3 text-right text-gray-700">Debit</th>
                            <th className="px-4 py-3 text-right text-gray-700">Credit</th>
                            <th className="px-4 py-3 text-left text-gray-700">GL Account</th>
                            <th className="px-4 py-3 text-left text-gray-700">Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ccLedgerEntries.map((entry, idx) => (
                            <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-3 text-gray-900">
                                {new Date(entry.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-gray-900">{entry.vendor}</td>
                              <td className="px-4 py-3 text-gray-600">{entry.memo || '-'}</td>
                              <td className={theme === 'premium-dark' ? `px-4 py-3 text-right ${entry.debit > 0 ? 'text-white' : 'text-gray-500'}` : `px-4 py-3 text-right ${entry.debit > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                ${formatCurrency(entry.debit)}
                              </td>
                              <td className={theme === 'premium-dark' ? `px-4 py-3 text-right ${entry.credit > 0 ? 'text-white' : 'text-gray-500'}` : `px-4 py-3 text-right ${entry.credit > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                ${formatCurrency(entry.credit)}
                              </td>
                              <td className="px-4 py-3 text-gray-900">{entry.glAccount || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{entry.reference || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-gray-700">
                              Totals:
                            </td>
                            <td className={theme === 'premium-dark' ? 'px-4 py-3 text-right text-white' : 'px-4 py-3 text-right text-gray-900'}>
                              ${formatCurrency(
                                ccLedgerEntries.reduce((sum, entry) => sum + entry.debit, 0)
                              )}
                            </td>
                            <td className={theme === 'premium-dark' ? 'px-4 py-3 text-right text-white' : 'px-4 py-3 text-right text-gray-900'}>
                              ${formatCurrency(
                                ccLedgerEntries.reduce((sum, entry) => sum + entry.credit, 0)
                              )}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
            
            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
              <CardHeader>
                <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>Run Reconciliation</CardTitle>
                <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>Match credit card statement transactions with ledger entries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Data summary section */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Statement Transactions */}
                  <div className={theme === 'premium-dark' ? 'p-5 bg-white/[0.02] border border-white/5 rounded-2xl' : 'p-5 bg-gray-50/50 border border-gray-100 rounded-2xl'}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Statement Transactions</span>
                      {ccTransactions.filter(t => !t.isPayment).length > 0 && (
                        <CheckCircle className={theme === 'premium-dark' ? 'size-4 text-white' : 'size-4 text-gray-600'} />
                      )}
                    </div>
                    <p className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{ccTransactions.filter(t => !t.isPayment).length}</p>
                    <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/30 mt-1' : 'text-xs text-gray-400 mt-1'}>expense transactions</p>
                  </div>

                  {/* Ledger Entries */}
                  <div className={theme === 'premium-dark' ? 'p-5 bg-white/[0.02] border border-white/5 rounded-2xl' : 'p-5 bg-gray-50/50 border border-gray-100 rounded-2xl'}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Ledger Entries</span>
                      {ccLedgerEntries.length > 0 && (
                        <CheckCircle className={theme === 'premium-dark' ? 'size-4 text-white' : 'size-4 text-gray-600'} />
                      )}
                    </div>
                    <p className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{ccLedgerEntries.length}</p>
                    <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/30 mt-1' : 'text-xs text-gray-400 mt-1'}>ledger entries</p>
                  </div>
                </div>

                {/* Run Reconciliation Button */}
                <Button
                  onClick={handleRunReconciliation}
                  disabled={isRunningReconciliation || ccTransactions.filter(t => !t.isPayment).length === 0 || ccLedgerEntries.length === 0 || isMonthLocked || reconciliationResult?.locked}
                  className={theme === 'premium-dark' ? 'w-full gap-2 h-12 bg-white text-black hover:bg-white/90 rounded-full' : 'w-full gap-2 h-12 bg-black text-white hover:bg-gray-900 rounded-full'}
                  size="lg"
                >
                  {isRunningReconciliation ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Running Reconciliation...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="size-5" />
                      {reconciliationResult?.locked ? 'Reconciliation Locked' : isMonthLocked ? 'Period Locked' : 'Run Reconciliation'}
                    </>
                  )}
                </Button>
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
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Matched</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1 tracking-tight' : 'text-3xl text-gray-900 mt-1 tracking-tight'}>
                            {reconciliationResult.matchedPairs?.length ?? 0}
                          </p>
                        </div>
                        <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center' : 'h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center'}>
                          <CheckCircle className="size-6 text-violet-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Unmatched CC</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1 tracking-tight' : 'text-3xl text-gray-900 mt-1 tracking-tight'}>
                            {reconciliationResult.unmatchedTransactions?.length ?? 0}
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
                            {reconciliationResult.unmatchedLedger?.length ?? 0}
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
                            {reconciliationResult.matchRate?.toFixed(1) ?? 0}%
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
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-2xl' : 'bg-gray-50 border-gray-200 rounded-2xl'}>
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={theme === 'premium-dark' ? 'h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0' : 'h-12 w-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0'}>
                            <AlertTriangle className={theme === 'premium-dark' ? 'size-5 text-white/60' : 'size-5 text-gray-500'} />
                          </div>
                          <div>
                            <h3 className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>Please Review Before Saving</h3>
                            <p className={theme === 'premium-dark' ? 'text-sm text-gray-400 mt-1' : 'text-sm text-gray-500 mt-1'}>
                              Carefully review the reconciliation results above to ensure accuracy. Once locked, this reconciliation will be saved for {companies.find(c => c.id === selectedCompanyId)?.name} - {selectedPeriod}.
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={handleLockReconciliation}
                          disabled={isLockingReconciliation || isMonthLocked}
                          variant="outline"
                          className={theme === 'premium-dark' ? 'gap-2 bg-white text-black hover:bg-white/90 rounded-full flex-shrink-0 border-0' : 'gap-2 bg-black text-white hover:bg-gray-900 rounded-full flex-shrink-0 border-0'}
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
                    </CardContent>
                  </Card>
                )}

                {/* Matched Transactions Card */}
                {(reconciliationResult.matchedPairs?.length ?? 0) > 0 && (
                  <Card>
                    <CardHeader className="border-b bg-white">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Matched Transactions
                        </CardTitle>
                        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                          {reconciliationResult.matchedPairs?.length ?? 0}
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
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Card</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Type</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Confidence</th>
                              <th className="text-center py-3 px-6 text-xs text-gray-500 font-medium"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(showAllMatches 
                              ? reconciliationResult.matchedPairs ?? []
                              : reconciliationResult.matchedPairs?.slice(0, 10) ?? []
                            ).map((match, idx) => (
                                    <Fragment key={idx}>
                                      <tr 
                                        className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
                                      >
                                        <td className="py-4 px-6 text-sm text-gray-600">
                                          {match.transaction.date}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-900">
                                          {match.transaction.description}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-900 font-medium">
                                          ${Math.abs(match.transaction.amount).toFixed(2)}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-600">
                                          {match.transaction.cardName}
                                          {match.transaction.cardLast4 && ` ••${match.transaction.cardLast4}`}
                                        </td>
                                        <td className="py-4 px-6">
                                          <Badge 
                                            variant="outline" 
                                            className={
                                              match.matchType === 'exact' 
                                                ? 'bg-violet-50 text-violet-700 border-violet-200' 
                                                : match.matchType === 'one_to_many'
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : match.matchType === 'many_to_one'
                                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                                : match.matchType === 'fx'
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : 'bg-gray-50 text-gray-600 border-gray-200'
                                            }
                                          >
                                            {match.matchType === 'exact' ? 'exact'
                                              : match.matchType === 'one_to_many' ? '1:Many'
                                              : match.matchType === 'many_to_one' ? 'Many:1'
                                              : match.matchType === 'fx' ? 'FX'
                                              : match.matchType}
                                          </Badge>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-600">
                                          {match.matchConfidence.toFixed(0)}%
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
                                            <td colSpan={7} className="bg-gray-50 px-6 py-4 border-b">
                                              <div className="space-y-2">
                                                <p className="text-xs text-gray-500 font-medium mb-2">Matched Ledger Entry:</p>
                                                <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                      <p className="text-gray-900">{match.ledgerEntry.vendor}</p>
                                                      {match.ledgerEntry.memo && (
                                                        <p className="text-xs text-gray-500 mt-1">{match.ledgerEntry.memo}</p>
                                                      )}
                                                      <p className="text-xs text-gray-500 mt-1">
                                                        {match.ledgerEntry.date}
                                                        {match.ledgerEntry.glAccount && ` • GL Account: ${match.ledgerEntry.glAccount}`}
                                                      </p>
                                                    </div>
                                                    <p className="text-gray-900 font-medium ml-4">
                                                      ${match.ledgerEntry.debit.toFixed(2)}
                                                    </p>
                                                  </div>
                                                </div>
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
                            
                            {(reconciliationResult.matchedPairs?.length ?? 0) > 10 && (
                              <div className="border-t bg-gray-50 py-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowAllMatches(!showAllMatches)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
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
                  <Card>
                    <CardHeader className="border-b bg-white">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Unmatched Statement Transactions
                        </CardTitle>
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                          {reconciliationResult.unmatchedTransactions?.length ?? 0}
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
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Card</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(reconciliationResult.unmatchedTransactions ?? []).map((txn) => (
                              <tr key={txn.id} className="border-b hover:bg-gray-50">
                                <td className="py-4 px-6 text-sm text-gray-600">{txn.date}</td>
                                <td className="py-4 px-6 text-sm text-gray-900">{txn.description}</td>
                                <td className="py-4 px-6 text-sm text-gray-900 font-medium">
                                  ${Math.abs(txn.amount).toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-600">
                                  {txn.cardName}
                                  {txn.cardLast4 && ` ••${txn.cardLast4}`}
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
                  <Card>
                    <CardHeader className="border-b bg-white">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Unmatched Ledger Entries
                        </CardTitle>
                        <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                          {reconciliationResult.unmatchedLedger?.length ?? 0}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Date</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Vendor</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Memo</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">Amount</th>
                              <th className="text-left py-3 px-6 text-xs text-gray-500 font-medium">GL Account</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(reconciliationResult.unmatchedLedger ?? []).map((entry) => (
                              <tr key={entry.id} className="border-b hover:bg-gray-50">
                                <td className="py-4 px-6 text-sm text-gray-600">{entry.date}</td>
                                <td className="py-4 px-6 text-sm text-gray-900">{entry.vendor}</td>
                                <td className="py-4 px-6 text-sm text-gray-600">{entry.memo || '-'}</td>
                                <td className="py-4 px-6 text-sm text-gray-900 font-medium">
                                  ${entry.debit.toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-600">{entry.glAccount || '-'}</td>
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
      )}
    </div>
  );
}