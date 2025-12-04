import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Building, Trash2, Eye, Mail, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useState, Fragment } from 'react';
import { invoicesApi, companiesApi, Invoice, Company } from '@/utils/api-client';
import { UploadInvoiceDialog } from './UploadInvoiceDialog';
import { EditInvoiceDialog } from './EditInvoiceDialog';
import { toast } from 'sonner';

interface InvoiceExtractionProps {
  companyId?: string;
}

export function InvoiceExtraction({ companyId }: InvoiceExtractionProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmailIds, setExpandedEmailIds] = useState<Set<string>>(new Set());
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadInvoices();
    }
  }, [selectedCompanyId]);

  const loadCompanies = async () => {
    try {
      const data = await companiesApi.getAll();
      setCompanies(data);
      // Auto-select the passed companyId or first company
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
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <Button onClick={loadInvoices} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice from ${invoice.vendor}?`)) {
      return;
    }

    try {
      await invoicesApi.delete(invoice.companyId, invoice.id);
      toast.success('Invoice deleted successfully');
      loadInvoices();
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      toast.error('Failed to delete invoice');
    }
  };

  const handleView = (fileUrl: string) => {
    if (!fileUrl) {
      toast.error('No document file available for this invoice');
      return;
    }
    window.open(fileUrl, '_blank');
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    if (!fileUrl) {
      toast.error('No document file available for this invoice');
      return;
    }
    
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download started');
    } catch (err) {
      console.error('Failed to download file:', err);
      toast.error('Failed to download file');
    }
  };

  const toggleEmailDetails = (invoiceId: string) => {
    console.log('🔄 Toggling email details for invoice:', invoiceId);
    setExpandedEmailIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        console.log('📤 Collapsing email details');
        newSet.delete(invoiceId);
      } else {
        console.log('📥 Expanding email details');
        newSet.add(invoiceId);
      }
      console.log('Current expanded IDs:', Array.from(newSet));
      return newSet;
    });
  };

  const toggleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoiceIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedInvoiceIds.size === invoices.length) {
      // Deselect all
      setSelectedInvoiceIds(new Set());
    } else {
      // Select all
      setSelectedInvoiceIds(new Set(invoices.map(inv => inv.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoiceIds.size === 0) {
      toast.error('No invoices selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedInvoiceIds.size} selected invoice(s)?`)) {
      return;
    }

    try {
      // Delete all selected invoices
      const deletePromises = Array.from(selectedInvoiceIds).map(invoiceId => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        if (invoice) {
          return invoicesApi.delete(invoice.companyId, invoice.id);
        }
        return Promise.resolve();
      });

      await Promise.all(deletePromises);
      
      toast.success(`Successfully deleted ${selectedInvoiceIds.size} invoice(s)`);
      setSelectedInvoiceIds(new Set());
      loadInvoices();
    } catch (error) {
      console.error('Failed to delete invoices:', error);
      toast.error('Failed to delete some invoices');
    }
  };

  const exportToCSV = () => {
    if (invoices.length === 0) return;

    const headers = ['Document', 'Vendor', 'Invoice #', 'Date', 'Due Date', 'Net', 'VAT', 'Gross', 'Currency', 'Category', 'Status'];
    const rows = invoices.map(inv => [
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
      ...rows.map(row => row.map(cell => `\"${cell}\"`).join(','))
    ].join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${selectedCompanyId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900">Invoice Extraction</h1>
          <p className="text-gray-500 mt-1">Extract and process invoice data with AI</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 h-10" onClick={exportToCSV} disabled={invoices.length === 0}>
            <Download className="size-4" />
            <span className="text-sm">Export CSV</span>
          </Button>
          {selectedCompanyId && (
            <UploadInvoiceDialog companyId={selectedCompanyId} onSuccess={loadInvoices} />
          )}
        </div>
      </div>

      {/* Company Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Building className="size-5 text-gray-400" />
            <div className="flex-1">
              <label className="text-sm text-gray-600 mb-1 block">Select Company</label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.country})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Processed Invoices ({invoices.length})</CardTitle>
            {selectedInvoiceIds.size > 0 && (
              <Button 
                variant="destructive" 
                className="gap-2"
                onClick={handleBulkDelete}
              >
                <Trash2 className="size-4" />
                Delete Selected ({selectedInvoiceIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">No invoices processed yet</p>
              <p className="text-sm text-gray-400">Upload your first invoice to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 w-10">
                      <Checkbox 
                        checked={selectedInvoiceIds.size === invoices.length && invoices.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all invoices"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Document</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Vendor</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Invoice #</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Date</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Net</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">VAT</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Gross</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Category</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Status</th>
                    <th className="text-left py-3 px-4 text-gray-600 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <Fragment key={invoice.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <Checkbox 
                            checked={selectedInvoiceIds.has(invoice.id)}
                            onCheckedChange={() => toggleSelectInvoice(invoice.id)}
                            aria-label={`Select invoice from ${invoice.vendor}`}
                          />
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 text-gray-400" />
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{invoice.documentName}</span>
                              {invoice.source === 'email' && (
                                <button
                                  onClick={() => toggleEmailDetails(invoice.id)}
                                  className="flex items-center gap-1 mt-0.5 hover:bg-blue-50 rounded px-1 -ml-1 py-0.5 transition-colors"
                                  title="Click to view email details"
                                >
                                  <Mail className="size-3 text-blue-500" />
                                  <span className="text-xs text-blue-600">Via email</span>
                                  <ChevronDown 
                                    className={`size-3 text-blue-500 transition-transform ${
                                      expandedEmailIds.has(invoice.id) ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-900">{invoice.vendor}</td>
                        <td className="py-4 px-4 text-sm text-gray-600">{invoice.invoiceNumber || '-'}</td>
                        <td className="py-4 px-4 text-sm text-gray-600">{invoice.date}</td>
                        <td className="py-4 px-4 text-sm text-gray-600">{invoice.net || '-'}</td>
                        <td className="py-4 px-4 text-sm text-gray-600">{invoice.vat}</td>
                        <td className="py-4 px-4 text-sm text-gray-900">{invoice.gross} {invoice.currency || 'EUR'}</td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className="text-xs">{invoice.category}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${
                              invoice.status === 'Approved' 
                                ? 'bg-blue-100 text-blue-700' 
                                : invoice.status === 'Reviewed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {invoice.status === 'Pending' && '📋 To Review'}
                            {invoice.status === 'Reviewed' && '✅ Verified'}
                            {invoice.status === 'Approved' && '💰 Paid'}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-1">
                            {invoice.fileUrl && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleView(invoice.fileUrl!)}
                                  title="View document"
                                >
                                  <Eye className="size-3" />
                                  View
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleDownload(invoice.fileUrl!, invoice.documentName)}
                                  title="Download document"
                                >
                                  <Download className="size-3" />
                                  Download
                                </Button>
                              </>
                            )}
                            <EditInvoiceDialog invoice={invoice} onSuccess={loadInvoices} />
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(invoice)}
                            >
                              <Trash2 className="size-3" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {/* Email Info Row - expandable details for invoices received via email */}
                      {invoice.source === 'email' && expandedEmailIds.has(invoice.id) && (
                        <tr className="border-b border-gray-100 bg-blue-50/30">
                          <td colSpan={11} className="py-3 px-4">
                            <div className="flex flex-col gap-2 text-xs">
                              {invoice.emailFrom ? (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Mail className="size-3.5 text-blue-600" />
                                    <span className="text-gray-600 min-w-[60px]">From:</span>
                                    <span className="text-gray-900 font-medium">{invoice.emailFrom}</span>
                                  </div>
                                  {invoice.emailSubject && (
                                    <div className="flex items-center gap-2">
                                      <div className="size-3.5" /> {/* Spacer for alignment */}
                                      <span className="text-gray-600 min-w-[60px]">Subject:</span>
                                      <span className="text-gray-900">{invoice.emailSubject}</span>
                                    </div>
                                  )}
                                  {invoice.emailReceivedAt && (
                                    <div className="flex items-center gap-2">
                                      <div className="size-3.5" /> {/* Spacer for alignment */}
                                      <span className="text-gray-600 min-w-[60px]">Received:</span>
                                      <span className="text-gray-900">
                                        {new Date(invoice.emailReceivedAt).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-gray-500 italic">
                                  <Mail className="size-3.5 text-blue-400" />
                                  <span>Email details not available (Email ID: {invoice.emailId || 'Unknown'})</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}