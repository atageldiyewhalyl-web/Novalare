import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, CheckCircle2, Loader2, Copy } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

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

interface ExportToQuickBooksProps {
  entries: AdjustingEntry[];
  companyId: string;
  period: string;
  onExported: () => void;
}

export function ExportToQuickBooks({ entries, companyId, period, onExported }: ExportToQuickBooksProps) {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingIIF, setIsExportingIIF] = useState(false);

  const draftEntries = entries.filter(e => e.status === 'draft');

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/month-end-close/${period}/export/excel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ entryIds: draftEntries.map(e => e.id) }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export to Excel');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novalare_adjusting_entries_${period}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onExported();
    } catch (error) {
      console.error('Failed to export to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportIIF = async () => {
    setIsExportingIIF(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/month-end-close/${period}/export/iif`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ entryIds: draftEntries.map(e => e.id) }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export to IIF');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novalare_adjusting_entries_${period}.iif`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onExported();
    } catch (error) {
      console.error('Failed to export to IIF:', error);
      alert('Failed to export to IIF. Please try again.');
    } finally {
      setIsExportingIIF(false);
    }
  };

  if (draftEntries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">
            5
          </div>
          <CardTitle>Export to QuickBooks</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 mb-1">
                {draftEntries.length} adjusting {draftEntries.length === 1 ? 'entry' : 'entries'} ready to export
              </p>
              <p className="text-xs text-blue-700">
                Total amount: ${draftEntries.reduce((sum, e) => sum + e.totalDebit, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="border rounded-lg p-4 hover:border-purple-300 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <FileSpreadsheet className="size-5 text-green-600" />
              <div className="flex-1">
                <h4 className="text-sm text-gray-900 mb-1">Export as Excel (Recommended)</h4>
                <p className="text-xs text-gray-600 mb-2">
                  Download entries in Excel format. Works with QuickBooks Online, Desktop, Xero, and most accounting software.
                </p>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-700 mb-1">How to import in QuickBooks:</p>
                  <ol className="list-decimal ml-4 space-y-0.5 text-xs text-gray-600">
                    <li>Download the Excel file</li>
                    <li>In QuickBooks, go to: Company → Import → Journal Entries</li>
                    <li>Select the downloaded Excel file</li>
                    <li>Review and confirm the import</li>
                  </ol>
                </div>
              </div>
            </div>
            <Button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="w-full gap-2"
            >
              {isExportingExcel ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Download Excel File
                </>
              )}
            </Button>
          </div>

          <div className="border rounded-lg p-4 hover:border-purple-300 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <FileSpreadsheet className="size-5 text-blue-600" />
              <div className="flex-1">
                <h4 className="text-sm text-gray-900 mb-1">Export as .IIF File</h4>
                <p className="text-xs text-gray-600 mb-2">
                  Download in QuickBooks Desktop import format (.IIF). Best for QuickBooks Desktop users.
                </p>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-700 mb-1">How to import in QuickBooks Desktop:</p>
                  <ol className="list-decimal ml-4 space-y-0.5 text-xs text-gray-600">
                    <li>Download the .IIF file</li>
                    <li>In QuickBooks Desktop, go to: File → Utilities → Import</li>
                    <li>Select "IIF Files"</li>
                    <li>Choose the downloaded file and import</li>
                  </ol>
                </div>
              </div>
            </div>
            <Button
              onClick={handleExportIIF}
              disabled={isExportingIIF}
              variant="outline"
              className="w-full gap-2"
            >
              {isExportingIIF ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Download .IIF File
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <div className="text-purple-600 text-xl">🚀</div>
            <div className="flex-1">
              <p className="text-sm text-purple-900 mb-1">Coming Soon: One-Click Sync</p>
              <p className="text-xs text-purple-700">
                Connect your QuickBooks account for direct one-click sync. No downloads needed!
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm text-gray-900 mb-2">After Exporting:</h4>
          <ol className="list-decimal ml-5 space-y-1 text-sm text-gray-600">
            <li>Import the file into QuickBooks</li>
            <li>Verify all entries posted correctly</li>
            <li>Run a new Trial Balance to confirm it's still balanced</li>
            <li>Review your financial statements (P&L and Balance Sheet)</li>
            <li>Close the period in QuickBooks to lock it</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
