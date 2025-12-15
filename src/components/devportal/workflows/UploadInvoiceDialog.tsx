import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { invoicesApi, documentsApi, activitiesApi } from '@/utils/api-client';

interface UploadInvoiceDialogProps {
  companyId: string;
  onSuccess?: () => void;
  onOpenChange?: (open: boolean) => void;
}

interface InvoiceData {
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  net_amount: string;
  vat_amount: string;
  total_amount: string;
  currency: string;
}

export function UploadInvoiceDialog({ companyId, onSuccess, onOpenChange }: UploadInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('Please upload a PDF or image file (PNG, JPG)');
        return;
      }

      // Validate file size (10MB max)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const syntheticEvent = {
        target: { files: [droppedFile] }
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(syntheticEvent);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Call the invoice extraction API
      const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/analyze-invoice`;

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: formData,
      });

      const responseData = await response.json();

      if (response.ok) {
        setExtractedData(responseData as InvoiceData);
        toast.success('Invoice extracted successfully! 🎉');
      } else {
        throw new Error(responseData.error || `Server responded with ${response.status}`);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to process invoice. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Upload error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData || !file) return;

    try {
      toast.loading('Checking for duplicates...');
      
      // 0. Check for duplicate invoices
      const existingInvoices = await invoicesApi.getByCompany(companyId);
      const duplicate = existingInvoices.find(inv => 
        inv.invoiceNumber?.toLowerCase() === extractedData.invoice_number?.toLowerCase() &&
        inv.vendor?.toLowerCase() === extractedData.supplier_name?.toLowerCase()
      );
      
      if (duplicate) {
        toast.dismiss();
        const proceed = confirm(
          `⚠️ DUPLICATE DETECTED!\n\n` +
          `Invoice "${extractedData.invoice_number}" from "${extractedData.supplier_name}" already exists.\n\n` +
          `Existing: ${duplicate.currency || 'EUR'} ${duplicate.gross} (${duplicate.date})\n` +
          `New: ${extractedData.currency} ${extractedData.total_amount} (${extractedData.invoice_date})\n\n` +
          `Do you want to save it anyway?`
        );
        
        if (!proceed) {
          toast.info('Invoice upload cancelled');
          return;
        }
      }
      
      toast.loading('Saving invoice and uploading file...');
      
      // 1. Upload file to storage
      const fileUrl = await documentsApi.uploadFile(companyId, file);
      
      // 2. Create invoice record (with file URL)
      await invoicesApi.create(companyId, {
        documentName: file.name,
        vendor: extractedData.supplier_name,
        invoiceNumber: extractedData.invoice_number,
        date: extractedData.invoice_date,
        dueDate: extractedData.due_date,
        net: extractedData.net_amount,
        vat: extractedData.vat_amount,
        gross: extractedData.total_amount,
        currency: extractedData.currency,
        category: 'General Expense',
        status: 'Pending', // Status: To Review → Verified → Paid
        fileUrl: fileUrl, // Store file URL for direct access
      });

      // 3. Create document record for Documents section (with file URL)
      await documentsApi.create(companyId, {
        name: file.name,
        type: 'Invoice',
        status: 'Processed',
        fileUrl: fileUrl,
      });

      // 4. Create activity log entry
      const now = new Date();
      await activitiesApi.create(companyId, {
        action: `Processed invoice: ${extractedData.supplier_name} - ${extractedData.currency} ${extractedData.total_amount}`,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      });

      toast.dismiss();
      toast.success('Invoice saved and file uploaded successfully!');
      
      // Reset and close
      setFile(null);
      setExtractedData(null);
      setError(null);
      setOpen(false);

      // Notify parent to refresh
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to save invoice:', err);
      toast.error('Failed to save invoice');
    }
  };

  const handleReset = () => {
    setFile(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    setOpen(false);
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (onOpenChange) {
        onOpenChange(newOpen);
      }
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-10 bg-gray-900 hover:bg-gray-800">
          <Upload className="size-4" />
          <span className="text-sm">Upload Invoices</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload & Extract Invoice</DialogTitle>
          <DialogDescription>
            Upload an invoice PDF or image and let AI extract the data automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!extractedData && !isProcessing && (
            <>
              {/* Drag & Drop Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  file
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <span className="text-gray-900">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600 mb-2">Drag & drop your invoice here</p>
                    <p className="text-sm text-gray-400">or click to browse</p>
                    <p className="text-xs text-gray-400 mt-2">PDF, PNG, JPG (max 10MB)</p>
                  </>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!file} className="bg-gray-900 hover:bg-gray-800">
                  Extract Data
                </Button>
              </div>
            </>
          )}

          {isProcessing && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-600 animate-spin" />
              <p className="text-gray-600">Extracting invoice data with AI...</p>
              <p className="text-sm text-gray-400 mt-2">This may take a few seconds</p>
            </div>
          )}

          {extractedData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 mb-4">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Invoice data extracted successfully!</span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Supplier</p>
                    <p className="text-sm text-gray-900">{extractedData.supplier_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Invoice Number</p>
                    <p className="text-sm text-gray-900">{extractedData.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Invoice Date</p>
                    <p className="text-sm text-gray-900">{extractedData.invoice_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Due Date</p>
                    <p className="text-sm text-gray-900">{extractedData.due_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net Amount</p>
                    <p className="text-sm text-gray-900">{extractedData.net_amount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">VAT</p>
                    <p className="text-sm text-gray-900">{extractedData.vat_amount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-sm text-gray-900 font-semibold">{extractedData.total_amount} {extractedData.currency}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={handleReset}>
                  Upload Another
                </Button>
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                  Save Invoice
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}