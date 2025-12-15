import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Download,
} from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface TrialBalanceReviewProps {
  companyId: string;
  companyName: string;
  period: string;
  onBack: () => void;
}

interface TrialBalanceResult {
  isBalanced: boolean;
  structuralErrors: any[];
  analyticalWarnings: any[];
  summary: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
    totalAccounts: number;
    totalRevenue: number;
    totalExpenses: number;
  };
  entries: any[];
  canClose: boolean;
  uploadedAt: string;
}

export function TrialBalanceReview({ companyId, companyName, period, onBack }: TrialBalanceReviewProps) {
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing trial balance on mount
  useEffect(() => {
    loadTrialBalance();
  }, []);

  const loadTrialBalance = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/trial-balance/get?companyId=${companyId}&period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTrialBalance(data);
      } else if (response.status === 404) {
        // No trial balance uploaded yet
        setTrialBalance(null);
      } else {
        console.error('Failed to load trial balance:', await response.text());
      }
    } catch (error) {
      console.error('Error loading trial balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

    setIsUploading(true);

    try {
      // Calculate previous period for variance analysis
      const [year, month] = period.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1); // -2 because month is 1-indexed
      const previousPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('period', period);
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
        setTrialBalance(data);

        if (data.structuralErrors.length > 0) {
          toast.error('Trial Balance has structural errors and cannot be closed.');
        } else if (data.analyticalWarnings.length > 0) {
          toast.warning(`Trial Balance uploaded with ${data.analyticalWarnings.length} warnings.`);
        } else {
          toast.success('Trial Balance uploaded and validated successfully!');
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload trial balance');
        console.error('Upload error:', error);
      }
    } catch (error) {
      console.error('Error uploading trial balance:', error);
      toast.error('Failed to upload trial balance. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadTemplate = async () => {
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

  const exportToExcel = async () => {
    if (!trialBalance) return;

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['TRIAL BALANCE SUMMARY'],
        [''],
        ['Company', companyName],
        ['Period', period],
        ['Upload Date', new Date(trialBalance.uploadedAt).toLocaleString()],
        [''],
        ['Total Debits', trialBalance.summary.totalDebits.toFixed(2)],
        ['Total Credits', trialBalance.summary.totalCredits.toFixed(2)],
        ['Difference', trialBalance.summary.difference.toFixed(2)],
        ['Status', trialBalance.isBalanced ? 'BALANCED' : 'UNBALANCED'],
        [''],
        ['Total Accounts', trialBalance.summary.totalAccounts],
        ['Total Revenue', trialBalance.summary.totalRevenue.toFixed(2)],
        ['Total Expenses', trialBalance.summary.totalExpenses.toFixed(2)],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Entries sheet
      const entriesData = [['Account Name', 'Account Code', 'Debit', 'Credit', 'Balance']];
      trialBalance.entries.forEach((entry) => {
        entriesData.push([
          entry.account_name || '',
          entry.account_code || '',
          entry.debit.toFixed(2),
          entry.credit.toFixed(2),
          (entry.debit - entry.credit).toFixed(2),
        ]);
      });
      const entriesSheet = XLSX.utils.aoa_to_sheet(entriesData);
      XLSX.utils.book_append_sheet(wb, entriesSheet, 'Entries');

      // Errors sheet (if any)
      if (trialBalance.structuralErrors.length > 0) {
        const errorsData = [['Type', 'Title', 'Message', 'Recommendation']];
        trialBalance.structuralErrors.forEach((error) => {
          errorsData.push([error.type, error.title, error.message, error.recommendation]);
        });
        const errorsSheet = XLSX.utils.aoa_to_sheet(errorsData);
        XLSX.utils.book_append_sheet(wb, errorsSheet, 'Errors');
      }

      // Warnings sheet (if any)
      if (trialBalance.analyticalWarnings.length > 0) {
        const warningsData = [['Type', 'Title', 'Message', 'Account', 'Recommendation']];
        trialBalance.analyticalWarnings.forEach((warning) => {
          warningsData.push([
            warning.type,
            warning.title,
            warning.message,
            warning.details?.account || '',
            warning.recommendation,
          ]);
        });
        const warningsSheet = XLSX.utils.aoa_to_sheet(warningsData);
        XLSX.utils.book_append_sheet(wb, warningsSheet, 'Warnings');
      }

      XLSX.writeFile(wb, `TrialBalance_${companyName}_${period}.xlsx`);
      toast.success('Trial Balance exported successfully!');
    } catch (error) {
      console.error('Error exporting trial balance:', error);
      toast.error('Failed to export trial balance');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Month-End Close
          </Button>
          <div>
            <h1 className="text-3xl text-gray-900">Trial Balance Review</h1>
            <p className="text-gray-500 mt-1">
              {companyName} • {period}
            </p>
          </div>
        </div>

        {trialBalance && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="size-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="sm" onClick={handleFileSelect}>
              <Upload className="size-4 mr-2" />
              Re-upload
            </Button>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="size-12 text-purple-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Loading trial balance...</p>
            </div>
          </CardContent>
        </Card>
      ) : !trialBalance ? (
        /* Upload Section */
        <Card>
          <CardHeader>
            <CardTitle>Upload Trial Balance</CardTitle>
            <CardDescription>
              Upload an Excel or CSV file containing your trial balance for {period}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-purple-400 transition-colors">
              {isUploading ? (
                <div>
                  <Loader2 className="size-12 text-purple-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Uploading and analyzing trial balance...</p>
                </div>
              ) : (
                <div>
                  <FileSpreadsheet className="size-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">
                    Click to upload your trial balance or drag and drop
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={handleFileSelect}>
                      <Upload className="size-4 mr-2" />
                      Choose File
                    </Button>
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="size-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    Supported formats: Excel (.xlsx, .xls) or CSV
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Required columns: Account Name, Debit, Credit (or Balance)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Trial Balance Results */
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {trialBalance.isBalanced ? (
                    <CheckCircle2 className="size-12 text-green-600" />
                  ) : (
                    <XCircle className="size-12 text-red-600" />
                  )}
                  <div>
                    <h3 className="text-xl text-gray-900">
                      {trialBalance.isBalanced ? 'Trial Balance is Balanced' : 'Trial Balance is Unbalanced'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {trialBalance.canClose
                        ? 'No structural errors found. You may proceed with month-end close.'
                        : 'Structural errors prevent month-end close. Please resolve errors before proceeding.'}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    trialBalance.canClose
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }
                >
                  {trialBalance.canClose ? 'Can Close' : 'Cannot Close'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Total Debits</div>
                <div className="text-2xl text-gray-900 mt-1">
                  €{trialBalance.summary.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Total Credits</div>
                <div className="text-2xl text-gray-900 mt-1">
                  €{trialBalance.summary.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Difference</div>
                <div
                  className={`text-2xl mt-1 ${
                    trialBalance.summary.difference < 0.01 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  €{trialBalance.summary.difference.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Structural Errors (Hard Stops) */}
          {trialBalance.structuralErrors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <XCircle className="size-5 text-red-600" />
                  <CardTitle className="text-red-900">
                    Structural Errors ({trialBalance.structuralErrors.length})
                  </CardTitle>
                </div>
                <CardDescription className="text-red-700">
                  These errors prevent month-end close and must be resolved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {trialBalance.structuralErrors.map((error, idx) => (
                  <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm text-red-900">{error.title}</h4>
                          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                            {error.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-red-800 mb-2">{error.message}</p>
                        {error.details && (
                          <div className="text-xs text-red-700 mb-2 p-2 bg-red-100 rounded">
                            <div>Total Debits: €{error.details.totalDebits?.toFixed(2)}</div>
                            <div>Total Credits: €{error.details.totalCredits?.toFixed(2)}</div>
                            <div className="">
                              Difference: €{error.details.difference?.toFixed(2)}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-red-700">
                          <strong>Action:</strong> {error.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Analytical Warnings (Soft Warnings) */}
          {trialBalance.analyticalWarnings.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-yellow-600" />
                  <CardTitle className="text-yellow-900">
                    Analytical Warnings ({trialBalance.analyticalWarnings.length})
                  </CardTitle>
                </div>
                <CardDescription className="text-yellow-700">
                  These warnings indicate unusual balances or variances but do not block month-end close.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {trialBalance.analyticalWarnings.map((warning, idx) => (
                  <div key={idx} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="size-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm text-yellow-900">{warning.title}</h4>
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                            {warning.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-yellow-800 mb-2">{warning.message}</p>
                        {warning.details && warning.details.account && (
                          <div className="text-xs text-yellow-700 mb-2 p-2 bg-yellow-100 rounded">
                            <div>Account: {warning.details.account}</div>
                            {warning.details.currentBalance !== undefined && (
                              <div>
                                Current Balance: €
                                {Math.abs(warning.details.currentBalance).toFixed(2)}
                              </div>
                            )}
                            {warning.details.percentChange !== undefined && (
                              <div>
                                Change vs Prior Month: {warning.details.percentChange.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-yellow-700">
                          <strong>Suggestion:</strong> {warning.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* All Clear */}
          {trialBalance.structuralErrors.length === 0 && trialBalance.analyticalWarnings.length === 0 && (
            <Card className="border-green-200">
              <CardContent className="py-8">
                <div className="text-center">
                  <CheckCircle2 className="size-12 text-green-600 mx-auto mb-3" />
                  <h3 className="text-lg text-green-900 mb-2">Trial Balance Looks Great!</h3>
                  <p className="text-sm text-green-700">
                    No errors or warnings detected. Your books are balanced and ready for month-end close.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
