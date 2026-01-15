import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '@/utils/supabase/info';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { AddCompanyDialog } from './AddCompanyDialog';

interface AddCompanyChoiceDialogProps {
    onSuccess?: () => void;
    onOptimisticAdd?: (company: any) => void;
    trigger?: React.ReactNode;
}

export function AddCompanyChoiceDialog({ onSuccess, onOptimisticAdd, trigger }: AddCompanyChoiceDialogProps) {
    const { session } = useAuth();
    const { theme } = useTheme();
    const [open, setOpen] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [showManualDialog, setShowManualDialog] = useState(false);

    const connectQuickBooks = async () => {
        try {
            setConnecting(true);
            const token = session?.access_token;

            if (!token) {
                toast.error('Please log in to connect QuickBooks');
                return;
            }

            // Get OAuth URL
            const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/qbo/auth-url`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Get raw text first to diagnose parsing issues
            const responseText = await response.text();

            if (!response.ok) {
                console.error('QuickBooks auth URL request failed:', response.status, responseText);
                try {
                    const errorData = JSON.parse(responseText);
                    throw new Error(errorData.error || 'Failed to generate auth URL');
                } catch (parseError) {
                    // If JSON parsing fails, show the raw response
                    throw new Error(`Server error (${response.status}): ${responseText.substring(0, 200)}`);
                }
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', responseText.substring(0, 500));
                throw new Error(`Invalid response from server. Please check if QuickBooks is configured correctly.`);
            }

            // Store state for callback verification
            sessionStorage.setItem('qbo_oauth_state', data.state);

            // Open QuickBooks OAuth in popup
            const width = 600;
            const height = 700;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            const popup = window.open(
                data.authUrl,
                'QuickBooks OAuth',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            // Add timeout for popup (2 minutes)
            const popupTimeout = setTimeout(() => {
                if (popup && !popup.closed) {
                    popup.close();
                    toast.error('Connection timeout. Please try again.');
                    window.removeEventListener('message', handleMessage);
                    setConnecting(false);
                }
            }, 120000); // 2 minutes

            // Listen for OAuth callback
            const handleMessage = async (event: MessageEvent) => {
                // Handle OAuth success
                if (event.data.type === 'qbo-oauth-success') {
                    clearTimeout(popupTimeout);
                    popup?.close();

                    const { connection } = event.data;
                    console.log('✅ QuickBooks connected:', connection);

                    toast.success(`Connected to ${connection.company_name}!`);
                    sessionStorage.removeItem('qbo_oauth_state');
                    setOpen(false);

                    // Show helpful message for Unknown Company
                    if (connection.company_name === 'Unknown Company') {
                        toast.info('⏳ QuickBooks authorization takes 30-60 seconds to process. Company data will sync automatically.', {
                            duration: 10000
                        });
                    }

                    // Notify parent to refresh data
                    if (onSuccess) {
                        onSuccess();
                    }

                    window.removeEventListener('message', handleMessage);
                    setConnecting(false);
                }

                // Handle OAuth error
                if (event.data.type === 'qbo-oauth-error') {
                    clearTimeout(popupTimeout);
                    popup?.close();

                    const { error } = event.data;
                    console.error('❌ QuickBooks OAuth error:', error);

                    toast.error(`Failed to connect: ${error}`);
                    sessionStorage.removeItem('qbo_oauth_state');

                    window.removeEventListener('message', handleMessage);
                    setConnecting(false);
                }
            };

            window.addEventListener('message', handleMessage);

            // Check if popup was blocked
            if (!popup || popup.closed) {
                clearTimeout(popupTimeout);
                toast.error('Popup was blocked. Please allow popups for this site.');
                window.removeEventListener('message', handleMessage);
                setConnecting(false);
            }
        } catch (error) {
            console.error('Error connecting QuickBooks:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to connect QuickBooks');
            setConnecting(false);
        }
    };

    const handleManualClick = () => {
        setOpen(false);
        // Small delay to let the first dialog close before opening the next
        setTimeout(() => {
            setShowManualDialog(true);
        }, 100);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <div onClick={() => setOpen(true)}>
                    {trigger || (
                        <Button className="gap-2 h-10 bg-gray-900 hover:bg-gray-800">
                            <Plus className="size-4" />
                            <span className="text-sm">Add Company</span>
                        </Button>
                    )}
                </div>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Add New Company</DialogTitle>
                        <DialogDescription>
                            Choose how you'd like to add a company to Novalare
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Connect QuickBooks Option */}
                        <button
                            onClick={connectQuickBooks}
                            disabled={connecting}
                            className={`
                group relative p-6 rounded-2xl border-2 text-left transition-all
                ${theme === 'dark'
                                    ? 'border-green-500/20 bg-green-500/5 hover:border-green-500/40 hover:bg-green-500/10'
                                    : 'border-green-100 bg-green-50/50 hover:border-green-300 hover:bg-green-50'}
                ${connecting ? 'opacity-70 cursor-wait' : 'cursor-pointer'}
              `}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`
                  size-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110
                  ${theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'}
                `}>
                                    {connecting ? (
                                        <Loader2 className="size-7 text-green-600 animate-spin" />
                                    ) : (
                                        <svg className="size-8" viewBox="0 0 24 24" fill="none">
                                            <rect width="24" height="24" rx="4" fill="#2CA01C" />
                                            <path d="M7 12.5C7 10.567 8.567 9 10.5 9H12V7H10.5C7.462 7 5 9.462 5 12.5S7.462 18 10.5 18H12V16H10.5C8.567 16 7 14.433 7 12.5Z" fill="white" />
                                            <path d="M13 7V9H13.5C15.433 9 17 10.567 17 12.5S15.433 16 13.5 16H13V18H13.5C16.538 18 19 15.538 19 12.5S16.538 7 13.5 7H13Z" fill="white" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className={`font-bold text-lg mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                        Connect QuickBooks
                                    </h3>
                                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Import company data directly from QuickBooks Online. Chart of accounts, transactions, and more will sync automatically.
                                    </p>
                                </div>
                            </div>
                            <div className={`
                absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                ${theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}
              `}>
                                Recommended
                            </div>
                        </button>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className={`w-full border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`} />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className={`px-3 ${theme === 'dark' ? 'bg-gray-900 text-gray-500' : 'bg-white text-gray-400'}`}>
                                    or
                                </span>
                            </div>
                        </div>

                        {/* Add Manually Option */}
                        <button
                            onClick={handleManualClick}
                            disabled={connecting}
                            className={`
                group p-6 rounded-2xl border-2 text-left transition-all
                ${theme === 'dark'
                                    ? 'border-white/10 bg-white/5 hover:border-[#65D3FD]/30 hover:bg-white/10'
                                    : 'border-gray-100 bg-gray-50/50 hover:border-[#65D3FD]/40 hover:bg-gray-50'}
                ${connecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`
                  size-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110
                  ${theme === 'dark' ? 'bg-[#65D3FD]/10' : 'bg-sky-50'}
                `}>
                                    <Building2 className={`size-7 ${theme === 'dark' ? 'text-[#65D3FD]' : 'text-sky-600'}`} />
                                </div>
                                <div className="flex-1">
                                    <h3 className={`font-bold text-lg mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                        Add Manually
                                    </h3>
                                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Create a new company profile manually. You can connect QuickBooks or import data later.
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Manual Add Company Dialog (hidden trigger) */}
            <AddCompanyDialog
                onSuccess={() => {
                    setShowManualDialog(false);
                    if (onSuccess) onSuccess();
                }}
                onOptimisticAdd={onOptimisticAdd}
                trigger={
                    <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
                        <span style={{ display: 'none' }} />
                    </Dialog>
                }
            />

            {/* Render AddCompanyDialog when showManualDialog is true */}
            {showManualDialog && (
                <AddCompanyDialogControlled
                    open={showManualDialog}
                    onOpenChange={setShowManualDialog}
                    onSuccess={onSuccess}
                    onOptimisticAdd={onOptimisticAdd}
                />
            )}
        </>
    );
}

// A controlled version of AddCompanyDialog for programmatic opening
function AddCompanyDialogControlled({
    open,
    onOpenChange,
    onSuccess,
    onOptimisticAdd
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    onOptimisticAdd?: (company: any) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        country: 'US',
        chartOfAccounts: 'GAAP',
        status: 'Active' as 'Active' | 'Inactive' | 'Archived',
        tags: '',
    });

    // Import companiesApi dynamically to avoid circular deps
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { companiesApi } = await import('@/utils/api-client');

        if (!formData.name.trim()) {
            setError('Company name is required');
            return;
        }

        if (!formData.chartOfAccounts) {
            setError('Chart of Accounts is required');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const tagsArray = formData.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);

            // Create optimistic company object
            const optimisticCompany = {
                id: `temp-${Date.now()}`,
                name: formData.name.trim(),
                country: formData.country,
                chartOfAccounts: formData.chartOfAccounts,
                status: formData.status,
                tags: tagsArray.length > 0 ? tagsArray : undefined,
                docsThisMonth: 0,
                lastActivity: 'Just now',
                pendingCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            if (onOptimisticAdd) {
                onOptimisticAdd(optimisticCompany);
            }

            onOpenChange(false);

            setFormData({
                name: '',
                country: 'US',
                chartOfAccounts: 'GAAP',
                status: 'Active',
                tags: '',
            });

            await companiesApi.create({
                name: formData.name.trim(),
                country: formData.country,
                chartOfAccounts: formData.chartOfAccounts,
                status: formData.status,
                tags: tagsArray.length > 0 ? tagsArray : undefined,
                docsThisMonth: 0,
                lastActivity: 'Just now',
            });

            toast.success(`${formData.name.trim()} created successfully!`);

            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            console.error('Failed to create company:', err);
            setError(err instanceof Error ? err.message : 'Failed to create company');
            toast.error(err instanceof Error ? err.message : 'Failed to create company');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Company</DialogTitle>
                    <DialogDescription>Enter the company details below to add a new company to the system.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">Company Name *</label>
                        <input
                            id="name"
                            placeholder="e.g., ACME Corporation GmbH"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            disabled={loading}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="country" className="text-sm font-medium">Country</label>
                        <select
                            id="country"
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                            disabled={loading}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="DE">Germany (DE)</option>
                            <option value="US">United States (US)</option>
                            <option value="UK">United Kingdom (UK)</option>
                            <option value="FR">France (FR)</option>
                            <option value="ES">Spain (ES)</option>
                            <option value="IT">Italy (IT)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="chartOfAccounts" className="text-sm font-medium">Chart of Accounts *</label>
                        <select
                            id="chartOfAccounts"
                            value={formData.chartOfAccounts}
                            onChange={(e) => setFormData({ ...formData, chartOfAccounts: e.target.value })}
                            disabled={loading}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="SKR03">SKR03 - Standard Chart of Accounts (Process Industry)</option>
                            <option value="SKR04">SKR04 - Standard Chart of Accounts (Cost Accounting)</option>
                            <option value="IKR">IKR - Industrial Chart of Accounts</option>
                            <option value="IFRS">IFRS - International Financial Reporting Standards</option>
                            <option value="GAAP">GAAP - Generally Accepted Accounting Principles</option>
                            <option value="Custom">Custom - User-defined Chart of Accounts</option>
                        </select>
                        <p className="text-xs text-gray-500">Select the accounting standard used by this company.</p>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="status" className="text-sm font-medium">Status</label>
                        <select
                            id="status"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            disabled={loading}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="tags" className="text-sm font-medium">Tags (comma-separated)</label>
                        <input
                            id="tags"
                            placeholder="e.g., Tech, Startup, VAT"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            disabled={loading}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <p className="text-xs text-gray-500">Optional: Add tags to categorize the company</p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black font-extrabold shadow-lg shadow-[#65D3FD]/10 transition-all active:scale-95"
                        >
                            {loading ? 'Creating...' : 'Create Company'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default AddCompanyChoiceDialog;
