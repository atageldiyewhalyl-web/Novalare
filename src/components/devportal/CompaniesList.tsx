import { Building, Plus, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { companiesApi, settingsApi, Company, Settings } from '@/utils/api-client';
import { AddCompanyDialog } from './AddCompanyDialog';

interface CompaniesListProps {
  onNavigate: (view: string, params?: any) => void;
}

export function CompaniesList({ onNavigate }: CompaniesListProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [companiesData, settingsData] = await Promise.all([
        companiesApi.getAll(),
        settingsApi.get(),
      ]);
      setCompanies(companiesData);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load companies:', err);
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
          <p className="text-gray-600">Loading companies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <Button onClick={loadData} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  const activeCompanies = companies.filter(c => c.status === 'Active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">Companies</h1>
          <p className="text-gray-500 mt-1">Manage your client companies</p>
        </div>
        <AddCompanyDialog onSuccess={loadData} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 text-gray-600 text-sm">Company Name</th>
                  <th className="text-left py-4 px-6 text-gray-600 text-sm">Country</th>
                  <th className="text-left py-4 px-6 text-gray-600 text-sm">Status</th>
                  <th className="text-left py-4 px-6 text-gray-600 text-sm">Documents This Month</th>
                  <th className="text-left py-4 px-6 text-gray-600 text-sm">Last Activity</th>
                  <th className="text-left py-4 px-6 text-gray-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <Building className="size-5 text-white" />
                        </div>
                        <span className="text-sm text-gray-900">{company.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant="outline" className="text-xs">{company.country}</Badge>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                        {company.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">{company.docsThisMonth?.toLocaleString() || 0}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="size-4" />
                        <span className="text-sm">{company.lastActivity}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 h-8 text-xs"
                        onClick={() => onNavigate('company', { companyId: company.id })}
                      >
                        Open
                        <ExternalLink className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Building className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-900">You're using {activeCompanies.length} of {settings?.companyLimit || 20} company slots</p>
            <p className="text-xs text-gray-600">on your {settings?.plan || 'Pro'} plan</p>
          </div>
        </div>
        <Button variant="outline" size="sm">Upgrade Plan</Button>
      </div>
    </div>
  );
}