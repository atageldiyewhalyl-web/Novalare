import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Building, Trash2, Eye, Mail, ChevronDown, Upload, RefreshCw, Copy, Check, Calendar, ArrowUpDown, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect, useMemo } from 'react';
import { invoicesApi, Invoice } from '@/utils/api-client';
import { UploadInvoiceDialog } from './UploadInvoiceDialog';
import { toast } from 'sonner@2.0.3';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import gmailLogo from 'figma:asset/6953f24e6e4fbbab68b8caadff36f375063095c2.png';

interface InvoiceExtractionProps {
  companyId: string;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  sortBy: 'invoice-date' | 'upload-date';
  setSortBy: (sortBy: 'invoice-date' | 'upload-date') => void;
}

export function InvoiceExtraction({ companyId, selectedPeriod, setSelectedPeriod, sortBy, setSortBy }: InvoiceExtractionProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryInputValue, setCategoryInputValue] = useState<string>('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [emailSettings, setEmailSettings] = useState<any>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Generate period options (current and previous 12 months)
  const generatePeriodOptions = () => {
    const options: { value: string; label: string }[] = [
      { value: 'all', label: 'All Periods' }
    ];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const value = `${year}-${month}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    
    return options;
  };

  // Remove the local useEffect for setting default period since it's now managed by parent
  // Remove: useEffect(() => { ... }, [selectedPeriod]);

  // Fetch email settings
  useEffect(() => {
    const fetchEmailSettings = async () => {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/email-settings`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );
        const data = await response.json();
        setEmailSettings(data);
      } catch (error) {
        console.error('Failed to fetch email settings:', error);
      }
    };
    
    if (companyId) {
      fetchEmailSettings();
    }
  }, [companyId]);

  // Fetch invoices with React Query for fast loading
  const { data: allInvoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: () => invoicesApi.getByCompany(companyId),
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    refetchOnWindowFocus: false, // Disable aggressive auto-reload
  });

  // Debug: Log all invoices
  useEffect(() => {
    console.log('All invoices fetched:', allInvoices);
    console.log('Total count:', allInvoices.length);
  }, [allInvoices]);

  // Filter invoices by selected period and sort
  const invoices = useMemo(() => {
    let filtered = allInvoices;
    
    // Filter by period if not "all"
    if (selectedPeriod && selectedPeriod !== 'all') {
      const [year, month] = selectedPeriod.split('-').map(Number);
      
      filtered = allInvoices.filter((invoice) => {
        // Use upload date (createdAt) when sorting by upload date, otherwise use invoice date
        const dateToCheck = sortBy === 'upload-date' ? new Date(invoice.createdAt) : new Date(invoice.date);
        const matches = dateToCheck.getFullYear() === year && dateToCheck.getMonth() + 1 === month;
        console.log(`Invoice ${invoice.id} ${sortBy === 'upload-date' ? 'uploaded' : 'dated'}:`, 
          sortBy === 'upload-date' ? invoice.createdAt : invoice.date, 'Matches:', matches);
        return matches;
      });

      console.log(`Filtered invoices for ${selectedPeriod} by ${sortBy}:`, filtered.length);
    } else {
      console.log('Showing all invoices:', allInvoices.length);
    }
    
    // Sort by selected criteria
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'invoice-date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        // Sort by upload date (createdAt)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    
    return sorted;
  }, [allInvoices, selectedPeriod, sortBy]);

  const handleDelete = (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice from ${invoice.vendor}?`)) {
      return;
    }

    // Optimistic update
    queryClient.setQueryData(['invoices', companyId], (old: Invoice[] = []) => 
      old.filter(inv => inv.id !== invoice.id)
    );
    
    invoicesApi.delete(invoice.companyId, invoice.id)
      .then(() => {
        toast.success('Invoice deleted successfully');
      })
      .catch(error => {
        console.error('Failed to delete invoice:', error);
        queryClient.invalidateQueries(['invoices', companyId]);
        toast.error('Failed to delete invoice');
      });
  };

  const handleView = (fileUrl: string) => {
    if (!fileUrl) {
      toast.error('No document file available for this invoice');
      return;
    }
    window.open(fileUrl, '_blank');
  };

  const handleApprove = (invoiceId: string) => {
    handleUpdateInvoice(invoiceId, { status: 'Approved' });
  };

  const handleReject = (invoiceId: string) => {
    handleUpdateInvoice(invoiceId, { status: 'Rejected' });
  };

  const handleUpdateInvoice = (invoiceId: string, updates: Partial<Invoice>) => {
    const invoice = allInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    // Optimistic update - update UI immediately
    queryClient.setQueryData(['invoices', companyId], (old: Invoice[] = []) =>
      old.map(inv => inv.id === invoiceId ? { ...inv, ...updates } : inv)
    );
    setEditingInvoiceId(null);

    // Make API call in the background
    invoicesApi.update(invoice.companyId, invoiceId, updates)
      .catch(error => {
        // Rollback on error
        console.error('Failed to update invoice:', error);
        queryClient.invalidateQueries(['invoices', companyId]);
        toast.error('Failed to update invoice');
      });
  };

  const toggleExpanded = (invoiceId: string) => {
    setExpandedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const toggleSelected = (invoiceId: string) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedInvoiceIds.size === invoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(invoices.map(inv => inv.id)));
    }
  };

  const handleBulkAction = (action: string) => {
    const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.has(inv.id));
    
    if (action === 'approve') {
      selectedInvoices.forEach(inv => handleApprove(inv.id));
      setSelectedInvoiceIds(new Set());
      toast.success(`Approved ${selectedInvoices.length} invoices`);
    } else if (action === 'reject') {
      selectedInvoices.forEach(inv => handleReject(inv.id));
      setSelectedInvoiceIds(new Set());
      toast.success(`Rejected ${selectedInvoices.length} invoices`);
    } else if (action === 'delete') {
      if (confirm(`Are you sure you want to delete ${selectedInvoices.length} invoices?`)) {
        selectedInvoices.forEach(inv => handleDelete(inv));
        setSelectedInvoiceIds(new Set());
      }
    }
  };

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries(['invoices', companyId]);
    setUploadDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    
    switch (normalizedStatus) {
      case 'Pending':
        return <Badge variant="secondary" className={theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-yellow-100 text-yellow-800'}>Pending Review</Badge>;
      case 'Approved':
        return <Badge variant="secondary" className={theme === 'dark' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-800'}>Approved</Badge>;
      case 'Rejected':
        return <Badge variant="secondary" className={theme === 'dark' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-100 text-red-800'}>Rejected</Badge>;
      default:
        return <Badge variant="secondary">{normalizedStatus}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    // Map common currency codes
    const currencyMap: Record<string, string> = {
      'EUR': 'EUR',
      'USD': 'USD',
      'GBP': 'GBP',
      'JPY': 'JPY',
      'CAD': 'CAD',
      'AUD': 'AUD',
      'CHF': 'CHF',
    };

    const validCurrency = currencyMap[currency] || 'USD';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: validCurrency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate stats
  const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.gross) || 0), 0);
  const pendingCount = invoices.filter(inv => inv.status === 'Pending').length;
  const approvedCount = invoices.filter(inv => inv.status === 'Approved').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className={`w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 ${
            theme === 'dark'
              ? 'border-zinc-700 border-t-[#65D3FD]'
              : 'border-gray-200 border-t-[#65D3FD]'
          }`}></div>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Loading invoices...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg border ${
        theme === 'dark' 
          ? 'bg-red-900/20 border-red-500/30' 
          : 'bg-red-50 border-red-200'
      }`}>
        <p className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>
          Error: {error instanceof Error ? error.message : 'Failed to load invoices'}
        </p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={theme === 'dark' ? 'text-4xl tracking-tight text-white' : 'text-4xl tracking-tight text-gray-900'}>
            Invoice Extraction
          </h1>
          <p className={theme === 'dark' ? 'text-gray-400 text-sm mt-2' : 'text-gray-500 text-sm mt-2'}>
            Upload and extract invoice data with AI
          </p>
        </div>
        <Button 
          onClick={() => setUploadDialogOpen(true)} 
          className="gap-2 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black h-10 px-6 rounded-full"
        >
          <Upload className="size-4" />
          Upload Invoice
        </Button>
      </div>

      {/* Email Banner - Show forwarding email address */}
      {emailSettings?.forwardingEmail && (
        <div className={`
          inline-flex items-center gap-3 px-4 py-2.5 rounded-lg border w-fit
          ${theme === 'dark' 
            ? 'bg-transparent border-zinc-800' 
            : 'bg-transparent border-gray-200'
          }
        `}>
          <img src={gmailLogo} alt="Gmail" className="w-6 h-6" />
          <span className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>
            Forward to:
          </span>
          <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {emailSettings.forwardingEmail}
          </span>
          <button
            onClick={() => {
              // Use legacy method directly to avoid clipboard API errors
              const textArea = document.createElement('textarea');
              textArea.value = emailSettings.forwardingEmail;
              textArea.style.position = 'fixed';
              textArea.style.left = '-999999px';
              document.body.appendChild(textArea);
              textArea.select();
              try {
                const successful = document.execCommand('copy');
                if (successful) {
                  setCopiedEmail(true);
                  toast.success('Email copied to clipboard!');
                  setTimeout(() => setCopiedEmail(false), 2000);
                } else {
                  toast.error('Failed to copy email');
                }
              } catch (err) {
                toast.error('Failed to copy email');
              } finally {
                document.body.removeChild(textArea);
              }
            }}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-sm
              ${theme === 'dark' 
                ? 'text-gray-400 hover:text-white hover:bg-zinc-800' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }
            `}
          >
            {copiedEmail ? (
              <>
                <Check className="size-4 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy
              </>
            )}
          </button>
        </div>
      )}

      {/* Period Selector & Sort By */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-sm">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={theme === 'dark' 
              ? 'bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl' 
              : 'bg-gray-50/50 border-gray-200 h-11 rounded-xl'
            }>
              <Calendar className="size-4 mr-2" />
              <SelectValue placeholder="Select a period" />
            </SelectTrigger>
            <SelectContent className={theme === 'dark' ? 'bg-gray-900 border-white/10' : ''}>
              {generatePeriodOptions().map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value} 
                  className={theme === 'dark' ? 'text-gray-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white' : ''}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Sort By Toggle */}
        <div className="flex-1 max-w-sm">
          <Select value={sortBy} onValueChange={(value: 'invoice-date' | 'upload-date') => setSortBy(value)}>
            <SelectTrigger className={theme === 'dark' 
              ? 'bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl' 
              : 'bg-gray-50/50 border-gray-200 h-11 rounded-xl'
            }>
              <ArrowUpDown className="size-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className={theme === 'dark' ? 'bg-gray-900 border-white/10' : ''}>
              <SelectItem 
                value="invoice-date"
                className={theme === 'dark' ? 'text-gray-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white' : ''}
              >
                Sort by Invoice Date
              </SelectItem>
              <SelectItem 
                value="upload-date"
                className={theme === 'dark' ? 'text-gray-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white' : ''}
              >
                Sort by Upload Date
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={theme === 'dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'dark' ? 'text-gray-400 text-xs mb-2' : 'text-gray-500 text-xs mb-2'}>Total Invoices</div>
          <div className={theme === 'dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>
            {invoices.length}
          </div>
        </div>

        <div className={theme === 'dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'dark' ? 'text-gray-400 text-xs mb-2' : 'text-gray-500 text-xs mb-2'}>Pending Review</div>
          <div className="text-3xl text-yellow-500 tracking-tight">{pendingCount}</div>
        </div>

        <div className={theme === 'dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'dark' ? 'text-gray-400 text-xs mb-2' : 'text-gray-500 text-xs mb-2'}>Approved</div>
          <div className="text-3xl text-green-500 tracking-tight">{approvedCount}</div>
        </div>

        <div className={theme === 'dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'dark' ? 'text-gray-400 text-xs mb-2' : 'text-gray-500 text-xs mb-2'}>Total Amount</div>
          <div className={theme === 'dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>
            {formatCurrency(totalAmount)}
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex gap-4 items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={selectedInvoiceIds.size === 0}
              className={theme === 'dark' 
                ? 'bg-white/[0.03] border-white/10 text-gray-300 hover:bg-white/[0.05] hover:text-white h-11 rounded-xl' 
                : 'bg-gray-50/50 border-gray-200 h-11 rounded-xl'
              }
            >
              <Download className="size-4 mr-2" />
              Export Selected ({selectedInvoiceIds.size})
              <ChevronDown className="size-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end"
            className={theme === 'dark' ? 'bg-gray-900 border-white/10' : ''}
          >
            <DropdownMenuItem 
              onClick={() => handleBulkAction('approve')}
              className={theme === 'dark' ? 'text-gray-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white' : ''}
            >
              Approve Selected
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleBulkAction('reject')}
              className={theme === 'dark' ? 'text-gray-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white' : ''}
            >
              Reject Selected
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleBulkAction('delete')}
              className={theme === 'dark' ? 'text-red-400 hover:bg-zinc-800 focus:bg-zinc-800' : 'text-red-600'}
            >
              Delete Selected
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Invoices List */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className={theme === 'dark' ? 'text-lg text-white/80 tracking-tight' : 'text-lg text-gray-700 tracking-tight'}>
            Invoices
          </h2>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedInvoiceIds.size === invoices.length && invoices.length > 0}
              onCheckedChange={toggleSelectAll}
              disabled={isLoading}
              className={theme === 'dark' ? 'border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white' : ''}
            />
            <span className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-500'}>Select All</span>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className={theme === 'dark' 
            ? 'text-center py-20 border-2 border-dashed border-white/5 rounded-2xl' 
            : 'text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl'
          }>
            <FileText className={theme === 'dark' ? 'size-12 mx-auto mb-4 text-white/10' : 'size-12 mx-auto mb-4 text-gray-300'} />
            {allInvoices.length > 0 ? (
              <>
                <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-500'}>
                  No invoices for {generatePeriodOptions().find(o => o.value === selectedPeriod)?.label}
                </p>
                <p className={theme === 'dark' ? 'text-sm mt-2 text-gray-400' : 'text-sm mt-2 text-gray-400'}>
                  You have {allInvoices.length} invoice{allInvoices.length === 1 ? '' : 's'} in other periods
                </p>
                <Button 
                  onClick={() => setSelectedPeriod('all')}
                  className="mt-6 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black"
                >
                  View All Invoices
                </Button>
              </>
            ) : (
              <>
                <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-500'}>
                  No invoices yet
                </p>
                <p className={theme === 'dark' ? 'text-sm mt-2 text-gray-400' : 'text-sm mt-2 text-gray-400'}>
                  Upload your first invoice to get started
                </p>
                <Button 
                  onClick={() => setUploadDialogOpen(true)}
                  className="mt-6 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Invoice
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className={theme === 'dark'
                  ? 'bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:bg-white/[0.05] transition-all'
                  : 'bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition-all'
                }
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedInvoiceIds.has(invoice.id)}
                    onCheckedChange={() => toggleSelected(invoice.id)}
                    className={theme === 'dark' ? 'mt-1 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white' : 'mt-1'}
                  />
                  
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText className={theme === 'dark' ? 'size-5 text-white/20 flex-shrink-0 mt-0.5' : 'size-5 text-gray-300 flex-shrink-0 mt-0.5'} />
                        <div className="min-w-0">
                          <h3 className={theme === 'dark' ? 'text-sm text-white mb-1' : 'text-sm text-gray-900 mb-1'}>
                            {invoice.vendor}
                          </h3>
                          <div className="flex items-center gap-2">
                            <p className={theme === 'dark' ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                              Invoice #{invoice.invoiceNumber}
                            </p>
                            <span className={theme === 'dark' ? 'text-xs text-white/20' : 'text-xs text-gray-300'}>•</span>
                            <p className={theme === 'dark' ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                              <span className={theme === 'dark' ? 'text-white/40' : 'text-gray-400'}>Invoice:</span> {formatDate(invoice.date)}
                            </p>
                            <span className={theme === 'dark' ? 'text-xs text-white/20' : 'text-xs text-gray-300'}>•</span>
                            <p className={theme === 'dark' ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                              <span className={theme === 'dark' ? 'text-white/40' : 'text-gray-400'}>Uploaded:</span> {formatDate(invoice.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {getStatusBadge(invoice.status)}
                        <span className={theme === 'dark' ? 'text-base text-white tracking-tight' : 'text-base text-gray-900 tracking-tight'}>
                          {formatCurrency(parseFloat(invoice.gross) || 0, invoice.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(invoice.id)}
                        className={theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/[0.05] h-8' : 'h-8'}
                      >
                        <ChevronDown
                          className={`size-4 transition-transform ${
                            expandedInvoiceIds.has(invoice.id) ? 'rotate-180' : ''
                          }`}
                        />
                        {expandedInvoiceIds.has(invoice.id) ? 'Hide' : 'Show'} Details
                      </Button>

                      {invoice.status === 'Pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(invoice.id)}
                            className="text-green-500 hover:text-green-600 hover:bg-green-500/10 h-8"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(invoice.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8"
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleView(invoice.fileUrl)}
                        className={theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/[0.05] h-8' : 'h-8'}
                      >
                        <Eye className="size-4 mr-1" />
                        View
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(invoice)}
                        className={theme === 'dark' ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10 h-8' : 'text-red-600 hover:text-red-700 h-8'}
                      >
                        <Trash2 className="size-4 mr-1" />
                        Delete
                      </Button>
                    </div>

                    {/* Expandable Details */}
                    {expandedInvoiceIds.has(invoice.id) && (
                      <div className={theme === 'dark' ? 'mt-4 pt-4 border-t border-white/5' : 'mt-4 pt-4 border-t border-gray-100'}>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Left Column */}
                          <div className="space-y-3">
                            <div>
                              <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-1' : 'text-xs text-gray-500 mb-1'}>Vendor</div>
                              <div className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{invoice.vendor}</div>
                            </div>
                            
                            <div>
                              <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-1' : 'text-xs text-gray-500 mb-1'}>Invoice Number</div>
                              <div className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{invoice.invoiceNumber || 'N/A'}</div>
                            </div>
                            
                            <div>
                              <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-1' : 'text-xs text-gray-500 mb-1'}>Category</div>
                              {editingCategoryId === invoice.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={categoryInputValue}
                                    onChange={(e) => setCategoryInputValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleUpdateInvoice(invoice.id, { category: categoryInputValue });
                                        setEditingCategoryId(null);
                                        toast.success('Category updated');
                                      } else if (e.key === 'Escape') {
                                        setEditingCategoryId(null);
                                        setCategoryInputValue('');
                                      }
                                    }}
                                    onBlur={() => {
                                      if (categoryInputValue && categoryInputValue !== invoice.category) {
                                        handleUpdateInvoice(invoice.id, { category: categoryInputValue });
                                        toast.success('Category updated');
                                      }
                                      setEditingCategoryId(null);
                                    }}
                                    autoFocus
                                    className={theme === 'dark' 
                                      ? 'flex-1 px-2 py-1 text-sm bg-white/[0.05] border border-white/10 rounded text-white focus:outline-none focus:border-[#65D3FD]' 
                                      : 'flex-1 px-2 py-1 text-sm bg-white border border-gray-300 rounded text-gray-900 focus:outline-none focus:border-[#65D3FD]'
                                    }
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  <div className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>
                                    {invoice.category || 'Uncategorized'}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setEditingCategoryId(invoice.id);
                                      setCategoryInputValue(invoice.category || '');
                                    }}
                                    className={theme === 'dark' 
                                      ? 'opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all' 
                                      : 'opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all'
                                    }
                                  >
                                    <Pencil className="size-3 text-gray-400" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {invoice.dueDate && (
                              <div>
                                <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-1' : 'text-xs text-gray-500 mb-1'}>Due Date</div>
                                <div className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{formatDate(invoice.dueDate)}</div>
                              </div>
                            )}
                          </div>

                          {/* Right Column */}
                          <div className="space-y-3">
                            {invoice.net && (
                              <div>
                                <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-1' : 'text-xs text-gray-500 mb-1'}>Subtotal (Net)</div>
                                <div className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{formatCurrency(parseFloat(invoice.net), invoice.currency)}</div>
                              </div>
                            )}
                            
                            <div>
                              <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-1' : 'text-xs text-gray-500 mb-1'}>Tax (VAT)</div>
                              <div className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{formatCurrency(parseFloat(invoice.vat) || 0, invoice.currency)}</div>
                            </div>
                            
                            <div>
                              <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-1' : 'text-xs text-gray-500 mb-1'}>Total (Gross)</div>
                              <div className={theme === 'dark' ? 'text-sm text-white font-medium' : 'text-sm text-gray-900 font-medium'}>{formatCurrency(parseFloat(invoice.gross) || 0, invoice.currency)}</div>
                            </div>

                            {invoice.currency && invoice.currency !== 'USD' && (
                              <div>
                                <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-1' : 'text-xs text-gray-500 mb-1'}>Currency</div>
                                <div className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{invoice.currency}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Email Info if uploaded via email */}
                        {invoice.source === 'email' && invoice.emailFrom && (
                          <div className={theme === 'dark' ? 'mt-4 pt-4 border-t border-white/5' : 'mt-4 pt-4 border-t border-gray-100'}>
                            <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-2' : 'text-xs text-gray-500 mb-2'}>Email Details</div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Mail className={theme === 'dark' ? 'size-4 text-gray-400' : 'size-4 text-gray-500'} />
                                <span className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{invoice.emailFrom}</span>
                              </div>
                              {invoice.emailSubject && (
                                <div className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>
                                  Subject: {invoice.emailSubject}
                                </div>
                              )}
                              {invoice.emailReceivedAt && (
                                <div className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>
                                  Received: {formatDate(invoice.emailReceivedAt)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Document Info */}
                        <div className={theme === 'dark' ? 'mt-4 pt-4 border-t border-white/5' : 'mt-4 pt-4 border-t border-gray-100'}>
                          <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-2' : 'text-xs text-gray-500 mb-2'}>Document</div>
                          <div className="flex items-center gap-2">
                            <FileText className={theme === 'dark' ? 'size-4 text-gray-400' : 'size-4 text-gray-500'} />
                            <span className={theme === 'dark' ? 'text-sm text-white' : 'text-sm text-gray-900'}>{invoice.documentName}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <UploadInvoiceDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        companyId={companyId}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}