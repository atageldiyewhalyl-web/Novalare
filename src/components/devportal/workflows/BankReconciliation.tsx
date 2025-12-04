import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function BankReconciliation() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">Bank Reconciliation</h1>
          <p className="text-gray-500 mt-1">Match bank transactions with ledger entries</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 h-10">
            <Download className="size-4" />
            <span className="text-sm">Export Report</span>
          </Button>
          <Button className="gap-2 h-10 bg-gray-900 hover:bg-gray-800">
            <Upload className="size-4" />
            <span className="text-sm">Run Reconciliation</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">325</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">302</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Unmatched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-yellow-600">23</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">€0.00</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unmatched Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Date</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Description</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Suggestion</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: 'Mar 29', desc: 'PAYPAL *SOFTWARESU', amount: '€89.99', suggestion: 'IT Services' },
                  { date: 'Mar 28', desc: 'AMAZON EU SARL', amount: '€234.50', suggestion: 'Office Supplies' },
                  { date: 'Mar 27', desc: 'STRIPE PAYMENT', amount: '€1,450.00', suggestion: 'Revenue' },
                ].map((transaction, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 text-sm text-gray-900">{transaction.date}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{transaction.desc}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{transaction.amount}</td>
                    <td className="py-4 px-4">
                      <Badge variant="outline" className="text-xs">{transaction.suggestion}</Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-xs">Accept</Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">Ignore</Button>
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
