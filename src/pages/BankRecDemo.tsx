import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, ArrowLeft, CheckCircle, AlertCircle, Download, TrendingUp, Clock, DollarSign, Target } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner@2.0.3";
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { motion, AnimatePresence } from "motion/react";
import { ProcessingStages } from "../components/ProcessingStages";

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
  match_type: string; // 'exact' | 'fuzzy' | 'grouped'
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
  matched_pairs: MatchedPair[];
  unmatched_bank: UnmatchedBank[];
  unmatched_ledger: UnmatchedLedger[];
}

export function BankRecDemo() {
  const navigate = useNavigate();
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const bankInputRef = useRef<HTMLInputElement>(null);
  const ledgerInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount - abort pending requests ONLY
  useEffect(() => {
    return () => {
      // Abort any pending fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // DO NOT reset state here - component is unmounting
    };
  }, []);

  const handleFileSelect = (type: 'bank' | 'ledger', file: File) => {
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

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    if (type === 'bank') {
      setBankFile(file);
    } else {
      setLedgerFile(file);
    }
    setError(null);
  };

  const handleProcess = async () => {
    if (!bankFile || !ledgerFile) {
      toast.error('Please upload both bank statement and ledger files');
      return;
    }

    console.log('🚀 Starting bank reconciliation...');
    console.log('📁 Bank file:', bankFile.name, bankFile.type, bankFile.size, 'bytes');
    console.log('📁 Ledger file:', ledgerFile.name, ledgerFile.type, ledgerFile.size, 'bytes');
    
    setIsProcessing(true);
    setError(null);
    setShowAllMatches(false);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('bank_file', bankFile);
      formData.append('ledger_file', ledgerFile);

      console.log('📦 Sending files to server...');
      const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/analyze-bank-rec`;
      console.log('🌐 Server URL:', serverUrl);
      console.log('🔑 Using auth token:', publicAnonKey ? 'Present' : 'Missing');

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      console.log('✅ Response received:', response.status, response.statusText);
      
      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `Server returned ${response.status}: ${response.statusText}` };
        }
        const errorMsg = errorData.details ? `${errorData.error}: ${errorData.details}` : errorData.error || `Server error ${response.status}`;
        console.error('❌ Server error:', errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('📊 Response data received:', {
        hasMatchedPairs: !!data.matched_pairs,
        matchedCount: data.matched_pairs?.length ?? 0,
        hasSummary: !!data.summary
      });

      setResult(data);
      setIsProcessing(false);
      toast.success('Bank reconciliation complete! 🎉');
    } catch (err: any) {
      // Ignore abort errors (they're intentional when navigating away)
      if (err.name === 'AbortError') {
        console.log('🛑 Request aborted (component unmounted)');
        return;
      }
      
      let errorMessage = 'Failed to process reconciliation. Please try again.';
      
      // Provide more specific error messages
      if (err.message === 'Failed to fetch') {
        errorMessage = 'Unable to connect to the server. This could mean: (1) The Supabase Edge Function is not deployed, (2) Network connectivity issues, or (3) CORS configuration problem. Please check the browser console for more details.';
        console.error('🔥 FETCH ERROR - Possible causes:');
        console.error('   - Supabase Edge Function not deployed');
        console.error('   - Network connectivity issues');
        console.error('   - CORS configuration problem');
        console.error('   - projectId or publicAnonKey invalid');
        console.error('📍 Attempted URL:', `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/analyze-bank-rec`);
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsProcessing(false);
      toast.error(errorMessage);
      console.error('❌ Processing error:', err);
    }
  };

  const handleReset = () => {
    setBankFile(null);
    setLedgerFile(null);
    setError(null);
    setResult(null);
    setShowAllMatches(false);
    if (bankInputRef.current) bankInputRef.current.value = '';
    if (ledgerInputRef.current) ledgerInputRef.current.value = '';
  };

  const downloadSampleBankCsv = async () => {
    try {
      const response = await fetch('/test_bank_sample.csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_bank_statement.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Sample bank statement downloaded!');
    } catch (error) {
      console.error('Failed to download sample:', error);
      toast.error('Failed to download sample file');
    }
  };

  const downloadSampleLedgerCsv = async () => {
    try {
      const response = await fetch('/test_ledger_sample.csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_ledger.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Sample ledger downloaded!');
    } catch (error) {
      console.error('Failed to download sample:', error);
      toast.error('Failed to download sample file');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    
    try {
      // Handle various date formats: "15.03.2025", "2025-03-15", "15/03/2025"
      let date: Date;
      
      // Check if it's DD.MM.YYYY format
      if (dateStr.includes('.')) {
        const [day, month, year] = dateStr.split('.');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } 
      // Check if it's DD/MM/YYYY format
      else if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      // Otherwise use ISO or standard format
      else {
        date = new Date(dateStr);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateStr;
      }
      
      return date.toLocaleDateString('de-DE');
    } catch {
      return dateStr;
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

          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl text-white mb-4 font-extrabold">
              Bank <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Reconciliation</span> Demo
            </h1>
            <p className="text-lg sm:text-xl text-purple-200 max-w-3xl mx-auto">
              Upload your bank statement and ledger export. AI will match transactions, detect discrepancies, and suggest journal entries.
            </p>
          </div>

          {!result && !isProcessing && (
            <div className="max-w-4xl mx-auto">
              {/* Upload Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Bank Statement Upload */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                  <h3 className="text-xl text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    Bank Statement
                  </h3>
                  <input
                    ref={bankInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect('bank', e.target.files[0])}
                    className="hidden"
                  />
                  <div
                    onClick={() => bankInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      bankFile
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
                    }`}
                  >
                    {!bankFile ? (
                      <div className="space-y-3">
                        <Upload className="w-10 h-10 text-purple-300 mx-auto" />
                        <p className="text-white">Upload CSV or Excel</p>
                        <p className="text-purple-200/60 text-sm">Bank transactions</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                        <p className="text-white text-sm">{bankFile.name}</p>
                        <p className="text-purple-200/60 text-xs">
                          {(bankFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ledger Upload */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                  <h3 className="text-xl text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-fuchsia-400" />
                    Ledger Export
                  </h3>
                  <input
                    ref={ledgerInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect('ledger', e.target.files[0])}
                    className="hidden"
                  />
                  <div
                    onClick={() => ledgerInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      ledgerFile
                        ? 'border-fuchsia-500 bg-fuchsia-500/10'
                        : 'border-white/20 hover:border-fuchsia-500/50 hover:bg-white/5'
                    }`}
                  >
                    {!ledgerFile ? (
                      <div className="space-y-3">
                        <Upload className="w-10 h-10 text-fuchsia-300 mx-auto" />
                        <p className="text-white">Upload CSV or Excel</p>
                        <p className="text-purple-200/60 text-sm">Accounting ledger</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                        <p className="text-white text-sm">{ledgerFile.name}</p>
                        <p className="text-purple-200/60 text-xs">
                          {(ledgerFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-200 mb-2">{error}</p>
                      <div className="space-y-1">
                        <p className="text-red-200/60 text-sm">
                          💡 <strong>CSV format:</strong> Date, Description, Amount (with headers in first row)
                        </p>
                        <p className="text-red-200/60 text-sm">
                          📊 <strong>Excel format:</strong> Same columns in first sheet, first row = headers
                        </p>
                        <p className="text-red-200/60 text-sm">
                          🔍 Check browser console (F12) for detailed parsing logs
                        </p>
                        <p className="text-red-200/60 text-sm">
                          📥 Download our sample files below to see the expected format
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Process Button */}
              <Button
                onClick={handleProcess}
                disabled={!bankFile || !ledgerFile || isProcessing}
                className="w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-600 hover:via-fuchsia-600 hover:to-pink-600 text-white py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                Run Bank Reconciliation
              </Button>

              {/* Info & Sample Downloads */}
              <div className="text-center mt-6 space-y-3">
                <p className="text-purple-200/60 text-sm">
                  Supports CSV and Excel (.xlsx) files with columns: Date, Description, Amount
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button
                    onClick={downloadSampleBankCsv}
                    className="text-purple-300 hover:text-purple-200 text-sm underline underline-offset-2 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Bank Sample (CSV)
                  </button>
                  <span className="text-purple-200/40">•</span>
                  <button
                    onClick={downloadSampleLedgerCsv}
                    className="text-fuchsia-300 hover:text-fuchsia-200 text-sm underline underline-offset-2 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Ledger Sample (CSV)
                  </button>
                </div>
                <p className="text-purple-200/40 text-xs pt-1">
                  💡 Excel files work too! Just make sure they have the same columns.
                </p>
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="max-w-2xl mx-auto">
              <ProcessingStages type="bank-rec" />
            </div>
          )}

          {/* Results */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-2xl p-6">
                  <div className="text-purple-300 text-sm mb-2">Total Transactions</div>
                  <div className="text-3xl text-white">{result.summary.total_bank_transactions}</div>
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-2xl p-6">
                  <div className="text-green-300 text-sm mb-2">Matched</div>
                  <div className="text-3xl text-white">{result.summary.matched_count}</div>
                  <div className="text-green-300 text-xs mt-1">
                    {((result.summary.matched_count / result.summary.total_bank_transactions) * 100).toFixed(0)}% coverage
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-2xl p-6">
                  <div className="text-orange-300 text-sm mb-2">Unmatched</div>
                  <div className="text-3xl text-white">{result.summary.unmatched_bank_count}</div>
                </div>
                <div className={`bg-gradient-to-br ${
                  Math.abs(result.summary.difference) < 0.01
                    ? 'from-green-500/20 to-green-600/20 border-green-500/30'
                    : 'from-red-500/20 to-red-600/20 border-red-500/30'
                } border rounded-2xl p-6`}>
                  <div className={`text-sm mb-2 ${
                    Math.abs(result.summary.difference) < 0.01 ? 'text-green-300' : 'text-red-300'
                  }`}>Difference</div>
                  <div className={`text-3xl ${
                    Math.abs(result.summary.difference) < 0.01 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(result.summary.difference)}
                  </div>
                </div>
              </div>

              {/* Matched Transactions */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 sm:p-8">
                <h3 className="text-2xl text-white mb-6 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  Matched Transactions ({result.matched_pairs?.length ?? 0})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-purple-300 text-sm">Date</th>
                        <th className="text-left py-3 px-4 text-purple-300 text-sm">Description</th>
                        <th className="text-right py-3 px-4 text-purple-300 text-sm">Amount</th>
                        <th className="text-center py-3 px-4 text-purple-300 text-sm">Match Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const allMatches = result.matched_pairs ?? [];
                        const displayMatches = showAllMatches ? allMatches : allMatches.slice(0, 10);
                        return displayMatches.map((pair, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 px-4 text-white text-sm">
                              {formatDate(pair.bank_transaction.date)}
                            </td>
                            <td className="py-3 px-4 text-white text-sm">
                              {pair.bank_transaction.description}
                            </td>
                            <td className="py-3 px-4 text-white text-sm text-right">
                              {formatCurrency(pair.bank_transaction.amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs ${
                                pair.match_type === 'exact'
                                  ? 'bg-green-500/20 text-green-300'
                                  : pair.match_type === 'grouped'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : pair.match_type === 'timing_difference'
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : pair.match_type === 'fx_conversion'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}>
                                {pair.match_type}
                              </span>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                  {(result.matched_pairs?.length ?? 0) > 10 && (
                    <div className="text-center mt-4">
                      <Button
                        onClick={() => setShowAllMatches(!showAllMatches)}
                        className="bg-purple-500/20 border-2 border-purple-400/40 text-purple-200 hover:bg-purple-500/30 hover:border-purple-400/60 hover:text-white transition-all"
                      >
                        {showAllMatches 
                          ? 'Show Less' 
                          : `Show All ${result.matched_pairs.length} Matches`
                        }
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Unmatched Bank Transactions */}
              {result.unmatched_bank.length > 0 && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 sm:p-8">
                  <h3 className="text-2xl text-white mb-6 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-orange-400" />
                    Unmatched Bank Transactions ({result.unmatched_bank.length})
                  </h3>
                  <div className="space-y-4">
                    {result.unmatched_bank.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-white">
                              {formatDate(item.transaction.date)} - {item.transaction.description}
                            </div>
                            <div className="text-orange-300 text-sm mt-1">
                              {item.suggested_action}
                            </div>
                          </div>
                          <div className="text-white text-right">
                            {formatCurrency(item.transaction.amount)}
                          </div>
                        </div>
                        {item.suggested_je && (
                          <div className="mt-3 bg-black/20 rounded p-3 text-sm">
                            <div className="text-purple-300 mb-1">Suggested Journal Entry:</div>
                            <div className="text-white/80">
                              DR {item.suggested_je.debit_account} | CR {item.suggested_je.credit_account}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={handleReset}
                  className="px-8 py-6 text-lg bg-purple-500/20 border-2 border-purple-400/40 text-purple-200 hover:bg-purple-500/30 hover:border-purple-400/60 hover:text-white transition-all"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Try Another Reconciliation
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-gradient-to-b from-purple-950/40 to-violet-950/30 border-t border-white/5 py-16">
        <div className="max-w-6xl mx-auto px-6">
          {/* Headline */}
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
              Transform Your Bank Reconciliation Process
            </h3>
            <p className="text-lg text-purple-200/80" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Stop spending hours on manual reconciliation. Let AI handle the complexity while your team focuses on strategic analysis.
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-8 h-8 text-purple-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                90%
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Time Saved
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Reduce reconciliation time from 4-6 hours to under 30 minutes per month
              </p>
            </div>

            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-green-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                €15K+
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Annual Savings
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Per accountant through reduced manual work and faster period close
              </p>
            </div>

            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
                <Target className="w-8 h-8 text-cyan-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                95%
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Match Accuracy
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                AI catches complex patterns like FX conversions, grouped payments, and timing differences
              </p>
            </div>
          </div>

          {/* What Gets Automated */}
          <div className="mt-12">
            <h4 className="text-2xl text-white text-center mb-8" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
              What Gets Automated
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h5 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Intelligent Matching
                    </h5>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Exact matches, fuzzy matching for description variations, many-to-one grouping for installment payments
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h5 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      FX Gain/Loss Detection
                    </h5>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Automatically identifies foreign exchange differences and suggests correct journal entries
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h5 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Timing Difference Tracking
                    </h5>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Distinguishes between true unmatched items and transactions clearing in different periods
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h5 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Smart Journal Entry Suggestions
                    </h5>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Generates ready-to-post journal entries for bank fees, interest income, and other unmatched items
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-12">
            <p className="text-lg text-purple-200 mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Typical accounting teams spend <span className="text-white font-bold">4-6 hours monthly</span> on bank reconciliation across multiple entities.
            </p>
            <p className="text-xl text-white" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
              <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Free your team to focus on analysis, not data matching.
              </span>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}