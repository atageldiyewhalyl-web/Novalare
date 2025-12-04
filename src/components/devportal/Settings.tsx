import { CreditCard, Building, Download, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';
import { settingsApi, companiesApi, Settings as SettingsType, Company } from '@/utils/api-client';
import { toast } from 'sonner';

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [settingsData, companiesData] = await Promise.all([
        settingsApi.get(),
        companiesApi.getAll(),
      ]);
      setSettings(settingsData);
      setCompanies(companiesData);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error || 'Failed to load settings'}</p>
        <Button onClick={loadData} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  const activeCompanies = companies.filter(c => c.status === 'Active');
  const usagePercentage = (activeCompanies.length / settings.companyLimit) * 100;

  const plans = [
    { 
      name: 'Starter', 
      price: '€49', 
      companies: '5', 
      features: ['Up to 5 companies', 'Unlimited documents', '3 team members', 'Email support'],
      current: false
    },
    { 
      name: 'Pro', 
      price: '€149', 
      companies: '20', 
      features: ['Up to 20 companies', 'Unlimited documents', '10 team members', 'Priority support'], 
      current: settings.plan === 'Pro'
    },
    { 
      name: 'Scale', 
      price: '€349', 
      companies: '50', 
      features: ['Up to 50 companies', 'Unlimited documents', 'Unlimited team members', '24/7 support'],
      current: false
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-gray-900">Settings & Billing</h1>
        <p className="text-gray-500 mt-1">Manage your plan, billing, and company limits</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Current Plan</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl text-gray-900">{settings.plan} Plan</h3>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">Active</Badge>
              </div>
              <p className="text-sm text-gray-600">€{settings.price}/{settings.billingCycle}</p>
              <p className="text-xs text-gray-500 mt-1">Next billing date: {new Date(settings.nextBillingDate).toLocaleDateString()}</p>
            </div>
            <Button variant="outline" size="sm">Change Plan</Button>
          </div>
          <div className="border-t border-gray-200 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-600 mb-1">Company Limit</p>
                <p className="text-2xl text-gray-900">{settings.companyLimit}</p>
                <p className="text-xs text-gray-500 mt-1">Active companies allowed</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Document Processing</p>
                <p className="text-2xl text-gray-900">Unlimited</p>
                <p className="text-xs text-gray-500 mt-1">Documents per month</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Team Members</p>
                <p className="text-2xl text-gray-900">10</p>
                <p className="text-xs text-gray-500 mt-1">User seats included</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Company Usage</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building className="size-4 text-gray-500" />
                <span className="text-sm text-gray-900">Active Companies</span>
              </div>
              <span className="text-sm text-gray-900">{activeCompanies.length} of {settings.companyLimit}</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
          </div>
          {usagePercentage > 80 && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="size-4 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-900 mb-1">You're using {activeCompanies.length} of {settings.companyLimit} company slots</p>
                <p className="text-xs text-gray-600">
                  Consider upgrading to Scale plan for up to 50 companies, or archive inactive companies to free up slots.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usage This Month</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-900">Documents Processed</p>
                <p className="text-xs text-gray-500">Across all companies</p>
              </div>
              <p className="text-2xl text-gray-900">
                {companies.reduce((sum, c) => sum + (c.docsThisMonth || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-900">API Calls</p>
                <p className="text-xs text-gray-500">Automation runs</p>
              </div>
              <p className="text-2xl text-gray-900">1,247</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">AI Processing Cost</p>
                <p className="text-xs text-gray-500">Internal tracking only</p>
              </div>
              <p className="text-2xl text-gray-900">€142</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Available Plans</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, idx) => (
              <div 
                key={idx} 
                className={`p-6 border-2 rounded-lg ${
                  plan.current ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg text-gray-900">{plan.name}</h3>
                  {plan.current && <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">Current</Badge>}
                </div>
                <div className="mb-4">
                  <span className="text-3xl text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-600">/month</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, fidx) => (
                    <li key={fidx} className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="size-1.5 rounded-full bg-blue-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  variant={plan.current ? 'secondary' : 'outline'} 
                  className="w-full h-9 text-sm" 
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : 'Upgrade'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <CreditCard className="size-8 text-gray-400" />
              <div>
                <p className="text-sm text-gray-900">•••• •••• •••• 4242</p>
                <p className="text-xs text-gray-500">Expires 12/2025</p>
              </div>
            </div>
            <Button variant="outline" size="sm">Update</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Billing History</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { date: 'Mar 1, 2024', amount: `€${settings.price}.00`, status: 'Paid' },
              { date: 'Feb 1, 2024', amount: `€${settings.price}.00`, status: 'Paid' },
              { date: 'Jan 1, 2024', amount: `€${settings.price}.00`, status: 'Paid' },
            ].map((invoice, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-gray-900">{invoice.date}</p>
                    <p className="text-xs text-gray-500">{invoice.amount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                    {invoice.status}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-8 gap-2">
                    <Download className="size-3" />
                    <span className="text-xs">Download</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}