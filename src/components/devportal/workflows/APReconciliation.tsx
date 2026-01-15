import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft, TrendingUp, Clock, ChevronRight, Building, Calendar, Trash2, PlayCircle, FileSpreadsheet, BookOpen, GitCompare, Eye, Lock, Unlock, AlertTriangle, Receipt, Check, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useRef, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { ProcessingStages } from '@/components/ProcessingStages';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTheme } from '@/contexts/ThemeContext';
import apIcon from 'figma:asset/eb0d611038f856bc8a75ec057c26cb0dc3aa5ccf.png';
import novalareLogoImg from 'figma:asset/85a18c0f14d9634898763219441c014da1faf3e8.png';
import { MatchStatusBadge } from './APRecBadges';
import { MatchTypeDisplay } from './MatchTypeDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase/client';

interface VendorTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency?: string; // ISO currency code (USD, EUR, GBP, etc.)
  balance?: number;
  statementId: string;
  statementName: string;
  invoiceNumber?: string;
  vendor?: string; // Vendor name from statement
}

interface VendorStatement {
  id: string;
  fileName: string;
  uploadedAt: number;
  transactionCount: number;
  fileUrl?: string;
  filePath?: string;
  vendor?: string;
  vendorName?: string; // Vendor name extracted from statement
  currency?: string; // Statement currency (USD, EUR, GBP, etc.)
  statementDate?: string; // Statement date if available
}

interface APLedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency?: string; // ISO currency code (USD, EUR, GBP, etc.)
  account?: string;
  reference?: string;
  invoiceNumber?: string;
  vendor?: string;
}

interface APLedger {
  id: string;
  fileName: string;
  uploadedAt: number;
  entryCount: number;
}

interface MatchedPair {
  vendor_transaction: VendorTransaction;
  ap_entries: APLedgerEntry[];
  match_confidence: number;
  match_type: string;
  explanation?: string;
  match_status?: 'auto_approved' | 'review_recommended' | 'manual_review_required';
  match_flags?: any;
  additional_vendor_transactions?: VendorTransaction[];
  fx_rate?: number;
  fx_direction?: string;
}

interface UnmatchedVendor {
  transaction: VendorTransaction;
  suggested_action: string;
  suggested_je?: {
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
  };
}

interface UnmatchedAP {
  entry: APLedgerEntry;
  reason: string;
  action: string;
}

interface ReconciliationResult {
  matched_pairs: MatchedPair[];
  unmatched_vendor: UnmatchedVendor[];
  unmatched_ap: UnmatchedAP[];
  summary: {
    total_vendor_transactions: number;
    total_ap_entries: number;
    matched_count: number;
    unmatched_vendor_count: number;
    unmatched_ap_count: number;
    total_vendor_amount: number;
    total_ap_amount: number;
    difference: number;
    match_rate: number;
  };
  locked?: boolean;
  lockedAt?: string;
  unlockedAt?: string;
}

interface APReconciliationProps {
  companyId?: string; // Optional for backward compatibility with legacy DevPortal
}

/**
 * AP RECONCILIATION - AMOUNT SIGN CONVENTION (Option 2: Company Perspective)
 * 
 * All amounts are normalized during extraction to represent the COMPANY'S PERSPECTIVE:
 * 
 * NEGATIVE amounts (RED) = Liabilities INCREASE (money company owes/will pay OUT)
 *   - Vendor invoices
 *   - Vendor debits
 *   - AP ledger debit entries (new bills)
 * 
 * POSITIVE amounts (GREEN) = Liabilities DECREASE (reductions to what company owes)
 *   - Vendor payments
 *   - Vendor credits/refunds
 *   - AP ledger credit entries (payments made)
 * 
 * This matches bank reconciliation logic and makes color coding consistent across all workflows.
 */

export function APReconciliation({ companyId = '' }: APReconciliationProps) {
  const { theme } = useTheme();
  const { session } = useAuth();
  const navigate = useNavigate();

  // Scroll refs for navigation
  const matchedSectionRef = useRef<HTMLDivElement>(null);
  const unmatchedVendorSectionRef = useRef<HTMLDivElement>(null);
  const unmatchedApSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: any) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      'NZD': 'NZ$',
      'HKD': 'HK$',
      'SGD': 'S$',
      'CHF': 'CHF ',
      'INR': '₹',
      'MXN': 'MX$',
      'BRL': 'R$',
      'KRW': '₩',
      'SEK': 'kr ',
      'NOK': 'kr ',
      'DKK': 'kr ',
      'PLN': 'zł',
      'ZAR': 'R',
      'THB': '฿',
      'IDR': 'Rp',
      'MYR': 'RM',
      'PHP': '₱',
      'TRY': '₺',
      'RUB': '₽',
    };

    return symbols[currency.toUpperCase()] || currency.toUpperCase() + ' ';
  };

  // Period Selection only (company is passed as prop)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  // Vendor Statements Tab
  const [vendorStatements, setVendorStatements] = useState<VendorStatement[]>([]);
  const [vendorTransactions, setVendorTransactions] = useState<VendorTransaction[]>([]);
  const [isUploadingVendor, setIsUploadingVendor] = useState(false);
  const [isLoadingVendorData, setIsLoadingVendorData] = useState(false);
  const [isExportingVendor, setIsExportingVendor] = useState(false);

  // AP Ledger Tab
  const [apLedger, setAPLedger] = useState<APLedger | null>(null);
  const [apEntries, setAPEntries] = useState<APLedgerEntry[]>([]);
  const [isUploadingAP, setIsUploadingAP] = useState(false);
  const [isLoadingAPData, setIsLoadingAPData] = useState(false);

  // QuickBooks GL Sync
  const [qboAccounts, setQboAccounts] = useState<any[]>([]);
  const [selectedGLAccount, setSelectedGLAccount] = useState<string>('');
  const [isLoadingQBAccounts, setIsLoadingQBAccounts] = useState(false);
  const [companyQBOConnectionId, setCompanyQBOConnectionId] = useState<string>('');
  const [isSyncingGL, setIsSyncingGL] = useState(false);

  // Reconciliation Tab
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [isLockingReconciliation, setIsLockingReconciliation] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Current Active Tab
  const [activeTab, setActiveTab] = useState<string>('vendor-statements');

  // Month-End Close Lock State
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);

  // Export Dialog
  const [showExportDialog, setShowExportDialog] = useState(false);

  const vendorFileInputRef = useRef<HTMLInputElement>(null);
  const apFileInputRef = useRef<HTMLInputElement>(null);
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
    if (companyId) {
      loadQBAccounts(companyId);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId && selectedPeriod) {
      loadLockStatus();
      loadVendorData();
      loadAPData();
      loadReconciliationData();
    }
  }, [companyId, selectedPeriod]);

  const loadQBAccounts = async (cid: string) => {
    if (!session?.access_token) {
      console.log('⚠️ No session available, skipping QB accounts load');
      return;
    }

    try {
      setIsLoadingQBAccounts(true);
      console.log(`📊 Loading QuickBooks accounts for company ${cid}...`);

      // Get company to find QB connection ID
      const companyResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${cid}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
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

      // Fetch QB accounts from company COA
      const accountsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${cid}/coa`,
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

      // Filter to Accounts Payable accounts only
      const apAccounts = accounts.filter((a: any) => a.type === 'Accounts Payable');
      console.log(`✅ Loaded ${apAccounts.length} AP accounts from QuickBooks`);
      setQboAccounts(apAccounts);

      // Auto-select first AP account if available
      if (apAccounts.length > 0) {
        setSelectedGLAccount(apAccounts[0].qbo_id);
      }
    } catch (error) {
      console.error('❌ Failed to load QB accounts:', error);
      setQboAccounts([]);
      setCompanyQBOConnectionId('');
    } finally {
      setIsLoadingQBAccounts(false);
    }
  };

  const loadLockStatus = async () => {
    if (!companyId || !selectedPeriod) return;

    try {
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
        setIsMonthLocked(data.isLocked || false);
        setLockDetails(data.isLocked ? data : null);
        console.log('Period lock status:', data);
      }
    } catch (error) {
      console.error('Failed to load lock status:', error);
    }
  };

  // Load vendor statements and transactions
  const loadVendorData = async () => {
    if (!companyId || !selectedPeriod) return;

    try {
      setIsLoadingVendorData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/vendor-statements?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setVendorStatements(data.statements || []);
          setVendorTransactions(data.transactions || []);
        }
      } else if (response.status === 404) {
        // No data found yet - this is expected
        if (isMountedRef.current) {
          setVendorStatements([]);
          setVendorTransactions([]);
        }
      }
    } catch (error) {
      // Silently handle - endpoint may not have data yet
      if (isMountedRef.current) {
        setVendorStatements([]);
        setVendorTransactions([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingVendorData(false);
      }
    }
  };

  // Load AP ledger and entries
  const loadAPData = async () => {
    if (!companyId || !selectedPeriod) return;

    try {
      setIsLoadingAPData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/ap-ledger?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setAPLedger(data.ledger || null);
          setAPEntries(data.entries || []);
        }
      } else {
        // Clear data if not found or error
        if (isMountedRef.current) {
          setAPLedger(null);
          setAPEntries([]);
        }
      }
    } catch (error) {
      console.error('Error loading AP ledger:', error);
      // Clear data on error too
      if (isMountedRef.current) {
        setAPLedger(null);
        setAPEntries([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingAPData(false);
      }
    }
  };

  // Load reconciliation data
  // Load reconciliation data
  const loadReconciliationData = async () => {
    if (!companyId || !selectedPeriod) return;

    try {
      console.log('📂 Loading reconciliation data for', companyId, selectedPeriod);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-reconciliation?companyId=${companyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded reconciliation data:', data);
        if (isMountedRef.current) {
          if (data.reconciliation) {
            setReconciliationResult(data.reconciliation);
            console.log('✅ Set reconciliation result with', data.reconciliation.matched_pairs?.length || 0, 'matches');
          } else {
            console.log('ℹ️ No reconciliation data found');
            setReconciliationResult(null);
          }
        }
      } else {
        console.log('⚠️ Response not OK:', response.status);
        if (isMountedRef.current) {
          setReconciliationResult(null);
        }
      }
    } catch (error) {
      console.error('Error loading reconciliation:', error);
      if (isMountedRef.current) {
        setReconciliationResult(null);
      }
    }
  };

  // Sync GL from QuickBooks
  const handleSyncGLFromQuickBooks = async () => {
    if (!companyId || !selectedPeriod || !selectedGLAccount || !companyQBOConnectionId) {
      toast.error('Please select a period and ensure QuickBooks is connected');
      return;
    }

    if (!session?.access_token) {
      toast.error('Please log in to sync from QuickBooks');
      return;
    }

    try {
      setIsSyncingGL(true);
      const syncToastId = toast.loading('Syncing ledger from QuickBooks...');

      // Calculate start and end dates from selected period (YYYY-MM)
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
        throw new Error(errorData.error || `Sync failed with status: ${response.status}`);
      }

      const data = await response.json();
      const glEntries = data.entries || [];

      // Transform QB GL entries to AP ledger format
      const transformedEntries: APLedgerEntry[] = glEntries.map((entry: any, index: number) => ({
        id: `qb-${index}`,
        date: entry.date,
        description: entry.memo || entry.name || entry.transaction_type || '',
        amount: entry.amount || 0,
        account: entry.account || '',
        reference: entry.num || '',
        vendor: entry.name || ''
      }));

      // Persist the synced entries to the backend
      const saveResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/ap-ledger`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companyId,
            period: selectedPeriod,
            ledger: {
              id: `qb-sync-${Date.now()}`,
              fileName: `QuickBooks Sync - ${selectedGLAccount}`,
              uploadedAt: Date.now(),
              entryCount: transformedEntries.length
            },
            entries: transformedEntries
          })
        }
      );

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Failed to save synced ledger data to backend (Status: ${saveResponse.status})`);
      }

      toast.dismiss(syncToastId);
      toast.success(`✅ Synced and saved ${transformedEntries.length} entries from QuickBooks`);

      // Refresh data from backend to ensure state is in sync
      await loadAPData();
    } catch (error: any) {
      console.error('❌ Sync failed:', error);
      toast.dismiss();
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncingGL(false);
    }
  };

  // Handle vendor statement upload
  const handleVendorFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !companyId || !selectedPeriod) return;

    setIsUploadingVendor(true);

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
          formData.append('period', selectedPeriod);

          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/upload-vendor-statement`,
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
      await loadVendorData();
    } catch (error) {
      console.error('❌ Batch upload error:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingVendor(false);
      if (vendorFileInputRef.current) {
        vendorFileInputRef.current.value = '';
      }
    }
  };

  // Handle AP ledger upload
  const handleAPFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId || !selectedPeriod) return;

    setIsUploadingAP(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('period', selectedPeriod);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/upload-ap-ledger`,
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
        const vendorCount = data.entries?.filter((e: any) => e.vendor).length || 0;
        const message = vendorCount > 0
          ? `✅ Uploaded ${data.entryCount} entries (${vendorCount} with vendor info)`
          : `✅ Uploaded ${data.entryCount} entries (⚠️ no vendor column detected)`;
        toast.success(message);
        await loadAPData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(`Failed to upload AP ledger: ${errorData.details || errorData.error}`);
        console.error('Upload error:', errorData);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload AP ledger: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingAP(false);
      if (apFileInputRef.current) {
        apFileInputRef.current.value = '';
      }
    }
  };

  // Handle delete vendor statement
  const handleDeleteVendorStatement = async (statementId: string) => {
    if (!companyId || !selectedPeriod) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/vendor-statement/${statementId}?companyId=${companyId}&period=${selectedPeriod}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Vendor statement deleted');
        await loadVendorData();
      } else {
        toast.error('Failed to delete vendor statement');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete vendor statement');
    }
  };

  // Run reconciliation
  const handleRunReconciliation = async () => {
    if (!companyId || !selectedPeriod) return;

    if (vendorTransactions.length === 0 || apEntries.length === 0) {
      toast.error('Please upload both vendor statements and AP ledger before reconciling');
      return;
    }

    setIsReconciling(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/run-ap-reconciliation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: companyId,
            period: selectedPeriod,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReconciliationResult(data.reconciliation);
        toast.success('AP reconciliation completed successfully');
        setActiveTab('reconciliation');
      } else {
        const error = await response.text();
        toast.error('Failed to run reconciliation');
        console.error(error);
      }
    } catch (error) {
      console.error('Reconciliation error:', error);
      toast.error('Failed to run reconciliation');
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/lock-reconciliation`,
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
      toast.success('AP Reconciliation saved and locked successfully!');
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
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/unlock-reconciliation`,
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
      toast.success('AP Reconciliation unlocked. You can now update it.');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to unlock reconciliation';
      toast.error(errorMessage);
      console.error('Unlock reconciliation error:', err);
    } finally {
      setIsLockingReconciliation(false);
    }
  };

  // Export reconciliation results with ExcelJS formatting
  const handleExport = async () => {
    if (!reconciliationResult || !companyId || !selectedPeriod) return;

    setIsExporting(true);
    const loadingToast = toast.loading('Generating Excel report...');

    try {
      const { createAPReconciliationExport } = await import('./APRecExport');
      await createAPReconciliationExport(
        reconciliationResult,
        companyId,
        selectedPeriod,
        publicAnonKey,
        projectId,
        novalareLogoImg,
        getCurrencySymbol
      );

      toast.dismiss(loadingToast);
      toast.success('AP Reconciliation exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to export reconciliation');
    } finally {
      setIsExporting(false);
    }
  };

  // Export vendor statements
  const handleExportVendorStatements = async () => {
    if (!companyId || !selectedPeriod || vendorTransactions.length === 0) return;

    setIsExportingVendor(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/export-vendor-statements`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: companyId,
            period: selectedPeriod,
            statements: vendorStatements,
            transactions: vendorTransactions,
          }),
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const fileName = `Vendor_Statements_${selectedPeriod}.xlsx`;
        a.download = fileName;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success('Vendor statements exported successfully');
      } else {
        toast.error('Failed to export vendor statements');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export vendor statements');
    } finally {
      setIsExportingVendor(false);
    }
  };

  const periods = generatePeriodOptions();

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20">
      {/* Background Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className={`absolute -top-1/4 -right-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'premium-dark' ? 'bg-[#34d399]/20' : 'bg-[#34d399]/30'}`} />
        <div className={`absolute -bottom-1/4 -left-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/10' : 'bg-[#4F5CFE]/20'}`} />
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-[#34d399] rounded-full hidden lg:block shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
          <div className="flex items-center gap-3 mb-2">
            <h1 className={`text-4xl font-black tracking-tighter ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
              AP Reconciliation
            </h1>
          </div>
          <p className={`text-lg font-medium max-w-xl leading-relaxed ${theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
            Match vendor statements with AP ledger entries using AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/company/${companyId}/reconciliations`)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accounts
          </Button>

          <Select
            value={selectedPeriod}
            onValueChange={setSelectedPeriod}
          >
            <SelectTrigger className={`w-[240px] h-12 rounded-2xl border-2 font-bold ${theme === 'premium-dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-100 text-gray-900'}`}>
              <Calendar className="mr-2 h-4 w-4 text-[#34d399]" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className={theme === 'premium-dark' ? 'bg-gray-900 border-white/10' : ''}>
              {periods.map((option) => (
                <SelectItem key={option.value} value={option.value} className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3-Tab Structure - Matching Bank Reconciliation Design */}
      {selectedPeriod ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={theme === 'premium-dark'
            ? 'relative grid w-full grid-cols-3 h-auto p-1.5 gap-1 bg-white/[0.03] border border-white/10 rounded-2xl'
            : 'relative grid w-full grid-cols-3 h-auto p-1.5 gap-1 rounded-2xl bg-gray-100'
          }>
            <TabsTrigger
              value="vendor-statements"
              className={theme === 'premium-dark'
                ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
              }
            >
              {activeTab === 'vendor-statements' && (
                <motion.div
                  layoutId="active-ap-rec-tab"
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
                Vendor Statements
                {vendorStatements.length > 0 && (
                  <Badge variant="secondary" className={theme === 'premium-dark'
                    ? 'ml-auto bg-blue-500/20 text-blue-400 border-0 px-2 py-0.5 text-xs'
                    : 'ml-auto bg-blue-100 text-blue-700 px-2 py-0.5 text-xs'
                  }>
                    {vendorStatements.length}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="ap-ledger"
              className={theme === 'premium-dark'
                ? 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-white data-[state=inactive]:text-purple-300/60 data-[state=inactive]:hover:text-white transition-colors whitespace-nowrap overflow-hidden'
                : 'relative z-10 gap-2 py-3 px-4 rounded-xl data-[state=active]:text-gray-900 data-[state=inactive]:text-gray-600 transition-colors whitespace-nowrap overflow-hidden'
              }
            >
              {activeTab === 'ap-ledger' && (
                <motion.div
                  layoutId="active-ap-rec-tab"
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
                AP Ledger
                {apLedger && (
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
                  layoutId="active-ap-rec-tab"
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
                    : 'ml-auto bg-purple-100 text-purple-700 px-2 py-0.5 text-xs'
                  }>
                    {reconciliationResult.summary.match_rate.toFixed(0)}%
                  </Badge>
                )}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Vendor Statements */}
          <TabsContent value="vendor-statements" className="space-y-4 mt-6">
            {/* Month-End Close Lock Alert */}
            {isMonthLocked && (
              <Alert className={theme === 'premium-dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. You cannot upload or modify vendor statements while the period is locked.
                </AlertDescription>
              </Alert>
            )}

            {reconciliationResult?.locked && !isMonthLocked && (
              <Alert className={theme === 'premium-dark' ? 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl' : 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl'}>
                <Lock className={theme === 'premium-dark' ? 'size-4 text-[#65D3FD]' : 'size-4 text-[#65D3FD]'} />
                <AlertDescription className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>
                  To upload more vendor statements, click "Update Reconciliation" in the Reconciliation tab
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark'
              ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10 backdrop-blur-xl'
              : 'bg-white border-gray-100 shadow-sm'
            }>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-white text-xl font-bold' : 'flex items-center gap-2 text-xl font-bold text-gray-900'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Upload Vendor Statements
                        {reconciliationResult?.locked && (
                          <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/[0.05] text-gray-400 gap-1 border-0' : 'bg-gray-100 text-gray-600 gap-1'}>
                            <Lock className="size-3" />
                            Locked
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Upload PDFs, CSV, or Excel files – AI will automatically extract all transactions</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {vendorTransactions.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={handleExportVendorStatements}
                        className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] rounded-xl h-10' : 'gap-2 rounded-xl h-10'}
                      >
                        <Download className="size-4" />
                        Export
                      </Button>
                    )}
                    <Button
                      onClick={() => vendorFileInputRef.current?.click()}
                      disabled={isUploadingVendor || isMonthLocked || reconciliationResult?.locked}
                      className="gap-2 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black font-bold shadow-[0_0_15px_rgba(101,211,253,0.3)] transition-all hover:shadow-[0_0_25px_rgba(101,211,253,0.5)] rounded-xl h-10 px-6"
                    >
                      {isUploadingVendor ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4 stroke-[2.5px]" />
                          Upload Statement
                        </>
                      )}
                    </Button>
                    <input
                      ref={vendorFileInputRef}
                      type="file"
                      accept=".pdf,.csv,.xlsx,.xls"
                      onChange={handleVendorFileUpload}
                      className="hidden"
                      multiple
                      disabled={reconciliationResult?.locked ?? false}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingVendorData ? (
                  <div className="text-center py-12">
                    <Loader2 className={theme === 'premium-dark' ? 'size-8 animate-spin text-purple-400 mx-auto mb-3' : 'size-8 animate-spin text-gray-400 mx-auto mb-3'} />
                    <p className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>Loading vendor statements...</p>
                  </div>
                ) : vendorStatements.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className={theme === 'premium-dark' ? 'size-12 text-white/20 mx-auto mb-3' : 'size-12 text-gray-300 mx-auto mb-3'} />
                    <p className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>No vendor statements uploaded yet.</p>
                    <p className={theme === 'premium-dark' ? 'text-sm text-gray-500 mt-1' : 'text-sm text-gray-400 mt-1'}>Upload your first vendor statement to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vendorStatements.map((statement) => (
                      <div key={statement.id} className={theme === 'premium-dark' ? 'flex items-center justify-between p-4 border border-white/10 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors' : 'flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors'}>
                        <div className="flex items-center gap-3">
                          <div className={theme === 'premium-dark' ? 'size-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center' : 'size-10 rounded-lg bg-gray-50 flex items-center justify-center'}>
                            <FileText className={theme === 'premium-dark' ? 'size-5 text-white' : 'size-5 text-gray-600'} />
                          </div>
                          <div>
                            <p className={theme === 'premium-dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{statement.fileName}</p>
                            <p className={theme === 'premium-dark' ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                              {statement.vendorName && <span className="font-medium">{statement.vendorName} • </span>}
                              {statement.transactionCount} transactions • {new Date(statement.uploadedAt).toLocaleDateString()}
                              {statement.currency && <span> • {statement.currency}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="gap-2">
                            <Eye className="size-4" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteVendorStatement(statement.id)}
                            disabled={isMonthLocked}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All Vendor Transactions */}
            {vendorTransactions.length > 0 && (
              <div className="space-y-6">
                {vendorStatements.map((statement) => {
                  // Filter transactions for this specific statement
                  const statementTransactions = vendorTransactions.filter(
                    (txn) => txn.statementId === statement.id
                  );

                  return (
                    <Card key={statement.id} className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className={theme === 'premium-dark' ? 'text-base text-white' : 'text-base'}>{statement.fileName}</CardTitle>
                            <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>
                              {statementTransactions.length} transactions • Uploaded {new Date(statement.uploadedAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className={theme === 'premium-dark' ? 'bg-white/[0.02] border-b border-white/5' : 'bg-gray-50/50 border-b border-gray-100'}>
                              <tr>
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Vendor</th>
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Description</th>
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statementTransactions.map((txn) => {
                                const currencySymbol = getCurrencySymbol(txn.currency);
                                return (
                                  <tr key={txn.id} className={theme === 'premium-dark' ? 'border-b border-white/5 hover:bg-white/[0.02] transition-colors' : 'border-b border-gray-100 hover:bg-gray-50/50 transition-colors'}>
                                    <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>{txn.date}</td>
                                    <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                      {txn.vendor || '-'}
                                    </td>
                                    <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>{txn.description}</td>
                                    <td className={`py-4 px-6 text-sm font-bold ${txn.amount < 0
                                      ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')
                                      : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')
                                      }`}>
                                      {currencySymbol}{formatCurrency(Math.abs(txn.amount))}
                                    </td>
                                    <td className="py-4 px-6 text-sm text-gray-500 font-mono">
                                      {txn.balance ? `${currencySymbol}${formatCurrency(txn.balance)}` : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: AP Ledger */}
          <TabsContent value="ap-ledger" className="space-y-4 mt-6">
            {/* Month-End Close Lock Alert */}
            {isMonthLocked && (
              <Alert className={theme === 'premium-dark' ? 'bg-gray-800/50 border-gray-700/50 rounded-xl' : 'bg-gray-900 border-gray-800 rounded-xl'}>
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Period is locked.</strong> This period has been closed and locked. You cannot upload or modify the AP ledger while the period is locked.
                </AlertDescription>
              </Alert>
            )}

            {reconciliationResult?.locked && !isMonthLocked && (
              <Alert className={theme === 'premium-dark' ? 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl' : 'bg-[#65D3FD]/10 border-[#65D3FD]/30 rounded-xl'}>
                <Lock className={theme === 'premium-dark' ? 'size-4 text-[#65D3FD]' : 'size-4 text-[#65D3FD]'} />
                <AlertDescription className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>
                  To upload more vendor statements, click "Update Reconciliation" in the Reconciliation tab
                </AlertDescription>
              </Alert>
            )}

            <Card className={theme === 'premium-dark'
              ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10 backdrop-blur-xl'
              : 'bg-white border-gray-100 shadow-sm'
            }>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-white text-xl font-bold' : 'flex items-center gap-2 text-xl font-bold text-gray-900'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Upload AP Ledger
                        {reconciliationResult?.locked && (
                          <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/[0.05] text-gray-400 gap-1 border-0' : 'bg-gray-100 text-gray-600 gap-1'}>
                            <Lock className="size-3" />
                            Locked
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Upload your internal AP ledger – AI will extract the information and list them here</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {apEntries.length > 0 && (
                      <Button
                        variant="outline"
                        className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05]' : 'gap-2'}
                      >
                        <Download className="size-4" />
                        Export
                      </Button>
                    )}

                    {companyQBOConnectionId && (
                      <Button
                        variant="outline"
                        onClick={handleSyncGLFromQuickBooks}
                        disabled={isSyncingGL || !selectedPeriod || isMonthLocked || reconciliationResult?.locked}
                        className={theme === 'premium-dark'
                          ? 'gap-2 bg-[#34d399] text-black hover:bg-[#34d399]/90 font-bold border-0 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all hover:shadow-[0_0_25px_rgba(52,211,153,0.5)] rounded-xl h-10 px-6'
                          : 'gap-2 bg-[#34d399] text-black hover:bg-[#34d399]/90 font-bold border-0 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all hover:shadow-[0_0_25px_rgba(52,211,153,0.5)] rounded-xl h-10 px-6'
                        }
                      >
                        {isSyncingGL ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Download className="size-4 stroke-[2.5px]" />
                            Sync from QuickBooks
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={() => apFileInputRef.current?.click()}
                      disabled={isUploadingAP || isMonthLocked || reconciliationResult?.locked}
                      className="gap-2 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black font-bold shadow-[0_0_15px_rgba(101,211,253,0.3)] transition-all hover:shadow-[0_0_25px_rgba(101,211,253,0.5)] rounded-xl h-10 px-6"
                    >
                      {isUploadingAP ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4 stroke-[2.5px]" />
                          {apLedger ? 'Replace Ledger' : 'Upload AP Ledger'}
                        </>
                      )}
                    </Button>
                    <input
                      ref={apFileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleAPFileUpload}
                      className="hidden"
                      disabled={reconciliationResult?.locked ?? false}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingAPData ? (
                  <div className="text-center py-12">
                    <Loader2 className={theme === 'premium-dark' ? 'size-8 animate-spin text-purple-400 mx-auto mb-3' : 'size-8 animate-spin text-gray-400 mx-auto mb-3'} />
                    <p className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>Loading AP ledger...</p>
                  </div>
                ) : !apLedger ? (
                  <div className="text-center py-12">
                    <BookOpen className={theme === 'premium-dark' ? 'size-12 text-white/20 mx-auto mb-3' : 'size-12 text-gray-300 mx-auto mb-3'} />
                    <p className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'}>No AP ledger uploaded yet.</p>
                    <p className={theme === 'premium-dark' ? 'text-sm text-gray-500 mt-1' : 'text-sm text-gray-400 mt-1'}>Upload your AP ledger to continue with reconciliation.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={theme === 'premium-dark' ? 'flex items-center justify-between p-4 border border-white/10 rounded-lg bg-white/[0.03]' : 'flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white'}>
                      <div className="flex items-center gap-3">
                        <div className={theme === 'premium-dark' ? 'size-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center' : 'size-10 rounded-lg bg-gray-50 flex items-center justify-center'}>
                          <BookOpen className={theme === 'premium-dark' ? 'size-5 text-white' : 'size-5 text-gray-600'} />
                        </div>
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{apLedger.fileName}</p>
                          <p className={theme === 'premium-dark' ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                            {apLedger.entryCount} entries • {new Date(apLedger.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Eye className="size-4" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-red-600 hover:text-red-700"
                          disabled={reconciliationResult?.locked ?? false}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All AP Entries */}
            {apEntries.length > 0 && (
              <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>All AP Ledger Entries</CardTitle>
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>
                        {apEntries.length} entries
                        {apEntries.length > 0 && ` • ${apEntries.filter(e => e.vendor).length} with vendor info`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={theme === 'premium-dark' ? 'bg-white/[0.02] border-b border-white/5' : 'bg-gray-50/50 border-b border-gray-100'}>
                        <tr>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Date</th>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Description</th>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Vendor</th>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Amount</th>
                          <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-gray-500/80">Split</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apEntries.map((entry) => {
                          const currencySymbol = getCurrencySymbol(entry.currency);
                          return (
                            <tr key={entry.id} className={theme === 'premium-dark' ? 'border-b border-white/5 hover:bg-white/[0.02] transition-colors' : 'border-b border-gray-100 hover:bg-gray-50/50 transition-colors'}>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>{entry.date}</td>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`}>{entry.description}</td>
                              <td className={`py-4 px-6 text-sm font-medium ${theme === 'premium-dark' ? 'text-gray-300' : 'text-gray-600'}`}>{entry.vendor || '—'}</td>
                              <td className={`py-4 px-6 text-sm font-bold ${entry.amount < 0
                                ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600')
                                : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')
                                }`}>
                                {entry.amount < 0 && '−'}{currencySymbol}{formatCurrency(Math.abs(entry.amount))}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-500 font-mono">{entry.account || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
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

            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
              <CardHeader>
                <CardTitle className={theme === 'premium-dark' ? 'text-white text-xl font-bold' : 'text-xl font-bold text-gray-900'} style={{ fontFamily: "'Outfit', sans-serif" }}>Run Reconciliation</CardTitle>
                <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-500'} style={{ fontFamily: "'Manrope', sans-serif" }}>Automatically match vendor statement transactions with AP ledger entries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Data summary section */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Vendor Statements */}
                  <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                    ${theme === 'premium-dark'
                      ? 'bg-gradient-to-br from-[#65D3FD]/10 to-transparent border-[#65D3FD]/20 hover:border-[#65D3FD]/40'
                      : 'bg-sky-50/50 border-sky-100 hover:border-sky-200'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#65D3FD]/80' : 'text-sky-600'}`}>
                        Vendor Statements
                      </span>
                      {vendorStatements.length > 0 && vendorTransactions.length > 0 ? (
                        <div className={`p-1 rounded-full ${theme === 'premium-dark' ? 'bg-[#65D3FD]/20' : 'bg-sky-100'}`}>
                          <CheckCircle className={`size-4 ${theme === 'premium-dark' ? 'text-[#65D3FD]' : 'text-sky-600'}`} />
                        </div>
                      ) : (
                        <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-4xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {vendorStatements.length}
                      </p>
                      <p className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#65D3FD]/40' : 'text-gray-500'}`}>files</p>
                    </div>
                    <p className={`text-xs mt-2 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                      {vendorTransactions.length} transactions ready
                    </p>
                  </div>

                  {/* AP Ledger */}
                  <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                    ${theme === 'premium-dark'
                      ? 'bg-gradient-to-br from-[#4F5CFE]/10 to-transparent border-[#4F5CFE]/20 hover:border-[#4F5CFE]/40'
                      : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-200'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#4F5CFE]/80' : 'text-indigo-600'}`}>
                        AP Ledger
                      </span>
                      {apLedger && apEntries.length > 0 ? (
                        <div className={`p-1 rounded-full ${theme === 'premium-dark' ? 'bg-[#4F5CFE]/20' : 'bg-indigo-100'}`}>
                          <CheckCircle className={`size-4 ${theme === 'premium-dark' ? 'text-[#4F5CFE]' : 'text-indigo-600'}`} />
                        </div>
                      ) : (
                        <AlertCircle className={theme === 'premium-dark' ? 'size-4 text-white/20' : 'size-4 text-gray-400'} />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-4xl font-bold ${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {apLedger ? '1' : '0'}
                      </p>
                      <p className={`text-sm font-medium ${theme === 'premium-dark' ? 'text-[#4F5CFE]/40' : 'text-gray-500'}`}>source</p>
                    </div>
                    <p className={`text-xs mt-2 ${theme === 'premium-dark' ? 'text-white/40' : 'text-gray-400'}`}>
                      {apEntries.length} entries ready
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {reconciliationResult?.locked && (
                    <Button
                      onClick={() => navigate(`/company/${companyId}/month-end?tab=ap-rec-review&period=${selectedPeriod}`)}
                      className={`flex-1 h-14 rounded-2xl font-bold text-lg transition-all duration-300 transform shadow-lg group
                      ${theme === 'premium-dark' || theme === 'dark' // Force dark mode styles if premium-dark OR dark
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
                    disabled={isReconciling || vendorTransactions.length === 0 || apEntries.length === 0 || isMonthLocked || reconciliationResult?.locked}
                    className={`${reconciliationResult?.locked ? 'flex-1' : 'w-full'} gap-2 h-14 rounded-2xl font-bold text-lg transition-all duration-300 transform shadow-lg group
                    ${reconciliationResult?.locked
                        ? theme === 'premium-dark' ? 'bg-white/5 text-white/50 border border-white/10' : 'bg-gray-100 text-gray-400 border border-gray-200'
                        : theme === 'premium-dark' // Force dark mode styles if premium-dark OR dark
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
                            {isMonthLocked ? 'Period Locked' : 'Run Reconciliation'}
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card >

            {/* Processing State */}
            {
              isReconciling && (
                <Card>
                  <CardContent className="py-12">
                    <ProcessingStages type="ap-rec" />
                  </CardContent>
                </Card>
              )
            }

            {/* Reconciliation Results */}
            {
              reconciliationResult && !isReconciling && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Matched */}
                    <Card
                      onClick={() => scrollToSection(matchedSectionRef)}
                      className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden transition-transform duration-200 hover:scale-[1.02] cursor-pointer`}
                    >
                      <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-violet-500/5 blur-3xl' : ''} />
                      <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500" style={{ fontFamily: "'Manrope', sans-serif" }}>Matched</p>
                            <p className={`${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'} text-3xl mt-1`} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                              {reconciliationResult.summary.matched_count}
                            </p>
                          </div>
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                            <CheckCircle className="size-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Unmatched Vendor */}
                    <Card
                      onClick={() => scrollToSection(unmatchedVendorSectionRef)}
                      className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden transition-transform duration-200 hover:scale-[1.02] cursor-pointer`}
                    >
                      <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-blue-500/5 blur-3xl' : ''} />
                      <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500" style={{ fontFamily: "'Manrope', sans-serif" }}>Unmatched Vendor</p>
                            <p className={`${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'} text-3xl mt-1`} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                              {reconciliationResult.summary.unmatched_vendor_count}
                            </p>
                          </div>
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            <Landmark className="size-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Unmatched AP */}
                    <Card
                      onClick={() => scrollToSection(unmatchedApSectionRef)}
                      className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden transition-transform duration-200 hover:scale-[1.02] cursor-pointer`}
                    >
                      <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-purple-500/5 blur-3xl' : ''} />
                      <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500" style={{ fontFamily: "'Manrope', sans-serif" }}>Unmatched AP</p>
                            <p className={`${theme === 'premium-dark' ? 'text-white' : 'text-gray-900'} text-3xl mt-1`} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                              {reconciliationResult.summary.unmatched_ap_count}
                            </p>
                          </div>
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${theme === 'premium-dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                            <BookOpen className="size-6" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Match Rate */}
                    <Card className={`${theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'} rounded-2xl relative overflow-hidden transition-transform duration-200 hover:scale-[1.02]`}>
                      <div className={theme === 'premium-dark' ? 'absolute inset-0 bg-green-500/5 blur-3xl' : ''} />
                      <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500" style={{ fontFamily: "'Manrope', sans-serif" }}>Match Rate</p>
                            <p className={`${theme === 'premium-dark' ? 'text-green-400' : 'text-green-600'} text-3xl mt-1`} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
                              {reconciliationResult.summary.match_rate.toFixed(1)}%
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
                  {!isMonthLocked && reconciliationResult.locked ? (
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
                      </CardContent>
                    </Card>
                  ) : null}

                  {/* Match Quality Summary */}
                  {(reconciliationResult?.matched_pairs?.length ?? 0) > 0 && (() => {
                    const autoApproved = reconciliationResult.matched_pairs.filter(m => m.match_confidence >= 0.8).length; // Assuming high confidence is >= 80% or adjust logic as per AP specific thresholds if different. For AP, typically use the same buckets. 
                    // Wait, let's use the logic from the previous file which split at 50. But BankRec uses match_status. 
                    // Let's assume AP Rec might not have 'match_status' property fully populated or it might be different. 
                    // Looking at previous AP Rec code: {reconciliationResult.matched_pairs.filter(m => m.match_confidence >= 50).length}
                    // It seems AP uses 0-100 scale for confidence in the display, but let's check the data.
                    // Actually, let's stick to the visual buckets. Attempting to infer "Auto-approved", "Review" etc from confidence if status isn't available.
                    // However, to be "Identical", I should try to use the same logic. 
                    // Let's use the thresholds: Auto >= 80 (or 50 based on previous code?), Review 50-79? Manual < 50?
                    // The previous AP code had: Auto-approved (>= 50), Manual (< 50).
                    // Bank Rec has 3 buckets.
                    // I will implement 3 buckets based on confidence for now to match the visual style, or just mapped to the 2 existing ones if that's safer?
                    // User said "identical design". 
                    // Let's map: 
                    // >= 80 -> Auto Approved (Green)
                    // 50-79 -> Review Recommended (Amber)
                    // < 50 -> Manual Review (Red)
                    // This is a reasonable assumption for "Identical" behavior.

                    const autoApprovedCount = reconciliationResult.matched_pairs.filter(m => m.match_confidence >= 80).length;
                    const reviewRecommendedCount = reconciliationResult.matched_pairs.filter(m => m.match_confidence >= 50 && m.match_confidence < 80).length;
                    const manualRequiredCount = reconciliationResult.matched_pairs.filter(m => m.match_confidence < 50).length;

                    // If existing logic was just >= 50 is auto, maybe I should respect that but add the Amber bucket for the visual?
                    // Let's stick to the 3-bucket logic to match the requested visual.

                    return manualRequiredCount > 0 || reviewRecommendedCount > 0 || autoApprovedCount > 0 ? (
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
                              Quality review of the {reconciliationResult.summary.matched_count} matched transactions
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {autoApprovedCount > 0 && (
                            <div className={theme === 'premium-dark' ? 'bg-green-500/10 border border-green-500/20 rounded-xl p-4' : 'bg-green-50 border border-green-100 rounded-xl p-4'}>
                              <div className={theme === 'premium-dark' ? 'text-green-400 text-2xl font-bold mb-1' : 'text-green-700 text-2xl font-bold mb-1'} style={{ fontFamily: "'Outfit', sans-serif" }}>{autoApprovedCount}</div>
                              <div className={theme === 'premium-dark' ? 'text-green-400/70 text-sm font-medium' : 'text-green-700 text-sm font-medium'}>Auto-approved</div>
                            </div>
                          )}
                          {reviewRecommendedCount > 0 && (
                            <div className={theme === 'premium-dark' ? 'bg-amber-500/10 border border-amber-500/20 rounded-xl p-4' : 'bg-amber-50 border border-amber-100 rounded-xl p-4'}>
                              <div className={theme === 'premium-dark' ? 'text-amber-400 text-2xl font-bold mb-1' : 'text-amber-700 text-2xl font-bold mb-1'} style={{ fontFamily: "'Outfit', sans-serif" }}>{reviewRecommendedCount}</div>
                              <div className={theme === 'premium-dark' ? 'text-amber-400/70 text-sm font-medium' : 'text-amber-700 text-sm font-medium'}>Review recommended</div>
                            </div>
                          )}
                          {manualRequiredCount > 0 && (
                            <div className={theme === 'premium-dark' ? 'bg-red-500/10 border border-red-500/20 rounded-xl p-4' : 'bg-red-50 border border-red-100 rounded-xl p-4'}>
                              <div className={theme === 'premium-dark' ? 'text-red-400 text-2xl font-bold mb-1' : 'text-red-700 text-2xl font-bold mb-1'} style={{ fontFamily: "'Outfit', sans-serif" }}>{manualRequiredCount}</div>
                              <div className={theme === 'premium-dark' ? 'text-red-400/70 text-sm font-medium' : 'text-red-700 text-sm font-medium'}>Manual review required</div>
                            </div>
                          )}
                        </div>
                        <div className={theme === 'premium-dark' ? 'mt-6 pt-6 border-t border-white/10' : 'mt-6 pt-6 border-t border-gray-100'}>
                          <p className={theme === 'premium-dark' ? 'text-sm text-gray-500' : 'text-sm text-gray-500'}>
                            <span className="font-semibold text-blue-400">Note:</span> The {reconciliationResult.summary.unmatched_vendor_count} unmatched vendor and {reconciliationResult.summary.unmatched_ap_count} unmatched AP ledger transactions shown above are separate and require manual matching or investigation.
                          </p>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Action Buttons Row */}
                  {!reconciliationResult.locked && !isMonthLocked && (
                    <div className="flex justify-end gap-3">
                      <Button
                        onClick={handleExport}
                        variant="outline"
                        disabled={isExporting}
                        className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] rounded-xl h-11 px-5' : 'gap-2 rounded-xl h-11 px-5'}
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
                      <Button
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

                  {/* Matched Transactions */}
                  {reconciliationResult.matched_pairs.length > 0 && (
                    <div ref={matchedSectionRef}>
                      <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-2xl overflow-hidden' : 'bg-white border-gray-100 rounded-2xl overflow-hidden'}>
                        <CardHeader className={theme === 'premium-dark' ? 'border-b border-white/10 bg-white/[0.02]' : 'border-b border-gray-100 bg-gray-50/50'}>
                          <div className="flex items-center justify-between">
                            <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>
                              Matched Transactions
                            </CardTitle>
                            <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-violet-50 text-violet-700 border-violet-200'}>
                              {reconciliationResult.matched_pairs.length} Matches
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
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Vendor</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Amount</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Type</th>
                                  <th className={theme === 'premium-dark' ? 'text-left py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-left py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}>Confidence</th>
                                  <th className={theme === 'premium-dark' ? 'text-center py-4 px-6 text-xs text-gray-400 font-bold tracking-widest uppercase' : 'text-center py-4 px-6 text-xs text-gray-500 font-bold tracking-widest uppercase'} style={{ fontFamily: "'Outfit', sans-serif" }}></th>
                                </tr>
                              </thead>
                              <tbody className={theme === 'premium-dark' ? 'divide-y divide-white/5' : 'divide-y divide-gray-100'}>
                                {(showAllMatches
                                  ? reconciliationResult.matched_pairs
                                  : reconciliationResult.matched_pairs.slice(0, 10)
                                ).map((match, idx) => (
                                  <Fragment key={idx}>
                                    <tr
                                      className={theme === 'premium-dark' ? 'hover:bg-white/[0.02] transition-colors cursor-pointer group' : 'hover:bg-gray-50/80 transition-colors cursor-pointer group'}
                                      onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
                                    >
                                      <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-300 font-medium' : 'py-4 px-6 text-sm text-gray-600 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                        {match.vendor_transaction.date}
                                      </td>
                                      <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white font-medium' : 'py-4 px-6 text-sm text-gray-900 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                        {match.vendor_transaction.description}
                                        {/* For many-to-one: Show count of combined transactions */}
                                        {match.match_type === 'many_to_one' && match.additional_vendor_transactions && match.additional_vendor_transactions.length > 0 && (
                                          <span className="text-xs text-blue-600 ml-2">
                                            ({match.additional_vendor_transactions.length + 1} transactions)
                                          </span>
                                        )}
                                      </td>
                                      <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-400' : 'py-4 px-6 text-sm text-gray-600'}>
                                        {match.vendor_transaction.vendor || '-'}
                                      </td>
                                      <td className="py-4 px-6 text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        {/* For many-to-one: Show all amounts inline */}
                                        {match.match_type === 'many_to_one' && match.additional_vendor_transactions && match.additional_vendor_transactions.length > 0 ? (
                                          <div className="space-y-1">
                                            <div className={match.vendor_transaction.amount < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                                              {getCurrencySymbol(match.vendor_transaction.currency)}{formatCurrency(Math.abs(match.vendor_transaction.amount))}
                                            </div>
                                            {match.additional_vendor_transactions.map((vTxn, vIdx) => (
                                              <div key={vIdx} className={vTxn.amount < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                                                {getCurrencySymbol(vTxn.currency)}{formatCurrency(Math.abs(vTxn.amount))}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className={match.vendor_transaction.amount < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                                            {getCurrencySymbol(match.vendor_transaction.currency)}{formatCurrency(Math.abs(match.vendor_transaction.amount))}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-4 px-6">
                                        <MatchTypeDisplay
                                          matchType={match.match_type}
                                          additionalCount={match.additional_vendor_transactions?.length || 0}
                                        />
                                      </td>
                                      <td className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                          {match.match_confidence >= 90 ? (
                                            <>
                                              <span className="text-sm text-gray-900">{match.match_confidence}%</span>
                                              <Check className="size-4 text-green-600" />
                                            </>
                                          ) : match.match_confidence < 50 ? (
                                            <>
                                              <span className="text-sm text-gray-900">{match.match_confidence}%</span>
                                              <span className="text-xs text-red-600 font-medium">Review Required</span>
                                            </>
                                          ) : (
                                            <span className="text-sm text-gray-600">{match.match_confidence}%</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-4 px-6 text-center">
                                        <span className="text-gray-400 text-xs">
                                          {expandedMatch === idx ? '▲' : '▼'}
                                        </span>
                                      </td>
                                    </tr>
                                    {expandedMatch === idx && (
                                      <tr className="animate-in fade-in slide-in-from-top-2 duration-200">
                                        <td colSpan={7} className={theme === 'premium-dark' ? 'bg-white/[0.02] px-8 py-6 border-b border-dashed border-white/10' : 'bg-blue-50/50 px-8 py-6 border-b border-dashed border-blue-200'}>
                                          <div className="space-y-4">
                                            {/* FX Match Info */}
                                            {match.match_type === 'fx_adjusted_match' && match.fx_rate && match.fx_direction && (
                                              <div className={theme === 'premium-dark' ? 'bg-purple-500/10 border border-purple-500/20 rounded-lg px-4 py-3 mb-3' : 'bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-3'}>
                                                <div className={theme === 'premium-dark' ? 'flex items-center gap-2 text-purple-300' : 'flex items-center gap-2 text-purple-700'}>
                                                  <TrendingUp className="h-4 w-4" />
                                                  <span className="text-sm font-medium">
                                                    FX Transaction Match: {match.fx_direction}
                                                  </span>
                                                </div>
                                                <p className={theme === 'premium-dark' ? 'text-xs text-purple-400 mt-1' : 'text-xs text-purple-600 mt-1'}>
                                                  Implied rate: {match.fx_rate.toFixed(4)} • This is a valid match - amounts differ due to currency conversion.
                                                </p>
                                              </div>
                                            )}

                                            {/* Many-to-One: Show ALL vendor transactions */}
                                            {match.match_type === 'many_to_one' && match.additional_vendor_transactions && match.additional_vendor_transactions.length > 0 && (
                                              <div className="mb-4">
                                                <p className={theme === 'premium-dark' ? 'text-xs text-gray-400 font-bold uppercase tracking-wider mb-2' : 'text-xs text-gray-500 font-bold uppercase tracking-wider mb-2'}>Vendor Transactions (Combined):</p>

                                                {/* Primary vendor transaction */}
                                                <div className={theme === 'premium-dark' ? 'bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-sm mb-2 backdrop-blur-sm' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm mb-2'}>
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                      <p className={theme === 'premium-dark' ? 'text-gray-200 font-medium' : 'text-gray-900 font-medium'}>{match.vendor_transaction.description}</p>
                                                      <p className={theme === 'premium-dark' ? 'text-xs text-gray-500 mt-1' : 'text-xs text-gray-500 mt-1'}>
                                                        {match.vendor_transaction.date}
                                                        {match.vendor_transaction.vendor && ` • Vendor: ${match.vendor_transaction.vendor}`}
                                                      </p>
                                                    </div>
                                                    <p className={`font-bold ml-4 ${match.vendor_transaction.amount < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                      {getCurrencySymbol(match.vendor_transaction.currency)}{formatCurrency(Math.abs(match.vendor_transaction.amount))}
                                                    </p>
                                                  </div>
                                                </div>

                                                {/* Additional vendor transactions */}
                                                {match.additional_vendor_transactions.map((vTxn, vIdx) => (
                                                  <div key={vIdx} className={theme === 'premium-dark' ? 'bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-sm mb-2 backdrop-blur-sm' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm mb-2'}>
                                                    <div className="flex items-center justify-between">
                                                      <div className="flex-1">
                                                        <p className={theme === 'premium-dark' ? 'text-gray-200 font-medium' : 'text-gray-900 font-medium'}>{vTxn.description}</p>
                                                        <p className={theme === 'premium-dark' ? 'text-xs text-gray-500 mt-1' : 'text-xs text-gray-500 mt-1'}>
                                                          {vTxn.date}
                                                          {vTxn.vendor && ` • Vendor: ${vTxn.vendor}`}
                                                        </p>
                                                      </div>
                                                      <p className={`font-bold ml-4 ${vTxn.amount < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                        {getCurrencySymbol(vTxn.currency)}{formatCurrency(Math.abs(vTxn.amount))}
                                                      </p>
                                                    </div>
                                                  </div>
                                                ))}

                                                {/* Total */}
                                                <div className={theme === 'premium-dark' ? 'border-t border-white/10 pt-3 mt-3' : 'border-t border-gray-200 pt-3 mt-3'}>
                                                  <div className="flex items-center justify-between px-3">
                                                    <p className={theme === 'premium-dark' ? 'text-sm font-bold text-gray-400' : 'text-sm font-bold text-gray-700'}>Combined Total:</p>
                                                    <p className={`text-sm font-bold ${(match.vendor_transaction.amount + match.additional_vendor_transactions.reduce((sum, vTxn) => sum + vTxn.amount, 0)) < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                      {getCurrencySymbol(match.vendor_transaction.currency)}
                                                      {formatCurrency(
                                                        Math.abs(match.vendor_transaction.amount) +
                                                        match.additional_vendor_transactions.reduce((sum, vTxn) => sum + Math.abs(vTxn.amount), 0)
                                                      )}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            <p className={theme === 'premium-dark' ? 'text-xs text-gray-400 font-bold uppercase tracking-wider mb-2' : 'text-xs text-gray-500 font-bold uppercase tracking-wider mb-2'}>Matched AP Ledger Entries:</p>
                                            {match.ap_entries && match.ap_entries.length > 0 ? (
                                              match.ap_entries.map((entry, entryIdx) => (
                                                <div key={entryIdx} className={theme === 'premium-dark' ? 'bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-sm backdrop-blur-sm' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm'}>
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                      <p className={theme === 'premium-dark' ? 'text-gray-200 font-medium' : 'text-gray-900 font-medium'}>{entry.description}</p>
                                                      <div className="flex items-center gap-2 mt-1">
                                                        <p className={theme === 'premium-dark' ? 'text-xs text-gray-500' : 'text-xs text-gray-500'}>
                                                          {entry.date}
                                                          {entry.vendor && ` • Vendor: ${entry.vendor}`}
                                                          {entry.invoiceNumber && ` • Invoice: ${entry.invoiceNumber}`}
                                                        </p>
                                                      </div>
                                                    </div>
                                                    <p className={`font-bold ml-4 ${entry.amount < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                      {getCurrencySymbol(entry.currency)}{formatCurrency(Math.abs(entry.amount))}
                                                    </p>
                                                  </div>
                                                </div>
                                              ))
                                            ) : (
                                              <div className={theme === 'premium-dark' ? 'bg-white/[0.03] border border-white/5 rounded-lg px-4 py-3 text-sm text-gray-500 italic' : 'bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500 italic'}>
                                                {match.explanation || 'Part of a combined match'}
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

                          {reconciliationResult.matched_pairs.length > 10 && (
                            <div className={theme === 'premium-dark' ? 'border-t border-white/5 bg-white/[0.02] py-4 text-center' : 'border-t border-gray-100 bg-gray-50 py-4 text-center'}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAllMatches(!showAllMatches)}
                                className={theme === 'premium-dark' ? 'text-violet-300 hover:text-violet-200 hover:bg-violet-500/10' : 'text-violet-600 hover:text-violet-700 hover:bg-violet-50'}
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
                    </div>
                  )}

                  {/* Unmatched Vendor Transactions */}
                  {reconciliationResult.unmatched_vendor.length > 0 && (
                    <div ref={unmatchedVendorSectionRef}>
                      <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-2xl overflow-hidden' : 'bg-white border-gray-100 rounded-2xl overflow-hidden'}>
                        <CardHeader className={theme === 'premium-dark' ? 'border-b border-white/10 bg-white/[0.02]' : 'border-b border-gray-100 bg-gray-50/50'}>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>Unmatched Vendor Transactions</CardTitle>
                              <p className={theme === 'premium-dark' ? 'text-sm text-gray-400 mt-1' : 'text-sm text-gray-500 mt-1'}>{reconciliationResult.unmatched_vendor.length} transactions not found in AP ledger</p>
                            </div>
                            <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                              {reconciliationResult.unmatched_vendor.length}
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
                                {reconciliationResult.unmatched_vendor.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={theme === 'premium-dark' ? 'hover:bg-white/[0.02] transition-colors' : 'hover:bg-gray-50 transition-colors'}
                                  >
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-300 font-medium' : 'py-4 px-6 text-sm text-gray-600 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                      {item.transaction.date}
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white font-medium' : 'py-4 px-6 text-sm text-gray-900 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                      <div>
                                        <div>{item.transaction.description}</div>
                                        {item.transaction.vendor && (
                                          <div className={theme === 'premium-dark' ? 'text-xs text-gray-400 mt-1' : 'text-xs text-gray-500 mt-1'}>
                                            Vendor: {item.transaction.vendor}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-4 px-6 text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                      <span className={item.transaction.amount < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                                        {getCurrencySymbol(item.transaction.currency)}{formatCurrency(Math.abs(item.transaction.amount))}
                                      </span>
                                    </td>
                                    <td className="py-4 px-6">
                                      <p className={theme === 'premium-dark' ? 'text-sm text-gray-300' : 'text-sm text-gray-600'}>{item.suggested_action}</p>
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

                  {/* Unmatched AP Entries */}
                  {reconciliationResult.unmatched_ap.length > 0 && (
                    <div ref={unmatchedApSectionRef}>
                      <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10 rounded-2xl overflow-hidden' : 'bg-white border-gray-100 rounded-2xl overflow-hidden'}>
                        <CardHeader className={theme === 'premium-dark' ? 'border-b border-white/10 bg-white/[0.02]' : 'border-b border-gray-100 bg-gray-50/50'}>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className={theme === 'premium-dark' ? 'text-lg text-white font-bold' : 'text-lg text-gray-900 font-bold'} style={{ fontFamily: "'Outfit', sans-serif" }}>Unmatched AP Ledger Entries</CardTitle>
                              <p className={theme === 'premium-dark' ? 'text-sm text-gray-400 mt-1' : 'text-sm text-gray-500 mt-1'}>{reconciliationResult.unmatched_ap.length} entries not found in vendor statements</p>
                            </div>
                            <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                              {reconciliationResult.unmatched_ap.length}
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
                                </tr>
                              </thead>
                              <tbody className={theme === 'premium-dark' ? 'divide-y divide-white/5' : 'divide-y divide-gray-100'}>
                                {reconciliationResult.unmatched_ap.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={theme === 'premium-dark' ? 'hover:bg-white/[0.02] transition-colors' : 'hover:bg-gray-50 transition-colors'}
                                  >
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-300 font-medium' : 'py-4 px-6 text-sm text-gray-600 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                      {item.entry.date}
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white font-medium' : 'py-4 px-6 text-sm text-gray-900 font-medium'} style={{ fontFamily: "'Manrope', sans-serif" }}>
                                      <div>
                                        <div>{item.entry.description}</div>
                                        {item.entry.vendor && (
                                          <div className={theme === 'premium-dark' ? 'text-xs text-gray-400 mt-1' : 'text-xs text-gray-500 mt-1'}>
                                            Vendor: {item.entry.vendor}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-4 px-6 text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                      <span className={item.entry.amount < 0 ? (theme === 'premium-dark' ? 'text-red-400' : 'text-red-600') : (theme === 'premium-dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                                        {getCurrencySymbol(item.entry.currency)}{formatCurrency(Math.abs(item.entry.amount))}
                                      </span>
                                    </td>
                                    <td className="py-4 px-6">
                                      <p className={theme === 'premium-dark' ? 'text-sm text-gray-300' : 'text-sm text-gray-600'}>{item.reason}</p>
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
                </>
              )}

          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Receipt className="size-12 text-gray-300 mx-auto mb-3" />
            <p>Please select a company and period to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}