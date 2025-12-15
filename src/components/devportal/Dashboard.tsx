import { Building, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { companiesApi, invoicesApi, receiptsApi, Company, Invoice, Receipt } from '@/utils/api-client';
import { AddCompanyDialog } from './AddCompanyDialog';
import { useTheme } from '@/contexts/ThemeContext';

interface DashboardProps {
  onNavigate: (view: string, params?: any) => void;
}

interface CompanyWithPendingCount extends Company {
  pendingCount: number;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { theme } = useTheme();
  const [companies, setCompanies] = useState<CompanyWithPendingCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds to catch new emails
    const interval = setInterval(() => {
      loadDataSilently();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const companiesData = await companiesApi.getAll();
      
      // Load pending counts for each company
      const companiesWithCounts = await Promise.all(
        companiesData.map(async (company) => {
          try {
            const [invoices, receipts] = await Promise.all([
              invoicesApi.getByCompany(company.id),
              receiptsApi.getByCompany(company.id),
            ]);
            
            const pendingInvoices = invoices.filter(inv => inv.status === 'Pending').length;
            const pendingReceipts = receipts.filter(rec => rec.status === 'Pending').length;
            
            return {
              ...company,
              pendingCount: pendingInvoices + pendingReceipts,
            };
          } catch (err) {
            console.error(`Failed to load pending count for company ${company.id}:`, err);
            return {
              ...company,
              pendingCount: 0,
            };
          }
        })
      );
      
      setCompanies(companiesWithCounts);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  // Silent refresh without showing loading spinner
  const loadDataSilently = async () => {
    try {
      const companiesData = await companiesApi.getAll();
      
      const companiesWithCounts = await Promise.all(
        companiesData.map(async (company) => {
          try {
            const [invoices, receipts] = await Promise.all([
              invoicesApi.getByCompany(company.id),
              receiptsApi.getByCompany(company.id),
            ]);
            
            const pendingInvoices = invoices.filter(inv => inv.status === 'Pending').length;
            const pendingReceipts = receipts.filter(rec => rec.status === 'Pending').length;
            
            return {
              ...company,
              pendingCount: pendingInvoices + pendingReceipts,
            };
          } catch (err) {
            return {
              ...company,
              pendingCount: 0,
            };
          }
        })
      );
      
      setCompanies(companiesWithCounts);
      console.log('✅ Dashboard auto-refreshed');
    } catch (err) {
      console.error('Failed to auto-refresh dashboard:', err);
    }
  };
  
  // Manual refresh with visual feedback
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadDataSilently();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className={theme === 'premium-dark' 
            ? 'w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4' 
            : 'w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4'
          }></div>
          <p className={theme === 'premium-dark' ? 'text-purple-200' : 'text-gray-600'}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={theme === 'premium-dark' 
        ? 'p-6 bg-red-900/20 border border-red-500/30 rounded-lg' 
        : 'p-6 bg-red-50 border border-red-200 rounded-lg'
      }>
        <p className={theme === 'premium-dark' ? 'text-red-400' : 'text-red-600'}>Error: {error}</p>
        <Button onClick={loadData} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {/* Header - Ultra Minimal */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={theme === 'premium-dark' ? 'text-4xl text-white tracking-tight' : 'text-4xl text-gray-900 tracking-tight'}>Your Companies</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="icon"
            disabled={isRefreshing}
            className={theme === 'premium-dark'
              ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all'
              : 'border-gray-200 hover:bg-gray-50'
            }
            title="Refresh dashboard"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''} ${theme === 'premium-dark' ? 'text-purple-300' : 'text-gray-600'}`} />
          </Button>
          <AddCompanyDialog onSuccess={loadData} />
        </div>
      </div>

      {/* Companies Grid with Notification Badges */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => onNavigate('company', { companyId: company.id })}
              className={theme === 'premium-dark'
                ? 'group relative text-left bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/10 backdrop-blur-xl rounded-2xl p-6 hover:border-purple-500/40 transition-all duration-300 hover:shadow-[0_20px_60px_-15px_rgba(139,92,246,0.4)] hover:scale-[1.02]'
                : 'group relative text-left bg-white border border-gray-200 rounded-2xl p-6 hover:border-gray-300 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 hover:scale-[1.02]'
              }
            >
              {/* Notification Badge - Yellow Dot */}
              {company.pendingCount > 0 && (
                <div className="absolute -top-2 -right-2 z-10">
                  <div className="relative">
                    {/* Pulsing glow effect */}
                    <div className="absolute inset-0 size-6 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                    {/* Solid badge */}
                    <div className="relative size-6 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                      <span className="text-[10px] font-bold text-yellow-900">{company.pendingCount}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4">
                {/* Company Icon */}
                <div className={theme === 'premium-dark'
                  ? 'size-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center ring-1 ring-purple-500/30 group-hover:ring-purple-500/50 transition-all duration-300 flex-shrink-0'
                  : 'size-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center ring-1 ring-blue-200 group-hover:ring-blue-300 transition-all duration-300 flex-shrink-0'
                }>
                  <Building className={theme === 'premium-dark' ? 'size-7 text-purple-400' : 'size-7 text-blue-600'} />
                </div>

                {/* Company Info */}
                <div className="flex-1 min-w-0">
                  <h3 className={theme === 'premium-dark' 
                    ? 'text-base font-semibold text-white mb-1 truncate' 
                    : 'text-base font-semibold text-gray-900 mb-1 truncate'
                  }>
                    {company.name}
                  </h3>
                  <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/60 mb-2' : 'text-xs text-gray-500 mb-2'}>
                    {company.country}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={theme === 'premium-dark' 
                        ? company.status === 'Active' 
                          ? 'bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20 px-2 py-0.5 rounded-full' 
                          : 'bg-gray-500/10 text-gray-400 text-[10px] font-medium border border-gray-500/20 px-2 py-0.5 rounded-full'
                        : company.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-100 px-2 py-0.5 rounded-full'
                          : 'bg-gray-100 text-gray-600 text-[10px] font-medium border border-gray-200 px-2 py-0.5 rounded-full'
                      }
                    >
                      {company.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {companies.length === 0 && (
          <div className={theme === 'premium-dark'
            ? 'text-center py-16 px-4 border-2 border-dashed border-white/10 rounded-2xl'
            : 'text-center py-16 px-4 border-2 border-dashed border-gray-200 rounded-2xl'
          }>
            <Building className={theme === 'premium-dark' ? 'size-16 text-purple-500/30 mx-auto mb-4' : 'size-16 text-gray-300 mx-auto mb-4'} />
            <h3 className={theme === 'premium-dark' ? 'text-lg font-semibold text-white mb-2' : 'text-lg font-semibold text-gray-900 mb-2'}>
              No companies yet
            </h3>
            <p className={theme === 'premium-dark' ? 'text-sm text-purple-300/60 mb-6' : 'text-sm text-gray-500 mb-6'}>
              Get started by adding your first client company
            </p>
            <AddCompanyDialog onSuccess={loadData} />
          </div>
        )}
      </div>
    </div>
  );
}