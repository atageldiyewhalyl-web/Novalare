import { useState, lazy, Suspense, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { FileText, Receipt } from 'lucide-react';

// Lazy load the extraction components for better performance
const InvoiceExtraction = lazy(() => 
  import('./workflows/InvoiceExtraction').then(m => ({ default: m.InvoiceExtraction }))
);
const ReceiptExtraction = lazy(() => 
  import('./workflows/ReceiptExtraction_new').then(m => ({ default: m.ReceiptExtraction }))
);

interface ReceiptsInvoicesProps {
  companyId: string;
}

export function ReceiptsInvoices({ companyId }: ReceiptsInvoicesProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'invoices' | 'receipts'>('invoices');
  
  // Separate state for invoices
  const [invoiceSelectedPeriod, setInvoiceSelectedPeriod] = useState<string>('');
  const [invoiceSortBy, setInvoiceSortBy] = useState<'invoice-date' | 'upload-date'>('invoice-date');
  
  // Separate state for receipts
  const [receiptSelectedPeriod, setReceiptSelectedPeriod] = useState<string>('');
  const [receiptSortBy, setReceiptSortBy] = useState<'receipt-date' | 'upload-date'>('receipt-date');

  // Set default period for invoices to current month on mount
  useEffect(() => {
    if (!invoiceSelectedPeriod) {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      setInvoiceSelectedPeriod(currentPeriod);
    }
  }, [invoiceSelectedPeriod]);

  // Set default period for receipts to current month on mount
  useEffect(() => {
    if (!receiptSelectedPeriod) {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      setReceiptSelectedPeriod(currentPeriod);
    }
  }, [receiptSelectedPeriod]);

  // Loading fallback component
  const LoadingFallback = () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className={`w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 ${
          theme === 'dark' 
            ? 'border-zinc-700 border-t-[#65D3FD]' 
            : 'border-gray-200 border-t-[#65D3FD]'
        }`}></div>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
          Loading {activeTab === 'invoices' ? 'invoices' : 'receipts'}...
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with Tab Switcher */}
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Receipts & Invoices
        </h1>
        
        {/* Tab Switcher */}
        <div className={`
          flex items-center rounded-lg p-1
          ${theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'}
        `}>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`
              px-4 py-2 rounded-md transition-all flex items-center gap-2
              ${activeTab === 'invoices'
                ? 'bg-[#65D3FD] text-black'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <FileText className="w-4 h-4" />
            Invoices
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`
              px-4 py-2 rounded-md transition-all flex items-center gap-2
              ${activeTab === 'receipts'
                ? 'bg-[#65D3FD] text-black'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <Receipt className="w-4 h-4" />
            Receipts
          </button>
        </div>
      </div>

      {/* Content - Lazy loaded with Suspense for better performance */}
      <Suspense fallback={<LoadingFallback />}>
        {activeTab === 'invoices' ? (
          <InvoiceExtraction 
            companyId={companyId}
            selectedPeriod={invoiceSelectedPeriod}
            setSelectedPeriod={setInvoiceSelectedPeriod}
            sortBy={invoiceSortBy}
            setSortBy={setInvoiceSortBy}
          />
        ) : (
          <ReceiptExtraction 
            companyId={companyId}
            selectedPeriod={receiptSelectedPeriod}
            setSelectedPeriod={setReceiptSelectedPeriod}
            sortBy={receiptSortBy}
            setSortBy={setReceiptSortBy}
          />
        )}
      </Suspense>
    </div>
  );
}