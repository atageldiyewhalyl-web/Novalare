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
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Import view components
import { Dashboard } from "@/components/devportal/Dashboard";
import { CompaniesList } from "@/components/devportal/CompaniesList";
import { CompanyWorkspace } from "@/components/devportal/CompanyWorkspace";
import { InvoiceExtraction } from "@/components/devportal/workflows/InvoiceExtraction";
import { BankReconciliation } from "@/components/devportal/workflows/BankReconciliation";
import { APReconciliation } from "@/components/devportal/workflows/APReconciliation";
import { JournalEntries } from "@/components/devportal/workflows/JournalEntries";
import { MonthEndClose } from "@/components/devportal/workflows/MonthEndClose";
import { Settings } from "@/components/devportal/Settings";
import { WebhookTester } from "@/components/devportal/WebhookTester";
import { Analytics } from "@/components/devportal/Analytics";

type ViewType =
  | "dashboard"
  | "companies"
  | "company"
  | "invoice-extraction"
  | "bank-reconciliation"
  | "ap-reconciliation"
  | "journal-entries"
  | "month-end-close"
  | "webhook-tester"
  | "analytics"
  | "settings";

interface ViewState {
  type: ViewType;
  params?: {
    companyId?: string;
  };
}

export function DevPortal() {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>({
    type: "dashboard",
  });

  useEffect(() => {
    const devMode =
      localStorage.getItem("novalare_dev_mode") === "true";

    if (!devMode) {
      setTimeout(() => {
        setIsChecking(false);
      }, 500);
    } else {
      setIsAuthorized(true);
      setIsChecking(false);
    }
  }, []);

  const handleNavigate = (viewType: string, params?: any) => {
    setCurrentView({ type: viewType as ViewType, params });
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white rounded-xl shadow-lg p-8">
          <div className="w-20 h-20 rounded-full bg-red-100 border border-red-200 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-3xl mb-4 text-gray-900">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-8">
            This area is restricted. Please authenticate to
            continue.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Return to Homepage
          </button>
          <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs text-orange-700">
              Hint: Try pressing "d" three times on the homepage
            </p>
          </div>
        </div>
      </div>
    );
  }

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
        return <JournalEntries />;
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
              Müller & Partner Steuerberatung
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 h-9"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      MP
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="size-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Team</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Log out</DropdownMenuItem>
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
        <main className="p-8">{renderView()}</main>
      </div>
    </div>
  );
}