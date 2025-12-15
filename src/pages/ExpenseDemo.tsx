import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, ArrowLeft, CheckCircle, AlertCircle, Download, XCircle, Receipt, TrendingUp, Wallet } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner@2.0.3";
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { motion, AnimatePresence } from "motion/react";

interface Transaction {
  date: string;
  amount: number;
  merchant: string;
  description: string;
}

interface ReceiptData {
  date: string;
  total: number;
  vat?: number;
  merchant: string;
  filename: string;
  items?: any[];
}

interface Match {
  transaction: Transaction;
  receipt: ReceiptData;
  category: string;
  matchScore: number;
  hasReceipt: boolean;
}

interface UnmatchedTransaction {
  transaction: Transaction;
  category: string;
  hasReceipt: boolean;
  reason: string;
}

interface OrphanedReceipt {
  receipt: ReceiptData;
  reason: string;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  total: number;
}

interface ExpenseResult {
  summary: {
    total_transactions: number;
    total_receipts: number;
    matched_count: number;
    missing_receipts_count: number;
    orphaned_receipts_count: number;
    total_amount: number;
  };
  matches: Match[];
  unmatched_transactions: UnmatchedTransaction[];
  orphaned_receipts: OrphanedReceipt[];
  category_breakdown: CategoryBreakdown[];
}

export function ExpenseDemo() {
  const navigate = useNavigate();
  const [transactionsFile, setTransactionsFile] = useState<File | null>(null);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExpenseResult | null>(null);
  const transactionsInputRef = useRef<HTMLInputElement>(null);
  const receiptsInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount - abort pending requests ONLY
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any pending fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // DO NOT reset state here - component is unmounting
    };
  }, []);

  const handleTransactionsSelect = (file: File) => {
    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setTransactionsFile(file);
    toast.success(`${file.name} uploaded successfully`);
  };

  const handleReceiptsSelect = (files: FileList) => {
    const newFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type) && 
          !file.name.endsWith('.pdf') && 
          !file.name.endsWith('.jpg') && 
          !file.name.endsWith('.jpeg') && 
          !file.name.endsWith('.png')) {
        toast.error(`${file.name}: Please upload PDF, JPG, or PNG files only`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File size must be less than 10MB`);
        continue;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      setReceiptFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} receipt(s) added`);
    }
  };

  const removeReceipt = (index: number) => {
    setReceiptFiles(prev => prev.filter((_, i) => i !== index));
    toast.info('Receipt removed');
  };

  const handleReconcile = async () => {
    if (!transactionsFile) {
      toast.error('Please upload card transactions file');
      return;
    }

    if (receiptFiles.length === 0) {
      toast.error('Please upload at least one receipt');
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('transactions', transactionsFile);
      
      receiptFiles.forEach(file => {
        formData.append('receipts', file);
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/reconcile-expenses`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
          signal: abortControllerRef.current.signal, // Add abort signal
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Reconciliation failed');
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      setResult(data);
      toast.success('Expense reconciliation completed!');
    } catch (err: any) {
      // Ignore abort errors (they're intentional when navigating away)
      if (err.name === 'AbortError') {
        console.log('🛑 Request aborted (component unmounted)');
        return;
      }
      
      if (!isMountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during reconciliation';
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
    setTransactionsFile(null);
    setReceiptFiles([]);
    setResult(null);
    setError(null);
    if (transactionsInputRef.current) transactionsInputRef.current.value = '';
    if (receiptsInputRef.current) receiptsInputRef.current.value = '';
  };

  const handleExportCSV = async () => {
    if (!result) return;

    try {
      toast.info('Generating CSV export...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/export-expense-csv`,
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
        throw new Error('CSV export failed');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Expense_Report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('CSV export downloaded successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export CSV';
      toast.error(errorMessage);
      console.error('CSV export error:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="relative bg-black min-h-screen overflow-x-hidden">
      <Header />

      <div className="relative pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>

          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 
              className="text-4xl md:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Smart Expense Categorization
            </h1>
            <p 
              className="text-xl text-purple-200/80 max-w-3xl mx-auto"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Automatically match receipts to card transactions and categorize expenses. 
              Export clean data ready for DATEV, Xero, or QuickBooks.
            </p>
          </div>

          {/* Upload Section */}
          <div className="max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              {!result && (
                <motion.div
                  key="upload-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6 mb-8"
                >
                  {/* Card Transactions Upload */}
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-purple-300" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                          Card Transactions (Bank Feed CSV)
                        </h3>
                        <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Upload your bank export with columns: Date, Amount, Merchant, Description
                        </p>
                      </div>
                    </div>

                    <input
                      ref={transactionsInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleTransactionsSelect(file);
                      }}
                      className="hidden"
                      id="transactions-upload"
                    />
                    
                    <label htmlFor="transactions-upload">
                      <Button
                        type="button"
                        className="w-full bg-gradient-to-r from-purple-500 to-violet-500 text-white"
                        onClick={() => document.getElementById('transactions-upload')?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Select Transactions File
                      </Button>
                    </label>

                    {transactionsFile && (
                      <div className="mt-4 p-3 bg-white/10 rounded-lg">
                        <p className="text-sm text-white truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          ✓ {transactionsFile.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Receipts Upload */}
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-fuchsia-500/20 rounded-full flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-fuchsia-300" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                          Receipts (PDF / JPG / PNG)
                        </h3>
                        <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          Upload multiple receipt files - we'll extract the data automatically
                        </p>
                      </div>
                    </div>

                    <input
                      ref={receiptsInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) handleReceiptsSelect(e.target.files);
                      }}
                      className="hidden"
                      id="receipts-upload"
                    />
                    
                    <label htmlFor="receipts-upload">
                      <Button
                        type="button"
                        className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white"
                        onClick={() => document.getElementById('receipts-upload')?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Select Receipts (Multiple Files)
                      </Button>
                    </label>

                    {receiptFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-purple-200 mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {receiptFiles.length} receipt(s) uploaded:
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {receiptFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                              <p className="text-sm text-white truncate flex-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {file.name}
                              </p>
                              <button
                                onClick={() => removeReceipt(index)}
                                className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Process Button */}
              {!result && (
                <motion.div
                  key="process-button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <Button
                    onClick={handleReconcile}
                    disabled={!transactionsFile || receiptFiles.length === 0 || isProcessing}
                    className="px-12 py-6 text-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing Expenses...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Match & Categorize
                      </>
                    )}
                  </Button>

                  {error && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results Section */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                      <span className="text-3xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {result.summary.matched_count}
                      </span>
                    </div>
                    <p className="text-green-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Matched with Receipt
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <AlertCircle className="w-8 h-8 text-amber-400" />
                      <span className="text-3xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {result.summary.missing_receipts_count}
                      </span>
                    </div>
                    <p className="text-amber-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Missing Receipts
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <XCircle className="w-8 h-8 text-blue-400" />
                      <span className="text-3xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {result.summary.orphaned_receipts_count}
                      </span>
                    </div>
                    <p className="text-blue-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Orphaned Receipts
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="w-8 h-8 text-purple-400" />
                      <span className="text-3xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {formatCurrency(result.summary.total_amount)}
                      </span>
                    </div>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Total Expenses
                    </p>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8">
                  <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Category Breakdown
                  </h2>
                  <div className="space-y-4">
                    {result.category_breakdown.map((cat, idx) => (
                      <div key={`category-${cat.category}-${idx}`} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex-1">
                          <p className="text-white font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {cat.category}
                          </p>
                          <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {cat.count} transaction{cat.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white text-lg font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {formatCurrency(cat.total)}
                          </p>
                          <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {((cat.total / result.summary.total_amount) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Matched Transactions */}
                {result.matches.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-green-500/20 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Matched Transactions ({result.matches.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Date</th>
                            <th className="text-left py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Merchant</th>
                            <th className="text-right py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Amount</th>
                            <th className="text-left py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Category</th>
                            <th className="text-left py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Receipt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.matches.slice(0, 10).map((match, idx) => (
                            <tr key={`match-${match.transaction.date}-${match.transaction.merchant}-${idx}`} className="border-b border-white/5">
                              <td className="py-3 px-4 text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formatDate(match.transaction.date)}
                              </td>
                              <td className="py-3 px-4 text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {match.transaction.merchant}
                              </td>
                              <td className="py-3 px-4 text-right text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formatCurrency(match.transaction.amount)}
                              </td>
                              <td className="py-3 px-4 text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                                  {match.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-green-300 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                ✓ {match.receipt.filename}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {result.matches.length > 10 && (
                      <p className="text-purple-200/70 text-sm mt-4 text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Showing first 10 of {result.matches.length} matched transactions. Export CSV to see all.
                      </p>
                    )}
                  </div>
                )}

                {/* Missing Receipts */}
                {result.unmatched_transactions.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-amber-500/20 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <AlertCircle className="w-6 h-6 text-amber-400" />
                      <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Missing Receipts ({result.unmatched_transactions.length})
                      </h3>
                    </div>
                    <p className="text-purple-200/70 text-sm mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      These transactions have no matching receipt - request from employees or mark as non-deductible
                    </p>
                    <div className="space-y-3">
                      {result.unmatched_transactions.slice(0, 5).map((unmatched, idx) => (
                        <div key={`unmatched-${unmatched.transaction.date}-${unmatched.transaction.merchant}-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-white font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {unmatched.transaction.merchant}
                              </p>
                              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formatDate(unmatched.transaction.date)} • {formatCurrency(unmatched.transaction.amount)}
                              </p>
                            </div>
                            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full">
                              {unmatched.category}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {result.unmatched_transactions.length > 5 && (
                      <p className="text-purple-200/70 text-sm mt-4 text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Showing first 5 of {result.unmatched_transactions.length} missing receipts. Export CSV to see all.
                      </p>
                    )}
                  </div>
                )}

                {/* Orphaned Receipts */}
                {result.orphaned_receipts.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-blue-500/20 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <XCircle className="w-6 h-6 text-blue-400" />
                      <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Orphaned Receipts ({result.orphaned_receipts.length})
                      </h3>
                    </div>
                    <p className="text-purple-200/70 text-sm mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      These receipts have no matching card transaction - may be cash payments or different card
                    </p>
                    <div className="space-y-3">
                      {result.orphaned_receipts.map((orphan, idx) => (
                        <div key={`orphaned-${orphan.receipt.date}-${orphan.receipt.merchant}-${orphan.receipt.filename}-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-white font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {orphan.receipt.merchant}
                              </p>
                              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formatDate(orphan.receipt.date)} • {formatCurrency(orphan.receipt.total)}
                              </p>
                            </div>
                            <p className="text-blue-300 text-xs" style={{ fontFamily: "'Manrope', sans-serif" }}>
                              {orphan.receipt.filename}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={handleReset}
                    variant="ghost"
                    className="px-8 py-6 text-lg border-2 border-purple-400/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/50 hover:text-white transition-all"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Process More Expenses
                  </Button>
                  <Button
                    onClick={handleExportCSV}
                    className="px-8 py-6 text-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white hover:from-purple-600 hover:to-fuchsia-600 transition-all"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Clean CSV
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-gradient-to-b from-purple-950/40 to-violet-950/30 border-t border-white/5 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
              Turn Receipt Chaos into Clean Ledger Data
            </h3>
            <p className="text-lg text-purple-200/80" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Stop manually matching receipts to transactions. Automate expense categorization and get audit-ready exports in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                95%+
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Auto-Match Rate
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                AI matches receipts to transactions by date, amount, and merchant with 95%+ accuracy
              </p>
            </div>

            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-purple-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                10x
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Faster Processing
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Process 100 transactions with receipts in under 2 minutes vs. 20+ minutes manually
              </p>
            </div>

            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-cyan-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                100%
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Import Ready
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Clean CSV export works with DATEV, Xero, QuickBooks, and all major accounting software
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-lg text-purple-200 mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Every bookkeeping client generates <span className="text-white font-bold">hundreds of card transactions monthly</span>.
            </p>
            <p className="text-xl text-white" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
              <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Stop wasting hours on receipt matching. Automate the busy work and focus on advisory services.
              </span>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}