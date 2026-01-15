import { motion } from 'motion/react';
import { CheckCircle2, TrendingUp, FileSearch, Calculator, Sparkles, CreditCard, FileText, DollarSign, Building2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import calculatorIcon from 'figma:asset/8fe00593e7ea0a0b1dd0ed6c9b5edca659e1cf56.png';
import trendingIcon from 'figma:asset/36550d4814adfa5da53c0f6b48fea7f5d81dd1a1.png';
import documentIcon from 'figma:asset/74ba2371f622990dea7c6b8a36dc58df293c657c.png';
import integrationIcon from 'figma:asset/542bb2840f164c3140fbb5652967830f1ac5da68.png';
import workingIllustration from 'figma:asset/dc73088db6f96fb82f6914c314476eb301a073df.png';

export function MonthEndCloseSection() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const steps = [
    { title: 'Bank Reconciliation', icon: CheckCircle2, status: 'completed', color: 'text-green-400', category: 'Reconciliations' },
    { title: 'AP/AR Reconciliation', icon: Building2, status: 'completed', color: 'text-green-400', category: 'Reconciliations' },
    { title: 'Credit Card Reconciliation', icon: CreditCard, status: 'completed', color: 'text-green-400', category: 'Reconciliations' },
    { title: 'Invoice Extraction', icon: FileSearch, status: 'completed', color: 'text-blue-400', category: 'Document Processing' },
    { title: 'Suggested Journal Entries', icon: FileText, status: 'completed', color: 'text-purple-400', category: 'Journal Entries' },
    { title: 'Accrued Entries', icon: DollarSign, status: 'completed', color: 'text-purple-400', category: 'Journal Entries' },
    { title: 'Prepaid Entries', icon: Calculator, status: 'completed', color: 'text-purple-400', category: 'Journal Entries' },
    { title: 'Depreciation Entries', icon: Calculator, status: 'completed', color: 'text-purple-400', category: 'Journal Entries' },
    { title: 'Variance Analysis', icon: TrendingUp, status: 'completed', color: 'text-green-400', category: 'Analysis' },
  ];

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame
    // Calculate half scroll since we duplicated the items
    const singleSetHeight = container.scrollHeight / 2;

    const scroll = () => {
      scrollPosition += scrollSpeed;
      
      // Reset to beginning when we've scrolled through one full set
      if (scrollPosition >= singleSetHeight) {
        scrollPosition = 0;
      }
      
      container.scrollTop = scrollPosition;
    };

    const intervalId = setInterval(scroll, 30);
    
    return () => clearInterval(intervalId);
  }, []);

  return (
    <section className="relative py-24 md:py-32 bg-gradient-to-b from-black via-purple-950/10 to-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div className="text-center lg:text-left">
              <h2
                className="text-4xl md:text-5xl lg:text-6xl text-white mb-6 leading-tight"
                style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700', letterSpacing: '-0.02em' }}
              >
                Month-End Close<br />
                Organized & Fast
              </h2>

              <p
                className="text-gray-400 text-lg md:text-xl max-w-lg"
                style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}
              >
                All your reconciliations, extractions, and journal entries flow seamlessly into one organized checklist. 
                Complete month-end in hours, not days.
              </p>
            </div>

            {/* Illustration */}
            <div className="flex justify-center lg:justify-end">
              <img 
                src={workingIllustration} 
                alt="Working at desk illustration" 
                className="w-full max-w-md h-auto object-contain opacity-80"
              />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Checklist Animation */}
          <div className="relative">
            {/* Checklist Card - No outer box, just content */}
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 
                  className="text-2xl text-white"
                  style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                >
                  Month-End Checklist
                </h3>
                <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
                  December 2024
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Progress
                  </span>
                  <span className="text-blue-400" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '600' }}>
                    100% (9/9 Complete)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-full" />
                </div>
              </div>

              {/* Checklist Items - Auto-scrolling, user can't interact */}
              <div 
                className="max-h-[400px] overflow-hidden pr-2 space-y-2 pointer-events-none" 
                ref={scrollContainerRef}
                style={{ scrollBehavior: 'auto' }}
              >
                {/* Render steps twice for seamless loop */}
                {[...steps, ...steps].map((step, index) => (
                  <div
                    key={`${step.title}-${index}`}
                    className="flex items-center gap-3 p-4 rounded-xl transition-all duration-300 bg-gray-800/50 border border-transparent"
                  >
                    <step.icon className={`w-5 h-5 ${step.color} flex-shrink-0`} />
                    <span 
                      className="flex-1 text-gray-300"
                      style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}
                    >
                      {step.title}
                    </span>
                    {step.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Features List */}
          <div className="space-y-8">
            {/* Feature 1 */}
            <div className="group">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                  <img src={calculatorIcon} alt="Calculator" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h4 
                    className="text-xl text-white mb-2"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                  >
                    Live Trial Balance
                  </h4>
                  <p 
                    className="text-gray-400"
                    style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '400' }}
                  >
                    View your trial balance in real-time as you complete tasks. See exactly where you stand at any moment.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                  <img src={trendingIcon} alt="Trending" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h4 
                    className="text-xl text-white mb-2"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                  >
                    AI-Powered Variance Analysis
                  </h4>
                  <p 
                    className="text-gray-400"
                    style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '400' }}
                  >
                    Automatically detect unusual variances and get AI explanations. Flag issues before they become problems.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                  <img src={documentIcon} alt="Document Search" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h4 
                    className="text-xl text-white mb-2"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                  >
                    Track Missing Documents
                  </h4>
                  <p 
                    className="text-gray-400"
                    style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '400' }}
                  >
                    Instantly see which invoices or receipts are missing. Send automated follow-ups to clients and vendors.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                  <img src={integrationIcon} alt="Integration" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h4 
                    className="text-xl text-white mb-2"
                    style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
                  >
                    Everything in One Place
                  </h4>
                  <p 
                    className="text-gray-400"
                    style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '400' }}
                  >
                    No more switching between tools. Reconciliations, extractions, journal entries—all integrated in one workflow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10" />
    </section>
  );
}