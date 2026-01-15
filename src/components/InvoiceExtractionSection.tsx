import { motion, useInView, AnimatePresence } from "motion/react";
import { useRef, useState, useEffect } from "react";
import { Upload, CheckCircle2, FileText, Receipt, FileSpreadsheet, Mail } from "lucide-react";
import invoiceIllustration from 'figma:asset/1d211e6e3a755b375230809e80319ef40f28cb28.png';

interface ExtractedData {
  vendor: string;
  date: string;
  amount: string;
  invoiceNumber: string;
  items: { description: string; amount: string }[];
}

interface DocumentExample {
  type: string;
  icon: typeof FileText;
  data: ExtractedData;
}

export function InvoiceExtractionSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });
  const [currentDocument, setCurrentDocument] = useState(0);

  const documents: DocumentExample[] = [
    {
      type: "Invoice",
      icon: FileText,
      data: {
        vendor: "Acme Corp Solutions",
        date: "2024-12-15",
        amount: "€2,450.00",
        invoiceNumber: "INV-2024-1534",
        items: [
          { description: "Professional Services", amount: "€2,000.00" },
          { description: "Software License", amount: "€450.00" }
        ]
      }
    },
    {
      type: "Receipt",
      icon: Receipt,
      data: {
        vendor: "Office Supply Store",
        date: "2024-12-14",
        amount: "€127.50",
        invoiceNumber: "RCP-89234",
        items: [
          { description: "Printer Paper (5 boxes)", amount: "€45.00" },
          { description: "Ink Cartridges", amount: "€82.50" }
        ]
      }
    },
    {
      type: "Expense Report",
      icon: FileSpreadsheet,
      data: {
        vendor: "Business Travel GmbH",
        date: "2024-12-13",
        amount: "€584.20",
        invoiceNumber: "EXP-2024-442",
        items: [
          { description: "Flight Munich-Berlin", amount: "€320.00" },
          { description: "Hotel (2 nights)", amount: "€264.20" }
        ]
      }
    }
  ];

  const currentDoc = documents[currentDocument];

  useEffect(() => {
    if (!isInView) return;

    // Cycle to next document
    const cycleTimeout = setTimeout(() => {
      setCurrentDocument(prev => (prev + 1) % documents.length);
    }, 6000);

    return () => {
      clearTimeout(cycleTimeout);
    };
  }, [isInView, currentDocument]);

  const Icon = currentDoc.icon;

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen bg-black flex flex-col items-center justify-center px-4 md:px-6 py-16 md:py-20"
    >
      <div className="relative z-10 max-w-6xl mx-auto w-full">
        {/* Main headline */}
        <div className="mb-12 md:mb-20">
          <div className="grid lg:grid-cols-[55%_45%] gap-8 lg:gap-12 items-center">
            {/* Text Content */}
            <div className="text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl text-white mb-6 leading-tight"
                  style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700', letterSpacing: '-0.02em' }}>
                <span className="inline-block">Structured data from</span><br />
                <span className="inline-block">invoices and receipts</span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl max-w-lg"
                 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}>
                Email, upload or drag and drop. Novalare instantly extracts and validates
                invoice and receipt data, making it ready for review and export without manual entry.
              </p>
            </div>

            {/* Illustration */}
            <div className="flex justify-center lg:justify-end">
              <img 
                src={invoiceIllustration} 
                alt="Invoice extraction illustration" 
                className="w-full max-w-lg h-auto object-contain"
              />
            </div>
          </div>
        </div>

        {/* Main demo area */}
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 max-w-5xl mx-auto">
          {/* Left: Document Upload */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-gray-500" />
              <span className="text-gray-400 text-sm">Step 1: Upload</span>
            </div>

            {/* Receipt Image Display - No Box */}
            <div className="relative flex items-center justify-center min-h-[500px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentDocument}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="w-full max-w-[320px] bg-white rounded-lg shadow-2xl p-6"
                >
                  {/* Receipt Header */}
                  <div className="text-center border-b border-gray-300 pb-4 mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{currentDoc.data.vendor}</h3>
                    <p className="text-xs text-gray-600 mt-1">123 Business Street</p>
                    <p className="text-xs text-gray-600">Munich, Germany</p>
                    <p className="text-xs text-gray-600">VAT: DE123456789</p>
                  </div>

                  {/* Receipt Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Receipt #:</span>
                      <span className="text-gray-900 font-mono">{currentDoc.data.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Date:</span>
                      <span className="text-gray-900">{currentDoc.data.date}</span>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
                    {currentDoc.data.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{item.description}</p>
                        </div>
                        <div className="text-sm font-medium text-gray-900 ml-4">{item.amount}</div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="border-t border-gray-300 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">TOTAL</span>
                      <span className="text-2xl font-bold text-gray-900">{currentDoc.data.amount}</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Extracted Data */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-gray-500" />
              <span className="text-gray-400 text-sm">Step 2: Review & Export</span>
            </div>

            <div className="min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white text-lg font-semibold">Extracted Data</h3>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500 text-white">
                  {currentDoc.type}
                </span>
              </div>

              {/* Extracted Fields */}
              <div className="space-y-4">
                {/* Vendor */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ 
                    opacity: 1,
                    y: 0
                  }}
                  transition={{ delay: 0.1 }}
                >
                  <label className="text-gray-500 text-xs mb-1 block">Vendor</label>
                  <div className="bg-gray-800/30 rounded-lg px-4 py-3 text-white font-medium">
                    {currentDoc.data.vendor}
                  </div>
                </motion.div>

                {/* Date & Invoice Number */}
                <div className="grid grid-cols-2 gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: 1,
                      y: 0
                    }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="text-gray-500 text-xs mb-1 block">Date</label>
                    <div className="bg-gray-800/30 rounded-lg px-4 py-3 text-white text-sm">
                      {currentDoc.data.date}
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: 1,
                      y: 0
                    }}
                    transition={{ delay: 0.25 }}
                  >
                    <label className="text-gray-500 text-xs mb-1 block">Invoice #</label>
                    <div className="bg-gray-800/30 rounded-lg px-4 py-3 text-white text-sm">
                      {currentDoc.data.invoiceNumber}
                    </div>
                  </motion.div>
                </div>

                {/* Line Items */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ 
                    opacity: 1,
                    y: 0
                  }}
                  transition={{ delay: 0.3 }}
                >
                  <label className="text-gray-500 text-xs mb-2 block">Line Items</label>
                  <div className="space-y-2">
                    {currentDoc.data.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-800/30 rounded-lg px-4 py-2.5 flex justify-between items-center">
                        <span className="text-white text-sm">{item.description}</span>
                        <span className="text-gray-400 text-sm font-medium">{item.amount}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Total Amount */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ 
                    opacity: 1,
                    y: 0
                  }}
                  transition={{ delay: 0.4 }}
                  className="pt-4 border-t border-gray-700/50"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Amount</span>
                    <span className="text-2xl font-bold text-blue-400">
                      {currentDoc.data.amount}
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Export Button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: 1
                }}
                transition={{ delay: 0.5 }}
                className={`mt-6 w-full py-3 rounded-lg font-medium transition-all ${
                  'bg-blue-500 text-white hover:bg-blue-600' 
                }`}
              >
                Export to QuickBooks / Xero / DATEV
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}