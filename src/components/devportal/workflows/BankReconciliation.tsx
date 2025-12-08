import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useRef, useEffect, Fragment } from 'react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { motion, AnimatePresence } from 'motion/react';
import { ProcessingStages } from '@/components/ProcessingStages';

interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
}

interface LedgerEntry {
  date: string;
  description: string;
  amount: number;
  account?: string;
  reference?: string;
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
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  date: string;
  bankFileName: string;
  ledgerFileName: string;
  summary: ReconciliationResult['summary'];
}

export function BankReconciliation() {
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFromHistory, setIsLoadingFromHistory] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{current: number, total: number} | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const bankFileInputRef = useRef<HTMLInputElement>(null);
  const ledgerFileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Helper function to format currency with thousands separators
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchHistory();
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchHistory = async () => {
    try {
      console.log('📜 Fetching reconciliation history...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec-history`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      console.log('📊 History response:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ History data received:', data.history?.length || 0, 'entries');
        setHistory(data.history || []);
      } else {
        const errorData = await response.json();
        console.error('❌ History fetch failed:', errorData);
      }
    } catch (err) {
      console.error('❌ Failed to fetch history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadHistoryItem = async (id: string) => {
    try {
      setIsProcessing(true);
      setIsLoadingFromHistory(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec-history/${id}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        toast.success('Loaded previous reconciliation');
      } else {
        toast.error('Failed to load reconciliation');
      }
    } catch (err) {
      console.error('Failed to load history item:', err);
      toast.error('Failed to load reconciliation');
    } finally {
      setIsProcessing(false);
      setIsLoadingFromHistory(false);
    }
  };

  const handleBankFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Warn if file is very large (>2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.warning('Large file detected - processing may take 1-2 minutes', {
          duration: 5000
        });
      }
      setBankFile(file);
      setError(null);
    }
  };

  const handleLedgerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Warn if file is very large (>2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.warning('Large file detected - processing may take 1-2 minutes', {
          duration: 5000
        });
      }
      setLedgerFile(file);
      setError(null);
    }
  };

  const handleProcess = async () => {
    if (!bankFile || !ledgerFile) {
      toast.error('Please upload both bank statement and ledger files');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('bank_file', bankFile);
    formData.append('ledger_file', ledgerFile);

    // Debug logging
    console.log('📤 Sending files:', {
      bankFile: { name: bankFile.name, size: bankFile.size, type: bankFile.type },
      ledgerFile: { name: ledgerFile.name, size: ledgerFile.size, type: ledgerFile.type }
    });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/analyze-bank-rec`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            // DO NOT set Content-Type - let browser set it with boundary
          },
          body: formData,
          signal: abortControllerRef.current.signal,
        }
      );

      if (!isMountedRef.current) return;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process reconciliation');
      }

      const data = await response.json();
      
      if (!isMountedRef.current) return;
      
      setResult(data);
      toast.success('Reconciliation completed successfully!');
      
      // Refresh history to include the new reconciliation
      fetchHistory();
    } catch (err: any) {
      if (!isMountedRef.current) return;
      
      if (err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      const errorMessage = err.message || 'Failed to process reconciliation';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Reconciliation error:', err);
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  const handleReset = () => {
    setBankFile(null);
    setLedgerFile(null);
    setResult(null);
    setError(null);
    setExpandedMatch(null);
    setShowAllMatches(false);
    if (bankFileInputRef.current) bankFileInputRef.current.value = '';
    if (ledgerFileInputRef.current) ledgerFileInputRef.current.value = '';
  };

  const exportReport = () => {
    if (!result) return;

    // Show loading toast
    const loadingToast = toast.loading('Generating Excel report...');

    // Use setTimeout to prevent UI freeze for large datasets
    setTimeout(async () => {
      try {
        const XLSX = await import('xlsx');
        
        // Debug: Log the actual data structure
        console.log('🔍 EXPORT DEBUG - Sample match structure:');
        if (result.matched_pairs && result.matched_pairs.length > 0) {
          const sampleMatch = result.matched_pairs[0];
          console.log('Sample match:', JSON.stringify(sampleMatch, null, 2));
          console.log('Bank transaction:', sampleMatch.bank_transaction);
          console.log('Ledger entries:', sampleMatch.ledger_entries);
          console.log('Match type:', sampleMatch.match_type);
          console.log('Match confidence:', sampleMatch.match_confidence);
          console.log('Explanation:', sampleMatch.explanation);
        }
        
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // 1. SUMMARY SHEET
        const summaryData = [
          ['BANK RECONCILIATION SUMMARY'],
          [''],
          ['Report Date', new Date().toISOString()],
          ['Total Bank Transactions', result.summary.total_bank_transactions],
          ['Total Ledger Entries', result.summary.total_ledger_entries],
          ['Matched Count', result.summary.matched_count],
          ['Unmatched Bank', result.summary.unmatched_bank_count],
          ['Unmatched Ledger', result.summary.unmatched_ledger_count],
          ['Match Rate', `${result.summary.match_rate.toFixed(1)}%`],
          [''],
          ['Total Bank Amount', `€${result.summary.total_bank_amount.toFixed(2)}`],
          ['Total Ledger Amount', `€${result.summary.total_ledger_amount.toFixed(2)}`],
          ['Difference', `€${result.summary.difference.toFixed(2)}`],
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Set column widths for summary
        summarySheet['!cols'] = [
          { wch: 25 },
          { wch: 30 }
        ];
        
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
        
        // 2. MATCHED TRANSACTIONS SHEET
        const matchedData: any[] = [
          ['Bank Date', 'Bank Description', 'Bank Amount', 'Ledger Date', 'Ledger Description', 'Ledger Amount', 'Match Type', 'Confidence', 'Explanation']
        ];
        
        console.log(`🔍 Processing ${result.matched_pairs.length} matched pairs for export`);
        
        result.matched_pairs.forEach((pair: any, pairIdx: number) => {
          // Access bank transaction
          const bankTxn = pair.bank_transaction || {};
          const bankDate = bankTxn.date || '';
          const bankDesc = bankTxn.description || '';
          const bankAmt = typeof bankTxn.amount === 'number' ? bankTxn.amount : '';
          
          // Access ledger entries (MUST be an array)
          const ledgerEntries = Array.isArray(pair.ledger_entries) ? pair.ledger_entries : [];
          
          // Access metadata
          const matchType = pair.match_type || '';
          const confidence = typeof pair.match_confidence === 'number' 
            ? `${(pair.match_confidence * 100).toFixed(0)}%` 
            : '';
          const explanation = pair.explanation || '';
          
          // Debug first few matches
          if (pairIdx < 3) {
            console.log(`Match ${pairIdx}:`, {
              bankDate,
              bankDesc,
              bankAmt,
              ledgerCount: ledgerEntries.length,
              matchType,
              confidence
            });
          }
          
          if (ledgerEntries.length === 0) {
            // No ledger entries - shouldn't happen but handle gracefully
            console.warn(`⚠️ Match ${pairIdx} has NO ledger entries`);
            matchedData.push([
              bankDate,
              bankDesc,
              bankAmt,
              '',
              '',
              '',
              matchType,
              confidence,
              explanation
            ]);
          } else if (ledgerEntries.length === 1) {
            // Single ledger entry (1:1 match)
            const ledger = ledgerEntries[0] || {};
            matchedData.push([
              bankDate,
              bankDesc,
              bankAmt,
              ledger.date || '',
              ledger.description || '',
              typeof ledger.amount === 'number' ? ledger.amount : '',
              matchType,
              confidence,
              explanation
            ]);
          } else {
            // Multiple ledger entries (1:many match)
            ledgerEntries.forEach((ledger: any, idx: number) => {
              const ledgerObj = ledger || {};
              if (idx === 0) {
                // First row: show bank transaction + first ledger entry
                matchedData.push([
                  bankDate,
                  bankDesc,
                  bankAmt,
                  ledgerObj.date || '',
                  ledgerObj.description || '',
                  typeof ledgerObj.amount === 'number' ? ledgerObj.amount : '',
                  matchType,
                  confidence,
                  explanation
                ]);
              } else {
                // Subsequent rows: empty bank columns, show additional ledger entries
                matchedData.push([
                  '',
                  '',
                  '',
                  ledgerObj.date || '',
                  ledgerObj.description || '',
                  typeof ledgerObj.amount === 'number' ? ledgerObj.amount : '',
                  '',
                  '',
                  ''
                ]);
              }
            });
          }
        });
        
        console.log(`✅ Generated ${matchedData.length - 1} rows for matched transactions`);
        
        const matchedSheet = XLSX.utils.aoa_to_sheet(matchedData);
        
        // Set column widths for matched transactions
        matchedSheet['!cols'] = [
          { wch: 12 },  // Bank Date
          { wch: 35 },  // Bank Description
          { wch: 12 },  // Bank Amount
          { wch: 12 },  // Ledger Date
          { wch: 35 },  // Ledger Description
          { wch: 12 },  // Ledger Amount
          { wch: 20 },  // Match Type
          { wch: 12 },  // Confidence
          { wch: 50 }   // Explanation
        ];
        
        XLSX.utils.book_append_sheet(wb, matchedSheet, 'Matched Transactions');
        
        // 3. UNMATCHED BANK TRANSACTIONS SHEET
        const unmatchedBankData: any[] = [
          ['Date', 'Description', 'Amount', 'Suggested Action', 'Debit Account', 'Credit Account']
        ];
        
        result.unmatched_bank.forEach((txn: any) => {
          unmatchedBankData.push([
            txn.transaction?.date || txn.date || '',
            txn.transaction?.description || txn.description || '',
            txn.transaction?.amount || txn.amount || '',
            txn.suggested_action || txn.action || '',
            txn.suggested_je?.debit_account || '',
            txn.suggested_je?.credit_account || ''
          ]);
        });
        
        const unmatchedBankSheet = XLSX.utils.aoa_to_sheet(unmatchedBankData);
        
        // Set column widths for unmatched bank
        unmatchedBankSheet['!cols'] = [
          { wch: 12 },  // Date
          { wch: 35 },  // Description
          { wch: 12 },  // Amount
          { wch: 40 },  // Suggested Action
          { wch: 20 },  // Debit Account
          { wch: 20 }   // Credit Account
        ];
        
        XLSX.utils.book_append_sheet(wb, unmatchedBankSheet, 'Unmatched Bank');
        
        // 4. UNMATCHED LEDGER ENTRIES SHEET
        const unmatchedLedgerData: any[] = [
          ['Date', 'Description', 'Amount', 'Reason', 'Action']
        ];
        
        result.unmatched_ledger.forEach((entry: any) => {
          unmatchedLedgerData.push([
            entry.entry?.date || entry.date || '',
            entry.entry?.description || entry.description || '',
            entry.entry?.amount || entry.amount || '',
            entry.reason || '',
            entry.action || ''
          ]);
        });
        
        const unmatchedLedgerSheet = XLSX.utils.aoa_to_sheet(unmatchedLedgerData);
        
        // Set column widths for unmatched ledger
        unmatchedLedgerSheet['!cols'] = [
          { wch: 12 },  // Date
          { wch: 35 },  // Description
          { wch: 12 },  // Amount
          { wch: 30 },  // Reason
          { wch: 30 }   // Action
        ];
        
        XLSX.utils.book_append_sheet(wb, unmatchedLedgerSheet, 'Unmatched Ledger');
        
        // Generate Excel file and download
        const filename = `bank-reconciliation-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log(`✅ Excel file generated: ${filename}`);
        
        toast.dismiss(loadingToast);
        toast.success('Excel report exported successfully!');
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Failed to export report');
        console.error('❌ Export error:', error);
      }
    }, 100);
  };

  // Upload State
  if (!result && !isProcessing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-gray-900">Bank Reconciliation</h1>
            <p className="text-gray-500 mt-1">Match bank transactions with ledger entries using AI</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bank Statement Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bank Statement</CardTitle>
              <CardDescription>Upload your bank statement (CSV, XLSX, or PDF)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  onClick={() => bankFileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all"
                >
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  {bankFile ? (
                    <div>
                      <p className="text-sm text-gray-900 font-medium">{bankFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(bankFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600">Click to upload bank statement</p>
                      <p className="text-xs text-gray-400 mt-1">CSV, XLSX, or PDF up to 10MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={bankFileInputRef}
                  type="file"
                  onChange={handleBankFileChange}
                  accept=".csv,.xlsx,.xls,.pdf"
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          {/* Ledger Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Ledger</CardTitle>
              <CardDescription>Upload your general ledger entries (CSV or XLSX)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  onClick={() => ledgerFileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all"
                >
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  {ledgerFile ? (
                    <div>
                      <p className="text-sm text-gray-900 font-medium">{ledgerFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(ledgerFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600">Click to upload ledger</p>
                      <p className="text-xs text-gray-400 mt-1">CSV or XLSX up to 10MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={ledgerFileInputRef}
                  type="file"
                  onChange={handleLedgerFileChange}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Process Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleProcess}
            disabled={!bankFile || !ledgerFile}
            className="gap-2 h-12 px-8 bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <TrendingUp className="size-5" />
            <span>Run Reconciliation</span>
          </Button>
        </div>

        {/* Recent Reconciliations History */}
        {history.length > 0 && (
          <Card className="mt-8">
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-violet-600" />
                <CardTitle className="text-lg">Recent Reconciliations</CardTitle>
              </div>
              <CardDescription>Click any reconciliation to view details</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadHistoryItem(item.id)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-sm text-gray-900 font-medium">
                            {new Date(item.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <Badge 
                            variant="outline" 
                            className={
                              item.summary.match_rate >= 95 
                                ? 'bg-violet-50 text-violet-700 border-violet-200'
                                : item.summary.match_rate >= 80
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }
                          >
                            {item.summary.match_rate.toFixed(1)}% matched
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{item.bankFileName}</span>
                          <span>•</span>
                          <span>{item.summary.total_bank_transactions} transactions</span>
                          {item.summary.unmatched_bank_count > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-gray-600">{item.summary.unmatched_bank_count} unmatched</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="size-5 text-gray-400 group-hover:text-violet-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingHistory && history.length === 0 && (
          <div className="text-center py-8">
            <Loader2 className="size-6 text-gray-400 animate-spin mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Loading history...</p>
          </div>
        )}
      </div>
    );
  }

  // Processing State
  if (isProcessing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            {isLoadingFromHistory ? (
              // Simple loading animation for history
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="relative">
                  <Loader2 className="size-16 text-violet-600 animate-spin mx-auto" />
                </div>
                <h3 className="text-xl text-gray-900 mt-6">Loading Reconciliation</h3>
                <p className="text-sm text-gray-500 mt-2">Retrieving saved results...</p>
              </motion.div>
            ) : (
              // Full AI processing stages for new reconciliation
              <>
                <ProcessingStages type="bank-rec" />
                {processingProgress && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 bg-white rounded-lg border border-gray-200 px-6 py-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Processing Batches</span>
                      <span className="text-sm font-medium text-violet-600">
                        {processingProgress.current} / {processingProgress.total}
                      </span>
                    </div>
                    <div className="w-64 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-600"
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${(processingProgress.current / processingProgress.total) * 100}%` 
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Processing ~150 transactions per batch (5 batches in parallel) - 7.5x faster!
                    </p>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Results State
  if (result) {
    const displayedMatches = showAllMatches ? result.matched_pairs : result.matched_pairs.slice(0, 10);
    
    return (
      <div className="space-y-6">
        {/* Clean Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button onClick={handleReset} variant="ghost" size="sm" className="gap-2 -ml-2">
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <div className="h-5 w-px bg-gray-300"></div>
              <h1 className="text-2xl text-gray-900">Bank Reconciliation Results</h1>
            </div>
            <p className="text-gray-500 mt-1 ml-16">
              {result.summary?.matched_count ?? 0} of {result.summary?.total_bank_transactions ?? 0} transactions matched ({(result.summary?.match_rate ?? 0).toFixed(1)}%)
            </p>
          </div>
          <Button onClick={exportReport} variant="outline" className="gap-2">
            <Download className="size-4" />
            Export Report
          </Button>
        </div>

        {/* Summary Stats - Clean White Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Matched</p>
                  <p className="text-3xl text-gray-900 mt-1">
                    {result.summary?.matched_count ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center">
                  <CheckCircle className="size-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Unmatched Bank</p>
                  <p className="text-3xl text-gray-900 mt-1">
                    {result.summary?.unmatched_bank_count ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <AlertCircle className="size-6 text-gray-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Unmatched Ledger</p>
                  <p className="text-3xl text-gray-900 mt-1">
                    {result.summary?.unmatched_ledger_count ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <AlertCircle className="size-6 text-gray-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Difference</p>
                  <p className={`text-3xl mt-1 ${
                    Math.abs(result.summary?.difference ?? 0) < 0.01 ? 'text-violet-600' : 'text-gray-900'
                  }`}>
                    €{formatCurrency(Math.abs(result.summary?.difference ?? 0))}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  Math.abs(result.summary?.difference ?? 0) < 0.01 ? 'bg-violet-50' : 'bg-gray-100'
                }`}>
                  {Math.abs(result.summary?.difference ?? 0) < 0.01 ? (
                    <CheckCircle className="size-6 text-violet-600" />
                  ) : (
                    <AlertCircle className="size-6 text-gray-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Matched Transactions - Clean Table */}
        {(result.matched_pairs?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="border-b bg-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Matched Transactions
                </CardTitle>
                <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200">
                  {result.matched_pairs.length}
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
                    {displayedMatches.map((match, idx) => (
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
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                              }
                            >
                              {match.match_type}
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
                                  {match.ledger_entries.length > 1 && (
                                    <p className="text-xs text-gray-500 pt-1">
                                      {match.ledger_entries.length} ledger entries grouped
                                    </p>
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
              
              {result.matched_pairs.length > 10 && (
                <div className="border-t bg-gray-50 py-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllMatches(!showAllMatches)}
                    className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                  >
                    {showAllMatches 
                      ? 'Show Less' 
                      : `Show ${result.matched_pairs.length - 10} More Transaction${result.matched_pairs.length - 10 !== 1 ? 's' : ''}`
                    }
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Unmatched Bank Transactions */}
        {(result.unmatched_bank?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="border-b bg-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Unmatched Bank Transactions
                </CardTitle>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                  {result.unmatched_bank.length}
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
                    {result.unmatched_bank.map((item, idx) => (
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
        {(result.unmatched_ledger?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="border-b bg-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Unmatched Ledger Entries
                </CardTitle>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                  {result.unmatched_ledger.length}
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
                    {result.unmatched_ledger.map((item, idx) => (
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
      </div>
    );
  }

  return null;
}