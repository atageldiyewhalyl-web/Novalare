import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, CreditCard, Trash2, FileSpreadsheet, Building, Calendar, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { companiesApi, Company } from '@/utils/api-client';

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
}

export function CCReconciliation() {
  // Company and Period Selection
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  
  // Credit Card Statements Tab
  const [ccStatements, setCCStatements] = useState<CCStatement[]>([]);
  const [ccTransactions, setCCTransactions] = useState<CCTransaction[]>([]);
  const [isUploadingCC, setIsUploadingCC] = useState(false);
  const [isLoadingCCData, setIsLoadingCCData] = useState(false);
  const [isExportingCC, setIsExportingCC] = useState(false);
  
  // Current Active Tab
  const [activeTab, setActiveTab] = useState<string>('cc-statements');
  
  // Month-End Close Lock State
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockDetails, setLockDetails] = useState<any>(null);
  
  const ccFileInputRef = useRef<HTMLInputElement>(null);
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
      loadCCData();
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
        if (isMountedRef.current) {
          setCCStatements(data.statements || []);
          setCCTransactions(data.transactions || []);
        }
      } else if (response.status === 404) {
        // No data found yet - this is expected
        if (isMountedRef.current) {
          setCCStatements([]);
          setCCTransactions([]);
        }
      }
    } catch (error) {
      // Silently handle - endpoint may not have data yet
      if (isMountedRef.current) {
        setCCStatements([]);
        setCCTransactions([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingCCData(false);
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
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-gray-900">Credit Card Reconciliation</h1>
        <p className="text-gray-500 mt-1">Upload and review company credit card statements</p>
      </div>

      {/* Company & Period Selection Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-100">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-blue-600" />
            <CardTitle className="text-lg">Select Company & Period</CardTitle>
          </div>
          <CardDescription>Choose which company and month you're reviewing</CardDescription>
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
              <span>Reviewing <strong>{selectedCompany?.name}</strong> for <strong>{periods.find(p => p.value === selectedPeriod)?.label}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      {selectedCompanyId && selectedPeriod ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-1 h-auto p-1">
            <TabsTrigger value="cc-statements" className="gap-2 py-3">
              <CreditCard className="size-4" />
              Credit Card Statements
              {ccStatements.length > 0 && (
                <Badge variant="secondary" className="ml-1">{ccStatements.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Credit Card Statements Tab */}
          <TabsContent value="cc-statements" className="space-y-4">
            {/* Locked Status Alert */}
            {isMonthLocked && (
              <Alert className="bg-gray-900 border-gray-800">
                <Lock className="size-4 text-white" />
                <AlertDescription className="text-white">
                  <strong>Uploads are locked.</strong> This company's reconciliation for {selectedPeriod} is locked. You cannot upload more credit card statements while the period is locked.
                </AlertDescription>
              </Alert>
            )}
            
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="size-5 text-purple-600" />
                      Credit Card Statements
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Upload credit card statements (PDF, Excel, or CSV). AI will automatically extract all transactions.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {ccTransactions.length > 0 && (
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
                    )}
                    <Button
                      onClick={() => ccFileInputRef.current?.click()}
                      disabled={isUploadingCC || isMonthLocked}
                    >
                      {isUploadingCC ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-4 mr-2" />
                          Upload Statements
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
                  <Alert>
                    <FileText className="size-4" />
                    <AlertDescription>
                      No credit card statements uploaded yet. Upload statements to get started.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    {/* Uploaded Statements List */}
                    <div>
                      <h4 className="text-sm text-gray-700 mb-3">Uploaded Statements ({ccStatements.length})</h4>
                      <div className="grid gap-3">
                        {ccStatements.map((statement) => (
                          <motion.div
                            key={statement.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 rounded">
                                <CreditCard className="size-5 text-purple-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-900">{statement.fileName}</p>
                                  {statement.cardName && (
                                    <Badge variant="outline" className="text-xs">
                                      {statement.cardName}
                                      {statement.cardLast4 && ` ••${statement.cardLast4}`}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  Uploaded {new Date(statement.uploadedAt).toLocaleString()} • {statement.transactionCount} transactions
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCCStatement(statement.id)}
                              disabled={isMonthLocked}
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Transactions by Card */}
                    {ccTransactions.length > 0 && (
                      <div>
                        <h4 className="text-sm text-gray-700 mb-3">
                          All Transactions ({ccTransactions.length})
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
                                      <td className={`px-4 py-3 text-right ${txn.amount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
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
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
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
