import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function MonthEndClose() {
  const steps = [
    { name: 'Bank Reconciliations', status: 'completed', date: 'Mar 29, 2024' },
    { name: 'AP Reconciliations', status: 'completed', date: 'Mar 28, 2024' },
    { name: 'Invoice Extraction Completed', status: 'completed', date: 'Mar 29, 2024' },
    { name: 'Recurring JEs Generated', status: 'completed', date: 'Mar 31, 2024' },
    { name: 'Variance Analysis', status: 'in-progress', date: 'In progress' },
    { name: 'Final Reports Exported', status: 'pending', date: 'Not started' },
    { name: 'Period Close & Lock', status: 'pending', date: 'Not started' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">Month-End Close</h1>
          <p className="text-gray-500 mt-1">Complete your month-end closing procedures</p>
        </div>
        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
          In Progress - March 2024
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Completed Steps</CardTitle>
            <CheckCircle2 className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">4 / 7</div>
            <p className="text-xs text-gray-500 mt-1">57% complete</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">In Progress</CardTitle>
            <Clock className="size-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-yellow-600">1</div>
            <p className="text-xs text-gray-500 mt-1">Variance Analysis</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Estimated Completion</CardTitle>
            <Clock className="size-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">Apr 2</div>
            <p className="text-xs text-gray-500 mt-1">Based on current progress</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Closing Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div 
                key={idx} 
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                  step.status === 'completed' 
                    ? 'border-green-200 bg-green-50/50' 
                    : step.status === 'in-progress'
                    ? 'border-yellow-200 bg-yellow-50/50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="size-6 text-green-600" />
                  ) : step.status === 'in-progress' ? (
                    <Circle className="size-6 text-yellow-600 fill-yellow-100" />
                  ) : (
                    <Circle className="size-6 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm text-gray-900">{step.name}</p>
                    <p className="text-xs text-gray-500">{step.date}</p>
                  </div>
                </div>
                {step.status !== 'completed' && (
                  <Button 
                    size="sm" 
                    variant={step.status === 'in-progress' ? 'default' : 'outline'}
                    className="h-8"
                  >
                    {step.status === 'in-progress' ? 'Continue' : 'Start'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Period Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-4">Key Metrics</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Revenue</span>
                  <span className="text-sm text-gray-900">€45,320.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Expenses</span>
                  <span className="text-sm text-gray-900">€32,145.50</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Net Income</span>
                  <span className="text-sm text-green-600">€13,174.50</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-4">Documents Processed</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Invoices</span>
                  <span className="text-sm text-gray-900">380</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Bank Statements</span>
                  <span className="text-sm text-gray-900">4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Vendor Statements</span>
                  <span className="text-sm text-gray-900">12</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
