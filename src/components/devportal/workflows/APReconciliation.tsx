import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft, TrendingUp, Clock, ChevronRight, Building, Calendar, Trash2, PlayCircle, FileSpreadsheet, BookOpen, GitCompare, Eye, Lock, Unlock, AlertTriangle, Users } from 'lucide-react';
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

interface VendorTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  statementId: string;
  statementName: string;
  invoiceNumber?: string;
  vendor?: string;
}

interface VendorStatement {
  id: string;
  fileName: string;
  uploadedAt: number;
  transactionCount: number;
  fileUrl?: string;
  filePath?: string;
  vendor?: string;
}

interface APLedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
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

export function APReconciliation() {
  const { theme } = useTheme();
  
  // Company and Period Selection
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  
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
      loadVendorData();
      loadAPData();
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
  
  // Load vendor statements and transactions
  const loadVendorData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      setIsLoadingVendorData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/vendor-statements?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
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
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      setIsLoadingAPData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/ap-ledger?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
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
      }
    } catch (error) {
      console.error('Error loading AP ledger:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingAPData(false);
      }
    }
  };
  
  // Load reconciliation data
  const loadReconciliationData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      console.log('📂 Loading reconciliation data for', selectedCompanyId, selectedPeriod);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-reconciliation?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded reconciliation data:', data);
        if (isMountedRef.current && data.reconciliation) {
          setReconciliationResult(data.reconciliation);
          console.log('✅ Set reconciliation result with', data.reconciliation.matched_pairs?.length || 0, 'matches');
        } else {
          console.log('ℹ️ No reconciliation data found');
        }
      } else {
        console.log('⚠️ Response not OK:', response.status);
      }
    } catch (error) {
      console.error('Error loading reconciliation:', error);
    }
  };
  
  // Handle vendor statement upload
  const handleVendorFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedCompanyId || !selectedPeriod) return;
    
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
          formData.append('companyId', selectedCompanyId);
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
    if (!file || !selectedCompanyId || !selectedPeriod) return;
    
    setIsUploadingAP(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', selectedCompanyId);
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
        toast.success(`✅ Uploaded ${data.entryCount} entries from AP ledger`);
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
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/vendor-statement/${statementId}?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
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
    if (!selectedCompanyId || !selectedPeriod) return;
    
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
            companyId: selectedCompanyId,
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
      toast.success('AP Reconciliation unlocked. You can now update it.');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to unlock reconciliation';
      toast.error(errorMessage);
      console.error('Unlock reconciliation error:', err);
    } finally {
      setIsLockingReconciliation(false);
    }
  };
  
  // Export reconciliation results
  const handleExport = async () => {
    if (!reconciliationResult || !selectedCompanyId || !selectedPeriod) return;
    
    setIsExporting(true);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/export-ap-reconciliation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompanyId,
            period: selectedPeriod,
            result: reconciliationResult,
          }),
        }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const company = companies.find(c => c.id === selectedCompanyId);
        const fileName = `AP_Reconciliation_${company?.name || 'Company'}_${selectedPeriod}.xlsx`;
        a.download = fileName;
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Reconciliation exported successfully');
      } else {
        toast.error('Failed to export reconciliation');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export reconciliation');
    } finally {
      setIsExporting(false);
    }
  };
  
  // Export vendor statements
  const handleExportVendorStatements = async () => {
    if (!selectedCompanyId || !selectedPeriod || vendorTransactions.length === 0) return;
    
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
            companyId: selectedCompanyId,
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
        
        const company = companies.find(c => c.id === selectedCompanyId);
        const fileName = `Vendor_Statements_${company?.name || 'Company'}_${selectedPeriod}.xlsx`;
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
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Header - Ultra Minimal */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={theme === 'premium-dark' ? 'text-4xl tracking-tight text-white' : 'text-4xl tracking-tight text-gray-900'}>AP Reconciliation</h1>
          <p className={theme === 'premium-dark' ? 'text-purple-300/40 text-sm mt-2' : 'text-gray-400 text-sm mt-2'}>
            Match vendor statements with AP ledger entries using AI
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
            <TabsTrigger value="vendor-statements" className="gap-2 py-3">
              <FileText className="size-4" />
              Vendor Statements
            </TabsTrigger>
            <TabsTrigger value="ap-ledger" className="gap-2 py-3">
              <BookOpen className="size-4" />
              AP Ledger
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2 py-3">
              <GitCompare className="size-4" />
              Reconciliation
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Vendor Statements */}
          <TabsContent value="vendor-statements" className="space-y-6">
            {/* Locked Status Alert */}
            {(isMonthLocked || reconciliationResult?.locked) && (
              <Alert className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10' : 'bg-gray-50 border-gray-200'}>
                <Lock className={theme === 'premium-dark' ? 'size-4 text-white' : 'size-4 text-gray-600'} />
                <AlertDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-700'}>
                  Uploads are locked for {selectedPeriod}. Unlock the reconciliation to upload more vendor statements.
                </AlertDescription>
              </Alert>
            )}
            
            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-white' : 'flex items-center gap-2'}>
                        Upload Vendor Statements
                        {reconciliationResult?.locked && (
                          <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/[0.05] text-gray-400 gap-1 border-0' : 'bg-gray-100 text-gray-600 gap-1'}>
                            <Lock className="size-3" />
                            Locked
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>Upload PDFs, CSV, or Excel files – AI will automatically extract all transactions</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {vendorTransactions.length > 0 && (
                      <Button 
                        variant="outline" 
                        onClick={handleExportVendorStatements}
                        className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05]' : 'gap-2'}
                      >
                        <Download className="size-4" />
                        Export
                      </Button>
                    )}
                    <Button 
                      onClick={() => vendorFileInputRef.current?.click()}
                      disabled={isUploadingVendor || isMonthLocked || reconciliationResult?.locked}
                      className={theme === 'premium-dark' ? 'gap-2 bg-white text-black hover:bg-white/90 rounded-full' : 'gap-2 bg-black text-white hover:bg-gray-900 rounded-full'}
                    >
                      {isUploadingVendor ? (
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
                              {statement.transactionCount} transactions • {new Date(statement.uploadedAt).toLocaleDateString()}
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
                            <thead className={theme === 'premium-dark' ? 'bg-white/[0.02] border-b border-white/5' : 'bg-gray-50 border-b'}>
                              <tr>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Date</th>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Description</th>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Amount</th>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statementTransactions.map((txn) => (
                                <tr key={txn.id} className={theme === 'premium-dark' ? 'border-b border-white/5 hover:bg-white/[0.02]' : 'border-b hover:bg-gray-50'}>
                                  <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-gray-400' : 'py-3 px-6 text-sm text-gray-600'}>{txn.date}</td>
                                  <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-white' : 'py-3 px-6 text-sm text-gray-900'}>{txn.description}</td>
                                  <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm font-medium text-white' : 'py-3 px-6 text-sm font-medium text-gray-900'}>
                                    €{formatCurrency(Math.abs(txn.amount))}
                                  </td>
                                  <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-gray-400' : 'py-3 px-6 text-sm text-gray-600'}>
                                    {txn.balance ? `€${formatCurrency(txn.balance)}` : '-'}
                                  </td>
                                </tr>
                              ))}
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

          {/* Tab 2: AP Ledger */}
          <TabsContent value="ap-ledger" className="space-y-6">
            {/* Locked Status Alert */}
            {(isMonthLocked || reconciliationResult?.locked) && (
              <Alert className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/10' : 'bg-gray-50 border-gray-200'}>
                <Lock className={theme === 'premium-dark' ? 'size-4 text-white' : 'size-4 text-gray-600'} />
                <AlertDescription className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-700'}>
                  Uploads are locked for {selectedPeriod}. Unlock the reconciliation to upload or modify the AP ledger.
                </AlertDescription>
              </Alert>
            )}
            
            <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className={theme === 'premium-dark' ? 'flex items-center gap-2 text-white' : 'flex items-center gap-2'}>
                        Upload AP Ledger
                        {reconciliationResult?.locked && (
                          <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/[0.05] text-gray-400 gap-1 border-0' : 'bg-gray-100 text-gray-600 gap-1'}>
                            <Lock className="size-3" />
                            Locked
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>Upload your internal AP ledger – AI will extract the information and list them here</CardDescription>
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
                    <Button 
                      onClick={() => apFileInputRef.current?.click()}
                      disabled={isUploadingAP || isMonthLocked || reconciliationResult?.locked}
                      className={theme === 'premium-dark' ? 'gap-2 bg-white text-black hover:bg-white/90 rounded-full' : 'gap-2 bg-black text-white hover:bg-gray-900 rounded-full'}
                    >
                      {isUploadingAP ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
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
                      <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>{apEntries.length} entries</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={theme === 'premium-dark' ? 'bg-white/[0.02] border-b border-white/5' : 'bg-gray-50 border-b'}>
                        <tr>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Date</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Description</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Amount</th>
                          <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apEntries.map((entry) => (
                          <tr key={entry.id} className={theme === 'premium-dark' ? 'border-b border-white/5 hover:bg-white/[0.02]' : 'border-b hover:bg-gray-50'}>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-gray-400' : 'py-3 px-6 text-sm text-gray-600'}>{entry.date}</td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-white' : 'py-3 px-6 text-sm text-gray-900'}>{entry.description}</td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm font-medium text-white' : 'py-3 px-6 text-sm font-medium text-gray-900'}>
                              {entry.amount < 0 && '−'}€{formatCurrency(Math.abs(entry.amount))}
                            </td>
                            <td className={theme === 'premium-dark' ? 'py-3 px-6 text-sm text-gray-400' : 'py-3 px-6 text-sm text-gray-500'}>{entry.account || '—'}</td>
                          </tr>
                        ))}
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
                <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>Run Reconciliation</CardTitle>
                <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>Automatically match vendor statement transactions with AP ledger entries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Data summary section */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Vendor Statements */}
                  <div className={theme === 'premium-dark' ? 'p-5 bg-white/[0.02] border border-white/5 rounded-2xl' : 'p-5 bg-gray-50/50 border border-gray-100 rounded-2xl'}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Vendor Statements</span>
                      {vendorStatements.length > 0 && vendorTransactions.length > 0 && (
                        <CheckCircle className={theme === 'premium-dark' ? 'size-4 text-white' : 'size-4 text-gray-600'} />
                      )}
                    </div>
                    <p className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{vendorStatements.length}</p>
                    <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/30 mt-1' : 'text-xs text-gray-400 mt-1'}>{vendorTransactions.length} transactions</p>
                  </div>

                  {/* AP Ledger */}
                  <div className={theme === 'premium-dark' ? 'p-5 bg-white/[0.02] border border-white/5 rounded-2xl' : 'p-5 bg-gray-50/50 border border-gray-100 rounded-2xl'}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>AP Ledger</span>
                      {apLedger && apEntries.length > 0 && (
                        <CheckCircle className={theme === 'premium-dark' ? 'size-4 text-white' : 'size-4 text-gray-600'} />
                      )}
                    </div>
                    <p className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{apLedger ? 1 : 0}</p>
                    <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/30 mt-1' : 'text-xs text-gray-400 mt-1'}>{apEntries.length} entries</p>
                  </div>
                </div>

                {/* Run Reconciliation Button */}
                <Button 
                  onClick={handleRunReconciliation}
                  disabled={isReconciling || vendorTransactions.length === 0 || apEntries.length === 0 || isMonthLocked || reconciliationResult?.locked}
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
                      {reconciliationResult?.locked ? 'Reconciliation Locked' : isMonthLocked ? 'Period Locked' : 'Run Reconciliation'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Processing State */}
            {isReconciling && (
              <Card>
                <CardContent className="py-12">
                  <ProcessingStages type="ap-rec" />
                </CardContent>
              </Card>
            )}

            {/* Reconciliation Results */}
            {reconciliationResult && !isReconciling && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Matched</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1 tracking-tight' : 'text-3xl text-gray-900 mt-1 tracking-tight'}>
                            {reconciliationResult.summary.matched_count}
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
                          <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Unmatched Vendor</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1 tracking-tight' : 'text-3xl text-gray-900 mt-1 tracking-tight'}>
                            {reconciliationResult.summary.unmatched_vendor_count}
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
                          <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Unmatched AP</p>
                          <p className={theme === 'premium-dark' ? 'text-3xl text-white mt-1 tracking-tight' : 'text-3xl text-gray-900 mt-1 tracking-tight'}>
                            {reconciliationResult.summary.unmatched_ap_count}
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

                {/* Reconciliation Details Card with Export */}
                <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className={theme === 'premium-dark' ? 'text-white' : ''}>Reconciliation Details</CardTitle>
                        <CardDescription className={theme === 'premium-dark' ? 'text-gray-400' : ''}>AI-matched vendor transactions with AP ledger entries</CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={handleExport} 
                        disabled={isExporting}
                        className={theme === 'premium-dark' ? 'gap-2 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05]' : 'gap-2'}
                      >
                        {isExporting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <Download className="size-4" />
                            Export
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                  {/* Matched Pairs */}
                  {reconciliationResult.matched_pairs.length > 0 && (
                    <Card className={theme === 'premium-dark' ? 'bg-white/[0.03] border-white/5 rounded-2xl' : 'bg-white border-gray-100 rounded-2xl'}>
                      <CardHeader className={theme === 'premium-dark' ? 'border-b border-white/5' : 'border-b bg-white'}>
                        <div className="flex items-center justify-between">
                          <CardTitle className={theme === 'premium-dark' ? 'text-base text-white' : 'text-base'}>
                            Matched Transactions
                          </CardTitle>
                          <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-white/[0.05] text-white border-0' : 'bg-gray-100 text-gray-600'}>
                            {reconciliationResult.matched_pairs.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className={theme === 'premium-dark' ? 'bg-white/[0.02] border-b border-white/5' : 'bg-gray-50 border-b'}>
                              <tr>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Date</th>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Description</th>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Amount</th>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Type</th>
                                <th className={theme === 'premium-dark' ? 'text-left py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-left py-3 px-6 text-xs text-gray-500 font-medium'}>Confidence</th>
                                <th className={theme === 'premium-dark' ? 'text-center py-3 px-6 text-xs text-purple-300/40 font-medium' : 'text-center py-3 px-6 text-xs text-gray-500 font-medium'}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {(showAllMatches 
                                ? reconciliationResult.matched_pairs 
                                : reconciliationResult.matched_pairs.slice(0, 10)
                              ).map((match, idx) => (
                                <Fragment key={idx}>
                                  <tr 
                                    className={theme === 'premium-dark' ? 'border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors' : 'border-b hover:bg-gray-50 cursor-pointer transition-colors'}
                                    onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
                                  >
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-gray-400' : 'py-4 px-6 text-sm text-gray-600'}>
                                      {match.vendor_transaction.date}
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white' : 'py-4 px-6 text-sm text-gray-900'}>
                                      {match.vendor_transaction.description}
                                    </td>
                                    <td className={theme === 'premium-dark' ? 'py-4 px-6 text-sm text-white font-medium' : 'py-4 px-6 text-sm text-gray-900 font-medium'}>
                                      €{formatCurrency(Math.abs(match.vendor_transaction.amount))}
                                    </td>
                                    <td className="py-4 px-6">
                                      <Badge 
                                        variant="outline" 
                                        className={theme === 'premium-dark' ? 'bg-white/[0.05] text-white border-white/10' : 'bg-gray-50 text-gray-600 border-gray-200'}
                                      >
                                        {match.match_type === 'exact_match' ? 'exact' 
                                          : match.match_type === 'deterministic_multi' ? '1:many'
                                          : match.match_type === 'ai_fuzzy_multi' ? 'AI multi'
                                          : match.match_type === 'ai_fuzzy' ? 'AI'
                                          : match.match_type}
                                      </Badge>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-gray-600">
                                      {match.match_confidence}%
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
                                            {match.ap_entries.map((entry, entryIdx) => (
                                              <div key={entryIdx} className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex-1">
                                                    <p className="text-gray-900">{entry.description}</p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                      {entry.date}
                                                      {entry.vendor && ` • Vendor: ${entry.vendor}`}
                                                      {entry.invoiceNumber && ` • Invoice: ${entry.invoiceNumber}`}
                                                    </p>
                                                  </div>
                                                  <p className="text-gray-900 font-medium ml-4">
                                                    €{formatCurrency(Math.abs(entry.amount))}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
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
                              className="text-sm"
                            >
                              {showAllMatches 
                                ? 'Show Less' 
                                : `Show All ${reconciliationResult.matched_pairs.length} Matches`
                              }
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Unmatched Vendor Transactions */}
                  {reconciliationResult.unmatched_vendor.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-yellow-600">Unmatched Vendor Transactions</CardTitle>
                        <CardDescription>{reconciliationResult.unmatched_vendor.length} transactions not found in AP ledger</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {reconciliationResult.unmatched_vendor.map((item, idx) => (
                            <div key={idx} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <AlertCircle className="size-5 text-yellow-600" />
                                  <div>
                                    <p className="text-sm text-gray-900">{item.transaction.description}</p>
                                    <p className="text-xs text-gray-500">{item.transaction.date}</p>
                                    <p className="text-xs text-blue-600 mt-1">{item.suggested_action}</p>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-900">€{formatCurrency(item.transaction.amount)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Unmatched AP Entries */}
                  {reconciliationResult.unmatched_ap.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-orange-600">Unmatched AP Ledger Entries</CardTitle>
                        <CardDescription>{reconciliationResult.unmatched_ap.length} entries not found in vendor statements</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {reconciliationResult.unmatched_ap.map((item, idx) => (
                            <div key={idx} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <AlertTriangle className="size-5 text-orange-600" />
                                  <div>
                                    <p className="text-sm text-gray-900">{item.entry.description}</p>
                                    <p className="text-xs text-gray-500">{item.entry.date}</p>
                                    <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-900">€{formatCurrency(item.entry.amount)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Users className="size-12 text-gray-300 mx-auto mb-3" />
            <p>Please select a company and period to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}