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
import novalareLogoImage from 'figma:asset/85a18c0f14d9634898763219441c014da1faf3e8.png';

// Lazy load view components for better performance
const Dashboard = lazy(() =>
  import("@/components/devportal/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const CompanyListHome = lazy(() =>
  import("@/components/devportal/CompanyListHome").then((m) => ({ default: m.CompanyListHome }))
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
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
          <CompanyListHome />
        </div>
        {currentView.type === 'company' && currentView.params?.companyId && (
          <div style={{ display: currentView.type === 'company' ? 'block' : 'none' }}>
            <CompanyWorkspace
              companyId={currentView.params.companyId}
              onNavigate={handleNavigate}
              activeTab={currentView.params?.activeTab}
            />
          </div>
        )}
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
          <MonthEndClose
            companyId={currentView.params?.companyId || "demo_company"}
            companyName={currentView.params?.companyName || "Demo Company"}
          />
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
    <div className="min-h-screen bg-gray-50">
      {/* Block Google from indexing dashboard */}
      <SEO
        title="Dashboard - Novalare"
        description="Novalare Dashboard"
        noindex={true}
      />

      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="size-5" />
            </Button>
            <img
              src={novalareLogoImage}
              alt="Novalare Logo"
              className="h-8"
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm hidden md:block">
              {user?.firmName}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 h-9"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-purple-600 text-white text-xs">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="size-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm">{user?.fullName}</span>
                    <span className="text-xs text-gray-500">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigate('settings')}>
                  <User className="size-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="size-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Sidebar - Collapsed by default, expands on hover */}
      <div
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`
          fixed left-0 top-16 bottom-0 overflow-y-auto transition-all duration-300 ease-in-out z-40
          ${sidebarExpanded ? 'w-64' : 'w-16'}
          bg-white border-r border-gray-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <nav className="p-3 space-y-2">
          {/* Home */}
          <Button
            variant={currentView.type === "dashboard" ? "secondary" : "ghost"}
            className={`
              w-full transition-all duration-300
              ${sidebarExpanded ? 'justify-start gap-3' : 'justify-center'}
              h-12
            `}
            onClick={() => handleNavigate("dashboard")}
          >
            <Home className="size-5 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm whitespace-nowrap">Home</span>}
          </Button>

          {/* Spacer */}
          <div className="border-t border-gray-200 my-4" />

          {/* Settings & Billing */}
          <Button
            variant={currentView.type === "settings" ? "secondary" : "ghost"}
            className={`
              w-full transition-all duration-300
              ${sidebarExpanded ? 'justify-start gap-3' : 'justify-center'}
              h-12
            `}
            onClick={() => handleNavigate("settings")}
          >
            <SettingsIcon className="size-5 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm whitespace-nowrap">Settings & Billing</span>}
          </Button>

          {/* Spacer */}
          <div className="border-t border-gray-200 my-4" />

          {/* Back to Main Page */}
          <Button
            variant="ghost"
            className={`
              w-full transition-all duration-300
              ${sidebarExpanded ? 'justify-start gap-3' : 'justify-center'}
              h-12
              text-gray-500 hover:text-gray-900
            `}
            onClick={() => navigate("/")}
          >
            <Building2 className="size-5 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm whitespace-nowrap">Back to Main Page</span>}
          </Button>
        </nav>
      </div>

      {/* Main Content - Adjusted for collapsed sidebar */}
      <div
        className={`pt-16 transition-all duration-300 ${sidebarExpanded ? 'pl-64' : 'pl-16'}`}
      >
        <main className="p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-12 h-12 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">Loading view...</p>
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