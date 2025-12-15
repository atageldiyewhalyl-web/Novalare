import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function JournalEntries() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">Journal Entries</h1>
          <p className="text-gray-500 mt-1">Generate recurring and automated journal entries</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 h-10">
            <Download className="size-4" />
            <span className="text-sm">Export CSV</span>
          </Button>
          <Button className="gap-2 h-10 bg-gray-900 hover:bg-gray-800">
            <Plus className="size-4" />
            <span className="text-sm">Generate Entries</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recurring Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Name</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Type</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Frequency</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Next Run</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Rent Expense', type: 'Accrual', amount: '€2,500.00', frequency: 'Monthly', nextRun: 'Apr 1' },
                  { name: 'Depreciation - Equipment', type: 'Depreciation', amount: '€450.00', frequency: 'Monthly', nextRun: 'Apr 1' },
                  { name: 'Prepaid Insurance', type: 'Deferral', amount: '€150.00', frequency: 'Monthly', nextRun: 'Apr 1' },
                ].map((entry, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 text-sm text-gray-900">{entry.name}</td>
                    <td className="py-4 px-4">
                      <Badge variant="outline" className="text-xs">{entry.type}</Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900">{entry.amount}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{entry.frequency}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{entry.nextRun}</td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-xs">Edit</Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">Run Now</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Entries - March 2024</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">JE ID</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Date</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Description</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Debit Account</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Debit</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Credit Account</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Credit</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 'JE-001', date: 'Mar 31', desc: 'Rent Expense - March', debitAcct: '6100', debit: '€2,500.00', creditAcct: '2100', credit: '€2,500.00' },
                  { id: 'JE-002', date: 'Mar 31', desc: 'Depreciation - Equipment', debitAcct: '6200', debit: '€450.00', creditAcct: '1500', credit: '€450.00' },
                  { id: 'JE-003', date: 'Mar 31', desc: 'Prepaid Insurance Adjustment', debitAcct: '6300', debit: '€150.00', creditAcct: '1400', credit: '€150.00' },
                ].map((je, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 text-sm text-gray-900">{je.id}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{je.date}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{je.desc}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{je.debitAcct}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{je.debit}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{je.creditAcct}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{je.credit}</td>
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
