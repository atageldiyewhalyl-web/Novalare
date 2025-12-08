import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft, TrendingUp, Clock, ChevronRight, XCircle, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useRef, useEffect, Fragment } from 'react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { ProcessingStages } from '@/components/ProcessingStages';

interface VendorInvoice {
  invoice_number: string;
  date: string;
  amount: number;
  vendor?: string;
  description?: string;
}

interface InternalAPEntry {
  invoice_number: string;
  date: string;
  amount: number;
  vendor?: string;
  account?: string;
}

interface ExactMatch {
  vendor_invoice: VendorInvoice;
  internal_entry: InternalAPEntry;
  match_type: string;
}

interface OneToManyMatch {
  vendor_invoice: VendorInvoice;
  internal_entries: InternalAPEntry[];
  match_type: string;
  total_amount: number;
  entry_count: number;
}

interface ManyToOneMatch {
  vendor_invoices: VendorInvoice[];
  internal_entry: InternalAPEntry;
  match_type: string;
  total_amount: number;
  invoice_count: number;
}

interface FuzzyMatch {
  vendor_invoice: VendorInvoice;
  internal_entry: InternalAPEntry;
  match_confidence: number;
  match_reason: string;
  match_type: string;
}

interface UnmatchedVendor {
  invoice: VendorInvoice;
  reason: string;
  suggested_action: string;
  classification?: string;
}

interface UnmatchedInternal {
  invoice_number: string;
  date: string;
  amount: number;
  vendor?: string;
}

interface APReconciliationResult {
  exact_matches: ExactMatch[];
  one_to_many_matches: OneToManyMatch[];
  many_to_one_matches: ManyToOneMatch[];
  fuzzy_matches: FuzzyMatch[];
  missing_in_internal: UnmatchedVendor[];
  extra_in_internal: UnmatchedInternal[];
  summary: {
    total_vendor_invoices: number;
    total_internal_entries: number;
    exact_matched: number;
    one_to_many_matched: number;
    many_to_one_matched: number;
    fuzzy_matched: number;
    total_matched: number;
    missing_in_internal_count: number;
    extra_in_internal_count: number;
    vendor_total_amount: number;
    internal_total_amount: number;
    difference: number;
    match_rate: number;
  };
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  date: string;
  vendorFileName: string;
  apFileName: string;
  summary: APReconciliationResult['summary'];
}

export function APReconciliation() {
  const [vendorFile, setVendorFile] = useState<File | null>(null);
  const [apFile, setAPFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFromHistory, setIsLoadingFromHistory] = useState(false);
  const [result, setResult] = useState<APReconciliationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{current: number, total: number, progress: number, message: string} | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  const vendorFileInputRef = useRef<HTMLInputElement>(null);
  const apFileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    fetchHistory();
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec-history`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current && data.history) {
          setHistory(data.history);
        }
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingHistory(false);
      }
    }
  };

  const handleVendorFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
        toast.error('Please upload a CSV or Excel file');
        return;
      }
      setVendorFile(file);
      setError(null);
    }
  };

  const handleAPFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
        toast.error('Please upload a CSV or Excel file');
        return;
      }
      setAPFile(file);
      setError(null);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec-job/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const jobStatus = await response.json();
        
        if (!isMountedRef.current) return;

        // Update progress
        if (jobStatus.progress !== undefined) {
          setProcessingProgress({
            current: jobStatus.progress,
            total: 100,
            progress: jobStatus.progress,
            message: jobStatus.message || 'Processing...'
          });
        }

        // Check if complete
        if (jobStatus.status === 'complete') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsProcessing(false);
          setProcessingProgress(null);
          setCurrentJobId(null);
          
          if (jobStatus.result) {
            setResult(jobStatus.result);
            toast.success('AP reconciliation completed successfully!');
            fetchHistory();
          }
        } else if (jobStatus.status === 'error') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsProcessing(false);
          setProcessingProgress(null);
          setCurrentJobId(null);
          setError(jobStatus.message || 'Processing failed');
          toast.error(jobStatus.message || 'Reconciliation failed');
        }
      }
    } catch (error) {
      console.error('Error polling job status:', error);
    }
  };

  const handleRunReconciliation = async () => {
    if (!vendorFile || !apFile) {
      toast.error('Please upload both vendor statement and AP ledger files');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProcessingProgress(null);

    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('vendor_statement', vendorFile);
      formData.append('ap_ledger', apFile);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/reconcile-ap`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Server error response:', errorData);
        throw new Error(errorData.details || errorData.error || 'Reconciliation failed');
      }

      const data = await response.json();
      
      if (!isMountedRef.current) return;

      // Check if this is a job-based response (for large datasets)
      if (data.jobId) {
        console.log('📊 Large dataset - starting progress polling for job:', data.jobId);
        setCurrentJobId(data.jobId);
        setProcessingProgress({
          current: 0,
          total: 100,
          progress: 0,
          message: data.message || 'Starting processing...'
        });
        
        // Start polling for job status
        pollIntervalRef.current = window.setInterval(() => {
          pollJobStatus(data.jobId);
        }, 1500); // Poll every 1.5 seconds
        
        // Immediately poll once
        pollJobStatus(data.jobId);
        
        toast.success(`Processing ${data.vendorCount} vendor invoices and ${data.apCount} AP entries...`);
      } else {
        // Small dataset - immediate response
        setResult(data);
        setIsProcessing(false);
        toast.success('AP reconciliation completed successfully!');
        fetchHistory();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Reconciliation error:', error);
        if (isMountedRef.current) {
          setError(error.message || 'Failed to process reconciliation');
          toast.error(error.message || 'Reconciliation failed');
          setIsProcessing(false);
          setProcessingProgress(null);
        }
      }
    }
  };

  const handleLoadFromHistory = async (historyId: string) => {
    setIsLoadingFromHistory(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/ap-rec-result/${historyId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setResult(data.result);
          toast.success('Loaded previous reconciliation');
        }
      } else {
        toast.error('Failed to load reconciliation');
      }
    } catch (error) {
      console.error('Error loading reconciliation:', error);
      toast.error('Failed to load reconciliation');
    } finally {
      if (isMountedRef.current) {
        setIsLoadingFromHistory(false);
      }
    }
  };

  const handleReset = () => {
    setVendorFile(null);
    setAPFile(null);
    setResult(null);
    setError(null);
    setExpandedMatch(null);
    setShowAllMatches(false);
    setCurrentJobId(null);
    setProcessingProgress(null);
    if (vendorFileInputRef.current) vendorFileInputRef.current.value = '';
    if (apFileInputRef.current) apFileInputRef.current.value = '';
  };

  const handleCancelProcessing = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    setProcessingProgress(null);
    setCurrentJobId(null);
    toast.info('Processing cancelled');
  };

  const handleExportResults = async () => {
    if (!result) return;

    try {
      toast.info('Generating Excel file...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/export-ap-reconciliation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ result }),
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ap-reconciliation-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export results');
    }
  };

  if (result) {
    const totalMatches = result.summary.total_matched;
    const displayMatches = showAllMatches ? totalMatches : Math.min(5, totalMatches);
    
    // Combine all matches for display - use empty arrays as fallbacks
    const allMatches = [
      ...(result.exact_matches || []).map(m => ({ ...m, display_type: 'Exact Match' })),
      ...(result.one_to_many_matches || []).map(m => ({ ...m, display_type: '1-to-Many' })),
      ...(result.many_to_one_matches || []).map(m => ({ ...m, display_type: 'Many-to-1' })),
      ...(result.fuzzy_matches || []).map(m => ({ ...m, display_type: 'Fuzzy Match' }))
    ];

    return (
      <div className="space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              New Reconciliation
            </Button>
            <div className="h-4 w-px bg-gray-200" />
            <div>
              <h2 className="text-2xl text-gray-900">AP Reconciliation Results</h2>
              <p className="text-sm text-gray-500">Analysis complete</p>
            </div>
          </div>
          <Button onClick={handleExportResults} variant="outline" className="gap-2">
            <Download className="size-4" />
            Export Results
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-5 gap-4"
        >
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Matched</p>
                  <p className="text-3xl mt-1 text-gray-900">{result.summary.total_matched || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{(result.summary.match_rate || 0).toFixed(1)}% match rate</p>
                </div>
                <CheckCircle className="size-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Missing</p>
                  <p className="text-3xl mt-1 text-gray-900">{result.summary.missing_in_internal_count}</p>
                  <p className="text-xs text-gray-500 mt-1">Not in system</p>
                </div>
                <AlertCircle className="size-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Extra</p>
                  <p className="text-3xl mt-1 text-gray-900">{result.summary.extra_in_internal_count}</p>
                  <p className="text-xs text-gray-500 mt-1">In system only</p>
                </div>
                <XCircle className="size-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Vendor Total</p>
                  <p className="text-3xl mt-1 text-gray-900">€{(result.summary.vendor_total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-gray-500 mt-1">{result.summary.total_vendor_invoices} invoices</p>
                </div>
                <FileText className="size-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${Math.abs(result.summary.difference || 0) < 1 ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Difference</p>
                  <p className={`text-3xl mt-1 ${Math.abs(result.summary.difference || 0) < 1 ? 'text-green-600' : 'text-red-600'}`}>
                    €{Math.abs(result.summary.difference || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.abs(result.summary.difference || 0) < 1 ? 'Balanced' : 'Out of balance'}
                  </p>
                </div>
                <DollarSign className={`size-8 ${Math.abs(result.summary.difference || 0) < 1 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Matched Items */}
        {allMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Matched Items</CardTitle>
                    <CardDescription>{totalMatches} items matched successfully</CardDescription>
                  </div>
                  {totalMatches > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllMatches(!showAllMatches)}
                      className="gap-2"
                    >
                      {showAllMatches ? 'Show Less' : `Show All ${totalMatches}`}
                      <ChevronRight className={`size-4 transition-transform ${showAllMatches ? 'rotate-90' : ''}`} />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allMatches.slice(0, displayMatches).map((match, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex items-center gap-4">
                        <CheckCircle className="size-5 text-green-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-900 truncate">
                              {'vendor_invoice' in match 
                                ? (match.vendor_invoice.num || match.vendor_invoice.invoice_number)
                                : `${match.vendor_invoices.length} invoices`}
                            </p>
                            <Badge variant="outline" className="text-xs bg-white">
                              {match.display_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {'vendor_invoice' in match 
                              ? match.vendor_invoice.date 
                              : match.vendor_invoices[0].date}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900">
                          €{'vendor_invoice' in match 
                            ? (match.vendor_invoice.amt || match.vendor_invoice.amount || 0).toFixed(2)
                            : (match.total_amount || 0).toFixed(2)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Missing in Internal */}
        {(result.missing_in_internal || []).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-600">Missing in Internal System</CardTitle>
                <CardDescription>{(result.missing_in_internal || []).length} vendor invoices not found in AP ledger</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(result.missing_in_internal || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <AlertCircle className="size-5 text-yellow-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-900">{item.invoice.num || item.invoice.invoice_number}</p>
                            <p className="text-xs text-gray-500">{item.invoice.date}</p>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                          <p className="text-xs text-blue-600 mt-1">{item.suggested_action}</p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-gray-900">€{(item.invoice.amt || item.invoice.amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Extra in Internal */}
        {(result.extra_in_internal || []).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-600">Extra in Internal System</CardTitle>
                <CardDescription>{(result.extra_in_internal || []).length} AP entries without vendor invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(result.extra_in_internal || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-4">
                        <XCircle className="size-5 text-orange-600 flex-shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-900">{item.invoice_number}</p>
                            <p className="text-xs text-gray-500">{item.date}</p>
                          </div>
                          {item.vendor && <p className="text-xs text-gray-600 mt-1">{item.vendor}</p>}
                        </div>
                      </div>
                      <p className="text-sm text-gray-900">€{item.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">AP Reconciliation</h1>
          <p className="text-gray-500 mt-1">Reconcile vendor statements with accounts payable ledger</p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendor Statement</CardTitle>
            <CardDescription>Upload vendor statement (CSV/Excel)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-purple-300 transition-colors cursor-pointer"
                onClick={() => vendorFileInputRef.current?.click()}
              >
                <Upload className="size-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {vendorFile ? vendorFile.name : 'Click to upload vendor statement'}
                </p>
                <p className="text-xs text-gray-400 mt-1">CSV or Excel format</p>
              </div>
              <input
                ref={vendorFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleVendorFileSelect}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AP Ledger</CardTitle>
            <CardDescription>Upload internal AP ledger (CSV/Excel)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-purple-300 transition-colors cursor-pointer"
                onClick={() => apFileInputRef.current?.click()}
              >
                <Upload className="size-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {apFile ? apFile.name : 'Click to upload AP ledger'}
                </p>
                <p className="text-xs text-gray-400 mt-1">CSV or Excel format</p>
              </div>
              <input
                ref={apFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleAPFileSelect}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-red-600" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        {isProcessing && processingProgress && (
          <Button
            onClick={handleCancelProcessing}
            variant="outline"
            className="gap-2"
          >
            <XCircle className="size-4" />
            Cancel
          </Button>
        )}
        <Button
          onClick={handleRunReconciliation}
          disabled={!vendorFile || !apFile || isProcessing}
          className="gap-2 bg-purple-600 hover:bg-purple-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {processingProgress ? `Processing ${processingProgress.progress}%` : 'Processing...'}
            </>
          ) : (
            <>
              <CheckCircle className="size-4" />
              Run Reconciliation
            </>
          )}
        </Button>
      </div>

      {/* Processing Animation */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardContent className="pt-6">
                {processingProgress ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Loader2 className="size-5 text-purple-600 animate-spin" />
                        <div>
                          <p className="text-sm text-gray-900">{processingProgress.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {processingProgress.progress}% complete
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl text-purple-600">{processingProgress.progress}%</p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-violet-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${processingProgress.progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>

                    {/* Processing stages */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className={`p-3 rounded-lg border-2 ${processingProgress.progress >= 30 ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          {processingProgress.progress >= 30 ? (
                            <CheckCircle className="size-4 text-green-600" />
                          ) : (
                            <Clock className="size-4 text-gray-400" />
                          )}
                          <p className="text-xs text-gray-700">Exact Matching</p>
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg border-2 ${processingProgress.progress >= 80 ? 'border-green-500 bg-green-50' : processingProgress.progress >= 30 ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          {processingProgress.progress >= 80 ? (
                            <CheckCircle className="size-4 text-green-600" />
                          ) : processingProgress.progress >= 30 ? (
                            <Loader2 className="size-4 text-purple-600 animate-spin" />
                          ) : (
                            <Clock className="size-4 text-gray-400" />
                          )}
                          <p className="text-xs text-gray-700">AI Processing</p>
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg border-2 ${processingProgress.progress >= 100 ? 'border-green-500 bg-green-50' : processingProgress.progress >= 80 ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          {processingProgress.progress >= 100 ? (
                            <CheckCircle className="size-4 text-green-600" />
                          ) : processingProgress.progress >= 80 ? (
                            <Loader2 className="size-4 text-purple-600 animate-spin" />
                          ) : (
                            <Clock className="size-4 text-gray-400" />
                          )}
                          <p className="text-xs text-gray-700">Compiling Results</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <ProcessingStages type="ap-rec" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Section */}
      {!isLoadingHistory && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Reconciliations</CardTitle>
            <CardDescription>Load previous reconciliation results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.slice(0, 5).map((item) => {
                // Format the date nicely
                const formattedDate = new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                return (
                  <div
                    key={item.id}
                    onClick={() => handleLoadFromHistory(item.id)}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <Clock className="size-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-900">{formattedDate}</p>
                        <p className="text-xs text-gray-500">
                          {item.vendorFileName} & {item.apFileName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-900">
                          {(item.summary?.match_rate || 0).toFixed(1)}% matched
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.summary?.total_matched || 0} items
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}