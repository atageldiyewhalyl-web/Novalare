import { Button } from '@/components/ui/button';
import { Download, Receipt, Building, Trash2, Eye, Upload, ChevronDown, Mail, RefreshCw, Copy, Check, Calendar, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useRef, useEffect, useMemo } from 'react';
import { receiptsApi } from '@/utils/api-client';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import gmailLogo from 'figma:asset/6953f24e6e4fbbab68b8caadff36f375063095c2.png';

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
  companyId: string;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  sortBy: 'receipt-date' | 'upload-date';
  setSortBy: (sortBy: 'receipt-date' | 'upload-date') => void;
}

export function ReceiptExtraction({ companyId, selectedPeriod, setSelectedPeriod, sortBy, setSortBy }: ReceiptExtractionProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Set<string>>(new Set());
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
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

  // Fetch receipts with React Query
  const { data: allReceipts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['receipts', companyId],
    queryFn: () => receiptsApi.getByCompany(companyId),
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    refetchOnWindowFocus: false, // Disable aggressive auto-reload
  });

  // Filter receipts by selected period and sort
  const receipts = useMemo(() => {
    let filtered = allReceipts;
    
    // Filter by period if not "all"
    if (selectedPeriod && selectedPeriod !== 'all') {
      const [year, month] = selectedPeriod.split('-').map(Number);
      
      filtered = allReceipts.filter((receipt) => {
        // Use upload date (uploadedAt) when sorting by upload date, otherwise use receipt date
        const dateToCheck = sortBy === 'upload-date' ? new Date(receipt.uploadedAt) : new Date(receipt.date);
        return dateToCheck.getFullYear() === year && dateToCheck.getMonth() + 1 === month;
      });
    }
    
    // Sort by selected criteria
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'receipt-date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        // Sort by upload date (uploadedAt)
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
    });
    
    return sorted;
  }, [allReceipts, selectedPeriod, sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className={`w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 ${
            theme === 'dark'
              ? 'border-zinc-700 border-t-[#65D3FD]'
              : 'border-gray-200 border-t-[#65D3FD]'
          }`}></div>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Loading receipts...</p>
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
          Error: {error instanceof Error ? error.message : 'Failed to load receipts'}
        </p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const handleDelete = async (receipt: ReceiptData) => {
    if (!confirm(`Are you sure you want to delete receipt from ${receipt.merchant}?`)) {
      return;
    }

    // Optimistic update
    queryClient.setQueryData(['receipts', companyId], (old: ReceiptData[] = []) => 
      old.filter(r => r.id !== receipt.id)
    );

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

      toast.success('Receipt deleted successfully');
    } catch (error) {
      console.error('Failed to delete receipt:', error);
      queryClient.invalidateQueries(['receipts', companyId]);
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
    queryClient.setQueryData(['receipts', companyId], (old: ReceiptData[] = []) =>
      old.map(r => r.id === receiptId ? { ...r, ...updates } : r)
    );
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
      queryClient.invalidateQueries(['receipts', companyId]);
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

    if (!companyId) {
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
      formData.append('companyId', companyId);

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
      
      // Reload receipts via React Query
      queryClient.invalidateQueries(['receipts', companyId]);
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
        return <Badge variant="secondary" className={theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-yellow-100 text-yellow-800'}>Pending Review</Badge>;
      case 'Reviewed':
        return <Badge variant="secondary" className={theme === 'dark' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-100 text-red-800'}>Reviewed</Badge>;
      case 'Approved':
        return <Badge variant="secondary" className={theme === 'dark' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-800'}>Approved</Badge>;
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={theme === 'dark' ? 'text-4xl tracking-tight text-white' : 'text-4xl tracking-tight text-gray-900'}>
            Receipt Extraction
          </h1>
          <p className={theme === 'dark' ? 'text-gray-400 text-sm mt-2' : 'text-gray-500 text-sm mt-2'}>
            Upload and extract receipt data with AI
          </p>
        </div>
        <Button 
          onClick={() => setUploadDialogOpen(true)} 
          className="gap-2 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black h-10 px-6 rounded-full"
        >
          <Upload className="size-4" />
          Upload Receipt
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
          <Select value={sortBy} onValueChange={(value: 'receipt-date' | 'upload-date') => setSortBy(value)}>
            <SelectTrigger className={theme === 'dark' 
              ? 'bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl' 
              : 'bg-gray-50/50 border-gray-200 h-11 rounded-xl'
            }>
              <ArrowUpDown className="size-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className={theme === 'dark' ? 'bg-gray-900 border-white/10' : ''}>
              <SelectItem 
                value="receipt-date" 
                className={theme === 'dark' ? 'text-gray-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white' : ''}
              >
                Sort by Receipt Date
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
          <div className={theme === 'dark' ? 'text-gray-400 text-xs mb-2' : 'text-gray-500 text-xs mb-2'}>Total Receipts</div>
          <div className={theme === 'dark' ? 'text-3xl text-white tracking-tight' : 'text-3xl text-gray-900 tracking-tight'}>
            {receipts.length}
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
              disabled={selectedReceiptIds.size === 0}
              className={theme === 'dark' 
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
            className={theme === 'dark' ? 'bg-gray-900 border-white/10' : ''}
          >
            <DropdownMenuItem 
              onClick={exportToCSV}
              className={theme === 'dark' ? 'text-gray-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white' : ''}
            >
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={exportToXLSX}
              className={theme === 'dark' ? 'text-gray-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white' : ''}
            >
              Export as XLSX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Receipts List */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className={theme === 'dark' ? 'text-lg text-white/80 tracking-tight' : 'text-lg text-gray-700 tracking-tight'}>
            Receipts
          </h2>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedReceiptIds.size === receipts.length && receipts.length > 0}
              onCheckedChange={toggleSelectAll}
              disabled={isLoading}
              className={theme === 'dark' ? 'border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white' : ''}
            />
            <span className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-500'}>Select All</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className={`w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 ${
                theme === 'dark'
                  ? 'border-zinc-700 border-t-[#65D3FD]'
                  : 'border-gray-200 border-t-[#65D3FD]'
              }`}></div>
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Loading receipts...</p>
            </div>
          </div>
        ) : receipts.length === 0 ? (
          <div className={theme === 'dark' 
            ? 'text-center py-20 border-2 border-dashed border-white/5 rounded-2xl' 
            : 'text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl'
          }>
            <Receipt className={theme === 'dark' ? 'size-12 mx-auto mb-4 text-white/10' : 'size-12 mx-auto mb-4 text-gray-300'} />
            <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-500'}>No receipts yet</p>
            <p className={theme === 'dark' ? 'text-sm mt-2 text-gray-400' : 'text-sm mt-2 text-gray-400'}>
              Upload your first receipt to get started
            </p>
            <Button 
              onClick={() => setUploadDialogOpen(true)}
              className="mt-6 bg-[#65D3FD] hover:bg-[#65D3FD]/90 text-black"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Receipt
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className={theme === 'dark'
                  ? 'bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:bg-white/[0.05] transition-all'
                  : 'bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition-all'
                }
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedReceiptIds.has(receipt.id)}
                    onCheckedChange={() => toggleSelectReceipt(receipt.id)}
                    className={theme === 'dark' ? 'mt-1 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black data-[state=checked]:border-white' : 'mt-1'}
                  />
                  
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Receipt className={theme === 'dark' ? 'size-5 text-white/20 flex-shrink-0 mt-0.5' : 'size-5 text-gray-300 flex-shrink-0 mt-0.5'} />
                        <div className="min-w-0">
                          <h3 className={theme === 'dark' ? 'text-sm text-white mb-1' : 'text-sm text-gray-900 mb-1'}>
                            {receipt.merchant}
                            {getAmount(receipt) === 0 && receipt.merchant === 'Unknown Merchant' && (
                              <span className="ml-2 text-xs text-amber-500">Extraction incomplete</span>
                            )}
                          </h3>
                          <p className={theme === 'dark' ? 'text-xs text-gray-400 truncate' : 'text-xs text-gray-500 truncate'}>
                            {receipt.fileName}
                            {receipt.source === 'email' && (
                              <span className={theme === 'dark' ? 'ml-2 text-[#65D3FD]' : 'ml-2 text-blue-500'}>
                                <Mail className="size-3 inline-block" /> Via email
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {getStatusBadge(receipt.status)}
                        <span className={theme === 'dark' ? 'text-base text-white tracking-tight' : 'text-base text-gray-900 tracking-tight'}>
                          {formatCurrency(getAmount(receipt))}
                        </span>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className={theme === 'dark' ? 'flex items-center gap-6 text-xs text-gray-400 mb-4 flex-wrap' : 'flex items-center gap-6 text-xs text-gray-500 mb-4 flex-wrap'}>
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
                        className={theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/[0.05] h-8' : 'h-8'}
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
                        className={theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/[0.05] h-8' : 'h-8'}
                      >
                        <Eye className="size-4 mr-1" />
                        View
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(receipt)}
                        className={theme === 'dark' ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10 h-8' : 'text-red-600 hover:text-red-700 h-8'}
                      >
                        <Trash2 className="size-4 mr-1" />
                        Delete
                      </Button>
                    </div>

                    {/* Expandable Details */}
                    {expandedReceiptIds.has(receipt.id) && (
                      <div className={theme === 'dark' ? 'mt-4 pt-4 border-t border-white/5 space-y-3' : 'mt-4 pt-4 border-t border-gray-100 space-y-3'}>
                        {/* Line Items */}
                        {receipt.items && receipt.items.length > 0 && (
                          <div className="space-y-1">
                            <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-2' : 'text-xs text-gray-500 mb-2'}>Items</div>
                            {receipt.items.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                  {item.quantity && item.quantity > 1 ? `${item.quantity}x ` : ''}
                                  {item.description}
                                </span>
                                <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Tax Summary */}
                        {getTax(receipt) > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                                Tax {receipt.taxRate ? `(${(receipt.taxRate * 100).toFixed(1)}%)` : ''}
                              </span>
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(getTax(receipt))}</span>
                            </div>
                            <div className={theme === 'dark' ? 'flex justify-between text-sm pt-2 border-t border-white/5' : 'flex justify-between text-sm pt-2 border-t border-gray-100'}>
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Total</span>
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{formatCurrency(getAmount(receipt))}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Email Details */}
                        {receipt.source === 'email' && receipt.emailFrom && (
                          <div className={theme === 'dark' ? 'pt-3 border-t border-white/5' : 'pt-3 border-t border-gray-100'}>
                            <div className={theme === 'dark' ? 'text-xs text-gray-400 mb-2' : 'text-xs text-gray-500 mb-2'}>Email Details</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={theme === 'dark' ? 'text-gray-400 w-20' : 'text-gray-500 w-20'}>From</span>
                                <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{receipt.emailFrom}</span>
                              </div>
                              {receipt.emailSubject && (
                                <div className="flex items-center gap-2">
                                  <span className={theme === 'dark' ? 'text-gray-400 w-20' : 'text-gray-500 w-20'}>Subject</span>
                                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{receipt.emailSubject}</span>
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