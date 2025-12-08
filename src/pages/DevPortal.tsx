import { useNavigate } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
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
import { useAuth } from "@/contexts/AuthContext";

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
const BankReconciliation = lazy(() =>
  import("@/components/devportal/workflows/BankReconciliation").then((m) => ({ default: m.BankReconciliation }))
);
const APReconciliation = lazy(() =>
  import("@/components/devportal/workflows/APReconciliation").then((m) => ({ default: m.APReconciliation }))
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
  | "companies"
  | "company"
  | "invoice-extraction"
  | "bank-reconciliation"
  | "ap-reconciliation"
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
    switch (currentView.type) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "companies":
        return <CompaniesList onNavigate={handleNavigate} />;
      case "company":
        return (
          <CompanyWorkspace
            companyId={currentView.params?.companyId || "1"}
            onNavigate={handleNavigate}
          />
        );
      case "invoice-extraction":
        return (
          <InvoiceExtraction
            companyId={currentView.params?.companyId}
          />
        );
      case "bank-reconciliation":
        return <BankReconciliation />;
      case "ap-reconciliation":
        return <APReconciliation />;
      case "journal-entries":
        return <JournalEntries companyId={currentView.params?.companyId} companyName={currentView.params?.companyName} />;
      case "chart-of-accounts":
        return (
          <ChartOfAccountsManager 
            companyId={currentView.params?.companyId || "demo_company"}
            companyName={currentView.params?.companyName || "Demo Company"}
          />
        );
      case "month-end-close":
        return <MonthEndClose />;
      case "webhook-tester":
        return <WebhookTester />;
      case "analytics":
        return <Analytics />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
            <Building2 className="size-6 text-blue-600" />
            <span className="text-xl tracking-tight text-gray-900">
              Novalare
            </span>
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

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto transition-transform duration-200 z-40 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="p-4 space-y-1">
          <Button
            variant={
              currentView.type === "dashboard"
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start gap-3 h-10"
            onClick={() => handleNavigate("dashboard")}
          >
            <LayoutDashboard className="size-4" />
            <span className="text-sm">Dashboard</span>
          </Button>

          <Button
            variant={
              currentView.type === "companies" ||
              currentView.type === "company"
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start gap-3 h-10"
            onClick={() => handleNavigate("companies")}
          >
            <Building className="size-4" />
            <span className="text-sm">Companies</span>
          </Button>

          <div className="pt-4 pb-2 px-3 text-xs text-gray-500 uppercase tracking-wider">
            Workflows
          </div>

          <Button
            variant={
              currentView.type === "invoice-extraction"
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start gap-3 h-10"
            onClick={() => handleNavigate("invoice-extraction")}
          >
            <FileText className="size-4" />
            <span className="text-sm">Invoice Extraction</span>
          </Button>

          <Button
            variant={
              currentView.type === "bank-reconciliation"
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start gap-3 h-10"
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
            className="w-full justify-start gap-3 h-10"
            onClick={() => handleNavigate("ap-reconciliation")}
          >
            <Users className="size-4" />
            <span className="text-sm">AP Reconciliation</span>
          </Button>

          <Button
            variant={
              currentView.type === "journal-entries"
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start gap-3 h-10"
            onClick={() => handleNavigate("journal-entries")}
          >
            <FileSpreadsheet className="size-4" />
            <span className="text-sm">Journal Entries</span>
          </Button>

          <Button
            variant={
              currentView.type === "chart-of-accounts"
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start gap-3 h-10"
            onClick={() => handleNavigate("chart-of-accounts")}
          >
            <FileSpreadsheet className="size-4" />
            <span className="text-sm">Chart of Accounts</span>
          </Button>

          <Button
            variant={
              currentView.type === "month-end-close"
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start gap-3 h-10"
            onClick={() => handleNavigate("month-end-close")}
          >
            <Calendar className="size-4" />
            <span className="text-sm">Month-End Close</span>
          </Button>

          <div className="pt-4 border-t border-gray-200 mt-4">
            <div className="text-xs text-gray-500 px-3 mb-2 mt-3">
              Developer Tools
            </div>
            <Button
              variant={
                currentView.type === "analytics"
                  ? "secondary"
                  : "ghost"
              }
              className="w-full justify-start gap-3 h-10"
              onClick={() => handleNavigate("analytics")}
            >
              <BarChart3 className="size-4" />
              <span className="text-sm">Analytics</span>
            </Button>

            <Button
              variant={
                currentView.type === "webhook-tester"
                  ? "secondary"
                  : "ghost"
              }
              className="w-full justify-start gap-3 h-10"
              onClick={() => handleNavigate("webhook-tester")}
            >
              <Webhook className="size-4" />
              <span className="text-sm">📧 Email Setup</span>
            </Button>
          </div>

          <div className="pt-4">
            <Button
              variant={
                currentView.type === "settings"
                  ? "secondary"
                  : "ghost"
              }
              className="w-full justify-start gap-3 h-10"
              onClick={() => handleNavigate("settings")}
            >
              <SettingsIcon className="size-4" />
              <span className="text-sm">
                Settings & Billing
              </span>
            </Button>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-10 text-gray-500 hover:text-gray-900"
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