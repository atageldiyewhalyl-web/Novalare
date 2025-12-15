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

interface CustomerTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  statementId: string;
  statementName: string;
  invoiceNumber?: string;
  customer?: string;
}

interface CustomerStatement {
  id: string;
  fileName: string;
  uploadedAt: number;
  transactionCount: number;
  fileUrl?: string;
  filePath?: string;
  customer?: string;
}

interface ARLedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  account?: string;
  reference?: string;
  invoiceNumber?: string;
  customer?: string;
}

interface ARLedger {
  id: string;
  fileName: string;
  uploadedAt: number;
  entryCount: number;
}

interface MatchedPair {
  customer_transaction: CustomerTransaction;
  ar_entries: ARLedgerEntry[];
  match_confidence: number;
  match_type: string;
  explanation?: string;
}

interface UnmatchedCustomer {
  transaction: CustomerTransaction;
  suggested_action: string;
  suggested_je?: {
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
  };
}

interface UnmatchedAR {
  entry: ARLedgerEntry;
  reason: string;
  action: string;
}

interface ReconciliationResult {
  matched_pairs: MatchedPair[];
  unmatched_customer: UnmatchedCustomer[];
  unmatched_ar: UnmatchedAR[];
  summary: {
    total_customer_transactions: number;
    total_ar_entries: number;
    matched_count: number;
    unmatched_customer_count: number;
    unmatched_ar_count: number;
    total_customer_amount: number;
    total_ar_amount: number;
    difference: number;
    match_rate: number;
  };
  locked?: boolean;
  lockedAt?: string;
  unlockedAt?: string;
}

export function ARReconciliation() {
  // Company and Period Selection
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  
  // Customer Statements Tab
  const [customerStatements, setCustomerStatements] = useState<CustomerStatement[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<CustomerTransaction[]>([]);
  const [isUploadingCustomer, setIsUploadingCustomer] = useState(false);
  const [isLoadingCustomerData, setIsLoadingCustomerData] = useState(false);
  
  // AR Ledger Tab
  const [arLedger, setARLedger] = useState<ARLedger | null>(null);
  const [arEntries, setAREntries] = useState<ARLedgerEntry[]>([]);
  const [isUploadingAR, setIsUploadingAR] = useState(false);
  const [isLoadingARData, setIsLoadingARData] = useState(false);
  
  // Reconciliation Tab
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [isLockingReconciliation, setIsLockingReconciliation] = useState(false);
  
  // Current Active Tab
  const [activeTab, setActiveTab] = useState<string>('customer-statements');
  
  // Export Dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  const customerFileInputRef = useRef<HTMLInputElement>(null);
  const arFileInputRef = useRef<HTMLInputElement>(null);
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
      loadCustomerData();
      loadARData();
      loadReconciliationData();
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
  
  // Load customer statements and transactions
  const loadCustomerData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      setIsLoadingCustomerData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-customer-statements?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setCustomerStatements(data.statements || []);
          setCustomerTransactions(data.transactions || []);
        }
      } else if (response.status === 404) {
        // Endpoint doesn't exist yet - this is expected for new features
        if (isMountedRef.current) {
          setCustomerStatements([]);
          setCustomerTransactions([]);
        }
      }
    } catch (error) {
      // Silently handle - endpoint may not be implemented yet
      if (isMountedRef.current) {
        setCustomerStatements([]);
        setCustomerTransactions([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingCustomerData(false);
      }
    }
  };
  
  // Load AR ledger and entries
  const loadARData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      setIsLoadingARData(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-ledger?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setARLedger(data.ledger || null);
          setAREntries(data.entries || []);
        }
      } else if (response.status === 404) {
        // Endpoint doesn't exist yet - this is expected for new features
        if (isMountedRef.current) {
          setARLedger(null);
          setAREntries([]);
        }
      }
    } catch (error) {
      // Silently handle - endpoint may not be implemented yet
      if (isMountedRef.current) {
        setARLedger(null);
        setAREntries([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingARData(false);
      }
    }
  };
  
  // Load reconciliation data
  const loadReconciliationData = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-reconciliation?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current && data.reconciliation) {
          setReconciliationResult(data.reconciliation);
        }
      } else if (response.status === 404) {
        // Endpoint doesn't exist yet - this is expected for new features
        if (isMountedRef.current) {
          setReconciliationResult(null);
        }
      }
    } catch (error) {
      // Silently handle - endpoint may not be implemented yet
    }
  };
  
  // Handle customer statement upload
  const handleCustomerFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCompanyId || !selectedPeriod) return;
    
    setIsUploadingCustomer(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', selectedCompanyId);
      formData.append('period', selectedPeriod);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/upload-customer-statement`,
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
        toast.success(`Uploaded ${data.transactionCount} transactions from customer statement`);
        await loadCustomerData();
      } else {
        const error = await response.text();
        toast.error('Failed to upload customer statement');
        console.error(error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload customer statement');
    } finally {
      setIsUploadingCustomer(false);
      if (customerFileInputRef.current) {
        customerFileInputRef.current.value = '';
      }
    }
  };
  
  // Handle AR ledger upload
  const handleARFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCompanyId || !selectedPeriod) return;
    
    setIsUploadingAR(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', selectedCompanyId);
      formData.append('period', selectedPeriod);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/upload-ar-ledger`,
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
        toast.success(`Uploaded ${data.entryCount} entries from AR ledger`);
        await loadARData();
      } else {
        const error = await response.text();
        toast.error('Failed to upload AR ledger');
        console.error(error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload AR ledger');
    } finally {
      setIsUploadingAR(false);
      if (arFileInputRef.current) {
        arFileInputRef.current.value = '';
      }
    }
  };
  
  // Handle delete customer statement
  const handleDeleteCustomerStatement = async (statementId: string) => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ar-customer-statement/${statementId}?companyId=${selectedCompanyId}&period=${selectedPeriod}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        toast.success('Customer statement deleted');
        await loadCustomerData();
      } else {
        toast.error('Failed to delete customer statement');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete customer statement');
    }
  };
  
  // Run reconciliation
  const handleRunReconciliation = async () => {
    if (!selectedCompanyId || !selectedPeriod) return;
    
    if (customerTransactions.length === 0 || arEntries.length === 0) {
      toast.error('Please upload both customer statements and AR ledger before reconciling');
      return;
    }
    
    setIsReconciling(true);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/run-ar-reconciliation`,
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
        toast.success('AR reconciliation completed successfully');
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
  
  // Export reconciliation results
  const handleExport = async () => {
    if (!reconciliationResult || !selectedCompanyId || !selectedPeriod) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/export-ar-reconciliation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: selectedCompanyId,
            period: selectedPeriod,
            reconciliation: reconciliationResult,
          }),
        }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const company = companies.find(c => c.id === selectedCompanyId);
        const fileName = `AR_Reconciliation_${company?.name || 'Company'}_${selectedPeriod}.xlsx`;
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
    }
  };

  const periods = generatePeriodOptions();
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-gray-900">AR Reconciliation</h1>
        <p className="text-gray-500 mt-1">Match customer statements with AR ledger entries using AI</p>
      </div>

      {/* Company & Period Selection Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-100">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-blue-600" />
            <CardTitle className="text-lg">Select Company & Period</CardTitle>
          </div>
          <CardDescription>Choose which company and month you're reconciling</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-700">Company</label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      <div className="flex items-center gap-2">
                        <Building className="size-4 text-gray-400" />
                        <span>{company.name}</span>
                        <span className="text-xs text-gray-500">({company.country})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-gray-700">Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4 text-gray-400" />
                        {period.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {selectedCompanyId && selectedPeriod && (
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-700 bg-blue-100 px-3 py-2 rounded-lg">
              <CheckCircle className="size-4" />
              <span>Reconciling <strong>{selectedCompany?.name}</strong> for <strong>{periods.find(p => p.value === selectedPeriod)?.label}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      {selectedCompanyId && selectedPeriod ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="customer-statements" className="gap-2 py-3">
              <FileText className="size-4" />
              Customer Statements
              {customerStatements.length > 0 && (
                <Badge variant="secondary" className="ml-1">{customerStatements.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ar-ledger" className="gap-2 py-3">
              <BookOpen className="size-4" />
              AR Ledger
              {arLedger && <CheckCircle className="size-4 text-green-600 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2 py-3">
              <GitCompare className="size-4" />
              Reconciliation
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Customer Statements */}
          <TabsContent value="customer-statements" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upload Customer Statements</CardTitle>
                    <CardDescription>Upload PDFs, CSV, or Excel files – AI will automatically extract all transactions</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2" disabled={customerTransactions.length === 0}>
                      <Download className="size-4" />
                      Export
                    </Button>
                    <Button 
                      className="gap-2" 
                      onClick={() => customerFileInputRef.current?.click()}
                      disabled={isUploadingCustomer}
                    >
                      {isUploadingCustomer ? (
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
                      ref={customerFileInputRef}
                      type="file"
                      accept=".pdf,.csv,.xlsx,.xls"
                      onChange={handleCustomerFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCustomerData ? (
                  <div className="text-center py-12">
                    <Loader2 className="size-8 animate-spin text-purple-600 mx-auto mb-3" />
                    <p className="text-gray-500">Loading customer statements...</p>
                  </div>
                ) : customerStatements.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="size-12 text-gray-300 mx-auto mb-3" />
                    <p>No customer statements uploaded yet.</p>
                    <p className="text-sm mt-1">Upload your first customer statement to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerStatements.map((statement) => (
                      <div key={statement.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <FileText className="size-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-900">{statement.fileName}</p>
                            <p className="text-xs text-gray-500">
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
                            onClick={() => handleDeleteCustomerStatement(statement.id)}
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

            {/* All Customer Transactions */}
            {customerTransactions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>All Customer Transactions</CardTitle>
                  <CardDescription>{customerTransactions.length} transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-5 gap-4 pb-2 border-b border-gray-200 text-xs text-gray-500 sticky top-0 bg-white">
                      <div>Date</div>
                      <div className="col-span-2">Description</div>
                      <div className="text-right">Amount</div>
                      <div className="text-right">Statement</div>
                    </div>
                    {customerTransactions.map((transaction) => (
                      <div key={transaction.id} className="grid grid-cols-5 gap-4 py-2 text-sm border-b border-gray-100">
                        <div className="text-gray-900">{transaction.date}</div>
                        <div className="col-span-2 text-gray-900 truncate">{transaction.description}</div>
                        <div className={`text-right ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          €{formatCurrency(Math.abs(transaction.amount))}
                        </div>
                        <div className="text-right text-gray-500 text-xs truncate">{transaction.statementName}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: AR Ledger */}
          <TabsContent value="ar-ledger" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upload AR Ledger</CardTitle>
                    <CardDescription>Upload your internal AR ledger – AI will extract the information and list them here</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2" disabled={arEntries.length === 0}>
                      <Download className="size-4" />
                      Export
                    </Button>
                    <Button 
                      className="gap-2" 
                      onClick={() => arFileInputRef.current?.click()}
                      disabled={isUploadingAR}
                    >
                      {isUploadingAR ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          Upload AR Ledger
                        </>
                      )}
                    </Button>
                    <input
                      ref={arFileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleARFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingARData ? (
                  <div className="text-center py-12">
                    <Loader2 className="size-8 animate-spin text-purple-600 mx-auto mb-3" />
                    <p className="text-gray-500">Loading AR ledger...</p>
                  </div>
                ) : !arLedger ? (
                  <div className="text-center py-12 text-gray-500">
                    <BookOpen className="size-12 text-gray-300 mx-auto mb-3" />
                    <p>No AR ledger uploaded yet.</p>
                    <p className="text-sm mt-1">Upload your AR ledger to continue with reconciliation.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <BookOpen className="size-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{arLedger.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {arLedger.entryCount} entries • {new Date(arLedger.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Eye className="size-4" />
                          View
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2 text-red-600 hover:text-red-700">
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All AR Entries */}
            {arEntries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>All AR Ledger Entries</CardTitle>
                  <CardDescription>{arEntries.length} entries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-5 gap-4 pb-2 border-b border-gray-200 text-xs text-gray-500 sticky top-0 bg-white">
                      <div>Date</div>
                      <div className="col-span-2">Description</div>
                      <div className="text-right">Amount</div>
                      <div className="text-right">Account</div>
                    </div>
                    {arEntries.map((entry) => (
                      <div key={entry.id} className="grid grid-cols-5 gap-4 py-2 text-sm border-b border-gray-100">
                        <div className="text-gray-900">{entry.date}</div>
                        <div className="col-span-2 text-gray-900 truncate">{entry.description}</div>
                        <div className={`text-right ${entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          €{formatCurrency(Math.abs(entry.amount))}
                        </div>
                        <div className="text-right text-gray-500 text-xs">{entry.account || '—'}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 3: Reconciliation */}
          <TabsContent value="reconciliation" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Run AR Reconciliation</CardTitle>
                    <CardDescription>Novalare will match customer transactions with AR ledger entries</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {reconciliationResult && (
                      <Button variant="outline" className="gap-2" onClick={handleExport}>
                        <Download className="size-4" />
                        Export Results
                      </Button>
                    )}
                    <Button 
                      className="gap-2" 
                      onClick={handleRunReconciliation}
                      disabled={isReconciling || customerTransactions.length === 0 || arEntries.length === 0}
                    >
                      {isReconciling ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Reconciling...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="size-4" />
                          Run Reconciliation
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {customerTransactions.length === 0 || arEntries.length === 0 ? (
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Please upload both customer statements and AR ledger before running reconciliation.
                    </AlertDescription>
                  </Alert>
                ) : !reconciliationResult ? (
                  <div className="text-center py-12 text-gray-500">
                    <GitCompare className="size-12 text-gray-300 mx-auto mb-3" />
                    <p>Ready to reconcile.</p>
                    <p className="text-sm mt-1">Click "Run Reconciliation" to match transactions.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Matched</p>
                              <p className="text-3xl mt-1 text-gray-900">{reconciliationResult.summary.matched_count}</p>
                              <p className="text-xs text-gray-500 mt-1">{reconciliationResult.summary.match_rate.toFixed(1)}% match rate</p>
                            </div>
                            <CheckCircle className="size-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-yellow-500">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Unmatched Customer</p>
                              <p className="text-3xl mt-1 text-gray-900">{reconciliationResult.summary.unmatched_customer_count}</p>
                              <p className="text-xs text-gray-500 mt-1">Not in AR ledger</p>
                            </div>
                            <AlertCircle className="size-8 text-yellow-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-orange-500">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Unmatched AR</p>
                              <p className="text-3xl mt-1 text-gray-900">{reconciliationResult.summary.unmatched_ar_count}</p>
                              <p className="text-xs text-gray-500 mt-1">Not in customer statements</p>
                            </div>
                            <AlertTriangle className="size-8 text-orange-500" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className={`border-l-4 ${Math.abs(reconciliationResult.summary.difference) < 1 ? 'border-l-green-500' : 'border-l-red-500'}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600">Difference</p>
                              <p className={`text-3xl mt-1 ${Math.abs(reconciliationResult.summary.difference) < 1 ? 'text-green-600' : 'text-red-600'}`}>
                                €{formatCurrency(Math.abs(reconciliationResult.summary.difference))}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {Math.abs(reconciliationResult.summary.difference) < 1 ? 'Balanced' : 'Out of balance'}
                              </p>
                            </div>
                            <CheckCircle className={`size-8 ${Math.abs(reconciliationResult.summary.difference) < 1 ? 'text-green-500' : 'text-red-500'}`} />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Matched Pairs */}
                    {reconciliationResult.matched_pairs.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-green-600">Matched Transactions</CardTitle>
                          <CardDescription>{reconciliationResult.matched_pairs.length} successfully matched</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {reconciliationResult.matched_pairs.slice(0, showAllMatches ? undefined : 5).map((match, idx) => (
                              <div key={idx} className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <CheckCircle className="size-5 text-green-600" />
                                    <div>
                                      <p className="text-sm text-gray-900">{match.customer_transaction.description}</p>
                                      <p className="text-xs text-gray-500">{match.customer_transaction.date} • {match.match_type}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-gray-900">€{formatCurrency(match.customer_transaction.amount)}</p>
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {match.match_confidence}% confidence
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {reconciliationResult.matched_pairs.length > 5 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAllMatches(!showAllMatches)}
                                className="w-full"
                              >
                                {showAllMatches ? 'Show Less' : `Show All ${reconciliationResult.matched_pairs.length} Matches`}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Unmatched Customer Transactions */}
                    {reconciliationResult.unmatched_customer.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-yellow-600">Unmatched Customer Transactions</CardTitle>
                          <CardDescription>{reconciliationResult.unmatched_customer.length} transactions not found in AR ledger</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {reconciliationResult.unmatched_customer.map((item, idx) => (
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

                    {/* Unmatched AR Entries */}
                    {reconciliationResult.unmatched_ar.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-orange-600">Unmatched AR Ledger Entries</CardTitle>
                          <CardDescription>{reconciliationResult.unmatched_ar.length} entries not found in customer statements</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {reconciliationResult.unmatched_ar.map((item, idx) => (
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
                  </div>
                )}
              </CardContent>
            </Card>
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