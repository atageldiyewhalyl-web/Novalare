import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Circle, 
  Building2,
  ChevronDown,
  Calendar,
  ChevronRight,
  AlertCircle,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  XCircle,
  Lock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { companiesApi, Company } from '@/utils/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { BankRecReview } from './BankRecReview';
import { APRecReview } from './APRecReview';
import { CCRecReview } from './CCRecReview';
import { TrialBalanceReview } from './TrialBalanceReview';
import { toast } from 'sonner';

interface MonthEndCloseProps {
  companyId?: string;
  companyName?: string;
}

interface ReconciliationResult {
  unmatched_bank: any[];
  unmatched_ledger: any[];
  summary: {
    matched_count: number;
    unmatched_bank_count: number;
    unmatched_ledger_count: number;
  };
}

export function MonthEndClose({ companyId: initialCompanyId, companyName: initialCompanyName }: MonthEndCloseProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);
  const [showBankRecReview, setShowBankRecReview] = useState(false);
  const [showAPRecReview, setShowAPRecReview] = useState(false);
  const [showCCRecReview, setShowCCRecReview] = useState(false);
  const [showTrialBalanceReview, setShowTrialBalanceReview] = useState(false);

  // AP Reconciliation state
  const [apReconciliationResult, setAPReconciliationResult] = useState<any>(null);
  const [isLoadingAPReconciliation, setIsLoadingAPReconciliation] = useState(false);

  // CC Reconciliation state
  const [ccReconciliationResult, setCCReconciliationResult] = useState<any>(null);
  const [isLoadingCCReconciliation, setIsLoadingCCReconciliation] = useState(false);

  // Trial Balance state
  const [trialBalanceResult, setTrialBalanceResult] = useState<any>(null);
  const [isLoadingTrialBalance, setIsLoadingTrialBalance] = useState(false);
  
  // Trial Balance upload state
  const [isUploadingTrialBalance, setIsUploadingTrialBalance] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Month close/lock state
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  // Load companies list
  useEffect(() => {
    loadCompanies();
    
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

  // Load reconciliation data when company or period changes
  useEffect(() => {
    if (selectedCompany && selectedPeriod) {
      loadLockStatus();
      loadReconciliationData();
      loadAPReconciliationData();
      loadCCReconciliationData();
      loadTrialBalanceData();
    }
  }, [selectedCompany, selectedPeriod]);

  const loadCompanies = async () => {
    try {
      const data = await companiesApi.getAll();
      setCompanies(data || []);
      
      if (initialCompanyId) {
        const company = data.find((c: Company) => c.id === initialCompanyId);
        if (company) {
          setSelectedCompany(company);
        }
      } else if (data.length > 0) {
        setSelectedCompany(data[0]);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadReconciliationData = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingReconciliation(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/reconciliation?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Month-End Close - Reconciliation data loaded:', data);
        setReconciliationResult(data);
      } else if (response.status === 404) {
        // 404 is expected when no reconciliation has been run yet - not an error
        console.log('Month-End Close - No bank reconciliation found for this period (not yet run)');
        setReconciliationResult(null);
      } else {
        const errorText = await response.text();
        console.error('Month-End Close - Failed to load reconciliation:', response.status, errorText);
        setReconciliationResult(null);
      }
    } catch (error) {
      console.error('Month-End Close - Failed to load reconciliation data:', error);
      setReconciliationResult(null);
    } finally {
      setIsLoadingReconciliation(false);
    }
  };

  const loadAPReconciliationData = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingAPReconciliation(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec/reconciliation?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Month-End Close - AP Reconciliation data loaded:', data);
        setAPReconciliationResult(data);
      } else if (response.status === 404) {
        // 404 is expected when no reconciliation has been run yet - not an error
        console.log('Month-End Close - No AP reconciliation found for this period (not yet run)');
        setAPReconciliationResult(null);
      } else {
        const errorText = await response.text();
        console.error('Month-End Close - Failed to load AP reconciliation:', response.status, errorText);
        setAPReconciliationResult(null);
      }
    } catch (error) {
      console.error('Month-End Close - Failed to load AP reconciliation data:', error);
      setAPReconciliationResult(null);
    } finally {
      setIsLoadingAPReconciliation(false);
    }
  };

  const loadCCReconciliationData = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingCCReconciliation(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/cc-rec/reconciliation?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Month-End Close - CC Reconciliation data loaded:', data);
        // Unwrap the reconciliation object from the API response
        setCCReconciliationResult(data.reconciliation || data);
      } else if (response.status === 404) {
        // 404 is expected when no reconciliation has been run yet - not an error
        console.log('Month-End Close - No CC reconciliation found for this period (not yet run)');
        setCCReconciliationResult(null);
      } else {
        const errorText = await response.text();
        console.error('Month-End Close - Failed to load CC reconciliation:', response.status, errorText);
        setCCReconciliationResult(null);
      }
    } catch (error) {
      console.error('Month-End Close - Failed to load CC reconciliation data:', error);
      setCCReconciliationResult(null);
    } finally {
      setIsLoadingCCReconciliation(false);
    }
  };

  const loadTrialBalanceData = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    setIsLoadingTrialBalance(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/trial-balance/get?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Month-End Close - Trial Balance data loaded:', data);
        setTrialBalanceResult(data);
      } else if (response.status === 404) {
        // 404 is expected when no trial balance has been uploaded yet - not an error
        console.log('Month-End Close - No trial balance found for this period (not yet uploaded)');
        setTrialBalanceResult(null);
      } else {
        const errorText = await response.text();
        console.error('Month-End Close - Failed to load trial balance:', response.status, errorText);
        setTrialBalanceResult(null);
      }
    } catch (error) {
      console.error('Month-End Close - Failed to load trial balance data:', error);
      setTrialBalanceResult(null);
    } finally {
      setIsLoadingTrialBalance(false);
    }
  };

  const loadLockStatus = async () => {
    if (!selectedCompany || !selectedPeriod) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/status?companyId=${selectedCompany.id}&period=${selectedPeriod}`,
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
        console.log('Month lock status:', data);
      }
    } catch (error) {
      console.error('Failed to load lock status:', error);
    }
  };

  const handleCloseMonth = async () => {
    setIsClosingMonth(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/month-close/close`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompany.id,
            period: selectedPeriod,
            closedBy: 'current-user', // TODO: Replace with actual user
          }),
        }
      );

      // Read response as text first, then parse
      const responseText = await response.text();
      
      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log('Month close response:', data);
          toast.success('Month closed and locked successfully!');
          setShowCloseConfirmation(false);
          await loadLockStatus(); // Reload lock status
        } catch (parseError) {
          console.error('Error parsing success response:', parseError, responseText);
          toast.error('Unexpected response format from server');
        }
      } else {
        let errorMessage = 'Failed to close month';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use the text as-is
          console.error('Non-JSON error response:', responseText);
          errorMessage = responseText || errorMessage;
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error closing month:', error);
      toast.error(`Failed to close month: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsClosingMonth(false);
    }
  };

  const getStatusBadge = () => {
    if (!reconciliationResult) {
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Not Started</Badge>;
    }
    
    const hasUnmatched = (reconciliationResult.unmatched_bank?.length || 0) > 0 || 
                        (reconciliationResult.unmatched_ledger?.length || 0) > 0;
    
    if (hasUnmatched) {
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">In Progress</Badge>;
    }
    
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Ready to Close</Badge>;
  };

  const bankRecCompleted = reconciliationResult && 
    (reconciliationResult.unmatched_bank?.length || 0) === 0 && 
    (reconciliationResult.unmatched_ledger?.length || 0) === 0;

  const apRecCompleted = apReconciliationResult &&
    (apReconciliationResult.unmatchedVendor?.length || 0) === 0 &&
    (apReconciliationResult.unmatchedAP?.length || 0) === 0;

  const ccRecCompleted = ccReconciliationResult &&
    (ccReconciliationResult.unmatched_cc?.length || 0) === 0 &&
    (ccReconciliationResult.unmatched_ledger?.length || 0) === 0;

  const trialBalanceCompleted = trialBalanceResult && 
    trialBalanceResult.isBalanced && 
    trialBalanceResult.canClose;

  // Handle trial balance file upload
  const handleTrialBalanceFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleTrialBalanceFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCompany || !selectedPeriod) return;

    // Validate file type
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setIsUploadingTrialBalance(true);
    toast.info('Uploading trial balance file...', { duration: 2000 });

    try {
      // Calculate previous period for variance analysis
      const [year, month] = selectedPeriod.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1); // -2 because month is 1-indexed
      const previousPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', selectedCompany.id);
      formData.append('period', selectedPeriod);
      formData.append('previousPeriod', previousPeriod);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/trial-balance/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTrialBalanceResult(data);

        if (data.structuralErrors.length > 0) {
          toast.error(`Trial Balance uploaded but has ${data.structuralErrors.length} critical error(s).`);
        } else if (data.analyticalWarnings.length > 0) {
          toast.warning(`Trial Balance uploaded with ${data.analyticalWarnings.length} warning(s).`);
        } else {
          toast.success('✓ Trial Balance uploaded and validated successfully!');
        }
      } else {
        const errorText = await response.text();
        let errorMessage = 'Failed to upload trial balance';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use the text as-is
          errorMessage = errorText || errorMessage;
        }
        
        toast.error(errorMessage);
        console.error('Upload error:', errorText);
      }
    } catch (error) {
      console.error('Error uploading trial balance:', error);
      toast.error('Failed to upload trial balance. Please try again.');
    } finally {
      setIsUploadingTrialBalance(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadTrialBalanceTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Create sample template
      const templateData = [
        ['Account Name', 'Account Code', 'Debit', 'Credit'],
        ['Cash and Cash Equivalents', '1000', 50000, 0],
        ['Accounts Receivable', '1100', 25000, 0],
        ['Inventory', '1200', 15000, 0],
        ['Accounts Payable', '2000', 0, 18000],
        ['Credit Card Payable', '2100', 0, 3500],
        ['Revenue', '4000', 0, 120000],
        ['Cost of Goods Sold', '5000', 48000, 0],
        ['Salaries Expense', '6000', 30000, 0],
        ['Rent Expense', '6100', 5000, 0],
        ['Utilities Expense', '6200', 2500, 0],
        ['', '', '', ''],
        ['TOTALS', '', '=SUM(C2:C11)', '=SUM(D2:D11)'],
      ];

      const templateSheet = XLSX.utils.aoa_to_sheet(templateData);
      templateSheet['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, templateSheet, 'Trial Balance Template');

      XLSX.writeFile(wb, `TrialBalance_Template.xlsx`);
      toast.success('Template downloaded successfully!');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    }
  };

  // Show Trial Balance Review page if navigated to it
  if (showTrialBalanceReview && selectedCompany) {
    return (
      <TrialBalanceReview
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        period={selectedPeriod}
        onBack={() => {
          setShowTrialBalanceReview(false);
          loadTrialBalanceData(); // Reload data when coming back
        }}
      />
    );
  }

  // Show Bank Rec Review page if navigated to it
  if (showBankRecReview && selectedCompany) {
    return (
      <BankRecReview
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        period={selectedPeriod}
        onBack={() => {
          setShowBankRecReview(false);
          loadReconciliationData(); // Reload data when coming back
        }}
      />
    );
  }

  // Show AP Rec Review page if navigated to it
  if (showAPRecReview && selectedCompany) {
    return (
      <APRecReview
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        period={selectedPeriod}
        onBack={() => {
          setShowAPRecReview(false);
          loadReconciliationData(); // Reload data when coming back
          loadAPReconciliationData(); // Reload AP data when coming back
        }}
      />
    );
  }

  // Show CC Rec Review page if navigated to it
  if (showCCRecReview && selectedCompany) {
    return (
      <CCRecReview
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        period={selectedPeriod}
        onBack={() => {
          setShowCCRecReview(false);
          loadCCReconciliationData(); // Reload CC data when coming back
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Locked Banner */}
      {isMonthLocked && (
        <div className="bg-gray-900 text-white p-3 rounded-lg border border-gray-800">
          <div className="flex items-center gap-2">
            <Lock className="size-4" />
            <p className="text-sm">
              Period locked · Closed {lockDetails?.closedAt ? new Date(lockDetails.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
            </p>
          </div>
        </div>
      )}

      {/* Header with Company & Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl text-gray-900">Month-End Close</h1>
            <p className="text-gray-500 mt-1">AI-powered close preparation & adjusting entries</p>
          </div>
          
          {/* Company Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Building2 className="size-4" />
                {selectedCompany?.name || 'Select Company'}
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[300px]">
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => setSelectedCompany(company)}
                  className={selectedCompany?.id === company.id ? 'bg-purple-50' : ''}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{company.name}</span>
                    <span className="text-xs text-gray-500">{company.industry}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="size-4" />
                {periods.find(p => p.value === selectedPeriod)?.label}
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {periods.map((period) => (
                <DropdownMenuItem
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={selectedPeriod === period.value ? 'bg-purple-50' : ''}
                >
                  {period.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {getStatusBadge()}
        </div>
      </div>

      {/* Pre-Close Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">
              1
            </div>
            <CardTitle>Pre-Close Checklist</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Review Bank Rec */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              {bankRecCompleted ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : isLoadingReconciliation ? (
                <Loader2 className="size-5 text-gray-400 animate-spin" />
              ) : reconciliationResult ? (
                <AlertCircle className="size-5 text-yellow-600" />
              ) : (
                <Circle className="size-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm text-gray-900">Review Bank Reconciliation</p>
                <p className="text-xs text-gray-500">
                  {isLoadingReconciliation ? (
                    'Loading reconciliation data...'
                  ) : reconciliationResult ? (
                    <>
                      {reconciliationResult.unmatched_bank?.length || 0} unmatched bank, {reconciliationResult.unmatched_ledger?.length || 0} unmatched ledger
                    </>
                  ) : (
                    'No reconciliation found for this period'
                  )}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="ghost"
              className="gap-1"
              onClick={() => setShowBankRecReview(true)}
            >
              {bankRecCompleted ? 'Review' : 'Start'}
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Review AP Rec */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              {apRecCompleted ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : isLoadingAPReconciliation ? (
                <Loader2 className="size-5 text-gray-400 animate-spin" />
              ) : apReconciliationResult ? (
                <AlertCircle className="size-5 text-yellow-600" />
              ) : (
                <Circle className="size-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm text-gray-900">Review AP Reconciliation</p>
                <p className="text-xs text-gray-500">
                  {isLoadingAPReconciliation ? (
                    'Loading AP reconciliation data...'
                  ) : apReconciliationResult ? (
                    <>
                      {apReconciliationResult.unmatchedVendor?.length || 0} unmatched vendor, {apReconciliationResult.unmatchedAP?.length || 0} unmatched AP
                    </>
                  ) : (
                    'No AP reconciliation found for this period'
                  )}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="ghost"
              className="gap-1"
              onClick={() => setShowAPRecReview(true)}
            >
              {apRecCompleted ? 'Review' : 'Start'}
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Review CC Rec */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              {ccRecCompleted ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : isLoadingCCReconciliation ? (
                <Loader2 className="size-5 text-gray-400 animate-spin" />
              ) : ccReconciliationResult ? (
                <AlertCircle className="size-5 text-yellow-600" />
              ) : (
                <Circle className="size-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm text-gray-900">Review CC Reconciliation</p>
                <p className="text-xs text-gray-500">
                  {isLoadingCCReconciliation ? (
                    'Loading CC reconciliation data...'
                  ) : ccReconciliationResult ? (
                    <>
                      {ccReconciliationResult.unmatched_cc?.length || 0} unmatched CC, {ccReconciliationResult.unmatched_ledger?.length || 0} unmatched ledger
                    </>
                  ) : (
                    'No CC reconciliation found for this period'
                  )}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="ghost"
              className="gap-1"
              onClick={() => setShowCCRecReview(true)}
            >
              {ccRecCompleted ? 'Review' : 'Start'}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trial Balance Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
              2
            </div>
            <CardTitle>Trial Balance Review</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleTrialBalanceFileUpload}
            className="hidden"
          />

          {isLoadingTrialBalance ? (
            <div className="text-center py-12">
              <Loader2 className="size-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Analyzing trial balance with AI...</p>
              <p className="text-xs text-gray-500 mt-2">Detecting columns and validating balances</p>
            </div>
          ) : !trialBalanceResult ? (
            /* Upload Section */
            <div>
              <div className="mb-4">
                <h3 className="text-gray-900">Upload Trial Balance</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Upload an Excel or CSV file containing your trial balance for {selectedPeriod}
                </p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
                {isUploadingTrialBalance ? (
                  <div>
                    <Loader2 className="size-12 text-blue-600 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-600">Uploading and analyzing trial balance...</p>
                    <p className="text-xs text-gray-500 mt-2">AI is detecting columns and validating balances</p>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="size-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      Click to upload your trial balance or drag and drop
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <Button onClick={handleTrialBalanceFileSelect} disabled={isUploadingTrialBalance}>
                        {isUploadingTrialBalance ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Upload className="size-4 mr-2" />
                            Choose File
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={downloadTrialBalanceTemplate}>
                        <Download className="size-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                      Supported formats: Excel (.xlsx, .xls) or CSV
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      AI will automatically detect your column structure - any format works!
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Results Section */
            <div className="space-y-6">
              {/* Summary Status */}
              <div className="flex items-start justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-start gap-3 flex-1">
                  {trialBalanceCompleted ? (
                    <CheckCircle2 className="size-6 text-green-600 mt-0.5" />
                  ) : trialBalanceResult && !trialBalanceResult.canClose ? (
                    <XCircle className="size-6 text-red-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="size-6 text-yellow-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">
                        {trialBalanceResult.isBalanced ? (
                          <span className="text-green-700">✓ Trial Balance is Balanced</span>
                        ) : (
                          <span className="text-red-700">✗ Trial Balance is Unbalanced</span>
                        )}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleTrialBalanceFileSelect}
                      >
                        <Upload className="size-4 mr-2" />
                        Re-upload
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-gray-500">Total Accounts</p>
                        <p className="text-sm text-gray-900">{trialBalanceResult.summary?.totalAccounts || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Structural Errors</p>
                        <p className="text-sm text-gray-900">{trialBalanceResult.structuralErrors?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Warnings</p>
                        <p className="text-sm text-gray-900">{trialBalanceResult.analyticalWarnings?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              {trialBalanceResult.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Total Debits</p>
                    <p className="text-lg text-gray-900">
                      €{trialBalanceResult.summary.totalDebits?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Total Credits</p>
                    <p className="text-lg text-gray-900">
                      €{trialBalanceResult.summary.totalCredits?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-xs text-purple-600 mb-1">Total Revenue</p>
                    <p className="text-lg text-gray-900">
                      €{trialBalanceResult.summary.totalRevenue?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-xs text-orange-600 mb-1">Total Expenses</p>
                    <p className="text-lg text-gray-900">
                      €{trialBalanceResult.summary.totalExpenses?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}

              {/* Balance Difference Alert */}
              {trialBalanceResult.summary && trialBalanceResult.summary.difference > 0.01 && (
                <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-900">Debits and Credits Don't Match</p>
                      <p className="text-xs text-red-700 mt-1">
                        Difference: €{trialBalanceResult.summary.difference.toFixed(2)} 
                        (Debits €{trialBalanceResult.summary.totalDebits.toFixed(2)} - Credits €{trialBalanceResult.summary.totalCredits.toFixed(2)})
                      </p>
                      <p className="text-xs text-red-600 mt-2">
                        ⚠️ You cannot close the month until the trial balance is balanced.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Structural Errors - Expanded View */}
              {trialBalanceResult.structuralErrors?.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                    <div className="flex items-center gap-2">
                      <XCircle className="size-5 text-red-600" />
                      <h4 className="text-sm text-red-900">
                        {trialBalanceResult.structuralErrors.length} Critical Error(s) - Must Fix Before Close
                      </h4>
                    </div>
                  </div>
                  <div className="divide-y divide-red-100">
                    {trialBalanceResult.structuralErrors.map((error: any, idx: number) => (
                      <div key={idx} className="p-4 bg-white">
                        <div className="flex items-start gap-3">
                          <div className="size-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-red-900">{error.title}</p>
                            <p className="text-xs text-red-700 mt-1">{error.message}</p>
                            {error.recommendation && (
                              <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-800">
                                <span className="font-medium">💡 Recommendation:</span> {error.recommendation}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analytical Warnings - Expanded View */}
              {trialBalanceResult.analyticalWarnings?.length > 0 && (
                <div className="border border-yellow-200 rounded-lg overflow-hidden">
                  <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-5 text-yellow-600" />
                      <h4 className="text-sm text-yellow-900">
                        {trialBalanceResult.analyticalWarnings.length} Warning(s) - Review Recommended
                      </h4>
                    </div>
                  </div>
                  <div className="divide-y divide-yellow-100 max-h-96 overflow-y-auto">
                    {trialBalanceResult.analyticalWarnings.map((warning: any, idx: number) => (
                      <div key={idx} className="p-4 bg-white">
                        <div className="flex items-start gap-3">
                          <div className="size-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-yellow-900">{warning.title}</p>
                            <p className="text-xs text-yellow-700 mt-1">{warning.message}</p>
                            {warning.recommendation && (
                              <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                                <span className="font-medium">💡 Recommendation:</span> {warning.recommendation}
                              </div>
                            )}
                            {warning.details && (
                              <details className="mt-2">
                                <summary className="text-xs text-yellow-600 cursor-pointer hover:text-yellow-700">
                                  View details
                                </summary>
                                <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-auto">
                                  {JSON.stringify(warning.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success State - All Clear */}
              {trialBalanceResult.isBalanced && 
               trialBalanceResult.structuralErrors?.length === 0 && 
               trialBalanceResult.analyticalWarnings?.length === 0 && (
                <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-green-900">Trial Balance Verified ✓</p>
                      <p className="text-xs text-green-700 mt-1">
                        All accounts are balanced with no errors or warnings. You're ready to proceed with month-end close!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Close Month Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm">
              3
            </div>
            <CardTitle>Close & Lock Period</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isMonthLocked ? (
            /* Month is Locked */
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gray-900 flex items-center justify-center">
                  <Lock className="size-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-900">Period Locked</p>
                  <p className="text-xs text-gray-500">
                    Closed {lockDetails?.closedAt ? new Date(lockDetails.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Month is Open */
            <>
              {/* Requirements Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg border transition-all ${bankRecCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {bankRecCompleted ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <Circle className="size-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-700">Bank Reconciliation</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border transition-all ${apRecCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {apRecCompleted ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <Circle className="size-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-700">AP Reconciliation</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border transition-all ${ccRecCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {ccRecCompleted ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <Circle className="size-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-700">CC Reconciliation</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border transition-all ${trialBalanceCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {trialBalanceCompleted ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <Circle className="size-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-700">Trial Balance</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              {bankRecCompleted && apRecCompleted && ccRecCompleted && trialBalanceCompleted ? (
                <Button
                  size="lg"
                  onClick={() => setShowCloseConfirmation(true)}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                >
                  <Lock className="size-4 mr-2" />
                  Close {periods.find(p => p.value === selectedPeriod)?.label}
                </Button>
              ) : (
                <Button
                  size="lg"
                  disabled
                  className="w-full"
                >
                  Complete All Requirements to Close
                </Button>
              )}

              {/* Info Text */}
              <p className="text-xs text-gray-500 text-center">
                Once closed, this period will be locked and read-only
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {showCloseConfirmation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !isClosingMonth && setShowCloseConfirmation(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-xl text-gray-900">Close Period?</h3>
              <p className="text-sm text-gray-600 mt-2">
                You're about to close {periods.find(p => p.value === selectedPeriod)?.label} for {selectedCompany?.name}.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <p className="text-xs text-gray-700">This will:</p>
              <ul className="text-xs text-gray-600 space-y-1 ml-4">
                <li>• Lock all reconciliations (read-only)</li>
                <li>• Lock trial balance data</li>
                <li>• Prevent new transactions for this period</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCloseConfirmation(false)}
                disabled={isClosingMonth}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCloseMonth}
                disabled={isClosingMonth}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
              >
                {isClosingMonth ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Closing...
                  </>
                ) : (
                  <>
                    Close Period
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}