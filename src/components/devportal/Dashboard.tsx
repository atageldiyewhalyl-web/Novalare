import { Building, FileText, Clock, Euro, Plus, UserPlus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { companiesApi, metricsApi, Company, DashboardMetrics } from '@/utils/api-client';
import { AddCompanyDialog } from './AddCompanyDialog';

interface DashboardProps {
  onNavigate: (view: string, params?: any) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [companiesData, metricsData] = await Promise.all([
        companiesApi.getAll(),
        metricsApi.getDashboard(),
      ]);
      setCompanies(companiesData);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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
          <p className="text-gray-600">Loading dashboard...</p>
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your accounting operations</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 h-10">
            <UserPlus className="size-4" />
            <span className="text-sm">Invite teammates</span>
          </Button>
          <AddCompanyDialog onSuccess={loadData} />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Active Companies</CardTitle>
            <Building className="size-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-gray-900">{metrics?.activeCompanies || 0}</div>
            <p className="text-xs text-gray-500 mt-1">of 20 on Pro plan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Documents This Month</CardTitle>
            <FileText className="size-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-gray-900">{metrics?.documentsThisMonth?.toLocaleString() || 0}</div>
            <p className="text-xs text-green-600 mt-1">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">Hours Saved (est.)</CardTitle>
            <Clock className="size-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-gray-900">{metrics?.hoursSaved || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Based on automation runs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-gray-600">AI Usage Cost</CardTitle>
            <Euro className="size-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-gray-900">€{metrics?.aiUsageCost || 0}</div>
            <p className="text-xs text-gray-500 mt-1">This billing period</p>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Companies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Company</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Status</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Docs This Month</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm">Last Activity</th>
                  <th className="text-left py-3 px-4 text-gray-600 text-sm"></th>
                </tr>
              </thead>
              <tbody>
                {companies.slice(0, 4).map((company) => (
                  <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-md bg-blue-100 flex items-center justify-center">
                          <Building className="size-4 text-blue-600" />
                        </div>
                        <span className="text-sm text-gray-900">{company.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                        {company.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900">{company.docsThisMonth?.toLocaleString() || 0}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{company.lastActivity}</td>
                    <td className="py-4 px-4">
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
    </div>
  );
}