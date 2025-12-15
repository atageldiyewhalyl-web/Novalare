import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

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

interface TrialBalanceUploadProps {
  companyId: string;
  period: string;
  trialBalance: TrialBalance | null;
  onUploaded: (data: TrialBalance) => void;
}

export function TrialBalanceUpload({ companyId, period, trialBalance, onUploaded }: TrialBalanceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/month-end-close/${period}/trial-balance/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload trial balance');
      }

      const data = await response.json();
      onUploaded(data);
    } catch (error) {
      console.error('Failed to upload trial balance:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">
            2
          </div>
          <CardTitle>Load Trial Balance</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!trialBalance ? (
          <>
            <p className="text-sm text-gray-600">
              Upload your trial balance from QuickBooks so AI can analyze it and suggest adjusting entries.
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-300 transition-colors">
              <FileSpreadsheet className="size-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-1">
                Upload Trial Balance (Excel or CSV)
              </p>
              <p className="text-xs text-gray-500 mb-4">
                In QuickBooks: Reports → Accountant & Taxes → Trial Balance → Export
              </p>
              
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="trial-balance-upload"
                disabled={isUploading}
              />
              <label htmlFor="trial-balance-upload">
                <Button
                  type="button"
                  onClick={() => document.getElementById('trial-balance-upload')?.click()}
                  disabled={isUploading}
                  className="gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" />
                      Upload Trial Balance
                    </>
                  )}
                </Button>
              </label>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="size-4 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-900">{uploadError}</p>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm text-blue-900 mb-2">💡 How to export from QuickBooks:</h4>
              <ol className="list-decimal ml-5 space-y-1 text-sm text-blue-800">
                <li>Open QuickBooks and go to <strong>Reports</strong></li>
                <li>Select <strong>Accountant & Taxes</strong></li>
                <li>Click <strong>Trial Balance</strong></li>
                <li>Set the date to the end of the period (e.g., 12/31/2024)</li>
                <li>Click <strong>Export</strong> and save as Excel or CSV</li>
                <li>Upload the exported file here</li>
              </ol>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-green-900 mb-1">Trial Balance Loaded</p>
                  <div className="space-y-1">
                    <p className="text-xs text-green-700">
                      <strong>File:</strong> {trialBalance.fileName}
                    </p>
                    <p className="text-xs text-green-700">
                      <strong>Uploaded:</strong> {new Date(trialBalance.uploadedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-green-700">
                      <strong>Accounts:</strong> {trialBalance.accounts.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm text-gray-900">Balance Check</h4>
                  {trialBalance.isBalanced ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="size-4" />
                      <span className="text-xs">Balanced</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="size-4" />
                      <span className="text-xs">Out of Balance</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Debits:</span>
                  <span className="text-gray-900">${trialBalance.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Credits:</span>
                  <span className="text-gray-900">${trialBalance.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-900">Difference:</span>
                  <span className={trialBalance.isBalanced ? 'text-green-600' : 'text-red-600'}>
                    ${Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Need to upload a different file?
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="trial-balance-reupload"
                disabled={isUploading}
              />
              <label htmlFor="trial-balance-reupload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('trial-balance-reupload')?.click()}
                  disabled={isUploading}
                >
                  Re-upload
                </Button>
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
