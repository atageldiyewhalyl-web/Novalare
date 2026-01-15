import { Search, Grid3x3, List, Plus, ChevronLeft, ChevronRight, Clock, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, lazy, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { companiesApi, Company, monthEndApi } from '@/utils/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { supabase } from '@/utils/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load heavy components
const CompanyCard = lazy(() => import('./CompanyCard').then(m => ({ default: m.CompanyCard })));
const AddCompanyChoiceDialog = lazy(() => import('./AddCompanyChoiceDialog').then(m => ({ default: m.AddCompanyChoiceDialog })));

interface CompanyListHomeProps {
  onCompanyClick?: (companyId: string) => void;
}

interface CompanyWithMetadata extends Company {
  id: string;
  name: string;
  qboConnected: boolean;
  currentMonthStatus: 'locked' | 'in-progress' | 'not-started';
  pendingItemsCount: number;
  lastActivity: string;
}

interface PaginationData {
  data: CompanyWithMetadata[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function CompanyListHome({ onCompanyClick }: CompanyListHomeProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [recentCompanyIds, setRecentCompanyIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const queryClient = useQueryClient();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery]);

  const { data: paginatedData, isLoading: loading, error } = useQuery<PaginationData, Error>({
    queryKey: ['companies', page, pageSize, debouncedSearchQuery],
    queryFn: async () => {
      // Get current period (e.g. "2023-10")
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const currentPeriod = `${year}-${month}`;

      // Single Optimized Call!
      // Pass the period to get status included in the response

      const response = await companiesApi.getAll(page, pageSize, debouncedSearchQuery, currentPeriod) as any;
      console.log('✅ Fetched companies:', response);

      // Status is now included in the company objects!
      const companies = response.data;
      const pagination = response.pagination;

      // Extract batch statuses from company objects
      const batchStatuses: Record<string, any> = {};
      companies.forEach((company: any) => {
        if (company.recStatus) {
          batchStatuses[company.id] = company.recStatus;
        }
      });

      // No separate call needed!
      // Filter valid companies first (still needed if API can return invalid IDs)
      const validCompanies = companies.filter((company: Company) => {
        return company.id && company.id !== 'undefined' && company.id !== 'null';
      });

      // Map companies with their statuses
      const companiesWithMetadata: CompanyWithMetadata[] = validCompanies.map((company: Company) => {
        const qboConnected = !!(company as any).qbo_connection_id;
        const lastActivity = (company as any).updatedAt || (company as any).createdAt || new Date().toISOString();

        // Get status from batch response
        const recStatus = batchStatuses[company.id];
        let currentMonthStatus: 'locked' | 'in-progress' | 'not-started' = 'not-started';

        if (recStatus?.allLocked) {
          currentMonthStatus = 'locked';
        } else if (recStatus?.hasActivity) {
          currentMonthStatus = 'in-progress';
        }

        return {
          ...company,
          id: company.id,
          name: company.name,
          qboConnected,
          currentMonthStatus,
          pendingItemsCount: recStatus?.unmatchedCount || 0,
          lastActivity
        };
      });

      return {
        data: companiesWithMetadata,
        pagination: response.pagination
      };
    },
    // @ts-ignore - keepPreviousData might be deprecated or renamed in newer react-query versions
    keepPreviousData: true,
  });

  const handleCompanyClick = async (companyId: string) => {
    if (!companyId || companyId === 'undefined') return;

    if (onCompanyClick) {
      onCompanyClick(companyId);
    } else {
      navigate(`/company/${companyId}`);
    }

    if (user?.id) {
      setRecentCompanyIds(prev => {
        const filtered = prev.filter(id => id !== companyId);
        return [companyId, ...filtered].slice(0, 3);
      });

      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const accessToken = session?.access_token || publicAnonKey;

          await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/api/users/${user.id}/recent-companies`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ companyId })
            }
          );
        } catch (err) {
          console.error('Failed to update recent companies:', err);
        }
      })();
    }
  };

  const companiesData = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

  const activeAndInactiveCompanies = companiesData.filter(c => c.status !== 'Archived');
  const recentCompanies = recentCompanyIds
    .slice(0, 3)
    .map(id => activeAndInactiveCompanies.find(c => c.id === id))
    .filter((c): c is CompanyWithMetadata => c !== undefined);

  const otherCompanies = activeAndInactiveCompanies.filter(c => !recentCompanyIds.slice(0, 3).includes(c.id));

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={`p-10 rounded-3xl border text-center ${theme === 'dark' ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
          <p className="text-red-500 font-semibold mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>Synchronization Error: {error.message}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['companies'] })} variant="outline">Try Again</Button>
        </div>
      </div>
    );
  }

  if (companiesData.length === 0 && page === 1 && !debouncedSearchQuery && !loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 md:px-0">
        {/* Background Glow Blobs - Same as main page */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className={`absolute -top-1/4 -right-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#65D3FD]/20' : 'bg-[#65D3FD]/30'}`} />
          <div className={`absolute -bottom-1/4 -left-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#4F5CFE]/10' : 'bg-[#4F5CFE]/20'}`} />
        </div>

        {/* Header - Same structure as main page */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
          <div className="relative">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-[#65D3FD] rounded-full hidden lg:block shadow-[0_0_15px_rgba(101,211,253,0.5)]" />
            <h1 className={`text-6xl font-black tracking-tighter mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
              Companies
            </h1>
            <p className="text-gray-500 font-medium text-lg max-w-xl leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Get started by adding your first company.
            </p>
          </div>
        </div>

        {/* Welcome Card - Using same glassmorphic style as CompanyCard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`
            relative rounded-3xl p-10 md:p-16 border transition-all duration-500
            ${theme === 'dark'
              ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10 backdrop-blur-xl'
              : 'bg-white border-gray-100 shadow-sm'}
          `}
        >
          <div className="flex flex-col items-center text-center max-w-xl mx-auto">
            {/* Icon Container - Same style as CompanyCard icons */}
            <div className={`
              size-20 rounded-2xl flex items-center justify-center p-[1px] mb-8
              bg-gradient-to-br from-[#65D3FD] via-[#65D3FD]/50 to-[#4F5CFE]
            `}>
              <div className={`
                w-full h-full rounded-[15px] flex items-center justify-center
                ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-white'}
              `}>
                <Building2 className="size-10 text-[#65D3FD]" />
              </div>
            </div>

            <h2 className={`text-3xl md:text-4xl font-bold mb-4 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
              Welcome to Novalare
            </h2>

            <p className={`text-base md:text-lg mb-10 leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
              Your financial intelligence platform is ready. Add your first company to start automating reconciliation with AI-powered matching.
            </p>

            <Suspense fallback={<Button disabled className="h-14 px-10 rounded-2xl bg-[#65D3FD]/50">Add Company</Button>}>
              <AddCompanyChoiceDialog
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['companies'] })}
                trigger={
                  <Button className="h-14 px-10 rounded-2xl bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black font-bold text-lg shadow-lg shadow-[#65D3FD]/20 transition-all hover:scale-[1.03] active:scale-95" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    <Plus className="size-5 mr-3 stroke-[3px]" />
                    Add Company
                  </Button>
                }
              />
            </Suspense>

            {/* Feature hints - subtle and matching */}
            <div className={`mt-12 pt-8 border-t w-full flex flex-wrap justify-center gap-6 md:gap-10 ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}>
              <span className={`flex items-center gap-2 text-sm font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="size-1.5 rounded-full bg-[#65D3FD]" />
                QuickBooks sync
              </span>
              <span className={`flex items-center gap-2 text-sm font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="size-1.5 rounded-full bg-[#4F5CFE]" />
                AI matching
              </span>
              <span className={`flex items-center gap-2 text-sm font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="size-1.5 rounded-full bg-emerald-500" />
                Auto reconciliation
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4 md:px-0">
      {/* Background Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className={`absolute -top-1/4 -right-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#65D3FD]/20' : 'bg-[#65D3FD]/30'}`} />
        <div className={`absolute -bottom-1/4 -left-1/4 size-[500px] rounded-full blur-[120px] opacity-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#4F5CFE]/10' : 'bg-[#4F5CFE]/20'}`} />
      </div>

      {/* Header - Ultra Premium */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-[#65D3FD] rounded-full hidden lg:block shadow-[0_0_15px_rgba(101,211,253,0.5)]" />
          <h1 className={`text-6xl font-black tracking-tighter mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
            Companies
          </h1>
          <p className="text-gray-500 font-medium text-lg max-w-xl leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Select a company to continue.
          </p>
        </div>

        <div className="flex items-center gap-5">
          <Suspense fallback={<Button disabled className="h-12 rounded-2xl bg-[#65D3FD]/50">Add Company</Button>}>
            <AddCompanyChoiceDialog
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['companies'] })}
              trigger={
                <Button className="h-12 px-8 rounded-2xl bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black font-extrabold shadow-lg shadow-[#65D3FD]/20 transition-all hover:scale-[1.05] active:scale-95" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <Plus className="size-5 mr-3 stroke-[3px]" />
                  Add Company
                </Button>
              }
            />
          </Suspense>

          <div className={`inline-flex p-1.5 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 ${viewMode === 'grid' ? (theme === 'dark' ? 'bg-[#65D3FD] text-black shadow-[0_0_20px_rgba(101,211,253,0.3)]' : 'bg-white text-[#65D3FD] shadow-md border-gray-100') : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Grid3x3 className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 ${viewMode === 'list' ? (theme === 'dark' ? 'bg-[#65D3FD] text-black shadow-[0_0_20px_rgba(101,211,253,0.3)]' : 'bg-white text-[#65D3FD] shadow-md border-gray-100') : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Search Section */}
      <div className="relative group max-w-4xl">
        <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 opacity-0 group-focus-within:opacity-20 ${theme === 'dark' ? 'bg-[#65D3FD]' : 'bg-[#65D3FD]'}`} />
        <div className="relative flex items-center">
          <Input
            type="text"
            placeholder="Search organizations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`
              pl-8 pr-16 h-16 rounded-full border-2 transition-all text-lg font-medium relative z-0
              ${theme === 'dark'
                ? 'bg-white/5 border-white/5 focus:border-[#65D3FD]/50 focus:bg-white/10 text-white placeholder:text-gray-600'
                : 'bg-white border-gray-100 focus:border-[#65D3FD]/40 focus:ring-[10px] focus:ring-[#65D3FD]/5 placeholder:text-gray-400 shadow-sm'}
            `}
            style={{ fontFamily: "'Manrope', sans-serif" }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${page}-${debouncedSearchQuery}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="space-y-12"
        >
          {/* Recently Viewed */}
          {recentCompanies.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-black flex items-center gap-3 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <span className="size-10 rounded-2xl bg-[#65D3FD]/10 flex items-center justify-center">
                    <Clock className="size-5 text-[#65D3FD]" />
                  </span>
                  Recently Viewed
                </h2>
                <div className="h-px flex-1 mx-8 bg-gradient-to-r from-[#65D3FD]/20 to-transparent" />
              </div>
              <div className={`grid gap-8 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                {recentCompanies.map((company, index) => (
                  <motion.div
                    key={company.id}
                    className="w-full"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <CompanyCard
                      {...company}
                      onClick={() => handleCompanyClick(company.id)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* All Companies */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-black flex items-center gap-3 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                <span className="size-10 rounded-2xl bg-[#4F5CFE]/10 flex items-center justify-center">
                  <Building2 className="size-5 text-[#4F5CFE]" />
                </span>
                {recentCompanies.length > 0 ? `Collaborative Index` : `All Organizations`}
                {loading && <Loader2 className="size-5 text-[#65D3FD] animate-spin inline-block ml-2" />}
              </h2>
              {pagination && pagination.total > 0 && (
                <div className="flex items-center gap-3">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[2px] border ${theme === 'dark' ? 'bg-[#65D3FD]/10 text-[#65D3FD] border-[#65D3FD]/20' : 'bg-[#65D3FD]/5 text-[#65D3FD] border-[#65D3FD]/10'}`}>
                    {pagination.total} Records Found
                  </span>
                </div>
              )}
            </div>

            <div className={`grid gap-8 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {(recentCompanies.length > 0 ? otherCompanies : companiesData).map((company, index) => (
                <motion.div
                  key={company.id}
                  className="w-full"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <CompanyCard
                    {...company}
                    onClick={() => handleCompanyClick(company.id)}
                  />
                </motion.div>
              ))}
            </div>

            {companiesData.length === 0 && debouncedSearchQuery && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`py-24 text-center rounded-[48px] border-2 border-dashed transition-all ${theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-gray-50'}`}
              >
                <Search className="size-16 text-gray-400 mx-auto mb-6 opacity-30" />
                <h3 className="text-2xl font-bold text-gray-500" style={{ fontFamily: "'Outfit', sans-serif" }}>No Match Detected</h3>
                <p className="text-gray-400 mt-2 font-medium" style={{ fontFamily: "'Manrope', sans-serif" }}>Refine your search parameters to locate specific entity records.</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Minimalist Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/5 pt-12">
          <Button
            variant="ghost"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="rounded-2xl h-14 px-8 hover:bg-[#65D3FD]/5 text-gray-500 hover:text-[#65D3FD] transition-all font-bold"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            <ChevronLeft className="size-5 mr-3" />
            Previous
          </Button>

          <div className="flex items-center gap-4">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
              .flatMap((p, idx, arr) => {
                const elements: React.ReactNode[] = [];
                if (idx > 0 && p - arr[idx - 1] > 1) elements.push(<span key={`ell-${p}`} className="text-gray-600 font-black">...</span>);
                elements.push(
                  <button
                    key={`p-${p}`}
                    onClick={() => setPage(p)}
                    className={`size-12 rounded-2xl font-black transition-all ${p === page ? 'bg-[#65D3FD] text-black shadow-[0_10px_20px_-5px_rgba(101,211,253,0.4)] scale-110' : 'text-gray-500 hover:text-[#65D3FD] hover:bg-[#65D3FD]/5'}`}
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {p}
                  </button>
                );
                return elements;
              })}
          </div>

          <Button
            variant="ghost"
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages || loading}
            className="rounded-2xl h-14 px-8 hover:bg-[#65D3FD]/5 text-gray-500 hover:text-[#65D3FD] transition-all font-bold"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Next
            <ChevronRight className="size-5 ml-3" />
          </Button>
        </div>
      )}
    </div>
  );
}