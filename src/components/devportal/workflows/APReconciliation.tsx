import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function APReconciliation() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">AP Reconciliation</h1>
          <p className="text-gray-500 mt-1">Reconcile vendor statements with accounts payable</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 h-10">
            <Download className="size-4" />
            <span className="text-sm">Export Issues</span>
          </Button>
          <Button className="gap-2 h-10 bg-gray-900 hover:bg-gray-800">
            <Upload className="size-4" />
            <span className="text-sm">Run Reconciliation</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Matched Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">40</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Missing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-yellow-600">3</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Duplicates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-orange-600">1</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Amount Disputes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">2</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Total Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">€325.50</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issues Found</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Type</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Invoice #</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Vendor</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Statement Amt</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Ledger Amt</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Difference</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { type: 'Missing', invoice: '10122', vendor: 'DHL', statementAmt: '€320.50', ledgerAmt: '—', diff: '€320.50' },
                  { type: 'Amount Mismatch', invoice: '88321', vendor: 'DHL', statementAmt: '€145.00', ledgerAmt: '€140.00', diff: '€5.00' },
                  { type: 'Duplicate', invoice: '77234', vendor: 'Office Depot', statementAmt: '€234.00', ledgerAmt: '€468.00', diff: '€234.00' },
                ].map((issue, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="size-4 text-red-500" />
                        <span className="text-sm text-gray-900">{issue.type}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900">{issue.invoice}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{issue.vendor}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{issue.statementAmt}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{issue.ledgerAmt}</td>
                    <td className="py-4 px-4 text-sm text-red-600">{issue.diff}</td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-xs">Create JE</Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">Flag</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
