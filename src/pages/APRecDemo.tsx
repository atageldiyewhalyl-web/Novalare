import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, ArrowLeft, CheckCircle, AlertCircle, Download, Clock, DollarSign, Target, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner@2.0.3";
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { motion, AnimatePresence } from "motion/react";
import { ProcessingStages } from "../components/ProcessingStages";

interface VendorInvoice {
  invoice_number: string;
  date: string;
  amount: number;
  status?: string;
  description?: string;
}

interface InternalAPEntry {
  invoice_number: string;
  date: string;
  amount: number;
  status?: string;
  vendor?: string;
}

interface MatchedInvoice {
  vendor_invoice: VendorInvoice;
  internal_entry: InternalAPEntry;
  match_type: string; // 'exact' | 'fuzzy'
}

interface AmountMismatch {
  invoice_number: string;
  vendor_amount: number;
  internal_amount: number;
  difference: number;
  notes: string;
}

interface MissingInvoice {
  invoice: VendorInvoice;
  reason: string;
  action: string;
}

interface InternalOnlyInvoice {
  invoice: InternalAPEntry;
  reason: string;
  action: string;
}

interface DuplicateInvoice {
  invoice_number: string;
  occurrences: number;
  entries: InternalAPEntry[];
}

interface APReconciliationResult {
  summary: {
    vendor_name: string;
    statement_date: string;
    total_vendor_invoices: number;
    total_internal_entries: number;
    matched_count: number;
    amount_mismatches_count: number;
    missing_invoices_count: number;
    internal_only_count: number;
    duplicates_count: number;
    vendor_total: number;
    internal_total: number;
    difference: number;
  };
  matched_invoices: MatchedInvoice[];
  amount_mismatches: AmountMismatch[];
  missing_invoices: MissingInvoice[];
  internal_only_invoices: InternalOnlyInvoice[];
  duplicates: DuplicateInvoice[];
}

export function APRecDemo() {
  const navigate = useNavigate();
  const [vendorFile, setVendorFile] = useState<File | null>(null);
  const [apLedgerFile, setAPLedgerFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<APReconciliationResult | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const vendorInputRef = useRef<HTMLInputElement>(null);
  const apInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = (type: 'vendor' | 'ap', file: File) => {
    // Validate file type
    const validTypes = [
      'text/csv',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.pdf')) {
      toast.error('Please upload a CSV, PDF, or Excel file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    if (type === 'vendor') {
      setVendorFile(file);
    } else {
      setAPLedgerFile(file);
    }

    toast.success(`${file.name} uploaded successfully`);
  };

  const handleReconcile = async () => {
    if (!vendorFile || !apLedgerFile) {
      toast.error('Please upload both vendor statement and AP ledger files');
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('vendor_statement', vendorFile);
      formData.append('ap_ledger', apLedgerFile);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/reconcile-ap`,
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
      setResult(data);
      toast.success('Reconciliation completed successfully!');
    } catch (err: any) {
      // Ignore abort errors (they're intentional when navigating away)
      if (err.name === 'AbortError') {
        console.log('🛑 Request aborted (component unmounted)');
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during reconciliation';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Reconciliation error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setVendorFile(null);
    setAPLedgerFile(null);
    setResult(null);
    setError(null);
    setShowAllMatches(false);
    if (vendorInputRef.current) vendorInputRef.current.value = '';
    if (apInputRef.current) apInputRef.current.value = '';
  };

  const handleExportExcel = async () => {
    if (!result) return;

    try {
      toast.info('Generating Excel report...');

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
        throw new Error('Excel export failed');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AP_Reconciliation_${result.summary.vendor_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Excel report downloaded successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export Excel report';
      toast.error(errorMessage);
      console.error('Excel export error:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('de-DE');
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
              AP Vendor Statement Reconciliation
            </h1>
            <p 
              className="text-xl text-purple-200/80 max-w-3xl mx-auto"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Automatically reconcile vendor statements with your internal AP ledger. 
              Detect missing invoices, amount mismatches, and duplicates in seconds.
            </p>
          </div>

          {/* Upload Section */}
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              {!result && !isProcessing && (
                <motion.div
                  key="upload-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
                >
                  {/* Vendor Statement Upload */}
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8 flex flex-col">
                    <div className="flex-1 flex flex-col">
                      <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-purple-300" />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2 text-center" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Vendor Statement
                      </h3>
                      <p className="text-purple-200/70 text-sm mb-6 text-center h-10 flex items-center justify-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Upload the vendor's monthly statement (PDF, CSV, or Excel)
                      </p>

                      <input
                        ref={vendorInputRef}
                        type="file"
                        accept=".csv,.pdf,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect('vendor', file);
                        }}
                        className="hidden"
                        id="vendor-upload"
                      />
                      
                      <label htmlFor="vendor-upload" className="w-full">
                        <Button
                          type="button"
                          className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white"
                          onClick={() => document.getElementById('vendor-upload')?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Select Vendor Statement
                        </Button>
                      </label>

                      {vendorFile && (
                        <div className="mt-4 p-3 bg-white/10 rounded-lg">
                          <p className="text-sm text-white truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {vendorFile.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AP Ledger Upload */}
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8 flex flex-col">
                    <div className="flex-1 flex flex-col">
                      <div className="w-16 h-16 mx-auto mb-4 bg-violet-500/20 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-violet-300" />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2 text-center" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Internal AP Ledger
                      </h3>
                      <p className="text-purple-200/70 text-sm mb-6 text-center h-10 flex items-center justify-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        Upload your internal AP records (CSV or Excel export)
                      </p>

                      <input
                        ref={apInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect('ap', file);
                        }}
                        className="hidden"
                        id="ap-upload"
                      />
                      
                      <label htmlFor="ap-upload" className="w-full">
                        <Button
                          type="button"
                          className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                          onClick={() => document.getElementById('ap-upload')?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Select AP Ledger
                        </Button>
                      </label>

                      {apLedgerFile && (
                        <div className="mt-4 p-3 bg-white/10 rounded-lg">
                          <p className="text-sm text-white truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {apLedgerFile.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Reconcile Button */}
              {!result && !isProcessing && (
                <motion.div
                  key="reconcile-button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <Button
                    onClick={handleReconcile}
                    disabled={!vendorFile || !apLedgerFile || isProcessing}
                    className="px-12 py-6 text-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Reconcile AP
                  </Button>

                  {error && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Processing Stages Animation */}
              {isProcessing && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-2xl mx-auto"
                >
                  <ProcessingStages type="ap-rec" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results Section */}
            {result && result.summary && (
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
                        {result.summary.matched_count || 0}
                      </span>
                    </div>
                    <p className="text-green-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Matched Invoices
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <AlertCircle className="w-8 h-8 text-amber-400" />
                      <span className="text-3xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {result.summary.amount_mismatches_count || 0}
                      </span>
                    </div>
                    <p className="text-amber-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Amount Mismatches
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <XCircle className="w-8 h-8 text-red-400" />
                      <span className="text-3xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {result.summary.missing_invoices_count || 0}
                      </span>
                    </div>
                    <p className="text-red-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Missing Invoices
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <AlertCircle className="w-8 h-8 text-blue-400" />
                      <span className="text-3xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {result.summary.internal_only_count || 0}
                      </span>
                    </div>
                    <p className="text-blue-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Internal Only
                    </p>
                  </div>
                </div>

                {/* Summary Information */}
                <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-8">
                  <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Reconciliation Summary
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-purple-200/70 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Vendor Name</p>
                      <p className="text-white text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>{result.summary.vendor_name}</p>
                    </div>
                    <div>
                      <p className="text-purple-200/70 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Statement Date</p>
                      <p className="text-white text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>{formatDate(result.summary.statement_date)}</p>
                    </div>
                    <div>
                      <p className="text-purple-200/70 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Vendor Total</p>
                      <p className="text-white text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>{formatCurrency(result.summary.vendor_total)}</p>
                    </div>
                    <div>
                      <p className="text-purple-200/70 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Internal Total</p>
                      <p className="text-white text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>{formatCurrency(result.summary.internal_total)}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-purple-200/70 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Difference</p>
                      <p className={`text-lg font-bold ${Math.abs(result.summary.difference) < 0.01 ? 'text-green-400' : 'text-amber-400'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {formatCurrency(result.summary.difference)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Amount Mismatches */}
                {result.amount_mismatches && result.amount_mismatches.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-amber-500/20 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <AlertCircle className="w-6 h-6 text-amber-400" />
                      <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Amount Mismatches ({result.amount_mismatches.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Invoice #</th>
                            <th className="text-right py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Vendor Amount</th>
                            <th className="text-right py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Internal Amount</th>
                            <th className="text-right py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Difference</th>
                            <th className="text-left py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.amount_mismatches.map((mismatch, idx) => (
                            <tr key={`mismatch-${idx}`} className="border-b border-white/5">
                              <td className="py-3 px-4 text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{mismatch.invoice_number}</td>
                              <td className="py-3 px-4 text-right text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{formatCurrency(mismatch.vendor_amount)}</td>
                              <td className="py-3 px-4 text-right text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{formatCurrency(mismatch.internal_amount)}</td>
                              <td className="py-3 px-4 text-right text-amber-400 font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>{formatCurrency(mismatch.difference)}</td>
                              <td className="py-3 px-4 text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>{mismatch.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Missing Invoices */}
                {result.missing_invoices && result.missing_invoices.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-red-500/20 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <XCircle className="w-6 h-6 text-red-400" />
                      <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Missing Invoices ({result.missing_invoices.length})
                      </h3>
                    </div>
                    <p className="text-purple-200/70 text-sm mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      These invoices appear on the vendor statement but not in your internal AP ledger
                    </p>
                    <div className="space-y-4">
                      {result.missing_invoices.map((missing, idx) => (
                        <div key={`missing-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-white font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {missing.invoice.invoice_number}
                              </p>
                              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formatDate(missing.invoice.date)} • {formatCurrency(missing.invoice.amount)}
                              </p>
                            </div>
                            {missing.invoice.status && (
                              <span className="px-3 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">
                                {missing.invoice.status}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-purple-200 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                              <strong>Reason:</strong> {missing.reason}
                            </p>
                            <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                              <strong>Action:</strong> {missing.action}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Internal Only Invoices */}
                {result.internal_only_invoices && result.internal_only_invoices.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-blue-500/20 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <AlertCircle className="w-6 h-6 text-blue-400" />
                      <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Internal Only Invoices ({result.internal_only_invoices.length})
                      </h3>
                    </div>
                    <p className="text-purple-200/70 text-sm mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      These invoices are in your AP ledger but not on the vendor statement
                    </p>
                    <div className="space-y-4">
                      {result.internal_only_invoices.map((internal, idx) => (
                        <div key={`internal-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-white font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {internal.invoice.invoice_number}
                              </p>
                              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formatDate(internal.invoice.date)} • {formatCurrency(internal.invoice.amount)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-purple-200 text-sm mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
                              <strong>Reason:</strong> {internal.reason}
                            </p>
                            <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                              <strong>Action:</strong> {internal.action}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duplicates */}
                {result.duplicates && result.duplicates.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-purple-500/20 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <AlertCircle className="w-6 h-6 text-purple-400" />
                      <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Duplicate Invoices ({result.duplicates.length})
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {result.duplicates.map((dup, idx) => (
                        <div key={`dup-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-4">
                          <p className="text-white font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {dup.invoice_number} - {dup.occurrences} occurrences
                          </p>
                          <div className="space-y-2">
                            {dup.entries.map((entry, entryIdx) => (
                              <p key={`dup-entry-${idx}-${entryIdx}`} className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {formatDate(entry.date)} • {formatCurrency(entry.amount)} • {entry.status}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched Invoices */}
                {result.matched_invoices && result.matched_invoices.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-green-500/20 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-400" />
                        <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                          Matched Invoices ({result.matched_invoices.length})
                        </h3>
                      </div>
                      {result.matched_invoices.length > 5 && (
                        <Button
                          onClick={() => setShowAllMatches(!showAllMatches)}
                          variant="ghost"
                          className="text-purple-200 hover:text-white"
                        >
                          {showAllMatches ? 'Show Less' : 'Show All'}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(showAllMatches ? result.matched_invoices : result.matched_invoices.slice(0, 5)).map((match, idx) => (
                        <div key={`match-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                          <div>
                            <p className="text-white font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                              {match.vendor_invoice.invoice_number}
                            </p>
                            <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                              {formatDate(match.vendor_invoice.date)} • {formatCurrency(match.vendor_invoice.amount)}
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                            {match.match_type === 'exact' ? 'Exact Match' : 'Matched'}
                          </span>
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
                    Try Another Reconciliation
                  </Button>
                  <Button
                    onClick={handleExportExcel}
                    className="px-8 py-6 text-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white hover:from-purple-600 hover:to-fuchsia-600 transition-all"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
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
          {/* Headline */}
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}>
              Eliminate Manual AP Reconciliation
            </h3>
            <p className="text-lg text-purple-200/80" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Stop spending hours with Excel VLOOKUPs. Automate vendor statement reconciliation and catch errors before they become problems.
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-8 h-8 text-purple-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                98%
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Time Reduction
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                From 30-45 minutes per vendor to under 1 minute with AI automation
              </p>
            </div>

            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-green-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                €25K+
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Annual Savings
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Per company reconciling 50-100 vendors monthly
              </p>
            </div>

            <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
                <Target className="w-8 h-8 text-cyan-300" />
              </div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                99%
              </div>
              <h4 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                Detection Accuracy
              </h4>
              <p className="text-purple-200/70 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                AI identifies missing invoices, duplicates, and amount mismatches
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
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h5 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      OCR + Data Extraction
                    </h5>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Automatically extracts invoice numbers, dates, amounts, and statuses from vendor PDF statements
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h5 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Intelligent Matching
                    </h5>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Matches vendor invoices with internal AP records using invoice numbers and smart fuzzy matching
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h5 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Exception Detection
                    </h5>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Flags missing invoices, amount mismatches, duplicates, and internal-only entries
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h5 className="text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
                      Actionable Recommendations
                    </h5>
                    <p className="text-purple-200 text-sm" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      Provides clear next steps for each exception: record credit, investigate discrepancy, contact vendor
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-12">
            <p className="text-lg text-purple-200 mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Typical AP teams spend <span className="text-white font-bold">20-40 hours monthly</span> manually reconciling vendor statements.
            </p>
            <p className="text-xl text-white" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
              <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Free your AP team from Excel hell. Focus on vendor relationships, not data entry.
              </span>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}