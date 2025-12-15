import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Building, Trash2, Eye, Mail, ChevronDown, Upload, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useState } from 'react';
import { invoicesApi, companiesApi, Invoice, Company } from '@/utils/api-client';
import { UploadInvoiceDialog } from './UploadInvoiceDialog';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface InvoiceExtractionProps {
  companyId?: string;
}

export function InvoiceExtraction({ companyId }: InvoiceExtractionProps) {
  const { theme } = useTheme();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadInvoices();
    }
  }, [selectedCompanyId]);

  // Auto-reload companies when window regains focus (in case user added company in another tab)
  useEffect(() => {
    const handleFocus = () => {
      loadCompanies();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await companiesApi.getAll();
      setCompanies(data);
      if (companyId) {
        setSelectedCompanyId(companyId);
      } else if (data.length > 0) {
        setSelectedCompanyId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load companies');
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    if (!selectedCompanyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await invoicesApi.getByCompany(selectedCompanyId);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className={theme === 'premium-dark' 
            ? 'w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4' 
            : 'w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4'
          }></div>
          <p className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-600'}>Loading invoices...</p>
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
        <Button onClick={loadInvoices} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  const handleDelete = (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice from ${invoice.vendor}?`)) {
      return;
    }

    // Optimistic update
    const previousInvoices = invoices;
    setInvoices(invoices.filter(inv => inv.id !== invoice.id));
    
    invoicesApi.delete(invoice.companyId, invoice.id)
      .then(() => {
        toast.success('Invoice deleted successfully');
      })
      .catch(error => {
        console.error('Failed to delete invoice:', error);
        setInvoices(previousInvoices);
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
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    // Optimistic update - update UI immediately
    const previousInvoices = invoices;
    setInvoices(invoices.map(inv => 
      inv.id === invoiceId ? { ...inv, ...updates } : inv
    ));
    setEditingInvoiceId(null);

    // Make API call in the background
    invoicesApi.update(invoice.companyId, invoiceId, updates)
      .catch(error => {
        // Rollback on error
        console.error('Failed to update invoice:', error);
        setInvoices(previousInvoices);
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

  const toggleSelectInvoice = (invoiceId: string) => {
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

  const exportToCSV = () => {
    if (selectedInvoiceIds.size === 0) {
      toast.error('Please select at least one invoice');
      return;
    }

    const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.has(inv.id));
    
    const headers = ['Document', 'Vendor', 'Invoice #', 'Date', 'Due Date', 'Net', 'VAT', 'Gross', 'Currency', 'Category', 'Status'];
    const rows = selectedInvoices.map(inv => [
      inv.documentName,
      inv.vendor,
      inv.invoiceNumber || '',
      inv.date,
      inv.dueDate || '',
      inv.net || '',
      inv.vat || '',
      inv.gross,
      inv.currency || 'EUR',
      inv.category,
      inv.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success(`Exported ${selectedInvoices.length} invoices to CSV`);
  };

  const exportToXLSX = () => {
    if (selectedInvoiceIds.size === 0) {
      toast.error('Please select at least one invoice');
      return;
    }
    toast.info('XLSX export coming soon!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-yellow-100 text-yellow-800'}>📋 To Review</Badge>;
      case 'Reviewed':
        return <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-800'}>✅ Reviewed</Badge>;
      case 'Approved':
        return <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-800'}>💰 Approved</Badge>;
      case 'Rejected':
        return <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-100 text-red-800'}>❌ Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number | string, currency: string = 'EUR') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
    }).format(numAmount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const totalAmount = invoices.reduce((sum, inv) => {
    const amount = typeof inv.gross === 'string' ? parseFloat(inv.gross) : inv.gross;
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const pendingCount = invoices.filter(inv => inv.status === 'Pending').length;
  const approvedCount = invoices.filter(inv => inv.status === 'Approved' || inv.status === 'Reviewed').length;

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Header - Ultra Minimal */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={theme === 'premium-dark' ? 'text-4xl tracking-tight text-white' : 'text-4xl tracking-tight text-gray-900'}>Invoice Extraction</h1>
          <p className={theme === 'premium-dark' ? 'text-purple-300/40 text-sm mt-2' : 'text-gray-400 text-sm mt-2'}>
            Extract and process invoice data with AI
          </p>
        </div>
        <Button 
          onClick={() => setUploadDialogOpen(true)} 
          className={theme === 'premium-dark'
            ? 'gap-2 bg-white text-black hover:bg-white/90 h-10 px-6 rounded-full'
            : 'gap-2 h-10 px-6 rounded-full'
          }
        >
          <Upload className="size-4" />
          Upload Invoice
        </Button>
      </div>

      {/* Stats - Minimal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={theme === 'premium-dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'premium-dark' ? 'text-purple-300/40 text-xs mb-2' : 'text-gray-400 text-xs mb-2'}>Total Invoices</div>
          <div className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{invoices.length}</div>
        </div>

        <div className={theme === 'premium-dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'premium-dark' ? 'text-purple-300/40 text-xs mb-2' : 'text-gray-400 text-xs mb-2'}>Pending Review</div>
          <div className="text-3xl text-yellow-500 tracking-tight">{pendingCount}</div>
        </div>

        <div className={theme === 'premium-dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'premium-dark' ? 'text-purple-300/40 text-xs mb-2' : 'text-gray-400 text-xs mb-2'}>Approved</div>
          <div className="text-3xl text-green-500 tracking-tight">{approvedCount}</div>
        </div>

        <div className={theme === 'premium-dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'premium-dark' ? 'text-purple-300/40 text-xs mb-2' : 'text-gray-400 text-xs mb-2'}>Total Amount</div>
          <div className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      {/* Filters - No Card Wrapper */}
      <div className="flex gap-4 items-center">
        <div className="flex gap-2 flex-1">
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className={theme === 'premium-dark' 
              ? 'bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl flex-1' 
              : 'bg-gray-50/50 border-gray-200 h-11 rounded-xl flex-1'
            }>
              <Building className="size-4 mr-2" />
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent className={theme === 'premium-dark' ? 'bg-gray-900 border-white/10' : ''}>
              {companies.map((company) => (
                <SelectItem 
                  key={company.id} 
                  value={company.id}
                  className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}
                >
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              loadCompanies();
              toast.success('Companies refreshed');
            }}
            className={theme === 'premium-dark' 
              ? 'bg-white/[0.03] border-white/10 text-gray-300 hover:bg-white/[0.05] hover:text-white h-11 w-11 rounded-xl' 
              : 'bg-gray-50/50 border-gray-200 h-11 w-11 rounded-xl'
            }
            title="Refresh companies"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={selectedInvoiceIds.size === 0}
              className={theme === 'premium-dark' 
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
            className={theme === 'premium-dark' ? 'bg-gray-900 border-white/10' : ''}
          >
            <DropdownMenuItem 
              onClick={exportToCSV}
              className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}
            >
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={exportToXLSX}
              className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}
            >
              Export as XLSX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Invoices List - Minimal */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className={theme === 'premium-dark' ? 'text-lg text-white/80 tracking-tight' : 'text-lg text-gray-700 tracking-tight'}>Invoices</h2>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedInvoiceIds.size === invoices.length && invoices.length > 0}
              onCheckedChange={toggleSelectAll}
              className={theme === 'premium-dark' ? 'border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white' : ''}
            />
            <span className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Select All</span>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className={theme === 'premium-dark' 
            ? 'text-center py-20 border-2 border-dashed border-white/5 rounded-2xl' 
            : 'text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl'
          }>
            <FileText className={theme === 'premium-dark' ? 'size-12 mx-auto mb-4 text-white/10' : 'size-12 mx-auto mb-4 text-gray-300'} />
            <p className={theme === 'premium-dark' ? 'text-white/60' : 'text-gray-500'}>No invoices found</p>
            <p className={theme === 'premium-dark' ? 'text-sm mt-2 text-purple-300/40' : 'text-sm mt-2 text-gray-400'}>Upload invoices to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className={theme === 'premium-dark'
                  ? 'bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:bg-white/[0.05] transition-all'
                  : 'bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition-all'
                }
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedInvoiceIds.has(invoice.id)}
                    onCheckedChange={() => toggleSelectInvoice(invoice.id)}
                    className={theme === 'premium-dark' ? 'mt-1 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white' : 'mt-1'}
                  />
                  
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText className={theme === 'premium-dark' ? 'size-5 text-white/20 flex-shrink-0 mt-0.5' : 'size-5 text-gray-300 flex-shrink-0 mt-0.5'} />
                        <div className="min-w-0">
                          <h3 className={theme === 'premium-dark' ? 'text-sm text-white mb-1' : 'text-sm text-gray-900 mb-1'}>
                            {invoice.vendor}
                          </h3>
                          <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/40 truncate' : 'text-xs text-gray-400 truncate'}>
                            {invoice.documentName}
                            {invoice.source === 'email' && (
                              <span className={theme === 'premium-dark' ? 'ml-2 text-purple-400' : 'ml-2 text-blue-500'}>
                                <Mail className="size-3 inline-block" /> Via email
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {getStatusBadge(invoice.status)}
                        <span className={theme === 'premium-dark' ? 'text-base text-white tracking-tight' : 'text-base text-gray-900 tracking-tight'}>
                          {formatCurrency(invoice.gross, invoice.currency || 'EUR')}
                        </span>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className={theme === 'premium-dark' ? 'flex items-center gap-6 text-xs text-purple-300/40 mb-4' : 'flex items-center gap-6 text-xs text-gray-400 mb-4'}>
                      <span>{formatDate(invoice.date)}</span>
                      <span>#{invoice.invoiceNumber || 'No invoice #'}</span>
                      
                      {/* Editable Category */}
                      {editingInvoiceId === invoice.id ? (
                        <div className="flex items-center gap-2">
                          <Select 
                            value={invoice.category} 
                            onValueChange={(value) => handleUpdateInvoice(invoice.id, { category: value })}
                          >
                            <SelectTrigger className={theme === 'premium-dark' ? 'h-6 text-xs w-auto min-w-[140px] bg-white/[0.03] border-white/10 text-white' : 'h-6 text-xs w-auto min-w-[140px]'}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={theme === 'premium-dark' ? 'bg-gray-900 border-white/10' : ''}>
                              <SelectItem value="Services" className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>Services</SelectItem>
                              <SelectItem value="General Expense" className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>General Expense</SelectItem>
                              <SelectItem value="Office Supplies" className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>Office Supplies</SelectItem>
                              <SelectItem value="Software & Subscriptions" className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>Software & Subscriptions</SelectItem>
                              <SelectItem value="Travel & Transportation" className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>Travel & Transportation</SelectItem>
                              <SelectItem value="Utilities" className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>Utilities</SelectItem>
                              <SelectItem value="Professional Services" className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>Professional Services</SelectItem>
                              <SelectItem value="Other" className={theme === 'premium-dark' ? 'text-gray-300 hover:bg-purple-500/10 focus:bg-purple-500/10 focus:text-white' : ''}>Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span 
                          className={theme === 'premium-dark' ? 'cursor-pointer hover:text-white transition-colors' : 'cursor-pointer hover:text-gray-900 transition-colors'}
                          onClick={() => setEditingInvoiceId(invoice.id)}
                        >
                          {invoice.category}
                        </span>
                      )}
                    </div>

                    {/* Expandable Details */}
                    {expandedInvoiceIds.has(invoice.id) && (
                      <div className={theme === 'premium-dark' ? 'mb-4 pt-4 border-t border-white/5 space-y-3' : 'mb-4 pt-4 border-t border-gray-100 space-y-3'}>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                          {invoice.net && (
                            <div className="flex justify-between">
                              <span className={theme === 'premium-dark' ? 'text-purple-300/40' : 'text-gray-400'}>Net Amount</span>
                              <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(invoice.net, invoice.currency || 'EUR')}</span>
                            </div>
                          )}
                          {invoice.vat && (
                            <div className="flex justify-between">
                              <span className={theme === 'premium-dark' ? 'text-purple-300/40' : 'text-gray-400'}>VAT</span>
                              <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(invoice.vat, invoice.currency || 'EUR')}</span>
                            </div>
                          )}
                          {invoice.dueDate && (
                            <div className="flex justify-between">
                              <span className={theme === 'premium-dark' ? 'text-purple-300/40' : 'text-gray-400'}>Due Date</span>
                              <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{formatDate(invoice.dueDate)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className={theme === 'premium-dark' ? 'text-purple-300/40' : 'text-gray-400'}>Gross Total</span>
                            <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(invoice.gross, invoice.currency || 'EUR')}</span>
                          </div>
                        </div>

                        {/* Email Details */}
                        {invoice.source === 'email' && invoice.emailFrom && (
                          <div className={theme === 'premium-dark' ? 'pt-3 border-t border-white/5' : 'pt-3 border-t border-gray-100'}>
                            <div className={theme === 'premium-dark' ? 'text-xs text-purple-300/40 mb-2' : 'text-xs text-gray-400 mb-2'}>Email Details</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={theme === 'premium-dark' ? 'text-purple-300/40 w-20' : 'text-gray-400 w-20'}>From</span>
                                <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{invoice.emailFrom}</span>
                              </div>
                              {invoice.emailSubject && (
                                <div className="flex items-center gap-2">
                                  <span className={theme === 'premium-dark' ? 'text-purple-300/40 w-20' : 'text-gray-400 w-20'}>Subject</span>
                                  <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{invoice.emailSubject}</span>
                                </div>
                              )}
                              {invoice.emailReceivedAt && (
                                <div className="flex items-center gap-2">
                                  <span className={theme === 'premium-dark' ? 'text-purple-300/40 w-20' : 'text-gray-400 w-20'}>Received</span>
                                  <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>
                                    {new Date(invoice.emailReceivedAt).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(invoice.id)}
                        className={theme === 'premium-dark' ? 'text-purple-300/60 hover:text-white hover:bg-white/[0.05] h-8' : 'h-8'}
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

                      {invoice.fileUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleView(invoice.fileUrl!)}
                          className={theme === 'premium-dark' ? 'text-purple-300/60 hover:text-white hover:bg-white/[0.05] h-8' : 'h-8'}
                        >
                          <Eye className="size-4 mr-1" />
                          View
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(invoice)}
                        className={theme === 'premium-dark' ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:text-red-700'}
                      >
                        <Trash2 className="size-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      {uploadDialogOpen && selectedCompanyId && (
        <UploadInvoiceDialog 
          companyId={selectedCompanyId} 
          onSuccess={() => {
            loadInvoices();
            setUploadDialogOpen(false);
          }}
          onOpenChange={setUploadDialogOpen}
        />
      )}
    </div>
  );
}