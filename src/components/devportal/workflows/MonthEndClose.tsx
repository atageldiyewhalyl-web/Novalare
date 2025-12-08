import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Upload, 
  Download, 
  AlertCircle,
  Sparkles,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { companiesApi, Company } from '@/utils/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TrialBalanceUpload } from './MonthEndCloseComponents/TrialBalanceUpload';
import { AIAnalysisSuggestions } from './MonthEndCloseComponents/AIAnalysisSuggestions';
import { AdjustingEntriesReview } from './MonthEndCloseComponents/AdjustingEntriesReview';
import { ExportToQuickBooks } from './MonthEndCloseComponents/ExportToQuickBooks';

interface MonthEndCloseProps {
  companyId?: string;
  companyName?: string;
}

interface CloseStatus {
  invoicesProcessed: { completed: number; total: number };
  bankTransactions: { completed: number; total: number };
  apReconciliation: boolean;
  uncategorizedCount: number;
  trialBalanceUploaded: boolean;
  adjustingEntriesCount: number;
  status: 'not_started' | 'in_progress' | 'ready_to_close' | 'closed';
  closedDate?: string;
}

interface TrialBalance {
  uploadedAt: string;
  fileName: string;
  accounts: Array<{
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

interface AISuggestion {
  id: string;
  type: 'depreciation' | 'amortization' | 'accrual' | 'reclassification';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  amount: number;
  suggestedEntry: {
    debit: { account: string; accountCode: string; amount: number };
    credit: { account: string; accountCode: string; amount: number };
  };
  reasoning: string;
}

interface AdjustingEntry {
  id: string;
  date: string;
  description: string;
  lines: Array<{
    account: string;
    accountCode: string;
    debit: string;
    credit: string;
    memo?: string;
  }>;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'exported';
  exportedAt?: string;
}

export function MonthEndClose({ companyId: initialCompanyId, companyName: initialCompanyName }: MonthEndCloseProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('2024-12');
  const [closeStatus, setCloseStatus] = useState<CloseStatus | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [adjustingEntries, setAdjustingEntries] = useState<AdjustingEntry[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load companies list
  useEffect(() => {
    loadCompanies();
  }, []);

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

  // Load close status when company or period changes
  useEffect(() => {
    if (selectedCompany) {
      loadCloseStatus();
      loadTrialBalance();
      loadAdjustingEntries();
    }
  }, [selectedCompany, selectedPeriod]);

  const loadCloseStatus = async () => {
    if (!selectedCompany) return;
    
    setIsLoadingStatus(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/month-end-close/${selectedPeriod}/status`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setCloseStatus(data);
      }
    } catch (error) {
      console.error('Failed to load close status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const loadTrialBalance = async () => {
    if (!selectedCompany) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/month-end-close/${selectedPeriod}/trial-balance`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTrialBalance(data);
      }
    } catch (error) {
      console.error('Failed to load trial balance:', error);
    }
  };

  const loadAdjustingEntries = async () => {
    if (!selectedCompany) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/month-end-close/${selectedPeriod}/adjusting-entries`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAdjustingEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to load adjusting entries:', error);
    }
  };

  const handleTrialBalanceUploaded = async (data: TrialBalance) => {
    setTrialBalance(data);
    
    // Trigger AI analysis
    setIsAnalyzing(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany?.id}/month-end-close/${selectedPeriod}/analyze`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        setAiSuggestions(result.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to analyze trial balance:', error);
    } finally {
      setIsAnalyzing(false);
    }
    
    // Reload status
    loadCloseStatus();
  };

  const handleGenerateAdjustingEntry = async (suggestion: AISuggestion) => {
    if (!selectedCompany) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/month-end-close/${selectedPeriod}/adjusting-entries`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ suggestion }),
        }
      );
      
      if (response.ok) {
        await loadAdjustingEntries();
        await loadCloseStatus();
      }
    } catch (error) {
      console.error('Failed to generate adjusting entry:', error);
    }
  };

  const handleGenerateAllEntries = async () => {
    if (!selectedCompany) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/month-end-close/${selectedPeriod}/adjusting-entries/batch`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ suggestions: aiSuggestions }),
        }
      );
      
      if (response.ok) {
        await loadAdjustingEntries();
        await loadCloseStatus();
        setAiSuggestions([]); // Clear suggestions after generating
      }
    } catch (error) {
      console.error('Failed to generate all entries:', error);
    }
  };

  const handleMarkClosed = async () => {
    if (!selectedCompany) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${selectedCompany.id}/month-end-close/${selectedPeriod}/close`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        await loadCloseStatus();
      }
    } catch (error) {
      console.error('Failed to mark period as closed:', error);
    }
  };

  const calculateProgress = () => {
    if (!closeStatus) return 0;
    
    let completed = 0;
    const total = 6;
    
    if (closeStatus.invoicesProcessed.completed === closeStatus.invoicesProcessed.total) completed++;
    if (closeStatus.bankTransactions.completed === closeStatus.bankTransactions.total) completed++;
    if (closeStatus.apReconciliation) completed++;
    if (closeStatus.uncategorizedCount === 0) completed++;
    if (closeStatus.trialBalanceUploaded) completed++;
    if (closeStatus.adjustingEntriesCount > 0) completed++;
    
    return (completed / total) * 100;
  };

  const getStatusBadge = () => {
    if (!closeStatus) return null;
    
    switch (closeStatus.status) {
      case 'closed':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Closed</Badge>;
      case 'ready_to_close':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Ready to Close</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">In Progress</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Not Started</Badge>;
    }
  };

  const periods = [
    { value: '2024-12', label: 'December 2024' },
    { value: '2025-01', label: 'January 2025' },
    { value: '2024-11', label: 'November 2024' },
    { value: '2024-10', label: 'October 2024' },
  ];

  return (
    <div className="space-y-6">
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

      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Close Progress</span>
              <span className="text-sm text-gray-900">{Math.round(calculateProgress())}% Complete</span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Invoices</CardTitle>
            {closeStatus?.invoicesProcessed.completed === closeStatus?.invoicesProcessed.total ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <Clock className="size-4 text-yellow-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">
              {closeStatus?.invoicesProcessed.completed || 0} / {closeStatus?.invoicesProcessed.total || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Bank Transactions</CardTitle>
            {closeStatus?.bankTransactions.completed === closeStatus?.bankTransactions.total ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <Clock className="size-4 text-yellow-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">
              {closeStatus?.bankTransactions.completed || 0} / {closeStatus?.bankTransactions.total || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Categorized</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Uncategorized</CardTitle>
            {closeStatus?.uncategorizedCount === 0 ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <AlertCircle className="size-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl ${closeStatus?.uncategorizedCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {closeStatus?.uncategorizedCount || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Items pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Adjusting Entries</CardTitle>
            {closeStatus?.adjustingEntriesCount > 0 ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <Circle className="size-4 text-gray-400" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">
              {closeStatus?.adjustingEntriesCount || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Generated</p>
          </CardContent>
        </Card>
      </div>

      {/* Step 1: Pre-Close Checklist */}
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
          <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-3">
              {closeStatus?.invoicesProcessed.completed === closeStatus?.invoicesProcessed.total ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : (
                <Clock className="size-5 text-yellow-600" />
              )}
              <div>
                <p className="text-sm text-gray-900">All invoices processed</p>
                <p className="text-xs text-gray-500">
                  {closeStatus?.invoicesProcessed.completed || 0} of {closeStatus?.invoicesProcessed.total || 0} complete
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-3">
              {closeStatus?.bankTransactions.completed === closeStatus?.bankTransactions.total ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : (
                <Clock className="size-5 text-yellow-600" />
              )}
              <div>
                <p className="text-sm text-gray-900">All bank transactions categorized</p>
                <p className="text-xs text-gray-500">
                  {closeStatus?.bankTransactions.completed || 0} of {closeStatus?.bankTransactions.total || 0} complete
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-3">
              {closeStatus?.apReconciliation ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : (
                <Circle className="size-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm text-gray-900">AP reconciliation complete</p>
                <p className="text-xs text-gray-500">Vendor statements matched</p>
              </div>
            </div>
          </div>

          {closeStatus && closeStatus.uncategorizedCount > 0 && (
            <div className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-red-50">
              <div className="flex items-center gap-3">
                <AlertCircle className="size-5 text-red-600" />
                <div>
                  <p className="text-sm text-red-900">{closeStatus.uncategorizedCount} uncategorized transactions</p>
                  <p className="text-xs text-red-600">Review these before continuing</p>
                </div>
              </div>
              <Button size="sm" variant="outline">Review Now</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Trial Balance Upload */}
      <TrialBalanceUpload
        companyId={selectedCompany?.id || ''}
        period={selectedPeriod}
        trialBalance={trialBalance}
        onUploaded={handleTrialBalanceUploaded}
      />

      {/* Step 3: AI Analysis */}
      {trialBalance && (
        <AIAnalysisSuggestions
          suggestions={aiSuggestions}
          isAnalyzing={isAnalyzing}
          onGenerateEntry={handleGenerateAdjustingEntry}
          onGenerateAll={handleGenerateAllEntries}
        />
      )}

      {/* Step 4: Review Adjusting Entries */}
      {adjustingEntries.length > 0 && (
        <AdjustingEntriesReview
          entries={adjustingEntries}
          companyId={selectedCompany?.id || ''}
          period={selectedPeriod}
          onRefresh={loadAdjustingEntries}
        />
      )}

      {/* Step 5: Export to QuickBooks */}
      {adjustingEntries.length > 0 && (
        <ExportToQuickBooks
          entries={adjustingEntries}
          companyId={selectedCompany?.id || ''}
          period={selectedPeriod}
          onExported={() => {
            loadAdjustingEntries();
            loadCloseStatus();
          }}
        />
      )}

      {/* Step 6: Mark Period as Closed */}
      {closeStatus?.status === 'ready_to_close' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">
                6
              </div>
              <CardTitle>Complete the Close</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm text-blue-900 mb-2">Final Steps in QuickBooks:</h4>
              <ol className="list-decimal ml-5 space-y-1 text-sm text-blue-800">
                <li>Import adjusting entries into QuickBooks</li>
                <li>Run new Trial Balance to verify entries posted correctly</li>
                <li>Review Profit & Loss and Balance Sheet reports</li>
                <li>Close the period in QuickBooks (make it read-only)</li>
                <li>Generate final financial statements</li>
              </ol>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Once you've completed the close in QuickBooks, mark this period as closed:
              </p>
              <Button onClick={handleMarkClosed} className="gap-2">
                <CheckCircle2 className="size-4" />
                Mark {periods.find(p => p.value === selectedPeriod)?.label} as Closed
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Closed Period Message */}
      {closeStatus?.status === 'closed' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-green-600" />
              <div>
                <p className="text-sm text-green-900">
                  {periods.find(p => p.value === selectedPeriod)?.label} is closed
                </p>
                <p className="text-xs text-green-700">
                  Closed on {closeStatus.closedDate ? new Date(closeStatus.closedDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
