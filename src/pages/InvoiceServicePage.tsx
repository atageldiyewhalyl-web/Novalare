import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, XCircle, ArrowLeft, CheckCircle, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner@2.0.3";
import { InvoiceAnimationStages } from "../components/InvoiceAnimationStages";
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { trackDemoEvent } from '../utils/analytics';

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

export function InvoiceServicePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<InvoiceData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Time savings calculator state
  const [invoiceCount, setInvoiceCount] = useState(400);
  const minutesPerInvoice = 4;
  const totalMinutes = invoiceCount * minutesPerInvoice;
  const hoursPerWeek = (totalMinutes / 60).toFixed(1);

  // Cleanup on unmount - abort pending requests ONLY
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any pending fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // DO NOT reset state here - component is unmounting
    };
  }, []);

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
      setExtractedData(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Create a synthetic event to reuse validation logic
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

    console.log('🚀 Upload started');
    console.log('📄 File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    setIsProcessing(true);
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    
    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('📦 Sending to server for AI extraction...');

      const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/analyze-invoice`;

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: formData,
        signal: abortControllerRef.current.signal, // Add abort signal
      });
      
      console.log('✅ Response status:', response.status, response.statusText);
      
      const responseData = await response.json();
      console.log('📥 Server response:', responseData);

      const processingTime = (Date.now() - startTime) / 1000;

      if (response.ok) {
        if (!isMountedRef.current) return;
        setExtractedData(responseData as InvoiceData);
        setIsProcessing(false);
        
        toast.success('Invoice processed successfully! 🎉');
        
        // Track successful analytics (fire and forget - don't block UI)
        trackDemoEvent({
          demoType: 'invoice',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          success: true,
          processingTime,
          metadata: {
            supplier: responseData.supplier_name,
            amount: responseData.total_amount,
            currency: responseData.currency,
          }
        }).catch(err => console.warn('Analytics tracking failed:', err));
      } else {
        throw new Error(responseData.error || `Server responded with ${response.status}`);
      }
      
    } catch (err: any) {
      // Ignore abort errors (they're intentional when navigating away)
      if (err.name === 'AbortError') {
        console.log('🛑 Request aborted (component unmounted)');
        return;
      }
      
      if (!isMountedRef.current) return;
      
      const errorMessage = err.message || 'Failed to process invoice. Please try again.';
      const processingTime = (Date.now() - startTime) / 1000;
      
      setError(errorMessage);
      setIsProcessing(false);
      
      toast.error(errorMessage);
      console.error('❌ Upload error:', err);
      
      // Track failed analytics (fire and forget - don't block UI)
      trackDemoEvent({
        demoType: 'invoice',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        success: false,
        processingTime,
        errorMessage,
      }).catch(err => console.warn('Analytics tracking failed:', err));
    }
  };

  const handleReset = () => {
    setFile(null);
    setError(null);
    setExtractedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative bg-black min-h-screen overflow-x-hidden">
      <Header />
      
      {/* Main Content */}
      <div className="relative pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link to="/" className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>

          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl text-white mb-4 font-extrabold">
              Invoice <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Extraction Demo</span>
            </h1>
            <p className="text-lg sm:text-xl text-purple-200 max-w-2xl mx-auto">
              Upload your invoice and watch AI extract, validate, and automate your entire workflow.
            </p>
          </div>

          {/* Upload Card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 sm:p-12">
            {!extractedData && !isProcessing && (
              <>
                {/* Drag & Drop Area */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    file
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {!file ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center">
                        <Upload className="w-8 h-8 text-purple-300" />
                      </div>
                      <div>
                        <p className="text-white text-lg mb-2">
                          Drop your invoice here or <span className="text-purple-400">browse</span>
                        </p>
                        <p className="text-purple-200/60 text-sm">
                          Supports PDF, PNG, JPG (Max 10MB)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-purple-300" />
                      </div>
                      <div>
                        <p className="text-white text-lg mb-1">{file.name}</p>
                        <p className="text-purple-200/60 text-sm">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReset();
                        }}
                        variant="outline"
                        className="mt-4"
                      >
                        Choose Different File
                      </Button>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-red-200">{error}</p>
                  </div>
                )}

                {/* Process Button */}
                <Button
                  onClick={handleUpload}
                  disabled={!file || isProcessing}
                  className="w-full mt-8 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-600 hover:via-fuchsia-600 hover:to-pink-600 text-white py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Process Invoice
                </Button>

                {/* Info Text */}
                <p className="text-center text-purple-200/60 text-sm mt-6">
                  Your invoice will be processed securely and the extracted data will be displayed instantly.
                </p>
              </>
            )}

            {isProcessing && (
              /* Processing State */
              <div className="text-center space-y-6">
                <div className="w-20 h-20 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                </div>
                
                <div>
                  <h3 className="text-2xl text-white mb-2">Processing Invoice...</h3>
                  <p className="text-purple-200">
                    AI is extracting data from your invoice.
                  </p>
                </div>
              </div>
            )}

            {/* Animation Stages */}
            {extractedData && (
              <InvoiceAnimationStages 
                data={extractedData}
                onReset={handleReset}
              />
            )}
          </div>

          {/* Time Savings Calculator Section */}
          <div className="mt-16 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-pink-500/10 border border-purple-500/30 rounded-3xl p-8 sm:p-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl text-white mb-4 font-extrabold">
                The <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Real Cost</span> of Manual Processing
              </h2>
              <p className="text-lg text-purple-200">
                Let's do the math on what you're actually spending
              </p>
            </div>

            {/* Stat Highlight */}
            <div className="max-w-3xl mx-auto mb-10">
              {/* Invoice Count Slider */}
              <div className="mb-8">
                <label className="block text-center mb-4">
                  <span className="text-purple-200 text-lg">How many invoices do you receive per week?</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={invoiceCount}
                    onChange={(e) => setInvoiceCount(Number(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-fuchsia-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-r [&::-moz-range-thumb]:from-purple-500 [&::-moz-range-thumb]:to-fuchsia-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <input
                    type="number"
                    min="50"
                    max="1000"
                    step="50"
                    value={invoiceCount}
                    onChange={(e) => setInvoiceCount(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex justify-between text-sm text-purple-200/60 mt-2">
                  <span>50</span>
                  <span>1,000</span>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center">
                <div className="text-5xl sm:text-6xl md:text-7xl font-extrabold bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent mb-4">
                  {hoursPerWeek} Hours
                </div>
                <p className="text-xl sm:text-2xl text-white mb-2">
                  Saved per week with automation
                </p>
                <p className="text-purple-200">
                  If you're receiving {invoiceCount} invoices per week
                </p>
              </div>
            </div>

            {/* Math Breakdown */}
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-200">Manual time per invoice:</span>
                  <span className="text-white">{minutesPerInvoice} minutes</span>
                </div>
                <div className="h-px bg-white/10 my-3"></div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-200">Weekly invoice volume:</span>
                  <span className="text-white">× {invoiceCount} invoices</span>
                </div>
                <div className="h-px bg-white/10 my-3"></div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-200">Total weekly time:</span>
                  <span className="text-white">= {totalMinutes} minutes</span>
                </div>
              </div>

              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-full">
                  <span className="text-2xl">↓</span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500/20 via-fuchsia-500/20 to-pink-500/20 border border-purple-500/50 rounded-xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
                  <span className="text-white text-sm sm:text-base">{totalMinutes} minutes ÷ 60</span>
                  <span className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                    = {hoursPerWeek} hours/week
                  </span>
                </div>
                <p className="text-purple-200 text-sm">
                  That's nearly a full work week spent just recording invoices!
                </p>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center mt-10">
              <p className="text-lg text-purple-200 mb-6">
                An accounting firm receiving 400 invoices/week spends <span className="text-white font-bold">30–40 hours/week</span> on manual data entry.
              </p>
              <p className="text-xl text-white">
                <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent font-extrabold">Imagine getting all that time back.</span>
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-12 h-12 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-300" />
              </div>
              <h4 className="text-white mb-2">Instant Extraction</h4>
              <p className="text-purple-200/70 text-sm">
                AI extracts all key invoice data in seconds
              </p>
            </div>

            <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-12 h-12 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-purple-300" />
              </div>
              <h4 className="text-white mb-2">High Accuracy</h4>
              <p className="text-purple-200/70 text-sm">
                99%+ accuracy on invoice data extraction
              </p>
            </div>

            <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-12 h-12 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
                <Download className="w-6 h-6 text-purple-300" />
              </div>
              <h4 className="text-white mb-2">Excel Ready</h4>
              <p className="text-purple-200/70 text-sm">
                Structured data ready for your workflow
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
