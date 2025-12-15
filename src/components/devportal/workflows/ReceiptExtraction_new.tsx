import { Button } from '@/components/ui/button';
import { Download, Receipt, Building, Trash2, Eye, Upload, ChevronDown, Mail, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useState, useRef } from 'react';
import { companiesApi, Company, receiptsApi, Receipt as ApiReceipt } from '@/utils/api-client';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ReceiptData {
  id: string;
  companyId: string;
  merchant: string;
  date: string;
  amount?: number; // Old field name
  total?: number;  // New field name from backend
  taxAmount?: number | null; // Old field name
  tax?: number | null;       // New field name from backend
  taxRate?: number | null;
  subtotal?: number | null;
  category: string;
  paymentMethod: string;
  status: 'Pending' | 'Reviewed' | 'Approved';
  uploadedAt: string;
  fileName: string;
  imageUrl?: string;
  filePath?: string;
  items?: Array<{
    description: string;
    amount: number;
    quantity?: number;
  }>;
  source?: 'upload' | 'email';
  emailId?: string;
  emailFrom?: string;
  emailSubject?: string;
  emailReceivedAt?: string;
}

interface ReceiptExtractionProps {
  companyId?: string;
}

export function ReceiptExtraction({ companyId }: ReceiptExtractionProps) {
  const { theme } = useTheme();
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Set<string>>(new Set());
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadReceipts();
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
      setLoading(false);
    } catch (err) {
      console.error('Failed to load companies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load companies');
      setLoading(false);
    }
  };

  const loadReceipts = async () => {
    if (!selectedCompanyId) {
      setLoading(false);
      return;
    }

    try {
      setReceiptsLoading(true);
      setError(null);

      const data = await receiptsApi.getByCompany(selectedCompanyId);
      setReceipts(data as ReceiptData[]);
    } catch (err) {
      console.error('Failed to load receipts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load receipts');
    } finally {
      setReceiptsLoading(false);
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
          <p className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-600'}>Loading receipts...</p>
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
        <Button onClick={loadReceipts} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  const handleDelete = async (receipt: ReceiptData) => {
    if (!confirm(`Are you sure you want to delete receipt from ${receipt.merchant}?`)) {
      return;
    }

    try {
      // Call backend API to delete receipt
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/api/receipts/${receipt.companyId}/${receipt.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete receipt');
      }

      // Remove from local state
      setReceipts(receipts.filter(r => r.id !== receipt.id));
      toast.success('Receipt deleted successfully');
    } catch (error) {
      console.error('Failed to delete receipt:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete receipt');
    }
  };

  const handleView = async (receipt: ReceiptData) => {
    try {
      toast.info('Loading receipt...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/api/receipts/${receipt.companyId}/${receipt.id}/view`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ View failed:', errorData);
        throw new Error(errorData.error || 'Failed to load receipt');
      }

      const data = await response.json();
      
      // Open the receipt in a new window
      window.open(data.url, '_blank');
      
    } catch (error) {
      console.error('Failed to view receipt:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load receipt');
    }
  };

  const handleApprove = (receiptId: string) => {
    handleUpdateReceipt(receiptId, { status: 'Approved' });
  };

  const handleReject = (receiptId: string) => {
    handleUpdateReceipt(receiptId, { status: 'Reviewed' });
  };

  const handleUpdateReceipt = (receiptId: string, updates: Partial<ReceiptData>) => {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    // Optimistic update - update UI immediately
    const previousReceipts = receipts;
    setReceipts(receipts.map(r => 
      r.id === receiptId ? { ...r, ...updates } : r
    ));
    setEditingReceiptId(null);

    // Make API call in the background
    fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/api/receipts/${receipt.companyId}/${receiptId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    ).then(response => {
      if (!response.ok) {
        throw new Error('Failed to update receipt');
      }
    }).catch(error => {
      // Rollback on error
      console.error('Failed to update receipt:', error);
      setReceipts(previousReceipts);
      toast.error('Failed to update receipt');
    });
  };

  const toggleExpanded = (receiptId: string) => {
    setExpandedReceiptIds(prev => {
      const next = new Set(prev);
      if (next.has(receiptId)) {
        next.delete(receiptId);
      } else {
        next.add(receiptId);
      }
      return next;
    });
  };

  const toggleSelectReceipt = (receiptId: string) => {
    setSelectedReceiptIds(prev => {
      const next = new Set(prev);
      if (next.has(receiptId)) {
        next.delete(receiptId);
      } else {
        next.add(receiptId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedReceiptIds.size === receipts.length) {
      setSelectedReceiptIds(new Set());
    } else {
      setSelectedReceiptIds(new Set(receipts.map(r => r.id)));
    }
  };

  const exportToCSV = () => {
    if (selectedReceiptIds.size === 0) {
      toast.error('Please select at least one receipt');
      return;
    }

    const selectedReceipts = receipts.filter(r => selectedReceiptIds.has(r.id));
    
    // CSV headers
    const headers = ['Date', 'Merchant', 'Category', 'Payment Method', 'Tax Rate', 'Tax', 'Total', 'Status', 'File Name'];
    
    // CSV rows
    const rows = selectedReceipts.map(r => [
      r.date,
      r.merchant,
      r.category,
      r.paymentMethod || '',
      r.taxRate ? `${(r.taxRate * 100).toFixed(0)}%` : '',
      r.tax?.toFixed(2) || '',
      r.total?.toFixed(2) || '',
      r.status,
      r.fileName
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `receipts_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success(`Exported ${selectedReceipts.length} receipts to CSV`);
  };

  const exportToXLSX = async () => {
    if (selectedReceiptIds.size === 0) {
      toast.error('Please select at least one receipt');
      return;
    }

    try {
      const selectedReceipts = receipts.filter(r => selectedReceiptIds.has(r.id));
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/api/receipts/export/xlsx`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            receipts: selectedReceipts
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export to XLSX');
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `receipts_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      
      toast.success(`Exported ${selectedReceipts.length} receipts to XLSX`);
    } catch (error) {
      console.error('Failed to export to XLSX:', error);
      toast.error('Failed to export to XLSX');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedCompanyId) {
      toast.error('Please select a company first');
      return;
    }

    // Accept any image or PDF - customers use all kinds of formats!
    const fileExtension = file.name.toLowerCase().split('.').pop() || '';
    const isImage = file.type.startsWith('image/') || 
                    ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'tiff', 'tif'].includes(fileExtension);
    const isPDF = file.type === 'application/pdf' || fileExtension === 'pdf';
    
    if (!isImage && !isPDF) {
      toast.error('Please upload an image or PDF file');
      return;
    }

    // Warn about large files but allow them
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File is too large (max 20MB)');
      return;
    }

    console.log('📎 Uploading file:', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      extension: fileExtension
    });

    try {
      setUploading(true);
      toast.info('Extracting receipt data with AI...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', selectedCompanyId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/api/receipts/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Upload failed:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to upload receipt');
      }

      const data = await response.json();
      
      toast.success(`Receipt extracted: ${data.receipt.merchant} - ${formatCurrency(data.receipt.total)}`);
      
      // Reload receipts
      await loadReceipts();
      setUploadDialogOpen(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload receipt');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    // Normalize status to handle case-insensitive values
    const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    
    switch (normalizedStatus) {
      case 'Pending':
        return <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-yellow-100 text-yellow-800'}>Pending Review</Badge>;
      case 'Reviewed':
        return <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-100 text-red-800'}>Reviewed</Badge>;
      case 'Approved':
        return <Badge variant="secondary" className={theme === 'premium-dark' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-800'}>Approved</Badge>;
      default:
        return <Badge variant="secondary">{normalizedStatus}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper to get amount from either field name (backward compatibility)
  const getAmount = (receipt: ReceiptData) => receipt.total ?? receipt.amount ?? 0;
  const getTax = (receipt: ReceiptData) => receipt.tax ?? receipt.taxAmount ?? 0;
  
  const totalAmount = receipts.reduce((sum, r) => sum + getAmount(r), 0);
  const pendingCount = receipts.filter(r => r.status === 'Pending').length;
  const approvedCount = receipts.filter(r => r.status === 'Approved').length;

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Header - Ultra Minimal */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={theme === 'premium-dark' ? 'text-4xl tracking-tight text-white' : 'text-4xl tracking-tight text-gray-900'}>Receipt Extraction</h1>
          <p className={theme === 'premium-dark' ? 'text-purple-300/40 text-sm mt-2' : 'text-gray-400 text-sm mt-2'}>
            Upload and extract receipt data with AI
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
          Upload Receipt
        </Button>
      </div>

      {/* Stats - Minimal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={theme === 'premium-dark'
          ? 'bg-white/[0.03] rounded-2xl p-6 border border-white/5'
          : 'bg-gray-50/50 rounded-2xl p-6'
        }>
          <div className={theme === 'premium-dark' ? 'text-purple-300/40 text-xs mb-2' : 'text-gray-400 text-xs mb-2'}>Total Receipts</div>
          <div className={theme === 'premium-dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>{receipts.length}</div>
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
              disabled={selectedReceiptIds.size === 0}
              className={theme === 'premium-dark' 
                ? 'bg-white/[0.03] border-white/10 text-gray-300 hover:bg-white/[0.05] hover:text-white h-11 rounded-xl' 
                : 'bg-gray-50/50 border-gray-200 h-11 rounded-xl'
              }
            >
              <Download className="size-4 mr-2" />
              Export Selected ({selectedReceiptIds.size})
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

      {/* Receipts List - Minimal */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className={theme === 'premium-dark' ? 'text-lg text-white/80 tracking-tight' : 'text-lg text-gray-700 tracking-tight'}>Receipts</h2>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedReceiptIds.size === receipts.length && receipts.length > 0}
              onCheckedChange={toggleSelectAll}
              disabled={receiptsLoading}
              className={theme === 'premium-dark' ? 'border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white' : ''}
            />
            <span className={theme === 'premium-dark' ? 'text-sm text-purple-300/40' : 'text-sm text-gray-400'}>Select All</span>
          </div>
        </div>

        {receiptsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className={theme === 'premium-dark' 
                ? 'w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4' 
                : 'w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4'
              }></div>
              <p className={theme === 'premium-dark' ? 'text-gray-400' : 'text-gray-600'}>Loading receipts...</p>
            </div>
          </div>
        ) : receipts.length === 0 ? (
          <div className={theme === 'premium-dark' 
            ? 'text-center py-20 border-2 border-dashed border-white/5 rounded-2xl' 
            : 'text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl'
          }>
            <Receipt className={theme === 'premium-dark' ? 'size-12 mx-auto mb-4 text-white/10' : 'size-12 mx-auto mb-4 text-gray-300'} />
            <p className={theme === 'premium-dark' ? 'text-white/60' : 'text-gray-500'}>No receipts found</p>
            <p className={theme === 'premium-dark' ? 'text-sm mt-2 text-purple-300/40' : 'text-sm mt-2 text-gray-400'}>Upload receipts to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className={theme === 'premium-dark'
                  ? 'bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:bg-white/[0.05] transition-all'
                  : 'bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition-all'
                }
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedReceiptIds.has(receipt.id)}
                    onCheckedChange={() => toggleSelectReceipt(receipt.id)}
                    className={theme === 'premium-dark' ? 'mt-1 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white' : 'mt-1'}
                  />
                  
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Receipt className={theme === 'premium-dark' ? 'size-5 text-white/20 flex-shrink-0 mt-0.5' : 'size-5 text-gray-300 flex-shrink-0 mt-0.5'} />
                        <div className="min-w-0">
                          <h3 className={theme === 'premium-dark' ? 'text-sm text-white mb-1' : 'text-sm text-gray-900 mb-1'}>
                            {receipt.merchant}
                            {getAmount(receipt) === 0 && receipt.merchant === 'Unknown Merchant' && (
                              <span className="ml-2 text-xs text-amber-500">Extraction incomplete</span>
                            )}
                          </h3>
                          <p className={theme === 'premium-dark' ? 'text-xs text-purple-300/40 truncate' : 'text-xs text-gray-400 truncate'}>
                            {receipt.fileName}
                            {receipt.source === 'email' && (
                              <span className={theme === 'premium-dark' ? 'ml-2 text-purple-400' : 'ml-2 text-blue-500'}>
                                <Mail className="size-3 inline-block" /> Via email
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {getStatusBadge(receipt.status)}
                        <span className={theme === 'premium-dark' ? 'text-base text-white tracking-tight' : 'text-base text-gray-900 tracking-tight'}>
                          {formatCurrency(getAmount(receipt))}
                        </span>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className={theme === 'premium-dark' ? 'flex items-center gap-6 text-xs text-purple-300/40 mb-4 flex-wrap' : 'flex items-center gap-6 text-xs text-gray-400 mb-4 flex-wrap'}>
                      <span>{formatDate(receipt.date)}</span>
                      <span>{receipt.category}</span>
                      <span>{receipt.paymentMethod}</span>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(receipt.id)}
                        className={theme === 'premium-dark' ? 'text-purple-300/60 hover:text-white hover:bg-white/[0.05] h-8' : 'h-8'}
                      >
                        <ChevronDown
                          className={`size-4 transition-transform ${
                            expandedReceiptIds.has(receipt.id) ? 'rotate-180' : ''
                          }`}
                        />
                        {expandedReceiptIds.has(receipt.id) ? 'Hide' : 'Show'} Details
                      </Button>

                      {receipt.status === 'Pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(receipt.id)}
                            className="text-green-500 hover:text-green-600 hover:bg-green-500/10 h-8"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(receipt.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8"
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleView(receipt)}
                        className={theme === 'premium-dark' ? 'text-purple-300/60 hover:text-white hover:bg-white/[0.05] h-8' : 'h-8'}
                      >
                        <Eye className="size-4 mr-1" />
                        View
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(receipt)}
                        className={theme === 'premium-dark' ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10 h-8' : 'text-red-600 hover:text-red-700 h-8'}
                      >
                        <Trash2 className="size-4 mr-1" />
                        Delete
                      </Button>
                    </div>

                    {/* Expandable Details */}
                    {expandedReceiptIds.has(receipt.id) && (
                      <div className={theme === 'premium-dark' ? 'mt-4 pt-4 border-t border-white/5 space-y-3' : 'mt-4 pt-4 border-t border-gray-100 space-y-3'}>
                        {/* Line Items */}
                        {receipt.items && receipt.items.length > 0 && (
                          <div className="space-y-1">
                            <div className={theme === 'premium-dark' ? 'text-xs text-purple-300/40 mb-2' : 'text-xs text-gray-400 mb-2'}>Items</div>
                            {receipt.items.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className={theme === 'premium-dark' ? 'text-purple-300/60' : 'text-gray-600'}>
                                  {item.quantity && item.quantity > 1 ? `${item.quantity}x ` : ''}
                                  {item.description}
                                </span>
                                <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Tax Summary */}
                        {getTax(receipt) > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className={theme === 'premium-dark' ? 'text-purple-300/40' : 'text-gray-400'}>
                                Tax {receipt.taxRate ? `(${(receipt.taxRate * 100).toFixed(1)}%)` : ''}
                              </span>
                              <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(getTax(receipt))}</span>
                            </div>
                            <div className={theme === 'premium-dark' ? 'flex justify-between text-sm pt-2 border-t border-white/5' : 'flex justify-between text-sm pt-2 border-t border-gray-100'}>
                              <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>Total</span>
                              <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(getAmount(receipt))}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Email Details */}
                        {receipt.source === 'email' && receipt.emailFrom && (
                          <div className={theme === 'premium-dark' ? 'pt-3 border-t border-white/5' : 'pt-3 border-t border-gray-100'}>
                            <div className={theme === 'premium-dark' ? 'text-xs text-purple-300/40 mb-2' : 'text-xs text-gray-400 mb-2'}>Email Details</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={theme === 'premium-dark' ? 'text-purple-300/40 w-20' : 'text-gray-400 w-20'}>From</span>
                                <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{receipt.emailFrom}</span>
                              </div>
                              {receipt.emailSubject && (
                                <div className="flex items-center gap-2">
                                  <span className={theme === 'premium-dark' ? 'text-purple-300/40 w-20' : 'text-gray-400 w-20'}>Subject</span>
                                  <span className={theme === 'premium-dark' ? 'text-white' : 'text-gray-900'}>{receipt.emailSubject}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileUpload}
        style={{ display: uploadDialogOpen ? 'block' : 'none' }}
        className="hidden"
      />
      {uploadDialogOpen && (
        <div className={theme === 'premium-dark' 
          ? 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center' 
          : 'fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center'
        } onClick={() => !uploading && setUploadDialogOpen(false)}>
          <div className={theme === 'premium-dark'
            ? 'bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4'
            : 'bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl'
          } onClick={(e) => e.stopPropagation()}>
            <h2 className={theme === 'premium-dark' ? 'text-2xl text-white mb-4' : 'text-2xl text-gray-900 mb-4'}>Upload Receipt</h2>
            <p className={theme === 'premium-dark' ? 'text-purple-300/60 mb-6' : 'text-gray-600 mb-6'}>
              Choose an image or PDF file to extract receipt data
            </p>
            <div className="space-y-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={theme === 'premium-dark'
                  ? 'w-full bg-white text-black hover:bg-white/90 h-11'
                  : 'w-full h-11'
                }
              >
                {uploading ? 'Uploading...' : 'Choose File'}
              </Button>
              {!uploading && (
                <Button
                  variant="ghost"
                  onClick={() => setUploadDialogOpen(false)}
                  className={theme === 'premium-dark' ? 'w-full text-purple-300/60 hover:text-white hover:bg-white/[0.05]' : 'w-full'}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}