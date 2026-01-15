import { useParams, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Settings as SettingsIcon, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/devportal/ThemeToggle';
import { companiesApi, Company, invoicesApi, receiptsApi } from '@/utils/api-client';
import novalareLogoFull from 'figma:asset/908439ccf2fd74c9480e58b42d8e199750e72f73.png';

// Lazy load tab components
const CompanyOverview = lazy(() =>
  import('@/components/devportal/CompanyOverview').then((m) => ({ default: m.CompanyOverview }))
);
const ReconciliationsLanding = lazy(() =>
  import('@/components/devportal/ReconciliationsLanding').then((m) => ({ default: m.ReconciliationsLanding }))
);
const BankAccountList = lazy(() =>
  import('@/components/devportal/BankAccountList').then((m) => ({ default: m.BankAccountList }))
);
const BankReconciliation = lazy(() =>
  import('@/components/devportal/workflows/BankReconciliation').then((m) => ({ default: m.BankReconciliation }))
);
const CreditCardAccountList = lazy(() =>
  import('@/components/devportal/CreditCardAccountList').then((m) => ({ default: m.CreditCardAccountList }))
);
const APReconciliation = lazy(() =>
  import('@/components/devportal/workflows/APReconciliation').then((m) => ({ default: m.APReconciliation }))
);
const ARReconciliation = lazy(() =>
  import('@/components/devportal/workflows/ARReconciliation').then((m) => ({ default: m.ARReconciliation }))
);
const CreditCardReconciliation = lazy(() =>
  import('@/components/devportal/workflows/CreditCardReconciliation').then((m) => ({ default: m.CreditCardReconciliation }))
);
const ReceiptsInvoices = lazy(() =>
  import('@/components/devportal/ReceiptsInvoices').then((m) => ({ default: m.ReceiptsInvoices }))
);
const MonthEndClose = lazy(() =>
  import('@/components/devportal/workflows/MonthEndClose').then((m) => ({ default: m.MonthEndClose }))
);
const JournalEntries = lazy(() =>
  import('@/components/devportal/workflows/JournalEntriesNew').then((m) => ({ default: m.JournalEntries }))
);
const ChartOfAccountsManager = lazy(() =>
  import('@/components/devportal/ChartOfAccountsManager').then((m) => ({ default: m.ChartOfAccountsManager }))
);
const CompanyDocuments = lazy(() =>
  import('@/components/devportal/CompanyDocuments').then((m) => ({ default: m.CompanyDocuments }))
);
const CompanyIntegrations = lazy(() =>
  import('@/components/devportal/CompanyIntegrations').then((m) => ({ default: m.CompanyIntegrations }))
);
const CompanySettings = lazy(() =>
  import('@/components/devportal/CompanySettings').then((m) => ({ default: m.CompanySettings }))
);

// Loading component
function TabLoader() {
  return (
    <div className="flex items-center justify-center h-[400px]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#65D3FD] rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMonthEndNotification, setHasMonthEndNotification] = useState(false);
  const [pendingReceiptsInvoicesCount, setPendingReceiptsInvoicesCount] = useState(0);

  // Validate companyId and redirect if invalid
  useEffect(() => {
    if (!companyId || companyId === 'undefined') {
      console.error('Invalid company ID, redirecting to home');
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [companyId, navigate]);

  useEffect(() => {
    if (companyId && companyId !== 'undefined') {
      loadCompany();
      loadPendingCounts();
      // Check for month end notification
      const hasNotification = localStorage.getItem(`month-end-notification-${companyId}`) === 'true';
      setHasMonthEndNotification(hasNotification);
    }
  }, [companyId]);

  // Listen for storage changes (for when notification is set from another component)
  useEffect(() => {
    const handleStorageChange = () => {
      if (companyId) {
        const hasNotification = localStorage.getItem(`month-end-notification-${companyId}`) === 'true';
        setHasMonthEndNotification(hasNotification);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Also poll every second to catch localStorage changes in same tab
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [companyId]);

  // Poll for pending counts every 5 seconds
  useEffect(() => {
    if (companyId) {
      const interval = setInterval(() => {
        loadPendingCounts();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [companyId]);

  const loadCompany = async () => {
    // Validate companyId before making API call
    if (!companyId || companyId === 'undefined') {
      console.error('Cannot load company with invalid ID:', companyId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const companyData = await companiesApi.getById(companyId!);
      setCompany(companyData);
    } catch (err) {
      console.error('Failed to load company:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCounts = async () => {
    // Validate companyId before making API call
    if (!companyId || companyId === 'undefined') {
      return;
    }

    try {
      const [invoices, receipts] = await Promise.all([
        invoicesApi.getByCompany(companyId!).catch(() => []),
        receiptsApi.getByCompany(companyId!).catch(() => []),
      ]);

      const pendingInvoices = invoices.filter(inv => inv.status === 'Pending').length;
      const pendingReceipts = receipts.filter(rec => rec.status === 'Pending').length;

      setPendingReceiptsInvoicesCount(pendingInvoices + pendingReceipts);
    } catch (err) {
      console.error('Failed to load pending counts:', err);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const names = user.fullName.split(' ');
    if (names.length >= 2) {
      return names[0][0] + names[1][0];
    }
    return user.fullName.substring(0, 2);
  };

  // Get current tab from URL
  const getCurrentTab = () => {
    const path = window.location.pathname;
    if (path.includes('/overview')) return 'overview';
    if (path.includes('/reconciliations')) return 'reconciliations';
    if (path.includes('/receipts')) return 'receipts';
    if (path.includes('/month-end')) return 'month-end';
    if (path.includes('/journal-entries')) return 'journal-entries';
    if (path.includes('/settings')) return 'settings';
    return 'overview';
  };

  const currentTab = getCurrentTab();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#65D3FD] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading company...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Company not found</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-black' : 'bg-gray-50'}`}>
      {/* Top Navigation with Breadcrumb */}
      <header className={`
        sticky top-0 z-50 border-b
        ${theme === 'dark'
          ? 'bg-zinc-950 border-zinc-800'
          : 'bg-white border-gray-200'
        }
      `}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-3">
              <img
                src={novalareLogoFull}
                alt="Novalare"
                className="h-6 w-auto"
              />
              <button
                onClick={() => navigate('/dashboard')}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
                  ${theme === 'dark'
                    ? 'hover:bg-zinc-800 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <Home className="w-4 h-4" />
                <span className="text-sm">Home</span>
              </button>
              <span className={theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}>
                &gt;
              </span>
              <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {company.name}
              </span>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              <ThemeToggle />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`
                      flex items-center gap-2
                      ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}
                    `}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={`w-56 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white'}`}
                >
                  <DropdownMenuLabel className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    {user?.fullName || 'User'}
                  </DropdownMenuLabel>
                  <DropdownMenuLabel className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    {user?.email || ''}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className={theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'} />
                  <DropdownMenuItem
                    onClick={() => navigate('/dashboard/settings')}
                    className={theme === 'dark' ? 'text-gray-300 focus:bg-zinc-800' : 'focus:bg-gray-100'}
                  >
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className={theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'} />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className={`${theme === 'dark' ? 'text-red-400 focus:bg-zinc-800' : 'text-red-600 focus:bg-gray-100'}`}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`px-6 pt-4`}>
          <div className="flex items-center gap-1 border-b" style={{
            borderColor: theme === 'dark' ? 'rgba(63, 63, 70, 0.3)' : 'rgba(229, 231, 235, 0.6)'
          }}>
            <button
              onClick={() => navigate(`/company/${companyId}/overview`)}
              className={`
                px-4 py-3 text-sm transition-all border-b-2 -mb-[2px]
                ${currentTab === 'overview'
                  ? theme === 'dark'
                    ? 'border-[#65D3FD] text-[#65D3FD] font-medium'
                    : 'border-[#65D3FD] text-[#65D3FD] font-medium'
                  : theme === 'dark'
                    ? 'border-transparent text-gray-400 hover:text-gray-200'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Overview
            </button>
            <button
              onClick={() => navigate(`/company/${companyId}/reconciliations`)}
              className={`
                px-4 py-3 text-sm transition-all border-b-2 -mb-[2px]
                ${currentTab === 'reconciliations'
                  ? theme === 'dark'
                    ? 'border-[#65D3FD] text-[#65D3FD] font-medium'
                    : 'border-[#65D3FD] text-[#65D3FD] font-medium'
                  : theme === 'dark'
                    ? 'border-transparent text-gray-400 hover:text-gray-200'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Reconciliations
            </button>
            <button
              onClick={() => navigate(`/company/${companyId}/receipts`)}
              className={`
                px-4 py-3 text-sm transition-all border-b-2 whitespace-nowrap relative -mb-[2px]
                ${currentTab === 'receipts'
                  ? theme === 'dark'
                    ? 'border-[#65D3FD] text-[#65D3FD] font-medium'
                    : 'border-[#65D3FD] text-[#65D3FD] font-medium'
                  : theme === 'dark'
                    ? 'border-transparent text-gray-400 hover:text-gray-200'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Receipts & Invoices
              {pendingReceiptsInvoicesCount > 0 && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#65D3FD] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#65D3FD]"></span>
                </span>
              )}
            </button>
            <button
              onClick={() => {
                navigate(`/company/${companyId}/month-end`);
                // Clear notification when user clicks
                if (hasMonthEndNotification) {
                  localStorage.removeItem(`month-end-notification-${companyId}`);
                  setHasMonthEndNotification(false);
                }
              }}
              className={`
                px-4 py-3 text-sm transition-all border-b-2 whitespace-nowrap relative -mb-[2px]
                ${currentTab === 'month-end'
                  ? theme === 'dark'
                    ? 'border-[#65D3FD] text-[#65D3FD] font-medium'
                    : 'border-[#65D3FD] text-[#65D3FD] font-medium'
                  : theme === 'dark'
                    ? 'border-transparent text-gray-400 hover:text-gray-200'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Review Hub
              {hasMonthEndNotification && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#65D3FD] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#65D3FD]"></span>
                </span>
              )}
            </button>
            <button
              onClick={() => navigate(`/company/${companyId}/journal-entries`)}
              className={`
                px-4 py-3 text-sm transition-all border-b-2 whitespace-nowrap -mb-[2px]
                ${currentTab === 'journal-entries'
                  ? theme === 'dark'
                    ? 'border-[#65D3FD] text-[#65D3FD] font-medium'
                    : 'border-[#65D3FD] text-[#65D3FD] font-medium'
                  : theme === 'dark'
                    ? 'border-transparent text-gray-400 hover:text-gray-200'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Journal Entries
            </button>
            <button
              onClick={() => navigate(`/company/${companyId}/settings`)}
              className={`
                px-4 py-3 text-sm transition-all border-b-2 whitespace-nowrap -mb-[2px]
                ${currentTab === 'settings'
                  ? theme === 'dark'
                    ? 'border-[#65D3FD] text-[#65D3FD] font-medium'
                    : 'border-[#65D3FD] text-[#65D3FD] font-medium'
                  : theme === 'dark'
                    ? 'border-transparent text-gray-400 hover:text-gray-200'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-6 py-8">
        <Suspense fallback={<TabLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<CompanyOverview companyId={companyId!} companyName={company.name} />} />
            <Route path="reconciliations" element={<ReconciliationsLanding companyId={companyId!} />} />
            <Route path="reconciliations/bank" element={<BankAccountList companyId={companyId!} />} />
            <Route path="reconciliations/bank/:accountId" element={<BankReconciliation companyId={companyId!} />} />
            <Route path="reconciliations/ap" element={<APReconciliation companyId={companyId!} />} />
            <Route path="reconciliations/ar" element={<ARReconciliation companyId={companyId!} />} />
            <Route path="reconciliations/cc" element={<CreditCardAccountList companyId={companyId!} />} />
            <Route path="reconciliations/cc/:accountId" element={<CreditCardReconciliation companyId={companyId!} />} />
            <Route path="receipts" element={<ReceiptsInvoices companyId={companyId!} />} />
            <Route path="month-end" element={<MonthEndClose companyId={companyId!} companyName={company.name} />} />
            <Route path="journal-entries" element={<JournalEntries companyId={companyId!} companyName={company.name} onNavigate={() => { }} />} />
            <Route path="settings/*" element={<CompanySettings companyId={companyId!} companyName={company.name} />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}