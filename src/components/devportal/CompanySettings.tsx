import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { FileText, Mail, Plug, Calculator, Trash2, Loader2, Building2 } from 'lucide-react';
import { companiesApi } from '@/utils/api-client';
import { toast } from 'sonner@2.0.3';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

// Lazy load settings tab components for better performance
const CompanyProfile = lazy(() =>
  import('./CompanyProfile').then((m) => ({ default: m.CompanyProfile }))
);
const ChartOfAccountsManager = lazy(() =>
  import('./ChartOfAccountsManager').then((m) => ({ default: m.ChartOfAccountsManager }))
);
const CompanyDocuments = lazy(() =>
  import('./CompanyDocuments').then((m) => ({ default: m.CompanyDocuments }))
);
const CompanyIntegrations = lazy(() =>
  import('./CompanyIntegrations').then((m) => ({ default: m.CompanyIntegrations }))
);
const EmailSettings = lazy(() =>
  import('./EmailSettings').then((m) => ({ default: m.EmailSettings }))
);

// Loading component for settings tabs
function SettingsLoader() {
  return (
    <div className="flex items-center justify-center h-[400px]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
        <p className="text-gray-400">Loading settings...</p>
      </div>
    </div>
  );
}

interface CompanySettingsProps {
  companyId: string;
  companyName: string;
}

export function CompanySettings({ companyId, companyName }: CompanySettingsProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  // Redirect to default section if on base settings path
  useEffect(() => {
    if (location.pathname === `/company/${companyId}/settings` ||
      location.pathname === `/company/${companyId}/settings/`) {
      navigate(`/company/${companyId}/settings/general`, { replace: true });
    }
  }, [location.pathname, companyId, navigate]);

  // Determine active section from URL
  const getActiveSection = () => {
    const path = location.pathname;
    if (path.includes('/settings/documents')) return 'documents';
    if (path.includes('/settings/integrations')) return 'integrations';
    if (path.includes('/settings/email')) return 'email';
    if (path.includes('/settings/general')) return 'general';
    // Default to general for /settings
    return 'general';
  };

  const activeSection = getActiveSection();

  const sections = [
    { id: 'general', label: 'General', icon: Building2 }, // Building2 is used in CompanyCard, need to import it here or use FileText as placeholder if not available? It is available.
    { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: Calculator },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'email', label: 'Email Settings', icon: Mail },
  ];

  const handleSectionChange = (sectionId: string) => {
    navigate(`/company/${companyId}/settings/${sectionId}`);
  };

  const handleDeleteCompany = async () => {
    try {
      setIsDeleting(true);
      await companiesApi.delete(companyId);

      // Invalidate companies cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['companies'] });

      toast.success('Company deleted successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete company');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-2xl mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Settings
          </h1>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Manage company settings, integrations, and preferences
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
              Delete Company
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className={theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white'}>
            <AlertDialogHeader>
              <AlertDialogTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                Are you absolutely sure?
              </AlertDialogTitle>
              <AlertDialogDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                This will permanently delete <span className="font-semibold text-red-600">{companyName}</span> and remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className={`space-y-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <div className="text-sm">Including:</div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>All reconciliations and transactions</li>
                <li>Uploaded documents and receipts</li>
                <li>QuickBooks integration settings</li>
                <li>Chart of accounts configuration</li>
                <li>All historical data</li>
              </ul>
              <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                This action cannot be undone.
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className={theme === 'dark' ? 'bg-zinc-800 text-white hover:bg-zinc-700' : ''}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCompany}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete Company'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Settings Navigation */}
      <div className={`
        rounded-lg border overflow-hidden
        ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}
      `}>
        <div className={`
          flex items-center border-b
          ${theme === 'dark' ? 'border-zinc-800' : 'border-gray-200'}
        `}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => handleSectionChange(section.id)}
                className={`
                  flex items-center gap-2 px-6 py-4 text-sm transition-all border-b-2
                  ${activeSection === section.id
                    ? theme === 'dark'
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                      : 'border-indigo-600 text-indigo-600 bg-indigo-50'
                    : theme === 'dark'
                      ? 'border-transparent text-gray-400 hover:text-white hover:bg-zinc-800/50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Settings Content */}
        <div className="p-6">
          {activeSection === 'general' && (
            <Suspense fallback={<SettingsLoader />}>
              <CompanyProfile
                companyId={companyId}
                initialName={companyName}
              // We rely on react-query invalidation to update the parent's data eventually, 
              // but we could also force a refresh if needed.
              />
            </Suspense>
          )}
          {activeSection === 'chart-of-accounts' && (
            <Suspense fallback={<SettingsLoader />}>
              <ChartOfAccountsManager companyId={companyId} companyName={companyName} />
            </Suspense>
          )}
          {activeSection === 'documents' && (
            <Suspense fallback={<SettingsLoader />}>
              <CompanyDocuments companyId={companyId} />
            </Suspense>
          )}
          {activeSection === 'integrations' && (
            <Suspense fallback={<SettingsLoader />}>
              <CompanyIntegrations companyId={companyId} companyName={companyName} />
            </Suspense>
          )}
          {activeSection === 'email' && (
            <Suspense fallback={<SettingsLoader />}>
              <EmailSettings companyId={companyId} companyName={companyName} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompanySettings;