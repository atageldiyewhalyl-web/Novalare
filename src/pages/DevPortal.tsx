import { useAuth } from "@/contexts/AuthContext";
import { SEO } from "@/components/SEO";
import { ThemeToggle } from "@/components/devportal/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";

import { useNavigate } from "react-router-dom";
import {
  Building2,
  Home,
  Building,
  FileText,
  Landmark,
  Users,
  FileSpreadsheet,
  Calendar,
  Settings as SettingsIcon,
  ChevronDown,
  Menu,
  Webhook,
  BarChart3,
  LogOut,
  User,
  ReceiptText,
  CreditCard,
  Receipt,
} from "lucide-react";
import { useEffect, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// Lazy load view components for better performance
const Dashboard = lazy(() =>
  import("@/components/devportal/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const CompaniesList = lazy(() =>
  import("@/components/devportal/CompaniesList").then((m) => ({ default: m.CompaniesList }))
);
const CompanyWorkspace = lazy(() =>
  import("@/components/devportal/CompanyWorkspace").then((m) => ({ default: m.CompanyWorkspace }))
);
const InvoiceExtraction = lazy(() =>
  import("@/components/devportal/workflows/InvoiceExtraction").then((m) => ({ default: m.InvoiceExtraction }))
);
const ReceiptExtraction = lazy(() =>
  import("@/components/devportal/workflows/ReceiptExtraction_new").then((m) => ({ default: m.ReceiptExtraction }))
);
const BankReconciliation = lazy(() =>
  import("@/components/devportal/workflows/BankReconciliation").then((m) => ({ default: m.BankReconciliation }))
);
const APReconciliation = lazy(() =>
  import("@/components/devportal/workflows/APReconciliation").then((m) => ({ default: m.APReconciliation }))
);
const ARReconciliation = lazy(() =>
  import("@/components/devportal/workflows/ARReconciliation").then((m) => ({ default: m.ARReconciliation }))
);
const CreditCardReconciliation = lazy(() =>
  import("@/components/devportal/workflows/CreditCardReconciliation").then((m) => ({ default: m.CreditCardReconciliation }))
);
const JournalEntries = lazy(() =>
  import("@/components/devportal/workflows/JournalEntriesNew").then((m) => ({ default: m.JournalEntries }))
);
const MonthEndClose = lazy(() =>
  import("@/components/devportal/workflows/MonthEndClose").then((m) => ({ default: m.MonthEndClose }))
);
const Settings = lazy(() =>
  import("@/components/devportal/Settings").then((m) => ({ default: m.Settings }))
);
const WebhookTester = lazy(() =>
  import("@/components/devportal/WebhookTester").then((m) => ({ default: m.WebhookTester }))
);
const Analytics = lazy(() =>
  import("@/components/devportal/Analytics").then((m) => ({ default: m.Analytics }))
);
const ChartOfAccountsManager = lazy(() =>
  import("@/components/devportal/ChartOfAccountsManager").then((m) => ({ default: m.ChartOfAccountsManager }))
);

type ViewType =
  | "dashboard"
  | "company"
  | "invoice-extraction"
  | "receipt-extraction"
  | "bank-reconciliation"
  | "ap-reconciliation"
  | "ar-reconciliation"
  | "credit-card-reconciliation"
  | "journal-entries"
  | "month-end-close"
  | "chart-of-accounts"
  | "webhook-tester"
  | "analytics"
  | "settings";

interface ViewState {
  type: ViewType;
  params?: {
    companyId?: string;
    companyName?: string;
  };
}

export function DevPortal() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>({
    type: "dashboard",
  });

  const handleNavigate = (viewType: string, params?: any) => {
    setCurrentView({ type: viewType as ViewType, params });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return 'U';
    const names = user.fullName.split(' ');
    if (names.length >= 2) {
      return names[0][0] + names[1][0];
    }
    return user.fullName.substring(0, 2);
  };

  const renderView = () => {
    // Render all views and show/hide based on currentView
    // This keeps state intact when switching between views
    return (
      <>
        <div style={{ display: currentView.type === 'dashboard' ? 'block' : 'none' }}>
          <Dashboard onNavigate={handleNavigate} />
        </div>
        <div style={{ display: currentView.type === 'company' ? 'block' : 'none' }}>
          <CompanyWorkspace
            companyId={currentView.params?.companyId || "1"}
            onNavigate={handleNavigate}
            activeTab={currentView.params?.activeTab}
          />
        </div>
        <div style={{ display: currentView.type === 'invoice-extraction' ? 'block' : 'none' }}>
          <InvoiceExtraction
            companyId={currentView.params?.companyId}
          />
        </div>
        <div style={{ display: currentView.type === 'receipt-extraction' ? 'block' : 'none' }}>
          <ReceiptExtraction
            companyId={currentView.params?.companyId}
          />
        </div>
        <div style={{ display: currentView.type === 'bank-reconciliation' ? 'block' : 'none' }}>
          <BankReconciliation />
        </div>
        <div style={{ display: currentView.type === 'ap-reconciliation' ? 'block' : 'none' }}>
          <APReconciliation />
        </div>
        <div style={{ display: currentView.type === 'ar-reconciliation' ? 'block' : 'none' }}>
          <ARReconciliation />
        </div>
        <div style={{ display: currentView.type === 'credit-card-reconciliation' ? 'block' : 'none' }}>
          <CreditCardReconciliation />
        </div>
        <div style={{ display: currentView.type === 'journal-entries' ? 'block' : 'none' }}>
          <JournalEntries companyId={currentView.params?.companyId} companyName={currentView.params?.companyName} onNavigate={handleNavigate} />
        </div>
        <div style={{ display: currentView.type === 'chart-of-accounts' ? 'block' : 'none' }}>
          <ChartOfAccountsManager 
            companyId={currentView.params?.companyId || "demo_company"}
            companyName={currentView.params?.companyName || "Demo Company"}
          />
        </div>
        <div style={{ display: currentView.type === 'month-end-close' ? 'block' : 'none' }}>
          <MonthEndClose />
        </div>
        <div style={{ display: currentView.type === 'webhook-tester' ? 'block' : 'none' }}>
          <WebhookTester />
        </div>
        <div style={{ display: currentView.type === 'analytics' ? 'block' : 'none' }}>
          <Analytics />
        </div>
        <div style={{ display: currentView.type === 'settings' ? 'block' : 'none' }}>
          <Settings />
        </div>
      </>
    );
  };

  return (
    <div className={theme === 'premium-dark' ? 'min-h-screen bg-black' : 'min-h-screen bg-gray-50'}>
      {/* Block Google from indexing dashboard */}
      <SEO 
        title="Dashboard - Novalare"
        description="Novalare Dashboard"
        noindex={true}
      />
      
      {/* Top Bar */}
      <div className={theme === 'premium-dark' 
        ? 'fixed top-0 left-0 right-0 h-16 bg-black border-b border-purple-500/20 z-50' 
        : 'fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50'
      }>
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={theme === 'premium-dark'
                ? 'lg:hidden text-purple-200 hover:text-white hover:bg-purple-500/10'
                : 'lg:hidden'
              }
            >
              <Menu className="size-5" />
            </Button>
            <Building2 className={theme === 'premium-dark' ? 'size-6 text-purple-400' : 'size-6 text-blue-600'} />
            <span className={theme === 'premium-dark' 
              ? 'text-xl tracking-tight text-white' 
              : 'text-xl tracking-tight text-gray-900'
            }>
              Novalare
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className={theme === 'premium-dark' 
              ? 'text-purple-200 text-sm hidden md:block' 
              : 'text-gray-600 text-sm hidden md:block'
            }>
              {user?.firmName}
            </span>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={theme === 'premium-dark'
                    ? 'flex items-center gap-2 h-9 text-purple-200 hover:text-white hover:bg-purple-500/10'
                    : 'flex items-center gap-2 h-9'
                  }
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-purple-600 text-white text-xs">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className={theme === 'premium-dark' ? 'size-4 text-purple-300' : 'size-4 text-gray-500'} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className={theme === 'premium-dark' 
                  ? 'w-56 bg-gray-900 border-purple-500/20 text-white' 
                  : 'w-56'
                }
              >
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm">{user?.fullName}</span>
                    <span className={theme === 'premium-dark' ? 'text-xs text-purple-300/60' : 'text-xs text-gray-500'}>{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className={theme === 'premium-dark' ? 'bg-purple-500/20' : ''} />
                <DropdownMenuItem 
                  onClick={() => handleNavigate('settings')}
                  className={theme === 'premium-dark' 
                    ? 'text-purple-200 hover:bg-purple-500/10 hover:text-white focus:bg-purple-500/10 focus:text-white' 
                    : ''
                  }
                >
                  <User className="size-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className={theme === 'premium-dark' ? 'bg-purple-500/20' : ''} />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="text-red-600"
                >
                  <LogOut className="size-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={theme === 'premium-dark'
          ? `fixed left-0 top-16 bottom-0 w-64 bg-black border-r border-purple-500/20 overflow-y-auto transition-transform duration-200 z-40 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`
          : `fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto transition-transform duration-200 z-40 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`
        }
      >
        <nav className="p-4 space-y-1">
          <Button
            variant={
              currentView.type === "dashboard"
                ? "secondary"
                : "ghost"
            }
            className={theme === 'premium-dark'
              ? currentView.type === "dashboard"
                ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500"
                : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white"
              : "w-full justify-start gap-3 h-10"
            }
            onClick={() => handleNavigate("dashboard")}
          >
            <Home className="size-4" />
            <span className="text-sm">Home</span>
          </Button>

          <div className={theme === 'premium-dark'
            ? "pt-4 pb-2 px-3 text-xs text-purple-400/80 uppercase tracking-wider"
            : "pt-4 pb-2 px-3 text-xs text-gray-500 uppercase tracking-wider"
          }>
            Workflows
          </div>

          <Button
            variant={
              currentView.type === "invoice-extraction"
                ? "secondary"
                : "ghost"
            }
            className={theme === 'premium-dark'
              ? currentView.type === "invoice-extraction"
                ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500"
                : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white"
              : "w-full justify-start gap-3 h-10"
            }
            onClick={() => handleNavigate("invoice-extraction")}
          >
            <FileText className="size-4" />
            <span className="text-sm">Invoice Extraction</span>
          </Button>

          <Button
            variant={
              currentView.type === "receipt-extraction"
                ? "secondary"
                : "ghost"
            }
            className={theme === 'premium-dark'
              ? currentView.type === "receipt-extraction"
                ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500"
                : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white"
              : "w-full justify-start gap-3 h-10"
            }
            onClick={() => handleNavigate("receipt-extraction")}
          >
            <Receipt className="size-4" />
            <span className="text-sm">Receipt Extraction</span>
          </Button>

          <Button
            variant={
              currentView.type === "bank-reconciliation"
                ? "secondary"
                : "ghost"
            }
            className={theme === 'premium-dark'
              ? currentView.type === "bank-reconciliation"
                ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500 mt-3"
                : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white mt-3"
              : "w-full justify-start gap-3 h-10 mt-3"
            }
            onClick={() =>
              handleNavigate("bank-reconciliation")
            }
          >
            <Landmark className="size-4" />
            <span className="text-sm">Bank Reconciliation</span>
          </Button>

          <Button
            variant={
              currentView.type === "ap-reconciliation"
                ? "secondary"
                : "ghost"
            }
            className={theme === 'premium-dark'
              ? currentView.type === "ap-reconciliation"
                ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500"
                : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white"
              : "w-full justify-start gap-3 h-10"
            }
            onClick={() => handleNavigate("ap-reconciliation")}
          >
            <Users className="size-4" />
            <span className="text-sm">AP Reconciliation</span>
          </Button>

          {/* AR Reconciliation - Temporarily hidden from navigation
          <Button
            variant={
              currentView.type === "ar-reconciliation"
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start gap-3 h-10"
            onClick={() => handleNavigate("ar-reconciliation")}
          >
            <ReceiptText className="size-4" />
            <span className="text-sm">AR Reconciliation</span>
          </Button>
          */}

          <Button
            variant={
              currentView.type === "credit-card-reconciliation"
                ? "secondary"
                : "ghost"
            }
            className={theme === 'premium-dark'
              ? currentView.type === "credit-card-reconciliation"
                ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500"
                : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white"
              : "w-full justify-start gap-3 h-10"
            }
            onClick={() => handleNavigate("credit-card-reconciliation")}
          >
            <CreditCard className="size-4" />
            <span className="text-sm">Credit Card Reconciliation</span>
          </Button>

          <Button
            variant={
              currentView.type === "month-end-close"
                ? "secondary"
                : "ghost"
            }
            className={theme === 'premium-dark'
              ? currentView.type === "month-end-close"
                ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500 mt-3"
                : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white mt-3"
              : "w-full justify-start gap-3 h-10 mt-3"
            }
            onClick={() => handleNavigate("month-end-close")}
          >
            <Calendar className="size-4" />
            <span className="text-sm">Month-End Close</span>
          </Button>

          <Button
            variant={
              currentView.type === "journal-entries"
                ? "secondary"
                : "ghost"
            }
            className={theme === 'premium-dark'
              ? currentView.type === "journal-entries"
                ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500"
                : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white"
              : "w-full justify-start gap-3 h-10"
            }
            onClick={() => handleNavigate("journal-entries")}
          >
            <FileSpreadsheet className="size-4" />
            <span className="text-sm">Journal Entries</span>
          </Button>

          <div className={theme === 'premium-dark'
            ? "pt-4 border-t border-purple-500/20 mt-4"
            : "pt-4 border-t border-gray-200 mt-4"
          }>
            <Button
              variant={
                currentView.type === "settings"
                  ? "secondary"
                  : "ghost"
              }
              className={theme === 'premium-dark'
                ? currentView.type === "settings"
                  ? "w-full justify-start gap-3 h-10 bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500"
                  : "w-full justify-start gap-3 h-10 text-purple-200 hover:bg-purple-500/10 hover:text-white"
                : "w-full justify-start gap-3 h-10"
              }
              onClick={() => handleNavigate("settings")}
            >
              <SettingsIcon className="size-4" />
              <span className="text-sm">
                Settings & Billing
              </span>
            </Button>

            <div className={theme === 'premium-dark'
              ? "mt-6 pt-4 border-t border-purple-500/20"
              : "mt-6 pt-4 border-t border-gray-200"
            }>
              <Button
                variant="ghost"
                className={theme === 'premium-dark'
                  ? "w-full justify-start gap-3 h-10 text-purple-300 hover:text-white hover:bg-purple-500/10"
                  : "w-full justify-start gap-3 h-10 text-gray-500 hover:text-gray-900"
                }
                onClick={() => navigate("/")}
              >
                <Building2 className="size-4" />
                <span className="text-sm">
                  Back to Main Page
                </span>
              </Button>
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div
        className={`pt-16 transition-all duration-200 ${sidebarOpen ? "pl-64" : ""}`}
      >
        <main className="p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className={theme === 'premium-dark' 
                  ? 'w-12 h-12 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3' 
                  : 'w-12 h-12 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3'
                }></div>
                <p className={theme === 'premium-dark' ? 'text-purple-200 text-sm' : 'text-gray-500 text-sm'}>Loading view...</p>
              </div>
            </div>
          }>
            {renderView()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}